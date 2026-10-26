/**
 * RUN_KEY check for the manual routes. The key is accepted only as
 * `Authorization: Bearer <key>`: a query string would leave the long-lived
 * secret in access logs, proxies and shell history. Comparison is constant time.
 */

export function presentedKey(req: Request): string | null {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice('Bearer '.length).trim() || null;
}

async function sha256(s: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
}

/** Hashing first gives both sides the same length, so neither length nor content leaks through timing. */
export async function keysMatch(presented: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(presented), sha256(expected)]);
  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual?: (x: ArrayBufferView, y: ArrayBufferView) => boolean;
  };
  if (typeof subtle.timingSafeEqual === 'function') return subtle.timingSafeEqual(a, b);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** False when RUN_KEY is unset: the manual routes are then disabled entirely. */
export async function isAuthorized(req: Request, runKey: string | undefined): Promise<boolean> {
  if (!runKey) return false;
  const key = presentedKey(req);
  return key !== null && (await keysMatch(key, runKey));
}
