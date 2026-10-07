import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { BID_STATUSES, STATUS_LABEL, type Bid, type BidStatus, type HistoryEntry } from "../../shared/types";
import { Card, DDay, ErrorBox, ScoreBadge, Spinner, StatusBadge } from "../components/ui";
import { api } from "../lib/api";
import { parseDt, shortDt, utcToKst } from "../lib/format";
import { useAsync } from "../lib/useAsync";

interface Dash {
  counts: { status: BidStatus; n: number }[];
  active: Bid[];
  recent: HistoryEntry[];
}
interface Health {
  g2b: boolean;
  claude: boolean;
  auth: boolean;
  model: string;
}

export default function Dashboard() {
  const { data, error, loading } = useAsync(() => api.get<Dash>("/dashboard"), []);
  const health = useAsync(() => api.get<Health>("/health"), []);

  const count = (s: BidStatus) => data?.counts.find((c) => c.status === s)?.n ?? 0;
  const now = Date.now() - 86400000;
  const upcoming = (data?.active ?? [])
    .map((b) => ({ b, t: parseDt(b.close_dt)?.getTime() ?? 0 }))
    .filter((x) => x.t >= now)
    .sort((a, b) => a.t - b.t)
    .slice(0, 10)
    .map((x) => x.b);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900">대시보드</h1>

      {health.data && (!health.data.g2b || !health.data.claude) && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            서버 설정이 완료되지 않았습니다:{" "}
            {!health.data.g2b && <b>G2B_SERVICE_KEY(공공데이터포털 인증키) </b>}
            {!health.data.claude && <b>ANTHROPIC_API_KEY(Claude API 키)</b>}. README 의 배포 안내를 참고하세요.
          </div>
        </div>
      )}
      {health.data?.g2b && health.data.claude && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> 나라장터 API · Claude ({health.data.model}) 연결 설정됨
        </div>
      )}

      <ErrorBox error={error} />
      {loading && !data ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {BID_STATUSES.map((s) => (
              <Link
                key={s}
                to={`/bids?status=${s}`}
                className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:border-brand-500"
              >
                <div className="text-xs text-slate-500">{STATUS_LABEL[s]}</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{count(s)}</div>
              </Link>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-5">
            <Card title="마감 임박 입찰" className="lg:col-span-3">
              {upcoming.length === 0 ? (
                <p className="text-sm text-slate-500">
                  마감 예정인 관심 입찰이 없습니다. <Link className="text-brand-600 underline" to="/search">공고 검색</Link>에서 관심 입찰을 등록하세요.
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
                        </div>
                      </div>
                      <StatusBadge status={b.status} />
                      <DDay dt={b.close_dt} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="최근 활동" className="lg:col-span-2" actions={<Link to="/history" className="text-xs text-brand-600">전체 보기</Link>}>
              <ul className="space-y-2 text-sm">
                {data?.recent.map((h) => (
                  <li key={h.id}>
                    <div className="text-xs text-slate-400">{utcToKst(h.at)}</div>
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
