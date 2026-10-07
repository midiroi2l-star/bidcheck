/**
 * 파일 저장소. R2(FILES 바인딩)가 있으면 R2 를, 없으면 D1 에 BLOB 조각으로 저장한다.
 * D1 은 값 하나당 최대 2MB 이므로 1.8MB 단위로 나눠 저장한다.
 */
const CHUNK = 1_800_000;

export interface StoredFile {
  size: number;
  bytes(): Promise<Uint8Array>;
  text(): Promise<string>;
  stream(): ReadableStream;
}

export interface Storage {
  put(key: string, data: ArrayBuffer | Uint8Array | string, contentType: string): Promise<void>;
  get(key: string): Promise<StoredFile | null>;
  delete(keys: string[]): Promise<void>;
}

export function storage(env: { DB: D1Database; FILES?: R2Bucket }): Storage {
  return env.FILES ? r2Storage(env.FILES) : d1Storage(env.DB);
}

function r2Storage(bucket: R2Bucket): Storage {
  return {
    async put(key, data, contentType) {
      await bucket.put(key, data, { httpMetadata: { contentType } });
    },
    async get(key) {
      const obj = await bucket.get(key);
      if (!obj) return null;
      let used = false;
      const once = () => {
        if (used) throw new Error("R2 본문은 한 번만 읽을 수 있습니다");
        used = true;
      };
      return {
        size: obj.size,
        bytes: async () => (once(), new Uint8Array(await obj.arrayBuffer())),
        text: async () => (once(), obj.text()),
        stream: () => (once(), obj.body),
      };
    },
    async delete(keys) {
      if (keys.length) await bucket.delete(keys);
    },
  };
}

function d1Storage(db: D1Database): Storage {
  const readAll = async (key: string) => {
    const rows = await db
      .prepare("SELECT data FROM blob_chunks WHERE key = ? ORDER BY part")
      .bind(key)
      .all<{ data: ArrayBuffer | number[] }>();
    const parts = rows.results.map((r) => (r.data instanceof ArrayBuffer ? new Uint8Array(r.data) : Uint8Array.from(r.data)));
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let off = 0;
    for (const p of parts) {
      out.set(p, off);
      off += p.length;
    }
    return out;
  };

  return {
    async put(key, data, contentType) {
      const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data instanceof Uint8Array ? data : new Uint8Array(data);
      const stmts = [
        db.prepare("DELETE FROM blob_chunks WHERE key = ?").bind(key),
        db.prepare("INSERT OR REPLACE INTO blobs (key, size, content_type) VALUES (?, ?, ?)").bind(key, bytes.length, contentType),
      ];
      for (let i = 0, part = 0; i < bytes.length || part === 0; i += CHUNK, part++) {
        stmts.push(
          db.prepare("INSERT INTO blob_chunks (key, part, data) VALUES (?, ?, ?)").bind(key, part, bytes.slice(i, i + CHUNK)),
        );
      }
      await db.batch(stmts);
    },
    async get(key) {
      const meta = await db.prepare("SELECT size FROM blobs WHERE key = ?").bind(key).first<{ size: number }>();
      if (!meta) return null;
      return {
        size: meta.size,
        bytes: () => readAll(key),
        text: async () => new TextDecoder().decode(await readAll(key)),
        stream: () =>
          new ReadableStream({
            async start(ctrl) {
              ctrl.enqueue(await readAll(key));
              ctrl.close();
            },
          }),
      };
    },
    async delete(keys) {
      if (!keys.length) return;
      await db.batch(
        keys.flatMap((k) => [
          db.prepare("DELETE FROM blob_chunks WHERE key = ?").bind(k),
          db.prepare("DELETE FROM blobs WHERE key = ?").bind(k),
        ]),
      );
    },
  };
}
