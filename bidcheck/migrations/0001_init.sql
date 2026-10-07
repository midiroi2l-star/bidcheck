-- 회사 프로필 (단일 행)
CREATE TABLE company_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO company_profile (id, data) VALUES (1, '{}');

-- 회사 서류함 (사업자등록증, 신용평가등급확인서, 실적증명서 등)
CREATE TABLE company_docs (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime TEXT,
  size INTEGER,
  r2_key TEXT NOT NULL,
  has_text INTEGER NOT NULL DEFAULT 0,
  valid_until TEXT,
  memo TEXT,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 관심/진행 입찰
-- status: interest(관심) → analyzed(분석완료) → in_progress(입찰진행) → submitted(제출) → won/lost(낙찰/탈락) | dropped(포기)
CREATE TABLE bids (
  id TEXT PRIMARY KEY,               -- 공고번호-차수
  bid_no TEXT NOT NULL,
  bid_ord TEXT NOT NULL DEFAULT '000',
  category TEXT,                     -- 용역/물품/공사/외자
  title TEXT NOT NULL,
  org TEXT,                          -- 공고기관
  demand_org TEXT,                   -- 수요기관
  notice_dt TEXT,
  close_dt TEXT,                     -- 입찰마감
  open_dt TEXT,                      -- 개찰
  est_price INTEGER,                 -- 추정가격
  budget INTEGER,                    -- 배정예산
  contract_method TEXT,
  award_method TEXT,
  detail_url TEXT,
  raw_json TEXT,
  status TEXT NOT NULL DEFAULT 'interest',
  fit_score INTEGER,
  recommendation TEXT,
  memo TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_bids_status ON bids(status);
CREATE INDEX idx_bids_close ON bids(close_dt);

-- 입찰별 첨부파일 (제안요청서, 입찰공고문, 과업지시서 등)
CREATE TABLE bid_files (
  id TEXT PRIMARY KEY,
  bid_id TEXT NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'other', -- notice/rfp/spec/form/other
  filename TEXT NOT NULL,
  mime TEXT,
  size INTEGER,
  r2_key TEXT NOT NULL,
  source_url TEXT,
  has_text INTEGER NOT NULL DEFAULT 0,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_bid_files_bid ON bid_files(bid_id);

-- AI 분석 결과 (재분석 시 누적)
CREATE TABLE analyses (
  id TEXT PRIMARY KEY,
  bid_id TEXT NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  model TEXT,
  fit_score INTEGER,
  recommendation TEXT,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_analyses_bid ON analyses(bid_id, created_at);

-- 제안서 초안 (버전 누적)
CREATE TABLE proposals (
  id TEXT PRIMARY KEY,
  bid_id TEXT NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content_md TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_proposals_bid ON proposals(bid_id, version);

-- 히스토리 로그
CREATE TABLE history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bid_id TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_history_bid ON history(bid_id, at);
