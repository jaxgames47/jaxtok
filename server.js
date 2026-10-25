const express = require('express'), multer = require('multer'), crypto = require('crypto'), fs = require('fs'), path = require('path');
const DATA = process.env.DATA_DIR || path.join(__dirname, 'data'), UP = path.join(DATA, 'uploads'), F = path.join(DATA, 'db.json');
fs.mkdirSync(UP, { recursive: true });
const db = Object.assign({ users: {}, sessions: {}, videos: [], stickers: [], messages: [] }, fs.existsSync(F) ? JSON.parse(fs.readFileSync(F, 'utf8')) : {});
const save = () => fs.writeFileSync(F, JSON.stringify(db));
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
const av = (e) => U(e).avatar || '😎';
const prof = (e) => ({ username: nm(e), bio: U(e).bio || '', avatar: av(e), settings: U(e).settings });
const sess = (e) => { const t = crypto.randomBytes(24).toString('hex'); db.sessions[t] = e; save(); return { token: t, ...prof(e) }; };
const followers = (e) => Object.values(db.users).filter((u) => (u.following || []).includes(e)).length;
const pv = (v, me) => ({
  id: v.id, author: nm(v.author), avatar: av(v.author), caption: v.caption, url: '/uploads/' + v.file,
  likes: v.likedBy.length, liked: !!me && v.likedBy.includes(me),
  comments: v.comments.map((c) => ({ author: nm(c.author), avatar: av(c.author), text: c.text, sticker: c.sticker, createdAt: c.createdAt })),
  createdAt: v.createdAt,
});

// ---- accounts ----
app.post('/api/signup', (q, r) => {
  const email = String(q.body.email || '').trim().toLowerCase(), pw = String(q.body.password || '');
  if (!/^\S+@\S+\.\S+$/.test(email)) return r.status(400).json({ error: 'Enter a valid email.' });
  if (pw.length < 6) return r.status(400).json({ error: 'Password must be 6+ characters.' });
  if (db.users[email] || find(nm(email))) return r.status(409).json({ error: 'That email/username is taken. Please sign in.' });
  const salt = crypto.randomBytes(16).toString('hex');
  db.users[email] = { salt, hash: hp(pw, salt), following: [], settings: {}, createdAt: new Date().toISOString() };
  r.json(sess(email));
});
app.post('/api/login', (q, r) => {
  const email = String(q.body.email || '').trim().toLowerCase(), u = db.users[email];
  if (!u || hp(String(q.body.password || ''), u.salt) !== u.hash) return r.status(401).json({ error: 'Invalid email or password.' });
  r.json(sess(email));
});
app.get('/api/me', auth, (q, r) => r.json(prof(q.email)));
app.put('/api/me', auth, (q, r) => {
  const u = U(q.email), b = q.body || {}, s = b.settings || {};
  if (typeof b.bio === 'string') u.bio = b.bio.slice(0, 160);
  if (typeof b.avatar === 'string') u.avatar = b.avatar.slice(0, 8);
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
const EXT = { 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov', 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' };
const up = multer({
  storage: multer.diskStorage({ destination: UP, filename: (q, f, cb) => cb(null, crypto.randomUUID() + (EXT[f.mimetype] || (f.fieldname === 'video' ? '.mp4' : '.png'))) }),
  limits: { fileSize: 50 * 1048576 },
  fileFilter: (q, f, cb) => cb(null, f.mimetype.startsWith(f.fieldname === 'video' ? 'video/' : 'image/')),
});
const one = (f) => (q, r, n) => up.single(f)(q, r, (e) => e ? r.status(400).json({ error: e.code === 'LIMIT_FILE_SIZE' ? 'File is over 50MB.' : 'Upload failed.' }) : n());

// ---- videos ----
app.get('/api/videos', (q, r) => {
  const me = who(q), t = String(q.query.q || '').toLowerCase();
  let l = db.videos.slice().reverse();
  if (q.query.tab === 'following' && me) l = l.filter((v) => U(me).following.includes(v.author));
  if (t) l = l.filter((v) => v.caption.toLowerCase().includes(t) || nm(v.author).includes(t.replace('@', '')));
  r.json(l.map((v) => pv(v, me)));
});
app.post('/api/videos', auth, one('video'), (q, r) => {
  if (!q.file) return r.status(400).json({ error: 'Please choose a video file.' });
  const v = { id: crypto.randomUUID(), author: q.email, caption: String(q.body.caption || 'No caption').slice(0, 300), file: q.file.filename, likedBy: [], comments: [], createdAt: new Date().toISOString() };
  db.videos.push(v); save(); r.json(pv(v, q.email));
});
const vid = (q, r, n) => { q.v = db.videos.find((x) => x.id === q.params.id); q.v ? n() : r.status(404).json({ error: 'Video not found.' }); };
app.post('/api/videos/:id/like', auth, vid, (q, r) => {
  const l = q.v.likedBy, i = l.indexOf(q.email);
  i > -1 ? l.splice(i, 1) : l.push(q.email);
  save(); r.json(pv(q.v, q.email));
});
app.post('/api/videos/:id/comments', auth, vid, (q, r) => {
  const text = String(q.body.text || '').trim().slice(0, 500), st = db.stickers.find((s) => s.id === q.body.sticker);
  if (!text && !st) return r.status(400).json({ error: 'Write a comment or pick a sticker.' });
  q.v.comments.push({ author: q.email, text, sticker: st && '/uploads/' + st.file, createdAt: new Date().toISOString() });
  save(); r.json(pv(q.v, q.email));
});

// ---- stickers ----
app.get('/api/stickers', (q, r) => r.json(db.stickers.slice().reverse().slice(0, 200).map((s) => ({ id: s.id, name: s.name, url: '/uploads/' + s.file, owner: nm(s.owner) }))));
app.post('/api/stickers', auth, one('sticker'), (q, r) => {
  if (!q.file) return r.status(400).json({ error: 'No image received.' });
  const s = { id: crypto.randomUUID(), owner: q.email, name: String(q.body.name || 'sticker').slice(0, 40), file: q.file.filename };
  db.stickers.push(s); save(); r.json({ id: s.id, name: s.name, url: '/uploads/' + s.file, owner: nm(s.owner) });
});

// ---- messages ----
const mj = (m) => ({ from: nm(m.from), text: m.text, sticker: m.sticker, createdAt: m.createdAt });
app.get('/api/inbox', auth, (q, r) => {
  const m = new Map();
  db.messages.forEach((x) => { if (x.from === q.email || x.to === q.email) { const k = x.from === q.email ? x.to : x.from; m.delete(k); m.set(k, x); } });
  r.json([...m].reverse().map(([e, x]) => ({ user: nm(e), avatar: av(e), last: x.text || '[sticker]' })));
});
app.get('/api/messages/:n', auth, (q, r) => {
  const e = find(q.params.n);
  if (!e) return r.status(404).json({ error: 'No user with that name.' });
  r.json(db.messages.filter((x) => (x.from === q.email && x.to === e) || (x.from === e && x.to === q.email)).slice(-200).map(mj));
});
app.post('/api/messages/:n', auth, (q, r) => {
  const e = find(q.params.n), text = String(q.body.text || '').trim().slice(0, 1000), st = db.stickers.find((s) => s.id === q.body.sticker);
  if (!e || e === q.email) return r.status(400).json({ error: "Can't message that account." });
  if (!text && !st) return r.status(400).json({ error: 'Nothing to send.' });
  const m = { from: q.email, to: e, text, sticker: st && '/uploads/' + st.file, createdAt: new Date().toISOString() };
  db.messages.push(m); save(); r.json(mj(m));
});

app.use('/uploads', express.static(UP));
app.use(express.static(path.join(__dirname, 'public')));
app.listen(process.env.PORT || 3000, () => console.log('JaxTok running'));
