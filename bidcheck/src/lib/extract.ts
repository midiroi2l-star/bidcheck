import * as CFB from "cfb";
import { inflateSync, unzipSync, strFromU8 } from "fflate";

/**
 * 첨부파일에서 텍스트를 뽑는다 (브라우저에서 실행).
 * - PDF 는 서버에서 Claude 에 원본 그대로 전달하므로 추출하지 않는다.
 * - HWP(5.0), HWPX, DOCX, XLSX, TXT/CSV/MD 지원.
 */
export interface Extracted {
  text: string | null;
  note?: string;
}

export async function extractText(file: Blob, filename: string): Promise<Extracted> {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  try {
    if (ext === "pdf") return { text: null, note: "PDF 는 원본을 그대로 분석합니다" };
    const buf = new Uint8Array(await file.arrayBuffer());
    switch (ext) {
      case "hwp":
        return hwpText(buf);
      case "hwpx":
        return { text: zipXmlText(buf, /^Contents\/section\d+\.xml$/i, "hp") };
      case "docx":
        return { text: zipXmlText(buf, /^word\/document\.xml$/i, "w") };
      case "xlsx":
      case "xlsm":
        return { text: await xlsxText(buf) };
      case "txt":
      case "csv":
      case "md":
      case "json":
      case "xml":
      case "html":
        return { text: decodeText(buf) };
      default:
        return { text: null, note: `${ext.toUpperCase()} 형식은 내용을 읽을 수 없습니다. PDF 로 변환해 올려주세요.` };
    }
  } catch (e) {
    return { text: null, note: `텍스트 추출 실패: ${e instanceof Error ? e.message : String(e)}` };
  }
}

function decodeText(buf: Uint8Array) {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  // 깨진 문자가 많으면 EUC-KR 로 재시도
  const broken = (utf8.match(/�/g) ?? []).length;
  if (broken > 10) return new TextDecoder("euc-kr").decode(buf);
  return utf8;
}

/* ───────────── HWP 5.0 (OLE 복합문서) ───────────── */

const HWPTAG_PARA_TEXT = 67;

function hwpText(buf: Uint8Array): Extracted {
  const cfb = CFB.read(buf, { type: "array" });
  const header = CFB.find(cfb, "/FileHeader");
  if (!header?.content) throw new Error("HWP 파일 헤더를 찾을 수 없습니다");
  const h = toU8(header.content);
  const props = h[36] | (h[37] << 8) | (h[38] << 16) | (h[39] << 24);
  const compressed = (props & 1) !== 0;
  if (props & 2) return { text: null, note: "암호가 걸린 HWP 문서입니다. 암호를 해제하거나 PDF 로 올려주세요." };
  if (props & 4) return { text: null, note: "배포용(읽기전용) HWP 문서는 텍스트를 추출할 수 없습니다. PDF 로 저장해 올려주세요." };

  const out: string[] = [];
  for (let i = 0; ; i++) {
    const sec = CFB.find(cfb, `/BodyText/Section${i}`);
    if (!sec?.content) break;
    let data = toU8(sec.content);
    if (compressed) data = inflateSync(data);
    out.push(parseSection(data));
  }
  if (!out.length) return { text: null, note: "HWP 본문을 찾을 수 없습니다" };
  return { text: out.join("\n").replace(/\n{3,}/g, "\n\n").trim() };
}

// cfb 는 입력 형식에 따라 number[] 또는 Buffer 를 돌려준다
const toU8 = (c: ArrayLike<number>) => (c instanceof Uint8Array ? c : Uint8Array.from(c));

function parseSection(d: Uint8Array) {
  const view = new DataView(d.buffer, d.byteOffset, d.byteLength);
  const lines: string[] = [];
  let pos = 0;
  while (pos + 4 <= d.length) {
    const hdr = view.getUint32(pos, true);
    pos += 4;
    const tag = hdr & 0x3ff;
    let size = hdr >>> 20;
    if (size === 0xfff) {
      size = view.getUint32(pos, true);
      pos += 4;
    }
    if (tag === HWPTAG_PARA_TEXT) lines.push(paraText(view, pos, size));
    pos += size;
  }
  return lines.join("\n");
}

function paraText(view: DataView, start: number, size: number) {
  let s = "";
  const end = Math.min(start + size, view.byteLength);
  for (let p = start; p + 1 < end; ) {
    const ch = view.getUint16(p, true);
    if (ch >= 32) {
      s += String.fromCharCode(ch);
      p += 2;
    } else if (ch === 9) {
      s += "\t";
      p += 16; // 탭은 인라인 컨트롤(8 WCHAR)
    } else if (ch === 10 || ch === 13) {
      s += "\n";
      p += 2;
    } else if ((ch >= 1 && ch <= 8) || (ch >= 11 && ch <= 12) || (ch >= 14 && ch <= 23)) {
      p += 16; // 확장/인라인 컨트롤은 8 WCHAR 크기
    } else {
      p += 2;
    }
  }
  return s.trimEnd();
}

/* ───────────── HWPX / DOCX (ZIP + XML) ───────────── */

function zipXmlText(buf: Uint8Array, entry: RegExp, ns: "hp" | "w") {
  const files = unzipSync(buf, { filter: (f) => entry.test(f.name) });
  const names = Object.keys(files).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return names
    .map((n) => {
      const xml = strFromU8(files[n]);
      return xml
        .replace(new RegExp(`</${ns}:p>`, "g"), "\n")
        .replace(new RegExp(`<${ns}:(tab|br)\\b[^>]*/>`, "g"), (_m, t: string) => (t === "tab" ? "\t" : "\n"))
        .replace(/<[^>]+>/g, "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&");
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ───────────── XLSX ───────────── */

async function xlsxText(buf: Uint8Array) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
  const out: string[] = [];
  wb.eachSheet((ws) => {
    out.push(`## 시트: ${ws.name}`);
    ws.eachRow((row) => {
      const vals = (row.values as unknown[]).slice(1).map((v) => cellText(v));
      out.push(vals.join("\t"));
    });
  });
  return out.join("\n");
}

export function cellText(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[]; hyperlink?: string };
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (o.text != null) return String(o.text);
    if (o.result != null) return cellText(o.result);
    return "";
  }
  return String(v);
}
