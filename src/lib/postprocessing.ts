/**
 * Convert a model output tensor (CHW, normalized [0,1]) back to ImageData,
 * cropping away any padding.
 */

export interface PostprocessInput {
  tensor: Float32Array;
  /** Output width (after upscale) */
  width: number;
  /** Output height (after upscale) */
  height: number;
  /** Original image dimensions × scale factor = target output */
  targetWidth: number;
  targetHeight: number;
}

export function tensorToImageData(input: PostprocessInput): ImageData {
  const { tensor, width, height, targetWidth, targetHeight } = input;

  // Clamp and scale to [0, 255]
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(targetWidth, targetHeight);
  const pixels = imageData.data;
  const planeSize = height * width;

  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const srcIdxR = y * width + x;
      const srcIdxG = planeSize + srcIdxR;
      const srcIdxB = 2 * planeSize + srcIdxR;
      const dstIdx = (y * targetWidth + x) * 4;

      pixels[dstIdx] = clampToU8(tensor[srcIdxR] * 255);
      pixels[dstIdx + 1] = clampToU8(tensor[srcIdxG] * 255);
      pixels[dstIdx + 2] = clampToU8(tensor[srcIdxB] * 255);
      pixels[dstIdx + 3] = 255; // alpha
    }
  }

  return imageData;
}

function clampToU8(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}
