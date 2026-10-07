import clsx from "clsx";
import { AlertTriangle, CheckCircle2, CircleHelp, Sparkles, XCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { COMPANY_DOC_CATEGORIES, type AnalysisRecord, type AnalysisResult, type Bid } from "../../shared/types";
import { api } from "../lib/api";
import { utcToKst } from "../lib/format";
import { renderMarkdown } from "../lib/markdown";
import { Badge, Button, Card, ErrorBox, RecBadge, inputBase } from "./ui";

const VERDICT = {
  pass: { label: "충족", icon: CheckCircle2, cls: "text-emerald-600" },
  fail: { label: "미충족", icon: XCircle, cls: "text-red-600" },
  unknown: { label: "확인필요", icon: CircleHelp, cls: "text-amber-600" },
} as const;

const SEV = {
  high: { label: "높음", cls: "bg-red-50 text-red-700 ring-red-200" },
  medium: { label: "보통", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  low: { label: "낮음", cls: "bg-slate-50 text-slate-600 ring-slate-200" },
} as const;

const HAVE = {
  yes: { label: "보유", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  no: { label: "미보유", cls: "bg-red-50 text-red-700 ring-red-200" },
  unknown: { label: "확인필요", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
} as const;

const pts = (v: number | null | undefined) => (v == null ? "-" : String(Number(v.toFixed(2))));

export function AnalysisView({
  bid,
  analyses,
  hasFiles,
  onDone,
}: {
  bid: Bid;
  analyses: AnalysisRecord[];
  hasFiles: boolean;
  onDone: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const [selected, setSelected] = useState(0);
  const rec = analyses[selected];

  async function run() {
    setRunning(true);
    setErr(null);
    setStatus("요청 중…");
    try {
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

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={run} loading={running}>
            <Sparkles className="h-4 w-4" /> {analyses.length ? "다시 분석" : "AI 분석 실행"}
          </Button>
          {running && <span className="text-sm text-slate-600">{status}</span>}
          {!running && !hasFiles && (
            <span className="text-sm text-amber-700">첨부파일이 없으면 공고 메타데이터만으로 분석합니다. 제안요청서·공고문을 먼저 올리면 정확도가 높아집니다.</span>
          )}
          {analyses.length > 1 && (
            <select className={`${inputBase} ml-auto w-auto`} value={selected} onChange={(e) => setSelected(Number(e.target.value))}>
              {analyses.map((a, i) => (
                <option key={a.id} value={i}>
                  {utcToKst(a.created_at)} · {a.fit_score}점
                </option>
              ))}
            </select>
          )}
        </div>
        <ErrorBox error={err} />
        <p className="mt-2 text-xs text-slate-500">
          분석에는 <Link to="/company" className="text-brand-600 underline">회사 정보·서류</Link>가 함께 사용됩니다. 회사 서류가 많을수록 자격·신인도 판정이 정확해집니다.
        </p>
      </Card>

      {rec && <Result r={rec.result} />}
    </div>
  );
}

function Result({ r }: { r: AnalysisResult }) {
  const s = r.scoring;
  const elig = { pass: 0, fail: 0, unknown: 0 };
  for (const e of r.eligibility) elig[e.verdict]++;

  return (
    <div className="space-y-4">
      {/* 요약 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="적합도" value={`${Math.round(r.fit.score)}`} sub={`등급 ${r.fit.grade}`} tone={r.fit.score >= 80 ? "good" : r.fit.score >= 50 ? "mid" : "bad"} />
        <Stat
          label="참가자격"
          value={elig.fail ? `미충족 ${elig.fail}` : elig.unknown ? `확인필요 ${elig.unknown}` : "충족"}
          sub={`충족 ${elig.pass} / 전체 ${r.eligibility.length}`}
          tone={elig.fail ? "bad" : elig.unknown ? "mid" : "good"}
        />
        <Stat label="예상 총점" value={s.total_expected != null ? pts(s.total_expected) : "-"} sub={s.total_max != null ? `/ ${pts(s.total_max)}점` : ""} tone="neutral" />
        <Stat label="신인도 가감" value={s.credibility_adjustment != null ? (s.credibility_adjustment > 0 ? `+${pts(s.credibility_adjustment)}` : pts(s.credibility_adjustment)) : "-"} sub="점" tone="neutral" />
      </div>

      <Card title={<span className="flex items-center gap-2">검토 의견서 <RecBadge rec={r.recommendation} /></span>}>
        <div className="prose-md text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(r.opinion_md) }} />
      </Card>

      <Card title="사업 개요">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {[
            ["사업명", r.overview.project_name],
            ["사업기간", r.overview.period],
            ["금액", r.overview.budget_text],
            ["계약방법", r.overview.contract_method],
            ["낙찰방법", r.overview.award_method],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-3">
              <dt className="w-16 shrink-0 text-slate-500">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-slate-700">{r.overview.purpose}</p>
        {r.overview.key_dates.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {r.overview.key_dates.map((d) => (
              <Badge key={d.label + d.date} className="bg-slate-50 text-slate-700 ring-slate-200">
                {d.label}: {d.date}
              </Badge>
            ))}
          </div>
        )}
      </Card>

      <Card title="입찰참가자격 검토">
        <Table head={["판정", "요건", "근거", "당사 현황", "필요 조치"]}>
          {r.eligibility.map((e, i) => {
            const v = VERDICT[e.verdict];
            return (
              <tr key={i} className="align-top">
                <td className="whitespace-nowrap px-2 py-2">
                  <span className={clsx("inline-flex items-center gap-1 text-xs font-semibold", v.cls)}>
                    <v.icon className="h-4 w-4" /> {v.label}
                  </span>
                </td>
                <td className="px-2 py-2">{e.requirement}</td>
                <td className="px-2 py-2 text-xs text-slate-500">{e.source}</td>
                <td className="px-2 py-2">{e.company_status}</td>
                <td className="px-2 py-2 text-slate-700">{e.action_needed}</td>
              </tr>
            );
          })}
        </Table>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="신인도·경영상태 점수">
          <Table head={["항목", "배점", "예상", "근거"]}>
            {r.credibility.map((c, i) => (
              <tr key={i} className="align-top">
                <td className="px-2 py-2">
                  <div className="font-medium">{c.item}</div>
                  <div className={clsx("text-xs", VERDICT[c.verdict].cls)}>{VERDICT[c.verdict].label}</div>
                </td>
                <td className="px-2 py-2 tabular-nums">{pts(c.max_points)}</td>
                <td className="px-2 py-2 font-semibold tabular-nums">{pts(c.expected_points)}</td>
                <td className="px-2 py-2 text-xs text-slate-600">
                  {c.criteria}
                  {c.note && <div className="mt-0.5 text-slate-500">{c.note}</div>}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title="평가 점수 예상">
          <Table head={["평가항목", "배점", "예상", "근거"]}>
            {s.technical_items.map((t, i) => (
              <tr key={i} className="align-top">
                <td className="px-2 py-2 font-medium">{t.item}</td>
                <td className="px-2 py-2 tabular-nums">{pts(t.max_points)}</td>
                <td className="px-2 py-2 font-semibold tabular-nums">{pts(t.expected_points)}</td>
                <td className="px-2 py-2 text-xs text-slate-600">{t.rationale}</td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-semibold">
              <td className="px-2 py-2">기술평가 계</td>
              <td className="px-2 py-2 tabular-nums">{pts(s.technical_max)}</td>
              <td className="px-2 py-2 tabular-nums">{pts(s.technical_expected)}</td>
              <td />
            </tr>
            <tr className="align-top">
              <td className="px-2 py-2 font-medium">가격평가</td>
              <td className="px-2 py-2 tabular-nums">{pts(s.price_max)}</td>
              <td className="px-2 py-2">-</td>
              <td className="px-2 py-2 text-xs text-slate-600">{s.price_note}</td>
            </tr>
          </Table>
          <p className="mt-3 text-sm text-slate-700">{s.competitiveness}</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="강점 · 약점">
          <div className="grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <div className="mb-1 font-medium text-emerald-700">강점</div>
              <ul className="list-disc space-y-1 pl-5">{r.fit.strengths.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
            <div>
              <div className="mb-1 font-medium text-red-700">약점</div>
              <ul className="list-disc space-y-1 pl-5">{r.fit.weaknesses.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          </div>
        </Card>
        <Card title="유의사항">
          <ul className="space-y-2 text-sm">
            {[...r.cautions]
              .sort((a, b) => ["high", "medium", "low"].indexOf(a.severity) - ["high", "medium", "low"].indexOf(b.severity))
              .map((c, i) => (
                <li key={i} className="flex gap-2">
                  <Badge className={clsx("h-fit", SEV[c.severity].cls)}>{SEV[c.severity].label}</Badge>
                  <div>
                    <div className="font-medium">{c.title}</div>
                    <div className="text-slate-600">{c.detail}</div>
                  </div>
                </li>
              ))}
          </ul>
        </Card>
      </div>

      <Card title="제출 서류 체크리스트">
        <Table head={["단계", "서류", "보유", "비고"]}>
          {r.required_documents.map((d, i) => (
            <tr key={i} className="align-top">
              <td className="whitespace-nowrap px-2 py-2 text-xs text-slate-500">{d.stage}</td>
              <td className="px-2 py-2">
                {d.name}
                {d.company_doc_category !== "none" && (
                  <div className="text-xs text-slate-400">
                    서류함: {COMPANY_DOC_CATEGORIES.find((c) => c.key === d.company_doc_category)?.label ?? d.company_doc_category}
                  </div>
                )}
              </td>
              <td className="px-2 py-2">
                <Badge className={HAVE[d.have].cls}>{HAVE[d.have].label}</Badge>
              </td>
              <td className="px-2 py-2 text-slate-600">{d.note}</td>
            </tr>
          ))}
        </Table>
      </Card>

      {r.missing_company_info.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" /> 정확한 판정을 위해 등록이 필요한 당사 서류·정보
          </div>
          <ul className="list-disc space-y-1 pl-5">
            {r.missing_company_info.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <Link to="/company" className="mt-2 inline-block text-brand-700 underline">
            회사 정보·서류 등록하러 가기 →
          </Link>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: "good" | "mid" | "bad" | "neutral" }) {
  const cls = { good: "text-emerald-700", mid: "text-amber-700", bad: "text-red-700", neutral: "text-slate-900" }[tone];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={clsx("mt-1 text-2xl font-bold tabular-nums", cls)}>{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-2 py-2 first:pl-4">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 [&_td:first-child]:pl-4">{children}</tbody>
      </table>
    </div>
  );
}
