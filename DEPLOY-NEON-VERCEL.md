# Deploy the backend — Neon + Vercel (no credit card)

This replaces the old Render steps. Two free services, neither asks for a card:
- **Neon** = your database (the memory).
- **Vercel** = runs your backend code (the brain).

Do these in order.

---

## STEP 1 — Create the database on Neon

1. Go to **neon.tech** → **Sign up** → choose **Continue with GitHub** (no card asked).
2. It creates a project for you (or tap **New Project**). Name it `medconnect`, pick any region near you, tap **Create**.
3. After it's made, Neon shows a **Connection string** — a long line starting with
   `postgresql://...`. There's usually a **Copy** button. Copy it.
   - If you see options, pick the **"Pooled connection"** string if offered (better for serverless). Either works to start.
4. Paste that string somewhere safe for a minute — you'll need it in Step 3.

✅ You now have a database and its connection string.

---

## STEP 2 — Put the new backend code on GitHub

Your old repo used SQLite. This new `medconnect-api` uses Postgres. Update the repo:

**Easiest:** delete the old repo contents and upload the new folder's contents.
1. On github.com, open your `medconnect-api` repo → **Settings** → scroll down →
   **Delete this repository** (or just replace the files — see below).
2. Make a fresh repo named `medconnect-api`, then **upload files**:
   - Upload `package.json`, `vercel.json`, `README.md`, and the `src` folder
     (with its 5 `.js` files) — same "put files in src/" rule as before.
   - The repo top level should show: `package.json`, `vercel.json`, `README.md`, `src/`.

(If renaming feels easier than deleting, you can instead edit the 4 changed files —
`package.json`, `src/db.js`, `src/server.js`, `src/seed.js` — and add `vercel.json`.
But a clean re-upload is simpler.)

✅ Repo has the new Postgres code with `vercel.json` at the top.

---

## STEP 3 — Deploy on Vercel

1. Go to **vercel.com** → **Sign up** → **Continue with GitHub** (no card).
2. On your dashboard tap **Add New… → Project**.
3. It lists your GitHub repos. Find **medconnect-api** → tap **Import**.
4. Before deploying, open **Environment Variables** and add two:
   - Name `DATABASE_URL`  → Value: paste your Neon connection string from Step 1.
   - Name `JWT_SECRET`    → Value: mash the keyboard, 30+ random characters.
5. Tap **Deploy**. Wait ~1 minute.
6. Vercel gives you a URL like `https://medconnect-api-xxxx.vercel.app`.
   **Copy it.**

### Test it
Open in your browser: `https://medconnect-api-xxxx.vercel.app/api/health`
You should see `{"ok":true}`. 🎉 Backend is live.

---

## STEP 4 — Add demo doctors (optional)

Vercel doesn't give an easy "shell," so seed from your own phone/computer instead,
OR just sign up real accounts to test. To seed:
- Easiest path: skip seeding and simply **sign up 2 accounts** in the app to test
  matching. (Recommended — no tools needed.)
- Advanced: clone the repo locally and run
  `DATABASE_URL="<neon string>" npm run seed`.

---

## STEP 5 — Point the app at it

In the `medconnect` (frontend) folder, edit `index.html`:
```
const API_BASE = "";
```
→
```
const API_BASE = "https://medconnect-api-xxxx.vercel.app";
```
Bump `CACHE` in `sw.js` (e.g. v6 → v7). Redeploy the `medconnect` folder to Netlify.

Open your Netlify URL on your phone → you should see the **login screen** → sign up
→ you're live and multi-user.

Then build the APK with PWABuilder exactly as in BUILD-APK.md (paste your Netlify URL).

---

## If something breaks
- `/api/health` errors → check both env vars are set on Vercel and the Neon string
  was pasted complete (they're long; easy to cut off).
- "DB init failed" → the `DATABASE_URL` is wrong or missing. Re-copy from Neon.
- App still shows demo (no login) → `API_BASE` wasn't saved, or Netlify wasn't
  redeployed after the change.
- Empty partners list → sign up a second account (different email) to see matching.
EOF
echo done
