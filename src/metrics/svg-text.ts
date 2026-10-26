/** Trimmed contents of every `<text>` element in an SVG badge, in document order. */
export function svgTexts(svg: string): string[] {
  return [...svg.matchAll(/<text[^>]*>([^<]+)<\/text>/g)].map((m) => (m[1] ?? '').trim());
}
