import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createJobContext } from '../src/context.ts';
import { runJobs } from '../src/jobs/runner.ts';
import { statsJob } from '../src/jobs/stats.ts';
import type { StoredStats } from '../src/types.ts';
import { contents, fakeFetch, json, komarevBadge, text, wakatimeBadge, type Route } from './helpers/fake-fetch.ts';

const env = { GH_OWNER: 'me', GH_REPO: 'me', GH_TOKEN: 't', WAKATIME_USER_ID: 'abc' };
const stored: StoredStats = { followers: 33, stars: 15, coding: '3,012 hrs', views: '27.6K', updated: '2026-10-22' };
const now = new Date('2026-10-26T00:30:00Z');

function sources(followers: number): Route[] {
  return [
    [/GET https:\/\/api\.github\.com\/repos\/me\/me\/contents\/assets\/stats\.json/, () => contents(stored)],
    [/GET https:\/\/api\.github\.com\/users\/me$/, () => json({ followers })],
    [/GET https:\/\/api\.github\.com\/users\/me\/repos/, () => json([{ fork: false, stargazers_count: 15 }])],
    [/wakatime\.com/, () => text(wakatimeBadge('3,012 hrs 40 mins'))],
    [/komarev\.com/, () => text(komarevBadge('27.6K'))],
  ];
}

describe('stats job', () => {
  it('reports no change and keeps the old date when every number is the same', async () => {
    const plan = await statsJob.plan(createJobContext(env, fakeFetch(sources(33)), now));
    assert.equal(plan.changed, false);
    assert.deepEqual(JSON.parse(plan.files['assets/stats.json'] ?? ''), stored);
  });

  it('moves `updated` to today when a number changes', async () => {
    const plan = await statsJob.plan(createJobContext(env, fakeFetch(sources(34)), now));
    assert.equal(plan.changed, true);
    assert.deepEqual(JSON.parse(plan.files['assets/stats.json'] ?? ''), { ...stored, followers: 34, updated: '2026-10-26' });
    assert.match(plan.files['assets/stats.svg'] ?? '', />34<\/text>/);
  });

  it('writes stats.json keys in the existing order', async () => {
    const plan = await statsJob.plan(createJobContext(env, fakeFetch(sources(34)), now));
    assert.deepEqual(Object.keys(JSON.parse(plan.files['assets/stats.json'] ?? '')), ['followers', 'stars', 'coding', 'views', 'updated']);
  });

  it('never commits on a dry run', async () => {
    const f = fakeFetch(sources(34));
    const { results } = await runJobs([statsJob], createJobContext(env, f, now), { dryRun: true });
    assert.equal(results[0]?.reason, 'dry run');
    assert.ok(!f.calls.some((c) => c.method !== 'GET'));
  });

  it('reports a failing job instead of throwing', async () => {
    const f = fakeFetch([[/contents\//, () => text('Bad credentials', 401)]]);
    const { results } = await runJobs([statsJob], createJobContext(env, f, now), { dryRun: false });
    assert.equal(results[0]?.reason, 'failed');
    assert.match(results[0]?.error ?? '', /HTTP 401/);
  });
});
