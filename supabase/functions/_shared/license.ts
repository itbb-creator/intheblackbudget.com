/**
 * License ID generation — portable (Deno edge runtime + Node.js).
 *
 * Format: PRV-XXXXXXXX (e.g. PRV-7K4X9P2M)
 *
 * The alphabet intentionally drops characters that people misread or mistype:
 * 0, O, 1, I, L are excluded. 8 chars over a 31-char alphabet gives ~8.5e11
 * combinations — collision-safe for this use case, and the DB enforces
 * uniqueness anyway (see migrations/20260814000000_licensing.sql).
 */

const LICENSE_PREFIX = 'PRV-';
const LICENSE_LENGTH = 8;
// No 0/O/1/I/L — all remaining glyphs are unambiguous in any font.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function randomInt(maxExclusive: number): number {
  const maxUint32 = 0xffffffff;
  // Rejection sampling to avoid modulo bias.
  const limit = maxUint32 - (maxUint32 % maxExclusive);
  const buf = new Uint32Array(1);
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % maxExclusive;
}

/** Generates a fresh license ID like `PRV-7K4X9P2M`. */
export function generateLicenseId(
  prefix: string = LICENSE_PREFIX,
  length: number = LICENSE_LENGTH,
): string {
  let out = prefix;
  for (let i = 0; i < length; i++) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}

/** True if a string looks like a license ID we issued. */
export function isLicenseId(value: string): boolean {
  const matchedPrefix = [LICENSE_PREFIX, 'ITB-'].find((prefix) => value.startsWith(prefix));
  if (!matchedPrefix) return false;
  const body = value.slice(matchedPrefix.length);
  if (body.length !== LICENSE_LENGTH) return false;
  return [...body].every((ch) => ALPHABET.includes(ch));
}
