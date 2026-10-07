import type { BidCategory, G2BNotice } from "../shared/types";

/** 조달청_나라장터 입찰공고정보서비스 오퍼레이션 접미사 */
const OP_SUFFIX: Record<BidCategory, string> = {
  용역: "Servc",
  물품: "Thng",
  공사: "Cnstwk",
  외자: "Frgcpt",
};

export class G2BError extends Error {}

type Item = Record<string, unknown>;

function buildUrl(base: string, op: string, serviceKey: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ ...params, type: "json" }).toString();
  // 공공데이터포털은 Encoding/Decoding 두 가지 키를 준다. 이미 인코딩된 키(%포함)는 그대로 붙인다.
  const key = serviceKey.includes("%") ? serviceKey : encodeURIComponent(serviceKey);
  return `${base.replace(/\/$/, "")}/${op}?serviceKey=${key}&${qs}`;
}

async function call(base: string, op: string, serviceKey: string, params: Record<string, string>) {
  const res = await fetch(buildUrl(base, op, serviceKey, params), {
    headers: { Accept: "application/json" },
  });
  const text = await res.text();
  if (text.trimStart().startsWith("<")) {
    // 인증 오류 등은 type=json 이어도 XML 로 온다
    const msg =
      text.match(/<returnAuthMsg>([^<]*)</)?.[1] ??
      text.match(/<resultMsg>([^<]*)</)?.[1] ??
      text.match(/<errMsg>([^<]*)</)?.[1] ??
      `HTTP ${res.status}`;
    throw new G2BError(`나라장터 API 오류: ${msg}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new G2BError(`나라장터 API 응답을 해석할 수 없습니다 (HTTP ${res.status})`);
  }
  const root = (json as { response?: { header?: Item; body?: Item } }).response;
  const code = String(root?.header?.resultCode ?? "");
  if (code && code !== "00") {
    throw new G2BError(`나라장터 API 오류: ${String(root?.header?.resultMsg ?? code)}`);
  }
  const body = root?.body ?? {};
  let items: unknown = body.items;
  if (items && !Array.isArray(items) && typeof items === "object") {
    items = (items as { item?: unknown }).item;
  }
  const list: Item[] = Array.isArray(items) ? items : items ? [items as Item] : [];
  return { items: list, totalCount: Number(body.totalCount ?? list.length) };
}

const str = (v: unknown) => (v == null || v === "" ? null : String(v).trim());
const num = (v: unknown) => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

export function normalize(item: Item, category: BidCategory): G2BNotice {
  const attachments: { name: string; url: string }[] = [];
  for (let i = 1; i <= 10; i++) {
    const url = str(item[`ntceSpecDocUrl${i}`]);
    if (url) attachments.push({ name: str(item[`ntceSpecFileNm${i}`]) ?? `첨부${i}`, url });
  }
  const std = str(item.stdNtceDocUrl);
  if (std) attachments.push({ name: "표준공고서", url: std });
  return {
    bidNo: str(item.bidNtceNo) ?? "",
    bidOrd: str(item.bidNtceOrd) ?? "000",
    category,
    title: str(item.bidNtceNm) ?? "(제목 없음)",
    org: str(item.ntceInsttNm) ?? "",
    demandOrg: str(item.dminsttNm) ?? "",
    noticeDt: str(item.bidNtceDt) ?? str(item.rgstDt),
    closeDt: str(item.bidClseDt),
    openDt: str(item.opengDt),
    estPrice: num(item.presmptPrce),
    budget: num(item.asignBdgtAmt),
    contractMethod: str(item.cntrctCnclsMthdNm),
    awardMethod: str(item.sucsfbidMthdNm),
    detailUrl: str(item.bidNtceDtlUrl) ?? str(item.bidNtceUrl),
    attachments,
    raw: item,
  };
}

/** YYYY-MM-DD → YYYYMMDDHHMM */
const toG2BDate = (d: string, end: boolean) => d.replace(/-/g, "") + (end ? "2359" : "0000");

export interface SearchParams {
  category: BidCategory;
  keyword?: string;
  org?: string;
  from: string;
  to: string;
  page?: number;
  rows?: number;
}

export async function searchNotices(base: string, key: string, p: SearchParams) {
  const params: Record<string, string> = {
    inqryDiv: "1",
    inqryBgnDt: toG2BDate(p.from, false),
    inqryEndDt: toG2BDate(p.to, true),
    pageNo: String(p.page ?? 1),
    numOfRows: String(p.rows ?? 50),
  };
  if (p.keyword) params.bidNtceNm = p.keyword;
  if (p.org) params.ntceInsttNm = p.org;
  const { items, totalCount } = await call(
    base,
    `getBidPblancListInfo${OP_SUFFIX[p.category]}PPSSrch`,
    key,
    params,
  );
  // 같은 공고의 여러 차수가 오면 최신 차수만 남긴다
  const latest = new Map<string, G2BNotice>();
  for (const it of items) {
    const n = normalize(it, p.category);
    const prev = latest.get(n.bidNo);
    if (!prev || prev.bidOrd < n.bidOrd) latest.set(n.bidNo, n);
  }
  return { items: [...latest.values()], totalCount };
}

/** 공고번호로 단건 조회. 오퍼레이션별 조회구분 차이가 있어 몇 가지 방식을 차례로 시도한다. */
export async function lookupNotice(base: string, key: string, bidNo: string, category: BidCategory) {
  const op = `getBidPblancListInfo${OP_SUFFIX[category]}`;
  const attempts: Record<string, string>[] = [
    { inqryDiv: "2", bidNtceNo: bidNo },
    { inqryDiv: "3", bidNtceNo: bidNo },
  ];
  let lastErr: unknown = null;
  for (const params of attempts) {
    try {
      const { items } = await call(base, op, key, { ...params, pageNo: "1", numOfRows: "20" });
      const matches = items.map((i) => normalize(i, category)).filter((n) => n.bidNo === bidNo);
      if (matches.length) return matches.sort((a, b) => b.bidOrd.localeCompare(a.bidOrd))[0];
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr instanceof G2BError) throw lastErr;
  return null;
}

/** 공고 첨부파일을 서버에서 내려받는다. 파일명은 Content-Disposition 우선. */
export async function downloadAttachment(url: string, fallbackName: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (bidcheck)", Referer: "https://www.g2b.go.kr/" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const cd = res.headers.get("content-disposition") ?? "";
  let name = fallbackName;
  const star = cd.match(/filename\*=(?:UTF-8'')?([^;]+)/i)?.[1];
  const plain = cd.match(/filename="?([^";]+)"?/i)?.[1];
  try {
    if (star) name = decodeURIComponent(star.replace(/"/g, ""));
    else if (plain && /%[0-9A-F]{2}/i.test(plain)) name = decodeURIComponent(plain);
  } catch {
    /* 인코딩이 깨진 파일명은 공고의 파일명을 사용 */
  }
  const buf = await res.arrayBuffer();
  const type = res.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream";
  if (type === "text/html" && buf.byteLength < 200_000) {
    throw new Error("파일 대신 웹페이지가 반환되었습니다 (로그인/세션 필요)");
  }
  return { name, type, buf };
}
