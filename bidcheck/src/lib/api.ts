import type { StreamEvent } from "../../shared/types";

const PW_KEY = "bidcheck.password";

export function getPassword() {
  try {
    return localStorage.getItem(PW_KEY) ?? "";
  } catch {
    return "";
  }
}
export function setPassword(pw: string) {
  try {
    localStorage.setItem(PW_KEY, pw);
  } catch {
    /* 저장 불가 환경 */
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function headers(extra?: HeadersInit): Headers {
  const h = new Headers(extra);
  const pw = getPassword();
  if (pw) h.set("Authorization", `Bearer ${pw}`);
  return h;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `요청 실패 (HTTP ${res.status})`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* 본문 없음 */
    }
    if (res.status === 401) window.dispatchEvent(new Event("bidcheck:unauthorized"));
    throw new ApiError(msg, res.status);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => fetch(`/api${path}`, { headers: headers() }).then((r) => handle<T>(r)),
  send: <T>(method: string, path: string, body?: unknown) =>
    fetch(`/api${path}`, {
      method,
      headers: headers({ "Content-Type": "application/json" }),
      body: body === undefined ? undefined : JSON.stringify(body),
    }).then((r) => handle<T>(r)),
  putText: <T>(path: string, text: string) =>
    fetch(`/api${path}`, {
      method: "PUT",
      headers: headers({ "Content-Type": "text/plain; charset=utf-8" }),
      body: text,
    }).then((r) => handle<T>(r)),
  upload: <T>(path: string, form: FormData) =>
    fetch(`/api${path}`, { method: "POST", headers: headers(), body: form }).then((r) => handle<T>(r)),
  /** 인증 헤더가 필요한 파일 다운로드 */
  async download(path: string, filename: string) {
    const res = await fetch(`/api${path}`, { headers: headers() });
    if (!res.ok) throw new ApiError(`다운로드 실패 (HTTP ${res.status})`, res.status);
    saveBlob(await res.blob(), filename);
  },
  async blob(path: string) {
    const res = await fetch(`/api${path}`, { headers: headers() });
    if (!res.ok) throw new ApiError(`파일을 가져오지 못했습니다 (HTTP ${res.status})`, res.status);
    return res.blob();
  },
  /** NDJSON 스트리밍 작업 (AI 분석·제안서). done 데이터 반환, error 시 throw */
  async stream<T>(path: string, body: unknown, onEvent: (e: StreamEvent) => void): Promise<T> {
    const res = await fetch(`/api${path}`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok || !res.body) return handle<T>(res);
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "";
    let result: T | undefined;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        const ev = JSON.parse(line) as StreamEvent;
        if (ev.type === "error") throw new ApiError(ev.message, 500);
        if (ev.type === "done") result = ev.data as T;
        else onEvent(ev);
      }
    }
    if (result === undefined) throw new ApiError("작업이 중간에 끊겼습니다. 다시 시도하세요.", 500);
    return result;
  },
};

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
