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
      (file) => !ALLOWED_IMAGE_TYPES.includes(file.type)
    );
    if (invalidTypeFiles.length > 0) {
      alert(
        "Some files were skipped because they are not supported. Allowed formats: JPG, JPEG, PNG, WebP, GIF."
      );
    }

    const oversizedFiles = files.filter((file) => file.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      alert("Some files were skipped because they are larger than 10MB.");
    }

    const validFiles = files.filter(
      (file) =>
        ALLOWED_IMAGE_TYPES.includes(file.type) && file.size <= MAX_FILE_SIZE
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
        `Only ${MAX_IMAGES} images are allowed. Extra images were not added.`
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    if (selectedFiles.length > MAX_IMAGES) {
      alert(`You can upload a maximum of ${MAX_IMAGES} images per quote.`);
      setSubmitting(false);
      return;
    }

    try {
      // Step 1: Create the quote
      const quoteResponse = await fetch(`/api/closet-jobs/${job.id}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!quoteResponse.ok) {
        const error = await quoteResponse.json();
        throw new Error(error.error || "Failed to create quote");
      }

      const { id: quoteId } = await quoteResponse.json();

      // Step 2: Upload files if any selected
      if (selectedFiles.length > 0) {
        const uploadData = new FormData();
        selectedFiles.forEach(({ file }) => {
          uploadData.append("files", file);
        });

        const filesResponse = await fetch(
          `/api/closet-jobs/${job.id}/quotes/${quoteId}/files`,
          {
            method: "POST",
            body: uploadData,
          }
        );

        if (!filesResponse.ok) {
          const error = await filesResponse.json();
          console.error("File upload error, rolling back quote:", error);

          // Enforce all-or-nothing behavior: if image upload fails, delete the quote.
          await fetch(`/api/closet-jobs/${job.id}/quotes/${quoteId}`, {
            method: "DELETE",
          });

          throw new Error(
            error.error ||
              "Image upload failed, so the quote was not submitted."
          );
        }
      }

      // Cleanup object URLs
      selectedFiles.forEach(({ preview }) => URL.revokeObjectURL(preview));

      // Navigate to job detail
      router.push(`/closet-jobs/${job.id}`);
    } catch (error: any) {
      console.error("Error submitting quote:", error);
      alert(`Failed to submit quote: ${error.message}`);
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
