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

| 화면 | 경로 | 관련 요구사항 |
| --- | --- | --- |
| 종합 대시보드 | `/` | SFR-003 |
| 산업단지 맵 | `/map` | SFR-004, SFR-005 |
| 연동 시스템 상태 | `/monitoring` | SFR-002, SFR-014 |
| 이상감지·경보관리 | `/alarms` | SFR-010, SFR-011 |
| 공공데이터 연계 | `/public-data` | SFR-004, SFR-006 |
| 안전 리포트 | `/reports` | SFR-009 |
| 수요기업 관리 | `/tenants` | SFR-012 |
| 설비·센서 관리 | `/equipment` | SFR-013 |
| 사용자·권한 관리 | `/users` | SFR-007, SFR-008 |
| 운영정보 로그 | `/logs` | SFR-015 |

더미 데이터 생성 로직은 `src/data/` 디렉터리에 있습니다.
