import { Download, Plus, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BID_CATEGORIES, BID_STATUSES, STATUS_LABEL, type AnalysisResult, type Bid } from "../../shared/types";
import { Button, Card, DDay, ErrorBox, Field, RecBadge, ScoreBadge, Spinner, StatusBadge, inputCls, inputBase } from "../components/ui";
import { api } from "../lib/api";
import { exportBids, parseImport } from "../lib/excel";
import { shortDt, won } from "../lib/format";
import { useAsync } from "../lib/useAsync";

export default function Bids() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const { data, error, loading, reload } = useAsync(() => api.get<Bid[]>(`/bids${status ? `?status=${status}` : ""}`), [status]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = (data ?? []).filter((b) => !q || `${b.title} ${b.org} ${b.demand_org} ${b.id}`.includes(q));

  async function doExport() {
    setBusy("export");
    setErr(null);
    try {
      const all = await api.get<(Bid & { analysis: AnalysisResult | null })[]>(
        `/bids?withAnalysis=1${status ? `&status=${status}` : ""}`,
      );
      await exportBids(all);
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(null);
    }
  }

  async function doImport(file: File) {
    setBusy("import");
    setErr(null);
    setMsg(null);
    try {
      const { rows } = await parseImport(file);
      if (!rows.length) throw new Error("가져올 행이 없습니다.");
      const res = await api.send<{ created: number; updated: number }>("POST", "/bids/import", { rows });
      setMsg(`엑셀 가져오기 완료: 신규 ${res.created}건, 갱신 ${res.updated}건`);
      reload();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-900">관심·진행 입찰</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setShowAdd((v) => !v)}>
            <Plus className="h-4 w-4" /> 수동 등록
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()} loading={busy === "import"}>
            <Upload className="h-4 w-4" /> 기존 엑셀 가져오기
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
          <Button onClick={doExport} loading={busy === "export"}>
            <Download className="h-4 w-4" /> 엑셀 다운로드
          </Button>
        </div>
      </div>

      {showAdd && <ManualAdd onDone={() => setShowAdd(false)} />}
      {msg && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div>}
      <ErrorBox error={err || error} />

      <div className="flex flex-wrap items-center gap-1.5">
        {["", ...BID_STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => setParams(s ? { status: s } : {})}
            className={`rounded-full px-3 py-1 text-xs font-medium ${status === s ? "bg-brand-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
          >
            {s ? STATUS_LABEL[s as keyof typeof STATUS_LABEL] : "전체"}
          </button>
        ))}
        <input className={`${inputBase} ml-auto w-56`} placeholder="공고명·기관 검색" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <Card>
        {loading && !data ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">
            등록된 입찰이 없습니다. <Link to="/search" className="text-brand-600 underline">공고 검색</Link>에서 관심 입찰을 추가하거나, 기존에 관리하던 엑셀을 가져오세요.
          </p>
        ) : (
          <div className="-mx-4 overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2">적합도</th>
                  <th className="px-2 py-2">공고명</th>
                  <th className="px-2 py-2">수요기관</th>
                  <th className="px-2 py-2">금액</th>
                  <th className="px-2 py-2">입찰마감</th>
                  <th className="px-4 py-2">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2">
                      <ScoreBadge score={b.fit_score} />
                    </td>
                    <td className="px-2 py-2">
                      <Link to={`/bids/${b.id}`} className="font-medium text-slate-900 hover:text-brand-600">
                        {b.title}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                        {b.category} · {b.id} <RecBadge rec={b.recommendation} />
                      </div>
                    </td>
                    <td className="px-2 py-2 text-xs">{b.demand_org || b.org}</td>
                    <td className="whitespace-nowrap px-2 py-2 tabular-nums">{won(b.est_price ?? b.budget)}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-xs">
                      {shortDt(b.close_dt)} <DDay dt={b.close_dt} />
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={b.status} />
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

function ManualAdd({ onDone }: { onDone: () => void }) {
  const nav = useNavigate();
  const [f, setF] = useState({ bid_no: "", bid_ord: "000", category: "용역", title: "", org: "", close_dt: "", budget: "" });
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Card title="입찰 수동 등록" actions={<Button variant="ghost" size="sm" onClick={onDone}>닫기</Button>}>
      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const bid = await api.send<Bid>("POST", "/bids", { ...f, budget: f.budget ? Number(f.budget.replace(/,/g, "")) : null });
            nav(`/bids/${bid.id}`);
          } catch (e2) {
            setErr(e2);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="공고번호 *">
          <input required className={inputCls} value={f.bid_no} onChange={(e) => setF({ ...f, bid_no: e.target.value })} />
        </Field>
        <Field label="차수">
          <input className={inputCls} value={f.bid_ord} onChange={(e) => setF({ ...f, bid_ord: e.target.value })} />
        </Field>
        <Field label="구분">
          <select className={inputCls} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {BID_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="공고기관">
          <input className={inputCls} value={f.org} onChange={(e) => setF({ ...f, org: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="공고명 *">
            <input required className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
        </div>
        <Field label="입찰마감">
          <input type="datetime-local" className={inputCls} value={f.close_dt} onChange={(e) => setF({ ...f, close_dt: e.target.value.replace("T", " ") })} />
        </Field>
        <Field label="사업예산(원)">
          <input className={inputCls} value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} />
        </Field>
        <div className="sm:col-span-2 lg:col-span-4">
          <ErrorBox error={err} />
          <Button type="submit" loading={busy} className="mt-2">
            등록
          </Button>
        </div>
      </form>
    </Card>
  );
}
