/** 나라장터 입찰공고 API 항목명 → 한글 표시명 (상세 화면용) */
export const G2B_FIELD_GROUPS: { title: string; fields: [string, string][] }[] = [
  {
    title: "공고 기본정보",
    fields: [
      ["bidNtceNo", "입찰공고번호"],
      ["bidNtceOrd", "공고차수"],
      ["bidNtceNm", "공고명"],
      ["ntceKindNm", "공고종류"],
      ["reNtceYn", "재공고 여부"],
      ["rgstTyNm", "등록유형"],
      ["srvceDivNm", "용역구분"],
      ["pubPrcrmntClsfcNm", "공공조달분류"],
      ["dtilPrdctClsfcNoNm", "세부품명"],
      ["bidNtceDt", "공고일시"],
      ["refNo", "참조번호"],
      ["chgNtceRsn", "변경공고 사유"],
    ],
  },
  {
    title: "기관·담당자",
    fields: [
      ["ntceInsttNm", "공고기관"],
      ["dminsttNm", "수요기관"],
      ["ntceInsttOfclNm", "공고기관 담당자"],
      ["ntceInsttOfclTelNo", "담당자 전화"],
      ["ntceInsttOfclEmailAdrs", "담당자 이메일"],
      ["exctvNm", "집행관"],
    ],
  },
  {
    title: "입찰·계약 방식",
    fields: [
      ["bidMethdNm", "입찰방식"],
      ["cntrctCnclsMthdNm", "계약체결방법"],
      ["sucsfbidMthdNm", "낙찰방법"],
      ["prearngPrceDcsnMthdNm", "예정가격 결정방법"],
      ["sucsfbidLwltRate", "낙찰하한율(%)"],
      ["intrbidYn", "국제입찰 여부"],
      ["rbidPermsnYn", "재입찰 허용"],
      ["indstrytyLmtYn", "업종제한 여부"],
      ["bidPrtcptLmtYn", "참가제한 여부"],
      ["cmmnSpldmdAgrmntRcptdocMethd", "공동수급 협정서 접수방식"],
      ["cmmnSpldmdCorpRgnLmtYn", "공동수급 지역제한"],
      ["jntcontrctDutyRgnNm1", "공동도급 의무지역"],
      ["rgnDutyJntcontrctRt", "지역의무 공동도급 비율"],
      ["infoBizYn", "정보화사업 여부"],
    ],
  },
  {
    title: "금액",
    fields: [
      ["presmptPrce", "추정가격"],
      ["asignBdgtAmt", "배정예산"],
      ["VAT", "부가세"],
    ],
  },
  {
    title: "일정",
    fields: [
      ["bidQlfctRgstDt", "입찰참가자격 등록마감"],
      ["cmmnSpldmdAgrmntClseDt", "공동수급협정 마감"],
      ["bidBeginDt", "입찰 개시"],
      ["bidClseDt", "입찰 마감"],
      ["opengDt", "개찰일시"],
      ["opengPlce", "개찰장소"],
      ["dcmtgOprtnDt", "설명회 일시"],
      ["dcmtgOprtnPlce", "설명회 장소"],
      ["pqApplDocRcptDt", "PQ서류 접수일시"],
      ["arsltApplDocRcptDt", "실적서류 접수일시"],
    ],
  },
];

const MONEY = new Set(["presmptPrce", "asignBdgtAmt", "VAT"]);
const YN: Record<string, string> = { Y: "예", N: "아니오" };

export function fieldValue(key: string, v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  if (!s) return null;
  if (MONEY.has(key)) {
    const n = Number(s.replace(/,/g, ""));
    return Number.isFinite(n) ? `${n.toLocaleString("ko-KR")}원` : s;
  }
  if (key.endsWith("Yn")) return YN[s] ?? s;
  return s;
}
