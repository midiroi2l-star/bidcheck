import { BID_CATEGORIES, type BidCategory, type G2BNotice } from "../shared/types";
import type { Env } from "./claude";
import { fileResponse, router } from "./core";
import { downloadAttachment, G2BError, isG2BFileUrl, lookupNotice, noticeExtras, searchNotices } from "./g2b";

export const noticeRoutes = router();

export function requireG2BKey(env: Env) {
  if (!env.G2B_SERVICE_KEY) throw new G2BError("나라장터(공공데이터포털) 키가 설정되지 않았습니다. [설정]에서 입력해 주세요.");
  return env.G2B_SERVICE_KEY;
}

export const asCategory = (v: string | undefined): BidCategory =>
  (BID_CATEGORIES as readonly string[]).includes(v ?? "") ? (v as BidCategory) : "용역";

const kstDate = (offsetDays = 0) => new Date(Date.now() + 9 * 3600_000 + offsetDays * 86400_000).toISOString().slice(0, 10);
export const noticeId = (n: G2BNotice) => `${n.bidNo}-${n.bidOrd}`;

/** 조회한 공고를 캐시에 저장 (웹 내 상세 화면·추천 공고에 사용) */
export async function cacheNotices(env: Env, items: G2BNotice[]) {
  const stmts = items.map((n) =>
    env.DB.prepare(
      `INSERT INTO notices (id, bid_no, category, title, close_dt, data) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET title = excluded.title, close_dt = excluded.close_dt,
         data = json_patch(excluded.data, json_object('extra', json_extract(notices.data, '$.extra'))), fetched_at = datetime('now')`,
    ).bind(noticeId(n), n.bidNo, n.category, n.title, n.closeDt, JSON.stringify(n)),
  );
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
}

async function savedStatusMap(env: Env, bidNos: string[]) {
  const map = new Map<string, { id: string; status: string }>();
  for (let i = 0; i < bidNos.length; i += 90) {
    const chunk = bidNos.slice(i, i + 90);
    if (!chunk.length) continue;
    const rows = await env.DB.prepare(`SELECT id, bid_no, status FROM bids WHERE bid_no IN (${chunk.map(() => "?").join(",")})`)
      .bind(...chunk)
      .all<{ id: string; bid_no: string; status: string }>();
    for (const r of rows.results) map.set(r.bid_no, { id: r.id, status: r.status });
  }
  return map;
}

noticeRoutes.get("/g2b/search", async (c) => {
  const q = c.req.query();
  const res = await searchNotices(c.env.G2B_API_BASE, requireG2BKey(c.env), {
    category: asCategory(q.category),
    keyword: q.keyword?.trim() || undefined,
    org: q.org?.trim() || undefined,
    from: q.from || kstDate(-30),
    to: q.to || kstDate(0),
  });
  await cacheNotices(c.env, res.items);
  const saved = await savedStatusMap(c.env, res.items.map((n) => n.bidNo));
  return c.json({
    totalCount: res.totalCount,
    truncated: res.truncated,
    items: res.items.map(({ raw: _raw, ...n }) => ({ ...n, savedId: saved.get(n.bidNo)?.id ?? null, savedStatus: saved.get(n.bidNo)?.status ?? null })),
  });
});

/** 웹 내 공고 상세: 캐시 → 없으면 나라장터 조회. 면허·지역 제한은 처음 열 때 한 번 가져와 저장 */
noticeRoutes.get("/notices/:id", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT data FROM notices WHERE id = ?").bind(id).first<{ data: string }>();
  let notice: G2BNotice | null = row ? (JSON.parse(row.data) as G2BNotice) : null;
  if (!notice) {
    const bidNo = id.split("-")[0];
    notice = await lookupNotice(c.env.G2B_API_BASE, requireG2BKey(c.env), bidNo, asCategory(c.req.query("category")));
    if (!notice) return c.json({ error: "공고를 찾을 수 없습니다." }, 404);
    await cacheNotices(c.env, [notice]);
  }
  if (!notice.extra && c.env.G2B_SERVICE_KEY) {
    notice.extra = await noticeExtras(c.env.G2B_API_BASE, c.env.G2B_SERVICE_KEY, notice.bidNo);
    await c.env.DB.prepare("UPDATE notices SET data = ? WHERE id = ?").bind(JSON.stringify(notice), noticeId(notice)).run();
  }
  const saved = await savedStatusMap(c.env, [notice.bidNo]);
  return c.json({ ...notice, savedId: saved.get(notice.bidNo)?.id ?? null, savedStatus: saved.get(notice.bidNo)?.status ?? null });
});

/** 나라장터 첨부파일을 서버를 거쳐 내려받기 (나라장터 사이트로 이동하지 않음) */
noticeRoutes.get("/g2b/file", async (c) => {
  const url = c.req.query("url") ?? "";
  const name = c.req.query("name") || "첨부파일";
  if (!isG2BFileUrl(url)) return c.json({ error: "나라장터 첨부파일 주소가 아닙니다." }, 400);
  try {
    const f = await downloadAttachment(url, name);
    return fileResponse(f.buf, f.name, f.type);
  } catch (e) {
    return c.json({ error: `첨부파일을 가져오지 못했습니다: ${e instanceof Error ? e.message : String(e)}` }, 502);
  }
});

/* ───────────── 저장 검색 · 추천 공고 ───────────── */

noticeRoutes.get("/saved-searches", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT s.*, (SELECT COUNT(*) FROM recommendations r WHERE r.search_id = s.id AND r.dismissed = 0
       AND NOT EXISTS (SELECT 1 FROM bids b WHERE b.bid_no = substr(r.notice_id, 1, instr(r.notice_id, '-') - 1))) AS new_count
     FROM saved_searches s ORDER BY s.id`,
  ).all();
  return c.json(rows.results);
});

noticeRoutes.post("/saved-searches", async (c) => {
  const b = await c.req.json<{ name: string; category: string; keyword?: string; org?: string; min_amount?: number | null; max_amount?: number | null }>();
  if (!b.name?.trim()) return c.json({ error: "검색 이름을 입력하세요." }, 400);
  const r = await c.env.DB.prepare(
    "INSERT INTO saved_searches (name, category, keyword, org, min_amount, max_amount, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(b.name.trim(), asCategory(b.category), b.keyword?.trim() || null, b.org?.trim() || null, b.min_amount ?? null, b.max_amount ?? null, c.get("user").id)
    .run();
  return c.json({ id: r.meta.last_row_id });
});

noticeRoutes.delete("/saved-searches/:id", async (c) => {
  const id = Number(c.req.param("id"));
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM recommendations WHERE search_id = ?").bind(id),
    c.env.DB.prepare("DELETE FROM saved_searches WHERE id = ?").bind(id),
  ]);
  return c.json({ ok: true });
});

noticeRoutes.post("/saved-searches/run", async (c) => {
  const found = await runSavedSearches(c.env);
  return c.json({ found });
});

noticeRoutes.get("/recommendations", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT n.data, r.search_id, s.name AS search_name, r.found_at FROM recommendations r
       JOIN notices n ON n.id = r.notice_id JOIN saved_searches s ON s.id = r.search_id
     WHERE r.dismissed = 0 AND NOT EXISTS (SELECT 1 FROM bids b WHERE b.bid_no = n.bid_no)
     ORDER BY r.found_at DESC LIMIT 100`,
  ).all<{ data: string; search_id: number; search_name: string; found_at: string }>();
  return c.json(
    rows.results.map((r) => {
      const { raw: _raw, ...n } = JSON.parse(r.data) as G2BNotice;
      return { ...n, searchId: r.search_id, searchName: r.search_name, foundAt: r.found_at };
    }),
  );
});

noticeRoutes.post("/recommendations/:noticeId/dismiss", async (c) => {
  await c.env.DB.prepare("UPDATE recommendations SET dismissed = 1 WHERE notice_id = ?").bind(c.req.param("noticeId")).run();
  return c.json({ ok: true });
});

/** 저장 검색을 최근 3일 공고로 실행해 추천 공고를 쌓는다 (매일 아침 자동 실행 + 수동 실행) */
export async function runSavedSearches(env: Env) {
  if (!env.G2B_SERVICE_KEY) return 0;
  const searches = await env.DB.prepare("SELECT * FROM saved_searches").all<{
    id: number;
    category: string;
    keyword: string | null;
    org: string | null;
    min_amount: number | null;
    max_amount: number | null;
  }>();
  let found = 0;
  for (const s of searches.results) {
    try {
      const res = await searchNotices(
        env.G2B_API_BASE,
        env.G2B_SERVICE_KEY,
        { category: asCategory(s.category), keyword: s.keyword ?? undefined, org: s.org ?? undefined, from: kstDate(-3), to: kstDate(0) },
        3,
      );
      const items = res.items.filter((n) => {
        const amt = n.estPrice ?? n.budget;
        if (s.min_amount && (amt == null || amt < s.min_amount)) return false;
        if (s.max_amount && amt != null && amt > s.max_amount) return false;
        return true;
      });
      await cacheNotices(env, items);
      const stmts = items.map((n) =>
        env.DB.prepare("INSERT OR IGNORE INTO recommendations (notice_id, search_id) VALUES (?, ?)").bind(noticeId(n), s.id),
      );
      for (let i = 0; i < stmts.length; i += 50) {
        const r = await env.DB.batch(stmts.slice(i, i + 50));
        found += r.reduce((acc, x) => acc + (x.meta.changes ?? 0), 0);
      }
      await env.DB.prepare("UPDATE saved_searches SET last_run_at = datetime('now') WHERE id = ?").bind(s.id).run();
    } catch (e) {
      console.error("saved search failed", s.id, e);
    }
  }
  return found;
}
