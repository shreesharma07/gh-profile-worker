/**
 * HTTP routes. Anything other than /health needs `Authorization: Bearer
 * <RUN_KEY>`; a wrong key, a missing key and an unknown path all get the same
 * 404, so the Worker reveals nothing about itself to scanners.
 *
 *   GET  /health               liveness, no auth
 *   POST /run[?dry=1][&job=]   run every job (or one) like the cron does
 *   GET  /run[?job=]           always a dry run: GET never writes
 *   GET  /preview              freshly rendered stats SVG, never commits
 */
import { type Env, readConfig } from '../config.ts';
import { createJobContext } from '../context.ts';
import { findJob, JOBS } from '../jobs/registry.ts';
import { runJobs } from '../jobs/runner.ts';
import { statsJob } from '../jobs/stats.ts';
import type { Job } from '../jobs/types.ts';
import { isAuthorized } from './auth.ts';

const notFound = () => new Response('Not found', { status: 404 });
const noStore = { 'cache-control': 'no-store' };

export async function handleRequest(req: Request, env: Env): Promise<Response> {
  const { pathname, searchParams } = new URL(req.url);

  if (pathname === '/health' && req.method === 'GET') return Response.json({ ok: true }, { headers: noStore });
  if (!(await isAuthorized(req, env.RUN_KEY))) return notFound();

  if (pathname === '/run' && (req.method === 'GET' || req.method === 'POST')) {
    const name = searchParams.get('job');
    const job = name ? findJob(name) : undefined;
    if (name && !job)
      return Response.json({ error: `unknown job "${name}"`, jobs: JOBS.map((j) => j.name) }, { status: 400 });
    const jobs: readonly Job[] = job ? [job] : JOBS;
    const dryRun = req.method === 'GET' || searchParams.get('dry') === '1' || readConfig(env).dryRun;
    const { results } = await runJobs(jobs, createJobContext(env), { dryRun });
    const failed = results.some((r) => r.reason === 'failed');
    return Response.json({ dryRun, results }, { status: failed ? 502 : 200, headers: noStore });
  }

  if (pathname === '/preview' && req.method === 'GET') {
    const ctx = createJobContext(env);
    const { results, plans } = await runJobs([statsJob], ctx, { dryRun: true });
    const svg = plans.get(statsJob.name)?.files[ctx.config.paths.statsSvg];
    if (!svg) return Response.json({ results }, { status: 502, headers: noStore });
    return new Response(svg, { headers: { 'content-type': 'image/svg+xml; charset=utf-8', ...noStore } });
  }

  return notFound();
}
