"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  Database,
  Home,
  UploadCloud,
} from "lucide-react";

const navItems = [
  {
    href: "/",
    label: "Overview",
    icon: Home,
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
  {
    href: "/chat",
    label: "Chat",
    icon: Bot,
  },
];

export function PageNav() {
  const pathname = usePathname();
  const router = useRouter();

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/");
  }

  return (
    <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <nav className="flex max-w-[calc(100vw-2rem)] flex-wrap items-center justify-center gap-2 rounded-[1.5rem] border border-white/70 bg-white/85 p-2 shadow-xl shadow-slate-300/30 backdrop-blur-xl">
        <button
          type="button"
          aria-label="Go back"
          onClick={handleBack}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-950 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </button>

        <div className="h-6 w-px bg-slate-200" />

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={`Go to ${item.label.toLowerCase()}`}
              className={`inline-flex h-10 items-center justify-center gap-2 rounded-2xl px-3 text-sm font-black transition ${
                isActive
                  ? "bg-slate-950 text-white shadow-lg shadow-slate-950/15"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default PageNav;
