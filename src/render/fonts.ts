/**
 * Embedded font faces and text measurement. The heavy work (subsetting and
 * shaping with HarfBuzz) happens once in scripts/build-font-data.ts; at runtime
 * this is table lookups, which keeps a render far below the 10 ms CPU budget.
 */
import { FONT_FACES } from './generated/font-data.ts';

export interface FontFace {
  /** CSS family name the face is registered under inside the SVG. */
  key: string;
  /** Real family, used when the embedded subset lacks a glyph. */
  family: string;
  fallback: string;
  /** woff2 subset, base64. */
  woff2: string;
  /** Advance width per character, in em. */
  advances: Readonly<Record<string, number>>;
}

export type FaceKey = keyof typeof FONT_FACES;

/** Width used for characters outside the subset; roughly a monospace cell. */
const FALLBACK_ADVANCE = 0.6;

/** Rendered width in px of `str` in face `key` at `size`. */
export function measure(key: FaceKey, str: string, size: number): number {
  const { advances }: FontFace = FONT_FACES[key];
  let em = 0;
  for (const ch of str) em += advances[ch] ?? FALLBACK_ADVANCE;
  return em * size;
}

/** Largest size <= `size`, in half-pixel steps, at which `str` fits in `max` px. */
export function fit(key: FaceKey, str: string, size: number, max: number): number {
  let s = size;
  while (s > 8 && measure(key, str, s) > max) s -= 0.5;
  return s;
}

/** `@font-face` rule plus the class that selects it, for each face in `keys`. */
export function fontFaceCss(keys: Iterable<FaceKey>): string[] {
  const css: string[] = [];
  for (const key of keys) {
    const f: FontFace = FONT_FACES[key];
    css.push(
      `@font-face{font-family:'${f.key}';src:url(data:font/woff2;base64,${f.woff2}) format('woff2');}`,
      `.${f.key}{font-family:'${f.key}','${f.family}',${f.fallback};font-weight:normal;}`,
    );
  }
  return css;
}
