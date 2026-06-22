import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface UploadZoneProps {
  onImages: (images: { file: File; img: HTMLImageElement }[]) => void;
  disabled?: boolean;
}

export default function UploadZone({ onImages, disabled }: UploadZoneProps) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length === 0) return;

      const results: { file: File; img: HTMLImageElement }[] = [];
      let loaded = 0;

      accepted.forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            results.push({ file, img });
            loaded++;
            if (loaded === accepted.length) {
              onImages(results);
            }
          };
          img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
      });
    },
    [onImages],
  );

  const accept = {
    'image/png': ['.png'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/webp': ['.webp'],
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    disabled,
  });

  return (
    <div
      {...getRootProps()}
      className={`
        relative w-full max-w-2xl mx-auto border-2 border-dashed rounded-2xl
        p-12 text-center cursor-pointer transition-all duration-200
        ${isDragActive
          ? 'border-blue-400 bg-blue-400/10 scale-[1.02]'
          : 'border-gray-600 bg-gray-900 hover:border-gray-400 hover:bg-gray-800'
        }
        ${disabled ? 'opacity-50 pointer-events-none' : ''}
      `}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-12 h-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
        <p className="text-lg text-gray-300">
          {isDragActive ? '放开以上传图片' : '拖拽图片到此处，或点击选择'}
        </p>
        <p className="text-sm text-gray-500">
          支持 PNG / JPEG / WebP · 可一次选择多张
        </p>
      </div>
    </div>
  );
}
