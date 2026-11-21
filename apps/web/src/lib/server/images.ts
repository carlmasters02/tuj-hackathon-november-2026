import "server-only";
import sharp from "sharp";
import { dHashFromGray, DHASH_H, DHASH_W } from "@hm/shared/gallery/dhash";
import { embedWatermark, extractWatermark, type WatermarkData } from "@hm/shared/gallery/watermark";

sharp.cache(false);
// decompression-bomb guard: refuse images above ~50 megapixels
const LIMIT = { limitInputPixels: 50_000_000 };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Re-encodes from raw pixels: drops EXIF/GPS/ICC/XMP and any payload hidden in the container. */
export async function normalizeImage(input: Buffer): Promise<{ raw: Buffer; width: number; height: number }> {
  const img = sharp(input, LIMIT).rotate(); // apply EXIF orientation, then forget EXIF
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { raw: data, width: info.width, height: info.height };
}

export async function dHashOf(raw: Buffer, width: number, height: number): Promise<string> {
  const gray = await sharp(raw, { raw: { width, height, channels: 4 } }).greyscale().resize(DHASH_W, DHASH_H, { fit: "fill" }).raw().toBuffer();
  return dHashFromGray(gray.subarray(0, DHASH_W * DHASH_H));
}

/** Lossless PNG master with the invisible ownership watermark in the blue LSBs. */
export async function watermarkedMaster(raw: Buffer, width: number, height: number, wm: WatermarkData, key: Uint8Array): Promise<Buffer> {
  const px = Buffer.from(raw);
  embedWatermark(px, 4, wm, key);
  return sharp(px, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
}

export async function readWatermark(input: Buffer, key: Uint8Array) {
  const { data } = await sharp(input, LIMIT).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return extractWatermark(data, 4, key);
}

function tileSvg(text: string, w: number, h: number, opacity: number, size: number, angle = -30): Buffer {
  const step = Math.max(160, size * text.length * 0.65);
  let cells = "";
  for (let y = -h; y < h * 2; y += size * 5) for (let x = -w; x < w * 2; x += step) cells += `<text x="${x}" y="${y}">${esc(text)}</text>`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><g transform="rotate(${angle} ${w / 2} ${h / 2})" font-family="sans-serif" font-size="${size}" fill="white" fill-opacity="${opacity}" stroke="black" stroke-opacity="${opacity * 0.6}" stroke-width="0.5">${cells}</g></svg>`,
  );
}

/** Preview: ≤1200 px, with a faint tiled visible watermark of the owner's handle. */
export async function makePreview(raw: Buffer, width: number, height: number, ownerHandle: string): Promise<{ buf: Buffer; width: number; height: number }> {
  const resized = await sharp(raw, { raw: { width, height, channels: 4 } }).resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = resized.info;
  const buf = await sharp(resized.data).composite([{ input: tileSvg(`@${ownerHandle} · Humagination`, w, h, 0.12, Math.max(14, Math.round(w / 40))) }]).webp({ quality: 82 }).toBuffer();
  return { buf, width: w, height: h };
}

/**
 * Per-viewer serve: overlays a near-invisible tiled watermark with the *viewer's* username and the
 * date, so a screenshot or leaked file can be traced back to the account that viewed it.
 */
export async function viewerWatermark(preview: Buffer, viewer: string, date: string): Promise<Buffer> {
  const meta = await sharp(preview).metadata();
  const w = meta.width ?? 800;
  const h = meta.height ?? 600;
  return sharp(preview)
    .composite([{ input: tileSvg(`${viewer} ${date}`, w, h, 0.045, Math.max(12, Math.round(w / 55)), 25) }])
    .webp({ quality: 80 })
    .toBuffer();
}
