import type { MiddlewareHandler } from "hono";
import type { User } from "../shared/types";
import type { Env } from "./claude";
import { log, router, type AppEnv } from "./core";
import { sendMail } from "./mail";

/* ───────────── 비밀번호 해시 (PBKDF2-SHA256) ───────────── */

// Workers 무료 플랜 CPU 한도(요청당 10ms)를 고려한 반복 횟수
const ITER = 20000;
const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

export async function hashPw(pw: string, saltHex?: string) {
  const salt = saltHex ?? hex(crypto.getRandomValues(new Uint8Array(16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: ITER },
    key,
    256,
  );
  return { hash: hex(bits), salt };
}

function tempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const r = crypto.getRandomValues(new Uint8Array(10));
  return [...r].map((x) => chars[x % chars.length]).join("");
}

const validPw = (pw: string) => pw.length >= 8;
const PW_RULE = "비밀번호는 8자 이상이어야 합니다.";

type UserRow = User & { pw_hash: string; pw_salt: string; active: number };

const publicUser = (u: UserRow): User => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  must_change: u.must_change,
  active: u.active,
  last_login_at: u.last_login_at,
  created_at: u.created_at,
});

async function countUsers(env: Env) {
  return (await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>())?.n ?? 0;
}

async function createSession(env: Env, userId: string) {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))")
    .bind(token, userId)
    .run();
  await env.DB.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(userId).run();
  return token;
}

/* ───────────── 미들웨어 ───────────── */

const PUBLIC = new Set(["/api/health", "/api/auth/login", "/api/auth/forgot", "/api/auth/setup"]);

export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (PUBLIC.has(c.req.path)) return next();
  const token = c.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return c.json({ error: "로그인이 필요합니다." }, 401);
  const u = await c.env.DB.prepare(
    "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > datetime('now') AND u.active = 1",
  )
    .bind(token)
    .first<UserRow>();
  if (!u) return c.json({ error: "로그인이 필요합니다." }, 401);
  c.set("user", publicUser(u));
  // 임시 비밀번호 사용자는 비밀번호 변경 전까지 다른 기능을 쓸 수 없다
  if (u.must_change && !["/api/auth/me", "/api/auth/password", "/api/auth/logout"].includes(c.req.path)) {
    return c.json({ error: "임시 비밀번호입니다. 새 비밀번호로 변경해 주세요.", mustChange: true }, 403);
  }
  return next();
};

export const adminOnly: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.get("user")?.role !== "admin") return c.json({ error: "관리자만 사용할 수 있습니다." }, 403);
  return next();
};

/* ───────────── 라우트 ───────────── */

export const authRoutes = router();

/** 최초 1회: 관리자 계정 만들기 (사용자가 한 명도 없을 때만) */
authRoutes.post("/auth/setup", async (c) => {
  if ((await countUsers(c.env)) > 0) return c.json({ error: "이미 설정이 완료되었습니다. 로그인해 주세요." }, 400);
  const b = await c.req.json<{ id: string; name: string; email: string; password: string }>();
  const id = b.id?.trim().toLowerCase();
  if (!id || !/^[a-z0-9._-]{3,30}$/.test(id)) return c.json({ error: "아이디는 영문 소문자·숫자 3~30자로 정해 주세요." }, 400);
  if (!b.name?.trim() || !b.email?.includes("@")) return c.json({ error: "이름과 이메일을 정확히 입력해 주세요." }, 400);
  if (!validPw(b.password ?? "")) return c.json({ error: PW_RULE }, 400);
  const { hash, salt } = await hashPw(b.password);
  await c.env.DB.prepare("INSERT INTO users (id, name, email, role, pw_hash, pw_salt) VALUES (?, ?, ?, 'admin', ?, ?)")
    .bind(id, b.name.trim(), b.email.trim(), hash, salt)
    .run();
  await log(c.env, null, "관리자 계정 생성", id, id);
  return c.json({ token: await createSession(c.env, id) });
});

authRoutes.post("/auth/login", async (c) => {
  const b = await c.req.json<{ id: string; password: string }>();
  const id = (b.id ?? "").trim().toLowerCase();
  const u = await c.env.DB.prepare("SELECT * FROM users WHERE id = ? OR lower(email) = ?").bind(id, id).first<UserRow>();
  const ok = u && u.active && (await hashPw(b.password ?? "", u.pw_salt)).hash === u.pw_hash;
  if (!u || !ok) return c.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, 401);
  await c.env.DB.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
  return c.json({ token: await createSession(c.env, u.id), user: publicUser(u) });
});

authRoutes.post("/auth/logout", async (c) => {
  const token = c.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
  if (token) await c.env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  return c.json({ ok: true });
});

authRoutes.get("/auth/me", (c) => c.json(c.get("user")));

authRoutes.post("/auth/password", async (c) => {
  const user = c.get("user");
  const b = await c.req.json<{ current: string; next: string }>();
  const u = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first<UserRow>();
  if (!u || (await hashPw(b.current ?? "", u.pw_salt)).hash !== u.pw_hash) return c.json({ error: "현재 비밀번호가 올바르지 않습니다." }, 400);
  if (!validPw(b.next ?? "")) return c.json({ error: PW_RULE }, 400);
  const { hash, salt } = await hashPw(b.next);
  await c.env.DB.prepare("UPDATE users SET pw_hash = ?, pw_salt = ?, must_change = 0 WHERE id = ?").bind(hash, salt, user.id).run();
  await log(c.env, null, "비밀번호 변경", null, user.id);
  return c.json({ ok: true });
});

/** 비밀번호 찾기: 등록된 이메일로 임시 비밀번호 발송 */
authRoutes.post("/auth/forgot", async (c) => {
  const { idOrEmail } = await c.req.json<{ idOrEmail: string }>();
  const key = (idOrEmail ?? "").trim().toLowerCase();
  const generic = { ok: true, message: "등록된 계정이면 이메일로 임시 비밀번호를 보냈습니다. 메일함(스팸함 포함)을 확인해 주세요." };
  if (!key) return c.json(generic);
  const u = await c.env.DB.prepare("SELECT * FROM users WHERE (id = ? OR lower(email) = ?) AND active = 1").bind(key, key).first<UserRow>();
  if (!u) return c.json(generic);
  const temp = tempPassword();
  const sent = await sendMail(c.env, {
    to: u.email,
    subject: "[BidCheck] 임시 비밀번호 안내",
    text: `${u.name}님, BidCheck 임시 비밀번호는 다음과 같습니다.\n\n임시 비밀번호: ${temp}\n\n로그인 후 바로 새 비밀번호로 변경해 주세요.\n본인이 요청하지 않았다면 관리자에게 알려 주세요.`,
  });
  if (!sent.ok) {
    console.error("mail failed", sent.error);
    return c.json({ error: `메일을 보내지 못했습니다 (${sent.error}). 관리자에게 비밀번호 초기화를 요청해 주세요.` }, 503);
  }
  const { hash, salt } = await hashPw(temp);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE users SET pw_hash = ?, pw_salt = ?, must_change = 1 WHERE id = ?").bind(hash, salt, u.id),
    c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(u.id),
  ]);
  await log(c.env, null, "임시 비밀번호 발송", u.email, u.id);
  return c.json(generic);
});

/* ───────────── 관리자: 사용자 관리 ───────────── */

export const adminRoutes = router();
adminRoutes.use("/admin/*", adminOnly);

adminRoutes.get("/admin/users", async (c) => {
  const rows = await c.env.DB.prepare("SELECT * FROM users ORDER BY created_at").all<UserRow>();
  return c.json(rows.results.map(publicUser));
});

adminRoutes.post("/admin/users", async (c) => {
  const b = await c.req.json<{ id: string; name: string; email: string; role?: string; password?: string; sendEmail?: boolean }>();
  const id = b.id?.trim().toLowerCase();
  if (!id || !/^[a-z0-9._-]{3,30}$/.test(id)) return c.json({ error: "아이디는 영문 소문자·숫자 3~30자로 정해 주세요." }, 400);
  if (!b.name?.trim() || !b.email?.includes("@")) return c.json({ error: "이름과 이메일을 정확히 입력해 주세요." }, 400);
  const exists = await c.env.DB.prepare("SELECT id FROM users WHERE id = ? OR lower(email) = lower(?)").bind(id, b.email.trim()).first();
  if (exists) return c.json({ error: "이미 사용 중인 아이디 또는 이메일입니다." }, 400);
  const pw = b.password?.trim() || tempPassword();
  if (!validPw(pw)) return c.json({ error: PW_RULE }, 400);
  const { hash, salt } = await hashPw(pw);
  await c.env.DB.prepare("INSERT INTO users (id, name, email, role, pw_hash, pw_salt, must_change) VALUES (?, ?, ?, ?, ?, ?, 1)")
    .bind(id, b.name.trim(), b.email.trim(), b.role === "admin" ? "admin" : "user", hash, salt)
    .run();
  let mailed = false;
  if (b.sendEmail) {
    const r = await sendMail(c.env, {
      to: b.email.trim(),
      subject: "[BidCheck] 계정이 등록되었습니다",
      text: `${b.name}님, BidCheck 계정이 등록되었습니다.\n\n아이디: ${id}\n임시 비밀번호: ${pw}\n접속 주소: ${new URL(c.req.url).origin}\n\n첫 로그인 후 비밀번호를 변경해 주세요.`,
    });
    mailed = r.ok;
  }
  await log(c.env, null, "사용자 등록", `${b.name} (${id})`, c.get("user").id);
  return c.json({ ok: true, tempPassword: pw, mailed });
});

adminRoutes.patch("/admin/users/:id", async (c) => {
  const id = c.req.param("id");
  const b = await c.req.json<{ name?: string; email?: string; role?: string; active?: boolean }>();
  if (id === c.get("user").id && (b.role === "user" || b.active === false)) {
    return c.json({ error: "자기 자신의 관리자 권한이나 계정은 해제할 수 없습니다." }, 400);
  }
  await c.env.DB.prepare(
    "UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), role = COALESCE(?, role), active = COALESCE(?, active) WHERE id = ?",
  )
    .bind(b.name ?? null, b.email ?? null, b.role === "admin" || b.role === "user" ? b.role : null, b.active === undefined ? null : b.active ? 1 : 0, id)
    .run();
  if (b.active === false) await c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id).run();
  await log(c.env, null, "사용자 정보 수정", id, c.get("user").id);
  return c.json({ ok: true });
});

/** 관리자가 임시 비밀번호로 초기화 (메일 발송 실패 시 화면에 표시) */
adminRoutes.post("/admin/users/:id/reset", async (c) => {
  const id = c.req.param("id");
  const u = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>();
  if (!u) return c.json({ error: "사용자를 찾을 수 없습니다." }, 404);
  const temp = tempPassword();
  const { hash, salt } = await hashPw(temp);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE users SET pw_hash = ?, pw_salt = ?, must_change = 1 WHERE id = ?").bind(hash, salt, id),
    c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id),
  ]);
  const r = await sendMail(c.env, {
    to: u.email,
    subject: "[BidCheck] 임시 비밀번호 안내",
    text: `${u.name}님, 관리자가 비밀번호를 초기화했습니다.\n\n임시 비밀번호: ${temp}\n\n로그인 후 새 비밀번호로 변경해 주세요.`,
  });
  await log(c.env, null, "비밀번호 초기화", id, c.get("user").id);
  return c.json({ ok: true, tempPassword: temp, mailed: r.ok });
});

adminRoutes.delete("/admin/users/:id", async (c) => {
  const id = c.req.param("id");
  if (id === c.get("user").id) return c.json({ error: "자기 자신은 삭제할 수 없습니다." }, 400);
  await c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
  await c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id).run();
  await log(c.env, null, "사용자 삭제", id, c.get("user").id);
  return c.json({ ok: true });
});

export { countUsers };
