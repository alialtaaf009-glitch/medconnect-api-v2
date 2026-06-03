// src/db.js — Postgres (Neon) connection pool + schema bootstrap
import pg from 'pg';

const { Pool } = pg;

// Neon (and most hosted Postgres) require SSL.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Thin helper so route code reads naturally: const { rows } = await query(sql, params)
export function query(text, params) {
  return pool.query(text, params);
}

// Create tables on first boot if they don't exist.
export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name          TEXT NOT NULL,
      gender        TEXT NOT NULL CHECK (gender IN ('Male','Female')),
      country       TEXT,
      timezone      TEXT DEFAULT 'UTC+0',
      exam          TEXT,
      step          TEXT,
      level         TEXT,
      exam_date     TEXT,
      bio           TEXT,
      verified      INTEGER DEFAULT 0,
      created_at    TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS connections (
      id          SERIAL PRIMARY KEY,
      requester   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
      created_at  TIMESTAMPTZ DEFAULT now(),
      UNIQUE (requester, recipient)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id          SERIAL PRIMARY KEY,
      sender      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body        TEXT NOT NULL,
      read_at     TIMESTAMPTZ,
      created_at  TIMESTAMPTZ DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_users_exam     ON users(exam, step);
    CREATE INDEX IF NOT EXISTS idx_msg_pair       ON messages(sender, recipient);
    CREATE INDEX IF NOT EXISTS idx_conn_recipient ON connections(recipient, status);
  `);
}

export default pool;
