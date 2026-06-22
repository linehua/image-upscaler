export type OutputFormat = 'png' | 'jpeg' | 'webp';

interface UpscaleControlsProps {
  scaleFactor: number;
  onScaleChange: (scale: number) => void;
  format: OutputFormat;
  onFormatChange: (format: OutputFormat) => void;
  onStart: () => void;
  pendingCount: number;
  canStart: boolean;
  isProcessing: boolean;
}

const FORMATS: { value: OutputFormat; label: string }[] = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WebP' },
];

export default function UpscaleControls({
  scaleFactor,
  onScaleChange,
  format,
  onFormatChange,
  onStart,
  pendingCount,
  canStart,
  isProcessing,
}: UpscaleControlsProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Scale factor selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">放大倍率:</span>
        <div className="flex rounded-lg overflow-hidden border border-gray-600">
          {[2, 4].map((scale) => (
            <button
              key={scale}
              onClick={() => onScaleChange(scale)}
              disabled={isProcessing}
              className={`
                px-4 py-2 text-sm font-medium transition-colors
                ${scaleFactor === scale
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }
                ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {scale}×
            </button>
          ))}
        </div>
      </div>

      {/* Output format selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">输出格式:</span>
        <div className="flex rounded-lg overflow-hidden border border-gray-600">
          {FORMATS.map((f) => (
            <button
              key={f.value}
              onClick={() => onFormatChange(f.value)}
              disabled={isProcessing}
              className={`
                px-3 py-2 text-sm font-medium transition-colors
                ${format === f.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }
                ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Start button */}
      <button
        onClick={onStart}
        disabled={!canStart || isProcessing}
        className={`
          px-8 py-3 rounded-xl font-medium text-base transition-all duration-200
          ${canStart && !isProcessing
            ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 hover:shadow-blue-500/30 active:scale-95'
            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }
        `}
      >
        {isProcessing
          ? '处理中...'
          : `开始放大${pendingCount > 1 ? ` (${pendingCount} 张)` : ''}`}
      </button>
    </div>
  );
}
