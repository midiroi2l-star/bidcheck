export function won(n: number | null | undefined) {
  if (n == null) return "-";
  if (n >= 100_000_000) return `${(n / 100_000_000).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}억원`;
  if (n >= 10_000) return `${Math.round(n / 10_000).toLocaleString("ko-KR")}만원`;
  return `${n.toLocaleString("ko-KR")}원`;
}

/** 나라장터 일시 문자열(2025-01-02 10:00:00, 2025/01/02 10:00, 202501021000 등)을 Date 로 */
export function parseDt(s: string | null | undefined): Date | null {
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const y = +digits.slice(0, 4), m = +digits.slice(4, 6), d = +digits.slice(6, 8);
  const hh = digits.length >= 10 ? +digits.slice(8, 10) : 0;
  const mm = digits.length >= 12 ? +digits.slice(10, 12) : 0;
  const dt = new Date(y, m - 1, d, hh, mm);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function shortDt(s: string | null | undefined) {
  const d = parseDt(s);
  if (!d) return s || "-";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function dday(s: string | null | undefined): { label: string; tone: "red" | "amber" | "slate" | "gray" } | null {
  const d = parseDt(s);
  if (!d) return null;
  const diff = d.getTime() - Date.now();
  if (diff < 0) return { label: "마감", tone: "gray" };
  const days = Math.floor(diff / 86400000);
  if (days === 0) return { label: `D-day ${Math.max(1, Math.round(diff / 3600000))}h`, tone: "red" };
  return { label: `D-${days}`, tone: days <= 3 ? "red" : days <= 7 ? "amber" : "slate" };
}

/** D1 의 datetime('now') (UTC) → 한국시간 표시 */
export function utcToKst(s: string | null | undefined) {
  if (!s) return "-";
  const d = new Date(s.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export const fileSize = (n: number | null | undefined) =>
  n == null ? "" : n > 1048576 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`;
