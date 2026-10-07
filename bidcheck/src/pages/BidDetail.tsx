import clsx from "clsx";
import { ArrowLeft, FileText, Rocket, Send, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  BID_STATUSES,
  STATUS_DESC,
  STATUS_LABEL,
  type AnalysisRecord,
  type Bid,
  type BidFile,
  type BidStatus,
  type Comment,
  type G2BNotice,
  type HistoryEntry,
  type Proposal,
} from "../../shared/types";
import { AnalysisView } from "../components/AnalysisView";
import { BidFiles } from "../components/BidFiles";
import { NoticeAttachments, NoticeFields } from "../components/NoticeInfo";
import { ProposalPanel } from "../components/ProposalPanel";
import { Button, Card, DDay, ErrorBox, RecBadge, ScoreBadge, Spinner, StatusBadge, inputBase, inputCls } from "../components/ui";
import { api } from "../lib/api";
import { shortDt, utcToKst, won } from "../lib/format";
import { useMe } from "../lib/me";
import { useAsync } from "../lib/useAsync";

export interface BidDetailData {
  bid: Bid;
  notice: G2BNotice | null;
  files: BidFile[];
  analyses: AnalysisRecord[];
  proposals: Proposal[];
  history: HistoryEntry[];
  comments: Comment[];
}

const TABS = [
  { key: "overview", label: "공고 개요" },
  { key: "files", label: "첨부파일" },
  { key: "analysis", label: "결과보고서" },
  { key: "proposal", label: "제안서 초안" },
  { key: "history", label: "히스토리" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default function BidDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get("tab") as Tab) || "overview";
  const auto = sp.get("auto") === "1";
  const setTab = (t: Tab, extra?: Record<string, string>) => setSp({ tab: t, ...extra }, { replace: true });
  const { data, error, loading, reload } = useAsync(() => api.get<BidDetailData>(`/bids/${id}`), [id]);
  const users = useAsync(() => api.get<{ id: string; name: string }[]>("/users"), []);
  const [err, setErr] = useState<unknown>(null);

  if (loading && !data) return <Spinner />;
  if (!data) return <ErrorBox error={error ?? "입찰을 찾을 수 없습니다."} />;
  const { bid } = data;
  const hasReport = data.analyses.length > 0;

  async function patch(body: Record<string, unknown>) {
    setErr(null);
    try {
      await api.send("PATCH", `/bids/${id}`, body);
      reload();
    } catch (e) {
      setErr(e);
    }
  }

  async function promote() {
    await patch({ status: "in_progress" });
    if (!data?.proposals.length && confirm("입찰 진행으로 바꿨습니다. 제안서 초안도 바로 작성할까요?")) setTab("proposal", { auto: "1" });
  }

  async function remove() {
    if (!confirm(`'${bid.title}' 입찰과 첨부·결과보고서·제안서를 모두 삭제할까요?`)) return;
    await api.send("DELETE", `/bids/${id}`);
    nav("/bids");
  }

  return (
    <div className="space-y-4">
      <Link to="/bids" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 print:hidden">
        <ArrowLeft className="h-4 w-4" /> 입찰 관리
      </Link>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm print:hidden">
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
              {bid.demand_org && bid.demand_org !== bid.org && ` / ${bid.demand_org}`} · {won(bid.est_price ?? bid.budget)} · 마감 {shortDt(bid.close_dt)}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setTab("analysis", hasReport ? {} : { auto: "1" })}>
              <Sparkles className="h-4 w-4" /> {hasReport ? "결과보고서" : "적합도 분석"}
            </Button>
            {hasReport && (
              <Button variant="secondary" onClick={() => setTab("proposal", data.proposals.length ? {} : { auto: "1" })}>
                <FileText className="h-4 w-4" /> 제안서 초안 작성
              </Button>
            )}
            {(bid.status === "interest" || bid.status === "analyzed") && (
              <Button variant="secondary" onClick={promote}>
                <Rocket className="h-4 w-4" /> 입찰 진행
              </Button>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-sm">
          <label className="flex items-center gap-1.5">
            <span className="text-slate-500">상태</span>
            <select className={`${inputBase} w-auto py-1`} value={bid.status} title={STATUS_DESC[bid.status]} onChange={(e) => patch({ status: e.target.value as BidStatus })}>
              {BID_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-slate-500">담당자</span>
            <select className={`${inputBase} w-auto py-1`} value={bid.assignee ?? ""} onChange={(e) => patch({ assignee: e.target.value || null })}>
              <option value="">미지정</option>
              {users.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <span className="text-xs text-slate-400">{STATUS_DESC[bid.status]}</span>
          <Button variant="ghost" size="sm" className="ml-auto text-red-600" onClick={remove}>
            <Trash2 className="h-4 w-4" /> 삭제
          </Button>
        </div>
        <ErrorBox error={err} />
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 print:hidden">
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
            {t.key === "analysis" && hasReport && ` (${data.analyses.length})`}
            {t.key === "proposal" && data.proposals.length > 0 && ` (v${data.proposals[0].version})`}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview data={data} onChange={reload} onGo={setTab} />}
      {tab === "files" && <BidFiles bid={bid} files={data.files} onChange={reload} />}
      {tab === "analysis" && <AnalysisView bid={bid} files={data.files} analyses={data.analyses} autoStart={auto} onDone={reload} />}
      {tab === "proposal" && (
        <ProposalPanel bid={bid} files={data.files} proposals={data.proposals} hasAnalysis={hasReport} autoStart={auto} onChange={reload} />
      )}
      {tab === "history" && (
        <Card>
          <ul className="space-y-2 text-sm">
            {data.history.map((h) => (
              <li key={h.id} className="flex flex-wrap gap-x-3">
                <span className="w-36 shrink-0 text-xs text-slate-400">{utcToKst(h.at)}</span>
                <span>
                  <b className="font-medium">{h.action}</b>
                  {h.detail && <span className="text-slate-600"> · {h.detail}</span>}
                  {h.user_name && <span className="text-xs text-slate-400"> — {h.user_name}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Overview({ data, onChange, onGo }: { data: BidDetailData; onChange: () => void; onGo: (t: Tab, extra?: Record<string, string>) => void }) {
  const { bid } = data;
  const raw = (() => {
    try {
      return bid.raw_json ? (JSON.parse(bid.raw_json) as Record<string, unknown> & { _attachments?: { name: string; url: string }[]; _extra?: G2BNotice["extra"] }) : null;
    } catch {
      return null;
    }
  })();
  const attachments = raw?._attachments ?? [];
  const latest = data.analyses[0];

  const steps = [
    { done: data.files.length > 0, label: "제안요청서·공고문 확보", tab: "files" as Tab },
    { done: data.analyses.length > 0, label: "적합도 분석 → 결과보고서", tab: "analysis" as Tab },
    { done: ["in_progress", "submitted", "won", "lost"].includes(bid.status), label: "참여 결정 (입찰 진행)", tab: "overview" as Tab },
    { done: data.proposals.length > 0, label: "제안서 초안 작성", tab: "proposal" as Tab },
    { done: ["submitted", "won", "lost"].includes(bid.status), label: "입찰·제안서 제출", tab: "overview" as Tab },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {latest && (
          <Card title="결과보고서 요약" actions={<button className="text-xs text-brand-600 underline" onClick={() => onGo("analysis")}>전체 보기</button>}>
            <p className="leading-7 text-slate-800">{latest.result.executive_summary}</p>
            <p className="mt-2 text-xs text-slate-500">{utcToKst(latest.created_at)} 분석</p>
          </Card>
        )}
        <Card title={`공고 첨부파일 (${attachments.length})`}>
          <NoticeAttachments attachments={attachments} />
          {data.files.length > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              BidCheck 에 저장된 파일 {data.files.length}개는{" "}
              <button className="text-brand-600 underline" onClick={() => onGo("files")}>
                첨부파일 탭
              </button>
              에서 받을 수 있습니다.
            </p>
          )}
        </Card>
        {raw ? (
          <NoticeFields notice={{ raw, extra: raw._extra ?? undefined }} />
        ) : (
          <Card title="공고 정보">
            <p className="text-sm text-slate-500">수동 등록한 공고입니다.</p>
          </Card>
        )}
      </div>
      <div className="space-y-4">
        <Card title="진행 단계">
          <ol className="space-y-2 text-sm">
            {steps.map((s, i) => (
              <li key={s.label}>
                <button className="flex items-center gap-2 text-left" onClick={() => onGo(s.tab)}>
                  <span
                    className={clsx(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold",
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
        </Card>
        <Comments bidId={bid.id} comments={data.comments} onChange={onChange} />
        <Memo bid={bid} onChange={onChange} />
      </div>
    </div>
  );
}

function Comments({ bidId, comments, onChange }: { bidId: string; comments: Comment[]; onChange: () => void }) {
  const me = useMe();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Card title={`팀 의견 (${comments.length})`}>
      <ul className="max-h-80 space-y-3 overflow-y-auto text-sm">
        {comments.map((c) => (
          <li key={c.id}>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <b className="text-slate-700">{c.user_name ?? c.user_id ?? "?"}</b> {utcToKst(c.created_at)}
              {(c.user_id === me?.id || me?.role === "admin") && (
                <button
                  className="ml-auto text-slate-400 hover:text-red-600"
                  onClick={async () => {
                    if (!confirm("이 의견을 삭제할까요?")) return;
                    await api.send("DELETE", `/comments/${c.id}`);
                    onChange();
                  }}
                >
                  삭제
                </button>
              )}
            </div>
            <p className="mt-0.5 whitespace-pre-wrap">{c.body}</p>
          </li>
        ))}
        {!comments.length && <li className="text-slate-400">참여 여부, 영업 정보 등을 팀과 공유하세요.</li>}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!body.trim()) return;
          setBusy(true);
          try {
            await api.send("POST", `/bids/${bidId}/comments`, { body });
            setBody("");
            onChange();
          } finally {
            setBusy(false);
          }
        }}
      >
        <input className={inputCls} value={body} onChange={(e) => setBody(e.target.value)} placeholder="의견 남기기" />
        <Button type="submit" size="sm" loading={busy} aria-label="등록">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </Card>
  );
}

function Memo({ bid, onChange }: { bid: Bid; onChange: () => void }) {
  const [memo, setMemo] = useState(bid.memo ?? "");
  const [saving, setSaving] = useState(false);
  useEffect(() => setMemo(bid.memo ?? ""), [bid.memo]);
  return (
    <Card title="메모">
      <textarea className={`${inputCls} h-24`} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="담당자 메모" />
      <Button
        size="sm"
        className="mt-2"
        loading={saving}
        disabled={memo === (bid.memo ?? "")}
        onClick={async () => {
          setSaving(true);
          await api.send("PATCH", `/bids/${bid.id}`, { memo }).finally(() => setSaving(false));
          onChange();
        }}
      >
        저장
      </Button>
    </Card>
  );
}
