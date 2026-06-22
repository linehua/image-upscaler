/**
 * Convert an HTMLImageElement to a normalized Float32Array tensor (CHW layout).
 * Pads the image so dimensions are multiples of `tileSize`.
 */

export interface PreprocessResult {
  tensor: Float32Array;
  /** Shape: [1, 3, H, W] */
  shape: [number, number, number, number];
  /** Original image dimensions before padding */
  originalWidth: number;
  originalHeight: number;
  /** Padded dimensions */
  paddedWidth: number;
  paddedHeight: number;
  /** How many pixels of padding were added to the right / bottom */
  padRight: number;
  padBottom: number;
}

const TILE_SIZE = 256;

function roundUpToMultiple(n: number, multiple: number): number {
  return Math.ceil(n / multiple) * multiple;
}

export function preprocessImage(
  img: HTMLImageElement,
  tileSize: number = TILE_SIZE,
): PreprocessResult {
  const originalWidth = img.naturalWidth;
  const originalHeight = img.naturalHeight;

  const paddedWidth = roundUpToMultiple(originalWidth, tileSize);
  const paddedHeight = roundUpToMultiple(originalHeight, tileSize);
  const padRight = paddedWidth - originalWidth;
  const padBottom = paddedHeight - originalHeight;

  // Draw padded image onto canvas
  const canvas = document.createElement('canvas');
  canvas.width = paddedWidth;
  canvas.height = paddedHeight;
  const ctx = canvas.getContext('2d')!;
  // Reflect-pad: mirror the edge pixels (better than zero-pad for AI models)
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);
  // Reflect right edge
  if (padRight > 0) {
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(img, -(originalWidth - 1), 0, 1, originalHeight, 0, 0, padRight, paddedHeight);
    ctx.restore();
  }
  // Reflect bottom edge (including right-bottom corner)
  if (padBottom > 0) {
    ctx.save();
    ctx.scale(1, -1);
    ctx.drawImage(canvas, 0, -(originalHeight - 1), paddedWidth, 1, 0, 0, paddedWidth, padBottom);
    ctx.restore();
  }

  const imageData = ctx.getImageData(0, 0, paddedWidth, paddedHeight);
  const pixels = imageData.data; // Uint8ClampedArray [R,G,B,A,...]

  // Convert to Float32Array CHW, normalize to [0, 1], skip alpha
  const channels = 3;
  const tensor = new Float32Array(channels * paddedHeight * paddedWidth);
  const planeSize = paddedHeight * paddedWidth;

  for (let y = 0; y < paddedHeight; y++) {
    for (let x = 0; x < paddedWidth; x++) {
      const srcIdx = (y * paddedWidth + x) * 4;
      const dstIdxR = 0 * planeSize + y * paddedWidth + x;
      const dstIdxG = 1 * planeSize + y * paddedWidth + x;
      const dstIdxB = 2 * planeSize + y * paddedWidth + x;
      tensor[dstIdxR] = pixels[srcIdx] / 255;
      tensor[dstIdxG] = pixels[srcIdx + 1] / 255;
      tensor[dstIdxB] = pixels[srcIdx + 2] / 255;
    }
  }

  return {
    tensor,
    shape: [1, channels, paddedHeight, paddedWidth],
    originalWidth,
    originalHeight,
    paddedWidth,
    paddedHeight,
    padRight,
    padBottom,
  };
}
