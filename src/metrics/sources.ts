/**
 * One function per tile. GitHub numbers go through the token-scoped API client
 * (Cloudflare's shared egress IPs exhaust GitHub's anonymous rate limit fast);
 * WakaTime and komarev get a plain request with no credentials at all.
 */
import type { GitHubApi } from '../github/api.ts';
import type { Fetcher, Metrics } from '../types.ts';
import { svgTexts } from './svg-text.ts';

const USER_AGENT = 'gh-profile-worker';
/** Ten pages of 100 repos keeps a run well inside the 50-subrequest free limit. */
const MAX_REPO_PAGES = 10;

async function getText(fetcher: Fetcher, url: string): Promise<string> {
  const res = await fetcher(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

export async function fetchFollowers(api: GitHubApi, owner: string): Promise<Metrics['followers']> {
  const user = await api.request<{ followers: number }>('GET', `/users/${encodeURIComponent(owner)}`);
  return user.followers;
}

/** Stars across the owner's non-fork repositories. */
export async function fetchStars(api: GitHubApi, owner: string): Promise<Metrics['stars']> {
  let stars = 0;
  for (let page = 1; page <= MAX_REPO_PAGES; page++) {
    const repos = await api.request<{ fork: boolean; stargazers_count: number }[]>(
      'GET',
      `/users/${encodeURIComponent(owner)}/repos?per_page=100&type=owner&page=${page}`,
    );
    stars += repos.filter((r) => !r.fork).reduce((sum, r) => sum + r.stargazers_count, 0);
    if (repos.length < 100) break;
  }
  return stars;
}

/** All-time total from the public WakaTime badge, minutes dropped: "3,012 hrs 7 mins" -> "3,012 hrs". */
export async function fetchCodingTime(fetcher: Fetcher, wakatimeUserId: string | null): Promise<Metrics['coding']> {
  if (!wakatimeUserId) return null;
  const svg = await getText(fetcher, `https://wakatime.com/badge/user/${encodeURIComponent(wakatimeUserId)}.svg`);
  const total = svgTexts(svg).find((t) => /\bhrs?\b/.test(t));
  return total ? total.replace(/\s+\d+\s+mins?$/, '') : null;
}

/**
 * Abbreviated profile views from the komarev counter, e.g. "27.6K".
 * komarev counts every request as a view, so each refresh adds one.
 */
export async function fetchProfileViews(fetcher: Fetcher, owner: string): Promise<Metrics['views']> {
  const svg = await getText(
    fetcher,
    `https://komarev.com/ghpvc/?username=${encodeURIComponent(owner)}&abbreviated=true`,
  );
  return svgTexts(svg).find((t) => /^[\d.,]+[KMB]?$/.test(t)) ?? null;
}
