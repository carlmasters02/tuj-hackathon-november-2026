// Generates every logo/icon asset from brand/humagination-logo.png (white background).
// Run: pnpm --filter web brand   (re-run whenever the source logo changes)
//
//  - src/assets/logo.png             full logo, transparent, trimmed (in-app header & hero)
//  - src/assets/bulb.png            light bulb, transparent (in-page illustration)
//  - src/app/icon.png                light bulb, transparent (browser favicon)
//  - src/app/apple-icon.png          light bulb on parchment, opaque (iPhone home screen)
//  - public/icons/icon-*.png         light bulb (Android / PWA "any")
//  - public/icons/maskable-*.png     light bulb inside the Android safe zone, on parchment
//  - ../extension/public/icon*.png   light bulb (Chrome toolbar / store)
//  - ../extension/public/logo.png    full logo for the extension's pages
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(web, "brand", "humagination-logo.png");
const PARCHMENT = { r: 0xf7, g: 0xf0, b: 0xe1, alpha: 1 };
// light-bulb region of the source logo (rays included), in source pixels
const BULB = { left: 1570, top: 180, width: 395, height: 490 };

/** "Colour to alpha" against white: solid colours stay opaque, anti-aliased edges become partly transparent. */
async function whiteToAlpha(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const d = Math.max(255 - data[i], 255 - data[i + 1], 255 - data[i + 2]);
    const a = Math.min(1, Math.max(0, (d - 6) / 84));
    if (a === 0) {
      data[i + 3] = 0;
      continue;
    }
    if (a < 1) for (let c = 0; c < 3; c++) data[i + c] = Math.max(0, Math.min(255, Math.round(255 - (255 - data[i + c]) / a)));
    data[i + 3] = Math.round(a * 255);
  }
  return sharp(data, { raw: info }).png();
}

const out = (p) => {
  mkdirSync(dirname(p), { recursive: true });
  return p;
};

/** Bulb centred on a square canvas, occupying `fill` of the height. */
async function bulbIcon(size, fill, background) {
  const cut = await sharp(await (await whiteToAlpha(SRC)).toBuffer()).extract(BULB).png().toBuffer();
  const bulb = await sharp(cut).trim({ threshold: 1 }).toBuffer(); // sharp trims before extracting if chained
  const target = Math.round(size * fill);
  const scaled = await sharp(bulb).resize({ width: target, height: target, fit: "inside" }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: scaled, gravity: "center" }])
    .png({ compressionLevel: 9 });
}

const transparentLogo = await (await whiteToAlpha(SRC)).toBuffer();

/** Full lockup: keep the bulb size, but make the wordmark 15% larger for legibility in the nav. */
async function fullLogo(width) {
  const trimmed = await sharp(transparentLogo).trim({ threshold: 1 }).png().toBuffer();
  const { width: sourceWidth, height: sourceHeight } = await sharp(trimmed).metadata();
  const split = Math.floor(sourceWidth * 0.79); // between the wordmark and the bulb's left ray
  const cut = async (left, width) => sharp(await sharp(trimmed).extract({ left, top: 0, width, height: sourceHeight }).png().toBuffer()).trim({ threshold: 1 }).png().toBuffer();
  const [word, bulb] = await Promise.all([cut(0, split), cut(split, sourceWidth - split)]);
  const scale = width / sourceWidth;
  const bulbImage = await sharp(bulb).resize({ height: Math.round(sourceHeight * scale) }).png().toBuffer({ resolveWithObject: true });
  const { width: sourceWordWidth } = await sharp(word).metadata();
  const wordImage = await sharp(word).resize({ width: Math.round(sourceWordWidth * scale * 1.15) }).png().toBuffer({ resolveWithObject: true });
  const gap = Math.round(width * 0.035);
  const top = (image) => Math.round((bulbImage.info.height - image.info.height) / 2);
  return sharp({ create: { width: wordImage.info.width + gap + bulbImage.info.width, height: bulbImage.info.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: wordImage.data, left: 0, top: top(wordImage) },
      { input: bulbImage.data, left: wordImage.info.width + gap, top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

await sharp(await fullLogo(1040)).toFile(out(join(web, "src/assets/logo.png")));

await (await bulbIcon(256, 0.92)).toFile(out(join(web, "src/app/icon.png")));
await (await bulbIcon(320, 1)).toFile(out(join(web, "src/assets/bulb.png"))); // in-page illustration
await (await bulbIcon(180, 0.72, PARCHMENT)).toFile(out(join(web, "src/app/apple-icon.png")));
for (const s of [192, 512]) {
  await (await bulbIcon(s, 0.86)).toFile(out(join(web, `public/icons/icon-${s}.png`)));
  // Android masks icons to a circle/squircle: keep the bulb inside the central 80% safe zone
  await (await bulbIcon(s, 0.6, PARCHMENT)).toFile(out(join(web, `public/icons/maskable-${s}.png`)));
}
await sharp(await fullLogo(520)).toFile(out(join(web, "../extension/public/logo.png")));
for (const s of [16, 32, 48, 128]) await (await bulbIcon(s, 0.96)).toFile(out(join(web, `../extension/public/icon${s}.png`)));
console.log("brand assets written");
