import { Printer, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { AnalysisRecord, Bid, BidFile } from "../../shared/types";
import { api } from "../lib/api";
import { utcToKst } from "../lib/format";
import { backfillText } from "../lib/upload";
import { Report } from "./Report";
import { Button, Card, ErrorBox, inputBase } from "./ui";

/** 나라장터 첨부가 아직 없으면 먼저 내려받아 텍스트를 추출한다 */
export async function ensureAttachments(bid: Bid, files: BidFile[], setStatus: (s: string) => void) {
  const raw = bid.raw_json ? (JSON.parse(bid.raw_json) as { _attachments?: unknown[] }) : {};
  if (files.length || !raw._attachments?.length) return;
  setStatus("나라장터 첨부파일 가져오는 중…");
  const res = await api.send<{ results: { name: string; id?: string }[] }>("POST", `/bids/${bid.id}/fetch-attachments`);
  for (const r of res.results) {
    if (!r.id) continue;
    setStatus(`${r.name} 내용 읽는 중…`);
    await backfillText(`/bid-files/${r.id}`, `/bid-files/${r.id}/text`, r.name).catch(() => undefined);
  }
}

export function AnalysisView({
  bid,
  files,
  analyses,
  autoStart,
  onDone,
}: {
  bid: Bid;
  files: BidFile[];
  analyses: AnalysisRecord[];
  autoStart?: boolean;
  onDone: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const [selected, setSelected] = useState(0);
  const [checklist, setChecklist] = useState<Record<string, boolean>>(() => {
    try {
      return bid.checklist ? JSON.parse(bid.checklist) : {};
    } catch {
      return {};
    }
  });
  const started = useRef(false);
  const rec = analyses[selected];

  async function run() {
    setRunning(true);
    setErr(null);
    try {
      await ensureAttachments(bid, files, setStatus);
      setStatus("분석 요청 중…");
      await api.stream(`/bids/${bid.id}/analyze`, {}, (e) => {
        if (e.type === "status" && e.message) setStatus(e.message);
      });
      setSelected(0);
      onDone();
    } catch (e) {
      setErr(e);
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    if (autoStart && !started.current && !analyses.length) {
      started.current = true;
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  return (
    <div className="space-y-4">
      <Card className="print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={run} loading={running}>
            <Sparkles className="h-4 w-4" /> {analyses.length ? "다시 분석" : "적합도 분석"}
          </Button>
          {rec && !running && (
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> 인쇄 / PDF 저장
            </Button>
          )}
          {running && <span className="text-sm text-slate-600">{status}</span>}
          {analyses.length > 1 && (
            <select className={`${inputBase} ml-auto w-auto`} value={selected} onChange={(e) => setSelected(Number(e.target.value))}>
              {analyses.map((a, i) => (
                <option key={a.id} value={i}>
                  {i === 0 ? "최신 · " : ""}
                  {utcToKst(a.created_at)} · {a.fit_score}점
                </option>
              ))}
            </select>
          )}
        </div>
        <ErrorBox error={err} />
        <p className="mt-2 text-xs text-slate-500">
          제안요청서·공고문과 <Link to="/company" className="text-brand-600 underline">회사 정보·서류</Link>를 바탕으로 분석하며, 끝나면 결과보고서가 자동 저장되고 이 공고는
          ‘결과서’ 상태가 됩니다. 문서 분량에 따라 1~5분 걸립니다.
        </p>
      </Card>

      {rec ? (
        <Report
          r={rec.result}
          bid={bid}
          createdAt={utcToKst(rec.created_at)}
          checklist={checklist}
          onToggleDoc={(name, v) => {
            const next = { ...checklist, [name]: v };
            setChecklist(next);
            api.send("PATCH", `/bids/${bid.id}`, { checklist: next }).catch(setErr);
          }}
        />
      ) : (
        !running && <p className="text-sm text-slate-500">아직 결과보고서가 없습니다. [적합도 분석]을 눌러 주세요.</p>
      )}
    </div>
  );
}
