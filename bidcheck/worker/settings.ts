import type { Env } from "./claude";

/**
 * 키 해석 순서: Cloudflare 비밀값(wrangler secret) → 웹 [설정] 화면에서 저장한 값(D1).
 */
export const SETTING_KEYS = ["anthropic_api_key", "g2b_service_key", "resend_api_key", "mail_from"] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

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

/** 요청마다 쓸 실제 설정값을 합친 env */
export async function resolveEnv(env: Env): Promise<Env> {
  const s = await loadSettings(env.DB);
  return {
    ...env,
    ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY || s.anthropic_api_key,
    G2B_SERVICE_KEY: env.G2B_SERVICE_KEY || s.g2b_service_key,
    RESEND_API_KEY: env.RESEND_API_KEY || s.resend_api_key,
    MAIL_FROM: env.MAIL_FROM || s.mail_from,
  };
}
