import { ExternalLink, Paperclip, Plus, Search as SearchIcon } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BID_CATEGORIES, STATUS_LABEL, type BidStatus, type G2BNotice } from "../../shared/types";
import { Badge, Button, Card, DDay, ErrorBox, Field, inputCls, inputBase } from "../components/ui";
import { api } from "../lib/api";
import { shortDt, won } from "../lib/format";

type Row = G2BNotice & { savedStatus: BidStatus | null };

const kstDate = (offsetDays = 0) => new Date(Date.now() + 9 * 3600_000 + offsetDays * 86400_000).toISOString().slice(0, 10);

export default function Search() {
  const nav = useNavigate();
  const [q, setQ] = useState({ category: "용역", keyword: "", org: "", from: kstDate(-7), to: kstDate(0) });
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const [bidNo, setBidNo] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);

  async function search(p = 1) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ ...q, page: String(p), rows: "50" });
      const res = await api.get<{ totalCount: number; items: Row[] }>(`/g2b/search?${params}`);
      setRows(res.items);
      setTotal(res.totalCount);
      setPage(p);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  async function save(n: G2BNotice, open = false) {
    setSaving(n.bidNo);
    try {
      const bid = await api.send<{ id: string; status: BidStatus }>("POST", "/bids", { notice: n });
      setRows((rs) => rs?.map((r) => (r.bidNo === n.bidNo ? { ...r, savedStatus: bid.status } : r)) ?? null);
      if (open) nav(`/bids/${bid.id}`);
    } catch (e) {
      setError(e);
    } finally {
      setSaving(null);
    }
  }

  async function lookup() {
    setLookupLoading(true);
    setError(null);
    try {
      const n = await api.get<G2BNotice>(`/g2b/lookup?bidNo=${encodeURIComponent(bidNo)}&category=${encodeURIComponent(q.category)}`);
      await save(n, true);
    } catch (e) {
      setError(e);
    } finally {
      setLookupLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900">나라장터 공고 검색</h1>

      <Card>
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
          onSubmit={(e) => {
            e.preventDefault();
            search(1);
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
          <div className="flex items-end">
            <Button type="submit" loading={loading} className="w-full">
              <SearchIcon className="h-4 w-4" /> 검색
            </Button>
          </div>
        </form>
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
          <Field label="공고번호로 바로 등록">
            <input className={`${inputBase} w-56`} value={bidNo} onChange={(e) => setBidNo(e.target.value)} placeholder="예: R25BK00123456" />
          </Field>
          <Button variant="secondary" onClick={lookup} loading={lookupLoading} disabled={!bidNo.trim()}>
            <Plus className="h-4 w-4" /> 조회 후 관심 등록
          </Button>
          <span className="pb-2 text-xs text-slate-400">구분(용역/물품/공사)을 맞게 선택하세요</span>
        </div>
      </Card>

      <ErrorBox error={error} />

      {rows && (
        <Card title={`검색 결과 ${total.toLocaleString()}건`}>
          {rows.length === 0 ? (
            <p className="text-sm text-slate-500">조건에 맞는 공고가 없습니다.</p>
          ) : (
            <div className="-mx-4 overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-2">공고명</th>
                    <th className="px-2 py-2">공고/수요기관</th>
                    <th className="px-2 py-2">추정가격</th>
                    <th className="px-2 py-2">계약방법</th>
                    <th className="px-2 py-2">입찰마감</th>
                    <th className="px-4 py-2 text-right">관심 등록</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((n) => (
                    <tr key={`${n.bidNo}-${n.bidOrd}`} className="align-top">
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
                          {n.detailUrl && (
                            <a href={n.detailUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-brand-600">
                              나라장터 <ExternalLink className="h-3 w-3" />
                            </a>
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
                      <td className="whitespace-nowrap px-2 py-2 text-xs">
                        <div>{shortDt(n.closeDt)}</div>
                        <DDay dt={n.closeDt} />
                      </td>
                      <td className="px-4 py-2 text-right">
                        {n.savedStatus ? (
                          <Link to={`/bids/${n.bidNo}-${n.bidOrd}`}>
                            <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">{STATUS_LABEL[n.savedStatus]} ✓</Badge>
                          </Link>
                        ) : (
                          <Button size="sm" onClick={() => save(n)} loading={saving === n.bidNo}>
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
          {total > 50 && (
            <div className="mt-3 flex items-center justify-center gap-2 text-sm">
              <Button variant="secondary" size="sm" disabled={page <= 1 || loading} onClick={() => search(page - 1)}>
                이전
              </Button>
              <span>
                {page} / {Math.ceil(total / 50)}
              </span>
              <Button variant="secondary" size="sm" disabled={page * 50 >= total || loading} onClick={() => search(page + 1)}>
                다음
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
