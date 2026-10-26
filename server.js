const express = require('express'), multer = require('multer'), crypto = require('crypto'), fs = require('fs'), path = require('path');
const DATA = process.env.DATA_DIR || path.join(__dirname, 'data'), UP = path.join(DATA, 'uploads'), F = path.join(DATA, 'db.json');
fs.mkdirSync(UP, { recursive: true });

// ---- permanent storage ----
// Accounts, posts, comments, messages -> Postgres (DATABASE_URL). Falls back to a local file if it isn't set.
// Video/photo/audio files -> Cloudinary (CLOUDINARY_* variables). Falls back to local disk if they aren't set.
const CLOUD = process.env.CLOUDINARY_CLOUD_NAME, CKEY = process.env.CLOUDINARY_API_KEY, CSEC = process.env.CLOUDINARY_API_SECRET;
const useCloud = !!(CLOUD && CKEY && CSEC);
let pool = null;
if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
}
const db = { users: {}, sessions: {}, videos: [], stickers: [], messages: [], files: {} };

let chain = Promise.resolve(), timer = null;
const write = () => {
  const s = JSON.stringify(db);
  return pool
    ? pool.query('insert into jt_store(k, v) values($1, $2) on conflict (k) do update set v = excluded.v', ['db', s])
    : fs.promises.writeFile(F, s);
};
const persist = () => (chain = chain.then(write).catch((e) => console.error('Save failed:', e.message)));
const save = () => { if (!timer) timer = setTimeout(() => { timer = null; persist(); }, 200); };
const flush = async () => { if (timer) { clearTimeout(timer); timer = null; } await persist(); };
['SIGTERM', 'SIGINT'].forEach((s) => process.on(s, async () => { await flush(); process.exit(0); }));

async function load() {
  let saved = null;
  if (pool) {
    await pool.query('create table if not exists jt_store(k text primary key, v text not null)');
    const r = await pool.query('select v from jt_store where k=$1', ['db']);
    if (r.rows[0]) saved = JSON.parse(r.rows[0].v);
  } else if (fs.existsSync(F)) saved = JSON.parse(fs.readFileSync(F, 'utf8'));
  Object.assign(db, saved || {});
  db.files = db.files || {};
  if (!db.users['jaxtok@jaxtok.app']) {
    db.users['jaxtok@jaxtok.app'] = { salt: 'x', hash: '!', following: [], settings: {}, bio: 'Official JaxTok account', createdAt: new Date().toISOString() };
  }
  await flush();
}

// send an uploaded file to Cloudinary, remember its address, then delete the temporary local copy
async function stash(file) {
  if (!file || !useCloud) return;
  const ts = Math.floor(Date.now() / 1000);
  const sig = crypto.createHash('sha1').update('timestamp=' + ts + CSEC).digest('hex');
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(file.path)], { type: file.mimetype }), file.filename);
  fd.append('api_key', CKEY); fd.append('timestamp', String(ts)); fd.append('signature', sig);
  const r = await fetch('https://api.cloudinary.com/v1_1/' + CLOUD + '/auto/upload', { method: 'POST', body: fd });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.secure_url) throw new Error((d.error && d.error.message) || 'Cloudinary upload failed');
  db.files[file.filename] = d.secure_url;
  fs.unlink(file.path, () => {});
}

const app = express();
app.use(express.json());
app.use((q, r, n) => {
  r.setHeader('Access-Control-Allow-Origin', '*');
  r.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  r.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  q.method === 'OPTIONS' ? r.sendStatus(204) : n();
});

const nm = (e) => e.split('@')[0];
const U = (e) => { const u = db.users[e]; u.following = u.following || []; u.settings = u.settings || {}; return u; };
const find = (n) => Object.keys(db.users).find((e) => nm(e) === String(n).toLowerCase());
const who = (q) => db.sessions[(q.headers.authorization || '').replace('Bearer ', '')];
const auth = (q, r, n) => { const e = who(q); if (!e || !db.users[e]) return r.status(401).json({ error: 'Please sign in again.' }); q.email = e; n(); };
const hp = (p, s) => crypto.scryptSync(p, s, 32).toString('hex');
const av = (e) => U(e).avatar || '';
const mu = (x) => (typeof x === 'string' && /^\/uploads\/[\w.-]+$/.test(x)) ? x : undefined;
const prof = (e) => ({ username: nm(e), bio: U(e).bio || '', avatar: av(e), settings: U(e).settings });
const sess = (e) => { const t = crypto.randomBytes(24).toString('hex'); db.sessions[t] = e; save(); return { token: t, ...prof(e) }; };
const followers = (e) => Object.values(db.users).filter((u) => (u.following || []).includes(e)).length;
const pv = (v, me) => ({
  id: v.id, author: nm(v.author), avatar: av(v.author), caption: v.caption, url: '/uploads/' + v.file,
  likes: v.likedBy.length, liked: !!me && v.likedBy.includes(me),
  comments: v.comments.map((c) => ({ author: nm(c.author), avatar: av(c.author), text: c.text, sticker: c.sticker, image: c.image, audio: c.audio, createdAt: c.createdAt })),
  createdAt: v.createdAt,
});

// ---- accounts ----
// sign-in writes the new session to storage before replying, so a refresh right after never loses it
app.post('/api/signup', async (q, r) => {
  const email = String(q.body.email || '').trim().toLowerCase(), pw = String(q.body.password || '');
  if (!/^\S+@\S+\.\S+$/.test(email)) return r.status(400).json({ error: 'Enter a valid email.' });
  if (pw.length < 6) return r.status(400).json({ error: 'Password must be 6+ characters.' });
  if (db.users[email] || find(nm(email))) return r.status(409).json({ error: 'That email/username is taken. Please sign in.' });
  const salt = crypto.randomBytes(16).toString('hex');
  db.users[email] = { salt, hash: hp(pw, salt), following: [], settings: {}, createdAt: new Date().toISOString() };
  const s = sess(email); await flush(); r.json(s);
});
app.post('/api/login', async (q, r) => {
  const email = String(q.body.email || '').trim().toLowerCase(), u = db.users[email];
  if (!u || hp(String(q.body.password || ''), u.salt) !== u.hash) return r.status(401).json({ error: 'Invalid email or password.' });
  const s = sess(email); await flush(); r.json(s);
});
app.get('/api/me', auth, (q, r) => r.json(prof(q.email)));
app.put('/api/me', auth, (q, r) => {
  const u = U(q.email), b = q.body || {}, s = b.settings || {};
  if (typeof b.bio === 'string') u.bio = b.bio.slice(0, 160);
  if (b.avatar === '') u.avatar = '';
  u.settings = { accent: String(s.accent || '#ec4899').slice(0, 7), sound: !!s.sound, autoplay: s.autoplay !== false };
  save(); r.json(prof(q.email));
});
app.get('/api/users', (q, r) => {
  const me = who(q), t = String(q.query.q || '').toLowerCase().replace('#', '');
  r.json(Object.keys(db.users).filter((e) => nm(e).includes(t)).slice(0, 30).map((e) => ({
    username: nm(e), avatar: av(e), bio: U(e).bio || '', followers: followers(e), isFollowing: !!me && U(me).following.includes(e),
  })));
});
app.get('/api/users/:n', (q, r) => {
  const e = find(q.params.n), me = who(q);
  if (!e) return r.status(404).json({ error: 'User not found.' });
  const vs = db.videos.filter((v) => v.author === e).reverse();
  r.json({ ...prof(e), followers: followers(e), following: U(e).following.length, likes: vs.reduce((a, v) => a + v.likedBy.length, 0), isFollowing: !!me && U(me).following.includes(e), videos: vs.map((v) => pv(v, me)) });
});
app.post('/api/users/:n/follow', auth, (q, r) => {
  const e = find(q.params.n);
  if (!e || e === q.email) return r.status(400).json({ error: "Can't follow that account." });
  const f = U(q.email).following, i = f.indexOf(e);
  i > -1 ? f.splice(i, 1) : f.push(e);
  save(); r.json({ following: i === -1 });
});

// ---- uploads ----
const EXT = { 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov', 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'audio/webm': '.webm', 'audio/mp4': '.m4a', 'audio/mpeg': '.mp3', 'audio/ogg': '.ogg' };
const up = multer({
  storage: multer.diskStorage({ destination: UP, filename: (q, f, cb) => cb(null, crypto.randomUUID() + (EXT[f.mimetype] || (f.mimetype.startsWith('audio') ? '.webm' : f.mimetype.startsWith('video') ? '.mp4' : '.png'))) }),
  limits: { fileSize: 50 * 1048576 },
  fileFilter: (q, f, cb) => cb(null, (({ video: ['video/'], sticker: ['image/', 'video/'], media: ['image/', 'audio/'] })[f.fieldname] || []).some((x) => f.mimetype.startsWith(x))),
});
const one = (f) => (q, r, n) => up.single(f)(q, r, async (e) => {
  if (e) return r.status(400).json({ error: e.code === 'LIMIT_FILE_SIZE' ? 'File is over 50MB.' : 'Upload failed.' });
  try { await stash(q.file); n(); }
  catch (x) { console.error('Store failed:', x.message); r.status(502).json({ error: 'Could not store the file. Try again.' }); }
});

app.post('/api/media', auth, one('media'), async (q, r) => {
  if (!q.file) return r.status(400).json({ error: 'Unsupported file.' });
  await flush();
  r.json({ url: '/uploads/' + q.file.filename, kind: q.file.mimetype.startsWith('audio') ? 'audio' : 'image' });
});
app.post('/api/me/avatar', auth, one('media'), async (q, r) => {
  if (!q.file || !q.file.mimetype.startsWith('image/')) return r.status(400).json({ error: 'Please choose an image.' });
  U(q.email).avatar = '/uploads/' + q.file.filename; await flush(); r.json(prof(q.email));
});

// ---- videos ----
app.get('/api/videos', (q, r) => {
  const me = who(q), t = String(q.query.q || '').toLowerCase();
  let l = db.videos.slice().reverse();
  if (q.query.tab === 'following' && me) l = l.filter((v) => U(me).following.includes(v.author));
  if (t) l = l.filter((v) => v.caption.toLowerCase().includes(t) || nm(v.author).includes(t.replace('@', '')));
  r.json(l.map((v) => pv(v, me)));
});
// a new post is written to permanent storage BEFORE the app is told it worked
app.post('/api/videos', auth, one('video'), async (q, r) => {
  if (!q.file) return r.status(400).json({ error: 'Please choose a video file.' });
  const v = { id: crypto.randomUUID(), author: q.email, caption: String(q.body.caption || 'No caption').slice(0, 300), file: q.file.filename, likedBy: [], comments: [], createdAt: new Date().toISOString() };
  db.videos.push(v); await flush(); r.json(pv(v, q.email));
});
const vid = (q, r, n) => { q.v = db.videos.find((x) => x.id === q.params.id); q.v ? n() : r.status(404).json({ error: 'Video not found.' }); };
app.post('/api/videos/:id/like', auth, vid, (q, r) => {
  const l = q.v.likedBy, i = l.indexOf(q.email);
  i > -1 ? l.splice(i, 1) : l.push(q.email);
  save(); r.json(pv(q.v, q.email));
});
app.post('/api/videos/:id/comments', auth, vid, async (q, r) => {
  const text = String(q.body.text || '').trim().slice(0, 500), st = db.stickers.find((s) => s.id === q.body.sticker);
  const image = mu(q.body.image), audio = mu(q.body.audio);
  if (!text && !st && !image && !audio) return r.status(400).json({ error: 'Write a comment or add a sticker, photo or voice note.' });
  q.v.comments.push({ author: q.email, text, sticker: st && '/uploads/' + st.file, image, audio, createdAt: new Date().toISOString() });
  await flush(); r.json(pv(q.v, q.email));
});

// ---- stickers ----
app.get('/api/stickers', (q, r) => r.json(db.stickers.slice().reverse().slice(0, 200).map((s) => ({ id: s.id, name: s.name, url: '/uploads/' + s.file, owner: nm(s.owner) }))));
app.post('/api/stickers', auth, one('sticker'), async (q, r) => {
  if (!q.file) return r.status(400).json({ error: 'No image received.' });
  const s = { id: crypto.randomUUID(), owner: q.email, name: String(q.body.name || 'sticker').slice(0, 40), file: q.file.filename };
  db.stickers.push(s); await flush(); r.json({ id: s.id, name: s.name, url: '/uploads/' + s.file, owner: nm(s.owner) });
});

// ---- messages ----
const mj = (m) => ({ from: nm(m.from), text: m.text, sticker: m.sticker, image: m.image, audio: m.audio, createdAt: m.createdAt });
app.get('/api/inbox', auth, (q, r) => {
  const m = new Map();
  db.messages.forEach((x) => { if (x.from === q.email || x.to === q.email) { const k = x.from === q.email ? x.to : x.from; m.delete(k); m.set(k, x); } });
  r.json([...m].reverse().map(([e, x]) => ({ user: nm(e), avatar: av(e), last: x.text || (x.audio ? '[voice message]' : x.image ? '[photo]' : '[sticker]') })));
});
app.get('/api/messages/:n', auth, (q, r) => {
  const e = find(q.params.n);
  if (!e) return r.status(404).json({ error: 'No user with that name.' });
  r.json(db.messages.filter((x) => (x.from === q.email && x.to === e) || (x.from === e && x.to === q.email)).slice(-200).map(mj));
});
app.post('/api/messages/:n', auth, async (q, r) => {
  const e = find(q.params.n), text = String(q.body.text || '').trim().slice(0, 1000), st = db.stickers.find((s) => s.id === q.body.sticker);
  if (!e || e === q.email) return r.status(400).json({ error: "Can't message that account." });
  const image = mu(q.body.image), audio = mu(q.body.audio);
  if (!text && !st && !image && !audio) return r.status(400).json({ error: 'Nothing to send.' });
  const m = { from: q.email, to: e, text, sticker: st && '/uploads/' + st.file, image, audio, createdAt: new Date().toISOString() };
  db.messages.push(m); await flush(); r.json(mj(m));
});

// files stored in Cloudinary are served by sending the browser to their permanent address
app.get('/uploads/:name', (q, r, n) => {
  const u = db.files[q.params.name];
  if (!u) return n();
  r.set('Cache-Control', 'public, max-age=86400');
  r.redirect(302, u);
});
app.use('/uploads', express.static(UP));
app.use(express.static(path.join(__dirname, 'public')));

load()
  .then(() => app.listen(process.env.PORT || 3000, () => {
    console.log('JaxTok running |', pool ? 'Postgres' : 'local file', '|', useCloud ? 'Cloudinary' : 'local disk');
    if (!pool || !useCloud) console.warn('WARNING: without DATABASE_URL and CLOUDINARY_* set, posts/videos are lost when the server restarts.');
  }))
  .catch((e) => { console.error('Startup failed:', e.message); process.exit(1); });
