/**
 * 64-bit difference hash, implemented by hand.
 * Input: a 9×8 grayscale image (row-major, 72 bytes). For each row, compare each pixel with
 * its right neighbour: bit = left > right. 8 rows × 8 comparisons = 64 bits.
 * The caller resizes with sharp: .greyscale().resize(9, 8, { fit: "fill" }).raw()
 */
export const DHASH_W = 9;
export const DHASH_H = 8;

export function dHashFromGray(gray: Uint8Array | Buffer): string {
  if (gray.length !== DHASH_W * DHASH_H) throw new Error(`dHash expects ${DHASH_W * DHASH_H} grayscale bytes`);
  let hash = 0n;
  for (let y = 0; y < DHASH_H; y++) {
    for (let x = 0; x < DHASH_W - 1; x++) {
      const left = gray[y * DHASH_W + x];
      const right = gray[y * DHASH_W + x + 1];
      hash = (hash << 1n) | (left > right ? 1n : 0n);
    }
  }
  return hash.toString(16).padStart(16, "0");
}

export function hammingDistance(a: string, b: string): number {
  let x = BigInt("0x" + a) ^ BigInt("0x" + b);
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}

/** Re-uploads within this many differing bits are treated as the same picture. */
export const DUPLICATE_THRESHOLD = 6;
