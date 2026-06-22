import { useState, useCallback, useRef } from 'react';
import UploadZone from './components/UploadZone';
import UpscaleControls, { type OutputFormat } from './components/UpscaleControls';
import JobCard from './components/JobCard';
import { useUpscaler, type UpscaleProgress } from './hooks/useUpscaler';

const MODEL_URL = '/models/real_esrgan_x2.onnx';

export interface ImageJob {
  id: string;
  fileName: string;
  originalUrl: string;
  originalWidth: number;
  originalHeight: number;
  /** The HTMLImageElement used for preprocessing */
  img: HTMLImageElement;
  status: 'pending' | 'loading-model' | 'preprocessing' | 'inferring' | 'postprocessing' | 'done' | 'error';
  resultUrl?: string;
  error?: string;
  pass?: number;
  current?: number;
  total?: number;
}

let nextId = 1;
function genId(): string {
  return `job-${nextId++}`;
}

export default function App() {
  const [jobs, setJobs] = useState<ImageJob[]>([]);
  const [scaleFactor, setScaleFactor] = useState(2);
  const [format, setFormat] = useState<OutputFormat>('png');
  const [processing, setProcessing] = useState(false);
  const { upscale } = useUpscaler();
  const abortRef = useRef(false);

  /** Add new images to the queue */
  const handleImages = useCallback(
    (images: { file: File; img: HTMLImageElement }[]) => {
      setJobs((prev) => [
        ...prev,
        ...images.map(({ file, img }) => ({
          id: genId(),
          fileName: file.name,
          originalUrl: img.src,
          originalWidth: img.naturalWidth,
          originalHeight: img.naturalHeight,
          img,
          status: 'pending' as const,
        })),
      ]);
    },
    [],
  );

  /** Process all pending jobs sequentially */
  const handleStart = useCallback(async () => {
    setProcessing(true);
    abortRef.current = false;

    // Find first pending or error job
    const startIdx = jobs.findIndex(
      (j) => j.status === 'pending' || j.status === 'error',
    );
    if (startIdx === -1) {
      setProcessing(false);
      return;
    }

    for (let i = startIdx; i < jobs.length; i++) {
      if (abortRef.current) break;

      const job = jobs[i];
      if (job.status === 'done') continue;

      // Mark as starting
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, status: 'loading-model', error: undefined } : j)),
      );

      try {
        const resultUrl = await upscale(
          job.img,
          MODEL_URL,
          scaleFactor,
          format,
          (progress: UpscaleProgress) => {
            if (abortRef.current) return;
            setJobs((prev) =>
              prev.map((j) =>
                j.id === job.id
                  ? {
                      ...j,
                      status: progress.phase,
                      pass: progress.pass,
                      current: progress.current,
                      total: progress.total,
                    }
                  : j,
              ),
            );
          },
        );

        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id ? { ...j, status: 'done', resultUrl } : j,
          ),
        );
      } catch (err) {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? {
                  ...j,
                  status: 'error',
                  error: err instanceof Error ? err.message : String(err),
                }
              : j,
          ),
        );
      }
    }

    setProcessing(false);
  }, [jobs, scaleFactor, format, upscale]);

  /** Retry a single failed job */
  const handleRetry = useCallback(
    async (jobId: string) => {
      const job = jobs.find((j) => j.id === jobId);
      if (!job) return;

      setProcessing(true);
      abortRef.current = false;

      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: 'loading-model', error: undefined } : j)),
      );

      try {
        const resultUrl = await upscale(
          job.img,
          MODEL_URL,
          scaleFactor,
          format,
          (progress: UpscaleProgress) => {
            setJobs((prev) =>
              prev.map((j) =>
                j.id === jobId
                  ? {
                      ...j,
                      status: progress.phase,
                      pass: progress.pass,
                      current: progress.current,
                      total: progress.total,
                    }
                  : j,
              ),
            );
          },
        );

        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId ? { ...j, status: 'done', resultUrl } : j,
          ),
        );
      } catch (err) {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  status: 'error',
                  error: err instanceof Error ? err.message : String(err),
                }
              : j,
          ),
        );
      }

      setProcessing(false);
    },
    [jobs, scaleFactor, format, upscale],
  );

  /** Remove a job from the queue */
  const handleRemove = useCallback((jobId: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
  }, []);

  /** Clear all jobs */
  const handleClearAll = useCallback(() => {
    abortRef.current = true;
    setJobs((prev) => {
      prev.forEach((j) => {
        if (j.resultUrl) URL.revokeObjectURL(j.resultUrl);
        if (j.originalUrl.startsWith('blob:')) URL.revokeObjectURL(j.originalUrl);
      });
      return [];
    });
    setProcessing(false);
  }, []);

  /** Batch download all completed results */
  const handleBatchDownload = useCallback(() => {
    const doneJobs = jobs.filter((j) => j.status === 'done' && j.resultUrl);
    if (doneJobs.length === 0) return;

    const EXT: Record<OutputFormat, string> = { png: 'png', jpeg: 'jpg', webp: 'webp' };
    doneJobs.forEach((job, i) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = job.resultUrl!;
        a.download = `${job.fileName.replace(/\.[^.]+$/, '')}.${EXT[format]}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, i * 300);
    });
  }, [jobs, format]);

  const pendingCount = jobs.filter((j) => j.status === 'pending' || j.status === 'error').length;
  const doneCount = jobs.filter((j) => j.status === 'done').length;
  const hasJobs = jobs.length > 0;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="py-6 text-center border-b border-gray-800">
        <h1 className="text-2xl font-bold tracking-tight">
          IMAGE<span className="text-blue-400">放大</span>
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          AI 图片无损放大 — 基于 Real-ESRGAN，浏览器端本地推理
        </p>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center gap-6 px-4 py-8 max-w-4xl mx-auto w-full">
        {/* Upload zone (always visible at top, hidden when processing) */}
        {!processing && (
          <UploadZone onImages={handleImages} disabled={processing} />
        )}

        {/* Controls */}
        {hasJobs && (
          <div className="flex flex-col items-center gap-2">
            <UpscaleControls
              scaleFactor={scaleFactor}
              onScaleChange={setScaleFactor}
              format={format}
              onFormatChange={setFormat}
              onStart={handleStart}
              pendingCount={pendingCount}
              canStart={pendingCount > 0}
              isProcessing={processing}
            />
            {!processing && jobs.length > 0 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleClearAll}
                  className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                >
                  清空全部
                </button>
                {doneCount > 0 && (
                  <button
                    onClick={handleBatchDownload}
                    className="text-xs text-green-500 hover:text-green-400 transition-colors"
                  >
                    下载全部结果 ({doneCount})
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Job list */}
        {hasJobs && (
          <div className="w-full flex flex-col gap-2">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                format={format}
                onRetry={handleRetry}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}

        {/* Empty state hint */}
        {!hasJobs && (
          <p className="text-gray-600 text-sm mt-4">
            所有处理均在本地浏览器完成，图片不会上传到任何服务器
          </p>
        )}
      </main>
    </div>
  );
}
