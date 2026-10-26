/**
 * Every job the cron runs, in order. To add one: create `src/jobs/<name>.ts`
 * exporting a `Job`, then list it here. Each job's changes land as their own
 * commit, so the log stays readable.
 */
import { statsJob } from './stats.ts';
import type { Job } from './types.ts';

export const JOBS: readonly Job[] = [statsJob];

export const findJob = (name: string): Job | undefined => JOBS.find((job) => job.name === name);
