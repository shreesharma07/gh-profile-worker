/**
 * Minimal GitHub REST client. This is the only module that holds GH_TOKEN, and
 * it only ever sends it to api.github.com: every URL is built from API_ORIGIN.
 */
import { defaultFetcher, type Fetcher } from '../types.ts';

export const API_ORIGIN = 'https://api.github.com';
const USER_AGENT = 'gh-profile-worker';

export type Method = 'GET' | 'POST' | 'PATCH';

export class GitHubError extends Error {
  override name = 'GitHubError';
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface GitHubApi {
  /** `path` is relative to the API root, e.g. `/users/octocat`. */
  request<T>(method: Method, path: string, body?: unknown): Promise<T>;
}

export function createGitHubApi(token: string, fetcher: Fetcher = defaultFetcher): GitHubApi {
  return {
    async request<T>(method: Method, path: string, body?: unknown): Promise<T> {
      if (!path.startsWith('/')) throw new Error(`GitHub API path must start with "/": ${path}`);
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': USER_AGENT,
      };
      const init: RequestInit = { method, headers };
      if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(body);
      }
      const res = await fetcher(`${API_ORIGIN}${path}`, init);
      if (!res.ok) {
        // GitHub's error body never echoes the token; trim it to keep logs short.
        const detail = (await res.text()).slice(0, 300);
        throw new GitHubError(`GitHub ${method} ${path} -> HTTP ${res.status}: ${detail}`, res.status);
      }
      return (res.status === 204 ? null : await res.json()) as T;
    },
  };
}
