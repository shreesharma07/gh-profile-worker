/** Builds the per-run `JobContext` from the Worker bindings. */
import { readConfig, requireToken, type Env } from './config.ts';
import { createGitHubApi } from './github/api.ts';
import { createRepoStore } from './github/repo.ts';
import type { JobContext } from './jobs/types.ts';
import { defaultFetcher, type Fetcher } from './types.ts';

export function createJobContext(env: Env, fetcher: Fetcher = defaultFetcher, now = new Date()): JobContext {
  const config = readConfig(env);
  const api = createGitHubApi(requireToken(env), fetcher);
  const repo = createRepoStore(api, {
    owner: config.owner,
    repo: config.repo,
    branch: config.branch,
    author: config.author,
  });
  return { config, api, repo, fetcher, now };
}
