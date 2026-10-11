/** Offset di base di FNV-1a a 32 bit. */
export const FNV_OFFSET = 0x811c9dc5;

/** FNV-1a a 32 bit: impronta veloce e stabile (non crittografica). */
export function fnv1a(input: string, seed: number = FNV_OFFSET): number {
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}
