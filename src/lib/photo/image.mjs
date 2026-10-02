import sharp from 'sharp';
import convert from 'heic-convert';
import { fileURLToPath } from 'node:url';
import { FRAMES, transformPixels } from './film.mjs';

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
export function validateCrop(crop, orientation, width, height) {
  if (!['portrait', 'landscape'].includes(orientation) || !crop ||
      !['x', 'y', 'width', 'height'].every(k => typeof crop[k] === 'number' && Number.isFinite(crop[k]))) {
    throw new Error('INVALID_CROP');
  }
  const { x, y, width: w, height: h } = crop;
  if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > 1.000001 || y + h > 1.000001) throw new Error('INVALID_CROP');
  const ratio = orientation === 'portrait' ? 100 / 148 : 148 / 100;
  if (Math.abs((w * width) / (h * height) / ratio - 1) > 0.02) throw new Error('INVALID_CROP');
  const left = Math.floor(x * width), top = Math.floor(y * height);
  const extractWidth = Math.min(Math.round(w * width), width - left);
  const extractHeight = Math.min(Math.round(h * height), height - top);
  if (extractWidth < 100 || extractHeight < 100) throw new Error('INVALID_CROP');
  return { left, top, width: extractWidth, height: extractHeight };
}
export async function normalizePhoto(bytes) {
  if (!bytes.length || bytes.length > MAX_UPLOAD_BYTES) throw new Error('INVALID_IMAGE_SIZE');
  let input = bytes;
  // Inspect actual ISO-BMFF brand, not supplied MIME/extension. libvips binary builds
  // often decode AVIF but do not include the HEVC decoder required by iPhone HEIC.
  if (bytes.subarray(4, 8).toString() === 'ftyp' && /hei[cf]|heix|hevc|mif1/.test(bytes.subarray(8, 64).toString())) {
    try { input = Buffer.from(await convert({ buffer: bytes, format: 'JPEG', quality: 0.95 })); }
    catch { throw new Error('HEIC_UNSUPPORTED'); }
  }
  try {
    const metadata = await sharp(input, { limitInputPixels: 64000000, animated: false }).metadata();
    if (!['jpeg','png','webp','heif','tiff'].includes(metadata.format) || (metadata.pages || 1) > 1) throw new Error('INVALID_IMAGE');
    const { data, info } = await sharp(input, { limitInputPixels: 64000000 })
      .rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' }).toColourspace('srgb').jpeg({ quality: 94 }).toBuffer({ resolveWithObject: true });
    return { bytes: data, width: info.width, height: info.height };
  } catch { throw new Error('INVALID_IMAGE'); }
}
export async function renderPrintPhoto(bytes, crop, orientation, width, height, snapshot = null) {
  const region = validateCrop(crop, orientation, width, height);
  const output = orientation === 'portrait' ? [1181, 1748] : [1748, 1181];
  if (snapshot) {
    const f = FRAMES[orientation];
    const { data, info } = await sharp(bytes).extract(region).resize(f.photoWidth,f.photoHeight,{fit:'fill'})
      .toColourspace('srgb').ensureAlpha().raw().toBuffer({resolveWithObject:true});
    transformPixels(data,info.width,info.height,snapshot.computed,snapshot.seed);
    const photo = await sharp(data,{raw:info}).png().toBuffer();
    const frame = fileURLToPath(new URL(`./assets/photobooth-frame-${orientation}.png`,import.meta.url));
    return sharp({create:{width:f.width,height:f.height,channels:4,background:'#fdfaf5'}})
      .composite([{input:photo,left:f.left,top:f.top},{input:frame,left:0,top:0}])
      .toColourspace('srgb').withMetadata({density:300}).jpeg({quality:96}).toBuffer();
  }
  return sharp(bytes).extract(region).resize(output[0], output[1], { fit: 'fill' })
    .withMetadata({ density: 300 }).jpeg({ quality: 96 }).toBuffer();
}
