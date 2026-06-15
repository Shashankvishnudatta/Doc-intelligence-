import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleCheck,
  FileCheck2,
  FileText,
  SearchCheck,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";

const workflowSteps = [
  {
    step: "01",
    title: "Upload Documents",
    description: "Add PDFs, text files, and images through a clean upload flow.",
    bullets: ["Bulk upload support", "PDF, TXT, PNG, JPG, JPEG", "Secure file validation"],
    chip: "Input layer",
    icon: UploadCloud,
  },
  {
    step: "02",
    title: "Process & Classify",
    description: "Extract text, OCR weak pages, classify content, and index chunks.",
    bullets: ["OCR and page rendering", "Structured document classification", "Vector indexing for retrieval"],
    chip: "Intelligence layer",
    icon: FileCheck2,
  },
  {
    step: "03",
    title: "Ask with Citations",
    description: "Get answers grounded with document names and page references.",
    bullets: ["Citation-backed answers", "Page thumbnails", "No-context refusal"],
    chip: "Answer layer",
    icon: Bot,
  },
];

const metrics = [
  {
    value: "5+",
    label: "Sample documents",
  },
  {
    value: "4",
    label: "Processing stages",
  },
  {
    value: "100%",
    label: "Citation-first answers",
  },
  {
    value: "On",
    label: "No-context refusal",
  },
];

function DocumentIntelligenceIllustration() {
  return (
    <div className="hidden xl:block relative mx-auto h-[360px] w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
      <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.12),transparent_30%),radial-gradient(circle_at_82%_20%,rgba(99,102,241,0.10),transparent_30%)]" />

      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-700">
              Live Pipeline
            </p>
            <h3 className="mt-1 text-lg font-black text-slate-950">
              Documents to Intelligence to Answers
            </h3>
          </div>

          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
            Secure
          </div>
        </div>

        <div className="grid grid-cols-[1fr_72px_1fr] items-center gap-3">
          <div className="space-y-3">
            <div className="float-soft rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-950">
                    Policy.pdf
                  </p>
                  <p className="text-xs font-medium text-slate-500">
                    12 pages - OCR ready
                  </p>
                </div>
              </div>
            </div>

            <div className="float-soft-delay ml-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-950">
                    Invoice.txt
                  </p>
                  <p className="text-xs font-medium text-slate-500">
                    Financial data
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="h-1 w-full rounded-full bg-cyan-200 pulse-line" />
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500 text-white glow-node">
              <SearchCheck className="h-6 w-6" />
            </div>
            <div className="h-1 w-full rounded-full bg-cyan-200 pulse-line" />
          </div>

          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-950 p-5 text-white shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950">
                <Bot className="h-6 w-6" />
              </div>

              <div>
                <p className="text-sm font-black">Cited Answer</p>
                <p className="text-xs text-slate-400">
                  Source verified
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <div className="h-2 rounded-full bg-white/80" />
              <div className="h-2 w-10/12 rounded-full bg-white/60" />
              <div className="h-2 w-7/12 rounded-full bg-white/40" />
            </div>

            <div className="mt-5 rounded-xl border border-white/10 bg-white/10 p-3">
              <p className="text-[11px] font-bold text-cyan-200">
                Citation
              </p>
              <p className="mt-1 text-xs font-medium text-white">
                policy.pdf - page 3
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {["Upload", "Understand", "Prepare", "Answer"].map((item, index) => (
            <div
              key={item}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center"
            >
              <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-black text-slate-950 shadow-sm">
                {index + 1}
              </div>
              <p className="mt-2 text-xs font-black text-slate-700">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <section className="space-y-10 px-4 py-6 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[2.25rem] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div className="grid gap-8 p-8 lg:grid-cols-[1.02fr_0.98fr] lg:p-10">
          <div className="flex flex-col justify-center">
            <div className="inline-flex w-fit rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-cyan-700">
              Welcome to Document Intelligence
            </div>

            <h2 className="mt-7 max-w-3xl text-4xl lg:text-5xl xl:text-6xl font-black tracking-[-0.045em] text-slate-950">
              Secure answers from documents, backed by citations.
            </h2>

            <p className="mt-5 max-w-2xl text-base font-medium leading-8 text-slate-600">
              Your trusted AI system for parsing documents, extracting evidence,
              classifying content, and answering questions with page-level source
              verification.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/upload"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
              >
                Upload Documents
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/chat"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-800 transition hover:bg-slate-50"
              >
                Open Chatbot
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
                Security-aware
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-black text-cyan-700">
                <CheckCircle2 className="h-4 w-4" />
                Citation-backed
              </div>
            </div>
          </div>

          <DocumentIntelligenceIllustration />
        </div>
      </div>

      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="max-w-2xl">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-indigo-600">
            Product Journey
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
            Upload, understand, then ask.
          </h2>
          <p className="mt-3 text-sm font-medium leading-7 text-slate-600">
            Follow the same path the system uses internally: ingest the source,
            prepare it for retrieval, then answer only with grounded evidence.
          </p>
        </div>

        {workflowSteps.map((step, index) => {
          const Icon = step.icon;

          return (
            <article
              key={step.title}
              className="group relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-xl shadow-slate-300/40 backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-2xl sm:p-8"
            >
              <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.12),transparent_55%)] opacity-0 transition group-hover:opacity-100" />

              <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
                    <Icon className="h-7 w-7" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-500">
                        Step {step.step}
                      </span>
                      <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
                        {step.chip}
                      </span>
                    </div>

                    <h3 className="mt-4 text-2xl font-black text-slate-950">
                      {step.title}
                    </h3>

                    <p className="mt-3 max-w-2xl text-sm font-medium leading-7 text-slate-600">
                      {step.description}
                    </p>

                    <div className="mt-5 grid gap-2 sm:grid-cols-3">
                      {step.bullets.map((bullet) => (
                        <div
                          key={bullet}
                          className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm"
                        >
                          <CircleCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                          <span>{bullet}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-950 px-5 py-4 text-white shadow-xl shadow-slate-950/10">
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                      Workflow
                    </p>
                    <p className="mt-1 text-3xl font-black">
                      {index + 1}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-cyan-300">
            Trust Layer
          </p>

          <h3 className="mt-3 text-2xl font-black">
            Every answer is traceable.
          </h3>

          <p className="mt-3 text-sm font-medium leading-7 text-slate-300">
            The system refuses unrelated questions and gives citations only when
            relevant document context is found.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm"
            >
              <p className="text-3xl font-black text-slate-950">
                {metric.value}
              </p>

              <p className="mt-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                {metric.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      
    </section>
  );
}
