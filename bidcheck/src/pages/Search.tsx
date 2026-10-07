import clsx from "clsx";
import { BookmarkPlus, Paperclip, Play, Plus, Search as SearchIcon, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BID_CATEGORIES, STATUS_LABEL, type BidStatus, type G2BNotice, type SavedSearch } from "../../shared/types";
import { Badge, Button, Card, DDay, ErrorBox, Field, inputBase, inputCls } from "../components/ui";
import { api } from "../lib/api";
import { parseDt, shortDt, won } from "../lib/format";
import { SortTh, useSort } from "../lib/sort";
import { useAsync } from "../lib/useAsync";

type Row = Omit<G2BNotice, "raw"> & { savedId: string | null; savedStatus: BidStatus | null };

const kstDate = (offsetDays = 0) => new Date(Date.now() + 9 * 3600_000 + offsetDays * 86400_000).toISOString().slice(0, 10);
const STORE = "bidcheck.search";
const PAGE = 50;

interface Query {
  category: string;
  keyword: string;
  org: string;
  from: string;
  to: string;
}
interface Filters {
  closeFrom: string;
  closeTo: string;
  state: "all" | "open" | "closed";
  minAmt: string;
  maxAmt: string;
  saved: "all" | "new" | "saved";
}

function load<T>(k: string): T | null {
  try {
    const v = sessionStorage.getItem(`${STORE}.${k}`);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function store(k: string, v: unknown) {
  try {
    sessionStorage.setItem(`${STORE}.${k}`, JSON.stringify(v));
  } catch {
    /* 저장 불가 */
  }
}

export default function Search() {
  const nav = useNavigate();
  const [q, setQ] = useState<Query>(() => load<Query>("q") ?? { category: "용역", keyword: "", org: "", from: kstDate(-30), to: kstDate(0) });
  const [flt, setFlt] = useState<Filters>(() => load<Filters>("f") ?? { closeFrom: "", closeTo: "", state: "open", minAmt: "", maxAmt: "", saved: "all" });
  const [result, setResult] = useState<{ items: Row[]; totalCount: number; truncated: boolean } | null>(() => load("r"));
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const saved = useAsync(() => api.get<SavedSearch[]>("/saved-searches"), []);

  useEffect(() => store("f", flt), [flt]);

  async function search(query = q) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ ...query });
      const res = await api.get<{ items: Row[]; totalCount: number; truncated: boolean }>(`/g2b/search?${params}`);
      setResult(res);
      setPage(1);
      store("q", query);
      store("r", res);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  async function addInterest(n: Row) {
    setSaving(n.bidNo);
    try {
      const bid = await api.send<{ id: string; status: BidStatus }>("POST", "/bids", { noticeId: `${n.bidNo}-${n.bidOrd}` });
      setResult((r) => {
        if (!r) return r;
        const next = { ...r, items: r.items.map((x) => (x.bidNo === n.bidNo ? { ...x, savedId: bid.id, savedStatus: bid.status } : x)) };
        store("r", next);
        return next;
      });
    } catch (e) {
      setError(e);
    } finally {
      setSaving(null);
    }
  }

  const filtered = useMemo(() => {
    const now = Date.now();
    const cf = flt.closeFrom ? new Date(`${flt.closeFrom}T00:00`).getTime() : null;
    const ct = flt.closeTo ? new Date(`${flt.closeTo}T23:59`).getTime() : null;
    const min = flt.minAmt ? Number(flt.minAmt) * 10_000 : null;
    const max = flt.maxAmt ? Number(flt.maxAmt) * 10_000 : null;
    return (result?.items ?? []).filter((n) => {
      const close = parseDt(n.closeDt)?.getTime() ?? null;
      if (flt.state === "open" && close != null && close < now) return false;
      if (flt.state === "closed" && (close == null || close >= now)) return false;
      if (cf != null && (close == null || close < cf)) return false;
      if (ct != null && (close == null || close > ct)) return false;
      const amt = n.estPrice ?? n.budget;
      if (min != null && (amt == null || amt < min)) return false;
      if (max != null && amt != null && amt > max) return false;
      if (flt.saved === "new" && n.savedId) return false;
      if (flt.saved === "saved" && !n.savedId) return false;
      return true;
    });
  }, [result, flt]);

  const { sorted, sort, toggle } = useSort(
    filtered,
    {
      title: (n) => n.title,
      org: (n) => n.demandOrg || n.org,
      amount: (n) => n.estPrice ?? n.budget,
      notice: (n) => parseDt(n.noticeDt)?.getTime(),
      close: (n) => parseDt(n.closeDt)?.getTime(),
    },
    { key: "close", dir: "asc" },
  );
  const pageRows = sorted.slice((page - 1) * PAGE, page * PAGE);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900">나라장터 공고 검색</h1>

      <Card>
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
        >
          <Field label="구분">
            <select className={inputCls} value={q.category} onChange={(e) => setQ({ ...q, category: e.target.value })}>
              {BID_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="공고명 키워드">
            <input className={inputCls} value={q.keyword} onChange={(e) => setQ({ ...q, keyword: e.target.value })} placeholder="예: 안전관리 플랫폼" />
          </Field>
          <Field label="공고기관">
            <input className={inputCls} value={q.org} onChange={(e) => setQ({ ...q, org: e.target.value })} placeholder="예: 여수시" />
          </Field>
          <Field label="공고일 시작">
            <input type="date" className={inputCls} value={q.from} onChange={(e) => setQ({ ...q, from: e.target.value })} />
          </Field>
          <Field label="공고일 종료">
            <input type="date" className={inputCls} value={q.to} onChange={(e) => setQ({ ...q, to: e.target.value })} />
          </Field>
          <div className="flex items-end gap-2">
            <Button type="submit" loading={loading} className="flex-1">
              <SearchIcon className="h-4 w-4" /> 검색
            </Button>
            <SaveSearchButton q={q} flt={flt} onSaved={saved.reload} />
          </div>
        </form>

        {saved.data && saved.data.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-sm">
            <span className="text-xs text-slate-500">저장한 검색</span>
            {saved.data.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-3 pr-1 text-xs">
                <button
                  className="hover:text-brand-700"
                  onClick={() => {
                    const nq = { ...q, category: s.category, keyword: s.keyword ?? "", org: s.org ?? "" };
                    setQ(nq);
                    setFlt({ ...flt, minAmt: s.min_amount ? String(s.min_amount / 10_000) : "", maxAmt: s.max_amount ? String(s.max_amount / 10_000) : "" });
                    search(nq);
                  }}
                >
                  {s.name}
                  {s.new_count ? <b className="ml-1 text-red-600">+{s.new_count}</b> : null}
                </button>
                <button
                  aria-label="삭제"
                  className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  onClick={async () => {
                    if (!confirm(`'${s.name}' 저장 검색을 삭제할까요?`)) return;
                    await api.send("DELETE", `/saved-searches/${s.id}`);
                    saved.reload();
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <span className="text-xs text-slate-400">· 매일 아침 7시 30분에 자동 검색해 대시보드에 추천 공고로 보여 줍니다</span>
          </div>
        )}
      </Card>

      <ErrorBox error={error} />

      {result && (
        <Card
          title={
            <span>
              검색 결과 {filtered.length.toLocaleString()}건
              <span className="ml-2 text-xs font-normal text-slate-500">
                (조회 {result.items.length.toLocaleString()}건{result.truncated ? ` / 전체 ${result.totalCount.toLocaleString()}건 중 일부 — 기간을 좁혀 주세요` : ""})
              </span>
            </span>
          }
        >
          <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <Field label="마감 상태">
              <select className={inputCls} value={flt.state} onChange={(e) => (setFlt({ ...flt, state: e.target.value as Filters["state"] }), setPage(1))}>
                <option value="all">전체</option>
                <option value="open">진행 중 (마감 전)</option>
                <option value="closed">마감됨</option>
              </select>
            </Field>
            <Field label="입찰마감 시작">
              <input type="date" className={inputCls} value={flt.closeFrom} onChange={(e) => (setFlt({ ...flt, closeFrom: e.target.value }), setPage(1))} />
            </Field>
            <Field label="입찰마감 종료">
              <input type="date" className={inputCls} value={flt.closeTo} onChange={(e) => (setFlt({ ...flt, closeTo: e.target.value }), setPage(1))} />
            </Field>
            <Field label="금액 (만원)">
              <div className="flex items-center gap-1">
                <input className={`${inputBase} w-full min-w-0`} value={flt.minAmt} onChange={(e) => (setFlt({ ...flt, minAmt: e.target.value.replace(/\D/g, "") }), setPage(1))} placeholder="이상" />
                <span className="text-slate-400">~</span>
                <input className={`${inputBase} w-full min-w-0`} value={flt.maxAmt} onChange={(e) => (setFlt({ ...flt, maxAmt: e.target.value.replace(/\D/g, "") }), setPage(1))} placeholder="이하" />
              </div>
            </Field>
            <Field label="등록 여부">
              <select className={inputCls} value={flt.saved} onChange={(e) => (setFlt({ ...flt, saved: e.target.value as Filters["saved"] }), setPage(1))}>
                <option value="all">전체</option>
                <option value="new">미등록 공고만</option>
                <option value="saved">등록한 공고만</option>
              </select>
            </Field>
            <div className="flex items-end">
              <Button variant="ghost" onClick={() => setFlt({ closeFrom: "", closeTo: "", state: "all", minAmt: "", maxAmt: "", saved: "all" })}>
                필터 초기화
              </Button>
            </div>
          </div>

          {sorted.length === 0 ? (
            <p className="text-sm text-slate-500">조건에 맞는 공고가 없습니다.</p>
          ) : (
            <div className="-mx-4 overflow-x-auto">
              <table className="w-full min-w-[960px] text-sm">
                <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <tr>
                    <SortTh k="title" label="공고명" sort={sort} toggle={toggle} className="pl-4" />
                    <SortTh k="org" label="공고/수요기관" sort={sort} toggle={toggle} />
                    <SortTh k="amount" label="추정가격" sort={sort} toggle={toggle} />
                    <th className="px-2 py-2">계약방법</th>
                    <SortTh k="notice" label="공고일" sort={sort} toggle={toggle} />
                    <SortTh k="close" label="입찰마감" sort={sort} toggle={toggle} />
                    <th className="px-4 py-2 text-right">관심 등록</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageRows.map((n) => (
                    <tr
                      key={`${n.bidNo}-${n.bidOrd}`}
                      className="cursor-pointer align-top hover:bg-brand-50/60"
                      onClick={() => nav(`/notices/${n.bidNo}-${n.bidOrd}?category=${encodeURIComponent(n.category)}`)}
                    >
                      <td className="px-4 py-2">
                        <div className="font-medium text-slate-900">{n.title}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>
                            {n.bidNo}-{n.bidOrd}
                          </span>
                          {n.attachments.length > 0 && (
                            <span className="inline-flex items-center gap-0.5">
                              <Paperclip className="h-3 w-3" />
                              {n.attachments.length}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-xs">
                        <div>{n.org}</div>
                        {n.demandOrg && n.demandOrg !== n.org && <div className="text-slate-500">{n.demandOrg}</div>}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 tabular-nums">{won(n.estPrice ?? n.budget)}</td>
                      <td className="px-2 py-2 text-xs">
                        {n.contractMethod}
                        {n.awardMethod && <div className="text-slate-500">{n.awardMethod}</div>}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-xs">{shortDt(n.noticeDt).slice(0, 10)}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-xs">
                        <div>{shortDt(n.closeDt)}</div>
                        <DDay dt={n.closeDt} />
                      </td>
                      <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        {n.savedId ? (
                          <button onClick={() => nav(`/bids/${n.savedId}`)}>
                            <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">{STATUS_LABEL[n.savedStatus!] ?? "등록"} ✓</Badge>
                          </button>
                        ) : (
                          <Button size="sm" onClick={() => addInterest(n)} loading={saving === n.bidNo}>
                            <Plus className="h-3.5 w-3.5" /> 관심
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pages > 1 && (
            <div className="mt-3 flex items-center justify-center gap-1 text-sm">
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={clsx("h-8 w-8 rounded-md", p === page ? "bg-brand-700 font-semibold text-white" : "hover:bg-slate-100")}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function SaveSearchButton({ q, flt, onSaved }: { q: Query; flt: Filters; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      loading={busy}
      title="이 검색 조건을 저장 (매일 자동 검색)"
      aria-label="검색 조건 저장"
      onClick={async () => {
        const name = prompt("저장할 검색 이름을 입력하세요", q.keyword || q.org || `${q.category} 공고`);
        if (!name) return;
        setBusy(true);
        try {
          await api.send("POST", "/saved-searches", {
            name,
            category: q.category,
            keyword: q.keyword,
            org: q.org,
            min_amount: flt.minAmt ? Number(flt.minAmt) * 10_000 : null,
            max_amount: flt.maxAmt ? Number(flt.maxAmt) * 10_000 : null,
          });
          onSaved();
        } finally {
          setBusy(false);
        }
      }}
    >
      <BookmarkPlus className="h-4 w-4" />
    </Button>
  );
}

export function RunSavedButton({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api.send("POST", "/saved-searches/run");
          onDone();
        } finally {
          setBusy(false);
        }
      }}
    >
      <Play className="h-3.5 w-3.5" /> 지금 검색
    </Button>
  );
}
