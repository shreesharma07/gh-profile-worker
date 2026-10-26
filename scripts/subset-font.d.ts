// subset-font ships no type declarations; this covers the call scripts/build-font-data.ts makes.
declare module 'subset-font' {
  interface SubsetOptions {
    targetFormat?: 'sfnt' | 'woff' | 'woff2' | 'truetype';
    variationAxes?: Record<string, number | { min: number; max: number; default?: number }>;
    preserveNameIds?: number[];
  }
  export default function subsetFont(font: Buffer, text: string, options?: SubsetOptions): Promise<Buffer>;
}
