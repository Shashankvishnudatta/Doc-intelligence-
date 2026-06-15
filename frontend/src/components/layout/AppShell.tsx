"use client";

import { PageNav } from "@/components/layout/PageNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type AppShellProps = {
  children: React.ReactNode;
};

const CHAT_SIDEBAR_STORAGE_KEY = "bfai_chat_sidebar_open";

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isChatPage = pathname === "/chat";
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    return window.localStorage.getItem(CHAT_SIDEBAR_STORAGE_KEY) !== "false";
  });

  useEffect(() => {
    window.localStorage.setItem(
      CHAT_SIDEBAR_STORAGE_KEY,
      String(isSidebarOpen)
    );
  }, [isSidebarOpen]);

  return (
    <div className="min-h-[100dvh] w-full bg-slate-50">
      {isChatPage ? (
        <div className="relative flex h-[100dvh] w-full overflow-hidden bg-slate-950">
          {isSidebarOpen && <Sidebar />}

          <button
            type="button"
            onClick={() => setIsSidebarOpen((value) => !value)}
            aria-label={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
            title={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
            className={`fixed top-4 z-[60] flex h-11 w-11 items-center justify-center rounded-2xl border border-white/70 bg-white/90 text-slate-700 shadow-lg shadow-slate-950/10 backdrop-blur-xl transition-all duration-300 hover:bg-slate-950 hover:text-white ${
              isSidebarOpen ? "left-4 lg:left-[336px]" : "left-4"
            }`}
          >
            <Menu className="h-5 w-5" />
          </button>

          <main className="relative min-w-0 flex-1 overflow-y-auto bg-slate-50">
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
              <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-cyan-300/25 blur-3xl" />
              <div className="absolute right-0 top-0 h-[32rem] w-[32rem] rounded-full bg-indigo-300/20 blur-3xl" />
              <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-violet-200/20 blur-3xl" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.08)_1px,transparent_0)] [background-size:28px_28px]" />
            </div>

            <div className="relative z-10 min-h-full">{children}</div>
          </main>
        </div>
      ) : (
        <main className="relative min-h-[100dvh] w-full overflow-y-auto bg-slate-50">
          <div className="pointer-events-none fixed inset-0 overflow-hidden">
            <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-cyan-300/25 blur-3xl" />
            <div className="absolute right-0 top-0 h-[32rem] w-[32rem] rounded-full bg-indigo-300/20 blur-3xl" />
            <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-violet-200/20 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.08)_1px,transparent_0)] [background-size:28px_28px]" />
          </div>

          <PageNav />

          <div className="relative z-10 min-h-full pt-28 sm:pt-24">
            {children}
          </div>
        </main>
      )}
    </div>
  );
}

export default AppShell;
