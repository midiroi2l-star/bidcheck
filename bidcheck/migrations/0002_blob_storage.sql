-- R2 없이 D1 만으로 첨부파일·회사 서류를 저장하기 위한 테이블 (1.8MB 단위 조각 저장)
CREATE TABLE blobs (
  key TEXT PRIMARY KEY,
  size INTEGER NOT NULL,
  content_type TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE blob_chunks (
  key TEXT NOT NULL,
  part INTEGER NOT NULL,
  data BLOB NOT NULL,
  PRIMARY KEY (key, part)
);
