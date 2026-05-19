"use client";

type Props = {
  sinkId: string;
  imageUrl: string | null;
  onUploaded: (imageUrl: string) => void;
  onRemoved: () => void;
};

export default function SinkImageUploader({
  sinkId,
  imageUrl,
  onUploaded,
  onRemoved,
}: Props) {
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append("sinkId", sinkId);
    formData.append("file", file);

    const response = await fetch("/api/sinks/admin/sink-image-upload", {
      method: "POST",
      body: formData,
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      alert(json?.error || "Failed to upload image");
      return;
    }

    onUploaded(String(json?.imageUrl || ""));
  };

  const handleRemove = async () => {
    const response = await fetch(
      `/api/sinks/admin/sinks/${encodeURIComponent(sinkId)}/image`,
      {
        method: "DELETE",
      },
    );

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      alert(json?.error || "Failed to remove image");
      return;
    }

    onRemoved();
  };

  return (
    <div className="flex items-center gap-2">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Sink"
          className="h-10 w-10 rounded object-cover"
        />
      ) : (
        <div className="h-10 w-10 rounded bg-gray-100 dark:bg-gray-700" />
      )}
      <label className="cursor-pointer text-xs text-blue-600 hover:underline">
        Upload
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
        />
      </label>
      {imageUrl ? (
        <button
          type="button"
          onClick={handleRemove}
          className="text-xs text-red-600 hover:underline"
        >
          Remove
        </button>
      ) : null}
    </div>
  );
}
