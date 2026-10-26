/**
 * Every string the stats strip can draw. scripts/build-font-data.ts subsets the
 * fonts to exactly these characters, so change them here and regenerate.
 */
export const LABELS = {
  views: 'PROFILE VIEWS',
  coding: 'CODING TIME · ALL TIME',
  followers: 'FOLLOWERS',
  stars: 'STARS EARNED',
} as const;

/** Drawn when a metric has never been fetched. */
export const MISSING_VALUE = '·';

/**
 * Characters the values can contain: digits and separators, the komarev
 * suffixes (27.6K) and WakaTime's unit (3,012 hrs). Anything else still
 * renders, in the fallback system font.
 */
export const VALUE_CHARSET = `0123456789.,KMB hrs${MISSING_VALUE}`;

export const LABEL_CHARSET = [...new Set(`${Object.values(LABELS).join('')} `)].join('');
