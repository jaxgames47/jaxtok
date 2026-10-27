/* JaxTok Plus. Load AFTER report.js:  <script src="plus.js"></script> */
(function () {
  const g = (id) => document.getElementById(id), own = () => !!(ME && ME.owner);

  // ---- no zooming on phones, light mode, light inspect deterrent ----
  const mv = document.querySelector('meta[name=viewport]');
  if (mv) mv.content = 'width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover';
  const css = document.createElement('style');
  css.textContent = 'input,textarea,select{font-size:16px!important}html,body{touch-action:manipulation;-webkit-text-size-adjust:100%}html.light body{filter:invert(1) hue-rotate(180deg)}html.light video,html.light img,html.light canvas{filter:invert(1) hue-rotate(180deg)}';
  document.head.appendChild(css);
  if (localStorage.getItem('jt_light') == '1') document.documentElement.classList.add('light');
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
  window.share = function (id) {
    const v = V[id], del = v && (v.author == ME.username || ME.owner);
    const it = (ic, l, fn, c = 'bg-white/10') => `<button onclick="${fn}" class="shrink-0 w-16 space-y-2"><div class="w-14 h-14 mx-auto rounded-full ${c} flex items-center justify-center text-xl"><i class="${ic}"></i></div>${l}</button>`;
    sheet('<div class="p-5 flex gap-3 overflow-x-auto ns text-center text-xs">'
      + it('fa-solid fa-link', 'Copy link', `shareCopy('${id}')`)
      + it('fa-brands fa-whatsapp', 'WhatsApp', `shareWA('${id}')`, 'bg-green-600')
      + (navigator.share ? it('fa-solid fa-arrow-up-from-bracket', 'More apps', `shareSys('${id}')`) : '')
      + it('fa-solid fa-note-sticky', 'Sticker', `mkSticker('${id}')`)
      + it('fa-solid fa-download', 'Save video', `saveVideo('${id}')`, 'bg-[var(--a)]')
      + (del ? it('fa-solid fa-trash', 'Delete', `closeSheet();delVideo('${id}')`, 'bg-red-600') : '') + '</div>');
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
  window.setLight = (v) => { document.documentElement.classList.toggle('light', !!v); localStorage.setItem('jt_light', v ? '1' : ''); settings(); };
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
    <div><p class="text-xs text-white/50 mb-2">Appearance</p><div class="flex gap-2">${[['Dark', 0], ['Light (beta)', 1]].map(([n, v]) => `<button onclick="setLight(${v})" class="flex-1 py-3 rounded-xl text-sm font-semibold bg-white/10" style="${!!v == L ? 'outline:2px solid var(--a)' : ''}">${n}</button>`).join('')}</div></div>
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
})();
