"use client";

import { useRef } from "react";
import { Upload, X } from "lucide-react";

export interface ExistingImage {
  id: string;
  fileUrl: string;
  caption?: string | null;
}

export interface PendingImage {
  dataUrl: string;
  caption?: string;
  fileName: string;
}

interface Props {
  existingImages: ExistingImage[];
  pendingImages: PendingImage[];
  onRemoveExisting: (id: string) => void;
  onAddPending: (images: PendingImage[]) => void;
  onRemovePending: (index: number) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_IMAGES = 8;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AreaImageUploader({
  existingImages,
  pendingImages,
  onRemoveExisting,
  onAddPending,
  onRemovePending,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const totalCount = existingImages.length + pendingImages.length;
  const hasImages = totalCount > 0;

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, MAX_IMAGES - totalCount);
    const results: PendingImage[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > MAX_FILE_SIZE) continue;
      const dataUrl = await fileToDataUrl(file);
      results.push({ dataUrl, fileName: file.name, caption: file.name });
    }
    if (results.length) onAddPending(results);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      {hasImages ? (
        <div className="space-y-3">
          {existingImages.map((img) => (
            <div
              key={img.id}
              className="relative overflow-hidden rounded-md border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.fileUrl}
                alt={img.caption || "Layout image"}
                className="max-h-[480px] w-full object-contain"
              />
              <button
                type="button"
                onClick={() => onRemoveExisting(img.id)}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                title="Remove image"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {pendingImages.map((img, idx) => (
            <div
              key={idx}
              className="relative overflow-hidden rounded-md border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.dataUrl}
                alt={img.fileName}
                className="max-h-[480px] w-full object-contain"
              />
              <button
                type="button"
                onClick={() => onRemovePending(idx)}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                title="Remove image"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-64 w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 dark:border-gray-600 dark:text-gray-400"
        >
          <Upload className="h-8 w-8" />
          <span className="text-sm font-medium">Upload layout image</span>
          <span className="text-xs">Photo or Chief Architect export</span>
        </button>
      )}

      {hasImages && totalCount < MAX_IMAGES && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 dark:border-gray-600 dark:text-gray-400"
        >
          <Upload className="h-3.5 w-3.5" /> Add another image
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Up to {MAX_IMAGES} images, 10MB each.
      </p>
    </div>
  );
}
