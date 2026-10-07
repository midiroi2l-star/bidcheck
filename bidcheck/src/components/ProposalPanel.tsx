import { Download, FileDown, Pencil, Printer, Save, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Bid, BidFile, Proposal } from "../../shared/types";
import { api, saveBlob } from "../lib/api";
import { utcToKst } from "../lib/format";
import { ensureAttachments } from "./AnalysisView";
import { RichMarkdown } from "./RichMarkdown";
import { Button, Card, ErrorBox, inputBase, inputCls } from "./ui";

export function ProposalPanel({
  bid,
  files,
  proposals,
  hasAnalysis,
  autoStart,
  onChange,
}: {
  bid: Bid;
  files: BidFile[];
  proposals: Proposal[];
  hasAnalysis: boolean;
  autoStart?: boolean;
  onChange: () => void;
}) {
  const [selId, setSelId] = useState<string | null>(proposals[0]?.id ?? null);
  const current = proposals.find((p) => p.id === selId) ?? proposals[0] ?? null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(current?.content_md ?? "");
  const [instructions, setInstructions] = useState("");
  const [running, setRunning] = useState(false);
  const [live, setLive] = useState("");
  const [status, setStatus] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    setDraft(current?.content_md ?? "");
    setEditing(false);
  }, [current?.id, current?.content_md]);

  async function generate() {
    setRunning(true);
    setErr(null);
    setLive("");
    try {
      await ensureAttachments(bid, files, setStatus);
      setStatus("요청 중…");
      const res = await api.stream<{ id: string }>(`/bids/${bid.id}/proposal`, { instructions }, (e) => {
        if (e.type === "delta") setLive((s) => s + e.text);
        else if (e.type === "status" && e.message) setStatus(e.message);
      });
      setSelId(res.id);
      onChange();
    } catch (e) {
      setErr(e);
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    if (autoStart && !started.current && !proposals.length) {
      started.current = true;
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const fname = `제안서초안_${bid.title.slice(0, 40).replace(/[\\/:*?"<>|]/g, "_")}_v${current?.version ?? 1}`;

  return (
    <div className="space-y-4">
      <Card className="print:hidden">
        {!hasAnalysis && <p className="mb-3 text-sm text-amber-700">적합도 분석(결과보고서)을 먼저 하면 평가항목·배점·수주 전략을 반영한 초안이 나옵니다.</p>}
        <textarea
          className={`${inputCls} h-20`}
          placeholder="추가 지시사항 (선택) — 예: 클라우드 전환 경험 강조, 3장은 15쪽 분량, 당사 솔루션 OOO 적용 방안 포함"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Button onClick={generate} loading={running}>
            <Sparkles className="h-4 w-4" /> {proposals.length ? "새 버전 작성" : "제안서 초안 작성"}
          </Button>
          {running && <span className="text-sm text-slate-600">{status}</span>}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          제안요청서 목차와 요구사항을 모두 반영하고, 표·다이어그램·차트와 요구사항 대응표·추가 제언을 넣어 작성합니다. 분량에 따라 3~10분 걸립니다.
        </p>
        <ErrorBox error={err} />
      </Card>

      {running && live && (
        <Card title="작성 중…">
          <div className="max-h-[75vh] overflow-y-auto text-sm">
            <RichMarkdown src={live} />
          </div>
        </Card>
      )}

      {!running && current && (
        <Card
          className="print:border-0 print:shadow-none"
          title={
            <span className="flex flex-wrap items-center gap-2">
              제안서 초안
              <select className={`${inputBase} w-auto py-0.5 text-xs print:hidden`} value={current.id} onChange={(e) => setSelId(e.target.value)}>
                {proposals.map((p) => (
                  <option key={p.id} value={p.id}>
                    v{p.version} · {utcToKst(p.created_at)}
                  </option>
                ))}
              </select>
            </span>
          }
          actions={
            <div className="flex flex-wrap gap-2 print:hidden">
              {editing ? (
                <Button
                  size="sm"
                  loading={busy === "save"}
                  onClick={async () => {
                    setBusy("save");
                    try {
                      await api.send("PUT", `/proposals/${current.id}`, { content_md: draft });
                      setEditing(false);
                      onChange();
                    } catch (e) {
                      setErr(e);
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  <Save className="h-3.5 w-3.5" /> 저장
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5" /> 편집
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                loading={busy === "docx"}
                onClick={async () => {
                  setBusy("docx");
                  setErr(null);
                  try {
                    const { exportProposalDocx } = await import("../lib/docx");
                    await exportProposalDocx(draft, bid.title, `${fname}.docx`, setStatus);
                  } catch (e) {
                    setErr(e);
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                <FileDown className="h-3.5 w-3.5" /> Word
              </Button>
              <Button size="sm" variant="secondary" onClick={() => window.print()}>
                <Printer className="h-3.5 w-3.5" /> 인쇄·PDF
              </Button>
              <Button size="sm" variant="ghost" onClick={() => saveBlob(new Blob([draft], { type: "text/markdown;charset=utf-8" }), `${fname}.md`)}>
                <Download className="h-3.5 w-3.5" /> MD
              </Button>
            </div>
          }
        >
          {busy === "docx" && <p className="mb-2 text-xs text-slate-500 print:hidden">{status}</p>}
          {editing ? (
            <textarea className={`${inputCls} h-[70vh] font-mono text-xs`} value={draft} onChange={(e) => setDraft(e.target.value)} />
          ) : (
            <div className="text-sm">
              <RichMarkdown src={draft} />
            </div>
          )}
        </Card>
      )}
      {!running && !current && <p className="text-sm text-slate-500">아직 제안서 초안이 없습니다.</p>}
    </div>
  );
}
