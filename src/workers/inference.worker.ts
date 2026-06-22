/**
 * Web Worker for ONNX Runtime inference.
 * Processes tiles sequentially to avoid memory pressure from concurrent inference.
 */

import * as ort from 'onnxruntime-web';

// Load WASM files from CDN (faster, offloads 27MB from origin)
ort.env.wasm.wasmPaths =
  'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';

let session: ort.InferenceSession | null = null;

// Sequential processing queue
interface QueuedTask {
  buffer: ArrayBuffer;
  shape: number[];
  resolve: (outputBuffer: ArrayBuffer) => void;
  reject: (err: Error) => void;
}
const taskQueue: QueuedTask[] = [];
let processing = false;

export interface WorkerRequest {
  type: 'load' | 'run';
  modelUrl?: string;
  tensor?: ArrayBuffer;
  shape?: number[];
}

export interface WorkerResponse {
  type: 'loaded' | 'result' | 'progress' | 'error';
  message?: string;
  progress?: number;
  outputBuffer?: ArrayBuffer;
  outputShape?: readonly number[];
}

/** Load the ONNX model with progress reporting */
async function loadModel(modelUrl: string): Promise<void> {
  try {
    const response = await fetch(modelUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    const reader = response.body!.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (total > 0) {
        postMessage({
          type: 'progress',
          progress: Math.round((received / total) * 100),
        } satisfies WorkerResponse);
      }
    }

    const buffer = new Uint8Array(received);
    let pos = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, pos);
      pos += chunk.length;
    }

    session = await ort.InferenceSession.create(buffer.buffer, {
      executionProviders: ['webgpu', 'wasm'],
    });

    postMessage({ type: 'loaded' } satisfies WorkerResponse);
  } catch (err) {
    postMessage({
      type: 'error',
      message: `Failed to load model: ${err instanceof Error ? err.message : String(err)}`,
    } satisfies WorkerResponse);
  }
}

/** Process the task queue sequentially */
async function processQueue(): Promise<void> {
  if (processing || taskQueue.length === 0) return;
  processing = true;

  while (taskQueue.length > 0) {
    const task = taskQueue.shift()!;
    try {
      const outputBuffer = await runInference(task.buffer, task.shape);
      task.resolve(outputBuffer);
    } catch (err) {
      task.reject(err instanceof Error ? err : new Error(String(err)));
    }
  }

  processing = false;
}

/** Run inference on a single tile */
async function runInference(
  buffer: ArrayBuffer,
  shape: number[],
): Promise<ArrayBuffer> {
  if (!session) {
    throw new Error('Model not loaded');
  }

  const tensor = new ort.Tensor('float32', new Float32Array(buffer), shape);
  const feeds: Record<string, ort.Tensor> = {};
  feeds[session.inputNames[0]] = tensor;

  const results = await session.run(feeds);
  const output = results[session.outputNames[0]];

  return (output.data as Float32Array).buffer.slice(0) as ArrayBuffer;
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { type } = e.data;

  if (type === 'load' && e.data.modelUrl) {
    loadModel(e.data.modelUrl);
  } else if (type === 'run' && e.data.tensor && e.data.shape) {
    // Enqueue for sequential processing
    new Promise<ArrayBuffer>((resolve, reject) => {
      taskQueue.push({
        buffer: e.data.tensor!,
        shape: e.data.shape!,
        resolve,
        reject,
      });
      processQueue();
    }).then((outputBuffer) => {
      postMessage(
        { type: 'result', outputBuffer } satisfies WorkerResponse,
        { transfer: [outputBuffer] },
      );
    }).catch((err) => {
      postMessage({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      } satisfies WorkerResponse);
    });
  }
};
