"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  FileText,
  FileUp,
  Loader2,
  ShieldCheck,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { API_BASE_URL, apiFetch } from "@/lib/api";
import { formatBytes } from "@/lib/format";
import type {
  BulkUploadResponse,
  DocumentDetail,
  IndexResponse,
} from "@/types/api";

type PipelineStatus =
  | "queued"
  | "uploaded"
  | "parsing"
  | "parsed"
  | "classifying"
  | "classified"
  | "indexing"
  | "indexed"
  | "failed";

type PipelineItem = {
  filename: string;
  documentId: string | null;
  sizeBytes: number | null;
  status: PipelineStatus;
  detail: string;
};

function userStatusLabel(status: PipelineStatus) {
  const labels: Record<PipelineStatus, string> = {
    queued: "Waiting",
    uploaded: "Uploaded",
    parsing: "Reading document",
    parsed: "Content extracted",
    classifying: "Understanding content",
    classified: "Content understood",
    indexing: "Preparing for chat",
    indexed: "Ready",
    failed: "Failed",
  };

  return labels[status];
}

function userStatusClass(status: PipelineStatus) {
  if (status === "indexed") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  }

  if (status === "failed") {
    return "bg-red-50 text-red-700 ring-1 ring-red-200";
  }

  if (status === "queued" || status === "uploaded") {
    return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  }

  return "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200";
}

function userDetail(status: PipelineStatus, originalDetail: string) {
  const details: Partial<Record<PipelineStatus, string>> = {
    queued: "Waiting for upload to begin.",
    uploaded: "File uploaded securely. Preparing document analysis.",
    parsing: "Reading text, images, OCR content, and page evidence.",
    parsed: "Document content was extracted successfully.",
    classifying: "Identifying document type, topic, and sensitivity signals.",
    classified: "Document understanding is complete.",
    indexing: "Preparing the document so the chatbot can answer from it.",
    indexed: "This document is ready for citation-backed chat.",
    failed: originalDetail,
  };

  return details[status] || originalDetail;
}

export default function UploadPage() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const canUpload = selectedFiles.length > 0 && !isUploading;

  const totalSelectedSize = useMemo(() => {
    return selectedFiles.reduce((sum, file) => sum + file.size, 0);
  }, [selectedFiles]);

  function updateItem(filename: string, updates: Partial<PipelineItem>) {
    setItems((current) =>
      current.map((item) =>
        item.filename === filename ? { ...item, ...updates } : item
      )
    );
  }

  async function runPipeline(item: PipelineItem) {
    if (!item.documentId) return;

    try {
      updateItem(item.filename, {
        status: "parsing",
        detail: "Reading text, OCR content, tables, and page images.",
      });

      await apiFetch<DocumentDetail>(`/documents/${item.documentId}/parse`, {
        method: "POST",
      });

      updateItem(item.filename, {
        status: "parsed",
        detail: "Document content extracted.",
      });

      updateItem(item.filename, {
        status: "classifying",
        detail: "Understanding document type, topic, and sensitivity.",
      });

      await apiFetch<DocumentDetail>(`/documents/${item.documentId}/classify`, {
        method: "POST",
      });

      updateItem(item.filename, {
        status: "classified",
        detail: "Document understanding completed.",
      });

      updateItem(item.filename, {
        status: "indexing",
        detail: "Preparing document for citation-backed chat.",
      });

      const indexResponse = await apiFetch<IndexResponse>(
        `/documents/${item.documentId}/index`,
        {
          method: "POST",
        }
      );

      if (indexResponse.status !== "indexed") {
        throw new Error(indexResponse.detail || "Document preparation failed.");
      }

      updateItem(item.filename, {
        status: "indexed",
        detail: `Ready for chat. ${indexResponse.chunk_count} searchable sections prepared.`,
      });
    } catch (error) {
      updateItem(item.filename, {
        status: "failed",
        detail:
          error instanceof Error
            ? error.message
            : "Unexpected document processing error.",
      });
    }
  }

  async function handleUpload() {
    if (!canUpload) return;

    setIsUploading(true);

    const initialItems: PipelineItem[] = selectedFiles.map((file) => ({
      filename: file.name,
      documentId: null,
      sizeBytes: file.size,
      status: "queued",
      detail: "Waiting for upload...",
    }));

    setItems(initialItems);

    try {
      const formData = new FormData();

      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch(`${API_BASE_URL}/uploads/bulk`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const uploadResponse = (await response.json()) as BulkUploadResponse;

      const uploadedItems: PipelineItem[] = uploadResponse.results.map(
        (result) => ({
          filename: result.filename,
          documentId: result.document_id,
          sizeBytes: result.size_bytes,
          status: result.status === "failed" ? "failed" : "uploaded",
          detail: result.detail,
        })
      );

      setItems(uploadedItems);

      for (const item of uploadedItems) {
        if (item.status !== "failed" && item.documentId) {
          await runPipeline(item);
        }
      }
    } catch (error) {
      setItems((current) =>
        current.map((item) => ({
          ...item,
          status: "failed",
          detail:
            error instanceof Error
              ? error.message
              : "Unexpected upload error.",
        }))
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
            <UploadCloud className="h-7 w-7" />
          </div>

          <div>
            <h2 className="text-2xl font-black text-slate-950">
              Upload documents
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Add PDFs, text files, and images. The system prepares them for chat automatically.
            </p>
          </div>
        </div>

        <label className="mt-6 flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-cyan-200 bg-cyan-50/50 p-6 text-center transition hover:border-cyan-300 hover:bg-cyan-50">
          <FileUp className="h-14 w-14 text-cyan-600" />

          <p className="mt-4 text-xl font-black text-slate-950">
            Select multiple documents
          </p>

          <p className="mt-2 max-w-md text-sm font-medium leading-6 text-slate-600">
            Supported formats: PDF, TXT, PNG, JPG, and JPEG.
          </p>

          <input
            className="hidden"
            type="file"
            multiple
            accept=".pdf,.txt,.png,.jpg,.jpeg,application/pdf,text/plain,image/png,image/jpeg"
            onChange={(event) => {
              const files = Array.from(event.target.files || []);
              setSelectedFiles(files);
              setItems([]);
            }}
          />
        </label>

        <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-black text-slate-950">Selected files</p>

          {selectedFiles.length === 0 ? (
            <p className="mt-2 text-sm font-medium text-slate-500">
              No files selected yet.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {selectedFiles.map((file) => (
                <div
                  key={`${file.name}-${file.size}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <span className="truncate font-bold text-slate-800">
                    {file.name}
                  </span>

                  <span className="shrink-0 font-medium text-slate-500">
                    {formatBytes(file.size)}
                  </span>
                </div>
              ))}

              <div className="pt-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Total size: {formatBytes(totalSelectedSize)}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleUpload}
          disabled={!canUpload}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing documents...
            </>
          ) : (
            <>
              <UploadCloud className="h-4 w-4" />
              Upload and prepare for chat
            </>
          )}
        </button>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-black text-slate-950">
              Preparation status
            </h3>

            <p className="mt-1 text-sm font-medium text-slate-500">
              Each document is securely uploaded, understood, and made ready for citation-backed chat.
            </p>
          </div>

          <ShieldCheck className="h-7 w-7 text-emerald-600" />
        </div>

        <div className="mt-5 space-y-3">
          {items.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm font-medium text-slate-500">
              Upload results will appear here.
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.filename}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-700 ring-1 ring-slate-200">
                        <FileText className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-black text-slate-950">
                          {item.filename}
                        </p>
                        <p className="mt-1 text-xs font-medium text-slate-500">
                          {formatBytes(item.sizeBytes)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.status === "indexed" ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : item.status === "failed" ? (
                      <XCircle className="h-5 w-5 text-red-600" />
                    ) : item.status !== "queued" && item.status !== "uploaded" ? (
                      <Loader2 className="h-5 w-5 animate-spin text-cyan-600" />
                    ) : null}

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${userStatusClass(
                        item.status
                      )}`}
                    >
                      {userStatusLabel(item.status)}
                    </span>
                  </div>
                </div>

                <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
                  {userDetail(item.status, item.detail)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}