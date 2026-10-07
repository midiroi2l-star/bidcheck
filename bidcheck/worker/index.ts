import { Hono } from "hono";
import { adminRoutes, authMiddleware, authRoutes, countUsers } from "./auth";
import { bidRoutes } from "./bids";
import type { Env } from "./claude";
import { companyRoutes } from "./company";
import type { AppEnv } from "./core";
import { G2BError } from "./g2b";
import { noticeRoutes, runSavedSearches } from "./notices";
import { resolveEnv } from "./settings";

const app = new Hono<AppEnv>().basePath("/api");

app.onError((err, c) => {
  console.error(err);
  const status = err instanceof G2BError ? 502 : 500;
  return c.json({ error: err.message || "서버 오류" }, status);
});

// 요청마다 웹 [설정]에서 저장한 키를 합치고, 로그인 확인
app.use("*", async (c, next) => {
  c.env = await resolveEnv(c.env);
  await next();
});
app.use("*", authMiddleware);

app.get("/health", async (c) =>
  c.json({
    needsSetup: (await countUsers(c.env)) === 0,
    g2b: Boolean(c.env.G2B_SERVICE_KEY),
    claude: Boolean(c.env.ANTHROPIC_API_KEY),
    mail: Boolean(c.env.RESEND_API_KEY),
    storage: c.env.FILES ? "r2" : "d1",
    model: c.env.CLAUDE_MODEL,
  }),
);

app.route("/", authRoutes);
app.route("/", adminRoutes);
app.route("/", noticeRoutes);
app.route("/", bidRoutes);
app.route("/", companyRoutes);

app.all("*", (c) => c.json({ error: "Not found" }, 404));

export default {
  fetch: app.fetch,
  // 매일 아침(한국시간 07:30) 저장 검색을 실행해 추천 공고를 쌓는다
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(resolveEnv(env).then((e) => runSavedSearches(e)));
  },
} satisfies ExportedHandler<Env>;
