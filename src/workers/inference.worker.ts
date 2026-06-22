/**
 * Web Worker for ONNX Runtime inference.
 * Runs off the main thread so the UI stays responsive.
 */

import * as ort from 'onnxruntime-web';

let session: ort.InferenceSession | null = null;
let scaleFactor = 2; // default 2x

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
  /** Float32Array buffer (transferred back) */
  outputBuffer?: ArrayBuffer;
  outputShape?: readonly number[];
}

/** Load the ONNX model */
async function loadModel(modelUrl: string): Promise<void> {
  try {
    // Use fetch with progress tracking for large model files
    session = await ort.InferenceSession.create(modelUrl, {
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

    // Real-ESRGAN ONNX model: input name is typically "input" or first input name
    const inputName = session.inputNames[0];
    feeds[inputName] = tensor;

    const results = await session.run(feeds);
    const outputName = session.outputNames[0];
    const output = results[outputName];

    // Transfer the output buffer back to the main thread
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

// Message handler
self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { type } = e.data;

  if (type === 'load' && e.data.modelUrl) {
    loadModel(e.data.modelUrl);
  } else if (type === 'run' && e.data.tensor && e.data.shape) {
    runInference(e.data.tensor, e.data.shape);
  }
};
