# MedConnect API — Postgres / Neon edition

Backend for MedConnect, using hosted Postgres (Neon) so it runs on card-free hosts like Vercel.

## What changed from the SQLite version
- Database is now **Postgres** (via the `pg` library) instead of a local SQLite file.
- Connects to whatever `DATABASE_URL` you provide (your Neon connection string).
- Tables are created automatically on first request.
- Ships with `vercel.json` so it deploys on Vercel as-is.

## Environment variables (set these on your host)
- `DATABASE_URL` — your Neon Postgres connection string (required).
- `JWT_SECRET`  — any long random string (required; keeps logins secure).

## Endpoints (unchanged)
Register/login, profile (`/api/me`), partner search (`/api/partners`),
connections, and messaging — same shapes the front-end already expects.

## Local run (optional, needs a Postgres URL)
```
npm install
DATABASE_URL="postgres://..." JWT_SECRET="dev" npm start
npm run seed   # adds demo doctors (login: <seed email> / password123)
```
