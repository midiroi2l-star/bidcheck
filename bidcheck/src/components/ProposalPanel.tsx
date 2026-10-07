import { Download, FileDown, Pencil, Save, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Bid, Proposal } from "../../shared/types";
import { api, saveBlob } from "../lib/api";
import { exportProposalDocx } from "../lib/docx";
import { utcToKst } from "../lib/format";
import { renderMarkdown } from "../lib/markdown";
import { Button, Card, ErrorBox, inputCls, inputBase } from "./ui";

export function ProposalPanel({
  bid,
  proposals,
  hasAnalysis,
  autoStart,
  onAutoStarted,
  onChange,
}: {
  bid: Bid;
  proposals: Proposal[];
  hasAnalysis: boolean;
  autoStart: boolean;
  onAutoStarted: () => void;
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
  const [saving, setSaving] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    setDraft(current?.content_md ?? "");
    setEditing(false);
  }, [current?.id, current?.content_md]);

  async function generate() {
    setRunning(true);
    setErr(null);
    setLive("");
    setStatus("요청 중…");
    try {
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
    if (autoStart && !started.current) {
      started.current = true;
      onAutoStarted();
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const fname = `제안서초안_${bid.title.slice(0, 40).replace(/[\\/:*?"<>|]/g, "_")}_v${current?.version ?? 1}`;

  return (
    <div className="space-y-4">
      <Card>
        {bid.status === "interest" || bid.status === "analyzed" ? (
          <p className="mb-3 text-sm text-slate-600">입찰 진행으로 승격하면 제안서 초안이 자동으로 작성됩니다. 지금 바로 작성할 수도 있습니다.</p>
        ) : null}
        {!hasAnalysis && <p className="mb-3 text-sm text-amber-700">AI 분석을 먼저 실행하면 평가항목·배점을 반영한 초안이 작성됩니다.</p>}
        <textarea
          className={`${inputCls} h-20`}
          placeholder="추가 지시사항 (선택) — 예: 클라우드 전환 경험을 강조, 3장은 15쪽 이내, 우리 회사 솔루션 OOO 적용 방안 포함"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Button onClick={generate} loading={running}>
            <Sparkles className="h-4 w-4" /> {proposals.length ? "새 버전 작성" : "제안서 초안 작성"}
          </Button>
          {running && <span className="text-sm text-slate-600">{status}</span>}
        </div>
        <ErrorBox error={err} />
      </Card>

      {running && live && (
        <Card title="작성 중…">
          <div className="prose-md max-h-[70vh] overflow-y-auto text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(live) }} />
        </Card>
      )}

      {!running && current && (
        <Card
          title={
            <span className="flex items-center gap-2">
              제안서 초안
              <select className={`${inputBase} w-auto py-0.5 text-xs`} value={current.id} onChange={(e) => setSelId(e.target.value)}>
                {proposals.map((p) => (
                  <option key={p.id} value={p.id}>
                    v{p.version} · {utcToKst(p.created_at)}
                  </option>
                ))}
              </select>
            </span>
          }
          actions={
            <>
              {editing ? (
                <Button
                  size="sm"
                  loading={saving}
                  onClick={async () => {
                    setSaving(true);
                    try {
                      await api.send("PUT", `/proposals/${current.id}`, { content_md: draft });
                      setEditing(false);
                      onChange();
                    } catch (e) {
                      setErr(e);
                    } finally {
                      setSaving(false);
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
              <Button size="sm" variant="secondary" onClick={() => exportProposalDocx(draft, bid.title, `${fname}.docx`)}>
                <FileDown className="h-3.5 w-3.5" /> Word
              </Button>
              <Button size="sm" variant="secondary" onClick={() => saveBlob(new Blob([draft], { type: "text/markdown;charset=utf-8" }), `${fname}.md`)}>
                <Download className="h-3.5 w-3.5" /> MD
              </Button>
            </>
          }
        >
          {editing ? (
            <textarea className={`${inputCls} h-[70vh] font-mono text-xs`} value={draft} onChange={(e) => setDraft(e.target.value)} />
          ) : (
            <div className="prose-md text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(draft) }} />
          )}
        </Card>
      )}
    </div>
  );
}
