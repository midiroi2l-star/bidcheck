-- 웹 화면(초기 설정/설정)에서 입력한 API 키와 접속 비밀번호(해시) 저장
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
