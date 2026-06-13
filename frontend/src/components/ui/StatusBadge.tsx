import { statusClass, statusLabel } from "@/lib/format";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusClass(
        status
      )}`}
    >
      {statusLabel(status)}
    </span>
  );
} 
