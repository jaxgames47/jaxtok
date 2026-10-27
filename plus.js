/* JaxTok Plus. Load AFTER report.js:  <script src="plus.js"></script> */
(function () {
  const g = (id) => document.getElementById(id), own = () => !!(ME && ME.owner);

  // ---- no zooming on phones, light mode, light inspect deterrent ----
  const LIGHT = [
    'html.light,html.light body{background:#fff;color:#111}',
    'html.light [class~="bg-black"],html.light [class~="bg-zinc-900"]{background:#fff!important}',
    'html.light [class~="bg-zinc-800"],html.light [class~="bg-[#3a3a3a]"]{background:#e4e4e7!important}',
    'html.light [class~="bg-[#1c1c1c]"]{background:#f4f4f5!important}',
    'html.light [class~="bg-white/10"],html.light [class~="bg-white/15"]{background:rgba(0,0,0,.08)!important}',
    'html.light [class~="bg-white/5"],html.light .hover\\:bg-white\\/5:hover{background:rgba(0,0,0,.05)!important}',
    'html.light [class*="border-white"]{border-color:rgba(0,0,0,.12)!important}',
    'html.light [class~="text-white/40"],html.light [class~="text-white/50"],html.light [class~="text-white/60"],html.light [class~="text-white/70"]{color:rgba(0,0,0,.55)!important}',
    'html.light .to-black{--tw-gradient-to:#fff}html.light .from-zinc-900{--tw-gradient-from:#f4f4f5}',
    'html.light [class~="bg-[var(--a)]"],html.light [class*="to-[var(--a)]"],html.light [class~="bg-red-600"],html.light [class~="bg-green-600"]{color:#fff}',
    'html.light #ov,html.light #create,html.light #ov [class~="bg-black"],html.light #create [class~="bg-black"]{background:#000!important;color:#fff}',
    'html.light .clip,html.light .acts{color:#fff}'].join('');
  const mq = matchMedia('(prefers-color-scheme: light)');
  const applyTheme = () => { const t = localStorage.getItem('jt_theme') || 'dark'; document.documentElement.classList.toggle('light', t == 'light' || (t == 'auto' && mq.matches)); };
  applyTheme(); if (mq.addEventListener) mq.addEventListener('change', applyTheme);
  window.setTheme = (t) => { localStorage.setItem('jt_theme', t); applyTheme(); settings(); };
  const mv = document.querySelector('meta[name=viewport]');
  if (mv) mv.content = 'width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover';
  const css = document.createElement('style');
  css.textContent = 'input,textarea,select{font-size:16px!important}.shbtn{display:none}@media (min-width:700px){.shbtn{display:flex}}html,body{touch-action:manipulation;-webkit-text-size-adjust:100%}'+LIGHT+'';
  document.head.appendChild(css);
  ['gesturestart', 'gesturechange'].forEach((e) => addEventListener(e, (x) => x.preventDefault()));
  addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  addEventListener('contextmenu', (e) => { if (!own()) e.preventDefault(); });
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (!own() && (e.key == 'F12' || (e.ctrlKey && e.shiftKey && 'ijc'.includes(k)) || (e.ctrlKey && k == 'u'))) e.preventDefault();
  });

  // ---- ban screen: 3s loading, then a big popup with the reason and length ----
  let shown = false;
  window.showBan = function (b) {
    if (shown) return; shown = true;
    const o = document.createElement('div');
    o.className = 'fixed inset-0 z-[100] bg-black flex items-center justify-center p-6 text-center';
    o.innerHTML = '<div class="space-y-4"><div class="w-14 h-14 mx-auto rounded-full border-4 border-white/20" style="border-top-color:var(--a);animation:spin 1s linear infinite"></div><p class="text-sm text-white/60">Checking your account...</p></div>';
    document.body.appendChild(o);
    setTimeout(() => {
      const perm = !b.until;
      o.innerHTML = `<div class="fi max-w-sm w-full space-y-4 p-6 rounded-3xl bg-zinc-900 border border-red-500/40"><div class="text-6xl">🚫</div>
      <h2 class="text-2xl font-extrabold">${perm ? 'You have been permanently banned' : 'You have been banned'}</h2>
      ${perm ? '' : `<p class="text-sm text-white/70">Your ban ends on<br><b>${new Date(b.until).toLocaleString()}</b></p>`}
      <div class="p-3 rounded-xl bg-white/5 text-left"><p class="text-xs text-white/50 mb-1">Reason</p><p class="text-sm">${esc(b.reason || 'Breaking the JaxTok community rules')}</p></div>
      <button onclick="location.reload()" class="w-full py-3 rounded-xl font-semibold bg-white/10">${perm ? 'OK' : 'Try again'}</button></div>`;
      token = null; localStorage.removeItem('jt');
    }, 3000);
  };
  window.api = async function (p, o = {}) {
    o.headers = { ...(o.headers || {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) };
    const r = await fetch(API + p, o), d = await r.json().catch(() => ({}));
    if (!r.ok) { if (d.ban) showBan(d.ban); throw new Error(d.error || 'Request failed'); }
    return d;
  };
  setInterval(() => { if (ME && token && !shown) api('/api/me').catch(() => {}); }, 20000);

  // ---- sharing: copy link, WhatsApp, any app; delete lives here too ----
  const link = (id) => location.origin + location.pathname + '?v=' + id;
  window.shareCopy = (id) => { navigator.clipboard && navigator.clipboard.writeText(link(id)); closeSheet(); toast('Link copied'); };
  window.shareWA = (id) => { window.open('https://wa.me/?text=' + encodeURIComponent('Watch this on JaxTok ' + link(id)), '_blank'); closeSheet(); };
  window.shareSys = (id) => { navigator.share({ title: 'JaxTok', text: (V[id] && V[id].caption) || 'Watch this on JaxTok', url: link(id) }).catch(() => {}); closeSheet(); };
  window.shScroll = (d) => g('shr').scrollBy({ left: d * 200 });
  window.share = function (id) {
    const v = V[id], del = v && (v.author == ME.username || ME.owner);
    const it = (ic, l, fn, c = 'bg-white/10') => `<button onclick="${fn}" class="shrink-0 w-16 space-y-2"><div class="w-14 h-14 mx-auto rounded-full ${c} flex items-center justify-center text-xl"><i class="${ic}"></i></div>${l}</button>`;
    sheet('<div class="relative"><button onclick="shScroll(-1)" class="shbtn absolute left-1 top-8 z-10 w-8 h-8 rounded-full bg-black/70 items-center justify-center"><i class="fa-solid fa-chevron-left"></i></button><div id="shr" onwheel="this.scrollLeft+=event.deltaY" style="scroll-behavior:smooth" class="p-5 flex gap-3 overflow-x-auto ns text-center text-xs">'
      + it('fa-solid fa-link', 'Copy link', `shareCopy('${id}')`)
      + it('fa-brands fa-whatsapp', 'WhatsApp', `shareWA('${id}')`, 'bg-green-600')
      + (navigator.share ? it('fa-solid fa-arrow-up-from-bracket', 'More apps', `shareSys('${id}')`) : '')
      + it('fa-solid fa-note-sticky', 'Sticker', `mkSticker('${id}')`)
      + it('fa-solid fa-download', 'Save video', `saveVideo('${id}')`, 'bg-[var(--a)]')
      + (del ? it('fa-solid fa-trash', 'Delete', `closeSheet();delVideo('${id}')`, 'bg-red-600') : '') + '</div><button onclick="shScroll(1)" class="shbtn absolute right-1 top-8 z-10 w-8 h-8 rounded-full bg-black/70 items-center justify-center"><i class="fa-solid fa-chevron-right"></i></button></div>');
  };
  const oc = window.card;
  window.card = (v) => oc(v).replace(/<button onclick="delVideo\('[^']*'\)"[\s\S]*?<\/button>/, '');
  const ob = window.boot;
  window.boot = function () {
    ob();
    const id = new URLSearchParams(location.search).get('v');
    if (id) api('/api/videos/' + id).then((v) => { history.replaceState(null, '', location.pathname); V[v.id] = v; CUR = [v]; watch(v.id); }).catch(() => toast('That video is not available', 1));
  };

  // ---- profile: edit profile (name, username, bio) vs settings (gear) ----
  window.editProfile = function () {
    sheet(`<div class="p-5 space-y-4"><h3 class="font-bold text-center">Edit profile</h3>
    <div class="flex items-center gap-4"><div id="pf">${avi(ME.avatar, ME.username, 'w-16 h-16 text-2xl')}</div><div class="flex flex-col gap-2">
      <label class="px-4 py-2 rounded-lg bg-white/10 text-xs font-semibold text-center cursor-pointer">Upload photo<input type="file" accept="image/*" class="hidden" onchange="setAvatar(this)"></label>
      <button onclick="clearAvatar()" class="px-4 py-2 rounded-lg bg-white/10 text-xs font-semibold">Use default picture</button></div></div>
    <div><p class="text-xs text-white/50 mb-1">Display name</p><input id="dn" maxlength="30" value="${esc(ME.displayName || '')}" placeholder="Your name" class="${inp}"></div>
    <div><p class="text-xs text-white/50 mb-1">Username</p><input id="un" maxlength="20" autocapitalize="none" value="${esc(ME.username)}" ${own() ? 'disabled' : ''} class="${inp}"></div>
    <div><p class="text-xs text-white/50 mb-1">Bio</p><textarea id="bio" rows="2" maxlength="160" class="${inp} resize-none">${esc(ME.bio || '')}</textarea></div>
    <button onclick="saveProfile()" class="w-full py-3 rounded-xl font-semibold bg-[var(--a)]">Save</button></div>`);
  };
  window.saveProfile = async function () {
    try {
      const dn = g('dn').value.trim(), un = g('un').value.trim().toLowerCase();
      Object.assign(ME, await api('/api/me', J({ bio: g('bio').value, settings: ME.settings }, 'PUT')));
      await api('/api/me/display', J({ displayName: dn }));
      if (!own() && un && un != ME.username) await api('/api/me/rename', J({ username: un }));
      Object.assign(ME, await api('/api/me')); closeSheet(); toast('Saved'); go('me');
    } catch (e) { fail(e); }
  };
  window.setPref = async (k, v) => {
    if (k == 'sound') { MUTE = !v; localStorage.setItem('jt_mute', MUTE ? '1' : ''); }
    if (k == 'accent') document.documentElement.style.setProperty('--a', v);
    try { Object.assign(ME, await api('/api/me', J({ settings: { ...ME.settings, [k]: v } }, 'PUT'))); } catch (e) { fail(e); }
  };
  window.settings = function () {
    const s = ME.settings, L = document.documentElement.classList.contains('light');
    const sw = (l, k, on) => `<label class="flex justify-between items-center text-sm"><span>${l}</span><input type="checkbox" ${on ? 'checked' : ''} onchange="setPref('${k}',this.checked)" class="accent-[var(--a)] w-5 h-5"></label>`;
    sheet(`<div class="p-5 space-y-4"><h3 class="font-bold text-center">Settings</h3>
    ${own() ? '<button onclick="adminMenu()" class="w-full py-3 rounded-xl font-bold bg-yellow-400 text-black">👑 Owner menu</button>' : ''}
    <div><p class="text-xs text-white/50 mb-2">Appearance</p><div class="flex gap-2">${[['Dark', 'dark'], ['Light', 'light'], ['Auto', 'auto']].map(([n, v]) => `<button onclick="setTheme('${v}')" class="flex-1 py-3 rounded-xl text-sm font-semibold bg-white/10" style="${v == (localStorage.getItem('jt_theme') || 'dark') ? 'outline:2px solid var(--a)' : ''}">${n}</button>`).join('')}</div></div>
    <div><p class="text-xs text-white/50 mb-2">Accent color</p><div class="flex gap-3">${COLORS.map((c) => `<button onclick="setPref('accent','${c}');this.parentNode.querySelectorAll('button').forEach(b=>b.style.outline='');this.style.outline='2px solid #fff'" class="w-8 h-8 rounded-full" style="background:${c};${c == (s.accent || '#ec4899') ? 'outline:2px solid #fff' : ''}"></button>`).join('')}</div></div>
    ${sw('Play videos with sound', 'sound', !MUTE)}${sw('Autoplay videos', 'autoplay', s.autoplay !== false)}
    <div><p class="text-xs text-white/50 mb-2">Linked accounts</p>${['Google', 'GitHub', 'Apple'].map((n) => `<div class="flex justify-between items-center py-2 text-sm"><span>${n}</span><span class="text-xs px-2 py-1 rounded bg-white/10 text-white/50">Coming soon</span></div>`).join('')}</div>
    <button onclick="logout()" class="w-full py-3 rounded-xl font-semibold bg-white/10 text-red-400">Sign out</button></div>`);
  };
  const opv = window.profileView;
  window.profileView = async function (n) {
    await opv(n); n = n || ME.username;
    document.querySelectorAll('#view button[onclick="settings()"]').forEach((b) => { if (b.textContent.includes('Edit')) { b.setAttribute('onclick', 'editProfile()'); b.textContent = 'Edit profile'; } });
    api('/api/users/' + n).then((p) => {
      if (!p.displayName) return;
      const h = [...document.querySelectorAll('#view b')].find((x) => x.textContent.replace(/\W/g, '').startsWith(n));
      if (h) h.insertAdjacentHTML('beforebegin', '<b class="block text-lg">' + esc(p.displayName) + '</b>');
    }).catch(() => {});
  };

  // ---- owner: ban with length + reason, unban, delete account ----
  window.adminAct = async function (a, n) {
    try {
      if (a == 'delete') {
        if (!confirm('Delete @' + n + ' and ALL their videos, comments and messages? This cannot be undone.')) return;
        await api('/api/admin/delete', J({ username: n })); toast('Account deleted'); return adminMenu();
      }
      const u = (await api('/api/admin/users')).find((x) => x.username == n);
      if (u && u.banned) { await api('/api/admin/unban', J({ username: n })); toast('Unbanned @' + n); return adminMenu(); }
      banSheet(n);
    } catch (e) { fail(e); }
  };
  window.banSheet = function (n) {
    const D = [['1 hour', 1], ['1 day', 24], ['7 days', 168], ['30 days', 720], ['Permanent', 0]];
    sheet(`<div class="p-5 space-y-3"><h3 class="font-bold text-center">Ban @${esc(n)}</h3>
    <div id="bd" data-h="0" class="grid grid-cols-3 gap-2">${D.map(([l, h]) => `<button onclick="this.parentNode.dataset.h=${h};[...this.parentNode.children].forEach(b=>b.style.outline='');this.style.outline='2px solid var(--a)'" class="py-3 rounded-xl text-xs font-semibold bg-white/10" style="${h == 0 ? 'outline:2px solid var(--a)' : ''}">${l}</button>`).join('')}</div>
    <input id="br" maxlength="200" placeholder="Reason (they will see this)" class="${inp}">
    <button onclick="doBan('${n}')" class="w-full py-3 rounded-xl font-semibold bg-red-600">Ban</button>
    <button onclick="adminMenu()" class="w-full py-3 rounded-xl font-semibold bg-white/10">Cancel</button></div>`);
  };
  window.doBan = async (n) => {
    try { await api('/api/admin/ban2', J({ username: n, hours: +g('bd').dataset.h, reason: g('br').value.trim() })); toast('@' + n + ' banned'); adminMenu(); } catch (e) { fail(e); }
  };
  const orp = window.repAct;
  if (orp) window.repAct = (a, id, w) => (a == 'ban' ? adminAct('ban', w) : orp(a, id, w));

  // ---- sticker editor: filmstrip with trim handles + playhead, Text, Crop, Still ----
  const seek = (t) => { _sv.onseeked = drawS; _sv.currentTime = t; };
  const nap = (t) => new Promise((res) => { _sv.onseeked = res; _sv.currentTime = t; setTimeout(res, 450); });
  const lay = () => {
    const p = (t) => (SC.dur ? t / SC.dur * 100 : 0);
    if (g('bx')) { g('bx').style.left = p(SC.s) + '%'; g('bx').style.width = p(SC.e - SC.s) + '%'; g('hl').style.left = p(SC.s) + '%'; g('hr').style.left = 'calc(' + p(SC.e) + '% - 20px)'; g('ph').style.left = 'calc(' + p(SC.t) + '% - 2px)'; }
    g('sl').textContent = SC.still ? 'Still frame' : (SC.e - SC.s).toFixed(1) + 's selected';
    if (g('stl')) g('stl').style.outline = SC.still ? '2px solid var(--a)' : '';
  };
  const dg = (el, fn) => { el.onpointerdown = (a) => { a.preventDefault(); el.setPointerCapture(a.pointerId); el.onpointermove = (m) => { const r = g('fs').getBoundingClientRect(); fn(Math.max(0, Math.min(1, (m.clientX - r.left) / r.width)) * SC.dur); lay(); }; el.onpointerup = () => { el.onpointermove = null; }; }; };
  async function strip() {
    const c = g('fsc'), x = c.getContext('2d'), N = 8, w = c.width / N, vw = _sv.videoWidth || 1, vh = _sv.videoHeight || 1, k = Math.max(w / vw, c.height / vh);
    for (let i = 0; i < N; i++) {
      await nap(Math.min(SC.dur, (i + .5) / N * SC.dur)); if (!g('fsc')) return;
      x.save(); x.beginPath(); x.rect(i * w, 0, w, c.height); x.clip(); x.drawImage(_sv, i * w + (w - vw * k) / 2, (c.height - vh * k) / 2, vw * k, vh * k); x.restore();
    }
    seek(SC.t);
  }
  const RATIOS = [[1, '1:1'], [16 / 9, '16:9'], [4 / 3, '4:3'], [9 / 16, '9:16']];
  window.stText = () => { const i = g('st'); i.classList.toggle('hidden'); i.focus(); };
  window.stCrop = () => { const i = (RATIOS.findIndex((r) => r[0] == SC.r) + 1) % RATIOS.length; SC.r = RATIOS[i][0]; g('cl').textContent = RATIOS[i][1]; drawS(); };
  window.stStill = () => { SC.still = !SC.still; lay(); };
  window.mkSticker = function (id, el) {
    _sv = el || document.querySelector(`[data-v="${id}"] video`); if (_sv.pause) _sv.pause();
    const vid = _sv.tagName == 'VIDEO', dur = vid && isFinite(_sv.duration) ? Math.floor(_sv.duration * 10) / 10 : 0;
    SC = { r: 1, dur, s: 0, e: Math.min(dur, 3), t: 0, still: !vid };
    const rb = (fn, inner, label, extra = '') => `<button onclick="${fn}" class="flex flex-col items-center gap-2 text-sm"><span ${extra} class="w-16 h-16 rounded-full flex items-center justify-center text-2xl" style="background:#333;color:#fff">${inner}</span><span>${label}</span></button>`;
    sheet(`<div id="stk" class="p-5 space-y-3" style="background:#1c1c1c;color:#fff"><p id="sl" class="text-lg font-bold"></p>
    <canvas id="sc" class="mx-auto rounded-2xl max-h-[30vh] max-w-full" style="background:#27272a"></canvas>
    ${vid ? `<div id="fs" class="relative h-14 rounded-xl overflow-hidden" style="background:#27272a"><canvas id="fsc" width="340" height="56" class="w-full h-full"></canvas>
      <div id="bx" class="absolute top-0 h-full" style="border:3px solid #fff;box-sizing:border-box;border-radius:8px"></div>
      <div id="hl" class="absolute top-0 h-full w-5 flex items-center justify-center" style="background:#fff;color:#555;touch-action:none;cursor:ew-resize;border-radius:8px 0 0 8px">&lsaquo;</div>
      <div id="hr" class="absolute top-0 h-full w-5 flex items-center justify-center" style="background:#fff;color:#555;touch-action:none;cursor:ew-resize;border-radius:0 8px 8px 0">&rsaquo;</div>
      <div id="ph" class="absolute top-0 h-full w-1 rounded" style="background:#fff;touch-action:none;cursor:ew-resize;box-shadow:0 0 5px #000"></div></div>` : ''}
    <div class="flex justify-center gap-8 pt-1">${rb('stText()', 'Aa', 'Text')}${rb('stCrop()', '<i class="fa-solid fa-crop-simple"></i>', '<b id="cl">1:1</b>')}${vid ? rb('stStill()', '<i class="fa-regular fa-image"></i>', 'Still', 'id="stl"') : ''}</div>
    <input id="st" maxlength="24" oninput="drawS()" placeholder="Sticker text" class="hidden w-full px-4 py-3 rounded-xl text-sm outline-none" style="background:#333;color:#fff">
    <button id="sv" onclick="saveSticker()" class="w-full py-3 rounded-xl font-semibold bg-[var(--a)]">Save sticker</button></div>`);
    lay(); drawS();
    if (vid) {
      dg(g('hl'), (t) => { SC.s = Math.min(t, SC.e - .3); if (SC.e - SC.s > 5) SC.s = SC.e - 5; SC.t = Math.max(SC.t, SC.s); seek(SC.t); });
      dg(g('hr'), (t) => { SC.e = Math.max(t, SC.s + .3); if (SC.e - SC.s > 5) SC.e = SC.s + 5; SC.t = Math.min(SC.t, SC.e); });
      dg(g('ph'), (t) => { SC.t = Math.max(SC.s, Math.min(SC.e, t)); seek(SC.t); });
      strip();
    }
  };
  window.saveSticker = async function () {
    const c = g('sc'), b = g('sv'), name = g('st').value || 'sticker';
    const send = async (blob, fn) => {
      const fd = new FormData(); fd.append('name', name); fd.append('sticker', blob, fn);
      try { await api('/api/stickers', { method: 'POST', body: fd }); closeSheet(); toast('Sticker saved!'); if (SC.back) SC.back(); } catch (e) { fail(e); b.disabled = false; b.textContent = 'Save sticker'; }
    };
    b.disabled = true;
    if (SC.still || !SC.dur) { drawS(); c.toBlob((bl) => (bl ? send(bl, 's.png') : toast('Could not capture this frame', 1)), 'image/png'); return; }
    if (!c.captureStream || !window.MediaRecorder) { toast('Clip stickers are not supported in this browser', 1); b.disabled = false; return; }
    const len = SC.e - SC.s; b.textContent = 'Recording ' + len.toFixed(1) + 's...';
    const ch = [], rec = new MediaRecorder(c.captureStream(30));
    rec.ondataavailable = (e) => e.data.size && ch.push(e.data);
    rec.onstop = () => send(new Blob(ch, { type: (rec.mimeType || 'video/webm').split(';')[0] }), 'clip');
    await nap(SC.s); _sv.muted = true; _sv.loop = false;
    const t0 = performance.now(); rec.start(); try { await _sv.play(); } catch (e) {}
    (function loop() { drawS(); if (performance.now() - t0 < len * 1000) requestAnimationFrame(loop); else { rec.stop(); _sv.pause(); } })();
  };
})();
