import type { OutputFormat } from './UpscaleControls';

const EXT: Record<OutputFormat, string> = { png: 'png', jpeg: 'jpg', webp: 'webp' };

interface DownloadButtonProps {
  resultUrl?: string;
  format: OutputFormat;
  /** Compact icon-only variant for inline use */
  compact?: boolean;
  fileName?: string;
}

export default function DownloadButton({ resultUrl, format, compact, fileName }: DownloadButtonProps) {
  if (!resultUrl) return null;

  const downloadName = fileName
    ? `${fileName.replace(/\.[^.]+$/, '')}.${EXT[format]}`
    : `upscaled.${EXT[format]}`;

  if (compact) {
    return (
      <a
        href={resultUrl}
        download={downloadName}
        title="下载"
        className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg bg-green-600/20 hover:bg-green-600/40 text-green-400 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
          />
        </svg>
      </a>
    );
  }

  return (
    <a
      href={resultUrl}
      download={downloadName}
      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-medium transition-all duration-200 shadow-lg shadow-green-600/25 hover:shadow-green-500/30 active:scale-95"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
        />
      </svg>
      下载结果
    </a>
  );
}
