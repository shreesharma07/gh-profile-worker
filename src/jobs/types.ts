import type { Config } from '../config.ts';
import type { GitHubApi } from '../github/api.ts';
import type { RepoStore } from '../github/repo.ts';
import type { Fetcher } from '../types.ts';

/** Everything a job may use. Jobs never commit; they return a plan and the runner commits it. */
export interface JobContext {
  config: Config;
  api: GitHubApi;
  repo: RepoStore;
  /** Credential-free fetch for third-party endpoints. */
  fetcher: Fetcher;
  now: Date;
}

export interface JobPlan {
  /** Files to write, `repo path -> full content`. */
  files: Record<string, string>;
  /** False when the output would be identical to what is committed. */
  changed: boolean;
  message: string;
  /** Safe-to-log summary returned by /run and written to the Worker log. */
  details: Record<string, unknown>;
}

export interface Job {
  /** Stable id, used by `/run?job=<name>`. */
  readonly name: string;
  plan(ctx: JobContext): Promise<JobPlan>;
}

export interface JobResult {
  job: string;
  committed: boolean;
  sha?: string;
  reason?: 'dry run' | 'no change' | 'failed';
  error?: string;
  details: Record<string, unknown>;
}
