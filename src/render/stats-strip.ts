/**
 * Four-tile stats strip (profile views, coding time, followers, stars): a
 * pure string builder ported from `statsSvg()` in tools/build-profile.mjs, so
 * assets/stats.svg keeps the exact layout of the rest of the profile.
 */
import type { StoredStats } from '../types.ts';
import { fit } from './fonts.ts';
import { GLYPH, type Glyph } from './glyphs.ts';
import { LABELS, MISSING_VALUE } from './labels.ts';
import { cardRect, SvgDoc } from './svg.ts';
import { C } from './theme.ts';

const W = 1200;
const H = 108;
const GAP = 20;

interface Tile {
  label: string;
  value: string;
  color: string;
  icon: Glyph;
}

const show = (v: string | number | null) => (v == null ? MISSING_VALUE : String(v));

function tiles(st: StoredStats): Tile[] {
  return [
    { label: LABELS.views, value: show(st.views), color: C.blue, icon: (cx, cy) => GLYPH.eye(cx, cy, 13, C.blue) },
    {
      label: LABELS.coding,
      value: show(st.coding),
      color: C.purple,
      icon: (cx, cy) => GLYPH.wakatime(cx - 11, cy - 11, 22, C.purple),
    },
    {
      label: LABELS.followers,
      value: show(st.followers),
      color: C.green,
      icon: (cx, cy) => GLYPH.people(cx, cy, 13, C.green),
    },
    { label: LABELS.stars, value: show(st.stars), color: C.yellow, icon: (cx, cy) => GLYPH.star(cx, cy, 12, C.yellow) },
  ];
}

export function renderStatsStrip(st: StoredStats): string {
  const list = tiles(st);
  const tw = (W - GAP * (list.length - 1)) / list.length;
  const title = `${list.map((t) => `${t.label.toLowerCase()}: ${t.value}`).join(', ')} (updated ${st.updated})`;
  const doc = new SvgDoc(W, H, title);

  list.forEach((t, i) => {
    const x = i * (tw + GAP);
    const icx = x + 48;
    const icy = H / 2;
    const vx = x + 24 + 48 + 18;
    const room = tw - (vx - x) - 20;
    doc.raw(`<g class="rise" style="animation-delay:${(i * 0.08).toFixed(2)}s">`);
    doc.raw(cardRect(x, 0, tw, H));
    doc.raw(
      `<rect x="${x + 24}" y="${icy - 24}" width="48" height="48" rx="13" fill="${t.color}" fill-opacity=".12" stroke="${t.color}" stroke-opacity=".45"/>`,
    );
    doc.raw(t.icon(icx, icy));
    doc.text('d7', t.value, { x: vx, y: icy + 4, size: fit('d7', t.value, 28, room), fill: C.text });
    doc.text('m4', t.label, { x: vx, y: icy + 28, size: fit('m4', t.label, 11.5, room), fill: C.faint });
    doc.raw(
      `<circle cx="${x + tw - 18}" cy="18" r="3.5" fill="${t.color}" style="animation:pulse 2s ease-in-out ${(i * 0.4).toFixed(1)}s infinite"/>`,
    );
    doc.raw('</g>');
  });
  return doc.render();
}
