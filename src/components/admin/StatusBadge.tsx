import {
  CheckCircle2,
  CircleDashed,
  CircleDot,
  FileCheck2,
  Handshake,
  PackageCheck,
  Ship,
  XCircle,
} from "lucide-react";

import { INQUIRY_STATUS_LABELS, type InquiryStatus } from "@/integrations/supabase/admin-schema";
import { cn } from "@/lib/utils";

/**
 * Inquiry status is state, not a data series, so it uses a reserved status
 * palette and always ships an icon plus the written label — the colour is never
 * the only thing carrying the meaning.
 */
const STYLES: Record<
  InquiryStatus,
  { className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  new: {
    className:
      "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200",
    icon: CircleDot,
  },
  contacted: {
    className:
      "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
    icon: CircleDashed,
  },
  negotiating: {
    className:
      "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
    icon: Handshake,
  },
  deal_won: {
    className:
      "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    icon: CheckCircle2,
  },
  docs_ready: {
    className:
      "border-teal-300 bg-teal-50 text-teal-800 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-200",
    icon: FileCheck2,
  },
  shipped: {
    className:
      "border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
    icon: Ship,
  },
  delivered: {
    className:
      "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200",
    icon: PackageCheck,
  },
  deal_lost: {
    className:
      "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200",
    icon: XCircle,
  },
};

export function StatusBadge({ status, className }: { status: InquiryStatus; className?: string }) {
  const style = STYLES[status];
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        style.className,
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {INQUIRY_STATUS_LABELS[status]}
    </span>
  );
}
