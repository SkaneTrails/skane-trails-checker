/**
 * Web-only downscale + JPEG re-encode for overlay images.
 *
 * On web the image is stored as a base64 `data:` URL inside localStorage-backed
 * AsyncStorage (a few MB for the whole app, rewritten on every overlay edit), so
 * a full-size photo has to be shrunk before it is saved.
 */

export interface EncodeStep {
  /** Longest side in pixels after downscaling. */
  maxDim: number;
  /** JPEG quality, 0–1. */
  quality: number;
}

/** Tried in order until the result fits the budget. */
export const ENCODE_STEPS: EncodeStep[] = [
  { maxDim: 2048, quality: 0.8 },
  { maxDim: 2048, quality: 0.6 },
  { maxDim: 1536, quality: 0.6 },
  { maxDim: 1024, quality: 0.5 },
];

/** First encoding that fits `budgetBytes`, or null if even the smallest step is too big. */
export async function encodeWithinBudget(
  encode: (step: EncodeStep) => Promise<Blob>,
  budgetBytes: number,
): Promise<Blob | null> {
  for (const step of ENCODE_STEPS) {
    const out = await encode(step);
    if (out.size <= budgetBytes) return out;
  }
  return null;
}

/** Downscale to `maxDim` and re-encode as JPEG using a canvas. */
export async function encodeJpeg(source: Blob, { maxDim, quality }: EncodeStep): Promise<Blob> {
  // Browsers apply the photo's EXIF rotation when decoding, so portrait shots stay upright.
  const bitmap = await createImageBitmap(source);
  try {
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    // JPEG has no alpha; transparent PNG pixels would otherwise turn black.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('JPEG encoding failed'))),
        'image/jpeg',
        quality,
      );
    });
  } finally {
    bitmap.close();
  }
}
