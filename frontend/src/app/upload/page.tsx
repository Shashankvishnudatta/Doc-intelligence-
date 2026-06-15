"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  FileUp,
  Loader2,
  MessageSquare,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  classifyDocument,
  indexDocument,
  parseDocument,
  uploadDocuments,
} from "@/lib/api";
import { formatBytes } from "@/lib/format";
import type { DocumentListItem, IndexResponse } from "@/types/api";

type UploadUiStatus =
  | "queued"
  | "uploading"
  | "uploaded"
  | "parsing"
  | "parsed"
  | "classifying"
  | "classified"
  | "indexing"
  | "indexed"
  | "failed";

type UploadItem = {
  local_id: string;
  filename: string;
  document_id: string | null;
  size_bytes: number | null;
  status: UploadUiStatus;
  error_message: string | null;
};

function isAllowedStatus(status: string, allowed: string[]) {
  return allowed.includes(status.toLowerCase());
}

function assertDocumentStage(
  document: DocumentListItem,
  allowedStatuses: string[],
  stageName: string
) {
  const currentStatus = String(document.status || "").toLowerCase();

  if (currentStatus === "failed") {
    throw new Error(
      document.error_message || `${stageName} failed on the backend.`
    );
  }

  if (!isAllowedStatus(currentStatus, allowedStatuses)) {
    throw new Error(
      `${stageName} did not complete correctly. Backend returned status: ${document.status}`
    );
  }
}

function assertIndexStage(indexResult: IndexResponse) {
  const currentStatus = String(indexResult.status || "").toLowerCase();

  if (currentStatus === "failed") {
    throw new Error(indexResult.error_message || "Indexing failed.");
  }

  if (currentStatus !== "indexed") {
    throw new Error(
      `Indexing did not complete correctly. Backend returned status: ${indexResult.status}`
    );
  }
}

function getProgressValue(status: UploadUiStatus | string) {
  const normalized = status.toLowerCase();

  if (normalized === "queued") return 5;
  if (normalized === "uploading") return 15;
  if (normalized === "uploaded") return 25;
  if (normalized === "parsing") return 40;
  if (normalized === "parsed") return 50;
  if (normalized === "classifying") return 65;
  if (normalized === "classified") return 75;
  if (normalized === "indexing") return 90;
  if (normalized === "indexed") return 100;
  if (normalized === "failed") return 100;

  return 10;
}

function getStatusLabel(status: UploadUiStatus | string) {
  const normalized = status.toLowerCase();

  if (normalized === "queued") return "Queued";
  if (normalized === "uploading") return "Uploading";
  if (normalized === "uploaded") return "Uploaded";
  if (normalized === "parsing") return "Parsing";
  if (normalized === "parsed") return "Parsed";
  if (normalized === "classifying") return "Classifying";
  if (normalized === "classified") return "Classified";
  if (normalized === "indexing") return "Indexing";
  if (normalized === "indexed") return "Ready";
  if (normalized === "failed") return "Failed";

  return status;
}

export default function UploadPage() {
  const router = useRouter();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadResults, setUploadResults] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const canUpload = selectedFiles.length > 0 && !isUploading;

  const readyDocuments = useMemo(() => {
    return uploadResults.filter(
      (result) => result.status === "indexed" && result.document_id
    );
  }, [uploadResults]);

  const hasReadyDocuments = readyDocuments.length > 0;

  const totalSelectedSize = useMemo(() => {
    return selectedFiles.reduce((sum, file) => sum + file.size, 0);
  }, [selectedFiles]);

  async function handleUploadAndPrepare() {
    if (selectedFiles.length === 0) {
      return;
    }

    setIsUploading(true);
    setUploadResults(
      selectedFiles.map((file, index) => ({
        local_id: `${file.name}-${file.size}-${index}`,
        filename: file.name,
        size_bytes: file.size,
        status: "queued",
        document_id: null,
        error_message: null,
      }))
    );

    try {
      setUploadResults((current) =>
        current.map((item) => ({
          ...item,
          status: "uploading",
        }))
      );

      const uploadResponse = await uploadDocuments(selectedFiles);

      for (let index = 0; index < uploadResponse.results.length; index++) {
  const uploadResult = uploadResponse.results[index];
  const selectedFile = selectedFiles[index];

  const localId = `${selectedFile?.name ?? uploadResult.filename}-${
    selectedFile?.size ?? 0
  }-${index}`;

        if (
          uploadResult.status !== "uploaded" ||
          !uploadResult.document_id
        ) {
          setUploadResults((current) =>
            current.map((item) =>
              item.local_id === localId
                ? {
                    ...item,
                    status: "failed",
                    error_message:
                      uploadResult.error_message ||
                      "Upload failed before parsing started.",
                  }
                : item
            )
          );

          continue;
        }

        const documentId = uploadResult.document_id;

        setUploadResults((current) =>
          current.map((item) =>
            item.local_id === localId
              ? {
                  ...item,
                  status: "uploaded",
                  document_id: documentId,
                  error_message: null,
                }
              : item
          )
        );

        try {
          setUploadResults((current) =>
            current.map((item) =>
              item.local_id === localId
                ? { ...item, status: "parsing" }
                : item
            )
          );

          const parsedDocument = await parseDocument(documentId);

          assertDocumentStage(
            parsedDocument,
            ["parsed", "classified", "indexed"],
            "Parsing"
          );

          setUploadResults((current) =>
            current.map((item) =>
              item.local_id === localId
                ? { ...item, status: "parsed", error_message: null }
                : item
            )
          );

          setUploadResults((current) =>
            current.map((item) =>
              item.local_id === localId
                ? { ...item, status: "classifying" }
                : item
            )
          );

          const classifiedDocument = await classifyDocument(documentId);

          assertDocumentStage(
            classifiedDocument,
            ["classified", "indexed"],
            "Classification"
          );

          setUploadResults((current) =>
            current.map((item) =>
              item.local_id === localId
                ? { ...item, status: "classified", error_message: null }
                : item
            )
          );

          setUploadResults((current) =>
            current.map((item) =>
              item.local_id === localId
                ? { ...item, status: "indexing" }
                : item
            )
          );

          const indexedDocument = await indexDocument(documentId);

          assertIndexStage(indexedDocument);

          setUploadResults((current) =>
            current.map((item) =>
              item.local_id === localId
                ? { ...item, status: "indexed", error_message: null }
                : item
            )
          );
        } catch (pipelineError) {
          setUploadResults((current) =>
            current.map((item) =>
              item.local_id === localId
                ? {
                    ...item,
                    status: "failed",
                    error_message:
                      pipelineError instanceof Error
                        ? pipelineError.message
                        : "Document preparation failed.",
                  }
                : item
            )
          );
        }
      }
    } catch (uploadError) {
      setUploadResults((current) =>
        current.map((item) => ({
          ...item,
          status: "failed",
          error_message:
            uploadError instanceof Error
              ? uploadError.message
              : "Upload failed.",
        }))
      );
    } finally {
      setIsUploading(false);
    }
  }

  function handleGoToChat() {
    const firstReadyDocument = readyDocuments[0];

    if (firstReadyDocument?.document_id) {
      window.localStorage.setItem(
        "bfai_pending_document_id",
        firstReadyDocument.document_id
      );
    }

    router.push("/chat");
  }

  return (
    <div className="h-[100dvh] w-full overflow-hidden p-6">
      <div className="grid h-full w-full grid-cols-1 gap-6 lg:grid-cols-[minmax(420px,0.9fr)_minmax(0,1.1fr)]">
        
        {/* Upload documents card */}
        <div className="flex min-h-0 flex-col rounded-[2rem] border border-white/70 bg-white/75 p-7 shadow-2xl shadow-slate-300/50 backdrop-blur-xl">
          <div className="flex items-center gap-4 shrink-0">
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

          <label className="mt-6 flex min-h-64 shrink-0 cursor-pointer flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-cyan-200 bg-cyan-50/50 p-6 text-center transition hover:border-cyan-300 hover:bg-cyan-50">
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
                setUploadResults([]);
              }}
            />
          </label>

          <div className="mt-5 flex-1 min-h-0 flex flex-col rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-950">Selected files</p>

            {selectedFiles.length === 0 ? (
              <p className="mt-2 text-sm font-medium text-slate-500">
                No files selected yet.
              </p>
            ) : (
              <div className="mt-3 flex-1 overflow-y-auto space-y-2 pr-2">
                {selectedFiles.map((file, index) => (
  <div
    key={`${file.name}-${file.size}-${index}`}
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
              </div>
            )}
            
            {selectedFiles.length > 0 && (
              <div className="pt-3 mt-auto shrink-0 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Total size: {formatBytes(totalSelectedSize)}
              </div>
            )}
          </div>

          <button
            onClick={handleUploadAndPrepare}
            disabled={!canUpload}
            className="mt-5 shrink-0 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
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

        {/* Preparation status card */}
        <div className="flex min-h-0 flex-col rounded-[2rem] border border-white/70 bg-white/75 p-7 shadow-2xl shadow-slate-300/50 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4 shrink-0">
            <div>
              <h3 className="text-2xl font-black text-slate-950">
                Preparation status
              </h3>

              <p className="mt-1 text-sm font-medium text-slate-500">
                Each document is securely uploaded, understood, and made ready for citation-backed chat.
              </p>
            </div>

            <ShieldCheck className="h-7 w-7 shrink-0 text-emerald-600" />
          </div>

          <div className="mt-6 min-h-0 flex-1 overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50/70">
            {uploadResults.length === 0 ? (
              <div className="p-6 text-sm font-semibold text-slate-500">
                Upload results will appear here.
              </div>
            ) : (
              uploadResults.map((result) => {
                const progress = getProgressValue(result.status);
                const isFailed = result.status === "failed";
                const isReady = result.status === "indexed";

                return (
                  <div
                    key={result.local_id}
                    className="border-b border-slate-100 px-5 py-4 last:border-b-0"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-950">
                          {result.filename}
                        </p>

                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {getStatusLabel(result.status)}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          isFailed
                            ? "bg-red-50 text-red-600"
                            : isReady
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-cyan-50 text-cyan-700"
                        }`}
                      >
                        {getStatusLabel(result.status)}
                      </span>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isFailed ? "bg-red-500" : "bg-cyan-500"
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    {result.error_message && (
                      <p className="mt-2 text-xs font-semibold leading-5 text-red-600">
                        {result.error_message}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {hasReadyDocuments && (
            <div className="mt-5 shrink-0 rounded-3xl border border-emerald-100 bg-emerald-50/70 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700 ring-1 ring-emerald-100">
                  <MessageSquare className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-slate-950">
                    Ready to ask questions?
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                    Your{" "}
                    {readyDocuments.length === 1
                      ? "document is"
                      : "documents are"}{" "}
                    indexed and ready for citation-backed chat.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoToChat}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-indigo-600"
              >
                Go to Chat
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
