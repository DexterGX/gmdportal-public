"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, Upload, Image as ImageIcon } from "lucide-react";

const MAX_IMAGES = 30;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/jpg",
  "image/webp",
  "image/gif",
];

interface Job {
  id: string;
  quoteNumber: string;
  customerName: string;
  propertyAddress: string;
  area: string;
  installerId: string;
}

interface Installer {
  id: string;
  name: string | null;
  email: string | null;
}

interface FilePreview {
  file: File;
  preview: string;
  caption: string;
}

export default function NewQuoteForm({
  job,
  userRole,
  installers,
}: {
  job: Job;
  userRole: string;
  installers: Installer[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    color: "",
    installerCost: "",
    notesInstaller: "",
    installerId: job.installerId, // Default to job's assigned installer
  });
  const [selectedFiles, setSelectedFiles] = useState<FilePreview[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = userRole === "admin";

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    const invalidTypeFiles = files.filter(
      (file) => !ALLOWED_IMAGE_TYPES.includes(file.type),
    );
    if (invalidTypeFiles.length > 0) {
      alert(
        "Some files were skipped because they are not supported. Allowed formats: JPG, JPEG, PNG, WebP, GIF.",
      );
    }

    const oversizedFiles = files.filter((file) => file.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      alert("Some files were skipped because they are larger than 10MB.");
    }

    const validFiles = files.filter(
      (file) =>
        ALLOWED_IMAGE_TYPES.includes(file.type) && file.size <= MAX_FILE_SIZE,
    );

    const availableSlots = MAX_IMAGES - selectedFiles.length;
    if (availableSlots <= 0) {
      alert(`You can upload a maximum of ${MAX_IMAGES} images per quote.`);
      e.target.value = "";
      return;
    }

    const filesToAdd = validFiles.slice(0, availableSlots);
    if (validFiles.length > filesToAdd.length) {
      alert(
        `Only ${MAX_IMAGES} images are allowed. Extra images were not added.`,
      );
    }

    const newPreviews: FilePreview[] = filesToAdd.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      caption: file.name,
    }));
    setSelectedFiles([...selectedFiles, ...newPreviews]);

    // Allow selecting the same file again later if user removes it.
    e.target.value = "";
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    // Revoke object URL to prevent memory leaks
    URL.revokeObjectURL(selectedFiles[index].preview);
    setSelectedFiles(newFiles);
  };

  const handleCaptionChange = (index: number, caption: string) => {
    const newFiles = [...selectedFiles];
    newFiles[index].caption = caption;
    setSelectedFiles(newFiles);
  };

  const parseErrorMessage = async (
    response: Response,
    fallback: string,
  ): Promise<string> => {
    const raw = await response.text();

    if (!raw) return fallback;

    try {
      const parsed = JSON.parse(raw) as { error?: string; message?: string };
      return parsed.error || parsed.message || fallback;
    } catch {
      // Handles non-JSON responses (e.g., 413/proxy HTML) gracefully.
      return raw.length > 180 ? `${raw.slice(0, 180)}...` : raw;
    }
  };

  // Compress an image to max 1920px wide at 85% JPEG quality before uploading.
  // Keeps each file well under Vercel's ~4.5 MB body limit.
  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      // GIFs can't be re-encoded through canvas; pass through unchanged.
      if (file.type === "image/gif") {
        resolve(file);
        return;
      }

      const img = new window.Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        const MAX_WIDTH = 1920;
        let { width, height } = img;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(objectUrl);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            // Use .jpg extension regardless of original name for clarity.
            const baseName = file.name.replace(/\.[^.]+$/, "");
            resolve(
              new File([blob], `${baseName}.jpg`, { type: "image/jpeg" }),
            );
          },
          "image/jpeg",
          0.85,
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file); // fall back to original on error
      };

      img.src = objectUrl;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    if (selectedFiles.length > MAX_IMAGES) {
      alert(`You can upload a maximum of ${MAX_IMAGES} images per quote.`);
      setSubmitting(false);
      return;
    }

    let createdQuoteId: string | null = null;

    try {
      // Step 1: Create the quote
      const quoteResponse = await fetch(`/api/closet-jobs/${job.id}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!quoteResponse.ok) {
        const message = await parseErrorMessage(
          quoteResponse,
          "Failed to create quote",
        );
        throw new Error(message);
      }

      const quoteJson = (await quoteResponse.json()) as { id?: string };
      if (!quoteJson?.id) {
        throw new Error("Quote created but response is missing quote id");
      }
      createdQuoteId = quoteJson.id;

      // Step 2: Compress and upload files one at a time to stay under
      // Vercel's ~4.5 MB body limit per request.
      for (const { file } of selectedFiles) {
        const compressed = await compressImage(file);

        const uploadData = new FormData();
        uploadData.append("files", compressed);

        const filesResponse = await fetch(
          `/api/closet-jobs/${job.id}/quotes/${createdQuoteId}/files`,
          {
            method: "POST",
            body: uploadData,
          },
        );

        if (!filesResponse.ok) {
          const message = await parseErrorMessage(
            filesResponse,
            "Image upload failed",
          );
          throw new Error(message);
        }
      }

      // Cleanup object URLs
      selectedFiles.forEach(({ preview }) => URL.revokeObjectURL(preview));

      // Navigate to job detail
      router.push(`/closet-jobs/${job.id}`);
    } catch (error: any) {
      // All-or-nothing: if quote was created and anything failed afterward, roll it back.
      if (createdQuoteId) {
        try {
          await fetch(`/api/closet-jobs/${job.id}/quotes/${createdQuoteId}`, {
            method: "DELETE",
          });
        } catch (rollbackError) {
          console.error("Rollback failed after submit error:", rollbackError);
        }
      }

      console.error("Error submitting quote:", error);
      alert(
        `Failed to submit quote: ${error?.message || "Unknown error"}${createdQuoteId ? " (quote was rolled back)" : ""}`,
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          href={`/closet-jobs/${job.id}`}
          className="text-blue-600 hover:text-blue-800 mb-2 inline-block"
        >
          ← Back to Job
        </Link>
        <h1 className="text-3xl font-bold">Submit New Quote</h1>
        <p className="text-gray-600 mt-2">
          Job: {job.quoteNumber} - {job.customerName}
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Color / Finish *
            </label>
            <input
              type="text"
              required
              value={formData.color}
              onChange={(e) =>
                setFormData({ ...formData, color: e.target.value })
              }
              placeholder="e.g., White Oak, Espresso, Custom Gray"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          {/* Admin can select which installer this quote is for */}
          {isAdmin && installers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Installer *
              </label>
              <select
                required
                value={formData.installerId}
                onChange={(e) =>
                  setFormData({ ...formData, installerId: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {installers.map((installer) => (
                  <option key={installer.id} value={installer.id}>
                    {installer.name || installer.email}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Select the installer responsible for this quote
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Installer Cost * (Your cost for this project)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                required
                step="0.01"
                min="0"
                value={formData.installerCost}
                onChange={(e) =>
                  setFormData({ ...formData, installerCost: e.target.value })
                }
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              This is your internal cost. The final client price will be
              calculated automatically.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notesInstaller}
              onChange={(e) =>
                setFormData({ ...formData, notesInstaller: e.target.value })
              }
              rows={4}
              placeholder="Any additional notes about materials, timeline, special considerations, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                3D Renders / Images
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                <Upload className="w-4 h-4" />
                Choose Files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Upload images from your device. These will be shown to the client
              on the printed quote. Supported formats: JPG, JPEG, PNG, WebP,
              GIF. Up to 30 images, 10MB max each.
            </p>

            <p className="text-xs text-gray-500 mb-3">
              Selected: {selectedFiles.length} / {MAX_IMAGES}
            </p>

            {selectedFiles.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {selectedFiles.map((filePreview, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 rounded-lg p-3 relative"
                  >
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(index)}
                      className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 z-10"
                      title="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <img
                      src={filePreview.preview}
                      alt={filePreview.caption}
                      className="w-full h-32 object-cover rounded mb-2"
                    />
                    <input
                      type="text"
                      placeholder="Caption (optional)"
                      value={filePreview.caption}
                      onChange={(e) =>
                        handleCaptionChange(index, e.target.value)
                      }
                      className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500 text-sm mb-2">No images selected</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Click to upload images
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Link
              href={`/closet-jobs/${job.id}`}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Quote"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
