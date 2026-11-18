CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 40),
  message TEXT NOT NULL CHECK(length(message) BETWEEN 5 AND 600),
  created TEXT NOT NULL,
  approved INTEGER NOT NULL DEFAULT 0 CHECK(approved IN (0,1))
);
CREATE INDEX IF NOT EXISTS comments_public ON comments(approved, id DESC);
CREATE TABLE IF NOT EXISTS limits (
  visitor TEXT PRIMARY KEY,
  expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS limits_expires ON limits(expires);
