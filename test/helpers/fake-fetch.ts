/** A scripted `fetch` that records every call; routes are matched in order on "METHOD url". */
import type { Fetcher } from '../../src/types.ts';

export interface Call {
  method: string;
  url: string;
  headers: Headers;
  body: unknown;
}

export type Route = [pattern: RegExp, respond: (call: Call) => Response | Promise<Response>];

export function fakeFetch(routes: Route[]): Fetcher & { calls: Call[] } {
  const calls: Call[] = [];
  const fn = async (url: string, init: RequestInit = {}) => {
    const call: Call = {
      method: init.method ?? 'GET',
      url,
      headers: new Headers(init.headers),
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    const route = routes.find(([pattern]) => pattern.test(`${call.method} ${url}`));
    if (!route) return new Response(`no fake route for ${call.method} ${url}`, { status: 599 });
    return route[1](call);
  };
  return Object.assign(fn, { calls });
}

export const json = (body: unknown, status = 200) => Response.json(body, { status });
export const text = (body: string, status = 200) => new Response(body, { status });

/** GitHub's contents API shape for a JSON file. */
export const contents = (value: unknown) =>
  json({ content: Buffer.from(JSON.stringify(value), 'utf8').toString('base64'), encoding: 'base64' });

export const wakatimeBadge = (total: string) => `<svg><text x="1">wakatime</text><text x="2">${total}</text></svg>`;
export const komarevBadge = (views: string) => `<svg><text x="1">Profile views</text><text x="2">${views}</text></svg>`;
