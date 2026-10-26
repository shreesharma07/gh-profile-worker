/**
 * gh-profile-worker: keeps the shreesharma07 profile's generated assets fresh.
 * Cron (or /run) -> every job in src/jobs/registry.ts -> one commit per changed
 * job through the GitHub API. No git, no shell, no Actions minutes.
 */
import type { Env } from './config.ts';
import { createJobContext } from './context.ts';
import { handleRequest } from './http/router.ts';
import { JOBS } from './jobs/registry.ts';
import { runJobs } from './jobs/runner.ts';

async function scheduledRun(cron: string, env: Env): Promise<void> {
  const ctx = createJobContext(env);
  const { results } = await runJobs(JOBS, ctx, { dryRun: ctx.config.dryRun });
  console.log(JSON.stringify({ event: 'scheduled', cron, results }));
  const failed = results.filter((r) => r.reason === 'failed');
  // Throwing marks the cron invocation as failed in the dashboard and in `wrangler tail`.
  if (failed.length) throw new Error(`jobs failed: ${failed.map((r) => `${r.job}: ${r.error}`).join('; ')}`);
}

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(scheduledRun(controller.cron, env));
  },

  async fetch(req, env) {
    try {
      return await handleRequest(req, env);
    } catch (e) {
      console.error(JSON.stringify({ event: 'fetch-error', error: e instanceof Error ? e.message : String(e) }));
      return Response.json({ error: 'internal error' }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
