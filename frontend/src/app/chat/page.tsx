"use client";

/* eslint-disable @next/next/no-img-element */

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  FileText,
  Loader2,
  Search,
  Send,
  Plus,
  ChevronDown,
  ImageIcon,
  UploadCloud,
} from "lucide-react";
import {
  classifyDocument,
  getApiAssetUrl,
  indexDocument,
  parseDocument,
  uploadDocuments,
} from "@/lib/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

type Role = "user" | "assistant";

type ChatHistoryMessage = { role: Role; content: string };

type Citation = {
  document_id?: string | null;
  document_name: string;
  page_number: number;
  source?: string | null;
  text?: string | null;
  page_image_url?: string | null;
};

type ChatApiResponse = {
  answer: string;
  citations: Citation[];
  retrieved_context_count: number;
  grounded: boolean;
};

type DocumentItem = {
  id: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  status: string;
  page_count: number;
  classification_json?: string | null;
  error_message?: string | null;
};

type UiMessage = {
  id: string;
  role: Role;
  content: string;
  citations?: Citation[];
  retrieved_context_count?: number;
  grounded?: boolean;
};

type ChatSession = {
  id: string;
  title: string;
  messages: UiMessage[];
  selectedDocumentId: string;
  createdAt: string;
  updatedAt: string;
};

const CHAT_STORAGE_KEY = "bfai_document_rag_chat_sessions_v1";
const CHAT_UPLOAD_DOCUMENT_ACCEPT =
  ".pdf,.txt,.png,.jpg,.jpeg,.webp,application/pdf,text/plain,image/png,image/jpeg,image/webp";
const CHAT_UPLOAD_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";

function createEmptySession(): ChatSession {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    title: "New document chat",
    messages: [],
    selectedDocumentId: "",
    createdAt: now,
    updatedAt: now,
  };
}

function buildChatTitle(question: string) {
  const cleaned = question.trim().replace(/\s+/g, " ");

  if (!cleaned) {
    return "New document chat";
  }

  if (cleaned.length <= 42) {
    return cleaned;
  }

  return `${cleaned.slice(0, 42).trim()}...`;
}

function isAllowedStatus(status: string, allowed: string[]) {
  return allowed.includes(status.toLowerCase());
}

function assertDocumentStage(
  document: DocumentItem,
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

function assertIndexStage(indexResult: { status: string; error_message?: string | null }) {
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

function loadStoredSessions(): ChatSession[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as ChatSession[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed;
  } catch {
    return [];
  }
}

// Fix 1 — React Sidebar warning
function saveStoredSessions(sessions: ChatSession[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(sessions));

  window.setTimeout(() => {
    window.dispatchEvent(new Event("bfai:chat-sessions-updated"));
  }, 0);
}

export default function ChatPage() {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [input, setInput] = useState("");
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setDocumentsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [chatUploadAccept, setChatUploadAccept] = useState(
    CHAT_UPLOAD_DOCUMENT_ACCEPT
  );
  const [isChatUploading, setIsChatUploading] = useState(false);
  const [chatUploadStatus, setChatUploadStatus] = useState<string | null>(null);
  
  const [previewCitation, setPreviewCitation] = useState<Citation | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatUploadInputRef = useRef<HTMLInputElement | null>(null);
  const attachMenuRef = useRef<HTMLDivElement | null>(null);

  const indexedDocuments = useMemo(
    () => documents.filter((doc) => doc.status === "indexed"),
    [documents]
  );

  const selectedDocument = useMemo(
    () => indexedDocuments.find((doc) => doc.id === selectedDocumentId) ?? null,
    [indexedDocuments, selectedDocumentId]
  );

  const fetchDocuments = useCallback(async () => {
    try {
      setDocumentsLoading(true);
      const response = await fetch(`${API_BASE_URL}/documents`);
      if (!response.ok) throw new Error("Failed to load documents.");
      const data = (await response.json()) as DocumentItem[];
      setDocuments(data);
      return data;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load knowledge base."
      );
      return [];
    } finally {
      setDocumentsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      const pendingDocumentId = window.localStorage.getItem(
        "bfai_pending_document_id"
      );

      if (pendingDocumentId) {
        window.localStorage.removeItem("bfai_pending_document_id");
      }

      const storedSessions = loadStoredSessions();

      if (storedSessions.length > 0) {
        const sortedSessions = [...storedSessions].sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        setSessions(sortedSessions);
        setActiveSessionId(sortedSessions[0].id);
        setMessages(sortedSessions[0].messages);
        setSelectedDocumentId(
          pendingDocumentId || sortedSessions[0].selectedDocumentId || ""
        );
        return;
      }

      const firstSession = createEmptySession();

      setSessions([firstSession]);
      setActiveSessionId(firstSession.id);
      setMessages([]);
      setSelectedDocumentId(pendingDocumentId || "");
    });
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      fetchDocuments();
    });
  }, [fetchDocuments]);

  // Fix 2 — Clean the auto-save useEffect
  useEffect(() => {
    if (!activeSessionId) {
      return;
    }

    const storedSessions = loadStoredSessions();
    const now = new Date().toISOString();

    const updatedSessions = storedSessions.map((session) => {
      if (session.id !== activeSessionId) {
        return session;
      }

      return {
        ...session,
        messages,
        selectedDocumentId,
        title:
          session.title === "New document chat" && messages.length > 0
            ? buildChatTitle(messages[0].content)
            : session.title,
        updatedAt: now,
      };
    });

    const sessionExists = updatedSessions.some(
      (session) => session.id === activeSessionId
    );

    const finalSessions = sessionExists
      ? updatedSessions
      : [
          {
            id: activeSessionId,
            title:
              messages.length > 0
                ? buildChatTitle(messages[0].content)
                : "New document chat",
            messages,
            selectedDocumentId,
            createdAt: now,
            updatedAt: now,
          },
          ...storedSessions,
        ];

    const sortedSessions = [...finalSessions].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    saveStoredSessions(sortedSessions);
  }, [messages, selectedDocumentId, activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isAttachMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (
        attachMenuRef.current &&
        event.target instanceof Node &&
        attachMenuRef.current.contains(event.target)
      ) {
        return;
      }

      setIsAttachMenuOpen(false);
    }

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setIsAttachMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isAttachMenuOpen]);

  async function sendQuestion(questionOverride?: string) {
    const question = (questionOverride ?? input).trim();
    if (!question || isLoading) return;

    const userMessage: UiMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
    };

    const conversationHistory: ChatHistoryMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          conversation_history: conversationHistory,
          top_k: 5,
          document_id: selectedDocumentId || null,
        }),
      });

      if (!response.ok) throw new Error(await response.text() || "Chat request failed.");

      const data = (await response.json()) as ChatApiResponse;

      const assistantMessage: UiMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.answer,
        citations: data.citations,
        retrieved_context_count: data.retrieved_context_count,
        grounded: data.grounded,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "System error.");
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Connection to the intelligence engine failed. Please check backend logs.",
          grounded: false,
          citations: [],
          retrieved_context_count: 0,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendQuestion();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendQuestion();
    }
  }

  function openChatUploadPicker(accept: string) {
    setChatUploadAccept(accept);
    setIsAttachMenuOpen(false);

    window.setTimeout(() => {
      chatUploadInputRef.current?.click();
    }, 0);
  }

  async function handleChatUploadFiles(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file || isChatUploading) {
      event.target.value = "";
      return;
    }

    setError(null);
    setIsChatUploading(true);
    setChatUploadStatus(`Uploading ${file.name}...`);

    try {
      const uploadResponse = await uploadDocuments([file]);
      const uploadResult = uploadResponse.results[0];
      const uploadError = uploadResult as {
        detail?: string | null;
        error_message?: string | null;
      };

      if (
        !uploadResult ||
        uploadResult.status !== "uploaded" ||
        !uploadResult.document_id
      ) {
        throw new Error(
          uploadError?.error_message ||
            uploadError?.detail ||
            "Upload failed before parsing started."
        );
      }

      const documentId = uploadResult.document_id;

      setChatUploadStatus("Parsing document...");
      const parsedDocument = await parseDocument(documentId);
      assertDocumentStage(
        parsedDocument,
        ["parsed", "classified", "indexed"],
        "Parsing"
      );

      setChatUploadStatus("Classifying document...");
      const classifiedDocument = await classifyDocument(documentId);
      assertDocumentStage(
        classifiedDocument,
        ["classified", "indexed"],
        "Classification"
      );

      setChatUploadStatus("Indexing document...");
      const indexedDocument = await indexDocument(documentId);
      assertIndexStage(indexedDocument);

      const refreshedDocuments = await fetchDocuments();
      const indexedReadyDocument: DocumentItem = {
        ...classifiedDocument,
        status: "indexed",
      };
      const readyDocument =
        refreshedDocuments.find((document) => document.id === documentId) ??
        indexedReadyDocument;

      setDocuments((currentDocuments) => {
        if (currentDocuments.some((document) => document.id === documentId)) {
          return currentDocuments.map((document) =>
            document.id === documentId ? readyDocument : document
          );
        }

        return [readyDocument, ...currentDocuments];
      });
      setSelectedDocumentId(documentId);
      setError(null);
      setChatUploadStatus(
        `Ready: ${readyDocument.original_filename || file.name} is selected.`
      );
    } catch (err) {
      setChatUploadStatus(null);
      setError(
        err instanceof Error
          ? err.message
          : "Upload failed. Please try again."
      );
    } finally {
      setIsChatUploading(false);
      event.target.value = "";
    }
  }

  function handleNewChat() {
    const newSession = createEmptySession();

    setSessions((currentSessions) => {
      const updatedSessions = [newSession, ...currentSessions];
      saveStoredSessions(updatedSessions);
      return updatedSessions;
    });

    setActiveSessionId(newSession.id);
    setMessages([]);
    setInput("");
    setError(null);
    setChatUploadStatus(null);
    setIsAttachMenuOpen(false);
    setSelectedDocumentId("");
  }

  useEffect(() => {
    function handleExternalNewChat() {
      handleNewChat();
    }

    window.addEventListener("bfai:new-chat", handleExternalNewChat);

    const shouldOpenNewChat = window.localStorage.getItem(
      "bfai_open_new_chat_on_load"
    );

    if (shouldOpenNewChat === "true") {
      window.localStorage.removeItem("bfai_open_new_chat_on_load");

      queueMicrotask(() => {
        handleNewChat();
      });
    }

    return () => {
      window.removeEventListener("bfai:new-chat", handleExternalNewChat);
    };
  }, []);

  const handleOpenSession = useCallback((session: ChatSession) => {
    setActiveSessionId(session.id);
    setMessages(session.messages);
    setSelectedDocumentId(session.selectedDocumentId || "");
    setInput("");
    setError(null);
    setChatUploadStatus(null);
    setIsAttachMenuOpen(false);
  }, []);

  const openSessionById = useCallback(
    (sessionId: string) => {
      const storedSessions = loadStoredSessions();
      const matchingSession = storedSessions.find(
        (session) => session.id === sessionId
      );

      if (!matchingSession) {
        return;
      }

      handleOpenSession(matchingSession);
    },
    [handleOpenSession]
  );

  useEffect(() => {
    function handleExternalOpenSession(event: Event) {
      const customEvent = event as CustomEvent<{ sessionId: string }>;

      if (!customEvent.detail?.sessionId) {
        return;
      }

      openSessionById(customEvent.detail.sessionId);
    }

    window.addEventListener("bfai:open-chat-session", handleExternalOpenSession);

    const pendingSessionId = window.localStorage.getItem(
      "bfai_open_chat_session_id"
    );

    if (pendingSessionId) {
      window.localStorage.removeItem("bfai_open_chat_session_id");

      queueMicrotask(() => {
        openSessionById(pendingSessionId);
      });
    }

    return () => {
      window.removeEventListener(
        "bfai:open-chat-session",
        handleExternalOpenSession
      );
    };
  }, [openSessionById]);

  useEffect(() => {
    function handleDeletedSession(event: Event) {
      const customEvent = event as CustomEvent<{ sessionId: string }>;
      const deletedSessionId = customEvent.detail?.sessionId;

      if (!deletedSessionId) {
        return;
      }

      const remainingSessions = [...loadStoredSessions()].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      if (deletedSessionId !== activeSessionId) {
        setSessions(remainingSessions);
        return;
      }

      if (remainingSessions.length > 0) {
        const nextSession = remainingSessions[0];

        setSessions(remainingSessions);
        setActiveSessionId(nextSession.id);
        setMessages(nextSession.messages);
        setInput("");
        setError(null);
        setChatUploadStatus(null);
        setIsAttachMenuOpen(false);
        setSelectedDocumentId(nextSession.selectedDocumentId || "");
        return;
      }

      const newSession = createEmptySession();

      setSessions([newSession]);
      saveStoredSessions([newSession]);
      setActiveSessionId(newSession.id);
      setMessages([]);
      setInput("");
      setError(null);
      setChatUploadStatus(null);
      setIsAttachMenuOpen(false);
      setSelectedDocumentId("");
    }

    window.addEventListener("bfai:delete-chat-session", handleDeletedSession);

    return () => {
      window.removeEventListener(
        "bfai:delete-chat-session",
        handleDeletedSession
      );
    };
  }, [activeSessionId]);

  return (
    <div className="h-[100dvh] w-full overflow-hidden p-4 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      <div className="flex h-full w-full overflow-hidden rounded-[2rem] border border-white/70 bg-white/70 shadow-2xl shadow-slate-300/50 backdrop-blur-xl">
        {/* MAIN WORKSPACE */}
        <main className="relative flex min-w-0 flex-1 flex-col bg-white/70">
          
          {/* Subtle Top Header */}
          <header className="absolute inset-x-0 top-0 z-10 flex min-h-16 flex-col gap-3 bg-white/75 px-4 py-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-500">
              {selectedDocument ? (
                <>
                  <FileText className="h-4 w-4 shrink-0 text-indigo-500" />
                  <span className="shrink-0">Extracting from:</span>
                  <span className="truncate text-slate-900">
                    {selectedDocument.original_filename}
                  </span>
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="truncate">
                    Querying entire knowledge base ({indexedDocuments.length} files)
                  </span>
                </>
              )}
            </div>

            <label className="relative w-full sm:w-80">
              <span className="sr-only">Select document scope</span>
              <select
                value={selectedDocumentId || "all"}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedDocumentId(value === "all" ? "" : value);
                }}
                className="h-11 w-full appearance-none truncate rounded-2xl border border-slate-200 bg-white/90 px-4 pr-10 text-sm font-bold text-slate-700 shadow-sm outline-none transition hover:border-indigo-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
              >
                <option value="all">All documents</option>
                {indexedDocuments.map((document) => (
                  <option key={document.id} value={document.id}>
                    {document.original_filename}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </label>
          </header>

          {/* Chat Stream */}
          <div className="flex-1 overflow-y-auto px-4 pb-40 pt-32 sm:px-8">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
                <div className="relative mb-8 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-slate-100 bg-white shadow-2xl shadow-indigo-500/10">
                  <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-tr from-indigo-50 to-violet-50 opacity-50"></div>
                  <Bot className="relative h-10 w-10 text-indigo-600" />
                </div>
                <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
                  What do you need to know?
                </h2>
                <p className="mt-3 max-w-lg text-center text-base font-medium text-slate-500">
                  Ask about your selected document or search across the knowledge base. Answers include source citations.
                </p>
              </div>
            ) : (
             <div className="mx-auto w-full max-w-5xl space-y-10">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`group relative max-w-[85%] rounded-3xl px-6 py-5 ${
                        msg.role === "user"
                          ? "bg-slate-950 text-white shadow-xl shadow-slate-950/20"
                          : "border border-slate-100 bg-slate-50 text-slate-800"
                      }`}
                    >
                      {msg.role === "assistant" && (
                        <div className="absolute -left-12 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 border border-indigo-100 hidden sm:flex">
                          <Bot className="h-4 w-4 text-indigo-600" />
                        </div>
                      )}
                      
                      <div
                        className={`whitespace-pre-wrap text-sm font-semibold leading-7 ${
                          msg.role === "user" ? "text-white" : "text-slate-800"
                        }`}
                      >
                        {msg.content}
                      </div>
                      
                      {/* Premium Citation Cards */}
                      {msg.role === "assistant" && (
                        <div className="mt-6 pt-5 border-t border-slate-200">
                          <div className="flex items-center gap-4 mb-4">
                            {msg.grounded ? (
                               <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                                 <CheckCircle2 className="h-3.5 w-3.5" /> Fact Checked
                               </span>
                            ) : (
                              <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-700">
                                 <AlertCircle className="h-3.5 w-3.5" /> Unverified
                               </span>
                            )}
                            
                            {typeof msg.retrieved_context_count === "number" &&
                              msg.retrieved_context_count > 0 && (
                                <span className="text-xs font-semibold text-slate-400">
                                  {msg.retrieved_context_count} Verified source{msg.retrieved_context_count === 1 ? "" : "s"}
                                </span>
                              )}
                          </div>

                          {msg.citations && msg.citations.length > 0 && (
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              {msg.citations.map((citation, citationIndex) => {
                                const imageUrl = getApiAssetUrl(citation.page_image_url);

                                return (
                                  <button
                                    key={`${citation.document_id}-${citation.page_number}-${citationIndex}`}
                                    type="button"
                                    onClick={() => setPreviewCitation(citation)}
                                    className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                                  >
                                    <div className="flex gap-3 p-3">
                                      <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                                        {imageUrl ? (
                                          <img
                                            src={imageUrl}
                                            alt={`${citation.document_name} page ${citation.page_number}`}
                                            className="h-full w-full object-cover transition group-hover:scale-105"
                                            loading="lazy"
                                          />
                                        ) : (
                                          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-400">
                                            Page
                                          </div>
                                        )}
                                      </div>

                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-black text-slate-950">
                                          {citation.document_name}
                                        </p>

                                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
                                          Page {citation.page_number}
                                        </p>

                                        {citation.text && (
                                          <p className="mt-2 line-clamp-3 text-xs font-medium leading-5 text-slate-500">
                                            {citation.text}
                                          </p>
                                        )}

                                        <p className="mt-2 text-xs font-black text-slate-400">
                                          Click to preview source page
                                        </p>
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="flex max-w-[85%] items-center gap-3 rounded-3xl border border-slate-100 bg-slate-50 px-6 py-5 text-sm font-semibold text-slate-500">
                      <div className="flex gap-1">
                        <span className="h-2 w-2 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="h-2 w-2 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="h-2 w-2 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                      Retrieving sources and composing grounded answer...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* FLOATING COMMAND PALETTE (INPUT) */}
          <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-white via-white to-transparent pb-8 pt-10">
           <div className="mx-auto w-full max-w-5xl px-4 sm:px-8">
              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-600 border border-red-100">
                  <AlertCircle className="h-4 w-4" /> {error}
                </div>
              )}
              {chatUploadStatus && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs font-bold text-indigo-700">
                  {isChatUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {chatUploadStatus}
                </div>
              )}
              <form onSubmit={handleSubmit} className="relative flex flex-col rounded-[2rem] border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-200/50 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all">
                <div className="flex items-start w-full">
                  <div ref={attachMenuRef} className="relative ml-2 mt-2 shrink-0">
                    <button
                      type="button"
                      title="Attach documents"
                      aria-expanded={isAttachMenuOpen}
                      aria-haspopup="menu"
                      disabled={isChatUploading}
                      onClick={() => setIsAttachMenuOpen((open) => !open)}
                      className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isChatUploading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Plus className="h-5 w-5" />
                      )}
                    </button>

                    {isAttachMenuOpen && (
                      <div
                        role="menu"
                        className="absolute bottom-12 left-0 z-30 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-2xl shadow-slate-300/50 backdrop-blur-xl"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() =>
                            openChatUploadPicker(CHAT_UPLOAD_DOCUMENT_ACCEPT)
                          }
                          className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50"
                        >
                          <UploadCloud className="mt-0.5 h-4 w-4 text-indigo-600" />
                          <span>
                            <span className="block text-sm font-black text-slate-900">
                              Upload document
                            </span>
                            <span className="mt-0.5 block text-xs font-semibold text-slate-500">
                              PDF, TXT, PNG, JPG, JPEG, or WEBP
                            </span>
                          </span>
                        </button>

                        <button
                          type="button"
                          role="menuitem"
                          onClick={() =>
                            openChatUploadPicker(CHAT_UPLOAD_IMAGE_ACCEPT)
                          }
                          className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50"
                        >
                          <ImageIcon className="mt-0.5 h-4 w-4 text-indigo-600" />
                          <span>
                            <span className="block text-sm font-black text-slate-900">
                              Upload image
                            </span>
                            <span className="mt-0.5 block text-xs font-semibold text-slate-500">
                              Use image OCR and Gemini Vision
                            </span>
                          </span>
                        </button>
                      </div>
                    )}

                    <input
                      ref={chatUploadInputRef}
                      type="file"
                      accept={chatUploadAccept}
                      className="hidden"
                      onChange={handleChatUploadFiles}
                    />
                  </div>
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    placeholder="Ask your documents..."
                    className="max-h-40 min-h-[56px] w-full resize-none bg-transparent px-5 py-4 text-base font-medium text-slate-900 outline-none placeholder:text-slate-400"
                  />
                </div>
                <div className="flex items-center justify-between px-3 pb-2 pt-2 border-t border-slate-50">
                  <div className="flex gap-2">
                     <div className="rounded-lg bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                       ENTER TO SEND | SHIFT + ENTER FOR NEW LINE
                     </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white transition hover:bg-indigo-600 disabled:opacity-30 disabled:hover:bg-slate-900"
                  >
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 ml-0.5" />}
                  </button>
                </div>
              </form>
            </div>
          </div>

        </main>
      </div>

      {previewCitation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-6 backdrop-blur-sm">
          <div className="flex max-h-[90dvh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-white/20 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-950">
                  {previewCitation.document_name}
                </p>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
                  Page {previewCitation.page_number}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPreviewCitation(null)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-black text-slate-600 transition hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-5">
              <img
                src={getApiAssetUrl(previewCitation.page_image_url)}
                alt={`${previewCitation.document_name} page ${previewCitation.page_number}`}
                className="mx-auto max-h-none w-full max-w-4xl rounded-2xl border border-slate-200 bg-white object-contain shadow-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
