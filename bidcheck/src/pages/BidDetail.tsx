import clsx from "clsx";
import { ArrowLeft, ExternalLink, Rocket, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  BID_STATUSES,
  STATUS_LABEL,
  type AnalysisRecord,
  type Bid,
  type BidFile,
  type BidStatus,
  type HistoryEntry,
  type Proposal,
} from "../../shared/types";
import { AnalysisView } from "../components/AnalysisView";
import { BidFiles } from "../components/BidFiles";
import { ProposalPanel } from "../components/ProposalPanel";
import { Button, Card, DDay, ErrorBox, RecBadge, ScoreBadge, Spinner, StatusBadge, inputCls, inputBase } from "../components/ui";
import { api } from "../lib/api";
import { shortDt, utcToKst, won } from "../lib/format";
import { useAsync } from "../lib/useAsync";

export interface BidDetailData {
  bid: Bid;
  files: BidFile[];
  analyses: AnalysisRecord[];
  proposals: Proposal[];
  history: HistoryEntry[];
}

const TABS = [
  { key: "overview", label: "개요" },
  { key: "files", label: "첨부파일" },
  { key: "analysis", label: "AI 분석" },
  { key: "proposal", label: "제안서 초안" },
  { key: "history", label: "히스토리" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default function BidDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get("tab") as Tab) || "overview";
  const setTab = (t: Tab) => setSp({ tab: t }, { replace: true });
  const { data, error, loading, reload } = useAsync(() => api.get<BidDetailData>(`/bids/${id}`), [id]);
  const [err, setErr] = useState<unknown>(null);
  const [autoDraft, setAutoDraft] = useState(false);

  if (loading && !data) return <Spinner />;
  if (!data) return <ErrorBox error={error ?? "입찰을 찾을 수 없습니다."} />;
  const { bid } = data;

  async function setStatus(s: BidStatus) {
    setErr(null);
    try {
      await api.send("PATCH", `/bids/${id}`, { status: s });
      if (s === "in_progress" && data && data.proposals.length === 0) {
        // 입찰 진행으로 승격하면 제안서 초안 작성을 바로 시작한다
        setAutoDraft(true);
        setTab("proposal");
      }
      reload();
    } catch (e) {
      setErr(e);
    }
  }

  async function remove() {
    if (!confirm(`'${bid.title}' 입찰과 첨부·분석·제안서를 모두 삭제할까요?`)) return;
    await api.send("DELETE", `/bids/${id}`);
    nav("/bids");
  }

  const latest = data.analyses[0] ?? null;

  return (
    <div className="space-y-4">
      <Link to="/bids" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> 목록
      </Link>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          <ScoreBadge score={bid.fit_score} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={bid.status} />
              <RecBadge rec={bid.recommendation} />
              <DDay dt={bid.close_dt} />
              <span className="text-xs text-slate-500">
                {bid.category} · {bid.id}
              </span>
            </div>
            <h1 className="mt-1 text-lg font-bold text-slate-900">{bid.title}</h1>
            <div className="mt-1 text-sm text-slate-600">
              {bid.org}
              {bid.demand_org && bid.demand_org !== bid.org && ` / ${bid.demand_org}`} · {won(bid.est_price ?? bid.budget)} · 마감{" "}
              {shortDt(bid.close_dt)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(bid.status === "interest" || bid.status === "analyzed") && (
              <Button onClick={() => setStatus("in_progress")}>
                <Rocket className="h-4 w-4" /> 입찰 진행으로 승격
              </Button>
            )}
            <select
              className={`${inputBase} w-auto`}
              value={bid.status}
              onChange={(e) => setStatus(e.target.value as BidStatus)}
              aria-label="상태 변경"
            >
              {BID_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <Button variant="danger" onClick={remove} aria-label="삭제">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <ErrorBox error={err} />

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              "whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium",
              tab === t.key ? "border-brand-700 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {t.label}
            {t.key === "files" && ` (${data.files.length})`}
            {t.key === "proposal" && data.proposals.length > 0 && ` (v${data.proposals[0].version})`}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview data={data} onMemo={reload} onGo={setTab} />}
      {tab === "files" && <BidFiles bid={bid} files={data.files} onChange={reload} />}
      {tab === "analysis" && <AnalysisView bid={bid} analyses={data.analyses} hasFiles={data.files.length > 0} onDone={reload} />}
      {tab === "proposal" && (
        <ProposalPanel
          bid={bid}
          proposals={data.proposals}
          hasAnalysis={!!latest}
          autoStart={autoDraft}
          onAutoStarted={() => setAutoDraft(false)}
          onChange={reload}
        />
      )}
      {tab === "history" && (
        <Card>
          <ul className="space-y-2 text-sm">
            {data.history.map((h) => (
              <li key={h.id} className="flex gap-3">
                <span className="w-36 shrink-0 text-xs text-slate-400">{utcToKst(h.at)}</span>
                <span>
                  <b className="font-medium">{h.action}</b>
                  {h.detail && <span className="text-slate-600"> · {h.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Overview({ data, onMemo, onGo }: { data: BidDetailData; onMemo: () => void; onGo: (t: Tab) => void }) {
  const { bid } = data;
  const [memo, setMemo] = useState(bid.memo ?? "");
  const [saving, setSaving] = useState(false);
  useEffect(() => setMemo(bid.memo ?? ""), [bid.memo]);
  const latest = data.analyses[0];

  const rows: [string, React.ReactNode][] = [
    ["공고번호", `${bid.bid_no}-${bid.bid_ord}`],
    ["공고기관", bid.org],
    ["수요기관", bid.demand_org],
    ["공고일시", shortDt(bid.notice_dt)],
    ["입찰마감", shortDt(bid.close_dt)],
    ["개찰일시", shortDt(bid.open_dt)],
    ["추정가격", won(bid.est_price)],
    ["배정예산", won(bid.budget)],
    ["계약방법", bid.contract_method],
    ["낙찰방법", bid.award_method],
  ];

  const steps = [
    { done: data.files.length > 0, label: "제안요청서·공고문 첨부", tab: "files" as Tab },
    { done: data.analyses.length > 0, label: "AI 분석 (적합도·자격·신인도)", tab: "analysis" as Tab },
    { done: ["in_progress", "submitted", "won", "lost"].includes(bid.status), label: "입찰 진행으로 승격", tab: "overview" as Tab },
    { done: data.proposals.length > 0, label: "제안서 초안 작성", tab: "proposal" as Tab },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="공고 정보" className="lg:col-span-2" actions={bid.detail_url && (
        <a href={bid.detail_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-600">
          나라장터에서 보기 <ExternalLink className="h-3 w-3" />
        </a>
      )}>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex gap-3">
              <dt className="w-20 shrink-0 text-slate-500">{k}</dt>
              <dd className="text-slate-900">{v || "-"}</dd>
            </div>
          ))}
        </dl>
        {latest && (
          <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm">
            <div className="mb-1 font-medium">최근 분석 요약 ({utcToKst(latest.created_at)})</div>
            <p className="text-slate-700">{latest.result.overview.purpose}</p>
            <button className="mt-1 text-xs text-brand-600 underline" onClick={() => onGo("analysis")}>
              분석 결과 보기
            </button>
          </div>
        )}
      </Card>
      <div className="space-y-4">
        <Card title="진행 단계">
          <ol className="space-y-2 text-sm">
            {steps.map((s, i) => (
              <li key={s.label}>
                <button className="flex items-center gap-2 text-left" onClick={() => onGo(s.tab)}>
                  <span
                    className={clsx(
                      "flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold",
                      s.done ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600",
                    )}
                  >
                    {s.done ? "✓" : i + 1}
                  </span>
                  <span className={s.done ? "text-slate-500" : "font-medium"}>{s.label}</span>
                </button>
              </li>
            ))}
          </ol>
          {!data.analyses.length && (
            <Button className="mt-3 w-full" variant="secondary" onClick={() => onGo(data.files.length ? "analysis" : "files")}>
              <Sparkles className="h-4 w-4" /> {data.files.length ? "분석 시작하기" : "첨부파일 등록하기"}
            </Button>
          )}
        </Card>
        <Card title="메모">
          <textarea className={`${inputCls} h-28`} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="영업 정보, 담당자 의견 등" />
          <Button
            size="sm"
            className="mt-2"
            loading={saving}
            disabled={memo === (bid.memo ?? "")}
            onClick={async () => {
              setSaving(true);
              await api.send("PATCH", `/bids/${bid.id}`, { memo }).finally(() => setSaving(false));
              onMemo();
            }}
          >
            저장
          </Button>
        </Card>
      </div>
    </div>
  );
}
