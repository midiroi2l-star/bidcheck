-- 사용자 계정 (관리자 화면에서 등록)
CREATE TABLE users (
  id TEXT PRIMARY KEY,                 -- 로그인 아이디
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',   -- admin / user
  pw_hash TEXT NOT NULL,
  pw_salt TEXT NOT NULL,
  must_change INTEGER NOT NULL DEFAULT 0, -- 임시 비밀번호로 로그인한 경우 변경 강제
  active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_users_email ON users(lower(email));

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- 검색으로 조회한 나라장터 공고 캐시 (웹 내 상세 화면용)
CREATE TABLE notices (
  id TEXT PRIMARY KEY,                 -- 공고번호-차수
  bid_no TEXT NOT NULL,
  category TEXT,
  title TEXT NOT NULL,
  close_dt TEXT,
  data TEXT NOT NULL,                  -- 정규화된 공고 JSON
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notices_bidno ON notices(bid_no);

-- 입찰 담당자·서류 체크리스트
ALTER TABLE bids ADD COLUMN assignee TEXT;
ALTER TABLE bids ADD COLUMN checklist TEXT;      -- {"서류명": true, ...}
ALTER TABLE history ADD COLUMN user_id TEXT;

-- 입찰별 팀 코멘트
CREATE TABLE bid_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bid_id TEXT NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  user_id TEXT,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_comments_bid ON bid_comments(bid_id, id);

-- 저장한 검색 조건 (매일 자동 검색 → 추천 공고)
CREATE TABLE saved_searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '용역',
  keyword TEXT,
  org TEXT,
  min_amount INTEGER,
  max_amount INTEGER,
  created_by TEXT,
  last_run_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 자동 검색으로 찾은 추천 공고
CREATE TABLE recommendations (
  notice_id TEXT NOT NULL,
  search_id INTEGER NOT NULL,
  dismissed INTEGER NOT NULL DEFAULT 0,
  found_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (notice_id, search_id)
);
