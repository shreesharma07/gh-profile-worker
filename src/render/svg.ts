/** A tiny SVG document builder: the parts of the builder's `Svg` class the strip needs. */

import { type FaceKey, fontFaceCss } from './fonts.ts';
import { C } from './theme.ts';

export const xml = (s: unknown): string =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const COMMON_CSS = [
  '@keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
  '@keyframes pulse{0%,100%{opacity:.35}50%{opacity:1}}',
  '.rise{animation:rise .7s cubic-bezier(.2,.8,.2,1) both}',
  '@media (prefers-reduced-motion:reduce){*{animation:none!important;}}',
];

export const cardRect = (x: number, y: number, w: number, h: number, rx = 16): string =>
  `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="${rx}" fill="${C.bg}" stroke="${C.border}"/>`;

export interface TextOptions {
  x: number;
  y: number;
  size: number;
  fill?: string;
  anchor?: 'start' | 'middle' | 'end';
}

export class SvgDoc {
  readonly #body: string[] = [];
  /** Faces in first-use order; only these are embedded. */
  readonly #faces = new Set<FaceKey>();
  readonly width: number;
  readonly height: number;
  readonly title: string;

  constructor(width: number, height: number, title: string) {
    this.width = width;
    this.height = height;
    this.title = title;
  }

  text(key: FaceKey, str: string, { x, y, size, fill = C.text, anchor = 'start' }: TextOptions): void {
    this.#faces.add(key);
    this.#body.push(
      `<text x="${x}" y="${y}" class="${key}" font-size="${size}" fill="${fill}" text-anchor="${anchor}">${xml(str)}</text>`,
    );
  }

  raw(markup: string): void {
    this.#body.push(markup);
  }

  render(): string {
    const css = [...fontFaceCss(this.#faces), ...COMMON_CSS].join('\n');
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}" role="img" aria-label="${xml(this.title)}">`,
      `<title>${xml(this.title)}</title>`,
      `<style>\n${css}\n</style>`,
      ...this.#body,
      '</svg>',
      '',
    ].join('\n');
  }
}
