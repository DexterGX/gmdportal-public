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
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {existingImages.map((img) => (
          <div key={img.id} className="relative h-24 w-24 overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
            {/* Uploaded photos of user-drawn or Chief Architect layouts; not decorative UI chrome. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.fileUrl} alt={img.caption || "Layout image"} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onRemoveExisting(img.id)}
              className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {pendingImages.map((img, idx) => (
          <div key={idx} className="relative h-24 w-24 overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.dataUrl} alt={img.fileName} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onRemovePending(idx)}
              className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {totalCount < MAX_IMAGES && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 dark:border-gray-600 dark:text-gray-400"
          >
            <Upload className="h-5 w-5" />
            <span className="text-xs">Upload</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Upload photos or Chief Architect exports. Up to {MAX_IMAGES} images, 10MB each.
      </p>
    </div>
  );
}
