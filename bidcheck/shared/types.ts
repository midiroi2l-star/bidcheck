import { z } from "zod";

export const BID_STATUSES = [
  "interest",
  "analyzed",
  "in_progress",
  "submitted",
  "won",
  "lost",
  "dropped",
] as const;
export type BidStatus = (typeof BID_STATUSES)[number];

export const STATUS_LABEL: Record<BidStatus, string> = {
  interest: "관심",
  analyzed: "분석완료",
  in_progress: "입찰진행",
  submitted: "제출완료",
  won: "낙찰",
  lost: "탈락",
  dropped: "포기",
};

export const BID_CATEGORIES = ["용역", "물품", "공사", "외자"] as const;
export type BidCategory = (typeof BID_CATEGORIES)[number];

export const FILE_KINDS = {
  notice: "입찰공고문",
  rfp: "제안요청서",
  spec: "과업지시서/규격서",
  form: "제출서식",
  other: "기타",
} as const;
export type FileKind = keyof typeof FILE_KINDS;

/** 나라장터 공고 검색 결과를 앱에서 쓰는 형태로 정규화한 것 */
export interface G2BNotice {
  bidNo: string;
  bidOrd: string;
  category: BidCategory;
  title: string;
  org: string;
  demandOrg: string;
  noticeDt: string | null;
  closeDt: string | null;
  openDt: string | null;
  estPrice: number | null;
  budget: number | null;
  contractMethod: string | null;
  awardMethod: string | null;
  detailUrl: string | null;
  attachments: { name: string; url: string }[];
  raw: Record<string, unknown>;
}

export interface Bid {
  id: string;
  bid_no: string;
  bid_ord: string;
  category: string | null;
  title: string;
  org: string | null;
  demand_org: string | null;
  notice_dt: string | null;
  close_dt: string | null;
  open_dt: string | null;
  est_price: number | null;
  budget: number | null;
  contract_method: string | null;
  award_method: string | null;
  detail_url: string | null;
  raw_json: string | null;
  status: BidStatus;
  fit_score: number | null;
  recommendation: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface BidFile {
  id: string;
  bid_id: string;
  kind: FileKind;
  filename: string;
  mime: string | null;
  size: number | null;
  source_url: string | null;
  has_text: number;
  uploaded_at: string;
}

export interface CompanyDoc {
  id: string;
  category: string;
  title: string;
  filename: string;
  mime: string | null;
  size: number | null;
  has_text: number;
  valid_until: string | null;
  memo: string | null;
  uploaded_at: string;
}

export interface HistoryEntry {
  id: number;
  bid_id: string | null;
  action: string;
  detail: string | null;
  at: string;
  bid_title?: string | null;
}

export interface Proposal {
  id: string;
  bid_id: string;
  version: number;
  content_md: string;
  created_at: string;
}

/* ───────────────────────── 회사 프로필 ───────────────────────── */

export interface CompanyProfile {
  name?: string;
  bizNo?: string;
  ceo?: string;
  address?: string;
  region?: string; // 소재지 시·도
  foundedAt?: string;
  companySize?: string; // 대기업/중견/중소/소기업/소상공인
  employees?: number | null;
  creditRating?: string; // 신용평가등급 (예: BB+)
  creditRatingDate?: string;
  revenue?: string; // 최근 매출액
  licenses?: string; // 업종/면허 (줄바꿈 구분: 업종코드 + 명칭)
  directProduction?: string; // 직접생산확인 품목
  certifications?: string; // ISO, 벤처, 이노비즈, 여성기업, GS 등
  techStaff?: string; // 기술인력 현황 (등급별 인원)
  performance?: string; // 주요 수행실적 (사업명/발주처/금액/기간)
  sanctions?: string; // 부정당제재·벌점 등 감점 이력
  preferences?: string; // 관심 분야·지역·금액대 등 입찰 전략 메모
  notes?: string;
}

/** 회사 서류함 권장 목록 — 나라장터 입찰·제안 평가에서 자주 요구되는 서류 */
export const COMPANY_DOC_CATEGORIES: { key: string; label: string; why: string }[] = [
  { key: "biz_reg", label: "사업자등록증", why: "입찰참가자격 기본 확인, 소재지·업태 확인" },
  { key: "corp_reg", label: "법인등기부등본", why: "설립일·대표자·임원 확인" },
  { key: "g2b_reg", label: "나라장터 경쟁입찰참가자격 등록증", why: "업종·면허 등록 여부 (참가자격 판정 핵심)" },
  { key: "license", label: "업종 면허/등록증 (소프트웨어사업자, 엔지니어링 등)", why: "공고의 업종 제한 충족 여부" },
  { key: "credit", label: "신용평가등급확인서", why: "경영상태·신인도 평가 점수 산정" },
  { key: "sme", label: "중소기업(소상공인) 확인서", why: "중소기업 제한경쟁·가점 여부" },
  { key: "direct_prod", label: "직접생산확인증명서", why: "중소기업자간 경쟁제품 입찰 시 필수" },
  { key: "performance", label: "용역/납품 실적증명서", why: "유사실적 평가, 실적 제한 충족 여부" },
  { key: "tech_staff", label: "기술인력 보유현황·경력증명서", why: "투입인력 평가, 기술자 등급 요건" },
  { key: "cert", label: "인증서 (ISO, 벤처, 이노비즈, 메인비즈, GS 등)", why: "신인도 가점 항목" },
  { key: "social", label: "여성·장애인·사회적기업 확인서", why: "신인도 가점 및 우선구매 대상" },
  { key: "financial", label: "재무제표 (최근 3년)", why: "경영상태 평가, 매출 규모 요건" },
  { key: "tax", label: "국세·지방세 완납증명서", why: "계약 시 필수 서류" },
  { key: "insurance", label: "4대보험 가입자 명부", why: "인력 재직 증빙" },
  { key: "sanction", label: "제재·벌점 관련 자료", why: "신인도 감점 확인" },
  { key: "intro", label: "회사소개서 / 기존 제안서", why: "제안서 초안 작성 시 회사 역량·문체 참고" },
  { key: "other", label: "기타", why: "" },
];

/* ───────────────────────── AI 분석 결과 스키마 ───────────────────────── */

const verdict = z.enum(["pass", "fail", "unknown"]);

export const AnalysisSchema = z.object({
  overview: z.object({
    project_name: z.string(),
    purpose: z.string().describe("사업 목적·범위 요약 (3~5문장)"),
    period: z.string().describe("사업(계약) 기간"),
    budget_text: z.string().describe("사업예산/추정가격/기초금액 등 금액 정보"),
    contract_method: z.string().describe("계약방법 (예: 제한경쟁, 협상에 의한 계약)"),
    award_method: z.string().describe("낙찰자 결정방법과 기술:가격 배점 비율"),
    key_dates: z.array(z.object({ label: z.string(), date: z.string() })),
  }),
  eligibility: z
    .array(
      z.object({
        requirement: z.string().describe("자격 요건 원문 요지"),
        source: z.string().describe("근거 문서와 위치 (예: 입찰공고문 3.가)"),
        company_status: z.string().describe("당사 현황 (프로필/서류 기준)"),
        verdict,
        action_needed: z.string().describe("충족을 위해 필요한 조치 또는 확인 사항. 없으면 빈 문자열"),
      }),
    )
    .describe("입찰참가자격 요건별 충족 여부"),
  credibility: z
    .array(
      z.object({
        item: z.string().describe("신인도/경영상태 평가 항목 (예: 신용평가등급, 인증 가점, 제재 감점)"),
        criteria: z.string().describe("평가 기준 (공고/평가기준표 또는 관련 기준 근거)"),
        max_points: z.number().nullable(),
        expected_points: z.number().nullable().describe("당사 예상 점수(감점은 음수)"),
        verdict,
        note: z.string(),
      }),
    )
    .describe("신인도·경영상태 항목별 예상 점수"),
  scoring: z.object({
    technical_max: z.number().nullable(),
    technical_expected: z.number().nullable(),
    technical_items: z.array(
      z.object({
        item: z.string(),
        max_points: z.number().nullable(),
        expected_points: z.number().nullable(),
        rationale: z.string(),
      }),
    ),
    price_max: z.number().nullable(),
    price_note: z.string(),
    credibility_adjustment: z.number().nullable().describe("신인도 가감점 합계"),
    total_expected: z.number().nullable().describe("기술+가격+신인도 예상 총점"),
    total_max: z.number().nullable(),
    competitiveness: z.string().describe("예상 점수 기준 경쟁력 의견"),
  }),
  fit: z.object({
    score: z.number().describe("당사 적합도 0~100"),
    grade: z.enum(["A", "B", "C", "D"]),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
  }),
  cautions: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      severity: z.enum(["high", "medium", "low"]),
    }),
  ),
  required_documents: z
    .array(
      z.object({
        name: z.string(),
        stage: z.enum(["입찰참가", "제안서제출", "적격심사", "계약", "기타"]),
        company_doc_category: z
          .string()
          .describe("회사 서류함 분류 키 (biz_reg, credit, performance 등) 또는 none"),
        have: z.enum(["yes", "no", "unknown"]),
        note: z.string(),
      }),
    )
    .describe("이 입찰에 제출해야 하는 서류와 당사 보유 여부"),
  missing_company_info: z
    .array(z.string())
    .describe("정확한 판정을 위해 당사가 추가로 등록해야 할 서류·정보"),
  recommendation: z.enum(["go", "conditional", "no_go"]),
  opinion_md: z.string().describe("검토 의견서 (마크다운). 결론, 근거, 리스크, 권고 조치 순"),
});
export type AnalysisResult = z.infer<typeof AnalysisSchema>;

export interface AnalysisRecord {
  id: string;
  bid_id: string;
  model: string | null;
  fit_score: number | null;
  recommendation: string | null;
  created_at: string;
  result: AnalysisResult;
}

export const RECOMMENDATION_LABEL: Record<string, string> = {
  go: "참여 권고",
  conditional: "조건부 참여",
  no_go: "참여 비권고",
};

/** 회사 서류에서 프로필을 자동 추출할 때의 스키마 */
export const ProfileExtractSchema = z.object({
  name: z.string(),
  bizNo: z.string(),
  ceo: z.string(),
  address: z.string(),
  region: z.string(),
  foundedAt: z.string(),
  companySize: z.string(),
  employees: z.number().nullable(),
  creditRating: z.string(),
  creditRatingDate: z.string(),
  revenue: z.string(),
  licenses: z.string(),
  directProduction: z.string(),
  certifications: z.string(),
  techStaff: z.string(),
  performance: z.string(),
  sanctions: z.string(),
});

/** 스트리밍 API 이벤트 (NDJSON 한 줄씩) */
export type StreamEvent =
  | { type: "status"; message: string }
  | { type: "delta"; text: string }
  | { type: "done"; data: unknown }
  | { type: "error"; message: string };
