import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaContentBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import {
  AnalysisSchema,
  COMPANY_DOC_CATEGORIES,
  FILE_KINDS,
  ProfileExtractSchema,
  type AnalysisResult,
  type Bid,
  type FileKind,
} from "../shared/types";
import { storage } from "./storage";

export interface Env {
  DB: D1Database;
  /** 선택: R2 버킷. 없으면 파일도 D1 에 저장 */
  FILES?: R2Bucket;
  ANTHROPIC_API_KEY?: string;
  /** 선택: Cloudflare AI Gateway 등 프록시 주소 */
  ANTHROPIC_BASE_URL?: string;
  G2B_SERVICE_KEY?: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  G2B_API_BASE: string;
  CLAUDE_MODEL: string;
}

// 거부(refusal) 시 서버 측에서 권장 모델로 자동 재시도
const BETAS = ["server-side-fallback-2026-07-01"];

export function client(env: Env) {
  if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY 가 설정되지 않았습니다.");
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, baseURL: env.ANTHROPIC_BASE_URL || undefined });
}

/** 업로드 원본(PDF) 또는 추출 텍스트를 Claude 입력 블록으로 변환 */
export interface SourceFile {
  id: string;
  label: string;
  filename: string;
  mime: string | null;
  r2_key: string;
  has_text: number;
}

const MAX_PDF_BYTES = 24 * 1024 * 1024;

async function toBlocks(env: Env, f: SourceFile): Promise<BetaContentBlockParam[]> {
  const isPdf = f.mime === "application/pdf" || f.filename.toLowerCase().endsWith(".pdf");
  if (isPdf) {
    const obj = await storage(env).get(f.r2_key);
    if (obj && obj.size <= MAX_PDF_BYTES) {
      const bytes = await obj.bytes();
      return [
        {
          type: "document",
          title: `${f.label}: ${f.filename}`,
          source: { type: "base64", media_type: "application/pdf", data: toBase64(bytes) },
        },
      ];
    }
  }
  if (f.has_text) {
    const txt = await storage(env).get(`text/${f.id}.txt`);
    if (txt) {
      return [
        {
          type: "document",
          title: `${f.label}: ${f.filename}`,
          source: { type: "text", media_type: "text/plain", data: await txt.text() },
        },
      ];
    }
  }
  return [{ type: "text", text: `[${f.label}: ${f.filename}] — 내용을 읽을 수 없는 파일 (텍스트 미추출)` }];
}

function toBase64(bytes: Uint8Array) {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

const categoryLabel = (k: string) => COMPANY_DOC_CATEGORIES.find((c) => c.key === k)?.label ?? k;

/** 회사 정보(프로필 + 서류함) 블록. 입찰마다 같으므로 캐시 지점을 둔다. */
async function companyBlocks(env: Env): Promise<BetaContentBlockParam[]> {
  const profile = await env.DB.prepare("SELECT data FROM company_profile WHERE id = 1").first<{ data: string }>();
  const docs = await env.DB.prepare(
    "SELECT id, category, title, filename, mime, r2_key, has_text, valid_until FROM company_docs ORDER BY category, uploaded_at",
  ).all<SourceFile & { category: string; title: string; valid_until: string | null }>();

  const list = docs.results
    .map((d) => `- [${categoryLabel(d.category)}] ${d.title} (${d.filename})${d.valid_until ? ` 유효기간 ${d.valid_until}` : ""}`)
    .join("\n");

  const blocks: BetaContentBlockParam[] = [
    {
      type: "text",
      text: `<company_profile>\n${profile?.data ?? "{}"}\n</company_profile>\n\n<company_documents_index>\n${list || "(등록된 회사 서류 없음)"}\n</company_documents_index>`,
    },
  ];
  for (const d of docs.results) {
    blocks.push(...(await toBlocks(env, { ...d, label: `당사서류/${categoryLabel(d.category)}` })));
  }
  const last = blocks[blocks.length - 1];
  if (last.type === "text" || last.type === "document") last.cache_control = { type: "ephemeral" };
  return blocks;
}

async function bidBlocks(env: Env, bid: Bid): Promise<BetaContentBlockParam[]> {
  const files = await env.DB.prepare(
    "SELECT id, kind, filename, mime, r2_key, has_text FROM bid_files WHERE bid_id = ? ORDER BY uploaded_at",
  )
    .bind(bid.id)
    .all<SourceFile & { kind: FileKind }>();

  const raw = bid.raw_json ? (JSON.parse(bid.raw_json) as { _extra?: { licenses: string[]; regions: string[] } | null }) : null;
  const meta = {
    공고번호: `${bid.bid_no}-${bid.bid_ord}`,
    구분: bid.category,
    공고명: bid.title,
    공고기관: bid.org,
    수요기관: bid.demand_org,
    공고일시: bid.notice_dt,
    입찰마감: bid.close_dt,
    개찰일시: bid.open_dt,
    추정가격: bid.est_price,
    배정예산: bid.budget,
    계약방법: bid.contract_method,
    낙찰방법: bid.award_method,
    면허업종제한: raw?._extra?.licenses ?? "(조회 안 됨)",
    참가가능지역: raw?._extra?.regions ?? "(조회 안 됨)",
    나라장터원본: raw,
  };
  const blocks: BetaContentBlockParam[] = [
    { type: "text", text: `<bid_notice_metadata>\n${JSON.stringify(meta, null, 1)}\n</bid_notice_metadata>` },
  ];
  for (const f of files.results) {
    blocks.push(...(await toBlocks(env, { ...f, label: FILE_KINDS[f.kind] ?? "첨부" })));
  }
  if (!files.results.length) {
    blocks.push({ type: "text", text: "(첨부된 공고문/제안요청서 없음 — 메타데이터만으로 판단)" });
  }
  return blocks;
}

const ANALYSIS_SYSTEM = `당신은 대한민국 공공조달(나라장터) 입찰 전문 컨설턴트로서 "당사"의 입찰 참여 여부를 검토하고 결과보고서를 작성합니다.
입력: 당사 프로필과 회사 서류, 입찰공고 메타데이터(면허·지역 제한 포함), 첨부(입찰공고문, 제안요청서, 과업지시서 등).

작성 원칙
- 근거는 첨부 문서와 당사 자료에서 찾고 위치(문서명·조항)를 적습니다. 문서에 없는 내용은 관련 법령·조달청 기준(국가계약법 시행령, 협상에 의한 계약 제안서평가 세부기준, 적격심사 세부기준 등)의 일반 기준이라고 명시합니다.
- 당사 자료로 확인되지 않으면 추측하지 말고 verdict 를 "unknown" 으로 두고, 무엇을 등록하면 확인되는지 action_needed 와 missing_company_info 에 적습니다.
- 참가자격: 업종·면허 제한, 지역 제한, 중소기업/소상공인 제한, 직접생산확인, 실적 제한, 공동수급 허용 여부, 기술인력 요건 등을 빠짐없이 항목화합니다.
- 평가(evaluation): 기술평가 항목별 배점·당사 예상점수·근거·점수를 높일 제안서 작성 포인트, 협상적격 기준, 가격점수 산정 방식과 권장 투찰 전략, 신인도·경영상태 항목별 점수(평가기준표가 없으면 해당 계약방법의 통상 기준), 예상 총점을 제시합니다. 확인 불가한 값은 null 로 두고 가능한 범위에서 보수적으로 추정합니다.
- 적합도(fit): 종합 점수 0~100 과 요소별 점수(참가자격, 기술역량, 유사실적, 투입인력, 사업규모 적정성, 수익성, 일정 여유, 리스크 수준 — 각 0~100, 높을수록 유리)를 매깁니다. 참가자격 미충족이면 종합 30점 이하. 등급 A(80+), B(65~79), C(50~64), D(50 미만).
- 경쟁(competition): 사업 성격·규모로 볼 때 예상 경쟁 강도와 경쟁사 유형을 추정하되 추정임을 밝힙니다.
- 리스크(risks): 실격·감점 사유, 제출 기한·서식·분량 요건, 계약 특수조건(지체상금, 하자보수, 지식재산권), 보안·하도급 제한, 수행·재무·일정 리스크를 심각도와 대응 방안과 함께 정리합니다.
- 제출서류: 단계별로 정리하고 회사 서류함 분류 키(${COMPANY_DOC_CATEGORIES.map((c) => c.key).join(", ")}, 해당 없으면 none)와 보유 여부를 표시합니다.
- 전략(strategy): 수주 전략 테마, 차별화 포인트, 공동수급 필요 여부와 파트너 요건, 발주처에 질의할 사항을 제안합니다.
- action_items: 참여 시 해야 할 일을 담당(예: 영업, 기술, 관리)과 기한(공고 일정 기준)과 함께 나열합니다.
- executive_summary 와 opinion_md 는 경영진 보고용으로 간결하게 씁니다. opinion_md 는 결론(참여 권고/조건부/비권고), 판단 근거, 리스크, 권고 조치 순입니다.
모든 출력은 한국어로 작성합니다.`;

type Emit = (e: { type: "status"; message: string } | { type: "delta"; text: string }) => void;

export async function analyzeBid(env: Env, bid: Bid, emit: Emit): Promise<{ result: AnalysisResult; model: string }> {
  emit({ type: "status", message: "자료 불러오는 중…" });
  const content: BetaContentBlockParam[] = [
    ...(await companyBlocks(env)),
    ...(await bidBlocks(env, bid)),
    {
      type: "text",
      text: "위 입찰을 검토 원칙에 따라 분석하고 지정된 JSON 형식으로 결과를 작성하세요.",
    },
  ];
  emit({ type: "status", message: "Claude 분석 중… (문서 분량에 따라 1~5분 소요)" });

  const stream = client(env).beta.messages.stream({
    model: env.CLAUDE_MODEL,
    max_tokens: 64000,
    betas: BETAS,
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: betaZodOutputFormat(AnalysisSchema) },
    system: ANALYSIS_SYSTEM,
    messages: [{ role: "user", content }],
  });

  let chars = 0;
  let lastTick = 0;
  stream.on("text", (t) => {
    chars += t.length;
    if (chars - lastTick > 1500) {
      lastTick = chars;
      emit({ type: "status", message: `결과 작성 중… (${chars.toLocaleString()}자)` });
    }
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("Claude 가 이 요청에 대한 응답을 거부했습니다.");
  if (msg.stop_reason === "max_tokens") throw new Error("응답이 너무 길어 중간에 끊겼습니다. 첨부 문서를 줄여 다시 시도하세요.");
  if (!msg.parsed_output) throw new Error("분석 결과 형식을 해석하지 못했습니다. 다시 시도하세요.");
  return { result: msg.parsed_output, model: msg.model };
}

const PROPOSAL_SYSTEM = `당신은 공공 제안서 작성 전문가입니다. 당사가 나라장터 입찰에 제출할 기술제안서 초안을 마크다운으로 작성합니다.

구성
- 제안요청서에 제안서 목차·작성 지침이 있으면 그 목차와 순서를 그대로 따릅니다. 없으면 Ⅰ.제안 개요 Ⅱ.제안사 일반 Ⅲ.기술 부문 Ⅳ.사업관리 부문 Ⅴ.지원 부문 을 씁니다.
- 각 장 첫머리에 대응 평가항목과 배점을 "> 평가항목: …" 으로 표시하고, 배점이 높은 항목일수록 분량과 구체성을 더 배분합니다.
- 각 장마다 핵심 메시지를 "> 💡 핵심 메시지: …" 한 줄로 먼저 제시합니다.
- 제안요청서의 요구사항(요구사항 ID가 있으면 ID 포함)은 하나도 빠짐없이 대응합니다. 문서 끝에 "요구사항 대응표"(요구사항 ID / 요구사항 / 제안 내용 / 해당 장 / 대응 수준[충족·초과]) 표를 반드시 넣습니다.
- 마지막 장으로 "추가 제언"을 넣어, 요구사항 외에 발주처에 가치를 더할 수 있는 제안(고도화 방향, 운영 효율화, 리스크 예방, 유지관리 등)을 제시합니다.

인포그래픽 (적극 사용)
- 표: 마크다운 표로 비교·일정·인력·산출물 등을 정리합니다.
- 다이어그램: \`\`\`mermaid 코드 블록을 씁니다. 시스템 구성도·업무 흐름(flowchart), 추진 조직(flowchart TD), 추진 일정(gantt), 단계별 방법론 등에 사용합니다.
  mermaid 규칙: 노드 글자는 반드시 큰따옴표로 감쌉니다(예: A["데이터 수집"] --> B["분석"]). gantt 의 dateFormat 은 YYYY-MM-DD, 작업명에 콜론(:)을 쓰지 않습니다.
- 차트: \`\`\`chart 코드 블록에 JSON 한 개를 씁니다.
  형식: {"type":"bar"|"line"|"pie"|"radar","title":"제목","xKey":"name","series":[{"key":"value","name":"계열명"}],"data":[{"name":"항목","value":10}]}
  pie 는 data 의 name/value 만 사용합니다. 기대효과(개선 전후 비교), 인력 투입 비율, 평가항목 배점 비중, 품질 목표 등에 사용합니다.
- 장마다 최소 1개 이상의 표·다이어그램·차트를 넣되, 근거 없는 수치를 지어내지 말고 예시 수치는 "(예시)"로 표시합니다.

사실 정보
- 당사 실적·인력·인증 등 사실 정보는 제공된 당사 자료에서만 인용합니다. 자료가 없는 부분은 지어내지 말고 【작성 필요: 무엇을 넣어야 하는지】로 표시합니다.
- 공공 제안서 문체(개조식, 명확한 수치와 근거)로 작성합니다.`;

export async function draftProposal(
  env: Env,
  bid: Bid,
  analysis: AnalysisResult | null,
  instructions: string,
  emit: Emit,
): Promise<string> {
  emit({ type: "status", message: "자료 불러오는 중…" });
  const content: BetaContentBlockParam[] = [
    ...(await companyBlocks(env)),
    ...(await bidBlocks(env, bid)),
  ];
  if (analysis) {
    content.push({ type: "text", text: `<prior_analysis>\n${JSON.stringify(analysis)}\n</prior_analysis>` });
  }
  content.push({
    type: "text",
    text: `위 입찰의 기술제안서 초안을 작성하세요.${instructions ? `\n\n추가 지시사항:\n${instructions}` : ""}`,
  });
  emit({ type: "status", message: "제안서 초안 작성 중…" });

  const stream = client(env).beta.messages.stream({
    model: env.CLAUDE_MODEL,
    max_tokens: 100000,
    betas: BETAS,
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    system: PROPOSAL_SYSTEM,
    messages: [{ role: "user", content }],
  });
  stream.on("text", (t) => emit({ type: "delta", text: t }));
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("Claude 가 이 요청에 대한 응답을 거부했습니다.");
  const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  if (msg.stop_reason === "max_tokens") return `${text}\n\n【출력 한도로 여기서 중단됨 — 이어서 작성 필요】`;
  return text;
}

export async function extractProfile(env: Env, emit: Emit) {
  emit({ type: "status", message: "회사 서류 읽는 중…" });
  const content: BetaContentBlockParam[] = [
    ...(await companyBlocks(env)),
    {
      type: "text",
      text: "위 당사 서류에서 회사 프로필 항목을 추출하세요. 서류에 없는 값은 빈 문자열(숫자는 null)로 두세요. 업종/면허, 인증, 기술인력, 실적은 항목마다 줄바꿈으로 구분하고 실적은 '사업명 / 발주처 / 금액 / 기간' 형식으로 적으세요. 지역(region)은 시·도 단위로 적으세요.",
    },
  ];
  emit({ type: "status", message: "Claude 추출 중…" });
  const stream = client(env).beta.messages.stream({
    model: env.CLAUDE_MODEL,
    max_tokens: 32000,
    betas: BETAS,
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: betaZodOutputFormat(ProfileExtractSchema) },
    messages: [{ role: "user", content }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("Claude 가 이 요청에 대한 응답을 거부했습니다.");
  if (!msg.parsed_output) throw new Error("추출 결과를 해석하지 못했습니다.");
  return msg.parsed_output;
}
