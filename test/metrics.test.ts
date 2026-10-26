import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createGitHubApi } from '../src/github/api.ts';
import { collectMetrics } from '../src/metrics/collect.ts';
import { fetchCodingTime, fetchProfileViews, fetchStars } from '../src/metrics/sources.ts';
import { svgTexts } from '../src/metrics/svg-text.ts';
import { fakeFetch, json, komarevBadge, text, wakatimeBadge } from './helpers/fake-fetch.ts';

describe('svgTexts', () => {
  it('returns trimmed text nodes in order', () => {
    assert.deepEqual(svgTexts('<svg><text a="1"> one </text><g><text>two</text></g></svg>'), ['one', 'two']);
  });
});

describe('metric sources', () => {
  it('drops minutes from the WakaTime total', async () => {
    const f = fakeFetch([[/wakatime\.com\/badge\/user\/abc\.svg$/, () => text(wakatimeBadge('3,012 hrs 7 mins'))]]);
    assert.equal(await fetchCodingTime(f, 'abc'), '3,012 hrs');
  });

  it('skips WakaTime when no user id is configured', async () => {
    const f = fakeFetch([]);
    assert.equal(await fetchCodingTime(f, null), null);
    assert.equal(f.calls.length, 0);
  });

  it('reads the abbreviated komarev count without credentials', async () => {
    const f = fakeFetch([[/komarev\.com\/ghpvc\/\?username=me&abbreviated=true$/, () => text(komarevBadge('27.6K'))]]);
    assert.equal(await fetchProfileViews(f, 'me'), '27.6K');
    assert.equal(f.calls[0]?.headers.get('Authorization'), null);
  });

  it('sums stars across pages and ignores forks', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({ fork: i === 0, stargazers_count: 1 }));
    const f = fakeFetch([
      [/page=1$/, () => json(page1)],
      [/page=2$/, () => json([{ fork: false, stargazers_count: 5 }])],
    ]);
    assert.equal(await fetchStars(createGitHubApi('t', f), 'me'), 99 + 5);
  });
});

describe('collectMetrics', () => {
  it('keeps the previous value for a source that fails or finds nothing', async () => {
    const { metrics, failures } = await collectMetrics(
      {
        followers: async () => 40,
        stars: async () => { throw new Error('HTTP 503'); },
        coding: async () => null,
        views: async () => '28K',
      },
      { followers: 33, stars: 15, coding: '3,012 hrs', views: '27.6K' },
    );
    assert.deepEqual(metrics, { followers: 40, stars: 15, coding: '3,012 hrs', views: '28K' });
    assert.deepEqual(failures, { stars: 'HTTP 503', coding: 'no value found in the response' });
  });

  it('uses null for a metric that has never been fetched', async () => {
    const { metrics } = await collectMetrics(
      { followers: async () => 1, stars: async () => 2, coding: async () => null, views: async () => null },
      {},
    );
    assert.equal(metrics.coding, null);
    assert.equal(metrics.views, null);
  });
});
