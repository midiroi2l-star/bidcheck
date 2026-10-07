import { Hono, type Context } from "hono";
import { analyzeBid, draftProposal, extractProfile, type Env } from "./claude";
import { storage } from "./storage";
import { downloadAttachment, G2BError, lookupNotice, searchNotices } from "./g2b";
import {
  BID_CATEGORIES,
  BID_STATUSES,
  FILE_KINDS,
  STATUS_LABEL,
  type AnalysisResult,
  type Bid,
  type BidCategory,
  type BidStatus,
  type G2BNotice,
  type StreamEvent,
} from "../shared/types";

const app = new Hono<{ Bindings: Env }>().basePath("/api");

/* ───────────── 공통 ───────────── */

app.onError((err, c) => {
  console.error(err);
  const status = err instanceof G2BError ? 502 : 500;
  return c.json({ error: err.message || "서버 오류" }, status);
});

// APP_PASSWORD 가 설정되어 있으면 모든 API 에 Bearer 비밀번호를 요구한다
app.use("*", async (c, next) => {
  const pw = c.env.APP_PASSWORD;
  if (pw && c.req.path !== "/api/health") {
    const got = c.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
    if (got !== pw) return c.json({ error: "비밀번호가 필요합니다." }, 401);
  }
  await next();
});

async function log(env: Env, bidId: string | null, action: string, detail?: string) {
  await env.DB.prepare("INSERT INTO history (bid_id, action, detail) VALUES (?, ?, ?)")
    .bind(bidId, action, detail ?? null)
    .run();
}

async function getBid(env: Env, id: string) {
  return env.DB.prepare("SELECT * FROM bids WHERE id = ?").bind(id).first<Bid>();
}

/** 오래 걸리는 Claude 작업을 NDJSON 스트림으로 내보낸다 (연결 유지 + 진행 상황 표시) */
function streamJob(c: Context<{ Bindings: Env }>, job: (emit: (e: StreamEvent) => void) => Promise<unknown>) {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  let closed = false;
  const emit = (e: StreamEvent) => {
    if (closed) return;
    writer.write(enc.encode(JSON.stringify(e) + "\n")).catch(() => {
      closed = true;
    });
  };
  const keepAlive = setInterval(() => emit({ type: "status", message: "" }), 15000);
  const run = (async () => {
    try {
      emit({ type: "done", data: await job(emit) });
    } catch (e) {
      console.error(e);
      emit({ type: "error", message: e instanceof Error ? e.message : String(e) });
    } finally {
      clearInterval(keepAlive);
      closed = true;
      await writer.close().catch(() => {});
    }
  })();
  c.executionCtx.waitUntil(run);
  return new Response(readable, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

// eslint-disable-next-line no-control-regex
const safeName = (n: string) => n.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 180);

/* ───────────── 상태 ───────────── */

app.get("/health", (c) =>
  c.json({
    g2b: Boolean(c.env.G2B_SERVICE_KEY),
    claude: Boolean(c.env.ANTHROPIC_API_KEY),
    auth: Boolean(c.env.APP_PASSWORD),
    storage: c.env.FILES ? "r2" : "d1",
    model: c.env.CLAUDE_MODEL,
  }),
);

app.get("/dashboard", async (c) => {
  const db = c.env.DB;
  const [counts, upcoming, recent] = await Promise.all([
    db.prepare("SELECT status, COUNT(*) AS n FROM bids GROUP BY status").all<{ status: BidStatus; n: number }>(),
    db
      .prepare(
        "SELECT * FROM bids WHERE status IN ('interest','analyzed','in_progress') AND close_dt IS NOT NULL ORDER BY updated_at DESC LIMIT 300",
      )
      .all<Bid>(),
    db
      .prepare(
        "SELECT h.*, b.title AS bid_title FROM history h LEFT JOIN bids b ON b.id = h.bid_id ORDER BY h.id DESC LIMIT 15",
      )
      .all(),
  ]);
  return c.json({ counts: counts.results, active: upcoming.results, recent: recent.results });
});

/* ───────────── 나라장터 ───────────── */

function requireG2BKey(env: Env) {
  if (!env.G2B_SERVICE_KEY) throw new G2BError("G2B_SERVICE_KEY(공공데이터포털 인증키)가 설정되지 않았습니다.");
  return env.G2B_SERVICE_KEY;
}

const asCategory = (v: string | undefined): BidCategory =>
  (BID_CATEGORIES as readonly string[]).includes(v ?? "") ? (v as BidCategory) : "용역";

app.get("/g2b/search", async (c) => {
  const q = c.req.query();
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() + 9 * 3600_000 - 7 * 86400_000).toISOString().slice(0, 10);
  const res = await searchNotices(c.env.G2B_API_BASE, requireG2BKey(c.env), {
    category: asCategory(q.category),
    keyword: q.keyword?.trim() || undefined,
    org: q.org?.trim() || undefined,
    from: q.from || weekAgo,
    to: q.to || today,
    page: Number(q.page) || 1,
    rows: Math.min(Number(q.rows) || 50, 100),
  });
  // 이미 관심 등록된 공고 표시
  const saved = new Map<string, string>();
  if (res.items.length) {
    const rows = await c.env.DB.prepare(
      `SELECT bid_no, status FROM bids WHERE bid_no IN (${res.items.map(() => "?").join(",")})`,
    )
      .bind(...res.items.map((n) => n.bidNo))
      .all<{ bid_no: string; status: string }>();
    for (const r of rows.results) saved.set(r.bid_no, r.status);
  }
  return c.json({
    totalCount: res.totalCount,
    items: res.items.map((n) => ({ ...n, savedStatus: saved.get(n.bidNo) ?? null })),
  });
});

app.get("/g2b/lookup", async (c) => {
  const bidNo = (c.req.query("bidNo") ?? "").trim().split("-")[0];
  if (!bidNo) return c.json({ error: "공고번호를 입력하세요." }, 400);
  const notice = await lookupNotice(c.env.G2B_API_BASE, requireG2BKey(c.env), bidNo, asCategory(c.req.query("category")));
  if (!notice) return c.json({ error: "해당 공고를 찾지 못했습니다. 구분(용역/물품/공사)을 확인하세요." }, 404);
  return c.json(notice);
});

/* ───────────── 관심 입찰 ───────────── */

app.get("/bids", async (c) => {
  const status = c.req.query("status");
  const withAnalysis = c.req.query("withAnalysis") === "1";
  const stmt = status
    ? c.env.DB.prepare("SELECT * FROM bids WHERE status = ? ORDER BY updated_at DESC").bind(status)
    : c.env.DB.prepare("SELECT * FROM bids ORDER BY updated_at DESC");
  const bids = (await stmt.all<Bid>()).results;
  if (!withAnalysis) return c.json(bids);
  // 엑셀 내보내기용: 입찰별 최신 분석 포함
  const latest = await c.env.DB.prepare(
    "SELECT a.bid_id, a.result_json FROM analyses a JOIN (SELECT bid_id, MAX(created_at) m FROM analyses GROUP BY bid_id) x ON x.bid_id = a.bid_id AND x.m = a.created_at",
  ).all<{ bid_id: string; result_json: string }>();
  const map = new Map(latest.results.map((r) => [r.bid_id, JSON.parse(r.result_json) as AnalysisResult]));
  return c.json(bids.map((b) => ({ ...b, analysis: map.get(b.id) ?? null })));
});

interface ManualBid {
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
  award_method?: string;
  detail_url?: string;
  status?: BidStatus;
  memo?: string;
  fit_score?: number | null;
}

function noticeToRow(n: G2BNotice): ManualBid & { raw_json: string } {
  return {
    bid_no: n.bidNo,
    bid_ord: n.bidOrd,
    category: n.category,
    title: n.title,
    org: n.org,
    demand_org: n.demandOrg,
    notice_dt: n.noticeDt ?? undefined,
    close_dt: n.closeDt ?? undefined,
    open_dt: n.openDt ?? undefined,
    est_price: n.estPrice,
    budget: n.budget,
    contract_method: n.contractMethod ?? undefined,
    award_method: n.awardMethod ?? undefined,
    detail_url: n.detailUrl ?? undefined,
    raw_json: JSON.stringify({ ...n.raw, _attachments: n.attachments }),
  };
}

async function upsertBid(env: Env, r: ManualBid & { raw_json?: string }) {
  const id = `${r.bid_no}-${r.bid_ord || "000"}`;
  const status = r.status && (BID_STATUSES as readonly string[]).includes(r.status) ? r.status : "interest";
  const existed = await getBid(env, id);
  await env.DB.prepare(
    `INSERT INTO bids (id, bid_no, bid_ord, category, title, org, demand_org, notice_dt, close_dt, open_dt,
       est_price, budget, contract_method, award_method, detail_url, raw_json, status, memo, fit_score)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       title=excluded.title, org=COALESCE(excluded.org, org), demand_org=COALESCE(excluded.demand_org, demand_org),
       notice_dt=COALESCE(excluded.notice_dt, notice_dt), close_dt=COALESCE(excluded.close_dt, close_dt),
       open_dt=COALESCE(excluded.open_dt, open_dt), est_price=COALESCE(excluded.est_price, est_price),
       budget=COALESCE(excluded.budget, budget), contract_method=COALESCE(excluded.contract_method, contract_method),
       award_method=COALESCE(excluded.award_method, award_method), detail_url=COALESCE(excluded.detail_url, detail_url),
       raw_json=COALESCE(excluded.raw_json, raw_json), updated_at=datetime('now')`,
  )
    .bind(
      id,
      r.bid_no,
      r.bid_ord || "000",
      r.category ?? null,
      r.title,
      r.org ?? null,
      r.demand_org ?? null,
      r.notice_dt ?? null,
      r.close_dt ?? null,
      r.open_dt ?? null,
      r.est_price ?? null,
      r.budget ?? null,
      r.contract_method ?? null,
      r.award_method ?? null,
      r.detail_url ?? null,
      r.raw_json ?? null,
      status,
      r.memo ?? null,
      r.fit_score ?? null,
    )
    .run();
  return { id, created: !existed };
}

app.post("/bids", async (c) => {
  const body = await c.req.json<{ notice?: G2BNotice } & Partial<ManualBid>>();
  const row = body.notice ? noticeToRow(body.notice) : (body as ManualBid);
  if (!row.bid_no || !row.title) return c.json({ error: "공고번호와 공고명은 필수입니다." }, 400);
  const { id, created } = await upsertBid(c.env, row);
  await log(c.env, id, created ? "관심 등록" : "공고 정보 갱신", row.title);
  return c.json(await getBid(c.env, id));
});

/** 기존 엑셀(수기 관리 이력) 일괄 등록 */
app.post("/bids/import", async (c) => {
  const { rows } = await c.req.json<{ rows: ManualBid[] }>();
  let created = 0;
  let updated = 0;
  for (const r of rows ?? []) {
    if (!r.bid_no || !r.title) continue;
    const res = await upsertBid(c.env, r);
    if (res.created) created++;
    else updated++;
    if (r.memo || r.fit_score != null || r.status) {
      await c.env.DB.prepare(
        "UPDATE bids SET memo = COALESCE(?, memo), fit_score = COALESCE(?, fit_score), status = COALESCE(?, status) WHERE id = ?",
      )
        .bind(r.memo ?? null, r.fit_score ?? null, r.status ?? null, res.id)
        .run();
    }
  }
  await log(c.env, null, "엑셀 가져오기", `신규 ${created}건, 갱신 ${updated}건`);
  return c.json({ created, updated });
});

app.get("/bids/:id", async (c) => {
  const id = c.req.param("id");
  const bid = await getBid(c.env, id);
  if (!bid) return c.json({ error: "입찰을 찾을 수 없습니다." }, 404);
  const db = c.env.DB;
  const [files, analyses, proposals, history] = await Promise.all([
    db
      .prepare("SELECT id, bid_id, kind, filename, mime, size, source_url, has_text, uploaded_at FROM bid_files WHERE bid_id = ? ORDER BY uploaded_at")
      .bind(id)
      .all(),
    db.prepare("SELECT * FROM analyses WHERE bid_id = ? ORDER BY created_at DESC").bind(id).all<{
      id: string;
      result_json: string;
    }>(),
    db.prepare("SELECT * FROM proposals WHERE bid_id = ? ORDER BY version DESC").bind(id).all(),
    db.prepare("SELECT * FROM history WHERE bid_id = ? ORDER BY id DESC").bind(id).all(),
  ]);
  return c.json({
    bid,
    files: files.results,
    analyses: analyses.results.map(({ result_json, ...a }) => ({ ...a, result: JSON.parse(result_json) })),
    proposals: proposals.results,
    history: history.results,
  });
});

app.patch("/bids/:id", async (c) => {
  const id = c.req.param("id");
  const bid = await getBid(c.env, id);
  if (!bid) return c.json({ error: "입찰을 찾을 수 없습니다." }, 404);
  const body = await c.req.json<{ status?: BidStatus; memo?: string; close_dt?: string }>();
  if (body.status && body.status !== bid.status) {
    if (!(BID_STATUSES as readonly string[]).includes(body.status)) return c.json({ error: "잘못된 상태" }, 400);
    await c.env.DB.prepare("UPDATE bids SET status = ?, updated_at = datetime('now') WHERE id = ?").bind(body.status, id).run();
    await log(c.env, id, "상태 변경", `${STATUS_LABEL[bid.status]} → ${STATUS_LABEL[body.status]}`);
  }
  if (body.memo !== undefined && body.memo !== bid.memo) {
    await c.env.DB.prepare("UPDATE bids SET memo = ?, updated_at = datetime('now') WHERE id = ?").bind(body.memo, id).run();
    await log(c.env, id, "메모 수정");
  }
  if (body.close_dt !== undefined) {
    await c.env.DB.prepare("UPDATE bids SET close_dt = ?, updated_at = datetime('now') WHERE id = ?").bind(body.close_dt || null, id).run();
  }
  return c.json(await getBid(c.env, id));
});

app.delete("/bids/:id", async (c) => {
  const id = c.req.param("id");
  const bid = await getBid(c.env, id);
  if (!bid) return c.json({ ok: true });
  const files = await c.env.DB.prepare("SELECT id, r2_key FROM bid_files WHERE bid_id = ?").bind(id).all<{ id: string; r2_key: string }>();
  await storage(c.env).delete(files.results.flatMap((f) => [f.r2_key, `text/${f.id}.txt`]));
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM bid_files WHERE bid_id = ?").bind(id),
    c.env.DB.prepare("DELETE FROM analyses WHERE bid_id = ?").bind(id),
    c.env.DB.prepare("DELETE FROM proposals WHERE bid_id = ?").bind(id),
    c.env.DB.prepare("DELETE FROM bids WHERE id = ?").bind(id),
  ]);
  await log(c.env, null, "관심 입찰 삭제", `${bid.title} (${id})`);
  return c.json({ ok: true });
});

/* ───────────── 입찰 첨부파일 ───────────── */

async function storeText(env: Env, id: string, text: string | null | undefined) {
  if (!text?.trim()) return false;
  await storage(env).put(`text/${id}.txt`, text, "text/plain; charset=utf-8");
  return true;
}

app.post("/bids/:id/files", async (c) => {
  const bidId = c.req.param("id");
  if (!(await getBid(c.env, bidId))) return c.json({ error: "입찰을 찾을 수 없습니다." }, 404);
  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return c.json({ error: "파일이 없습니다." }, 400);
  const kind = String(form.get("kind") ?? "other");
  const fileId = crypto.randomUUID();
  const key = `bids/${bidId}/${fileId}/${safeName(file.name)}`;
  await storage(c.env).put(key, await file.arrayBuffer(), file.type || "application/octet-stream");
  const hasText = await storeText(c.env, fileId, form.get("text") as string | null);
  await c.env.DB.prepare(
    "INSERT INTO bid_files (id, bid_id, kind, filename, mime, size, r2_key, has_text) VALUES (?,?,?,?,?,?,?,?)",
  )
    .bind(fileId, bidId, kind in FILE_KINDS ? kind : "other", file.name, file.type || null, file.size, key, hasText ? 1 : 0)
    .run();
  await log(c.env, bidId, "첨부 등록", `${FILE_KINDS[kind as keyof typeof FILE_KINDS] ?? "기타"}: ${file.name}`);
  return c.json({ id: fileId });
});

/** 나라장터 공고의 첨부파일 URL 에서 직접 내려받기 */
app.post("/bids/:id/fetch-attachments", async (c) => {
  const bidId = c.req.param("id");
  const bid = await getBid(c.env, bidId);
  if (!bid) return c.json({ error: "입찰을 찾을 수 없습니다." }, 404);
  const raw = bid.raw_json ? (JSON.parse(bid.raw_json) as { _attachments?: { name: string; url: string }[] }) : {};
  const atts = raw._attachments ?? [];
  const existing = await c.env.DB.prepare("SELECT source_url FROM bid_files WHERE bid_id = ?").bind(bidId).all<{ source_url: string | null }>();
  const have = new Set(existing.results.map((r) => r.source_url));
  const results: { name: string; ok: boolean; error?: string; id?: string }[] = [];
  for (const a of atts) {
    if (have.has(a.url)) {
      results.push({ name: a.name, ok: true, error: "이미 등록됨" });
      continue;
    }
    try {
      const { name, type, buf } = await downloadAttachment(a.url, a.name);
      const fileId = crypto.randomUUID();
      const key = `bids/${bidId}/${fileId}/${safeName(name)}`;
      await storage(c.env).put(key, buf, type);
      const kind = /제안요청|RFP/i.test(name) ? "rfp" : /공고/.test(name) ? "notice" : /과업|규격|시방/.test(name) ? "spec" : /서식|양식/.test(name) ? "form" : "other";
      await c.env.DB.prepare(
        "INSERT INTO bid_files (id, bid_id, kind, filename, mime, size, r2_key, source_url) VALUES (?,?,?,?,?,?,?,?)",
      )
        .bind(fileId, bidId, kind, name, type, buf.byteLength, key, a.url)
        .run();
      results.push({ name, ok: true, id: fileId });
    } catch (e) {
      results.push({ name: a.name, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  const okCount = results.filter((r) => r.id).length;
  if (okCount) await log(c.env, bidId, "나라장터 첨부 내려받기", `${okCount}건`);
  return c.json({ total: atts.length, results });
});

app.get("/bid-files/:fid", async (c) => {
  const f = await c.env.DB.prepare("SELECT filename, mime, r2_key FROM bid_files WHERE id = ?")
    .bind(c.req.param("fid"))
    .first<{ filename: string; mime: string | null; r2_key: string }>();
  return serveR2(c, f);
});

app.put("/bid-files/:fid/text", async (c) => {
  const fid = c.req.param("fid");
  const ok = await storeText(c.env, fid, await c.req.text());
  await c.env.DB.prepare("UPDATE bid_files SET has_text = ? WHERE id = ?").bind(ok ? 1 : 0, fid).run();
  return c.json({ ok });
});

app.patch("/bid-files/:fid", async (c) => {
  const { kind } = await c.req.json<{ kind: string }>();
  if (!(kind in FILE_KINDS)) return c.json({ error: "잘못된 분류" }, 400);
  await c.env.DB.prepare("UPDATE bid_files SET kind = ? WHERE id = ?").bind(kind, c.req.param("fid")).run();
  return c.json({ ok: true });
});

app.delete("/bid-files/:fid", async (c) => {
  const fid = c.req.param("fid");
  const f = await c.env.DB.prepare("SELECT bid_id, filename, r2_key FROM bid_files WHERE id = ?")
    .bind(fid)
    .first<{ bid_id: string; filename: string; r2_key: string }>();
  if (f) {
    await storage(c.env).delete([f.r2_key, `text/${fid}.txt`]);
    await c.env.DB.prepare("DELETE FROM bid_files WHERE id = ?").bind(fid).run();
    await log(c.env, f.bid_id, "첨부 삭제", f.filename);
  }
  return c.json({ ok: true });
});

async function serveR2(c: Context<{ Bindings: Env }>, f: { filename: string; mime: string | null; r2_key: string } | null) {
  if (!f) return c.json({ error: "파일 없음" }, 404);
  const obj = await storage(c.env).get(f.r2_key);
  if (!obj) return c.json({ error: "파일 없음" }, 404);
  return new Response(obj.stream(), {
    headers: {
      "Content-Type": f.mime || "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(f.filename)}`,
    },
  });
}

/* ───────────── AI 분석 / 제안서 ───────────── */

app.post("/bids/:id/analyze", async (c) => {
  const id = c.req.param("id");
  const bid = await getBid(c.env, id);
  if (!bid) return c.json({ error: "입찰을 찾을 수 없습니다." }, 404);
  return streamJob(c, async (emit) => {
    const { result, model } = await analyzeBid(c.env, bid, emit);
    const aid = crypto.randomUUID();
    const score = Math.round(result.fit.score);
    await c.env.DB.batch([
      c.env.DB.prepare(
        "INSERT INTO analyses (id, bid_id, model, fit_score, recommendation, result_json) VALUES (?,?,?,?,?,?)",
      ).bind(aid, id, model, score, result.recommendation, JSON.stringify(result)),
      c.env.DB.prepare(
        `UPDATE bids SET fit_score = ?, recommendation = ?, status = CASE WHEN status = 'interest' THEN 'analyzed' ELSE status END,
           updated_at = datetime('now') WHERE id = ?`,
      ).bind(score, result.recommendation, id),
    ]);
    await log(c.env, id, "AI 분석", `적합도 ${score}점 (${result.fit.grade}) · ${result.recommendation}`);
    return { id: aid };
  });
});

app.post("/bids/:id/proposal", async (c) => {
  const id = c.req.param("id");
  const bid = await getBid(c.env, id);
  if (!bid) return c.json({ error: "입찰을 찾을 수 없습니다." }, 404);
  const { instructions } = await c.req.json<{ instructions?: string }>().catch(() => ({ instructions: "" }));
  const latest = await c.env.DB.prepare("SELECT result_json FROM analyses WHERE bid_id = ? ORDER BY created_at DESC LIMIT 1")
    .bind(id)
    .first<{ result_json: string }>();
  return streamJob(c, async (emit) => {
    const md = await draftProposal(
      c.env,
      bid,
      latest ? (JSON.parse(latest.result_json) as AnalysisResult) : null,
      instructions ?? "",
      emit,
    );
    const v = await c.env.DB.prepare("SELECT COALESCE(MAX(version), 0) + 1 AS v FROM proposals WHERE bid_id = ?")
      .bind(id)
      .first<{ v: number }>();
    const pid = crypto.randomUUID();
    await c.env.DB.prepare("INSERT INTO proposals (id, bid_id, version, content_md) VALUES (?,?,?,?)")
      .bind(pid, id, v?.v ?? 1, md)
      .run();
    await log(c.env, id, "제안서 초안 생성", `v${v?.v ?? 1}`);
    return { id: pid, version: v?.v ?? 1 };
  });
});

app.put("/proposals/:pid", async (c) => {
  const { content_md } = await c.req.json<{ content_md: string }>();
  const p = await c.env.DB.prepare("SELECT bid_id, version FROM proposals WHERE id = ?")
    .bind(c.req.param("pid"))
    .first<{ bid_id: string; version: number }>();
  if (!p) return c.json({ error: "제안서를 찾을 수 없습니다." }, 404);
  await c.env.DB.prepare("UPDATE proposals SET content_md = ? WHERE id = ?").bind(content_md, c.req.param("pid")).run();
  await log(c.env, p.bid_id, "제안서 수정", `v${p.version}`);
  return c.json({ ok: true });
});

/* ───────────── 회사 정보 ───────────── */

app.get("/company", async (c) => {
  const profile = await c.env.DB.prepare("SELECT data, updated_at FROM company_profile WHERE id = 1").first<{ data: string; updated_at: string }>();
  const docs = await c.env.DB.prepare(
    "SELECT id, category, title, filename, mime, size, has_text, valid_until, memo, uploaded_at FROM company_docs ORDER BY category, uploaded_at",
  ).all();
  return c.json({ profile: JSON.parse(profile?.data ?? "{}"), updated_at: profile?.updated_at, docs: docs.results });
});

app.put("/company/profile", async (c) => {
  const data = await c.req.json();
  await c.env.DB.prepare("UPDATE company_profile SET data = ?, updated_at = datetime('now') WHERE id = 1")
    .bind(JSON.stringify(data))
    .run();
  await log(c.env, null, "회사 프로필 수정");
  return c.json({ ok: true });
});

app.post("/company/docs", async (c) => {
  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return c.json({ error: "파일이 없습니다." }, 400);
  const id = crypto.randomUUID();
  const key = `company/${id}/${safeName(file.name)}`;
  await storage(c.env).put(key, await file.arrayBuffer(), file.type || "application/octet-stream");
  const hasText = await storeText(c.env, id, form.get("text") as string | null);
  const category = String(form.get("category") ?? "other");
  const title = String(form.get("title") || file.name);
  await c.env.DB.prepare(
    "INSERT INTO company_docs (id, category, title, filename, mime, size, r2_key, has_text, valid_until, memo) VALUES (?,?,?,?,?,?,?,?,?,?)",
  )
    .bind(id, category, title, file.name, file.type || null, file.size, key, hasText ? 1 : 0, (form.get("valid_until") as string) || null, (form.get("memo") as string) || null)
    .run();
  await log(c.env, null, "회사 서류 등록", title);
  return c.json({ id });
});

app.patch("/company/docs/:id", async (c) => {
  const b = await c.req.json<{ category?: string; title?: string; valid_until?: string | null; memo?: string | null }>();
  await c.env.DB.prepare(
    "UPDATE company_docs SET category = COALESCE(?, category), title = COALESCE(?, title), valid_until = ?, memo = ? WHERE id = ?",
  )
    .bind(b.category ?? null, b.title ?? null, b.valid_until ?? null, b.memo ?? null, c.req.param("id"))
    .run();
  return c.json({ ok: true });
});

app.put("/company/docs/:id/text", async (c) => {
  const id = c.req.param("id");
  const ok = await storeText(c.env, id, await c.req.text());
  await c.env.DB.prepare("UPDATE company_docs SET has_text = ? WHERE id = ?").bind(ok ? 1 : 0, id).run();
  return c.json({ ok });
});

app.get("/company/docs/:id/file", async (c) => {
  const f = await c.env.DB.prepare("SELECT filename, mime, r2_key FROM company_docs WHERE id = ?")
    .bind(c.req.param("id"))
    .first<{ filename: string; mime: string | null; r2_key: string }>();
  return serveR2(c, f);
});

app.delete("/company/docs/:id", async (c) => {
  const id = c.req.param("id");
  const d = await c.env.DB.prepare("SELECT title, r2_key FROM company_docs WHERE id = ?").bind(id).first<{ title: string; r2_key: string }>();
  if (d) {
    await storage(c.env).delete([d.r2_key, `text/${id}.txt`]);
    await c.env.DB.prepare("DELETE FROM company_docs WHERE id = ?").bind(id).run();
    await log(c.env, null, "회사 서류 삭제", d.title);
  }
  return c.json({ ok: true });
});

app.post("/company/extract", (c) => streamJob(c, (emit) => extractProfile(c.env, emit)));

/* ───────────── 히스토리 ───────────── */

app.get("/history", async (c) => {
  const limit = Math.min(Number(c.req.query("limit")) || 200, 1000);
  const rows = await c.env.DB.prepare(
    "SELECT h.*, b.title AS bid_title FROM history h LEFT JOIN bids b ON b.id = h.bid_id ORDER BY h.id DESC LIMIT ?",
  )
    .bind(limit)
    .all();
  return c.json(rows.results);
});

app.all("*", (c) => c.json({ error: "Not found" }, 404));

export default app;
