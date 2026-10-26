/**
 * Runs every metric source in parallel. A source that throws or finds nothing
 * keeps its last good value from assets/stats.json, so a flaky endpoint never
 * blanks a tile.
 */
import type { MetricKey, Metrics } from '../types.ts';

export type MetricSources = { [K in MetricKey]: () => Promise<Metrics[K]> };

export interface Collected {
  metrics: Metrics;
  /** Why each failed source fell back; empty when every source answered. */
  failures: Partial<Record<MetricKey, string>>;
}

/** Fixed order, which is also the key order written to stats.json. */
export const METRIC_KEYS: readonly MetricKey[] = ['followers', 'stars', 'coding', 'views'];

export async function collectMetrics(sources: MetricSources, previous: Partial<Metrics>): Promise<Collected> {
  const results = await Promise.allSettled(METRIC_KEYS.map((key) => sources[key]()));
  const metrics: Record<MetricKey, Metrics[MetricKey]> = { followers: null, stars: null, coding: null, views: null };
  const failures: Collected['failures'] = {};

  results.forEach((result, i) => {
    const key = METRIC_KEYS[i] as MetricKey;
    if (result.status === 'fulfilled' && result.value != null) {
      metrics[key] = result.value;
      return;
    }
    metrics[key] = previous[key] ?? null;
    failures[key] = result.status === 'rejected' ? errorMessage(result.reason) : 'no value found in the response';
  });

  return { metrics: metrics as Metrics, failures };
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
