import clsx from "clsx";
import { AlertTriangle, CheckCircle2, CircleHelp, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { COMPANY_DOC_CATEGORIES, RECOMMENDATION_LABEL, type AnalysisResult, type Bid } from "../../shared/types";
import { renderMarkdown } from "../lib/markdown";
import { INK, SERIES } from "../lib/palette";
import { Badge } from "./ui";

const VERDICT = {
  pass: { label: "충족", icon: CheckCircle2, cls: "text-emerald-700" },
  fail: { label: "미충족", icon: XCircle, cls: "text-red-700" },
  unknown: { label: "확인필요", icon: CircleHelp, cls: "text-amber-700" },
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

/** AI 적합도 분석 결과보고서 (화면·인쇄 공용) */
export function Report({ r, bid, createdAt, checklist, onToggleDoc }: {
  r: AnalysisResult;
  bid: Bid;
  createdAt: string;
  checklist?: Record<string, boolean>;
  onToggleDoc?: (name: string, v: boolean) => void;
}) {
  const ev = r.evaluation;
  const elig = { pass: 0, fail: 0, unknown: 0 };
  for (const e of r.eligibility) elig[e.verdict]++;
  const recTone = r.recommendation === "go" ? "bg-emerald-600" : r.recommendation === "conditional" ? "bg-amber-500" : "bg-red-600";

  return (
    <article className="report space-y-5 text-sm">
      {/* 표지 요약 */}
      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm print:border-0 print:shadow-none">
        <div className="text-xs text-slate-500">입찰 참여 검토 결과보고서 · {createdAt}</div>
        <h2 className="mt-1 text-xl font-bold text-slate-900">{r.overview.project_name || bid.title}</h2>
        <div className="mt-1 text-slate-600">
          {r.overview.client}
          {r.overview.demand_org && r.overview.demand_org !== r.overview.client && ` / ${r.overview.demand_org}`} · 공고번호 {bid.id}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Stat label="종합 적합도" value={`${Math.round(r.fit.score)}점`} sub={`등급 ${r.fit.grade}`} />
          <Stat
            label="참가자격"
            value={elig.fail ? `미충족 ${elig.fail}` : elig.unknown ? `확인필요 ${elig.unknown}` : "충족"}
            sub={`충족 ${elig.pass} / 전체 ${r.eligibility.length}`}
            tone={elig.fail ? "bad" : elig.unknown ? "mid" : "good"}
          />
          <Stat label="예상 총점" value={ev.total_expected != null ? `${pts(ev.total_expected)}점` : "-"} sub={ev.total_max != null ? `만점 ${pts(ev.total_max)}` : ""} />
          <div className={clsx("flex flex-col justify-center rounded-lg p-3 text-white", recTone)}>
            <div className="text-xs opacity-90">검토 결론</div>
            <div className="text-lg font-bold">{RECOMMENDATION_LABEL[r.recommendation]}</div>
          </div>
        </div>
        <p className="mt-4 rounded-md bg-slate-50 p-3 leading-7 text-slate-800">{r.executive_summary}</p>
      </header>

      <Section n={1} title="사업 개요">
        <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {(
            [
              ["사업기간", r.overview.period],
              ["금액", r.overview.budget_text],
              ["계약방법", r.overview.contract_method],
              ["낙찰방법", r.overview.award_method],
              ["평가 배점", r.overview.eval_ratio],
              ["제출 방법", r.overview.submission_method],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="flex gap-3">
              <dt className="w-20 shrink-0 text-slate-500">{k}</dt>
              <dd>{v || "-"}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 leading-7">{r.overview.purpose}</p>
        {r.overview.scope.length > 0 && (
          <>
            <h4 className="mt-3 font-semibold">주요 과업</h4>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">{r.overview.scope.map((s) => <li key={s}>{s}</li>)}</ul>
          </>
        )}
        {r.overview.key_dates.length > 0 && (
          <Table head={["일정", "일시"]} className="mt-3">
            {r.overview.key_dates.map((d) => (
              <tr key={d.label + d.date}>
                <td className="px-2 py-1.5">{d.label}</td>
                <td className="px-2 py-1.5">{d.date}</td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      <Section n={2} title="입찰참가자격 판정" sub={r.eligibility_summary}>
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
                <td className="px-2 py-2">{e.action_needed}</td>
              </tr>
            );
          })}
        </Table>
      </Section>

      <Section n={3} title="당사 적합도 분석">
        <div className="grid gap-4 lg:grid-cols-2">
          <figure>
            <figcaption className="mb-1 text-xs font-medium text-slate-500">요소별 적합도 (0~100, 높을수록 유리)</figcaption>
            <div className="h-72">
              <ResponsiveContainer>
                <RadarChart data={r.fit.breakdown} outerRadius="72%">
                  <PolarGrid stroke={INK.grid} />
                  <PolarAngleAxis dataKey="factor" tick={{ fontSize: 11, fill: INK.secondary }} />
                  <PolarRadiusAxis domain={[0, 100]} tickCount={5} tick={{ fontSize: 9, fill: INK.muted }} axisLine={false} />
                  <Radar dataKey="score" name="적합도" stroke={SERIES[0]} strokeWidth={2} fill={SERIES[0]} fillOpacity={0.18} dot={{ r: 4, fill: SERIES[0] }} />
                  <Tooltip formatter={(v) => [`${v}점`, "적합도"]} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </figure>
          <Table head={["요소", "점수", "의견"]}>
            {r.fit.breakdown.map((b) => (
              <tr key={b.factor} className="align-top">
                <td className="whitespace-nowrap px-2 py-1.5 font-medium">{b.factor}</td>
                <td className="px-2 py-1.5 font-semibold tabular-nums">{Math.round(b.score)}</td>
                <td className="px-2 py-1.5 text-slate-600">{b.comment}</td>
              </tr>
            ))}
          </Table>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <h4 className="font-semibold text-emerald-700">강점</h4>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">{r.fit.strengths.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
          <div>
            <h4 className="font-semibold text-red-700">약점</h4>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">{r.fit.weaknesses.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        </div>
      </Section>

      <Section n={4} title="평가 점수 예측" sub={ev.passing_threshold}>
        <Table head={["평가항목", "배점", "예상", "달성률", "근거", "점수 향상 포인트"]}>
          {ev.technical_items.map((t, i) => (
            <tr key={i} className="align-top">
              <td className="px-2 py-2 font-medium">{t.item}</td>
              <td className="px-2 py-2 tabular-nums">{pts(t.max_points)}</td>
              <td className="px-2 py-2 font-semibold tabular-nums">{pts(t.expected_points)}</td>
              <td className="px-2 py-2">
                <Meter value={t.expected_points} max={t.max_points} />
              </td>
              <td className="px-2 py-2 text-xs text-slate-600">{t.rationale}</td>
              <td className="px-2 py-2 text-xs text-slate-600">{t.strategy}</td>
            </tr>
          ))}
          <tr className="bg-slate-50 font-semibold">
            <td className="px-2 py-2">기술평가 계</td>
            <td className="px-2 py-2 tabular-nums">{pts(ev.technical_max)}</td>
            <td className="px-2 py-2 tabular-nums">{pts(ev.technical_expected)}</td>
            <td className="px-2 py-2">
              <Meter value={ev.technical_expected} max={ev.technical_max} />
            </td>
            <td colSpan={2} />
          </tr>
          <tr className="align-top">
            <td className="px-2 py-2 font-medium">가격평가</td>
            <td className="px-2 py-2 tabular-nums">{pts(ev.price_max)}</td>
            <td className="px-2 py-2 font-semibold tabular-nums">{pts(ev.price_expected)}</td>
            <td className="px-2 py-2">
              <Meter value={ev.price_expected} max={ev.price_max} />
            </td>
            <td colSpan={2} className="px-2 py-2 text-xs text-slate-600">{ev.price_strategy}</td>
          </tr>
        </Table>
        <h4 className="mt-4 font-semibold">신인도·경영상태</h4>
        <Table head={["항목", "판정", "배점", "예상", "기준·비고"]}>
          {ev.credibility_items.map((c, i) => (
            <tr key={i} className="align-top">
              <td className="px-2 py-2 font-medium">{c.item}</td>
              <td className={clsx("whitespace-nowrap px-2 py-2 text-xs font-semibold", VERDICT[c.verdict].cls)}>{VERDICT[c.verdict].label}</td>
              <td className="px-2 py-2 tabular-nums">{pts(c.max_points)}</td>
              <td className="px-2 py-2 font-semibold tabular-nums">{pts(c.expected_points)}</td>
              <td className="px-2 py-2 text-xs text-slate-600">
                {c.criteria}
                {c.note && <div className="text-slate-500">{c.note}</div>}
              </td>
            </tr>
          ))}
          <tr className="bg-slate-50 font-semibold">
            <td className="px-2 py-2">신인도 가감점 계</td>
            <td />
            <td />
            <td className="px-2 py-2 tabular-nums">{ev.credibility_adjustment != null ? (ev.credibility_adjustment > 0 ? `+${pts(ev.credibility_adjustment)}` : pts(ev.credibility_adjustment)) : "-"}</td>
            <td />
          </tr>
        </Table>
        <p className="mt-3 rounded-md bg-slate-50 p-3">
          <b>예상 총점 {pts(ev.total_expected)} / {pts(ev.total_max)}</b> — {ev.competitiveness}
        </p>
      </Section>

      <Section n={5} title="경쟁 환경 (추정)">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-500">예상 경쟁 강도</span>
          <Badge className={SEV[r.competition.intensity].cls}>{SEV[r.competition.intensity].label}</Badge>
        </div>
        <p className="mt-2">{r.competition.expected_competitors}</p>
        {r.competition.note && <p className="mt-1 text-slate-600">{r.competition.note}</p>}
      </Section>

      <Section n={6} title="리스크 · 유의사항">
        <Table head={["중요도", "분류", "내용", "대응 방안"]}>
          {[...r.risks]
            .sort((a, b) => ["high", "medium", "low"].indexOf(a.severity) - ["high", "medium", "low"].indexOf(b.severity))
            .map((x, i) => (
              <tr key={i} className="align-top">
                <td className="px-2 py-2">
                  <Badge className={SEV[x.severity].cls}>{SEV[x.severity].label}</Badge>
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-xs text-slate-500">{x.category}</td>
                <td className="px-2 py-2">
                  <div className="font-medium">{x.title}</div>
                  <div className="text-slate-600">{x.detail}</div>
                </td>
                <td className="px-2 py-2 text-slate-700">{x.mitigation}</td>
              </tr>
            ))}
        </Table>
      </Section>

      <Section n={7} title="제출 서류 체크리스트" sub={onToggleDoc ? "준비한 서류는 체크해 두세요. 팀 전체에 공유됩니다." : undefined}>
        <Table head={["준비", "단계", "서류", "당사 보유", "비고"]}>
          {r.required_documents.map((d, i) => (
            <tr key={i} className="align-top">
              <td className="px-2 py-2">
                <input
                  type="checkbox"
                  aria-label={`${d.name} 준비 완료`}
                  checked={!!checklist?.[d.name]}
                  disabled={!onToggleDoc}
                  onChange={(e) => onToggleDoc?.(d.name, e.target.checked)}
                />
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-xs text-slate-500">{d.stage}</td>
              <td className={clsx("px-2 py-2", checklist?.[d.name] && "text-slate-400 line-through")}>
                {d.name}
                {d.company_doc_category !== "none" && (
                  <div className="text-xs text-slate-400 no-underline">
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
        {r.missing_company_info.length > 0 && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
            <div className="mb-1 flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-4 w-4" /> 정확한 판정을 위해 등록이 필요한 당사 서류·정보
            </div>
            <ul className="list-disc space-y-0.5 pl-5">{r.missing_company_info.map((m) => <li key={m}>{m}</li>)}</ul>
            <Link to="/company" className="mt-1 inline-block text-brand-700 underline print:hidden">
              회사 정보·서류 등록하러 가기 →
            </Link>
          </div>
        )}
      </Section>

      <Section n={8} title="수주 전략 제언">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h4 className="font-semibold">핵심 메시지 (Win Theme)</h4>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">{r.strategy.win_themes.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
          <div>
            <h4 className="font-semibold">차별화 포인트</h4>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">{r.strategy.differentiators.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        </div>
        <p className="mt-3">
          <b>공동수급·협력:</b> {r.strategy.consortium}
        </p>
        {r.strategy.questions_to_client.length > 0 && (
          <>
            <h4 className="mt-3 font-semibold">발주처 질의 권장 사항</h4>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5">{r.strategy.questions_to_client.map((x) => <li key={x}>{x}</li>)}</ol>
          </>
        )}
      </Section>

      <Section n={9} title="후속 조치 (Action Items)">
        <Table head={["할 일", "담당", "기한"]}>
          {r.action_items.map((a, i) => (
            <tr key={i}>
              <td className="px-2 py-1.5">{a.task}</td>
              <td className="whitespace-nowrap px-2 py-1.5">{a.owner_hint}</td>
              <td className="whitespace-nowrap px-2 py-1.5">{a.due}</td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section n={10} title="종합 검토 의견">
        <div className="prose-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(r.opinion_md) }} />
      </Section>
    </article>
  );
}

function Section({ n, title, sub, children }: { n: number; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid-page rounded-lg border border-slate-200 bg-white p-5 shadow-sm print:border-0 print:p-0 print:shadow-none">
      <h3 className="text-base font-bold text-slate-900">
        <span className="mr-1.5 text-brand-500">{n}.</span>
        {title}
      </h3>
      {sub && <p className="mt-0.5 text-slate-600">{sub}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Stat({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub?: string; tone?: "good" | "mid" | "bad" | "neutral" }) {
  const cls = { good: "text-emerald-700", mid: "text-amber-700", bad: "text-red-700", neutral: "text-slate-900" }[tone];
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={clsx("text-xl font-bold tabular-nums", cls)}>{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function Meter({ value, max }: { value: number | null; max: number | null }) {
  if (value == null || !max) return <span className="text-xs text-slate-400">-</span>;
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex items-center gap-1.5" title={`${pct.toFixed(0)}%`}>
      <div className="h-2 w-16 overflow-hidden rounded-full" style={{ background: INK.track }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: SERIES[0] }} />
      </div>
      <span className="text-xs tabular-nums text-slate-600">{pct.toFixed(0)}%</span>
    </div>
  );
}

function Table({ head, children, className }: { head: string[]; children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx("-mx-1 overflow-x-auto", className)}>
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-2 py-1.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}
