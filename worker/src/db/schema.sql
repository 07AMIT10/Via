CREATE TABLE IF NOT EXISTS problems (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  day_number INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  difficulty TEXT CHECK (difficulty IN ('easy','medium','hard')) NOT NULL,
  pattern TEXT NOT NULL,
  topic TEXT NOT NULL,
  constraints TEXT,
  examples_json TEXT,
  key_insight TEXT,
  applications_json TEXT,
  variations_json TEXT,
  why_it_matters TEXT,
  canonical_approach TEXT,
  canonical_solutions_json TEXT,
  hints_json TEXT,
  complexity TEXT,
  test_cases_json TEXT NOT NULL,
  license TEXT NOT NULL DEFAULT 'MIT',
  source_url TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_problems_day ON problems(day_number);
CREATE INDEX IF NOT EXISTS idx_problems_topic ON problems(topic, pattern);

CREATE TABLE IF NOT EXISTS subscribers (
  telegram_id INTEGER PRIMARY KEY,
  chat_id INTEGER NOT NULL,
  username TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  current_day INTEGER NOT NULL DEFAULT 1,
  tz_offset_min INTEGER NOT NULL DEFAULT 330,
  preferred_language TEXT CHECK (preferred_language IN ('python', 'go', 'rust')) DEFAULT 'python',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS user_progress (
  telegram_id INTEGER NOT NULL,
  problem_id INTEGER NOT NULL,
  status TEXT CHECK (status IN ('delivered','read','attempted','solved','skipped')) NOT NULL,
  language TEXT CHECK (language IN ('python','go','rust')),
  last_code TEXT,
  last_stdout TEXT,
  last_stderr TEXT,
  time_taken_ms INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  hints_used INTEGER NOT NULL DEFAULT 0,
  approach_shown INTEGER NOT NULL DEFAULT 0,
  recap_sent_at INTEGER,
  last_attempt INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (telegram_id, problem_id)
);
CREATE INDEX IF NOT EXISTS idx_progress_user ON user_progress(telegram_id, last_attempt DESC);
CREATE INDEX IF NOT EXISTS idx_progress_recap ON user_progress(recap_sent_at);

CREATE TABLE IF NOT EXISTS submissions_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER NOT NULL,
  problem_id INTEGER NOT NULL,
  language TEXT NOT NULL,
  judge0_token TEXT,
  verdict TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
