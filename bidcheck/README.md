# BidCheck — 나라장터 입찰 분석 웹

기존에 Claude 프로젝트에서 손으로 하던 작업을 하나의 웹으로 옮긴 것입니다:
공고 확인 → 제안요청서·공고문(HWP) 내려받기 → 분석 → 엑셀 정리 → 최근 엑셀 재등록

| 기존 수작업 | BidCheck |
| --- | --- |
| 나라장터에서 공고 찾기 | **공고 검색**: 조달청 Open API 로 용역·물품·공사 공고 조회, 공고번호로 바로 등록 |
| HWP 첨부 직접 다운로드 | **나라장터 첨부 자동 가져오기** (실패 시 드래그&드롭 업로드) — HWP·HWPX·PDF·DOCX·XLSX 내용 자동 추출 |
| Claude 에 문서 올려 분석 | **AI 분석**: 참가자격 충족 여부, 신인도·경영상태 예상점수, 기술·가격 예상 총점, 적합도(0~100), 유의사항, 제출서류 체크리스트, 검토 의견서 |
| 엑셀 파일 만들기 / 최근 엑셀 재등록 | **DB(D1)에 자동 누적** + 히스토리 기록, 언제든 **엑셀 다운로드**(관심입찰·자격요건·신인도·유의사항·제출서류 5개 시트). 기존 엑셀은 **가져오기**로 한 번에 이관 |
| 제안서 수기 작성 | **입찰 진행으로 승격**하면 제안서 초안 자동 작성 (제안요청서 목차·평가배점 반영, Word/MD 다운로드, 버전 관리) |

## 사용 흐름

1. **회사 정보·서류**: 체크리스트의 서류(사업자등록증, 경쟁입찰참가자격 등록증, 신용평가등급확인서, 실적증명서, 인증서 등)를 올리고 **서류에서 프로필 자동 채우기** → 확인 후 저장.
   서류가 많을수록 자격·신인도 판정이 정확해지며, 분석 결과에 "등록이 필요한 당사 서류" 가 표시됩니다.
2. **공고 검색** → 관심 등록 (관심 입찰 히스토리 시작)
3. 입찰 상세 → **첨부파일**: 나라장터 첨부 자동 가져오기 또는 직접 업로드
4. **AI 분석** 실행 → 적합도·자격·신인도·점수·의견서 확인 (재분석 시 이력 누적)
5. **입찰 진행으로 승격** → 제안서 초안 자동 작성 → 편집 → Word 다운로드
6. 제출/낙찰/탈락/포기 상태 관리, **엑셀 다운로드**로 보고

## 구조

```
bidcheck/
├─ worker/          Cloudflare Worker API (Hono)
│  ├─ index.ts      라우트: 공고검색, 관심입찰, 첨부, 분석, 제안서, 회사정보, 히스토리
│  ├─ g2b.ts        조달청 나라장터 입찰공고정보서비스 연동
│  └─ claude.ts     Claude API (분석·제안서·프로필 추출)
├─ shared/types.ts  공용 타입, 분석 결과 스키마(zod)
├─ migrations/      D1 스키마
└─ src/             React 화면 (HWP/HWPX/DOCX 텍스트 추출, 엑셀·Word 생성은 브라우저에서 처리)
```

- 저장소: **D1**(입찰·분석·제안서·히스토리), **R2**(원본 첨부파일·회사 서류)
- PDF 는 원본을 그대로 Claude 에 전달하고, HWP 등은 브라우저에서 텍스트를 추출해 함께 저장합니다.
  *배포용(읽기전용)·암호 HWP* 는 텍스트 추출이 안 되므로 한글에서 PDF 로 저장해 올리세요.
- AI 모델: `claude-opus-5-5` (`wrangler.jsonc` 의 `CLAUDE_MODEL` 로 변경 가능). 응답 거부 시 서버 측 자동 대체 모델(fallback)을 사용합니다.

## 배포 (Cloudflare)

### 1. 준비물
- **공공데이터포털 인증키**: data.go.kr 에서 `조달청_나라장터 입찰공고정보서비스` 활용신청 → 일반 인증키(Decoding)
- **Claude API 키**: console.anthropic.com
- Cloudflare 계정 (D1·R2 사용)

### 2. 최초 1회 설정
```bash
cd bidcheck
npm install
npx wrangler login
npx wrangler d1 create bidcheck            # 출력된 database_id 를 wrangler.jsonc 에 붙여넣기
npx wrangler r2 bucket create bidcheck-files
npm run db:migrate:remote

npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put G2B_SERVICE_KEY
npx wrangler secret put APP_PASSWORD       # 사내 공유용 접속 비밀번호 (강력히 권장)

npm run deploy                             # https://bidcheck.<계정>.workers.dev
```

### 3. 자동 배포 (권장 — 로컬 설치 없이 GitHub 에서 전부 처리)
GitHub 저장소 **Settings → Secrets and variables → Actions → New repository secret** 에 등록:

| 이름 | 값 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API 토큰 ("Edit Cloudflare Workers" 템플릿 + **D1 Edit** 권한 추가) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 대시보드 우측의 Account ID |
| `ANTHROPIC_API_KEY` | Claude API 키 |
| `G2B_SERVICE_KEY` | 공공데이터포털 인증키(Decoding) |
| `APP_PASSWORD` | 웹 접속 비밀번호 |

그 다음 **Actions → Deploy BidCheck (Cloudflare) → Run workflow** 를 누르면
D1·R2 생성 → DB 마이그레이션 → 배포 → 비밀값 등록까지 자동으로 진행되고, 실행 결과 요약(Summary)에 접속 주소가 표시됩니다.
이후에는 `bidcheck/` 를 수정해 push 할 때마다 자동 배포됩니다.

> 보안: `APP_PASSWORD` 를 설정하지 않으면 URL 을 아는 누구나 접근할 수 있습니다. 더 강하게 막으려면 Cloudflare Zero Trust **Access** 로 회사 이메일만 허용하세요.

## 로컬 개발
```bash
cp .dev.vars.example .dev.vars   # 키 입력
npm run db:migrate:local
npm run dev                      # http://localhost:5173 (D1·R2 는 로컬 에뮬레이션)
```

## 참고 및 한계
- 나라장터 API 는 `https://apis.data.go.kr/1230000/ad/BidPublicInfoService` 의 `getBidPblancListInfo{Servc|Thng|Cnstwk|Frgcpt}PPSSrch` 를 사용합니다. 조달청이 주소를 바꾸면 `G2B_API_BASE` 만 수정하세요.
- 나라장터 첨부 링크는 세션이 필요한 경우가 있어 자동 가져오기가 실패할 수 있습니다. 이때는 링크에서 받아 업로드하면 됩니다.
- 점수·판정은 제공된 문서와 회사 자료에 근거한 **AI 추정치**입니다. 최종 판단은 공고 원문으로 확인하세요.
