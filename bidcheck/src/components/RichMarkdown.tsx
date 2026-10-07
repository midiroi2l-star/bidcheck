import { useEffect, useId, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { renderMarkdown } from "../lib/markdown";
import { INK, SERIES } from "../lib/palette";

/* ───────────── 마크다운 + ```mermaid / ```chart 블록 분리 ───────────── */

export type Segment = { kind: "md"; text: string } | { kind: "mermaid"; code: string } | { kind: "chart"; code: string } | { kind: "pending"; lang: string };

export function splitSegments(src: string): Segment[] {
  const out: Segment[] = [];
  const re = /```(mermaid|chart)[^\n]*\n([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ kind: "md", text: src.slice(last, m.index) });
    out.push({ kind: m[1] as "mermaid" | "chart", code: m[2].trim() });
    last = m.index + m[0].length;
  }
  const rest = src.slice(last);
  // 스트리밍 중 아직 닫히지 않은 블록
  const open = rest.match(/```(mermaid|chart)[^\n]*\n[\s\S]*$/);
  if (open && open.index !== undefined) {
    if (open.index > 0) out.push({ kind: "md", text: rest.slice(0, open.index) });
    out.push({ kind: "pending", lang: open[1] });
  } else if (rest) out.push({ kind: "md", text: rest });
  return out;
}

export function RichMarkdown({ src }: { src: string }) {
  const segs = useMemo(() => splitSegments(src), [src]);
  return (
    <div className="prose-md">
      {segs.map((s, i) =>
        s.kind === "md" ? (
          <div key={i} dangerouslySetInnerHTML={{ __html: renderMarkdown(s.text) }} />
        ) : s.kind === "mermaid" ? (
          <Mermaid key={i} code={s.code} />
        ) : s.kind === "chart" ? (
          <ChartFigure key={i} code={s.code} />
        ) : (
          <div key={i} className="my-3 rounded-md border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">
            {s.lang === "mermaid" ? "다이어그램" : "차트"} 그리는 중…
          </div>
        ),
      )}
    </div>
  );
}

/* ───────────── Mermaid 다이어그램 ───────────── */

let mermaidReady: Promise<typeof import("mermaid").default> | null = null;
export function loadMermaid() {
  mermaidReady ??= import("mermaid").then((m) => {
    m.default.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "neutral",
      fontFamily: '"Pretendard","Malgun Gothic","Apple SD Gothic Neo",sans-serif',
      // 이미지(Word) 변환을 위해 HTML 라벨 대신 SVG 텍스트 사용
      flowchart: { htmlLabels: false },
      htmlLabels: false,
    });
    return m.default;
  });
  return mermaidReady;
}

let seq = 0;
export async function mermaidSvg(code: string) {
  const mermaid = await loadMermaid();
  const { svg } = await mermaid.render(`mmd-${Date.now()}-${seq++}`, code);
  return svg;
}

function Mermaid({ code }: { code: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    mermaidSvg(code)
      .then((s) => alive && setSvg(s))
      .catch((e) => alive && setErr(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [code]);
  if (err)
    return (
      <details className="my-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <summary>다이어그램을 그리지 못했습니다 (원본 보기)</summary>
        <pre className="mt-2 whitespace-pre-wrap">{code}</pre>
      </details>
    );
  if (!svg) return <div className="my-3 h-24 animate-pulse rounded-md bg-slate-100" />;
  return <div className="my-4 flex justify-center overflow-x-auto [&_svg]:max-w-full [&_svg]:h-auto" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/* ───────────── 차트 ───────────── */

export interface ChartSpec {
  type: "bar" | "line" | "pie" | "radar";
  title?: string;
  xKey?: string;
  series?: { key: string; name?: string }[];
  data: Record<string, string | number>[];
}

export function parseChart(code: string): ChartSpec | null {
  try {
    const s = JSON.parse(code) as ChartSpec;
    if (!s || !Array.isArray(s.data) || !["bar", "line", "pie", "radar"].includes(s.type)) return null;
    return s;
  } catch {
    return null;
  }
}

function ChartFigure({ code }: { code: string }) {
  const spec = useMemo(() => parseChart(code), [code]);
  const [w, setW] = useState(640);
  const id = useId();
  useEffect(() => {
    const el = document.getElementById(id);
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.min(720, Math.max(280, Math.floor(e.contentRect.width)))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [id]);
  if (!spec)
    return (
      <details className="my-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <summary>차트 데이터를 읽지 못했습니다 (원본 보기)</summary>
        <pre className="mt-2 whitespace-pre-wrap">{code}</pre>
      </details>
    );
  return (
    <figure id={id} className="my-4">
      {spec.title && <figcaption className="mb-1 text-center text-sm font-semibold text-slate-700">{spec.title}</figcaption>}
      <div className="flex justify-center">
        <ChartSvg spec={spec} width={w} height={300} />
      </div>
    </figure>
  );
}

const legendText = (v: string) => <span style={{ color: INK.secondary }}>{v}</span>;

/** 고정 크기 차트 (화면 표시와 Word 이미지 변환에 공용) */
export function ChartSvg({ spec, width, height, animate = true }: { spec: ChartSpec; width: number; height: number; animate?: boolean }) {
  const xKey = spec.xKey ?? "name";
  const series = (spec.series?.length ? spec.series : [{ key: "value", name: "값" }]).slice(0, SERIES.length);
  const many = series.length > 1;
  const axis = { tick: { fontSize: 11, fill: INK.secondary }, stroke: INK.grid };
  if (spec.type === "pie") {
    const data = spec.data.slice(0, SERIES.length);
    return (
      <PieChart width={width} height={height}>
        <Pie
          data={data}
          dataKey={series[0].key in (data[0] ?? {}) ? series[0].key : "value"}
          nameKey={xKey}
          innerRadius="45%"
          outerRadius="75%"
          paddingAngle={1}
          stroke="#fff"
          strokeWidth={2}
          isAnimationActive={animate}
          label={({ x, y, name, percent, textAnchor }) => (
            <text x={x} y={y} textAnchor={textAnchor} dominantBaseline="central" fontSize={12} fill={INK.secondary}>
              {`${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
            </text>
          )}
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={SERIES[i]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} formatter={legendText} />
      </PieChart>
    );
  }
  if (spec.type === "radar") {
    return (
      <RadarChart width={width} height={height} data={spec.data} outerRadius="70%">
        <PolarGrid stroke={INK.grid} />
        <PolarAngleAxis dataKey={xKey} tick={{ fontSize: 11, fill: INK.secondary }} />
        <PolarRadiusAxis tick={{ fontSize: 9, fill: INK.muted }} axisLine={false} />
        {series.map((s, i) => (
          <Radar key={s.key} dataKey={s.key} name={s.name ?? s.key} stroke={SERIES[i]} strokeWidth={2} fill={SERIES[i]} fillOpacity={0.15} isAnimationActive={animate} />
        ))}
        <Tooltip />
        {many && <Legend wrapperStyle={{ fontSize: 12 }} formatter={legendText} />}
      </RadarChart>
    );
  }
  if (spec.type === "line") {
    return (
      <LineChart width={width} height={height} data={spec.data} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={INK.grid} vertical={false} />
        <XAxis dataKey={xKey} {...axis} />
        <YAxis {...axis} />
        {series.map((s, i) => (
          <Line key={s.key} dataKey={s.key} name={s.name ?? s.key} stroke={SERIES[i]} strokeWidth={2} dot={{ r: 4 }} isAnimationActive={animate} />
        ))}
        <Tooltip />
        {many && <Legend wrapperStyle={{ fontSize: 12 }} formatter={legendText} />}
      </LineChart>
    );
  }
  return (
    <BarChart width={width} height={height} data={spec.data} margin={{ top: 10, right: 20, bottom: 0, left: 0 }} barGap={2}>
      <CartesianGrid stroke={INK.grid} vertical={false} />
      <XAxis dataKey={xKey} {...axis} />
      <YAxis {...axis} />
      {series.map((s, i) => (
        <Bar key={s.key} dataKey={s.key} name={s.name ?? s.key} fill={SERIES[i]} radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={animate} />
      ))}
      <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
      {many && <Legend wrapperStyle={{ fontSize: 12 }} formatter={legendText} />}
    </BarChart>
  );
}
