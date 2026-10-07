import { extractProfile } from "./claude";
import { adminOnly } from "./auth";
import { log, router, safeName, streamJob } from "./core";
import { sendMail } from "./mail";
import { loadSettings, saveSetting, type SettingKey } from "./settings";
import { storeText, serveStored } from "./bids";
import { storage } from "./storage";

export const companyRoutes = router();

/* ───────────── 회사 정보 ───────────── */

companyRoutes.get("/company", async (c) => {
  const profile = await c.env.DB.prepare("SELECT data, updated_at FROM company_profile WHERE id = 1").first<{ data: string; updated_at: string }>();
  const docs = await c.env.DB.prepare(
    "SELECT id, category, title, filename, mime, size, has_text, valid_until, memo, uploaded_at FROM company_docs ORDER BY category, uploaded_at",
  ).all();
  return c.json({ profile: JSON.parse(profile?.data ?? "{}"), updated_at: profile?.updated_at, docs: docs.results });
});

companyRoutes.put("/company/profile", async (c) => {
  const data = await c.req.json();
  await c.env.DB.prepare("UPDATE company_profile SET data = ?, updated_at = datetime('now') WHERE id = 1")
    .bind(JSON.stringify(data))
    .run();
  await log(c.env, null, "회사 프로필 수정", null, c.get("user").id);
  return c.json({ ok: true });
});

companyRoutes.post("/company/docs", async (c) => {
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
  await log(c.env, null, "회사 서류 등록", title, c.get("user").id);
  return c.json({ id });
});

companyRoutes.patch("/company/docs/:id", async (c) => {
  const b = await c.req.json<{ category?: string; title?: string; valid_until?: string | null; memo?: string | null }>();
  await c.env.DB.prepare(
    "UPDATE company_docs SET category = COALESCE(?, category), title = COALESCE(?, title), valid_until = ?, memo = ? WHERE id = ?",
  )
    .bind(b.category ?? null, b.title ?? null, b.valid_until ?? null, b.memo ?? null, c.req.param("id"))
    .run();
  return c.json({ ok: true });
});

companyRoutes.put("/company/docs/:id/text", async (c) => {
  const id = c.req.param("id");
  const ok = await storeText(c.env, id, await c.req.text());
  await c.env.DB.prepare("UPDATE company_docs SET has_text = ? WHERE id = ?").bind(ok ? 1 : 0, id).run();
  return c.json({ ok });
});

companyRoutes.get("/company/docs/:id/file", async (c) => {
  const f = await c.env.DB.prepare("SELECT filename, mime, r2_key FROM company_docs WHERE id = ?")
    .bind(c.req.param("id"))
    .first<{ filename: string; mime: string | null; r2_key: string }>();
  return serveStored(c, f);
});

companyRoutes.delete("/company/docs/:id", async (c) => {
  const id = c.req.param("id");
  const d = await c.env.DB.prepare("SELECT title, r2_key FROM company_docs WHERE id = ?").bind(id).first<{ title: string; r2_key: string }>();
  if (d) {
    await storage(c.env).delete([d.r2_key, `text/${id}.txt`]);
    await c.env.DB.prepare("DELETE FROM company_docs WHERE id = ?").bind(id).run();
    await log(c.env, null, "회사 서류 삭제", d.title, c.get("user").id);
  }
  return c.json({ ok: true });
});

companyRoutes.post("/company/extract", (c) => streamJob(c, (emit) => extractProfile(c.env, emit)));

/* ───────────── 히스토리 ───────────── */

companyRoutes.get("/history", async (c) => {
  const limit = Math.min(Number(c.req.query("limit")) || 200, 1000);
  const rows = await c.env.DB.prepare(
    "SELECT h.*, b.title AS bid_title, u.name AS user_name FROM history h LEFT JOIN bids b ON b.id = h.bid_id LEFT JOIN users u ON u.id = h.user_id ORDER BY h.id DESC LIMIT ?",
  )
    .bind(limit)
    .all();
  return c.json(rows.results);
});

/* ───────────── 대시보드 · 일정 ───────────── */

companyRoutes.get("/dashboard", async (c) => {
  const db = c.env.DB;
  const [counts, active, recent] = await Promise.all([
    db.prepare("SELECT status, COUNT(*) AS n FROM bids GROUP BY status").all<{ status: string; n: number }>(),
    db
      .prepare(
        "SELECT b.*, u.name AS assignee_name FROM bids b LEFT JOIN users u ON u.id = b.assignee WHERE b.status IN ('interest','analyzed','in_progress') ORDER BY b.updated_at DESC LIMIT 300",
      )
      .all(),
    db
      .prepare(
        "SELECT h.*, b.title AS bid_title, u.name AS user_name FROM history h LEFT JOIN bids b ON b.id = h.bid_id LEFT JOIN users u ON u.id = h.user_id ORDER BY h.id DESC LIMIT 15",
      )
      .all(),
  ]);
  return c.json({ counts: counts.results, active: active.results, recent: recent.results });
});

/** 일정 캘린더: 마감·개찰 일자가 있는 입찰 */
companyRoutes.get("/calendar", async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT id, title, status, close_dt, open_dt, fit_score, demand_org, org FROM bids WHERE close_dt IS NOT NULL OR open_dt IS NOT NULL",
  ).all();
  return c.json(rows.results);
});

/* ───────────── 설정 (관리자) ───────────── */

companyRoutes.get("/settings", adminOnly, async (c) => {
  const s = await loadSettings(c.env.DB);
  return c.json({
    g2b: Boolean(c.env.G2B_SERVICE_KEY),
    claude: Boolean(c.env.ANTHROPIC_API_KEY),
    mail: Boolean(c.env.RESEND_API_KEY),
    mailFrom: c.env.MAIL_FROM ?? s.mail_from ?? "",
    model: c.env.CLAUDE_MODEL,
  });
});

companyRoutes.put("/settings", adminOnly, async (c) => {
  const b = await c.req.json<{ anthropicKey?: string; g2bKey?: string; resendKey?: string; mailFrom?: string }>();
  const changed: string[] = [];
  const updates: [SettingKey, string | undefined, string][] = [
    ["anthropic_api_key", b.anthropicKey?.trim(), "Claude 키"],
    ["g2b_service_key", b.g2bKey?.trim(), "나라장터 키"],
    ["resend_api_key", b.resendKey?.trim(), "메일 키"],
    ["mail_from", b.mailFrom?.trim(), "보내는 주소"],
  ];
  for (const [key, value, label] of updates) {
    if (!value) continue;
    await saveSetting(c.env.DB, key, value);
    changed.push(label);
  }
  if (changed.length) await log(c.env, null, "설정 변경", changed.join(", "), c.get("user").id);
  return c.json({ ok: true });
});

companyRoutes.post("/settings/test-mail", adminOnly, async (c) => {
  const user = c.get("user");
  const r = await sendMail(c.env, { to: user.email, subject: "[BidCheck] 메일 발송 테스트", text: "BidCheck 메일 발송 설정이 정상입니다." });
  return r.ok ? c.json({ ok: true }) : c.json({ error: r.error }, 400);
});

/** 담당자 지정용 사용자 목록 (일반 사용자도 조회) */
companyRoutes.get("/users", async (c) => {
  const rows = await c.env.DB.prepare("SELECT id, name FROM users WHERE active = 1 ORDER BY name").all();
  return c.json(rows.results);
});
