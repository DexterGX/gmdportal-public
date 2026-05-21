"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, Eye, EyeOff, X } from "lucide-react";
import FilterMultiSelect from "../../../../components/filters/FilterMultiSelect";

type Sink = {
  id: string;
  series: string | null;
  model: string;
  description: string | null;
  dimensions: string;
  imageUrl: string | null;
  finalPrice: number;
};

type Brand = {
  id: string;
  name: string;
  logoUrl: string | null;
  isAdmin: boolean;
  notes: Array<{
    id: string;
    title: string;
    content: string;
    catalogUrl: string | null;
    createdAt: string;
  }>;
  sinks: Sink[];
};

export default function SinkBrandClient({ brand }: { brand: Brand }) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [visibleCodes, setVisibleCodes] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState(brand.notes);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(
    brand.notes[0]?.id ?? null,
  );
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteCatalogUrl, setNoteCatalogUrl] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [modelFilter, setModelFilter] = useState("");
  const [descriptionFilter, setDescriptionFilter] = useState("");
  const [sizeFilter, setSizeFilter] = useState<string[]>([]);
  const [seriesFilter, setSeriesFilter] = useState<string[]>([]);

  const sizeOptions = useMemo(() => {
    return Array.from(
      new Set(brand.sinks.map((sink) => sink.dimensions).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));
  }, [brand.sinks]);

  const seriesOptions = useMemo(() => {
    return Array.from(
      new Set(
        brand.sinks
          .map((sink) => (sink.series ? sink.series.trim() : ""))
          .filter((value) => value.length > 0),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [brand.sinks]);

  const normalizedModelFilter = modelFilter.trim().toLowerCase();
  const normalizedDescriptionFilter = descriptionFilter.trim().toLowerCase();

  const filteredSinks = useMemo(() => {
    return brand.sinks.filter((sink) => {
      const modelMatch = normalizedModelFilter
        ? sink.model.toLowerCase().includes(normalizedModelFilter)
        : true;

      const descriptionMatch = normalizedDescriptionFilter
        ? (sink.description ?? "")
            .toLowerCase()
            .includes(normalizedDescriptionFilter)
        : true;

      const sizeMatch =
        sizeFilter.length === 0 ? true : sizeFilter.includes(sink.dimensions);

      const sinkSeries = sink.series ? sink.series.trim() : "";
      const seriesMatch =
        seriesFilter.length === 0
          ? true
          : seriesFilter.some((selectedSeries) =>
              selectedSeries === "(none)"
                ? sinkSeries.length === 0
                : sinkSeries === selectedSeries,
            );

      return modelMatch && descriptionMatch && sizeMatch && seriesMatch;
    });
  }, [
    brand.sinks,
    normalizedModelFilter,
    normalizedDescriptionFilter,
    sizeFilter,
    seriesFilter,
  ]);

  const orderedSinks = [...filteredSinks].sort((a, b) => {
    const aHasImage = Boolean(a.imageUrl);
    const bHasImage = Boolean(b.imageUrl);
    if (aHasImage === bHasImage) {
      return a.model.localeCompare(b.model);
    }
    return bHasImage ? 1 : -1;
  });

  function toggleCode(sinkId: string) {
    setVisibleCodes((prev) => {
      const next = new Set(prev);
      if (next.has(sinkId)) {
        next.delete(sinkId);
      } else {
        next.add(sinkId);
      }
      return next;
    });
  }

  async function handleCreateNote() {
    const title = noteTitle.trim();
    const content = noteContent.trim();
    const catalogUrl = noteCatalogUrl.trim();

    if (!title || !content) {
      setNoteError("Title and content are required.");
      return;
    }

    setIsSavingNote(true);
    setNoteError(null);
    try {
      const res = await fetch("/api/sinks/admin/brand-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: brand.id,
          title,
          content,
          catalogUrl,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to create note");
      }

      const created = json?.note;
      if (created) {
        setNotes((prev) => [created, ...prev]);
        setExpandedNoteId(created.id);
      }
      setNoteTitle("");
      setNoteContent("");
      setNoteCatalogUrl("");
      setIsAddNoteOpen(false);
    } catch (error: any) {
      setNoteError(error?.message || "Failed to create note");
    } finally {
      setIsSavingNote(false);
    }
  }

  async function handleDeleteNote(noteId: string) {
    setDeletingNoteId(noteId);
    setNoteError(null);
    try {
      const res = await fetch("/api/sinks/admin/brand-notes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to delete note");
      }

      setNotes((prev) => prev.filter((note) => note.id !== noteId));
      setExpandedNoteId((prev) => (prev === noteId ? null : prev));
    } catch (error: any) {
      setNoteError(error?.message || "Failed to delete note");
    } finally {
      setDeletingNoteId(null);
    }
  }

  const hasActiveFilters =
    modelFilter.trim().length > 0 ||
    descriptionFilter.trim().length > 0 ||
    sizeFilter.length > 0 ||
    seriesFilter.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/sinksPriceList"
          className="inline-flex text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          Back to Overview
        </Link>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {brand.logoUrl ? (
              <img
                src={brand.logoUrl}
                alt={`${brand.name} logo`}
                className="h-16 w-auto object-contain"
              />
            ) : null}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {brand.name}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                View current sink pricing for this provider.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsNotesOpen(true)}
            className="h-10 w-10 rounded-full bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-700 inline-flex items-center justify-center transition-colors"
            title="Important notes"
            aria-label="Open important notes"
          >
            <AlertTriangle className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
          <div className="min-w-0">
            <input
              type="text"
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              placeholder="Model"
              className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="min-w-0">
            <input
              type="text"
              value={descriptionFilter}
              onChange={(e) => setDescriptionFilter(e.target.value)}
              placeholder="Description"
              className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="min-w-0">
            <FilterMultiSelect
              label="Size W x L x D"
              options={sizeOptions}
              selected={sizeFilter}
              onChange={setSizeFilter}
              fullWidth
              matchInputStyle
            />
          </div>

          <div className="min-w-0">
            <FilterMultiSelect
              label="Series"
              options={["(none)", ...seriesOptions]}
              selected={seriesFilter}
              onChange={setSeriesFilter}
              fullWidth
              matchInputStyle
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            Showing {orderedSinks.length} of {brand.sinks.length} sinks
          </span>
          <button
            type="button"
            disabled={!hasActiveFilters}
            onClick={() => {
              setModelFilter("");
              setDescriptionFilter("");
              setSizeFilter([]);
              setSeriesFilter([]);
            }}
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              hasActiveFilters
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
            }`}
          >
            Clear filters
          </button>
        </div>
      </div>

      {brand.sinks.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
          No sinks available for this provider.
        </div>
      ) : orderedSinks.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
          No sinks match the selected filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {orderedSinks.map((sink: Sink) => {
            const codeVisible = visibleCodes.has(sink.id);

            return (
              <article
                key={sink.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-2.5 shadow-sm flex flex-col"
              >
                <p className="text-base font-bold text-gray-800 dark:text-gray-100 text-center line-clamp-2 leading-tight">
                  {sink.description || "No description provided."}
                </p>
                <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 text-center">
                  {sink.series || "-"}
                </p>
                <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 text-center">
                  {sink.dimensions}
                </p>

                <div
                  className="mt-2 w-full aspect-[4/3] rounded-md bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 overflow-hidden cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition"
                  onClick={() =>
                    sink.imageUrl && setSelectedImage(sink.imageUrl)
                  }
                >
                  {sink.imageUrl ? (
                    <img
                      src={sink.imageUrl}
                      alt={sink.description || sink.model}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
                      No image
                    </div>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleCode(sink.id)}
                    aria-label={codeVisible ? "Hide code" : "Show code"}
                    title={codeVisible ? "Hide code" : "Show code"}
                    className="h-7 w-7 inline-flex items-center justify-center rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    {codeVisible ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>

                  <p className="text-right text-sm font-bold text-gray-900 dark:text-gray-100">
                    ${sink.finalPrice.toFixed(2)}
                  </p>
                </div>

                {codeVisible ? (
                  <p className="mt-1 text-xs font-semibold text-gray-900 dark:text-gray-100 text-right">
                    {sink.model}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-2"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative w-full h-full max-w-full max-h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition z-10"
            >
              <X className="w-8 h-8" />
            </button>
            <img
              src={selectedImage}
              alt="Enlarged sink image"
              className="h-full w-full object-contain"
            />
          </div>
        </div>
      )}

      {isNotesOpen && (
        <div
          className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setIsNotesOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Brand Notes
              </h2>
              <button
                type="button"
                onClick={() => setIsNotesOpen(false)}
                className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(85vh-64px)]">
              {brand.isAdmin && !isAddNoteOpen && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setNoteError(null);
                      setIsAddNoteOpen(true);
                    }}
                    className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
                  >
                    Add note
                  </button>
                </div>
              )}

              {brand.isAdmin && isAddNoteOpen && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Add Note
                  </p>
                  <input
                    type="text"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="Note title"
                    className="w-full h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 text-sm"
                  />
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Note content"
                    rows={4}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  />
                  <input
                    type="url"
                    value={noteCatalogUrl}
                    onChange={(e) => setNoteCatalogUrl(e.target.value)}
                    placeholder="Catalogue link (optional, https://...)"
                    className="w-full h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 text-sm"
                  />
                  {noteError ? (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {noteError}
                    </p>
                  ) : null}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddNoteOpen(false);
                        setNoteError(null);
                      }}
                      className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCreateNote()}
                      disabled={isSavingNote}
                      className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isSavingNote ? "Saving..." : "Save note"}
                    </button>
                  </div>
                </div>
              )}

              {notes.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No notes added yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {notes.map((note) => {
                    const isExpanded = expandedNoteId === note.id;
                    return (
                      <div
                        key={note.id}
                        className="rounded-lg border border-gray-200 dark:border-gray-700"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedNoteId((prev) =>
                              prev === note.id ? null : note.id,
                            )
                          }
                          className="w-full text-left px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        >
                          {note.title}
                        </button>
                        {isExpanded && (
                          <div className="px-3 pb-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                            <p>{note.content}</p>
                            {note.catalogUrl ? (
                              <a
                                href={note.catalogUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex mt-2 items-center rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                              >
                                Open link
                              </a>
                            ) : null}
                            {brand.isAdmin ? (
                              <div className="mt-2">
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteNote(note.id)}
                                  disabled={deletingNoteId === note.id}
                                  className="inline-flex items-center rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                >
                                  {deletingNoteId === note.id ? "Deleting..." : "Delete note"}
                                </button>
                              </div>
                            ) : null}
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                              {new Date(note.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
