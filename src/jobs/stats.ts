/**
 * Stats strip job, the replacement for `node build-profile.mjs --stats-only`:
 * fetch the four numbers, redraw assets/stats.svg, and store the values in
 * assets/stats.json. `updated` only moves when a number changes, so a quiet
 * day produces no commit.
 */
import { collectMetrics, METRIC_KEYS, type MetricSources } from '../metrics/collect.ts';
import { fetchCodingTime, fetchFollowers, fetchProfileViews, fetchStars } from '../metrics/sources.ts';
import { renderStatsStrip } from '../render/stats-strip.ts';
import type { StoredStats } from '../types.ts';
import type { Job, JobContext, JobPlan } from './types.ts';

export const STATS_COMMIT_MESSAGE = 'chore: refresh profile stats';

function sources({ api, fetcher, config }: JobContext): MetricSources {
  return {
    followers: () => fetchFollowers(api, config.owner),
    stars: () => fetchStars(api, config.owner),
    coding: () => fetchCodingTime(fetcher, config.wakatimeUserId),
    views: () => fetchProfileViews(fetcher, config.owner),
  };
}

export const statsJob: Job = {
  name: 'stats',

  async plan(ctx: JobContext): Promise<JobPlan> {
    const { statsJson, statsSvg } = ctx.config.paths;
    const previous = (await ctx.repo.readJson<Partial<StoredStats>>(statsJson)) ?? {};
    const { metrics, failures } = await collectMetrics(sources(ctx), previous);

    const changed = METRIC_KEYS.some((key) => metrics[key] !== (previous[key] ?? null));
    const today = ctx.now.toISOString().slice(0, 10);
    const stored: StoredStats = { ...metrics, updated: changed || !previous.updated ? today : previous.updated };

    return {
      files: {
        [statsJson]: `${JSON.stringify(stored, null, 2)}\n`,
        [statsSvg]: renderStatsStrip(stored),
      },
      changed,
      message: STATS_COMMIT_MESSAGE,
      details: { metrics: stored, failures },
    };
  },
};
