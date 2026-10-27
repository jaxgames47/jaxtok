// ADAPT ME: I haven't seen your server.js, so the names below are guesses.
// `app` = your Express app, `pool` = your pg Pool, `auth` = your login middleware
// that sets req.user.username, and the `videos` table has id, url, caption, author.
// The ban route should be your existing /api/admin/ban (the owner menu already uses it).

const ownerOnly = (req, res, next) =>
  req.user && req.user.username === 'jaxon' ? next() : res.status(403).json({ error: 'Owner only' });

pool.query(`CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY, video_id TEXT NOT NULL, reporter TEXT NOT NULL,
  reason TEXT NOT NULL, details TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (video_id, reporter))`);

// anyone signed in can report (one report per person per video)
app.post('/api/videos/:id/report', auth, async (req, res) => {
  const reason = String(req.body.reason || 'Something else').slice(0, 60);
  const details = String(req.body.details || '').slice(0, 300);
  await pool.query(
    `INSERT INTO reports (video_id, reporter, reason, details) VALUES ($1,$2,$3,$4)
     ON CONFLICT (video_id, reporter) DO UPDATE SET reason = $3, details = $4`,
    [req.params.id, req.user.username, reason, details]);
  res.json({ ok: true });
});

// owner sees one row per reported video, most reported first
app.get('/api/admin/reports', auth, ownerOnly, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.video_id AS "videoId", v.url, v.caption, v.author,
            (array_agg(r.reason ORDER BY r.id DESC))[1] AS reason,
            (array_agg(NULLIF(r.details,'') ORDER BY r.id DESC))[1] AS details,
            COUNT(*)::int AS count
     FROM reports r JOIN videos v ON v.id::text = r.video_id
     GROUP BY r.video_id, v.url, v.caption, v.author
     ORDER BY count DESC`);
  res.json(rows);
});

app.post('/api/admin/reports/dismiss', auth, ownerOnly, async (req, res) => {
  await pool.query('DELETE FROM reports WHERE video_id = $1', [String(req.body.videoId)]);
  res.json({ ok: true });
});
