/**
 * Asks the deployed Worker to run now, the manual equivalent of its cron:
 *
 *   pnpm trigger                 POST /run, commits what changed
 *   pnpm trigger --dry           POST /run?dry=1, never commits
 *   pnpm trigger --job=stats     one job
 *
 * Reads WORKER_URL and RUN_KEY from .env (or .dev.vars). The key is sent only
 * in the Authorization header.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLocalEnv, parseArgs } from './lib/local-env.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
const { env } = loadLocalEnv(ROOT);

const workerUrl = env.WORKER_URL?.replace(/\/+$/, '');
if (!workerUrl || !env.RUN_KEY) {
  console.error('WORKER_URL and RUN_KEY must be set in .env (see .env.example)');
  process.exit(2);
}

const url = new URL(`${workerUrl}/run`);
if (args.dry) url.searchParams.set('dry', '1');
if (args.job) url.searchParams.set('job', args.job);

console.log(`POST ${url} · ${args.dry ? 'DRY RUN' : 'will commit'}`);
const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${env.RUN_KEY}` } });
const body = await res.text();
try {
  console.log(JSON.stringify(JSON.parse(body), null, 2));
} catch {
  console.log(body);
}
if (res.status === 404) console.error('404: wrong RUN_KEY, or RUN_KEY is not set on the Worker');
if (!res.ok) process.exit(1);
