"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
  const [formData, setFormData] = useState({
    color: "",
    installerCost: "",
    notesInstaller: "",
    installerId: job.installerId, // Default to job's assigned installer
  });
  const [files, setFiles] = useState<
    Array<{ fileUrl: string; type: string; caption: string }>
  >([]);
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = userRole === "admin";

  const handleAddFile = () => {
    setFiles([...files, { fileUrl: "", type: "3D_RENDER", caption: "" }]);
  };

  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleFileChange = (index: number, field: string, value: string) => {
    const newFiles = [...files];
    newFiles[index] = { ...newFiles[index], [field]: value };
    setFiles(newFiles);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Filter out empty file URLs
      const validFiles = files.filter((f) => f.fileUrl.trim() !== "");

      const response = await fetch(`/api/closet-jobs/${job.id}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          files: validFiles.length > 0 ? validFiles : undefined,
        }),
      });

      if (response.ok) {
        router.push(`/closet-jobs/${job.id}`);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error("Error submitting quote:", error);
      alert("Failed to submit quote");
    } finally {
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
                onClick={handleAddFile}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                + Add Image
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Provide URLs to 3D renders or photos that will be shown to the
              client. These will appear on the printed quote.
            </p>

            <div className="space-y-3">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-3"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      Image {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="space-y-2">
                    <input
                      type="url"
                      placeholder="Image URL (https://...)"
                      value={file.fileUrl}
                      onChange={(e) =>
                        handleFileChange(index, "fileUrl", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={file.type}
                        onChange={(e) =>
                          handleFileChange(index, "type", e.target.value)
                        }
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="3D_RENDER">3D Render</option>
                        <option value="PLAN">Floor Plan</option>
                        <option value="PHOTO">Photo</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Caption (optional)"
                        value={file.caption}
                        onChange={(e) =>
                          handleFileChange(index, "caption", e.target.value)
                        }
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
