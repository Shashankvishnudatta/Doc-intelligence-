"use client";

/* eslint-disable @next/next/no-img-element */

import { deleteDocument as apiDeleteDocument, getApiAssetUrl } from "@/lib/api";
import { formatBytes } from "@/lib/format";
import type { DocumentListItem } from "@/types/api";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Database,
  FileImage,
  FileText,
  Fingerprint,
  Layers3,
  Loader2,
  MessageSquare,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Tags,
  Trash2,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

type LibraryFilter = "all" | "ready" | "processing" | "failed";

function parseClassification(classificationJson?: string | null) {
  if (!classificationJson) return null;

  try {
    const parsed = JSON.parse(classificationJson);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function valueToText(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value) && value.length > 0) {
    return value
      .map((item) => valueToText(item))
      .filter((item): item is string => Boolean(item))
      .join(", ");
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    for (const nestedKey of ["level", "label", "value", "type", "reason"]) {
      const nestedValue = valueToText(record[nestedKey]);

      if (nestedValue) {
        return nestedValue;
      }
    }
  }

  return null;
}

function getClassificationValue(
  classification: Record<string, unknown> | null,
  keys: string[]
) {
  if (!classification) return "Not classified";

  for (const key of keys) {
    const value = valueToText(classification[key]);

    if (value) {
      return value;
    }
  }

  return "Not available";
}

function getClassificationRecord(
  classification: Record<string, unknown> | null,
  keys: string[]
) {
  if (!classification) return null;

  for (const key of keys) {
    const value = classification[key];

    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }

  return null;
}

function humanizeKey(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatStatus(status: string) {
  const normalized = status.toLowerCase();

  if (normalized === "indexed") return "Ready";
  if (normalized === "failed") return "Failed";

  if (
    ["uploaded", "parsing", "parsed", "classifying", "classified", "indexing"].includes(
      normalized
    )
  ) {
    return "Processing";
  }

  return humanizeKey(status);
}

function getStatusBadgeClass(status: string) {
  const normalized = status.toLowerCase();

  if (normalized === "indexed") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (normalized === "failed") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (normalized.includes("ing")) {
    return "bg-cyan-50 text-cyan-700 ring-cyan-200";
  }

  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function getSensitivityBadgeClass(value: string) {
  const normalized = value.toLowerCase();

  if (normalized.includes("high") || normalized.includes("confidential")) {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (normalized.includes("medium") || normalized.includes("internal")) {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  if (normalized.includes("low") || normalized.includes("public")) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  return "bg-slate-100 text-slate-600 ring-slate-200";
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

function formatDateTime(value?: string | null) {
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
    return document.status !== "indexed" && document.status !== "failed";
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

function shortDocumentId(documentId: string) {
  if (documentId.length <= 12) return documentId;

  return `${documentId.slice(0, 8)}...${documentId.slice(-4)}`;
}

function SkeletonRow() {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 animate-pulse rounded-2xl bg-slate-200" />

        <div className="min-w-0 flex-1">
          <div className="h-4 w-7/12 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-3 h-3 w-10/12 animate-pulse rounded-full bg-slate-100" />
          <div className="mt-4 flex gap-2">
            <div className="h-7 w-20 animate-pulse rounded-full bg-slate-100" />
            <div className="h-7 w-24 animate-pulse rounded-full bg-slate-100" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${getStatusBadgeClass(
        status
      )}`}
    >
      {formatStatus(status)}
    </span>
  );
}

function MetadataTile({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-black text-slate-900">
        {value}
      </p>
    </div>
  );
}

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentListItem | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const uniqueDocuments = useMemo(() => getUniqueDocuments(documents), [documents]);

  const selectedDocument = useMemo(() => {
    if (!selectedDocumentId) {
      return null;
    }

    return (
      uniqueDocuments.find((document) => document.id === selectedDocumentId) ??
      null
    );
  }, [uniqueDocuments, selectedDocumentId]);

  const selectedClassification = useMemo(() => {
    return parseClassification(selectedDocument?.classification_json);
  }, [selectedDocument]);

  const selectedSensitivity = getClassificationValue(selectedClassification, [
    "sensitivity",
    "sensitivity_level",
    "data_sensitivity",
  ]);

  const selectedSummary = getClassificationValue(selectedClassification, [
    "summary",
    "description",
    "document_summary",
  ]);

  const selectedCharacteristics = getClassificationRecord(selectedClassification, [
    "content_characteristics",
    "characteristics",
    "features",
  ]);

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
      const classification = parseClassification(document.classification_json);
      const searchable = [
        document.original_filename,
        document.content_type,
        document.status,
        getClassificationValue(classification, [
          "document_type",
          "type",
          "category",
        ]),
        getClassificationValue(classification, ["topic", "main_topic", "subject"]),
        getClassificationValue(classification, [
          "sensitivity",
          "sensitivity_level",
          "data_sensitivity",
        ]),
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

  async function handleConfirmDelete() {
    if (!deleteTarget) return;

    try {
      setIsDeleting(true);
      setDeleteError(null);

      await apiDeleteDocument(deleteTarget.id);

      setDocuments((currentDocuments) =>
        currentDocuments.filter((document) => document.id !== deleteTarget.id)
      );

      if (selectedDocumentId === deleteTarget.id) {
        setSelectedDocumentId(null);
      }

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

  function handleAskInChat(documentId: string) {
    window.localStorage.setItem("bfai_pending_document_id", documentId);
    router.push("/chat");
  }

  useEffect(() => {
    queueMicrotask(() => {
      loadDocuments();
    });
  }, []);

  return (
    <div className="h-[100dvh] w-full overflow-hidden p-6">
      <div className="flex h-full min-h-0 flex-col gap-5">
        <div className="grid shrink-0 grid-cols-1 gap-4 md:grid-cols-4">
          {[
            {
              id: "all" as const,
              label: "Library",
              value: stats.total,
              icon: Database,
              activeClass: "border-slate-950 bg-slate-950 text-white",
            },
            {
              id: "ready" as const,
              label: "Ready",
              value: stats.ready,
              icon: CheckCircle2,
              activeClass: "border-emerald-600 bg-emerald-600 text-white",
            },
            {
              id: "processing" as const,
              label: "Processing",
              value: stats.processing,
              icon: Loader2,
              activeClass: "border-cyan-600 bg-cyan-600 text-white",
            },
            {
              id: "failed" as const,
              label: "Failed",
              value: stats.failed,
              icon: AlertTriangle,
              activeClass: "border-red-600 bg-red-600 text-white",
            },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = filter === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setFilter(item.id)}
                className={`rounded-3xl border p-5 text-left transition ${
                  isActive
                    ? item.activeClass
                    : "border-slate-200 bg-white/80 text-slate-950 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] opacity-60">
                      {item.label}
                    </p>
                    <p className="mt-1 text-3xl font-black">{item.value}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div
          className={
            selectedDocument
              ? "grid min-h-0 flex-1 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]"
              : "grid min-h-0 flex-1 grid-cols-1"
          }
        >
          <section className="flex min-h-0 flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-white/75 shadow-2xl shadow-slate-300/50 backdrop-blur-xl">
            <div className="shrink-0 border-b border-slate-200 p-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-indigo-600">
                    Document Intelligence
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">
                    Knowledge Base
                  </h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Inspect parsed, classified, and indexed documents prepared
                    for grounded RAG.
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
                  placeholder="Search by name, type, topic, sensitivity, or status..."
                  className="w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
                />
              </label>
            </div>

            {error && (
              <div className="m-5 shrink-0 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            {isLoading ? (
              <div className="min-h-0 flex-1 space-y-3 overflow-hidden p-5">
                {Array.from({ length: 5 }).map((_, index) => (
                  <SkeletonRow key={index} />
                ))}
              </div>
            ) : uniqueDocuments.length === 0 ? (
              <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-center">
                <div className="max-w-sm">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                    <Database className="h-7 w-7" />
                  </div>
                  <h3 className="mt-5 text-xl font-black text-slate-950">
                    No documents indexed yet
                  </h3>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                    Upload documents to build your knowledge base and generate
                    document intelligence profiles.
                  </p>
                  <Link
                    href="/upload"
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
                  >
                    <UploadCloud className="h-4 w-4" />
                    Upload documents
                  </Link>
                </div>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-center">
                <div className="max-w-sm">
                  <Search className="mx-auto h-10 w-10 text-slate-300" />
                  <h3 className="mt-4 text-lg font-black text-slate-950">
                    No documents found
                  </h3>
                  <p className="mt-2 text-sm font-medium text-slate-500">
                    Change your search or filter to inspect another document.
                  </p>
                </div>
              </div>
            ) : (
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
                {filteredDocuments.map((document) => {
                  const classification = parseClassification(
                    document.classification_json
                  );
                  const sensitivity = getClassificationValue(classification, [
                    "sensitivity",
                    "sensitivity_level",
                    "data_sensitivity",
                  ]);
                  const documentKind = getDocumentKind(
                    document.content_type,
                    document.original_filename
                  );
                  const isSelected = selectedDocumentId === document.id;
                  const canAsk = document.status === "indexed";

                  return (
                    <article
                      key={document.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedDocumentId(document.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedDocumentId(document.id);
                        }
                      }}
                      className={`grid cursor-pointer gap-4 rounded-3xl border p-4 text-left transition xl:grid-cols-[1fr_auto] ${
                        isSelected
                          ? "border-indigo-300 bg-indigo-50/60 ring-1 ring-indigo-200"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex min-w-0 items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                          <FileText className="h-6 w-6" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-base font-black text-slate-950">
                              {document.original_filename}
                            </h3>
                            <StatusChip status={document.status} />
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-500">
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarClock className="h-3.5 w-3.5" />
                              {formatDateTime(document.created_at)}
                            </span>
                            <span>{documentKind}</span>
                            <span>
                              {document.page_count} page
                              {document.page_count === 1 ? "" : "s"}
                            </span>
                            <span>{formatBytes(document.size_bytes)}</span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {classification ? (
                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${getSensitivityBadgeClass(
                                  sensitivity
                                )}`}
                              >
                                {sensitivity}
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-500 ring-1 ring-slate-200">
                                Not classified
                              </span>
                            )}
                            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-black text-indigo-700 ring-1 ring-indigo-100">
                              {getClassificationValue(classification, [
                                "document_type",
                                "type",
                                "category",
                              ])}
                            </span>
                          </div>

                          {document.error_message && (
                            <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                              {document.error_message}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                        <button
                          type="button"
                          disabled={!canAsk}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (canAsk) handleAskInChat(document.id);
                          }}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-black text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                        >
                          <MessageSquare className="h-4 w-4" />
                          Ask
                        </button>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
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
          </section>

          {selectedDocument && (
            <aside className="flex min-h-0 flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-white/75 shadow-2xl shadow-slate-300/50 backdrop-blur-xl">
              <>
                <div className="shrink-0 border-b border-slate-200 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-indigo-600">
                        Intelligence Profile
                      </p>
                      <h3 className="mt-2 truncate text-2xl font-black text-slate-950">
                        {selectedDocument.original_filename}
                      </h3>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <StatusChip status={selectedDocument.status} />
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600 ring-1 ring-slate-200">
                          {getDocumentKind(
                            selectedDocument.content_type,
                            selectedDocument.original_filename
                          )}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600 ring-1 ring-slate-200">
                          {formatBytes(selectedDocument.size_bytes)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={selectedDocument.status !== "indexed"}
                      onClick={() => handleAskInChat(selectedDocument.id)}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Ask in Chat
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
                  <section className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
                    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                      <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                        <FileImage className="h-4 w-4 text-indigo-600" />
                        Page preview
                      </div>
                      <span className="text-xs font-bold text-slate-400">
                        Page 1
                      </span>
                    </div>

                    {selectedDocument.page_count > 0 ? (
                      <div className="bg-white p-3">
                        <img
                          src={getApiAssetUrl(
                            `/documents/${selectedDocument.id}/pages/1/image`
                          )}
                          alt={`${selectedDocument.original_filename} page 1 preview`}
                          className="h-64 w-full rounded-2xl border border-slate-200 bg-white object-contain shadow-sm"
                        />
                      </div>
                    ) : (
                      <div className="flex h-64 flex-col items-center justify-center bg-white p-6 text-center">
                        <FileImage className="h-9 w-9 text-slate-300" />
                        <p className="mt-3 text-sm font-black text-slate-700">
                          No page image yet
                        </p>
                        <p className="mt-1 text-xs font-medium text-slate-500">
                          Parse the document to generate page previews.
                        </p>
                      </div>
                    )}
                  </section>

                  <section className="rounded-3xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-indigo-600" />
                      <h4 className="text-lg font-black text-slate-950">
                        Classification
                      </h4>
                    </div>

                    {selectedClassification ? (
                      <div className="mt-4 space-y-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                          <MetadataTile
                            label="Type"
                            value={getClassificationValue(selectedClassification, [
                              "document_type",
                              "type",
                              "category",
                            ])}
                          />
                          <MetadataTile
                            label="Topic"
                            value={getClassificationValue(selectedClassification, [
                              "topic",
                              "main_topic",
                              "primary_topic",
                              "subject",
                            ])}
                          />
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-slate-500" />
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                              Sensitivity
                            </p>
                          </div>
                          <span
                            className={`mt-3 inline-flex rounded-full px-3 py-1.5 text-xs font-black ring-1 ${getSensitivityBadgeClass(
                              selectedSensitivity
                            )}`}
                          >
                            {selectedSensitivity}
                          </span>
                        </div>

                        {selectedCharacteristics && (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center gap-2">
                              <Tags className="h-4 w-4 text-slate-500" />
                              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                                Characteristics
                              </p>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {Object.entries(selectedCharacteristics).map(
                                ([key, value]) => {
                                  const text = valueToText(value);

                                  if (!text) return null;

                                  return (
                                    <span
                                      key={key}
                                      className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200"
                                    >
                                      {humanizeKey(key)}: {text}
                                    </span>
                                  );
                                }
                              )}
                            </div>
                          </div>
                        )}

                        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-500">
                            Summary
                          </p>
                          <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
                            {selectedSummary}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm font-black text-slate-800">
                          This document has not been classified yet.
                        </p>
                        <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
                          Run the processing pipeline to populate type, topic,
                          sensitivity, and document intelligence fields.
                        </p>
                      </div>
                    )}
                  </section>

                  <section className="rounded-3xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center gap-2">
                      <Layers3 className="h-5 w-5 text-indigo-600" />
                      <h4 className="text-lg font-black text-slate-950">
                        Metadata
                      </h4>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <MetadataTile
                        label="Document ID"
                        value={shortDocumentId(selectedDocument.id)}
                      />
                      <MetadataTile
                        label="Pages"
                        value={selectedDocument.page_count}
                      />
                      <MetadataTile
                        label="File size"
                        value={formatBytes(selectedDocument.size_bytes)}
                      />
                      <MetadataTile
                        label="Status"
                        value={formatStatus(selectedDocument.status)}
                      />
                    </div>

                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-2">
                        <Fingerprint className="h-4 w-4 text-slate-500" />
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                          Content type
                        </p>
                      </div>
                      <p className="mt-2 break-all text-sm font-black text-slate-900">
                        {selectedDocument.content_type}
                      </p>
                    </div>

                    {selectedDocument.error_message && (
                      <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-500">
                          Processing error
                        </p>
                        <p className="mt-2 text-sm font-semibold leading-6 text-red-700">
                          {selectedDocument.error_message}
                        </p>
                      </div>
                    )}
                  </section>
                </div>
              </>
            </aside>
          )}
        </div>
      </div>

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
                </span>
                , its extracted pages, chunks, page images, and vector
                embeddings.
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
                className="flex items-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
