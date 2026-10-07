import { CloudDownload, Download, FileText, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { FILE_KINDS, type Bid, type BidFile, type FileKind } from "../../shared/types";
import { api } from "../lib/api";
import { fileSize, utcToKst } from "../lib/format";
import { backfillText, uploadWithText } from "../lib/upload";
import { Badge, Button, Card, ErrorBox, inputBase } from "./ui";

const guessKind = (name: string): FileKind =>
  /제안요청|RFP/i.test(name) ? "rfp" : /공고/.test(name) ? "notice" : /과업|규격|시방/.test(name) ? "spec" : /서식|양식/.test(name) ? "form" : "other";

export function BidFiles({ bid, files, onChange }: { bid: Bid; files: BidFile[]; onChange: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);

  const attachments: { name: string; url: string }[] = (() => {
    try {
      return (JSON.parse(bid.raw_json ?? "{}") as { _attachments?: { name: string; url: string }[] })._attachments ?? [];
    } catch {
      return [];
    }
  })();

  async function upload(list: FileList | File[]) {
    setErr(null);
    const msgs: string[] = [];
    try {
      for (const f of Array.from(list)) {
        setBusy(`${f.name} 업로드 중…`);
        const { note } = await uploadWithText(`/bids/${bid.id}/files`, f, { kind: guessKind(f.name) });
        if (note && !f.name.toLowerCase().endsWith(".pdf")) msgs.push(`${f.name}: ${note}`);
      }
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(null);
      setNotes(msgs);
      onChange();
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function fetchFromG2B() {
    setErr(null);
    setBusy("나라장터에서 첨부파일 내려받는 중…");
    const msgs: string[] = [];
    try {
      const res = await api.send<{ total: number; results: { name: string; ok: boolean; error?: string; id?: string }[] }>(
        "POST",
        `/bids/${bid.id}/fetch-attachments`,
      );
      for (const r of res.results) {
        if (!r.ok) msgs.push(`${r.name}: 내려받기 실패 (${r.error}) — 나라장터에서 직접 받아 업로드하세요`);
        else if (r.id) {
          setBusy(`${r.name} 텍스트 추출 중…`);
          const note = await backfillText(`/bid-files/${r.id}`, `/bid-files/${r.id}/text`, r.name).catch((e: Error) => e.message);
          if (note && !r.name.toLowerCase().endsWith(".pdf")) msgs.push(`${r.name}: ${note}`);
        }
      }
      if (!res.total) msgs.push("나라장터 공고에 등록된 첨부 링크가 없습니다.");
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(null);
      setNotes(msgs);
      onChange();
    }
  }

  return (
    <div className="space-y-4">
      <Card
        title="공고 첨부파일"
        actions={
          <>
            {attachments.length > 0 && (
              <Button variant="secondary" onClick={fetchFromG2B} disabled={!!busy}>
                <CloudDownload className="h-4 w-4" /> 나라장터 첨부 자동 가져오기 ({attachments.length})
              </Button>
            )}
            <Button onClick={() => inputRef.current?.click()} disabled={!!busy}>
              <Upload className="h-4 w-4" /> 파일 업로드
            </Button>
          </>
        }
      >
        <input ref={inputRef} type="file" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} />
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
          }}
          className={`rounded-md border-2 border-dashed p-4 text-center text-sm ${drag ? "border-brand-500 bg-brand-50" : "border-slate-200 text-slate-500"}`}
        >
          {busy ?? "입찰공고문, 제안요청서, 과업지시서 등을 끌어다 놓으세요 (HWP · HWPX · PDF · DOCX · XLSX)"}
        </div>
        <ErrorBox error={err} />
        {notes.length > 0 && (
          <ul className="mt-3 space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}

        {files.length > 0 && (
          <ul className="mt-4 divide-y divide-slate-100">
            {files.map((f) => {
              const pdf = f.filename.toLowerCase().endsWith(".pdf");
              return (
                <li key={f.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{f.filename}</div>
                    <div className="text-xs text-slate-500">
                      {fileSize(f.size)} · {utcToKst(f.uploaded_at)} {f.source_url && "· 나라장터"}
                    </div>
                  </div>
                  {pdf || f.has_text ? (
                    <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">분석 가능</Badge>
                  ) : (
                    <Badge className="bg-amber-50 text-amber-800 ring-amber-200">내용 읽기 불가</Badge>
                  )}
                  <select
                    className={`${inputBase} w-36`}
                    value={f.kind}
                    onChange={async (e) => {
                      await api.send("PATCH", `/bid-files/${f.id}`, { kind: e.target.value });
                      onChange();
                    }}
                  >
                    {Object.entries(FILE_KINDS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <Button variant="ghost" size="sm" onClick={() => api.download(`/bid-files/${f.id}`, f.filename)} aria-label="다운로드">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="삭제"
                    onClick={async () => {
                      if (!confirm(`${f.filename} 을(를) 삭제할까요?`)) return;
                      await api.send("DELETE", `/bid-files/${f.id}`);
                      onChange();
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {attachments.length > 0 && (
        <Card title="나라장터 공고 첨부 링크">
          <ul className="space-y-1 text-sm">
            {attachments.map((a) => (
              <li key={a.url}>
                <a href={a.url} target="_blank" rel="noreferrer" className="text-brand-600 underline">
                  {a.name}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            자동 가져오기가 실패하면 링크에서 직접 내려받아 위에 업로드하세요. 배포용(읽기전용) HWP 는 한글에서 PDF 로 저장해 올리면 됩니다.
          </p>
        </Card>
      )}
    </div>
  );
}
