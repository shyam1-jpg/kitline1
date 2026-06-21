-- Kitline Academy — Neon Postgres schema
-- Run once in Neon SQL editor or: psql $DATABASE_URL -f server/academy/schema.sql

CREATE TABLE IF NOT EXISTS academy_users (
  email TEXT PRIMARY KEY,
  profile JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS academy_sessions (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL REFERENCES academy_users(email) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  last_used TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS academy_sessions_email ON academy_sessions(email);

CREATE TABLE IF NOT EXISTS academy_enrollments (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  course_title TEXT NOT NULL,
  amount_pence INT DEFAULT 0,
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  stripe_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS academy_enrollments_email ON academy_enrollments(email);

CREATE TABLE IF NOT EXISTS academy_email_verifications (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS academy_password_resets (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
