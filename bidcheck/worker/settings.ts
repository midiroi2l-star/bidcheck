import type { Env } from "./claude";

/**
 * 키·비밀번호 해석 순서: Cloudflare 비밀값(wrangler secret) → 웹 설정 화면에서 저장한 값(D1).
 * 비밀번호는 D1 에 SHA-256 해시로만 저장한다.
 */
export const SETTING_KEYS = ["anthropic_api_key", "g2b_service_key", "app_password_hash"] as const;
type SettingKey = (typeof SETTING_KEYS)[number];

export async function loadSettings(db: D1Database): Promise<Partial<Record<SettingKey, string>>> {
  const rows = await db.prepare("SELECT key, value FROM app_settings").all<{ key: SettingKey; value: string }>();
  return Object.fromEntries(rows.results.map((r) => [r.key, r.value]));
}

export async function saveSetting(db: D1Database, key: SettingKey, value: string) {
  await db
    .prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')")
    .bind(key, value)
    .run();
}

export async function hashPassword(pw: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`bidcheck:${pw}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 요청마다 쓸 실제 설정값을 합친 env (비밀값이 있으면 그것을 우선) */
export async function resolveEnv(env: Env): Promise<Env & { PASSWORD_HASH?: string }> {
  const s = await loadSettings(env.DB);
  return {
    ...env,
    ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY || s.anthropic_api_key,
    G2B_SERVICE_KEY: env.G2B_SERVICE_KEY || s.g2b_service_key,
    PASSWORD_HASH: env.APP_PASSWORD ? await hashPassword(env.APP_PASSWORD) : s.app_password_hash,
  };
}
