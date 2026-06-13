export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  const value = bytes / Math.pow(1024, index);

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`;
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    uploaded: "Uploaded",
    parsing: "Parsing",
    parsed: "Parsed",
    classifying: "Classifying",
    classified: "Classified",
    indexing: "Indexing",
    indexed: "Indexed",
    failed: "Failed",
  };

  return labels[status] || status;
}

export function statusClass(status: string): string {
  const classes: Record<string, string> = {
    uploaded: "border-slate-500/40 bg-slate-500/10 text-slate-200",
    parsing: "border-amber-300/40 bg-amber-300/10 text-amber-100",
    parsed: "border-blue-300/40 bg-blue-300/10 text-blue-100",
    classifying: "border-purple-300/40 bg-purple-300/10 text-purple-100",
    classified: "border-fuchsia-300/40 bg-fuchsia-300/10 text-fuchsia-100",
    indexing: "border-cyan-300/40 bg-cyan-300/10 text-cyan-100",
    indexed: "border-emerald-300/40 bg-emerald-300/10 text-emerald-100",
    failed: "border-red-300/40 bg-red-300/10 text-red-100",
  };

  return classes[status] || "border-white/10 bg-white/5 text-slate-200";
} 
