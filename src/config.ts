/**
 * Worker bindings and the typed configuration derived from them.
 * `[vars]` come from wrangler.toml; GH_TOKEN and RUN_KEY are secrets.
 */
export interface Env {
  GH_OWNER: string;
  GH_REPO: string;
  GH_BRANCH?: string;
  STATS_JSON_PATH?: string;
  STATS_SVG_PATH?: string;
  WAKATIME_USER_ID?: string;
  COMMIT_AUTHOR_NAME?: string;
  COMMIT_AUTHOR_EMAIL?: string;
  DRY_RUN?: string;
  GH_TOKEN?: string;
  RUN_KEY?: string;
}

export interface Config {
  owner: string;
  repo: string;
  branch: string;
  paths: { statsJson: string; statsSvg: string };
  wakatimeUserId: string | null;
  author: { name: string; email: string };
  dryRun: boolean;
}

export class ConfigError extends Error {
  override name = 'ConfigError';
}

const nonEmpty = (v: string | undefined): string | null => (v && v.trim() ? v.trim() : null);

export function readConfig(env: Env): Config {
  const owner = nonEmpty(env.GH_OWNER);
  const repo = nonEmpty(env.GH_REPO);
  if (!owner || !repo) throw new ConfigError('GH_OWNER and GH_REPO must be set in wrangler.toml [vars]');
  return {
    owner,
    repo,
    branch: nonEmpty(env.GH_BRANCH) ?? 'main',
    paths: {
      statsJson: nonEmpty(env.STATS_JSON_PATH) ?? 'assets/stats.json',
      statsSvg: nonEmpty(env.STATS_SVG_PATH) ?? 'assets/stats.svg',
    },
    wakatimeUserId: nonEmpty(env.WAKATIME_USER_ID),
    author: {
      name: nonEmpty(env.COMMIT_AUTHOR_NAME) ?? 'gh-profile-worker',
      email: nonEmpty(env.COMMIT_AUTHOR_EMAIL) ?? 'gh-profile-worker@users.noreply.github.com',
    },
    dryRun: env.DRY_RUN === 'true',
  };
}

/** The GitHub token is read separately so it never travels inside `Config`. */
export function requireToken(env: Env): string {
  const token = nonEmpty(env.GH_TOKEN);
  if (!token) throw new ConfigError('GH_TOKEN secret is not set (.dev.vars locally, `wrangler secret put GH_TOKEN` in production)');
  return token;
}
