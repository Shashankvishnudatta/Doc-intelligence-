"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Database, Home, UploadCloud } from "lucide-react";

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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="soft-grid min-h-screen text-slate-950">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-10%] top-[-12%] h-96 w-96 rounded-full bg-cyan-200/35 blur-3xl" />
        <div className="absolute right-[-8%] top-[-10%] h-96 w-96 rounded-full bg-indigo-200/35 blur-3xl" />
        <div className="absolute bottom-[-20%] left-[35%] h-[28rem] w-[28rem] rounded-full bg-sky-100/60 blur-3xl" />
      </div>

      <div className="relative mx-auto min-h-screen max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <header className="sticky top-4 z-40 mb-7 rounded-[1.75rem] border border-slate-200/80 bg-white/90 px-5 py-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <Link href="/" className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-cyan-700">
                BFAI Assessment
              </p>

              <h1 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                Document Intelligence + Agentic RAG
              </h1>

              <p className="mt-1 text-xs font-semibold text-slate-500">
                OCR · Classification · Vector Search · Cited Answers
              </p>
            </Link>

            <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100/80 p-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition ${
                      isActive
                        ? "bg-slate-950 text-white shadow-sm"
                        : "text-slate-600 hover:bg-white hover:text-slate-950"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>

        <main>{children}</main>
      </div>
    </div>
  );
}