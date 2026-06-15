"use client";

import { type MouseEvent, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bot,
  Database,
  Home,
  MessageSquare,
  Plus,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Zap,
} from "lucide-react";

const navItems = [
  {
    href: "/",
    label: "Overview",
    icon: Home,
  },
  {
    href: "/chat",
    label: "Chat",
    icon: Bot,
  },
  {
    href: "/upload",
    label: "Upload",
    icon: UploadCloud,
  },
  {
    href: "/documents",
    label: "Knowledge Base",
    icon: Database,
  },
];

type ChatSession = {
  id: string;
  title: string;
  messages: unknown[];
  selectedDocumentId: string;
  createdAt: string;
  updatedAt: string;
};

const CHAT_STORAGE_KEY = "bfai_document_rag_chat_sessions_v1";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  function handleNewChatClick() {
    if (pathname === "/chat") {
      window.dispatchEvent(new Event("bfai:new-chat"));
      return;
    }

    window.localStorage.setItem("bfai_open_new_chat_on_load", "true");
    router.push("/chat");
  }

  function loadSessionsFromStorage() {
    try {
      const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);

      if (!raw) {
        setSessions([]);
        return;
      }

      const parsed = JSON.parse(raw) as ChatSession[];

      if (!Array.isArray(parsed)) {
        setSessions([]);
        return;
      }

      const sorted = [...parsed].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      setSessions(sorted);
    } catch {
      setSessions([]);
    }
  }

  function handleDeleteSession(
    event: MouseEvent<HTMLButtonElement>,
    sessionId: string
  ) {
    event.stopPropagation();

    try {
      const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as ChatSession[]) : [];
      const sessionsToKeep = Array.isArray(parsed)
        ? parsed.filter((session) => session.id !== sessionId)
        : [];

      window.localStorage.setItem(
        CHAT_STORAGE_KEY,
        JSON.stringify(sessionsToKeep)
      );

      setSessions(
        [...sessionsToKeep].sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
      );

      window.setTimeout(() => {
        window.dispatchEvent(new Event("bfai:chat-sessions-updated"));
        window.dispatchEvent(
          new CustomEvent("bfai:delete-chat-session", {
            detail: { sessionId },
          })
        );
      }, 0);
    } catch {
      loadSessionsFromStorage();
    }
  }

  useEffect(() => {
  queueMicrotask(() => {
    loadSessionsFromStorage();
  });

  function handleStorageUpdate() {
    loadSessionsFromStorage();
  }

  window.addEventListener("storage", handleStorageUpdate);
  window.addEventListener("bfai:chat-sessions-updated", handleStorageUpdate);

  return () => {
    window.removeEventListener("storage", handleStorageUpdate);
    window.removeEventListener(
      "bfai:chat-sessions-updated",
      handleStorageUpdate
    );
  };
}, []);

  return (
    <aside className="relative hidden h-screen w-[320px] shrink-0 overflow-hidden bg-zinc-950 text-zinc-400 lg:flex">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.22),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(6,182,212,0.16),transparent_30%)]" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />

      <div className="relative z-10 flex h-full w-full flex-col px-6 py-7">
        <div className="flex items-center gap-3 text-white">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25">
            <Zap className="h-5 w-5 fill-white text-white" />
          </div>

          <div>
            <p className="text-base font-black tracking-tight">Nexus AI</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">
              Intelligence Node
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleNewChatClick}
          className="mt-8 flex w-full items-center justify-between rounded-xl bg-white px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-indigo-500 hover:text-white"
        >
          <span className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Chat
          </span>
          <MessageSquare className="h-4 w-4" />
        </button>

        <nav className="mt-8 space-y-2">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-zinc-600">
            Workspace
          </p>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition ${
                  isActive
                    ? "bg-indigo-500/15 text-white ring-1 ring-indigo-500/50"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-7 space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-600">
            Previous Chats
          </p>

          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {sessions.length === 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-3 py-3 text-xs font-semibold text-zinc-600">
                No chats yet.
              </div>
            ) : (
              sessions.slice(0, 8).map((session) => (
                <div
                  key={session.id}
                  className="group flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/30 px-3 py-2 transition hover:border-indigo-500 hover:bg-indigo-500/10"
                >
                  <button
                    type="button"
                    onClick={() => {
                      window.localStorage.setItem(
                        "bfai_open_chat_session_id",
                        session.id
                      );

                      if (pathname === "/chat") {
                        window.dispatchEvent(
                          new CustomEvent("bfai:open-chat-session", {
                            detail: {
                              sessionId: session.id,
                            },
                          })
                        );
                      } else {
                        router.push("/chat");
                      }
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-xs font-black text-zinc-200">
                      {session.title}
                    </p>
                    <p className="mt-0.5 text-[10px] font-semibold text-zinc-600">
                      {session.messages.length === 0
                        ? "Empty chat"
                        : `${session.messages.length} messages`}
                    </p>
                  </button>

                  <button
                    type="button"
                    title="Delete chat"
                    aria-label={`Delete chat ${session.title}`}
                    onClick={(event) => handleDeleteSession(event, session.id)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-600 opacity-80 transition hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-auto rounded-2xl border border-emerald-900/40 bg-emerald-950/25 p-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-7 w-7 text-emerald-400" />
            <div>
              <p className="text-xs font-black text-emerald-400">
                Secure RAG Active
              </p>
              <p className="mt-0.5 text-[10px] font-semibold text-emerald-700">
                Citation-first guardrails enabled.
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
