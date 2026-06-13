"use client";
import { deleteDocument as apiDeleteDocument } from "@/lib/api";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Database,
  FileText,
  Loader2,
  RefreshCcw,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { API_BASE_URL, apiFetch } from "@/lib/api";
import { formatBytes } from "@/lib/format";
import type { DocumentListItem } from "@/types/api";

type LibraryFilter = "all" | "ready" | "processing" | "failed";

function formatStatus(status: string) {
  if (status === "indexed") return "Ready";
  if (status === "failed") return "Failed";

  if (
    ["uploaded", "parsing", "parsed", "classifying", "classified", "indexing"].includes(
      status
    )
  ) {
    return "Processing";
  }

  return status;
}

function statusClass(status: string) {
  if (status === "indexed") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  }

  if (status === "failed") {
    return "bg-red-50 text-red-700 ring-1 ring-red-200";
  }

  return "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200";
}

function getDocumentKind(contentType: string, filename: string) {
  const lowerName = filename.toLowerCase();

  if (contentType.includes("pdf") || lowerName.endsWith(".pdf")) return "PDF";
  if (contentType.includes("text") || lowerName.endsWith(".txt")) return "Text";
  if (contentType.includes("image") || /\.(png|jpg|jpeg)$/i.test(lowerName)) {
    return "Image";
  }

  return "Document";
}

function formatDateTime(value: string) {
  if (!value) return "Unknown date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Unknown date";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function matchesFilter(document: DocumentListItem, filter: LibraryFilter) {
  if (filter === "all") return true;
  if (filter === "ready") return document.status === "indexed";
  if (filter === "failed") return document.status === "failed";

  if (filter === "processing") {
    return (
      document.status !== "indexed" &&
      document.status !== "failed"
    );
  }

  return true;
}

function getUniqueDocuments(documents: DocumentListItem[]) {
  const seen = new Set<string>();
  const unique: DocumentListItem[] = [];

  for (const document of documents) {
    const key = `${document.original_filename}-${document.size_bytes}`;

    if (seen.has(key)) continue;

    seen.add(key);
    unique.push(document);
  }

  return unique;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [error, setError] = useState<string | null>(null);
  
  // Modal State Triggers
  const [deleteTarget, setDeleteTarget] = useState<DocumentListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const uniqueDocuments = useMemo(() => {
    return getUniqueDocuments(documents);
  }, [documents]);

  const stats = useMemo(() => {
    return {
      total: uniqueDocuments.length,
      ready: uniqueDocuments.filter((document) => document.status === "indexed")
        .length,
      processing: uniqueDocuments.filter(
        (document) => document.status !== "indexed" && document.status !== "failed"
      ).length,
      failed: uniqueDocuments.filter((document) => document.status === "failed")
        .length,
    };
  }, [uniqueDocuments]);

  const filteredDocuments = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return uniqueDocuments.filter((document) => {
      const searchable = [
        document.original_filename,
        document.content_type,
        document.status,
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesFilter(document, filter) &&
        (!cleanQuery || searchable.includes(cleanQuery))
      );
    });
  }, [uniqueDocuments, query, filter]);
  
  async function loadDocuments() {
    try {
      setError(null);
      setIsLoading(true);

      const data = await apiFetch<DocumentListItem[]>("/documents");
      setDocuments(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load documents."
      );
    } finally {
      setIsLoading(false);
    }
  }

  // Refactored Confirmation Handler
  async function handleConfirmDelete() {
    if (!deleteTarget) return;

    try {
      setIsDeleting(true);
      setDeleteError(null);

      await apiDeleteDocument(deleteTarget.id);

      setDocuments((currentDocuments) =>
        currentDocuments.filter((document) => document.id !== deleteTarget.id)
      );

      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : "Failed to delete document. Please try again."
      );
    } finally {
      setIsDeleting(false);
    }
  }

  useEffect(() => {
    loadDocuments();
  }, []);

  return (
    <section className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-3xl border p-5 text-left transition ${
            filter === "all"
              ? "border-slate-950 bg-slate-950 text-white"
              : "border-slate-200 bg-white text-slate-950 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] opacity-60">
                Library
              </p>
              <p className="mt-1 text-3xl font-black">{stats.total}</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilter("ready")}
          className={`rounded-3xl border p-5 text-left transition ${
            filter === "ready"
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-slate-200 bg-white text-slate-950 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] opacity-60">
                Ready
              </p>
              <p className="mt-1 text-3xl font-black">{stats.ready}</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilter("processing")}
          className={`rounded-3xl border p-5 text-left transition ${
            filter === "processing"
              ? "border-cyan-600 bg-cyan-600 text-white"
              : "border-slate-200 bg-white text-slate-950 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] opacity-60">
                Processing
              </p>
              <p className="mt-1 text-3xl font-black">{stats.processing}</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilter("failed")}
          className={`rounded-3xl border p-5 text-left transition ${
            filter === "failed"
              ? "border-red-600 bg-red-600 text-white"
              : "border-slate-200 bg-white text-slate-950 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] opacity-60">
                Failed
              </p>
              <p className="mt-1 text-3xl font-black">{stats.failed}</p>
            </div>
          </div>
        </button>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-950">
                Knowledge Base
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Uploaded documents that are ready for cited document chat.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href="/upload"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800"
              >
                <UploadCloud className="h-4 w-4" />
                Upload Documents
              </Link>

              <button
                onClick={loadDocuments}
                disabled={isLoading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                Refresh
              </button>
            </div>
          </div>

          <label className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search documents by name or file type..."
              className="w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
            />
          </label>
        </div>

        {error && (
          <div className="m-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="p-10">
            <div className="flex items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-8 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-slate-700" />
              Loading your knowledge base...
            </div>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-10 text-center">
            <Database className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-4 text-lg font-black text-slate-950">
              No documents found
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Upload a document or change your search/filter.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredDocuments.map((document) => {
              const documentKind = getDocumentKind(
                document.content_type,
                document.original_filename
              );

              return (
                <article
                  key={document.id}
                  className="grid gap-4 p-5 transition hover:bg-slate-50 xl:grid-cols-[1fr_auto]"
                >
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <FileText className="h-6 w-6" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-lg font-black text-slate-950">
                          {document.original_filename}
                        </h3>

                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-black ${statusClass(
                            document.status
                          )}`}
                        >
                          {formatStatus(document.status)}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarClock className="h-3.5 w-3.5" />
                          Uploaded {formatDateTime(document.created_at)}
                        </span>

                        <span>{documentKind}</span>

                        <span>
                          {document.page_count} page
                          {document.page_count === 1 ? "" : "s"}
                        </span>

                        <span>{formatBytes(document.size_bytes)}</span>
                      </div>

                      {document.error_message && (
                        <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                          {document.error_message}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                    <Link
                      href="/chat"
                      className="inline-flex items-center justify-center rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-black text-white transition hover:bg-cyan-600"
                    >
                      Ask in Chat
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        setDeleteTarget(document);
                        setDeleteError(null);
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-black text-red-600 transition hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Modal Render */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4">
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-red-500">
                Confirm Delete
              </p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">
                Are you sure?
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                This will permanently delete{" "}
                <span className="font-bold text-slate-950">
                  {deleteTarget.original_filename}
                </span>{" "}
                , its extracted pages, chunks, page images, and vector embeddings.
              </p>
            </div>

            {deleteError && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError(null);
                }}
                className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 flex items-center gap-2"
              >
                {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}