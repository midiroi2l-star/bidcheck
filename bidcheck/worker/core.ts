import { Hono, type Context } from "hono";
import type { Env } from "./claude";
import type { Bid, StreamEvent, User } from "../shared/types";

export type AppEnv = { Bindings: Env; Variables: { user: User } };
export type Ctx = Context<AppEnv>;

export const router = () => new Hono<AppEnv>();

export async function log(env: Env, bidId: string | null, action: string, detail?: string | null, userId?: string | null) {
  await env.DB.prepare("INSERT INTO history (bid_id, action, detail, user_id) VALUES (?, ?, ?, ?)")
    .bind(bidId, action, detail ?? null, userId ?? null)
    .run();
}

export async function getBid(env: Env, id: string) {
  return env.DB.prepare("SELECT * FROM bids WHERE id = ?").bind(id).first<Bid>();
}

/** 오래 걸리는 Claude 작업을 NDJSON 스트림으로 내보낸다 (연결 유지 + 진행 상황 표시) */
export function streamJob(c: Ctx, job: (emit: (e: StreamEvent) => void) => Promise<unknown>) {
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
export const safeName = (n: string) => n.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 180);

export function fileResponse(body: ReadableStream | ArrayBuffer, filename: string, mime?: string | null) {
  return new Response(body, {
    headers: {
      "Content-Type": mime || "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
