import type { AnalysisResult, Bid, BidStatus } from "../../shared/types";
import { RECOMMENDATION_LABEL, STATUS_LABEL } from "../../shared/types";
import { cellText } from "./extract";
import { saveBlob } from "./api";

type BidWithAnalysis = Bid & { analysis: AnalysisResult | null };

const VERDICT = { pass: "충족", fail: "미충족", unknown: "확인필요" } as const;
const HAVE = { yes: "보유", no: "미보유", unknown: "확인필요" } as const;

/** 관심 입찰 + 분석 결과를 엑셀로 (기존 수작업 엑셀을 대체) */
export async function exportBids(rows: BidWithAnalysis[]) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();

  const head = (ws: import("exceljs").Worksheet) => {
    const r = ws.getRow(1);
    r.font = { bold: true, color: { argb: "FFFFFFFF" } };
    r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A5F" } };
    r.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  };

  const main = wb.addWorksheet("관심입찰");
  main.columns = [
    { header: "공고번호", key: "id", width: 18 },
    { header: "구분", key: "category", width: 6 },
    { header: "공고명", key: "title", width: 48 },
    { header: "공고기관", key: "org", width: 20 },
    { header: "수요기관", key: "demand", width: 20 },
    { header: "공고일시", key: "notice", width: 17 },
    { header: "입찰마감", key: "close", width: 17 },
    { header: "개찰일시", key: "open", width: 17 },
    { header: "추정가격", key: "est", width: 15, style: { numFmt: "#,##0" } },
    { header: "배정예산", key: "budget", width: 15, style: { numFmt: "#,##0" } },
    { header: "계약방법", key: "contract", width: 16 },
    { header: "진행상태", key: "status", width: 9 },
    { header: "적합도", key: "fit", width: 7 },
    { header: "등급", key: "grade", width: 5 },
    { header: "권고", key: "rec", width: 11 },
    { header: "자격요건", key: "elig", width: 30 },
    { header: "신인도 예상", key: "cred", width: 10 },
    { header: "예상총점", key: "total", width: 12 },
    { header: "주요 유의사항", key: "cautions", width: 50 },
    { header: "미보유 서류", key: "missing", width: 40 },
    { header: "메모", key: "memo", width: 30 },
    { header: "최종수정", key: "updated", width: 17 },
  ];
  for (const b of rows) {
    const a = b.analysis;
    const fails = a?.eligibility.filter((e) => e.verdict === "fail") ?? [];
    const unknowns = a?.eligibility.filter((e) => e.verdict === "unknown") ?? [];
    main.addRow({
      id: b.id,
      category: b.category,
      title: b.title,
      org: b.org,
      demand: b.demand_org,
      notice: b.notice_dt,
      close: b.close_dt,
      open: b.open_dt,
      est: b.est_price,
      budget: b.budget,
      contract: b.contract_method,
      status: STATUS_LABEL[b.status] ?? b.status,
      fit: b.fit_score,
      grade: a?.fit.grade ?? "",
      rec: b.recommendation ? RECOMMENDATION_LABEL[b.recommendation] : "",
      elig: a
        ? fails.length
          ? `미충족: ${fails.map((f) => f.requirement).join("; ")}`
          : unknowns.length
            ? `확인필요 ${unknowns.length}건`
            : "전 항목 충족"
        : "",
      cred: a?.scoring.credibility_adjustment ?? "",
      total: a?.scoring.total_expected != null ? `${a.scoring.total_expected}/${a.scoring.total_max ?? "?"}` : "",
      cautions: a?.cautions.filter((x) => x.severity === "high").map((x) => `• ${x.title}`).join("\n") ?? "",
      missing: a?.required_documents.filter((d) => d.have !== "yes").map((d) => `• ${d.name}`).join("\n") ?? "",
      memo: b.memo,
      updated: b.updated_at,
    });
  }
  main.eachRow((r, i) => {
    if (i > 1) r.alignment = { vertical: "top", wrapText: true };
  });
  head(main);

  const elig = wb.addWorksheet("자격요건");
  elig.columns = [
    { header: "공고번호", key: "id", width: 18 },
    { header: "공고명", key: "title", width: 36 },
    { header: "요건", key: "req", width: 44 },
    { header: "근거", key: "src", width: 22 },
    { header: "당사 현황", key: "status", width: 36 },
    { header: "판정", key: "verdict", width: 9 },
    { header: "필요 조치", key: "action", width: 36 },
  ];
  const cred = wb.addWorksheet("신인도·점수");
  cred.columns = [
    { header: "공고번호", key: "id", width: 18 },
    { header: "공고명", key: "title", width: 36 },
    { header: "구분", key: "kind", width: 8 },
    { header: "항목", key: "item", width: 30 },
    { header: "배점", key: "max", width: 8 },
    { header: "예상점수", key: "exp", width: 9 },
    { header: "근거/비고", key: "note", width: 60 },
  ];
  const caut = wb.addWorksheet("유의사항");
  caut.columns = [
    { header: "공고번호", key: "id", width: 18 },
    { header: "공고명", key: "title", width: 36 },
    { header: "중요도", key: "sev", width: 8 },
    { header: "항목", key: "t", width: 30 },
    { header: "내용", key: "d", width: 80 },
  ];
  const docs = wb.addWorksheet("제출서류");
  docs.columns = [
    { header: "공고번호", key: "id", width: 18 },
    { header: "공고명", key: "title", width: 36 },
    { header: "단계", key: "stage", width: 10 },
    { header: "서류", key: "name", width: 40 },
    { header: "보유", key: "have", width: 9 },
    { header: "비고", key: "note", width: 50 },
  ];
  const SEV = { high: "높음", medium: "보통", low: "낮음" } as const;
  for (const b of rows) {
    const a = b.analysis;
    if (!a) continue;
    for (const e of a.eligibility)
      elig.addRow({ id: b.id, title: b.title, req: e.requirement, src: e.source, status: e.company_status, verdict: VERDICT[e.verdict], action: e.action_needed });
    for (const t of a.scoring.technical_items)
      cred.addRow({ id: b.id, title: b.title, kind: "기술", item: t.item, max: t.max_points, exp: t.expected_points, note: t.rationale });
    for (const c of a.credibility)
      cred.addRow({ id: b.id, title: b.title, kind: "신인도", item: c.item, max: c.max_points, exp: c.expected_points, note: `${c.criteria} / ${c.note}` });
    for (const c of a.cautions) caut.addRow({ id: b.id, title: b.title, sev: SEV[c.severity], t: c.title, d: c.detail });
    for (const d of a.required_documents)
      docs.addRow({ id: b.id, title: b.title, stage: d.stage, name: d.name, have: HAVE[d.have], note: d.note });
  }
  for (const ws of [elig, cred, caut, docs]) {
    ws.eachRow((r, i) => {
      if (i > 1) r.alignment = { vertical: "top", wrapText: true };
    });
    head(ws);
  }

  const buf = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  saveBlob(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `관심입찰_분석_${stamp}.xlsx`,
  );
}

/* ───────────── 기존 엑셀 가져오기 ───────────── */

export interface ImportRow {
  bid_no: string;
  bid_ord?: string;
  category?: string;
  title: string;
  org?: string;
  demand_org?: string;
  notice_dt?: string;
  close_dt?: string;
  open_dt?: string;
  est_price?: number | null;
  budget?: number | null;
  contract_method?: string;
  status?: BidStatus;
  fit_score?: number | null;
  memo?: string;
}

const HEADER_MAP: [keyof ImportRow, RegExp][] = [
  ["bid_no", /공고\s*번호|입찰\s*번호/],
  ["category", /^(구분|업무구분|분류)$/],
  ["title", /공고\s*명|사업\s*명|입찰\s*명|건\s*명/],
  ["demand_org", /수요\s*기관/],
  ["org", /공고\s*기관|발주\s*기관|발주처|기관\s*명/],
  ["notice_dt", /공고\s*(일|일시|일자)|게시일/],
  ["close_dt", /마감/],
  ["open_dt", /개찰/],
  ["est_price", /추정\s*가격|기초\s*금액/],
  ["budget", /예산|사업\s*금액|금액/],
  ["contract_method", /계약\s*방법/],
  ["status", /상태|진행/],
  ["fit_score", /적합도|점수/],
  ["memo", /메모|비고|의견|검토/],
];

const STATUS_FROM_LABEL = Object.fromEntries(Object.entries(STATUS_LABEL).map(([k, v]) => [v, k])) as Record<string, BidStatus>;

export async function parseImport(file: File): Promise<{ rows: ImportRow[]; mapped: string[] }> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("시트가 없습니다");

  // 헤더 행 찾기 (상단 10행 안에서 '공고번호'/'공고명'이 있는 행)
  let headerRow = 0;
  let colMap: Partial<Record<keyof ImportRow, number>> = {};
  for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
    const map: Partial<Record<keyof ImportRow, number>> = {};
    ws.getRow(r).eachCell((cell, col) => {
      const h = cellText(cell.value).trim();
      for (const [key, re] of HEADER_MAP) {
        if (map[key] === undefined && re.test(h)) {
          map[key] = col;
          break;
        }
      }
    });
    if (map.bid_no !== undefined && map.title !== undefined) {
      headerRow = r;
      colMap = map;
      break;
    }
  }
  if (!headerRow) throw new Error("'공고번호'와 '공고명' 열을 찾지 못했습니다. 첫 시트의 머리글을 확인하세요.");

  const rows: ImportRow[] = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const get = (k: keyof ImportRow) => (colMap[k] ? cellText(row.getCell(colMap[k]!).value).trim() : "");
    const rawNo = get("bid_no");
    const title = get("title");
    if (!rawNo || !title) continue;
    const [bidNo, ord] = rawNo.split("-");
    const n = (s: string) => {
      const v = Number(s.replace(/[^\d.-]/g, ""));
      return s && Number.isFinite(v) ? v : null;
    };
    const statusLabel = get("status");
    rows.push({
      bid_no: bidNo.trim(),
      bid_ord: ord?.trim() || "000",
      category: get("category") || undefined,
      title,
      org: get("org") || undefined,
      demand_org: get("demand_org") || undefined,
      notice_dt: get("notice_dt") || undefined,
      close_dt: get("close_dt") || undefined,
      open_dt: get("open_dt") || undefined,
      est_price: n(get("est_price")),
      budget: n(get("budget")),
      contract_method: get("contract_method") || undefined,
      status: STATUS_FROM_LABEL[statusLabel],
      fit_score: n(get("fit_score")),
      memo: get("memo") || undefined,
    });
  }
  return { rows, mapped: Object.keys(colMap) };
}
