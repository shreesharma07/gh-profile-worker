/** Small drawn icons for the stats tiles, ported from tools/build-profile.mjs. */
import { WAKATIME_ICON_PATH } from './generated/font-data.ts';

export type Glyph = (cx: number, cy: number) => string;

export const GLYPH = {
  star: (cx: number, cy: number, r: number, color: string): string => {
    const pts: string[] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
    }
    return `<polygon points="${pts.join(' ')}" fill="${color}"/>`;
  },
  eye: (cx: number, cy: number, r: number, color: string): string =>
    `<g fill="none" stroke="${color}" stroke-width="2.4"><path d="M${cx - r} ${cy}Q${cx} ${cy - r * 0.95} ${cx + r} ${cy}Q${cx} ${cy + r * 0.95} ${cx - r} ${cy}Z"/><circle cx="${cx}" cy="${cy}" r="${r * 0.32}" fill="${color}"/></g>`,
  people: (cx: number, cy: number, r: number, color: string): string =>
    `<g fill="${color}"><circle cx="${cx - r * 0.35}" cy="${cy - r * 0.35}" r="${r * 0.3}"/><path d="M${cx - r * 0.95} ${cy + r * 0.75}a${r * 0.6} ${r * 0.55} 0 0 1 ${r * 1.2} 0z"/><circle cx="${cx + r * 0.45}" cy="${cy - r * 0.2}" r="${r * 0.25}" opacity=".7"/><path d="M${cx + r * 0.05} ${cy + r * 0.75}a${r * 0.45} ${r * 0.45} 0 0 1 ${r * 0.9} 0z" opacity=".7"/></g>`,
  /** simple-icons WakaTime mark (24x24), placed at (x, y) and scaled to `size`. */
  wakatime: (x: number, y: number, size: number, color: string): string =>
    `<g transform="translate(${x} ${y}) scale(${size / 24})"><path d="${WAKATIME_ICON_PATH}" fill="${color}"/></g>`,
};
