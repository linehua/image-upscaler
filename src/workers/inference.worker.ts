/**
 * Web Worker for ONNX Runtime inference.
 * Runs off the main thread so the UI stays responsive.
 */

import * as ort from 'onnxruntime-web';

// Load WASM files from CDN (faster, offloads 27MB from origin)
ort.env.wasm.wasmPaths =
  'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';

let session: ort.InferenceSession | null = null;

export interface WorkerRequest {
  type: 'load' | 'run';
  modelUrl?: string;
  /** Float32Array buffer (transferred) */
  tensor?: ArrayBuffer;
  shape?: number[];
}

export interface WorkerResponse {
  type: 'loaded' | 'result' | 'progress' | 'error';
  message?: string;
  /** Model download progress (0-100) */
  progress?: number;
  /** Float32Array buffer (transferred back) */
  outputBuffer?: ArrayBuffer;
  outputShape?: readonly number[];
}

/** Load the ONNX model with progress reporting */
async function loadModel(modelUrl: string): Promise<void> {
  try {
    // Fetch model with progress tracking
    const response = await fetch(modelUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
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
        const pct = Math.round((received / total) * 100);
        postMessage({
          type: 'progress',
          progress: pct,
          message: `正在下载模型... ${pct}%`,
        } satisfies WorkerResponse);
      }
    }

    // Combine chunks into a single ArrayBuffer
    const buffer = new Uint8Array(received);
    let pos = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, pos);
      pos += chunk.length;
    }

    // Create session from buffer (avoids second network request)
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

/** Run inference on input tensor */
async function runInference(
  buffer: ArrayBuffer,
  shape: number[],
): Promise<void> {
  if (!session) {
    postMessage({
      type: 'error',
      message: 'Model not loaded. Call load first.',
    } satisfies WorkerResponse);
    return;
  }

  try {
    const tensor = new ort.Tensor('float32', new Float32Array(buffer), shape);
    const feeds: Record<string, ort.Tensor> = {};

    const inputName = session.inputNames[0];
    feeds[inputName] = tensor;

    const results = await session.run(feeds);
    const outputName = session.outputNames[0];
    const output = results[outputName];

    const outputBuffer = (output.data as Float32Array).buffer.slice(0) as ArrayBuffer;
    postMessage(
      {
        type: 'result',
        outputBuffer,
        outputShape: output.dims,
      } satisfies WorkerResponse,
      { transfer: [outputBuffer] },
    );
  } catch (err) {
    postMessage({
      type: 'error',
      message: `Inference failed: ${err instanceof Error ? err.message : String(err)}`,
    } satisfies WorkerResponse);
  }
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { type } = e.data;

  if (type === 'load' && e.data.modelUrl) {
    loadModel(e.data.modelUrl);
  } else if (type === 'run' && e.data.tensor && e.data.shape) {
    runInference(e.data.tensor, e.data.shape);
  }
};
