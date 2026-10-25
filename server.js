const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOADS = path.join(DATA, 'uploads');
fs.mkdirSync(UPLOADS, { recursive: true });
const DB_FILE = path.join(DATA, 'db.json');

let db = fs.existsSync(DB_FILE)
  ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
  : { users: {}, sessions: {}, videos: [] };
const save = () => fs.writeFileSync(DB_FILE, JSON.stringify(db));

const app = express();
app.use(express.json());

// CORS (lets the HTML live on another host, e.g. GitHub Pages)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
const username = (email) => email.split('@')[0];
const userFromReq = (req) => db.sessions[(req.headers.authorization || '').replace('Bearer ', '')];
function requireAuth(req, res, next) {
  const email = userFromReq(req);
  if (!email) return res.status(401).json({ error: 'Please sign in again.' });
  req.email = email;
  next();
}
function newSession(email) {
  const token = crypto.randomBytes(24).toString('hex');
  db.sessions[token] = email;
  save();
  return token;
}

app.post('/api/signup', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be 6+ characters.' });
  if (db.users[email]) return res.status(409).json({ error: 'Email already registered. Please sign in.' });
  const salt = crypto.randomBytes(16).toString('hex');
  db.users[email] = { salt, hash: hashPw(password, salt), createdAt: new Date().toISOString() };
  res.json({ token: newSession(email), username: username(email) });
});

app.post('/api/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const u = db.users[email];
  if (!u || hashPw(String(req.body.password || ''), u.salt) !== u.hash)
    return res.status(401).json({ error: 'Invalid email or password.' });
  res.json({ token: newSession(email), username: username(email) });
});

app.get('/api/me', requireAuth, (req, res) => res.json({ username: username(req.email) }));

const EXT = { 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov' };
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS,
    filename: (req, file, cb) => cb(null, crypto.randomUUID() + (EXT[file.mimetype] || '.mp4')),
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('video/')),
});

const publicVideo = (v, me) => ({
  id: v.id,
  author: username(v.author),
  caption: v.caption,
  url: '/uploads/' + v.file,
  likes: v.likedBy.length,
  liked: !!me && v.likedBy.includes(me),
  comments: v.comments.map((c) => ({ author: username(c.author), text: c.text, createdAt: c.createdAt })),
  createdAt: v.createdAt,
});

app.get('/api/videos', (req, res) => {
  const me = userFromReq(req);
  res.json(db.videos.slice().reverse().map((v) => publicVideo(v, me)));
});

app.post('/api/videos', requireAuth, (req, res) => {
  upload.single('video')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Video is over 50MB.' : 'Upload failed.' });
    if (!req.file) return res.status(400).json({ error: 'Please choose a video file.' });
    const v = {
      id: crypto.randomUUID(),
      author: req.email,
      caption: String(req.body.caption || 'No caption').slice(0, 300),
      file: req.file.filename,
      likedBy: [],
      comments: [],
      createdAt: new Date().toISOString(),
    };
    db.videos.push(v);
    save();
    res.json(publicVideo(v, req.email));
  });
});

app.post('/api/videos/:id/like', requireAuth, (req, res) => {
  const v = db.videos.find((x) => x.id === req.params.id);
  if (!v) return res.status(404).json({ error: 'Video not found.' });
  const i = v.likedBy.indexOf(req.email);
  if (i > -1) v.likedBy.splice(i, 1); else v.likedBy.push(req.email);
  save();
  res.json(publicVideo(v, req.email));
});

app.post('/api/videos/:id/comments', requireAuth, (req, res) => {
  const v = db.videos.find((x) => x.id === req.params.id);
  const text = String(req.body.text || '').trim().slice(0, 500);
  if (!v || !text) return res.status(400).json({ error: 'Invalid comment.' });
  v.comments.push({ author: req.email, text, createdAt: new Date().toISOString() });
  save();
  res.json(publicVideo(v, req.email));
});

app.use('/uploads', express.static(UPLOADS)); // supports range requests for video seeking
app.use(express.static(path.join(__dirname, 'public')));

app.listen(process.env.PORT || 3000, () => console.log('JaxTok running'));
