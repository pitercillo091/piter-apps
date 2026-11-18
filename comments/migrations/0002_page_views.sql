CREATE TABLE IF NOT EXISTS page_views (
  day TEXT PRIMARY KEY CHECK(length(day) = 10),
  views INTEGER NOT NULL DEFAULT 0 CHECK(views >= 0)
);
