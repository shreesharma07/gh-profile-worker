/**
 * Runs the Worker's jobs on this machine, with no Wrangler and no deploy, and
 * commits the results straight to the profile repo's branch through the GitHub
 * API, exactly as the Cloudflare cron does.
 *
 *   pnpm refresh                 every job, commits what changed
 *   pnpm refresh --dry           compute and print, never commit
 *   pnpm refresh --job=stats     one job
 *
 * Reads GH_TOKEN from .env (or .dev.vars). DRY_RUN=true there also prevents commits.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readConfig } from '../src/config.ts';
import { createJobContext } from '../src/context.ts';
import { findJob, JOBS } from '../src/jobs/registry.ts';
import { runJobs } from '../src/jobs/runner.ts';
import { loadLocalEnv, parseArgs } from './lib/local-env.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
const { env, source } = loadLocalEnv(ROOT);

const job = args.job ? findJob(args.job) : undefined;
if (args.job && !job) {
  console.error(`unknown job "${args.job}"; available: ${JOBS.map((j) => j.name).join(', ')}`);
  process.exit(2);
}

const config = readConfig(env);
const dryRun = args.dry || config.dryRun;
console.log(
  `secrets from ${source ?? 'process environment'} · target ${config.owner}/${config.repo}@${config.branch} · ${dryRun ? 'DRY RUN' : 'will commit'}`,
);

const { results } = await runJobs(job ? [job] : JOBS, createJobContext(env), { dryRun });
console.log(JSON.stringify(results, null, 2));

for (const r of results) {
  if (r.committed)
    console.log(`✔ ${r.job}: committed https://github.com/${config.owner}/${config.repo}/commit/${r.sha}`);
  else console.log(`${r.reason === 'failed' ? '✖' : '•'} ${r.job}: ${r.reason}${r.error ? ` (${r.error})` : ''}`);
}
if (results.some((r) => r.reason === 'failed')) process.exit(1);
