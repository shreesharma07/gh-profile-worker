import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { Env } from '../src/config.ts';
import { keysMatch, presentedKey } from '../src/http/auth.ts';
import { handleRequest } from '../src/http/router.ts';
import { contents, fakeFetch, json, komarevBadge, text, wakatimeBadge } from './helpers/fake-fetch.ts';

const KEY = 'test-run-key';
const env: Env = { GH_OWNER: 'me', GH_REPO: 'me', GH_TOKEN: 't', RUN_KEY: KEY };
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

/** Route the Worker's default fetcher through a fake for one test. */
function stubFetch() {
  const f = fakeFetch([
    [/contents\/assets\/stats\.json/, () => contents({ followers: 1, stars: 1, coding: '1 hr', views: '1', updated: '2026-01-01' })],
    [/\/users\/me$/, () => json({ followers: 2 })],
    [/\/users\/me\/repos/, () => json([])],
    [/wakatime\.com/, () => text(wakatimeBadge('2 hrs'))],
    [/komarev\.com/, () => text(komarevBadge('2'))],
  ]);
  globalThis.fetch = ((input: string, init?: RequestInit) => f(input, init)) as typeof fetch;
  return f;
}

const call = (method: string, path: string, key: string | null = KEY) =>
  handleRequest(new Request(`https://worker.example${path}`, { method, headers: key ? { Authorization: `Bearer ${key}` } : {} }), env);
const get = (path: string, key: string | null = KEY) => call('GET', path, key);

describe('auth', () => {
  it('reads the key from the Authorization header only, never the query string', () => {
    const req = new Request('https://w.example/run?key=query', { headers: { Authorization: 'Bearer header' } });
    assert.equal(presentedKey(req), 'header');
    assert.equal(presentedKey(new Request(`https://w.example/run?key=${KEY}`)), null);
  });

  it('compares keys exactly', async () => {
    assert.equal(await keysMatch(KEY, KEY), true);
    assert.equal(await keysMatch(`${KEY}x`, KEY), false);
    assert.equal(await keysMatch('', KEY), false);
  });
});

describe('routes', () => {
  it('answers /health without a key', async () => {
    const res = await get('/health', null);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
  });

  it('hides /run and /preview behind the same 404 for a missing or wrong key', async () => {
    for (const path of ['/run', '/preview', '/anything']) {
      assert.equal((await get(path, null)).status, 404, `${path} without key`);
      assert.equal((await get(path, 'nope')).status, 404, `${path} with wrong key`);
    }
    assert.equal((await get(`/run?key=${KEY}`, null)).status, 404, 'query-string key');
  });

  it('disables the manual routes when RUN_KEY is unset', async () => {
    const req = new Request('https://w.example/run', { headers: { Authorization: 'Bearer x' } });
    assert.equal((await handleRequest(req, { ...env, RUN_KEY: '' })).status, 404);
  });

  for (const [method, path] of [['POST', '/run?dry=1'], ['GET', '/run']] as const) {
    it(`${method} ${path} is a dry run and never writes`, async () => {
      const f = stubFetch();
      const res = await call(method, path);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { dryRun: boolean; results: { job: string; reason: string }[] };
      assert.equal(body.dryRun, true);
      assert.deepEqual(body.results.map((r) => [r.job, r.reason]), [['stats', 'dry run']]);
      assert.ok(f.calls.every((c) => c.method === 'GET'));
    });
  }

  it('rejects an unknown job name', async () => {
    assert.equal((await call('POST', '/run?job=nope')).status, 400);
  });

  it('serves the rendered SVG on /preview', async () => {
    stubFetch();
    const res = await get('/preview');
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/svg+xml; charset=utf-8');
    assert.match(await res.text(), /^<svg [\s\S]*>2<\/text>/);
  });
});
