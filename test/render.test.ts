import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fit, measure } from '../src/render/fonts.ts';
import { FONT_FACES } from '../src/render/generated/font-data.ts';
import { LABELS, MISSING_VALUE, VALUE_CHARSET } from '../src/render/labels.ts';
import { renderStatsStrip } from '../src/render/stats-strip.ts';
import type { StoredStats } from '../src/types.ts';

const stats: StoredStats = { followers: 33, stars: 15, coding: '3,012 hrs', views: '27.6K', updated: '2026-10-22' };

describe('renderStatsStrip', () => {
  it('draws the four tiles with their values and labels', () => {
    const svg = renderStatsStrip(stats);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="1200" height="108"/);
    for (const label of Object.values(LABELS)) assert.ok(svg.includes(`>${label}</text>`), label);
    for (const value of ['27.6K', '3,012 hrs', '33', '15']) assert.ok(svg.includes(`>${value}</text>`), value);
    assert.ok(svg.includes('(updated 2026-10-22)</title>'));
  });

  it('embeds both font faces once', () => {
    const svg = renderStatsStrip(stats);
    assert.equal(svg.match(/@font-face/g)?.length, 2);
    assert.ok(svg.includes(FONT_FACES.d7.woff2) && svg.includes(FONT_FACES.m4.woff2));
  });

  it('shows the placeholder for metrics that were never fetched', () => {
    const svg = renderStatsStrip({ followers: null, stars: null, coding: null, views: null, updated: '2026-10-22' });
    assert.equal(svg.match(new RegExp(`>${MISSING_VALUE}</text>`, 'g'))?.length, 4);
  });

  it('escapes values before they reach the markup', () => {
    const svg = renderStatsStrip({ ...stats, coding: '<script>"x"&' });
    assert.ok(!svg.includes('<script>'));
    assert.ok(svg.includes('&lt;script&gt;&quot;x&quot;&amp;'));
  });

  it('is deterministic', () => {
    assert.equal(renderStatsStrip(stats), renderStatsStrip(stats));
  });
});

describe('font metrics', () => {
  it('has an advance for every character the values may contain', () => {
    for (const ch of VALUE_CHARSET)
      assert.ok(FONT_FACES.d7.advances[ch as keyof typeof FONT_FACES.d7.advances] > 0, ch);
  });

  it('keeps the size when the text fits and shrinks it in half steps when it does not', () => {
    assert.equal(fit('d7', '3,012 hrs', 28, 175), 28);
    const long = '1,234,567,890 hrs';
    const size = fit('d7', long, 28, 175);
    assert.ok(size < 28 && size * 2 === Math.round(size * 2));
    assert.ok(measure('d7', long, size) <= 175);
  });
});
