import { ArrowLeft, ArrowRight, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { STATUS_LABEL, type BidStatus, type G2BNotice } from "../../shared/types";
import { NoticeAttachments, NoticeFields } from "../components/NoticeInfo";
import { Badge, Button, Card, DDay, ErrorBox, Spinner } from "../components/ui";
import { api } from "../lib/api";
import { shortDt, won } from "../lib/format";
import { useAsync } from "../lib/useAsync";

type NoticeView = G2BNotice & { savedId: string | null; savedStatus: BidStatus | null };

export default function NoticeDetail() {
  const { id = "" } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { data: n, error, loading } = useAsync(
    () => api.get<NoticeView>(`/notices/${encodeURIComponent(id)}?category=${encodeURIComponent(sp.get("category") ?? "")}`),
    [id],
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);

  if (loading && !n) return <Spinner label="공고 정보를 불러오는 중…" />;
  if (!n) return <ErrorBox error={error ?? "공고를 찾을 수 없습니다."} />;

  async function register(then: "stay" | "analyze") {
    setErr(null);
    setBusy(then);
    try {
      const bid = await api.send<{ id: string }>("POST", "/bids", { noticeId: id });
      nav(then === "analyze" ? `/bids/${bid.id}?tab=analysis&auto=1` : `/bids/${bid.id}`);
    } catch (e) {
      setErr(e);
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <button onClick={() => nav(-1)} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> 검색 결과로
      </button>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-slate-50 text-slate-600 ring-slate-200">{n.category}</Badge>
              <DDay dt={n.closeDt} />
              {n.savedStatus && <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">{STATUS_LABEL[n.savedStatus]}</Badge>}
              <span className="text-xs text-slate-500">
                {n.bidNo}-{n.bidOrd}
              </span>
            </div>
            <h1 className="mt-1 text-lg font-bold text-slate-900">{n.title}</h1>
            <div className="mt-1 text-sm text-slate-600">
              {n.org}
              {n.demandOrg && n.demandOrg !== n.org && ` / ${n.demandOrg}`} · {won(n.estPrice ?? n.budget)} · 마감 {shortDt(n.closeDt)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {n.savedId ? (
              <Button onClick={() => nav(`/bids/${n.savedId}`)}>
                입찰 관리에서 보기 <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button variant="secondary" loading={busy === "stay"} disabled={!!busy} onClick={() => register("stay")}>
                  <Plus className="h-4 w-4" /> 관심 등록
                </Button>
                <Button loading={busy === "analyze"} disabled={!!busy} onClick={() => register("analyze")}>
                  <Sparkles className="h-4 w-4" /> 적합도 분석
                </Button>
              </>
            )}
          </div>
        </div>
        <ErrorBox error={err} />
      </div>

      <Card title={`첨부파일 (${n.attachments.length})`}>
        <NoticeAttachments attachments={n.attachments} />
      </Card>

      <NoticeFields notice={n} />
    </div>
  );
}
