import { Download, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import type { G2BNotice } from "../../shared/types";
import { api } from "../lib/api";
import { G2B_FIELD_GROUPS, fieldValue } from "../lib/g2bFields";
import { Badge, Card, ErrorBox } from "./ui";

/** 나라장터 공고 상세 항목 (웹 내 표시) */
export function NoticeFields({ notice }: { notice: Pick<G2BNotice, "raw" | "extra"> }) {
  const raw = notice.raw ?? {};
  return (
    <div className="space-y-4">
      {(notice.extra?.licenses.length || notice.extra?.regions.length) ? (
        <Card title="참가 제한">
          <dl className="space-y-2 text-sm">
            {notice.extra?.licenses.length ? (
              <div className="flex gap-3">
                <dt className="w-28 shrink-0 text-slate-500">면허·업종 제한</dt>
                <dd className="flex flex-wrap gap-1">
                  {notice.extra.licenses.map((l) => (
                    <Badge key={l} className="bg-indigo-50 text-indigo-700 ring-indigo-200">{l}</Badge>
                  ))}
                </dd>
              </div>
            ) : null}
            {notice.extra?.regions.length ? (
              <div className="flex gap-3">
                <dt className="w-28 shrink-0 text-slate-500">참가가능지역</dt>
                <dd className="flex flex-wrap gap-1">
                  {notice.extra.regions.map((r) => (
                    <Badge key={r} className="bg-amber-50 text-amber-800 ring-amber-200">{r}</Badge>
                  ))}
                </dd>
              </div>
            ) : null}
          </dl>
        </Card>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {G2B_FIELD_GROUPS.map((g) => {
          const rows = g.fields.map(([k, label]) => [label, fieldValue(k, raw[k])] as const).filter(([, v]) => v);
          if (!rows.length) return null;
          return (
            <Card key={g.title} title={g.title}>
              <dl className="space-y-1.5 text-sm">
                {rows.map(([label, v]) => (
                  <div key={label} className="flex gap-3">
                    <dt className="w-32 shrink-0 text-slate-500">{label}</dt>
                    <dd className="min-w-0 text-slate-900">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/** 공고 첨부파일 다운로드 버튼 (서버를 거쳐 받으므로 나라장터로 이동하지 않음) */
export function NoticeAttachments({ attachments }: { attachments: { name: string; url: string }[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<{ name: string; url: string; msg: string } | null>(null);
  if (!attachments.length) return <p className="text-sm text-slate-500">나라장터에 등록된 첨부파일이 없습니다.</p>;
  return (
    <div>
      <ul className="divide-y divide-slate-100">
        {attachments.map((a) => (
          <li key={a.url} className="flex items-center gap-3 py-2 text-sm">
            <FileText className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="min-w-0 flex-1 truncate">{a.name}</span>
            <button
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
              disabled={busy === a.url}
              onClick={async () => {
                setErr(null);
                setBusy(a.url);
                try {
                  await api.download(`/g2b/file?url=${encodeURIComponent(a.url)}&name=${encodeURIComponent(a.name)}`, a.name);
                } catch (e) {
                  setErr({ ...a, msg: e instanceof Error ? e.message : String(e) });
                } finally {
                  setBusy(null);
                }
              }}
            >
              {busy === a.url ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} 다운로드
            </button>
          </li>
        ))}
      </ul>
      {err && (
        <div className="mt-2 space-y-1">
          <ErrorBox error={`${err.name}: ${err.msg}`} />
          <p className="text-xs text-slate-500">
            나라장터가 직접 다운로드만 허용하는 파일입니다.{" "}
            <a href={err.url} target="_blank" rel="noreferrer" className="text-brand-600 underline">
              원본 링크로 받기
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
