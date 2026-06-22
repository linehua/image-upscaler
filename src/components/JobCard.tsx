import { useState } from 'react';
import ImageCompare from './ImageCompare';
import DownloadButton from './DownloadButton';
import type { OutputFormat } from './UpscaleControls';
import type { ImageJob } from '../App';

interface JobCardProps {
  job: ImageJob;
  format: OutputFormat;
  onRetry: (jobId: string) => void;
  onRemove: (jobId: string) => void;
}

export default function JobCard({ job, format, onRetry, onRemove }: JobCardProps) {
  const [expanded, setExpanded] = useState(false);

  const statusLabel = getStatusLabel(job);
  const statusColor = getStatusColor(job);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header: thumbnail + info + status */}
      <div className="flex items-center gap-3 p-3">
        {/* Thumbnail */}
        <img
          src={job.originalUrl}
          alt={job.fileName}
          className="w-14 h-14 object-cover rounded-lg shrink-0 bg-gray-800"
        />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-200 truncate">{job.fileName}</p>
          <p className="text-xs text-gray-500">
            {job.originalWidth}×{job.originalHeight}
          </p>
        </div>

        {/* Status badge */}
        <span className={`shrink-0 text-xs px-2 py-1 rounded-full ${statusColor}`}>
          {statusLabel}
        </span>

        {/* Download (always visible when done) */}
        {job.status === 'done' && job.resultUrl && (
          <DownloadButton resultUrl={job.resultUrl} format={format} compact fileName={job.fileName} />
        )}

        {/* Compare toggle */}
        {job.status === 'done' && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 text-xs text-blue-400 hover:text-blue-300 px-2 py-1"
          >
            {expanded ? '收起' : '对比'}
          </button>
        )}
        {job.status === 'error' && (
          <button
            onClick={() => onRetry(job.id)}
            className="shrink-0 text-xs text-yellow-400 hover:text-yellow-300 px-2 py-1"
          >
            重试
          </button>
        )}
        {(job.status === 'done' || job.status === 'error') && (
          <button
            onClick={() => onRemove(job.id)}
            className="shrink-0 text-xs text-gray-500 hover:text-gray-400 px-2 py-1"
          >
            ✕
          </button>
        )}
      </div>

      {/* Progress bar */}
      {job.status === 'inferring' && job.current != null && job.total != null && (
        <div className="px-3 pb-3">
          <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${(job.current / job.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {job.status === 'error' && job.error && (
        <p className="px-3 pb-3 text-xs text-red-400">{job.error}</p>
      )}

      {/* Expanded comparison view */}
      {expanded && job.status === 'done' && job.resultUrl && (
        <div className="px-3 pb-4 border-t border-gray-800 pt-3">
          <ImageCompare
            originalUrl={job.originalUrl}
            resultUrl={job.resultUrl}
            originalWidth={job.originalWidth}
            originalHeight={job.originalHeight}
          />
          <div className="flex justify-center mt-3">
            <DownloadButton resultUrl={job.resultUrl} format={format} />
          </div>
        </div>
      )}
    </div>
  );
}

function getStatusLabel(job: ImageJob): string {
  switch (job.status) {
    case 'pending': return '等待中';
    case 'loading-model': {
      if (job.current != null && job.total != null) {
        return `下载模型 ${job.current}%`;
      }
      return '加载模型';
    }
    case 'preprocessing': return '预处理';
    case 'inferring': {
      const pass = job.pass ? `第${job.pass}轮 ` : '';
      return `${pass}${job.current ?? 0}/${job.total ?? 0}`;
    }
    case 'postprocessing': return '生成中';
    case 'done': return '✓ 完成';
    case 'error': return '失败';
  }
}

function getStatusColor(job: ImageJob): string {
  switch (job.status) {
    case 'pending': return 'bg-gray-700 text-gray-400';
    case 'loading-model':
    case 'preprocessing':
    case 'postprocessing':
      return 'bg-blue-900/50 text-blue-400';
    case 'inferring': return 'bg-blue-900/50 text-blue-400';
    case 'done': return 'bg-green-900/50 text-green-400';
    case 'error': return 'bg-red-900/50 text-red-400';
  }
}
