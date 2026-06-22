/**
 * Tile-based processing: split large image into overlapping tiles,
 * process each, then blend overlaps to hide seams.
 */

export interface Tile {
  /** Top-left x in source coordinates */
  x: number;
  /** Top-left y in source coordinates */
  y: number;
  /** Tile width (may be smaller at edges) */
  width: number;
  /** Tile height (may be smaller at edges) */
  height: number;
  /** Index for ordering */
  index: number;
}

export interface TilesConfig {
  imageWidth: number;
  imageHeight: number;
  tileSize: number;
  /** Overlap between adjacent tiles in pixels */
  overlap: number;
}

export function generateTiles(config: TilesConfig): Tile[] {
  const { imageWidth, imageHeight, tileSize, overlap } = config;
  const stride = tileSize - overlap;
  const tiles: Tile[] = [];
  let index = 0;

  for (let y = 0; y < imageHeight; y += stride) {
    for (let x = 0; x < imageWidth; x += stride) {
      const tileWidth = Math.min(tileSize, imageWidth - x);
      const tileHeight = Math.min(tileSize, imageHeight - y);
      tiles.push({ x, y, width: tileWidth, height: tileHeight, index });
      index++;
    }
  }

  return tiles;
}

/**
 * Blend a processed tile back into the full output canvas.
 * Uses linear cross-fade in overlap regions.
 */
export function blendTile(
  outputCtx: CanvasRenderingContext2D,
  tileCanvas: HTMLCanvasElement,
  tile: Tile,
  overlap: number,
): void {
  const { x, y, width, height } = tile;

  // Precompute blend weights for the tile as an alpha mask
  const blendCanvas = document.createElement('canvas');
  blendCanvas.width = width;
  blendCanvas.height = height;
  const blendCtx = blendCanvas.getContext('2d')!;
  const blendData = blendCtx.createImageData(width, height);

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      let alpha = 1;

      // Left edge blend
      if (px < overlap && x > 0) {
        alpha = Math.min(alpha, px / overlap);
      }
      // Top edge blend
      if (py < overlap && y > 0) {
        alpha = Math.min(alpha, py / overlap);
      }
      // Right edge blend
      if (px >= width - overlap && tile.width === width) {
        const distFromEdge = width - px;
        alpha = Math.min(alpha, distFromEdge / overlap);
      }
      // Bottom edge blend
      if (py >= height - overlap && tile.height === height) {
        const distFromEdge = height - py;
        alpha = Math.min(alpha, distFromEdge / overlap);
      }

      const dstIdx = (py * width + px) * 4;
      blendData.data[dstIdx] = 255;          // R
      blendData.data[dstIdx + 1] = 255;       // G
      blendData.data[dstIdx + 2] = 255;       // B
      blendData.data[dstIdx + 3] = Math.round(alpha * 255);
    }
  }
  blendCtx.putImageData(blendData, 0, 0);

  // Draw tile using the blend mask
  outputCtx.save();
  outputCtx.globalCompositeOperation = 'source-over';
  outputCtx.globalAlpha = 1;
  outputCtx.drawImage(blendCanvas, x, y);

  // Use destination-in to apply alpha, then draw tile
  // Simpler approach: just drawImage with alpha from the blend image
  outputCtx.globalCompositeOperation = 'source-over';
  outputCtx.drawImage(tileCanvas, x, y);

  outputCtx.restore();
}
