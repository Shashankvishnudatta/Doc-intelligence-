"use client";

import Link from "next/link";
import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Database,
  ExternalLink,
  FileText,
  Loader2,
  MessageCircle,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Zap,
  Plus,
Trash2,
Clock3,
} from "lucide-react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

type Role = "user" | "assistant";

type ChatHistoryMessage = { role: Role; content: string };

type Citation = {
  document_id: string;
  document_name: string;
  page_number: number;
  source: string;
  page_image_url: string;
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

const demoQuestions = [
  "Which document contains financial data?",
  "Which document is highly sensitive?",
  "What does the access SOP say about interns?",
  "What does the RAG research report say about hallucination?",
];
const CHAT_STORAGE_KEY = "bfai_document_rag_chat_sessions_v1";

function buildPageImageUrl(pageImageUrl: string) {
  return pageImageUrl.startsWith("http")
    ? pageImageUrl
    : `${API_BASE_URL}${pageImageUrl}`;
}
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

function saveStoredSessions(sessions: ChatSession[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(sessions));
}

export default function ChatPage() {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [input, setInput] = useState("");
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const indexedDocuments = useMemo(
    () => documents.filter((doc) => doc.status === "indexed"),
    [documents]
  );

  const selectedDocument = useMemo(
    () => indexedDocuments.find((doc) => doc.id === selectedDocumentId) ?? null,
    [indexedDocuments, selectedDocumentId]
  );
  useEffect(() => {
  const storedSessions = loadStoredSessions();

  if (storedSessions.length > 0) {
    const sortedSessions = [...storedSessions].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    setSessions(sortedSessions);
    setActiveSessionId(sortedSessions[0].id);
    setMessages(sortedSessions[0].messages);
    setSelectedDocumentId(sortedSessions[0].selectedDocumentId || "");
    return;
  }

  const firstSession = createEmptySession();

  setSessions([firstSession]);
  setActiveSessionId(firstSession.id);
  setMessages([]);
  setSelectedDocumentId("");
}, []);

  useEffect(() => {
    async function fetchDocuments() {
      try {
        setDocumentsLoading(true);
        const response = await fetch(`${API_BASE_URL}/documents`);
        if (!response.ok) throw new Error("Failed to load documents.");
        const data = (await response.json()) as DocumentItem[];
        setDocuments(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load knowledge base.");
      } finally {
        setDocumentsLoading(false);
      }
    }
    fetchDocuments();
  }, []);
  useEffect(() => {
  if (!activeSessionId) {
    return;
  }

  setSessions((currentSessions) => {
    const now = new Date().toISOString();

    const updatedSessions = currentSessions.map((session) => {
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

    saveStoredSessions(updatedSessions);

    return updatedSessions;
  });
}, [messages, selectedDocumentId, activeSessionId]);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

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
  setSelectedDocumentId("");
}

function handleOpenSession(session: ChatSession) {
  setActiveSessionId(session.id);
  setMessages(session.messages);
  setSelectedDocumentId(session.selectedDocumentId || "");
  setInput("");
  setError(null);
}

function handleDeleteSession(sessionId: string) {
  setSessions((currentSessions) => {
    const remainingSessions = currentSessions.filter(
      (session) => session.id !== sessionId
    );

    if (remainingSessions.length === 0) {
      const freshSession = createEmptySession();
      saveStoredSessions([freshSession]);

      setActiveSessionId(freshSession.id);
      setMessages([]);
      setSelectedDocumentId("");
      setInput("");
      setError(null);

      return [freshSession];
    }

    saveStoredSessions(remainingSessions);

    if (sessionId === activeSessionId) {
      const nextSession = remainingSessions[0];

      setActiveSessionId(nextSession.id);
      setMessages(nextSession.messages);
      setSelectedDocumentId(nextSession.selectedDocumentId || "");
      setInput("");
      setError(null);
    }

    return remainingSessions;
  });
}

  return (
    <div className="flex h-screen w-full bg-[#f8f9fb] p-2 sm:p-4 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      <div className="mx-auto flex h-full w-full max-w-[1600px] overflow-hidden rounded-[2.5rem] border border-slate-200/60 bg-white shadow-2xl shadow-slate-200/50">
        
        {/* PREMIUM DARK SIDEBAR */}
        <aside className="relative flex w-[320px] flex-col bg-zinc-950 text-zinc-400">
          {/* Subtle noise texture overlay for high-end look */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
          
          <div className="relative z-10 flex h-full flex-col px-6 py-8">
            {/* Logo/Header */}
            <div className="flex items-center gap-3 text-white">
              <button
  type="button"
  onClick={handleNewChat}
  className="mt-8 flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-white px-4 py-3 text-sm font-bold text-zinc-950 transition hover:bg-indigo-500 hover:text-white"
>
  <span className="flex items-center gap-2">
    <Plus className="h-4 w-4" />
    New Chat
  </span>
  <ArrowRight className="h-4 w-4" />
</button>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
                <Zap className="h-5 w-5 fill-white text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold tracking-tight">Nexus AI</span>
                <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">Intelligence Node</span>
              </div>
            </div>

            <div className="mt-10 space-y-8 flex-1">
              <div className="space-y-3">
  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
    <Clock3 className="h-3.5 w-3.5" /> Previous Chats
  </label>

  <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
    {sessions.map((session) => (
      <div
        key={session.id}
        className={`group flex items-center gap-2 rounded-xl border px-3 py-2 transition ${
          activeSessionId === session.id
            ? "border-indigo-500 bg-indigo-500/10"
            : "border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900"
        }`}
      >
        <button
          type="button"
          onClick={() => handleOpenSession(session)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="truncate text-xs font-bold text-zinc-200">
            {session.title}
          </p>
          <p className="mt-0.5 text-[10px] font-medium text-zinc-600">
            {session.messages.length === 0
              ? "Empty chat"
              : `${session.messages.length} messages`}
          </p>
        </button>

        <button
          type="button"
          onClick={() => handleDeleteSession(session.id)}
          className="rounded-lg p-1.5 text-zinc-600 opacity-0 transition hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
          aria-label="Delete chat"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    ))}
  </div>
</div>
              {/* Context Selector */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <Database className="h-3.5 w-3.5" /> Data Source
                </label>
                <div className="relative">
                  <select
                    value={selectedDocumentId}
                    onChange={(e) => setSelectedDocumentId(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm font-medium text-zinc-200 outline-none transition hover:border-zinc-700 focus:border-indigo-500 focus:bg-zinc-900 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Global Knowledge Base</option>
                    {indexedDocuments.map((doc) => (
                      <option key={doc.id} value={doc.id}>{doc.original_filename}</option>
                    ))}
                  </select>
                  <Search className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                </div>
              </div>

              {/* Action Button */}
              <Link
                href="/upload"
                className="group flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:bg-white hover:text-zinc-950"
              >
                <span className="flex items-center gap-2">
                  <UploadCloud className="h-4 w-4 text-zinc-400 group-hover:text-zinc-950" />
                  Ingest Document
                </span>
                <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
              </Link>

              {/* Demo Prompts */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <Sparkles className="h-3.5 w-3.5" /> Telemetry Queries
                </label>
                <div className="flex flex-col gap-2">
                  {demoQuestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendQuestion(q)}
                      disabled={isLoading}
                      className="rounded-lg px-3 py-2 text-left text-sm font-medium text-zinc-400 transition hover:bg-zinc-900 hover:text-white disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer Shield */}
            <div className="mt-auto flex items-center gap-3 rounded-2xl border border-emerald-900/30 bg-emerald-950/20 p-4">
              <ShieldCheck className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-xs font-bold text-emerald-400">Secure RAG Active</p>
                <p className="text-[10px] font-medium text-emerald-600/80 mt-0.5">Zero-hallucination guardrails enabled.</p>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN WORKSPACE */}
        <main className="relative flex min-w-0 flex-1 flex-col bg-white">
          
          {/* Subtle Top Header */}
          <header className="absolute inset-x-0 top-0 z-10 flex h-16 items-center justify-between bg-white/80 px-8 backdrop-blur-md">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
              {selectedDocument ? (
                <>
                  <FileText className="h-4 w-4 text-indigo-500" />
                  Extracting from: <span className="text-slate-900">{selectedDocument.original_filename}</span>
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 text-slate-400" />
                  Querying entire knowledge base ({indexedDocuments.length} files)
                </>
              )}
            </div>
          </header>

          {/* Chat Stream */}
          <div className="flex-1 overflow-y-auto px-4 pb-40 pt-24 sm:px-8">
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
                  Upload documents to the intelligence node, and ask questions. I will parse the data and cite exact pages instantly.
                </p>
              </div>
            ) : (
              <div className="mx-auto w-full max-w-4xl space-y-10">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`group relative max-w-[85%] rounded-3xl px-6 py-5 ${
                        msg.role === "user" 
                        ? "bg-slate-900 text-white shadow-xl shadow-slate-900/10" 
                        : "bg-slate-50 border border-slate-100 text-slate-800"
                      }`}
                    >
                      {msg.role === "assistant" && (
                        <div className="absolute -left-12 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 border border-indigo-100 hidden sm:flex">
                          <Bot className="h-4 w-4 text-indigo-600" />
                        </div>
                      )}
                      
                      <div className="prose prose-sm md:prose-base prose-slate max-w-none leading-relaxed">
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
      Used {msg.retrieved_context_count} source chunk
      {msg.retrieved_context_count === 1 ? "" : "s"}
    </span>
  )}
                          </div>

                          {msg.citations && msg.citations.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                              {msg.citations.map((cite, i) => (
                                <a 
                                  key={i} 
                                  href={buildPageImageUrl(cite.page_image_url)} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
                                >
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 text-indigo-600">
                                    <FileText className="h-5 w-5" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-bold text-slate-900">{cite.document_name}</p>
                                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">Page {cite.page_number}</p>
                                  </div>
                                  <ExternalLink className="h-4 w-4 text-slate-300 mr-1" />
                                </a>
                              ))}
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
            <div className="mx-auto max-w-4xl px-4 sm:px-8">
              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-600 border border-red-100">
                  <AlertCircle className="h-4 w-4" /> {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="relative flex flex-col rounded-[2rem] border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-200/50 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder="Ask the intelligence node..."
                  className="max-h-40 min-h-[56px] w-full resize-none bg-transparent px-5 py-4 text-base font-medium text-slate-900 outline-none placeholder:text-slate-400"
                />
                <div className="flex items-center justify-between px-3 pb-2 pt-2 border-t border-slate-50">
                  <div className="flex gap-2">
                     <div className="rounded-lg bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                       Cmd ⌘ + Enter to send
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
    </div>
  );
}