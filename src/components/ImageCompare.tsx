import { useState, useRef, useEffect, useCallback } from 'react';

interface ImageCompareProps {
  originalUrl: string;
  resultUrl?: string;
  originalWidth: number;
  originalHeight: number;
}

export default function ImageCompare({
  originalUrl,
  resultUrl,
  originalWidth,
  originalHeight,
}: ImageCompareProps) {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const handleMove = useCallback(
    (clientX: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      setSliderPos(Math.max(0, Math.min(100, (x / rect.width) * 100)));
    },
    [],
  );

  const onMouseDown = useCallback(() => {
    draggingRef.current = true;
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      handleMove(e.clientX);
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [handleMove]);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      handleMove(e.touches[0].clientX);
    },
    [handleMove],
  );

  // Scale image to fit container while maintaining aspect ratio
  const maxWidth = 800;
  const displayWidth = Math.min(originalWidth, maxWidth);
  const displayHeight = (originalHeight / originalWidth) * displayWidth;

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-lg select-none"
        style={{ width: displayWidth, height: displayHeight }}
        onMouseDown={onMouseDown}
        onTouchMove={onTouchMove}
      >
        {/* Result image (bottom layer) */}
        {resultUrl && (
          <img
            src={resultUrl}
            alt="放大后"
            className="absolute inset-0 w-full h-full object-contain"
            draggable={false}
          />
        )}

        {/* Original image (top layer, clipped by slider) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${sliderPos}%` }}
        >
          <img
            src={originalUrl}
            alt="原图"
            className="absolute inset-0 w-full h-full object-contain"
            style={{ width: displayWidth, height: displayHeight }}
            draggable={false}
          />
        </div>

        {/* Slider line + handle */}
        <div
          className="absolute inset-y-0 w-0.5 bg-white shadow-lg cursor-ew-resize"
          style={{ left: `${sliderPos}%` }}
        >
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-800" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M3 7a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 13a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        {/* Labels */}
        <div className="absolute top-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded">
          原图
        </div>
        {resultUrl && (
          <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded">
            放大后
          </div>
        )}
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={sliderPos}
        onChange={(e) => setSliderPos(Number(e.target.value))}
        className="w-64 accent-blue-500"
      />
    </div>
  );
}
