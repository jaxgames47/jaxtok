// JaxTok Plus (server). Put next to server.js, then add ONE line to server.js right after the CORS block
// (the app.use((q, r, n) => {...}) that sets Access-Control headers):
//   require('./plus-server')(app, () => ({ db, save, find, U, pv, hp, who, auth, adm, OWNER_EMAIL }));
module.exports = function (app, c) {
  const nameOf = (e) => e.split('@')[0];
  // temporary bans expire by themselves; returns ban info or null
  const banInfo = (e) => {
    const { db, save } = c(), b = db.banned[e];
    if (!b) return null;
    if (typeof b === 'object' && b.until && b.until < Date.now()) { delete db.banned[e]; save(); return null; }
    return typeof b === 'object' ? { reason: b.reason || '', until: b.until || null } : { reason: '', until: null };
  };
  // 1) banned people get the ban details (reason + length) instead of a plain "sign in again"
  app.use((q, r, n) => {
    const { db, hp } = c();
    let e = db.sessions[(q.headers.authorization || '').replace('Bearer ', '')];
    if (!e && q.method === 'POST' && q.path === '/api/login') {
      const em = String((q.body && q.body.username) || '').trim().toLowerCase() + '@jaxtok.app', u = db.users[em];
      if (u && u.salt && hp(String(q.body.password || ''), u.salt) === u.hash) e = em;
    }
    const b = e && db.users[e] ? banInfo(e) : null;
    if (b) return r.status(403).json({ error: 'Please sign in again.', ban: b });
    n();
  });
  // 2) every profile answer also carries the display name
  app.use((q, r, n) => {
    const j = r.json.bind(r);
    r.json = (b) => {
      try {
        if (b && typeof b === 'object' && !Array.isArray(b) && typeof b.username === 'string') {
          const e = c().find(b.username); if (e) b.displayName = c().U(e).displayName || '';
        }
      } catch (x) {}
      return j(b);
    };
    n();
  });
  const T = (fn) => (q, r) => c().auth(q, r, () => fn(q, r));
  const O = (fn) => (q, r) => c().auth(q, r, () => c().adm(q, r, () => fn(q, r)));
  const victim = (q, r) => {
    const e = c().find(q.body && q.body.username);
    if (!e || e === c().OWNER_EMAIL || nameOf(e) === 'jaxtok') { r.status(400).json({ error: "You can't do that to this account." }); return null; }
    return e;
  };
  // owner: ban for N hours (0 = permanent) with a reason, or lift a ban
  app.post('/api/admin/ban2', O((q, r) => {
    const e = victim(q, r); if (!e) return;
    const h = Math.max(0, Number(q.body.hours) || 0);
    c().db.banned[e] = { at: Date.now(), until: h ? Date.now() + h * 3600000 : null, reason: String(q.body.reason || '').slice(0, 200) };
    c().save(); r.json({ banned: true });
  }));
  app.post('/api/admin/unban', O((q, r) => {
    const e = victim(q, r); if (!e) return;
    delete c().db.banned[e]; c().save(); r.json({ banned: false });
  }));
  // display name + username change
  app.post('/api/me/display', T((q, r) => {
    const u = c().U(q.email); u.displayName = String(q.body.displayName || '').trim().slice(0, 30); c().save(); r.json({ displayName: u.displayName });
  }));
  app.post('/api/me/rename', T((q, r) => {
    const { db, save, OWNER_EMAIL } = c(), name = String(q.body.username || '').trim().toLowerCase(), old = q.email, nw = name + '@jaxtok.app';
    if (old === OWNER_EMAIL) return r.status(400).json({ error: 'The owner username cannot be changed.' });
    if (!/^[a-z0-9_]{3,20}$/.test(name)) return r.status(400).json({ error: 'Username must be 3-20 letters, numbers or underscores.' });
    if (nw === OWNER_EMAIL || ['jaxtok', 'admin', 'owner'].includes(name) || db.users[nw]) return r.status(409).json({ error: 'That username is taken.' });
    const sw = (x) => (x === old ? nw : x);
    db.users[nw] = db.users[old]; delete db.users[old];
    Object.values(db.users).forEach((u) => { u.following = (u.following || []).map(sw); });
    db.videos.forEach((v) => { v.author = sw(v.author); v.likedBy = v.likedBy.map(sw); v.comments.forEach((m) => { m.author = sw(m.author); }); });
    db.messages.forEach((m) => { m.from = sw(m.from); m.to = sw(m.to); });
    db.stickers.forEach((s) => { s.owner = sw(s.owner); });
    Object.keys(db.sessions).forEach((t) => { db.sessions[t] = sw(db.sessions[t]); });
    (db.reports || []).forEach((x) => { x.reporter = sw(x.reporter); });
    save(); r.json({ username: name });
  }));
  // one video by id (used by shared links)
  app.get('/api/videos/:id', (q, r) => {
    const v = c().db.videos.find((x) => x.id === q.params.id);
    v ? r.json(c().pv(v, c().who(q))) : r.status(404).json({ error: 'Video not found.' });
  });
};
