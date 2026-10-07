import { AlertTriangle, Sparkles, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { BID_STATUSES, STATUS_DESC, STATUS_LABEL, type Bid, type BidStatus, type G2BNotice, type HistoryEntry } from "../../shared/types";
import { Card, DDay, ErrorBox, ScoreBadge, Spinner, StatusBadge } from "../components/ui";
import { api } from "../lib/api";
import { parseDt, shortDt, utcToKst, won } from "../lib/format";
import { useMe } from "../lib/me";
import { useAsync } from "../lib/useAsync";
import { RunSavedButton } from "./Search";
import type { Health } from "./Settings";

const TAB_OF: Record<BidStatus, string> = { interest: "interest", analyzed: "report", in_progress: "progress", submitted: "submitted", won: "closed", lost: "closed", dropped: "closed" };

type ActiveBid = Bid & { assignee_name: string | null };
interface Dash {
  counts: { status: BidStatus; n: number }[];
  active: ActiveBid[];
  recent: HistoryEntry[];
}
type Rec = Omit<G2BNotice, "raw"> & { searchName: string; foundAt: string };

export default function Dashboard() {
  const me = useMe();
  const nav = useNavigate();
  const { data, error, loading } = useAsync(() => api.get<Dash>("/dashboard"), []);
  const health = useAsync(() => api.get<Health>("/health"), []);
  const recs = useAsync(() => api.get<Rec[]>("/recommendations"), []);

  const count = (s: BidStatus) => data?.counts.find((c) => c.status === s)?.n ?? 0;
  const now = Date.now() - 86400000;
  const upcoming = (data?.active ?? [])
    .map((b) => ({ b, t: parseDt(b.close_dt)?.getTime() ?? 0 }))
    .filter((x) => x.t >= now)
    .sort((a, b) => a.t - b.t)
    .slice(0, 10)
    .map((x) => x.b);
  const mine = (data?.active ?? []).filter((b) => b.assignee === me?.id);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900">대시보드</h1>

      {health.data && (!health.data.g2b || !health.data.claude) && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            아직 입력하지 않은 키가 있습니다: {!health.data.g2b && <b>나라장터 키 </b>}
            {!health.data.claude && <b>Claude API 키</b>}.{" "}
            {me?.role === "admin" ? (
              <Link to="/settings" className="font-semibold underline">
                설정에서 입력하기
              </Link>
            ) : (
              "관리자에게 요청해 주세요."
            )}
          </div>
        </div>
      )}

      <ErrorBox error={error} />
      {loading && !data ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {BID_STATUSES.map((s) => (
              <Link key={s} to={`/bids?tab=${TAB_OF[s]}`} title={STATUS_DESC[s]} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:border-brand-500">
                <div className="text-xs text-slate-500">{STATUS_LABEL[s]}</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{count(s)}</div>
              </Link>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-5">
            <Card title="마감 임박 입찰" className="lg:col-span-3">
              {upcoming.length === 0 ? (
                <p className="text-sm text-slate-500">
                  마감 예정인 입찰이 없습니다. <Link className="text-brand-600 underline" to="/search">공고 검색</Link>에서 관심 공고를 등록하세요.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {upcoming.map((b) => (
                    <li key={b.id} className="flex items-center gap-3 py-2">
                      <ScoreBadge score={b.fit_score} />
                      <div className="min-w-0 flex-1">
                        <Link to={`/bids/${b.id}`} className="block truncate text-sm font-medium hover:text-brand-600">
                          {b.title}
                        </Link>
                        <div className="text-xs text-slate-500">
                          {b.demand_org || b.org} · 마감 {shortDt(b.close_dt)}
                          {b.assignee_name && ` · ${b.assignee_name}`}
                        </div>
                      </div>
                      <StatusBadge status={b.status} />
                      <DDay dt={b.close_dt} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title={`내 담당 (${mine.length})`} className="lg:col-span-2">
              {mine.length === 0 ? (
                <p className="text-sm text-slate-500">담당으로 지정된 진행 중 입찰이 없습니다.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {mine.slice(0, 8).map((b) => (
                    <li key={b.id} className="flex items-center gap-2">
                      <StatusBadge status={b.status} />
                      <Link to={`/bids/${b.id}`} className="min-w-0 flex-1 truncate hover:text-brand-600">
                        {b.title}
                      </Link>
                      <DDay dt={b.close_dt} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-5">
            <Card
              className="lg:col-span-3"
              title={
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-amber-500" /> 추천 신규 공고 ({recs.data?.length ?? 0})
                </span>
              }
              actions={<RunSavedButton onDone={recs.reload} />}
            >
              {!recs.data?.length ? (
                <p className="text-sm text-slate-500">
                  <Link to="/search" className="text-brand-600 underline">공고 검색</Link>에서 자주 보는 조건을 저장(🔖)하면, 매일 아침 새 공고를 찾아 여기에 보여 줍니다.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {recs.data.slice(0, 12).map((n) => (
                    <li key={`${n.bidNo}-${n.bidOrd}`} className="flex items-center gap-3 py-2 text-sm">
                      <button className="min-w-0 flex-1 text-left" onClick={() => nav(`/notices/${n.bidNo}-${n.bidOrd}?category=${encodeURIComponent(n.category)}`)}>
                        <div className="truncate font-medium hover:text-brand-600">{n.title}</div>
                        <div className="text-xs text-slate-500">
                          {n.demandOrg || n.org} · {won(n.estPrice ?? n.budget)} · <span className="text-amber-700">{n.searchName}</span>
                        </div>
                      </button>
                      <DDay dt={n.closeDt} />
                      <button
                        aria-label="추천에서 숨기기"
                        title="숨기기"
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        onClick={async () => {
                          await api.send("POST", `/recommendations/${n.bidNo}-${n.bidOrd}/dismiss`);
                          recs.reload();
                        }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="최근 활동" className="lg:col-span-2" actions={<Link to="/history" className="text-xs text-brand-600">전체 보기</Link>}>
              <ul className="space-y-2 text-sm">
                {data?.recent.map((h) => (
                  <li key={h.id}>
                    <div className="text-xs text-slate-400">
                      {utcToKst(h.at)} {h.user_name && `· ${h.user_name}`}
                    </div>
                    <div>
                      <b className="font-medium">{h.action}</b>
                      {h.detail && <span className="text-slate-600"> · {h.detail}</span>}
                    </div>
                    {h.bid_id && h.bid_title && (
                      <Link to={`/bids/${h.bid_id}`} className="block truncate text-xs text-brand-600">
                        {h.bid_title}
                      </Link>
                    )}
                  </li>
                ))}
                {!data?.recent.length && <li className="text-slate-500">아직 기록이 없습니다.</li>}
              </ul>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
