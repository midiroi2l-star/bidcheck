import clsx from "clsx";
import { FileCheck2, FileText, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BID_CATEGORIES, BID_STATUSES, STATUS_DESC, type Bid, type BidStatus } from "../../shared/types";
import { Button, Card, DDay, ErrorBox, Field, RecBadge, ScoreBadge, Spinner, StatusBadge, inputBase, inputCls } from "../components/ui";
import { api } from "../lib/api";
import { useMe } from "../lib/me";
import { parseDt, shortDt, utcToKst, won } from "../lib/format";
import { SortTh, useSort } from "../lib/sort";
import { useAsync } from "../lib/useAsync";

type Row = Bid & { assignee_name: string | null; analysis_count: number; proposal_count: number };

/** 상태 묶음 탭: 진행 단계별로 보기 */
const TABS: { key: string; label: string; statuses: BidStatus[] | null; hint: string }[] = [
  { key: "all", label: "전체", statuses: null, hint: "" },
  { key: "interest", label: "관심", statuses: ["interest"], hint: STATUS_DESC.interest },
  { key: "report", label: "결과서", statuses: ["analyzed"], hint: STATUS_DESC.analyzed },
  { key: "progress", label: "입찰진행", statuses: ["in_progress"], hint: STATUS_DESC.in_progress },
  { key: "submitted", label: "제출·결과대기", statuses: ["submitted"], hint: STATUS_DESC.submitted },
  { key: "closed", label: "종료(낙찰·탈락·미참여)", statuses: ["won", "lost", "dropped"], hint: "결과가 확정된 입찰" },
];

export default function Bids() {
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "all";
  const { data, error, loading } = useAsync(() => api.get<Row[]>("/bids"), []);
  const [q, setQ] = useState("");
  const [mine, setMine] = useState(false);
  const [hasReport, setHasReport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of TABS) m[t.key] = (data ?? []).filter((b) => !t.statuses || t.statuses.includes(b.status)).length;
    return m;
  }, [data]);

  const filtered = useMemo(() => {
    const t = TABS.find((x) => x.key === tab) ?? TABS[0];
    return (data ?? []).filter(
      (b) =>
        (!t.statuses || t.statuses.includes(b.status)) &&
        (!q || `${b.title} ${b.org ?? ""} ${b.demand_org ?? ""} ${b.id}`.includes(q)) &&
        (!mine || b.assignee === me?.id) &&
        (!hasReport || b.analysis_count > 0),
    );
  }, [data, tab, q, mine, hasReport, me]);

  const { sorted, sort, toggle } = useSort(
    filtered,
    {
      title: (b) => b.title,
      fit: (b) => b.fit_score,
      org: (b) => b.demand_org || b.org,
      amount: (b) => b.est_price ?? b.budget,
      close: (b) => parseDt(b.close_dt)?.getTime(),
      status: (b) => BID_STATUSES.indexOf(b.status),
      updated: (b) => b.updated_at,
    },
    { key: "updated", dir: "desc" },
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-900">입찰 관리</h1>
        <Button variant="secondary" onClick={() => setShowAdd((v) => !v)}>
          <Plus className="h-4 w-4" /> 수동 등록
        </Button>
      </div>

      {showAdd && <ManualAdd onDone={() => setShowAdd(false)} />}
      <ErrorBox error={error} />

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            title={t.hint}
            onClick={() => setParams(t.key === "all" ? {} : { tab: t.key })}
            className={clsx(
              "rounded-full px-3 py-1 text-xs font-medium",
              tab === t.key ? "bg-brand-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
            )}
          >
            {t.label} <span className="ml-0.5 opacity-70">{counts[t.key] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <input className={`${inputBase} w-64`} placeholder="공고명·기관·공고번호 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> 내 담당만
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={hasReport} onChange={(e) => setHasReport(e.target.checked)} /> 결과서 있는 공고만
        </label>
      </div>

      <Card>
        {loading && !data ? (
          <Spinner />
        ) : sorted.length === 0 ? (
          <p className="text-sm text-slate-500">
            해당하는 입찰이 없습니다. <Link to="/search" className="text-brand-600 underline">공고 검색</Link>에서 관심 공고를 등록하세요.
          </p>
        ) : (
          <div className="-mx-4 overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
                <tr>
                  <SortTh k="fit" label="적합도" sort={sort} toggle={toggle} className="pl-4" />
                  <SortTh k="title" label="공고명" sort={sort} toggle={toggle} />
                  <SortTh k="org" label="수요기관" sort={sort} toggle={toggle} />
                  <SortTh k="amount" label="금액" sort={sort} toggle={toggle} />
                  <SortTh k="close" label="입찰마감" sort={sort} toggle={toggle} />
                  <SortTh k="status" label="상태" sort={sort} toggle={toggle} />
                  <th className="px-2 py-2">담당</th>
                  <SortTh k="updated" label="최근 수정" sort={sort} toggle={toggle} className="pr-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((b) => (
                  <BidRow key={b.id} b={b} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function BidRow({ b }: { b: Row }) {
  const nav = useNavigate();
  return (
    <tr className="cursor-pointer hover:bg-brand-50/60" onClick={() => nav(`/bids/${b.id}`)}>
      <td className="px-4 py-2">
        <ScoreBadge score={b.fit_score} />
      </td>
      <td className="px-2 py-2">
        <div className="font-medium text-slate-900">{b.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {b.category} · {b.id}
          <RecBadge rec={b.recommendation} />
          {b.analysis_count > 0 && (
            <span className="inline-flex items-center gap-0.5 text-indigo-600">
              <FileCheck2 className="h-3 w-3" /> 결과서
            </span>
          )}
          {b.proposal_count > 0 && (
            <span className="inline-flex items-center gap-0.5 text-amber-700">
              <FileText className="h-3 w-3" /> 제안서
            </span>
          )}
        </div>
      </td>
      <td className="px-2 py-2 text-xs">{b.demand_org || b.org}</td>
      <td className="whitespace-nowrap px-2 py-2 tabular-nums">{won(b.est_price ?? b.budget)}</td>
      <td className="whitespace-nowrap px-2 py-2 text-xs">
        {shortDt(b.close_dt)} <DDay dt={b.close_dt} />
      </td>
      <td className="px-2 py-2">
        <StatusBadge status={b.status} />
      </td>
      <td className="whitespace-nowrap px-2 py-2 text-xs">{b.assignee_name ?? "-"}</td>
      <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500">{utcToKst(b.updated_at).slice(0, 12)}</td>
    </tr>
  );
}

function ManualAdd({ onDone }: { onDone: () => void }) {
  const nav = useNavigate();
  const [f, setF] = useState({ bid_no: "", bid_ord: "000", category: "용역", title: "", org: "", close_dt: "", budget: "" });
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Card title="입찰 수동 등록 (나라장터 외 공고)" actions={<Button variant="ghost" size="sm" onClick={onDone}>닫기</Button>}>
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

