/**
 * Plans each job and commits the ones that changed. One failing job does not
 * stop the others; its error is reported in the results instead.
 */
import type { Job, JobContext, JobPlan, JobResult } from './types.ts';

export interface RunOptions {
  dryRun: boolean;
}

export interface RunOutcome {
  results: JobResult[];
  /** Plans kept for `/preview`; never logged. */
  plans: Map<string, JobPlan>;
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function runJobs(jobs: readonly Job[], ctx: JobContext, { dryRun }: RunOptions): Promise<RunOutcome> {
  const results: JobResult[] = [];
  const plans = new Map<string, JobPlan>();

  for (const job of jobs) {
    try {
      const plan = await job.plan(ctx);
      plans.set(job.name, plan);
      const base = { job: job.name, details: { ...plan.details, changed: plan.changed } };
      if (dryRun) results.push({ ...base, committed: false, reason: 'dry run' });
      else if (!plan.changed) results.push({ ...base, committed: false, reason: 'no change' });
      else results.push({ ...base, committed: true, sha: await ctx.repo.commitFiles(plan.files, plan.message) });
    } catch (e) {
      results.push({ job: job.name, committed: false, reason: 'failed', error: errorMessage(e), details: {} });
    }
  }
  return { results, plans };
}
