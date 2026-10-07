import type { Env } from "./claude";

/**
 * 메일 발송 (Resend API). 설정 화면에서 Resend API 키와 보내는 주소를 등록하면 동작한다.
 * Resend 무료 플랜: 하루 100통. 자체 도메인을 인증하지 않으면 Resend 가입 이메일로만 보낼 수 있다.
 */
export async function sendMail(env: Env, m: { to: string; subject: string; text: string }): Promise<{ ok: boolean; error?: string }> {
  if (!env.RESEND_API_KEY) return { ok: false, error: "메일 발송 설정(Resend 키)이 없습니다" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.MAIL_FROM || "BidCheck <onboarding@resend.dev>",
        to: [m.to],
        subject: m.subject,
        text: m.text,
      }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      return { ok: false, error: j.message ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
