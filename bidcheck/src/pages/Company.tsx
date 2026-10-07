import { CheckCircle2, Circle, Download, Sparkles, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { COMPANY_DOC_CATEGORIES, type CompanyDoc, type CompanyProfile } from "../../shared/types";
import { Badge, Button, Card, ErrorBox, Field, Spinner, inputCls } from "../components/ui";
import { api } from "../lib/api";
import { fileSize, utcToKst } from "../lib/format";
import { uploadWithText } from "../lib/upload";
import { useAsync } from "../lib/useAsync";

interface CompanyData {
  profile: CompanyProfile;
  updated_at: string;
  docs: CompanyDoc[];
}

const TEXT_FIELDS: [keyof CompanyProfile, string][] = [
  ["name", "회사명"],
  ["bizNo", "사업자등록번호"],
  ["ceo", "대표자"],
  ["address", "본사 주소"],
  ["region", "소재지(시·도)"],
  ["foundedAt", "설립일"],
  ["companySize", "기업 규모 (중소/소기업/소상공인 등)"],
  ["creditRating", "신용평가등급 (예: BB+)"],
  ["creditRatingDate", "신용평가 평가일/유효기간"],
  ["revenue", "최근 매출액"],
];

const AREA_FIELDS: [keyof CompanyProfile, string, string][] = [
  ["licenses", "업종·면허 (나라장터 등록 업종코드)", "예: 1468 소프트웨어사업자(컴퓨터관련서비스사업)\n4440 정보통신공사업"],
  ["directProduction", "직접생산확인 품목", ""],
  ["certifications", "인증 (가점 대상)", "예: ISO 9001, ISO 27001, 벤처기업, 이노비즈, GS인증 1등급"],
  ["techStaff", "기술인력 현황", "예: 특급 2명, 고급 5명, 중급 8명 / 정보처리기사 10명"],
  ["performance", "주요 수행실적", "사업명 / 발주처 / 금액 / 기간 (한 줄에 하나)"],
  ["sanctions", "제재·벌점 이력", "부정당제재, 계약해지, 벌점 등 (없으면 '없음')"],
  ["preferences", "입찰 전략 메모", "관심 분야, 선호 금액대, 참여 지역, 피하고 싶은 조건 등"],
  ["notes", "기타", ""],
];

export default function Company() {
  const { data, error, loading, reload } = useAsync(() => api.get<CompanyData>("/company"), []);
  if (loading && !data) return <Spinner />;
  if (!data) return <ErrorBox error={error} />;
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900">회사 정보 · 서류함</h1>
      <p className="text-sm text-slate-600">
        여기 등록한 프로필과 서류는 모든 입찰 분석(참가자격·신인도·점수 산정)과 제안서 초안 작성에 사용됩니다. 아래 체크리스트의 서류를 올린 뒤
        <b> 서류에서 프로필 자동 채우기</b>를 누르면 편합니다.
      </p>
      <Docs docs={data.docs} onChange={reload} />
      <ProfileForm initial={data.profile} updatedAt={data.updated_at} hasDocs={data.docs.length > 0} onSaved={reload} />
    </div>
  );
}

function Docs({ docs, onChange }: { docs: CompanyDoc[]; onChange: () => void }) {
  const [category, setCategory] = useState("biz_reg");
  const [validUntil, setValidUntil] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const ref = useRef<HTMLInputElement>(null);

  async function upload(files: FileList) {
    setErr(null);
    const msgs: string[] = [];
    try {
      for (const f of Array.from(files)) {
        setBusy(`${f.name} 업로드 중…`);
        const { note } = await uploadWithText("/company/docs", f, { category, title: f.name.replace(/\.[^.]+$/, ""), valid_until: validUntil });
        if (note && !f.name.toLowerCase().endsWith(".pdf")) msgs.push(`${f.name}: ${note}`);
      }
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(null);
      setNotes(msgs);
      onChange();
      if (ref.current) ref.current.value = "";
    }
  }

  const byCat = new Map<string, CompanyDoc[]>();
  for (const d of docs) byCat.set(d.category, [...(byCat.get(d.category) ?? []), d]);

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <Card title="권장 서류 체크리스트" className="lg:col-span-2">
        <ul className="space-y-2 text-sm">
          {COMPANY_DOC_CATEGORIES.filter((c) => c.key !== "other").map((c) => {
            const have = byCat.has(c.key);
            return (
              <li key={c.key} className="flex gap-2">
                {have ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />}
                <button className="text-left" onClick={() => setCategory(c.key)}>
                  <div className={have ? "text-slate-500" : "font-medium"}>{c.label}</div>
                  <div className="text-xs text-slate-400">{c.why}</div>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
      <Card title={`등록된 서류 (${docs.length})`} className="lg:col-span-3">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="분류">
            <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
              {COMPANY_DOC_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="유효기간 (선택)">
            <input type="date" className={inputCls} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </Field>
          <Button onClick={() => ref.current?.click()} loading={!!busy}>
            <Upload className="h-4 w-4" /> 서류 업로드
          </Button>
          <input ref={ref} type="file" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} />
        </div>
        {busy && <p className="mt-2 text-sm text-slate-500">{busy}</p>}
        <ErrorBox error={err} />
        {notes.length > 0 && (
          <ul className="mt-2 space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
        <ul className="mt-4 divide-y divide-slate-100">
          {docs.map((d) => {
            const expired = d.valid_until && d.valid_until < new Date().toISOString().slice(0, 10);
            return (
              <li key={d.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{d.title}</div>
                  <div className="text-xs text-slate-500">
                    {COMPANY_DOC_CATEGORIES.find((c) => c.key === d.category)?.label ?? d.category} · {d.filename} · {fileSize(d.size)} ·{" "}
                    {utcToKst(d.uploaded_at)}
                  </div>
                </div>
                {d.valid_until && (
                  <Badge className={expired ? "bg-red-50 text-red-700 ring-red-200" : "bg-slate-50 text-slate-600 ring-slate-200"}>
                    {expired ? "만료" : "~"} {d.valid_until}
                  </Badge>
                )}
                {!d.has_text && !d.filename.toLowerCase().endsWith(".pdf") && (
                  <Badge className="bg-amber-50 text-amber-800 ring-amber-200">내용 읽기 불가</Badge>
                )}
                <Button variant="ghost" size="sm" aria-label="다운로드" onClick={() => api.download(`/company/docs/${d.id}/file`, d.filename)}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="삭제"
                  onClick={async () => {
                    if (!confirm(`${d.title} 을(를) 삭제할까요?`)) return;
                    await api.send("DELETE", `/company/docs/${d.id}`);
                    onChange();
                  }}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function ProfileForm({ initial, updatedAt, hasDocs, onSaved }: { initial: CompanyProfile; updatedAt: string; hasDocs: boolean; onSaved: () => void }) {
  const [p, setP] = useState<CompanyProfile>(initial);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [status, setStatus] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => setP(initial), [initial]);

  const set = (k: keyof CompanyProfile, v: string) => setP((x) => ({ ...x, [k]: k === "employees" ? (v ? Number(v) : null) : v }));

  async function extract() {
    setExtracting(true);
    setErr(null);
    setMsg(null);
    try {
      const got = await api.stream<Partial<CompanyProfile>>("/company/extract", {}, (e) => {
        if (e.type === "status" && e.message) setStatus(e.message);
      });
      // 서류에서 찾은 값만 채우고, 이미 입력한 값은 유지
      setP((cur) => {
        const next = { ...cur };
        for (const [k, v] of Object.entries(got) as [keyof CompanyProfile, unknown][]) {
          if (v !== "" && v != null && !cur[k]) (next as Record<string, unknown>)[k] = v;
        }
        return next;
      });
      setMsg("서류에서 찾은 값으로 빈 칸을 채웠습니다. 확인 후 저장하세요.");
    } catch (e) {
      setErr(e);
    } finally {
      setExtracting(false);
    }
  }

  return (
    <Card
      title="회사 프로필"
      actions={
        <>
          <Button variant="secondary" onClick={extract} loading={extracting} disabled={!hasDocs}>
            <Sparkles className="h-4 w-4" /> 서류에서 프로필 자동 채우기
          </Button>
          <Button
            loading={saving}
            onClick={async () => {
              setSaving(true);
              setErr(null);
              try {
                await api.send("PUT", "/company/profile", p);
                setMsg("저장했습니다.");
                onSaved();
              } catch (e) {
                setErr(e);
              } finally {
                setSaving(false);
              }
            }}
          >
            저장
          </Button>
        </>
      }
    >
      {extracting && <p className="mb-3 text-sm text-slate-500">{status}</p>}
      {msg && <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}
      <ErrorBox error={err} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TEXT_FIELDS.map(([k, label]) => (
          <Field key={k} label={label}>
            <input className={inputCls} value={(p[k] as string) ?? ""} onChange={(e) => set(k, e.target.value)} />
          </Field>
        ))}
        <Field label="상시 종업원 수">
          <input type="number" className={inputCls} value={p.employees ?? ""} onChange={(e) => set("employees", e.target.value)} />
        </Field>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {AREA_FIELDS.map(([k, label, ph]) => (
          <Field key={k} label={label}>
            <textarea className={`${inputCls} h-28`} placeholder={ph} value={(p[k] as string) ?? ""} onChange={(e) => set(k, e.target.value)} />
          </Field>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-400">최종 수정: {utcToKst(updatedAt)}</p>
    </Card>
  );
}
