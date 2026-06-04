// src/server.js — MedConnect REST API (Postgres / Neon)
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { query, initSchema } from './db.js';
import { signToken, requireAuth } from './auth.js';
import { matchScore, matchLabel } from './match.js';

const app = express();
app.use(cors());
app.use(express.json());

// Ensure tables exist once, lazily — runs before any route. Safe for serverless.
let schemaReady = null;
app.use((req, res, next) => {
  if (!schemaReady) schemaReady = initSchema().catch((e) => { schemaReady = null; throw e; });
  schemaReady.then(() => next()).catch((e) => res.status(500).json({ error: 'DB init failed: ' + e.message }));
});

// Columns safe to expose about other users (never password_hash).
const PUBLIC = 'id, name, gender, country, timezone, exam, step, level, exam_date, bio, institution, verified';

/* ---------------------------------- AUTH ---------------------------------- */

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, gender } = req.body || {};
    if (!email || !password || !name || !gender)
      return res.status(400).json({ error: 'email, password, name, gender are required' });
    if (!['Male', 'Female'].includes(gender))
      return res.status(400).json({ error: 'gender must be Male or Female' });

    const exists = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length) return res.status(409).json({ error: 'Email already registered' });

    const hash = bcrypt.hashSync(password, 10);
    const ins = await query(
      `INSERT INTO users (email, password_hash, name, gender) VALUES ($1,$2,$3,$4) RETURNING ${PUBLIC}`,
      [email, hash, name, gender]
    );
    const user = ins.rows[0];
    res.status(201).json({ token: signToken({ id: user.id, email }), user });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const r = await query('SELECT * FROM users WHERE email = $1', [email]);
    const row = r.rows[0];
    if (!row || !bcrypt.compareSync(password || '', row.password_hash))
      return res.status(401).json({ error: 'Invalid credentials' });
    const { password_hash, ...user } = row;
    res.json({ token: signToken(row), user });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* --------------------------------- PROFILE -------------------------------- */

app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const r = await query(`SELECT ${PUBLIC}, email FROM users WHERE id = $1`, [req.user.id]);
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/me', requireAuth, async (req, res) => {
  try {
    const allowed = ['name', 'country', 'timezone', 'exam', 'step', 'level', 'exam_date', 'bio', 'institution'];
    const keys = allowed.filter((k) => k in (req.body || {}));
    if (!keys.length) return res.status(400).json({ error: 'No updatable fields provided' });

    const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const vals = keys.map((k) => req.body[k]);
    vals.push(req.user.id);
    await query(`UPDATE users SET ${sets} WHERE id = $${vals.length}`, vals);

    const r = await query(`SELECT ${PUBLIC} FROM users WHERE id = $1`, [req.user.id]);
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* -------------------------------- PARTNERS -------------------------------- */

app.get('/api/partners', requireAuth, async (req, res) => {
  try {
    const meR = await query(`SELECT ${PUBLIC} FROM users WHERE id = $1`, [req.user.id]);
    const me = meR.rows[0];
    const { exam, step, level, gender } = req.query;

    const clauses = ['id <> $1'];
    const params = [req.user.id];
    if (exam) { params.push(exam); clauses.push(`exam = $${params.length}`); }
    if (step) { params.push(step); clauses.push(`step = $${params.length}`); }
    if (level) { params.push(level); clauses.push(`level = $${params.length}`); }
    if (gender) { params.push(gender); clauses.push(`gender = $${params.length}`); }
    // Hide anyone I've blocked, or who has blocked me.
    clauses.push(`id NOT IN (SELECT blocked FROM blocks WHERE blocker = $1)`);
    clauses.push(`id NOT IN (SELECT blocker FROM blocks WHERE blocked = $1)`);

    const rowsR = await query(`SELECT ${PUBLIC} FROM users WHERE ${clauses.join(' AND ')}`, params);

    const connR = await query(
      `SELECT id, requester, recipient, status FROM connections WHERE requester = $1 OR recipient = $1`,
      [req.user.id]
    );
    const connFor = (otherId) => {
      const c = connR.rows.find((x) => x.requester === otherId || x.recipient === otherId);
      if (!c) return { connection_status: 'none', connection_id: null, incoming: false };
      return {
        connection_status: c.status,
        connection_id: c.id,
        // incoming = the other person sent ME the request and it's still pending
        incoming: c.status === 'pending' && c.recipient === req.user.id,
      };
    };

    const scored = rowsR.rows
      .map((p) => {
        const score = matchScore(me, p);
        return { ...p, match_score: score, match_label: matchLabel(score), ...connFor(p.id) };
      })
      .sort((a, b) => b.match_score - a.match_score);

    res.json(scored);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ----------------------- PENDING INCOMING REQUESTS ------------------------ */
// Requests other doctors have sent to ME that I haven't accepted/declined yet.
app.get('/api/requests', requireAuth, async (req, res) => {
  try {
    const cols = PUBLIC.split(', ').map((f) => 'u.' + f).join(', ');
    const r = await query(`
      SELECT c.id AS connection_id, ${cols}
      FROM connections c
      JOIN users u ON u.id = c.requester
      WHERE c.recipient = $1 AND c.status = 'pending'
      ORDER BY c.created_at DESC
    `, [req.user.id]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ------------------------------ CONNECTIONS ------------------------------- */

app.post('/api/connections', requireAuth, async (req, res) => {
  try {
    const { recipient } = req.body || {};
    if (!recipient || Number(recipient) === req.user.id)
      return res.status(400).json({ error: 'Valid recipient required' });

    const t = await query('SELECT id FROM users WHERE id = $1', [recipient]);
    if (!t.rows.length) return res.status(404).json({ error: 'User not found' });

    try {
      await query('INSERT INTO connections (requester, recipient) VALUES ($1,$2)', [req.user.id, recipient]);
    } catch {
      return res.status(409).json({ error: 'Connection already requested' });
    }
    res.status(201).json({ ok: true, status: 'pending' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/connections/:id/respond', requireAuth, async (req, res) => {
  try {
    const { action } = req.body || {};
    const status = action === 'accept' ? 'accepted' : 'declined';
    const c = await query('SELECT * FROM connections WHERE id = $1', [req.params.id]);
    if (!c.rows.length || c.rows[0].recipient !== req.user.id)
      return res.status(404).json({ error: 'Connection request not found' });
    await query('UPDATE connections SET status = $1 WHERE id = $2', [status, c.rows[0].id]);
    res.json({ ok: true, status });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/connections', requireAuth, async (req, res) => {
  try {
    const cols = PUBLIC.split(', ').map((f) => 'u.' + f).join(', ');
    const r = await query(`
      SELECT ${cols}
      FROM connections c
      JOIN users u ON u.id = CASE WHEN c.requester = $1 THEN c.recipient ELSE c.requester END
      WHERE (c.requester = $1 OR c.recipient = $1) AND c.status = 'accepted'
    `, [req.user.id]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* -------------------------------- MESSAGES -------------------------------- */

app.get('/api/messages/:userId', requireAuth, async (req, res) => {
  try {
    const other = Number(req.params.userId);
    const r = await query(`
      SELECT id, sender, recipient, body,
             to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
      FROM messages
      WHERE (sender = $1 AND recipient = $2) OR (sender = $2 AND recipient = $1)
      ORDER BY created_at ASC
    `, [req.user.id, other]);
    await query(
      `UPDATE messages SET read_at = now() WHERE recipient = $1 AND sender = $2 AND read_at IS NULL`,
      [req.user.id, other]
    );
    res.json(r.rows.map((m) => ({ ...m, mine: m.sender === req.user.id })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/messages/:userId', requireAuth, async (req, res) => {
  try {
    const other = Number(req.params.userId);
    const { body } = req.body || {};
    if (!body || !body.trim()) return res.status(400).json({ error: 'Message body required' });

    const ok = await query(`
      SELECT 1 FROM connections
      WHERE status = 'accepted'
        AND ((requester = $1 AND recipient = $2) OR (requester = $2 AND recipient = $1))
    `, [req.user.id, other]);
    if (!ok.rows.length) return res.status(403).json({ error: 'You can only message accepted connections' });

    const ins = await query(
      `INSERT INTO messages (sender, recipient, body) VALUES ($1,$2,$3)
       RETURNING id, sender, recipient, body,
         to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at`,
      [req.user.id, other, body.trim()]
    );
    res.status(201).json({ ...ins.rows[0], mine: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Count of unread incoming messages (used for the Messages badge).
app.get('/api/unread', requireAuth, async (req, res) => {
  try {
    const r = await query(
      `SELECT COUNT(*)::int AS n FROM messages WHERE recipient = $1 AND read_at IS NULL`,
      [req.user.id]
    );
    res.json({ unread: r.rows[0].n });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* --------------------------- REPORT / BLOCK ------------------------------- */

app.post('/api/report', requireAuth, async (req, res) => {
  try {
    const { reported, reason } = req.body || {};
    if (!reported || Number(reported) === req.user.id)
      return res.status(400).json({ error: 'Valid user to report is required' });
    await query('INSERT INTO reports (reporter, reported, reason) VALUES ($1,$2,$3)',
      [req.user.id, reported, (reason || '').slice(0, 500)]);
    res.status(201).json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/block', requireAuth, async (req, res) => {
  try {
    const { blocked } = req.body || {};
    if (!blocked || Number(blocked) === req.user.id)
      return res.status(400).json({ error: 'Valid user to block is required' });
    // Block them, and remove any existing connection between you.
    await query('INSERT INTO blocks (blocker, blocked) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.user.id, blocked]);
    await query(`DELETE FROM connections
      WHERE (requester = $1 AND recipient = $2) OR (requester = $2 AND recipient = $1)`,
      [req.user.id, blocked]);
    res.status(201).json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* --------------------------------- BOOT ----------------------------------- */

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Only start a listening server when run directly (local dev / non-serverless hosts).
// On Vercel, the exported app is used instead and this block is skipped.
const PORT = process.env.PORT || 4000;
if (process.env.VERCEL === undefined) {
  app.listen(PORT, () => console.log(`MedConnect API on :${PORT}`));
}

export default app;

