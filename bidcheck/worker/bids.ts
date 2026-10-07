import {
  BID_STATUSES,
  FILE_KINDS,
  STATUS_LABEL,
  type AnalysisResult,
  type BidStatus,
  type G2BNotice,
} from "../shared/types";
import { analyzeBid, draftProposal, type Env } from "./claude";
import { fileResponse, getBid, log, router, safeName, streamJob, type Ctx } from "./core";
import { downloadAttachment, noticeExtras } from "./g2b";
import { storage } from "./storage";

export const bidRoutes = router();

/* ───────────── 관심 입찰 ───────────── */

bidRoutes.get("/bids", async (c) => {
  const status = c.req.query("status");
  const sql = `SELECT b.*, u.name AS assignee_name,
      (SELECT COUNT(*) FROM analyses a WHERE a.bid_id = b.id) AS analysis_count,
      (SELECT COUNT(*) FROM proposals p WHERE p.bid_id = b.id) AS proposal_count
    FROM bids b LEFT JOIN users u ON u.id = b.assignee
    ${status ? "WHERE b.status = ?" : ""} ORDER BY b.updated_at DESC`;
  const stmt = status ? c.env.DB.prepare(sql).bind(status) : c.env.DB.prepare(sql);
  return c.json((await stmt.all()).results);
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
    raw_json: JSON.stringify({ ...n.raw, _attachments: n.attachments, _extra: n.extra ?? null }),
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

bidRoutes.post("/bids", async (c) => {
  const body = await c.req.json<{ noticeId?: string; notice?: G2BNotice } & Partial<ManualBid>>();
  let notice = body.notice;
  if (body.noticeId) {
    const row = await c.env.DB.prepare("SELECT data FROM notices WHERE id = ?").bind(body.noticeId).first<{ data: string }>();
    if (!row) return c.json({ error: "공고 정보를 찾을 수 없습니다. 다시 검색해 주세요." }, 404);
    notice = JSON.parse(row.data) as G2BNotice;
    // 면허·지역 제한을 아직 조회하지 않았으면 등록하면서 가져온다 (분석 정확도에 필요)
    if (!notice.extra && c.env.G2B_SERVICE_KEY) {
      notice.extra = await noticeExtras(c.env.G2B_API_BASE, c.env.G2B_SERVICE_KEY, notice.bidNo);
      await c.env.DB.prepare("UPDATE notices SET data = ? WHERE id = ?").bind(JSON.stringify(notice), body.noticeId).run();
    }
  }
  const row = notice ? noticeToRow(notice) : (body as ManualBid);
  if (!row.bid_no || !row.title) return c.json({ error: "공고번호와 공고명은 필수입니다." }, 400);
  const { id, created } = await upsertBid(c.env, row);
  if (created) await c.env.DB.prepare("UPDATE bids SET assignee = ? WHERE id = ? AND assignee IS NULL").bind(c.get("user").id, id).run();
  await log(c.env, id, created ? "관심 등록" : "공고 정보 갱신", row.title, c.get("user").id);
  return c.json(await getBid(c.env, id));
});

bidRoutes.get("/bids/:id", async (c) => {
  const id = c.req.param("id");
  const bid = await getBid(c.env, id);
  if (!bid) return c.json({ error: "입찰을 찾을 수 없습니다." }, 404);
  const db = c.env.DB;
  const [files, analyses, proposals, history, comments, notice] = await Promise.all([
    db
      .prepare("SELECT id, bid_id, kind, filename, mime, size, source_url, has_text, uploaded_at FROM bid_files WHERE bid_id = ? ORDER BY uploaded_at")
      .bind(id)
      .all(),
    db.prepare("SELECT * FROM analyses WHERE bid_id = ? ORDER BY created_at DESC").bind(id).all<{ id: string; result_json: string }>(),
    db.prepare("SELECT * FROM proposals WHERE bid_id = ? ORDER BY version DESC").bind(id).all(),
    db.prepare("SELECT h.*, u.name AS user_name FROM history h LEFT JOIN users u ON u.id = h.user_id WHERE h.bid_id = ? ORDER BY h.id DESC").bind(id).all(),
    db.prepare("SELECT c.*, u.name AS user_name FROM bid_comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.bid_id = ? ORDER BY c.id").bind(id).all(),
    db.prepare("SELECT data FROM notices WHERE id = ?").bind(id).first<{ data: string }>(),
  ]);
  const n = notice ? (JSON.parse(notice.data) as G2BNotice) : null;
  return c.json({
    bid,
    notice: n ? { ...n, raw: undefined } : null,
    files: files.results,
    analyses: analyses.results.map(({ result_json, ...a }) => ({ ...a, result: JSON.parse(result_json) })),
    proposals: proposals.results,
    history: history.results,
    comments: comments.results,
  });
});

bidRoutes.patch("/bids/:id", async (c) => {
  const id = c.req.param("id");
  const bid = await getBid(c.env, id);
  if (!bid) return c.json({ error: "입찰을 찾을 수 없습니다." }, 404);
  const body = await c.req.json<{ status?: BidStatus; memo?: string; close_dt?: string; assignee?: string | null; checklist?: Record<string, boolean> }>();
  if (body.status && body.status !== bid.status) {
    if (!(BID_STATUSES as readonly string[]).includes(body.status)) return c.json({ error: "잘못된 상태" }, 400);
    await c.env.DB.prepare("UPDATE bids SET status = ?, updated_at = datetime('now') WHERE id = ?").bind(body.status, id).run();
    await log(c.env, id, "상태 변경", `${STATUS_LABEL[bid.status]} → ${STATUS_LABEL[body.status]}`, c.get("user").id);
  }
  if (body.memo !== undefined && body.memo !== bid.memo) {
    await c.env.DB.prepare("UPDATE bids SET memo = ?, updated_at = datetime('now') WHERE id = ?").bind(body.memo, id).run();
    await log(c.env, id, "메모 수정", null, c.get("user").id);
  }
  if (body.assignee !== undefined && body.assignee !== bid.assignee) {
    await c.env.DB.prepare("UPDATE bids SET assignee = ?, updated_at = datetime('now') WHERE id = ?").bind(body.assignee || null, id).run();
    const u = body.assignee ? await c.env.DB.prepare("SELECT name FROM users WHERE id = ?").bind(body.assignee).first<{ name: string }>() : null;
    await log(c.env, id, "담당자 지정", u?.name ?? "없음", c.get("user").id);
  }
  if (body.checklist !== undefined) {
    await c.env.DB.prepare("UPDATE bids SET checklist = ? WHERE id = ?").bind(JSON.stringify(body.checklist), id).run();
  }
  if (body.close_dt !== undefined) {
    await c.env.DB.prepare("UPDATE bids SET close_dt = ?, updated_at = datetime('now') WHERE id = ?").bind(body.close_dt || null, id).run();
  }
  return c.json(await getBid(c.env, id));
});

bidRoutes.delete("/bids/:id", async (c) => {
  const id = c.req.param("id");
  const bid = await getBid(c.env, id);
  if (!bid) return c.json({ ok: true });
  const files = await c.env.DB.prepare("SELECT id, r2_key FROM bid_files WHERE bid_id = ?").bind(id).all<{ id: string; r2_key: string }>();
  await storage(c.env).delete(files.results.flatMap((f) => [f.r2_key, `text/${f.id}.txt`]));
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM bid_files WHERE bid_id = ?").bind(id),
    c.env.DB.prepare("DELETE FROM analyses WHERE bid_id = ?").bind(id),
    c.env.DB.prepare("DELETE FROM proposals WHERE bid_id = ?").bind(id),
    c.env.DB.prepare("DELETE FROM bid_comments WHERE bid_id = ?").bind(id),
    c.env.DB.prepare("DELETE FROM bids WHERE id = ?").bind(id),
  ]);
  await log(c.env, null, "관심 입찰 삭제", `${bid.title} (${id})`, c.get("user").id);
  return c.json({ ok: true });
});

/* ───────────── 입찰 첨부파일 ───────────── */

export async function storeText(env: Env, id: string, text: string | null | undefined) {
  if (!text?.trim()) return false;
  await storage(env).put(`text/${id}.txt`, text, "text/plain; charset=utf-8");
  return true;
}

bidRoutes.post("/bids/:id/files", async (c) => {
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
  await log(c.env, bidId, "첨부 등록", `${FILE_KINDS[kind as keyof typeof FILE_KINDS] ?? "기타"}: ${file.name}`, c.get("user").id);
  return c.json({ id: fileId });
});

/** 나라장터 공고의 첨부파일 URL 에서 직접 내려받기 */
bidRoutes.post("/bids/:id/fetch-attachments", async (c) => {
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
  if (okCount) await log(c.env, bidId, "나라장터 첨부 내려받기", `${okCount}건`, c.get("user").id);
  return c.json({ total: atts.length, results });
});

bidRoutes.get("/bid-files/:fid", async (c) => {
  const f = await c.env.DB.prepare("SELECT filename, mime, r2_key FROM bid_files WHERE id = ?")
    .bind(c.req.param("fid"))
    .first<{ filename: string; mime: string | null; r2_key: string }>();
  return serveStored(c, f);
});

bidRoutes.put("/bid-files/:fid/text", async (c) => {
  const fid = c.req.param("fid");
  const ok = await storeText(c.env, fid, await c.req.text());
  await c.env.DB.prepare("UPDATE bid_files SET has_text = ? WHERE id = ?").bind(ok ? 1 : 0, fid).run();
  return c.json({ ok });
});

bidRoutes.patch("/bid-files/:fid", async (c) => {
  const { kind } = await c.req.json<{ kind: string }>();
  if (!(kind in FILE_KINDS)) return c.json({ error: "잘못된 분류" }, 400);
  await c.env.DB.prepare("UPDATE bid_files SET kind = ? WHERE id = ?").bind(kind, c.req.param("fid")).run();
  return c.json({ ok: true });
});

bidRoutes.delete("/bid-files/:fid", async (c) => {
  const fid = c.req.param("fid");
  const f = await c.env.DB.prepare("SELECT bid_id, filename, r2_key FROM bid_files WHERE id = ?")
    .bind(fid)
    .first<{ bid_id: string; filename: string; r2_key: string }>();
  if (f) {
    await storage(c.env).delete([f.r2_key, `text/${fid}.txt`]);
    await c.env.DB.prepare("DELETE FROM bid_files WHERE id = ?").bind(fid).run();
    await log(c.env, f.bid_id, "첨부 삭제", f.filename, c.get("user").id);
  }
  return c.json({ ok: true });
});

export async function serveStored(c: Ctx, f: { filename: string; mime: string | null; r2_key: string } | null) {
  if (!f) return c.json({ error: "파일 없음" }, 404);
  const obj = await storage(c.env).get(f.r2_key);
  if (!obj) return c.json({ error: "파일 없음" }, 404);
  return fileResponse(obj.stream(), f.filename, f.mime);
}

/* ───────────── AI 분석 / 제안서 ───────────── */

bidRoutes.post("/bids/:id/analyze", async (c) => {
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
    await log(c.env, id, "AI 분석", `적합도 ${score}점 (${result.fit.grade}) · ${result.recommendation}`, c.get("user").id);
    return { id: aid };
  });
});

bidRoutes.post("/bids/:id/proposal", async (c) => {
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
    await log(c.env, id, "제안서 초안 생성", `v${v?.v ?? 1}`, c.get("user").id);
    return { id: pid, version: v?.v ?? 1 };
  });
});

bidRoutes.put("/proposals/:pid", async (c) => {
  const { content_md } = await c.req.json<{ content_md: string }>();
  const p = await c.env.DB.prepare("SELECT bid_id, version FROM proposals WHERE id = ?")
    .bind(c.req.param("pid"))
    .first<{ bid_id: string; version: number }>();
  if (!p) return c.json({ error: "제안서를 찾을 수 없습니다." }, 404);
  await c.env.DB.prepare("UPDATE proposals SET content_md = ? WHERE id = ?").bind(content_md, c.req.param("pid")).run();
  await log(c.env, p.bid_id, "제안서 수정", `v${p.version}`, c.get("user").id);
  return c.json({ ok: true });
});


/* ───────────── 팀 코멘트 ───────────── */

bidRoutes.post("/bids/:id/comments", async (c) => {
  const id = c.req.param("id");
  const { body } = await c.req.json<{ body: string }>();
  if (!body?.trim()) return c.json({ error: "내용을 입력하세요." }, 400);
  await c.env.DB.prepare("INSERT INTO bid_comments (bid_id, user_id, body) VALUES (?, ?, ?)").bind(id, c.get("user").id, body.trim()).run();
  await c.env.DB.prepare("UPDATE bids SET updated_at = datetime('now') WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

bidRoutes.delete("/comments/:cid", async (c) => {
  const user = c.get("user");
  await c.env.DB.prepare("DELETE FROM bid_comments WHERE id = ? AND (user_id = ? OR ? = 'admin')").bind(Number(c.req.param("cid")), user.id, user.role).run();
  return c.json({ ok: true });
});
