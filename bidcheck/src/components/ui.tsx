import clsx from "clsx";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { STATUS_LABEL, RECOMMENDATION_LABEL, type BidStatus } from "../../shared/types";
import { dday } from "../lib/format";

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  loading?: boolean;
}) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm",
        variant === "primary" && "bg-brand-700 text-white hover:bg-brand-600",
        variant === "secondary" && "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
        variant === "ghost" && "text-slate-600 hover:bg-slate-100",
        variant === "danger" && "border border-red-200 bg-white text-red-600 hover:bg-red-50",
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("rounded-lg border border-slate-200 bg-white shadow-sm", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

const STATUS_TONE: Record<BidStatus, string> = {
  interest: "bg-sky-50 text-sky-700 ring-sky-200",
  analyzed: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  in_progress: "bg-amber-50 text-amber-800 ring-amber-200",
  submitted: "bg-violet-50 text-violet-700 ring-violet-200",
  won: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  lost: "bg-slate-100 text-slate-600 ring-slate-200",
  dropped: "bg-slate-100 text-slate-500 ring-slate-200",
};

export function StatusBadge({ status }: { status: BidStatus }) {
  return <Badge className={STATUS_TONE[status]}>{STATUS_LABEL[status] ?? status}</Badge>;
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset", className)}>
      {children}
    </span>
  );
}

export function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-xs text-slate-400">미분석</span>;
  const tone =
    score >= 80 ? "bg-emerald-600" : score >= 65 ? "bg-sky-600" : score >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <span className={clsx("inline-flex h-7 w-10 items-center justify-center rounded text-sm font-bold text-white tabular-nums", tone)}>
      {Math.round(score)}
    </span>
  );
}

export function RecBadge({ rec }: { rec: string | null | undefined }) {
  if (!rec) return null;
  const tone =
    rec === "go" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : rec === "conditional" ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-red-50 text-red-700 ring-red-200";
  return <Badge className={tone}>{RECOMMENDATION_LABEL[rec] ?? rec}</Badge>;
}

export function DDay({ dt }: { dt: string | null | undefined }) {
  const d = dday(dt);
  if (!d) return null;
  const tone = {
    red: "bg-red-50 text-red-700 ring-red-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    slate: "bg-slate-50 text-slate-600 ring-slate-200",
    gray: "bg-slate-100 text-slate-400 ring-slate-200",
  }[d.tone];
  return <Badge className={tone}>{d.label}</Badge>;
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {error instanceof Error ? error.message : String(error)}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" /> {label ?? "불러오는 중…"}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export const inputBase =
  "rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
export const inputCls = `${inputBase} w-full`;
