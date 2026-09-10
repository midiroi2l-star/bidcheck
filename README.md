# 여수 스마트 산업단지 통합 안전관리 플랫폼

제안요청서(여수 스마트 산업단지 통합 안전관리 플랫폼 개발) 요구사항을 기반으로 제작한 프런트엔드 데모입니다.
모든 연동 데이터(디지털트윈, AI 안전예측, 공공데이터, 수요기업 센서 등)는 더미 데이터로 구성되어 있습니다.

## 기술 스택

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- React Router
- Recharts (차트), Lucide React (아이콘)

## 실행 방법

```bash
npm install
npm run dev       # 개발 서버 실행
npm run build     # 프로덕션 빌드
```

## 주요 화면 (요구사항 매핑)

GitHub Pages 배포를 위해 해시 라우팅(`HashRouter`)을 사용합니다. 실제 접속 시 경로 앞에 `#`이 붙습니다 (예: `/#/map`).

| 화면 | 경로 | 관련 요구사항 |
| --- | --- | --- |
| 종합 대시보드 | `#/` | SFR-003 |
| 산업단지 맵 | `#/map` | SFR-004, SFR-005 |
| 연동 시스템 상태 | `#/monitoring` | SFR-002, SFR-014 |
| 이상감지·경보관리 | `#/alarms` | SFR-010, SFR-011 |
| 공공데이터 연계 | `#/public-data` | SFR-004, SFR-006 |
| 안전 리포트 | `#/reports` | SFR-009 |
| 수요기업 관리 | `#/tenants` | SFR-012 |
| 설비·센서 관리 | `#/equipment` | SFR-013 |
| 사용자·권한 관리 | `#/users` | SFR-007, SFR-008 |
| 운영정보 로그 | `#/logs` | SFR-015 |

더미 데이터 생성 로직은 `src/data/` 디렉터리에 있습니다.

## GitHub Pages 배포 (현재 사용 중)

`.github/workflows/deploy-pages.yml`이 `claude/web-app-development-rfp-y34t08` 또는 `main` 브랜치에 푸시될 때마다 자동으로 빌드·배포합니다.

**최초 1회만 저장소 설정이 필요합니다** (저장소 관리자 권한 필요, Claude가 대신 클릭할 수 없는 유일한 단계):

1. GitHub 저장소 → **Settings** → **Pages**
2. **Build and deployment** → **Source**를 `GitHub Actions`로 변경 후 저장

이후 이 브랜치에 커밋이 푸시되면 Actions 탭에서 `Deploy to GitHub Pages` 워크플로우가 자동 실행되고, 완료되면 다음 주소에서 접속 가능합니다.

```
https://midiroi2l-star.github.io/bidcheck/
```

배포 진행 상황은 저장소 **Actions** 탭에서 확인할 수 있습니다.

## Cloudflare Pages 배포 (대안)

GitHub Pages 대신 Cloudflare Pages를 사용하려면:

1. Cloudflare 대시보드 → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
2. 저장소로 `midiroi2l-star/bidcheck` 선택, 배포 브랜치로 `claude/web-app-development-rfp-y34t08` 지정
3. 빌드 설정: Framework preset `Vite`, Build command `npm run build`, Build output directory `dist`
4. 배포 후 `https://<project-name>.pages.dev` 주소가 발급되며 **Custom domains**에서 고객사 도메인 연결 가능

SPA 라우팅 fallback용 `public/_redirects` 파일이 포함되어 있어 Cloudflare Pages로 전환해도 즉시 동작합니다.

### D1 데이터베이스 연동 (선택, Cloudflare Pages 사용 시)

현재는 모든 데이터가 프런트엔드 더미 데이터입니다. 실제 DB 연동이 필요하면:

1. Cloudflare 대시보드에서 D1 데이터베이스 생성
2. Pages 프로젝트 설정 → **Functions** → **D1 database bindings**에서 바인딩 추가
3. `functions/` 디렉터리에 Pages Functions(API 라우트)를 추가하고 `src/data/`의 더미 데이터 호출부를 실제 API 호출로 교체

이 작업은 스키마 설계가 필요하므로 별도 요청 시 진행합니다.
