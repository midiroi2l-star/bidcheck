import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { STATUS_LABEL, type BidStatus } from "../../shared/types";
import { Button, Card, ErrorBox, Spinner } from "../components/ui";
import { api } from "../lib/api";
import { parseDt } from "../lib/format";
import { useAsync } from "../lib/useAsync";

interface Ev {
  id: string;
  title: string;
  status: BidStatus;
  close_dt: string | null;
  open_dt: string | null;
}

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const ACTIVE: BidStatus[] = ["interest", "analyzed", "in_progress", "submitted"];

export default function CalendarPage() {
  const { data, error, loading } = useAsync(() => api.get<Ev[]>("/calendar"), []);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [onlyActive, setOnlyActive] = useState(true);

  const byDay = useMemo(() => {
    const m = new Map<string, { ev: Ev; kind: "마감" | "개찰"; time: string }[]>();
    for (const ev of data ?? []) {
      if (onlyActive && !ACTIVE.includes(ev.status)) continue;
      for (const [kind, dt] of [["마감", ev.close_dt], ["개찰", ev.open_dt]] as const) {
        const d = parseDt(dt);
        if (!d) continue;
        const k = key(d);
        m.set(k, [...(m.get(k) ?? []), { ev, kind, time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` }]);
      }
    }
    return m;
  }, [data, onlyActive]);

  const start = new Date(month);
  start.setDate(1 - start.getDay());
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const today = key(new Date());

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-900">입찰 일정</h1>
        <div className="flex items-center gap-2">
          <label className="mr-2 flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} /> 진행 중인 입찰만
          </label>
          <Button variant="secondary" size="sm" aria-label="이전 달" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="w-28 text-center font-semibold">
            {month.getFullYear()}년 {month.getMonth() + 1}월
          </span>
          <Button variant="secondary" size="sm" aria-label="다음 달" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
            오늘
          </Button>
        </div>
      </div>
      <ErrorBox error={error} />
      {loading && !data ? (
        <Spinner />
      ) : (
        <Card>
          <div className="-mx-4 overflow-x-auto">
            <div className="grid min-w-[760px] grid-cols-7 border-l border-t border-slate-200 text-xs">
              {DOW.map((d, i) => (
                <div key={d} className={clsx("border-b border-r border-slate-200 bg-slate-50 px-2 py-1.5 text-center font-medium", i === 0 && "text-red-600", i === 6 && "text-blue-600")}>
                  {d}
                </div>
              ))}
              {days.map((d) => {
                const items = byDay.get(key(d)) ?? [];
                const other = d.getMonth() !== month.getMonth();
                return (
                  <div key={key(d)} className={clsx("min-h-28 border-b border-r border-slate-200 p-1", other && "bg-slate-50/60 text-slate-400")}>
                    <div className={clsx("mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full", key(d) === today && "bg-brand-700 font-bold text-white")}>
                      {d.getDate()}
                    </div>
                    <ul className="space-y-0.5">
                      {items.map(({ ev, kind, time }) => (
                        <li key={ev.id + kind}>
                          <Link
                            to={`/bids/${ev.id}`}
                            title={`${ev.title} (${STATUS_LABEL[ev.status]})`}
                            className={clsx(
                              "block truncate rounded px-1 py-0.5",
                              kind === "마감" ? "bg-red-50 text-red-800 hover:bg-red-100" : "bg-indigo-50 text-indigo-800 hover:bg-indigo-100",
                            )}
                          >
                            <b>{kind}</b> {time} {ev.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            <span className="rounded bg-red-50 px-1 text-red-800">마감</span> 입찰·제안서 제출 마감 ·{" "}
            <span className="rounded bg-indigo-50 px-1 text-indigo-800">개찰</span> 개찰 일시
          </p>
        </Card>
      )}
    </div>
  );
}
