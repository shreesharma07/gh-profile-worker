/** The four numbers on the stats strip. `null` means never fetched successfully. */
export interface Metrics {
  followers: number | null;
  stars: number | null;
  /** WakaTime all-time total, e.g. "3,012 hrs". */
  coding: string | null;
  /** komarev counter, abbreviated, e.g. "27.6K". */
  views: string | null;
}

export type MetricKey = keyof Metrics;

/** Shape of assets/stats.json; `updated` is the UTC date (YYYY-MM-DD) the values last changed. */
export interface StoredStats extends Metrics {
  updated: string;
}

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

/** Calls the runtime `fetch` lazily, so tests can stub `globalThis.fetch`. */
export const defaultFetcher: Fetcher = (input, init) => fetch(input, init);
