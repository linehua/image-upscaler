import { useRef, useCallback } from 'react';
import { preprocessImage, type PreprocessResult } from '../lib/preprocessing';
import { tensorToImageData } from '../lib/postprocessing';
import { generateTiles, type Tile } from '../lib/tiling';

const MODEL_SCALE = 2;
const TILE_SIZE = 256;
const OVERLAP = 32;

export interface UpscaleProgress {
  phase: 'loading-model' | 'preprocessing' | 'inferring' | 'postprocessing' | 'done';
  pass?: number;
  current?: number;
  total?: number;
  message?: string;
}

export function useUpscaler() {
  const workerRef = useRef<Worker | null>(null);
  const pendingResolveRef = useRef<((buffer: ArrayBuffer) => void) | null>(null);

  /** Initialize the worker and load the model (once) */
  const initWorker = useCallback((modelUrl: string): Promise<Worker> => {
    return new Promise((resolve, reject) => {
      if (workerRef.current) {
        resolve(workerRef.current);
        return;
      }

      const worker = new Worker(
        new URL('../workers/inference.worker.ts', import.meta.url),
        { type: 'module' },
      );

      worker.onmessage = (e) => {
        const data = e.data as {
          type: 'loaded' | 'result' | 'error';
          outputBuffer?: ArrayBuffer;
          outputShape?: number[];
          message?: string;
        };

        if (data.type === 'loaded') {
          workerRef.current = worker;
          resolve(worker);
        } else if (data.type === 'result' && data.outputBuffer) {
          pendingResolveRef.current?.(data.outputBuffer);
          pendingResolveRef.current = null;
        } else if (data.type === 'error') {
          reject(new Error(data.message));
        }
      };

      worker.onerror = (err) => {
        reject(new Error(`Worker error: ${err.message}`));
      };

      worker.postMessage({ type: 'load', modelUrl });
    });
  }, []);

  /** Run a single tile through the model */
  const runTile = useCallback(
    (tensor: Float32Array, shape: number[]): Promise<ArrayBuffer> => {
      return new Promise((resolve, reject) => {
        pendingResolveRef.current = resolve;
        const buffer = tensor.buffer.slice(0) as ArrayBuffer;
        workerRef.current!.postMessage(
          { type: 'run', tensor: buffer, shape },
          { transfer: [buffer] },
        );
        setTimeout(() => {
          if (pendingResolveRef.current) {
            pendingResolveRef.current = null;
            reject(new Error('Tile inference timed out'));
          }
        }, 120000);
      });
    },
    [],
  );

  /** Run one 2x upscale pass, returns the output canvas */
  const processPass = useCallback(
    async (
      image: HTMLImageElement,
      passNum: number,
      onProgress: (p: UpscaleProgress) => void,
    ): Promise<HTMLCanvasElement> => {
      const preprocessed = preprocessImage(image, TILE_SIZE);
      const tiles = generateTiles({
        imageWidth: preprocessed.paddedWidth,
        imageHeight: preprocessed.paddedHeight,
        tileSize: TILE_SIZE,
        overlap: OVERLAP,
      });

      onProgress({ phase: 'inferring', pass: passNum, current: 0, total: tiles.length });

      const targetWidth = preprocessed.originalWidth * MODEL_SCALE;
      const targetHeight = preprocessed.originalHeight * MODEL_SCALE;

      const outCanvas = document.createElement('canvas');
      outCanvas.width = targetWidth;
      outCanvas.height = targetHeight;
      const outCtx = outCanvas.getContext('2d')!;

      for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i];
        onProgress({ phase: 'inferring', pass: passNum, current: i + 1, total: tiles.length });

        const tileTensor = extractTileTensor(preprocessed, tile);
        const tileShape = [1, 3, tile.height, tile.width];
        const outputBuffer = await runTile(tileTensor, tileShape);

        const outTileW = tile.width * MODEL_SCALE;
        const outTileH = tile.height * MODEL_SCALE;
        const outData = new Float32Array(outputBuffer);
        const imageData = tensorToImageData({
          tensor: outData,
          width: outTileW,
          height: outTileH,
          targetWidth: outTileW,
          targetHeight: outTileH,
        });

        const tileCanvas = document.createElement('canvas');
        tileCanvas.width = outTileW;
        tileCanvas.height = outTileH;
        tileCanvas.getContext('2d')!.putImageData(imageData, 0, 0);

        const dstX = tile.x * MODEL_SCALE;
        const dstY = tile.y * MODEL_SCALE;
        outCtx.drawImage(
          tileCanvas,
          0, 0,
          Math.min(outTileW, targetWidth - dstX),
          Math.min(outTileH, targetHeight - dstY),
          dstX, dstY,
          Math.min(outTileW, targetWidth - dstX),
          Math.min(outTileH, targetHeight - dstY),
        );
      }

      return outCanvas;
    },
    [runTile],
  );

  /** Convert canvas to Image for next pass */
  const canvasToImage = useCallback(
    (canvas: HTMLCanvasElement): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to convert canvas to image'));
        canvas.toBlob((blob) => {
          if (blob) img.src = URL.createObjectURL(blob);
          else reject(new Error('Failed to create blob'));
        }, 'image/png');
      });
    },
    [],
  );

  /**
   * Upscale one image. Reports progress via onProgress callback.
   * Returns the result URL on success.
   */
  const upscale = useCallback(
    async (
      image: HTMLImageElement,
      modelUrl: string,
      scaleFactor: number,
      format: 'png' | 'jpeg' | 'webp',
      onProgress: (p: UpscaleProgress) => void,
    ): Promise<string> => {
      onProgress({ phase: 'loading-model' });
      await initWorker(modelUrl);

      const passes = scaleFactor === 4 ? 2 : 1;

      onProgress({ phase: 'preprocessing', pass: 1 });
      let resultCanvas = await processPass(image, 1, onProgress);

      if (passes === 2) {
        onProgress({ phase: 'preprocessing', pass: 2 });
        const intermediateImage = await canvasToImage(resultCanvas);
        resultCanvas = await processPass(intermediateImage, 2, onProgress);
      }

      onProgress({ phase: 'postprocessing' });
      const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
      const blob = await new Promise<Blob>((resolve, reject) => {
        resultCanvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Failed to create blob'));
        }, mimeType, format === 'jpeg' ? 0.92 : undefined);
      });
      const resultUrl = URL.createObjectURL(blob);

      onProgress({ phase: 'done' });
      return resultUrl;
    },
    [initWorker, processPass, canvasToImage],
  );

  return { upscale };
}

function extractTileTensor(
  preprocessed: PreprocessResult,
  tile: Tile,
): Float32Array {
  const { tensor, paddedWidth, paddedHeight } = preprocessed;
  const { x, y, width, height } = tile;
  const planeSize = paddedHeight * paddedWidth;
  const channels = 3;

  const out = new Float32Array(channels * height * width);
  const outPlaneSize = height * width;

  for (let c = 0; c < channels; c++) {
    const srcOffset = c * planeSize;
    const dstOffset = c * outPlaneSize;
    for (let ty = 0; ty < height; ty++) {
      const srcStart = srcOffset + (y + ty) * paddedWidth + x;
      const dstStart = dstOffset + ty * width;
      out.set(tensor.subarray(srcStart, srcStart + width), dstStart);
    }
  }

  return out;
}
