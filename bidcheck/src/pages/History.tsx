import { useState } from "react";
import { Link } from "react-router-dom";
import type { HistoryEntry } from "../../shared/types";
import { Card, ErrorBox, Spinner, inputBase } from "../components/ui";
import { api } from "../lib/api";
import { utcToKst } from "../lib/format";
import { useAsync } from "../lib/useAsync";

export default function HistoryPage() {
  const { data, error, loading } = useAsync(() => api.get<HistoryEntry[]>("/history?limit=500"), []);
  const [q, setQ] = useState("");
  const rows = (data ?? []).filter((h) => !q || `${h.action} ${h.detail ?? ""} ${h.bid_title ?? ""}`.includes(q));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-900">히스토리</h1>
        <input className={`${inputBase} w-64`} placeholder="검색" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ErrorBox error={error} />
      <Card>
        {loading && !data ? (
          <Spinner />
        ) : (
          <div className="-mx-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2">일시</th>
                  <th className="px-2 py-2">작업</th>
                  <th className="px-2 py-2">내용</th>
                  <th className="px-4 py-2">입찰</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((h) => (
                  <tr key={h.id}>
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500">{utcToKst(h.at)}</td>
                    <td className="whitespace-nowrap px-2 py-2 font-medium">{h.action}</td>
                    <td className="px-2 py-2 text-slate-600">{h.detail}</td>
                    <td className="px-4 py-2">
                      {h.bid_id && (
                        <Link to={`/bids/${h.bid_id}`} className="text-brand-600 hover:underline">
                          {h.bid_title ?? h.bid_id}
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
