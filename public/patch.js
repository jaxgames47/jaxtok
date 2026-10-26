/* JaxTok add-on. Loaded AFTER the main script: <script src="patch.js"></script>
   Adds: username login, owner badge + owner menu (ban / delete accounts / delete videos),
   delete button on your own videos, no saved-music buttons, and voice messages that no longer cut out. */
(function () {
  const OWNER = 'jaxon';
  const crown = '<i class="fa-solid fa-crown text-yellow-400 text-[11px] ml-1" title="Owner"></i>';
  const ownerTag = '<span class="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-yellow-400/20 text-yellow-300 font-semibold">👑 Owner</span>';

  function ownerPop() {
    const d = document.createElement('div');
    d.className = 'fixed inset-0 z-[80] flex items-center justify-center pointer-events-none';
    d.innerHTML = '<div class="fi px-8 py-5 rounded-2xl bg-black/90 border border-yellow-400/60 text-center shadow-2xl"><div class="text-4xl">👑</div><b class="text-sm">You are viewing the owner</b></div>';
    document.body.appendChild(d); setTimeout(() => d.remove(), 2200);
  }

  // ---------- login with just a username ----------
  window.authView = function () {
    $('root').innerHTML = `<div class="h-full w-full flex items-center justify-center p-6 bg-gradient-to-b from-zinc-900 to-black fi">
    <form onsubmit="auth(event)" class="w-full max-w-sm space-y-3 text-center">
      <img src="${uri(LOGO)}" class="w-20 h-20 mx-auto" alt="JaxTok">
      <h1 class="text-2xl font-extrabold">${signup ? 'Join JaxTok' : 'Welcome to JaxTok'}</h1>
      <input id="em" type="text" required minlength="3" maxlength="20" pattern="[A-Za-z0-9_]{3,20}" title="3-20 letters, numbers or underscores" autocapitalize="none" autocomplete="username" placeholder="${signup ? 'Pick a username' : 'Username'}" class="${inp}">
      <input id="pw" type="password" required minlength="6" placeholder="Password (6+ characters)" class="${inp}">
      <button class="w-full py-3 rounded-xl font-semibold bg-[var(--a)]">${signup ? 'Create account' : 'Sign in'}</button>
      <button type="button" onclick="signup=!signup;authView()" class="text-xs text-white/60">${signup ? 'Have an account? Sign in' : 'New here? Create an account'}</button>
    </form></div>`;
  };
  window.auth = async function (e) {
    e.preventDefault();
    try {
      const d = await api(signup ? '/api/signup' : '/api/login', J({ username: $('em').value.trim().toLowerCase(), password: $('pw').value }));
      token = d.token; localStorage.setItem('jt', token); ME = d; boot();
    } catch (x) { fail(x); }
  };

  // ---------- video card: owner badge, "liked by owner", delete button ----------
  window.card = function (v) {
    V[v.id] = v;
    const canDel = v.author == ME.username || ME.owner;
    return `<section data-v="${v.id}" ondblclick="dbl('${v.id}',event)" class="h-full w-full snap-start snap-always relative bg-black flex items-center justify-center">
    <div class="vw"><div class="clip">
      <video src="${API + v.url}" crossorigin="anonymous" loop playsinline preload="metadata" class="h-full w-full object-contain" onloadedmetadata="fitV(this)" onclick="tapV(this)"></video>
      <div class="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/80 to-transparent pointer-events-none"></div>
      ${v.ownerLiked ? '<span class="absolute top-14 left-3 z-10 text-[11px] px-2 py-1 rounded-full bg-black/60 border border-yellow-400/50">👑 Liked by the owner</span>' : ''}
      <button onclick="toggleMute()" class="mb absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/40 flex items-center justify-center text-sm"><i class="fa-solid ${MUTE ? 'fa-volume-xmark' : 'fa-volume-high'}"></i></button>
      <div class="absolute left-4 bottom-5 right-20 z-10"><b class="text-sm cursor-pointer" onclick="openUser('${v.author}')">@${esc(v.author)}${v.ownerAuthor ? crown : ''}</b><p class="text-xs mt-1 line-clamp-2">${cap(v.caption)}</p>
        <button onclick="useSound('${v.id}')" class="mt-1.5 flex items-center gap-1.5 text-xs max-w-full"><i class="fa-solid fa-music"></i><span class="truncate">original sound - @${esc(v.author)}</span></button></div>
    </div>
    <div class="acts absolute right-3 bottom-8 flex flex-col items-center gap-4 z-10">
      <div class="relative mb-2"><button onclick="openUser('${v.author}')" class="w-12 h-12 rounded-full border-2 border-white overflow-hidden">${avi(v.avatar, v.author, 'w-full h-full text-lg')}</button>
      ${v.author != ME.username ? `<button data-f="${v.author}" onclick="follow('${v.author}')" class="plus absolute -bottom-2 left-3.5 w-5 h-5 rounded-full bg-[var(--a)] text-xs flex items-center justify-center"><i class="fa-solid fa-plus"></i></button>` : ''}</div>
      <button data-lk="${v.id}" onclick="like('${v.id}')" class="flex flex-col items-center gap-1">${likeIn(v)}</button>
      <button onclick="comments('${v.id}')" class="flex flex-col items-center gap-1"><div class="w-12 h-12 rounded-full bg-black/40 flex items-center justify-center text-xl"><i class="fa-solid fa-comment-dots"></i></div><span data-cc="${v.id}" class="text-xs font-semibold">${v.comments.length}</span></button>
      <button onclick="share('${v.id}')" class="flex flex-col items-center gap-1"><div class="w-12 h-12 rounded-full bg-black/40 flex items-center justify-center text-xl"><i class="fa-solid fa-share"></i></div><span class="text-xs font-semibold">Share</span></button>
      ${canDel ? `<button onclick="delVideo('${v.id}')" class="flex flex-col items-center gap-1"><div class="w-12 h-12 rounded-full bg-black/40 flex items-center justify-center text-xl text-red-400"><i class="fa-solid fa-trash"></i></div><span class="text-xs font-semibold">Delete</span></button>` : ''}
      <button onclick="useSound('${v.id}')" class="disc w-11 h-11 rounded-full bg-zinc-900 border-[6px] border-zinc-800 flex items-center justify-center overflow-hidden">${avi(v.avatar, v.author, 'w-6 h-6 text-[10px]')}</button>
    </div></div></section>`;
  };
  window.delVideo = async function (id) {
    if (!confirm('Delete this video for good?')) return;
    try {
      await api('/api/videos/' + id + '/delete', { method: 'POST' });
      document.querySelectorAll(`[data-v="${id}"]`).forEach((e) => e.remove());
      delete V[id]; CUR = CUR.filter((x) => x.id != id); toast('Video deleted');
      if ($('ov') && !$('feed2').querySelector('section')) $('ov').remove();
      if (S.tab == 'me' && !$('ov')) profileView(window._pn);
      else if (S.tab == 'home' && !$('ov') && $('feed') && !$('feed').querySelector('section')) homeView();
    } catch (e) { fail(e); }
  };

  // ---------- share (no "Save sound"), comments (no music button, owner tag) ----------
  window.share = function (id) {
    sheet(`<div class="p-5 grid grid-cols-3 gap-2 text-center text-xs">
    <button onclick="navigator.clipboard&&navigator.clipboard.writeText(location.origin+'/#'+'${id}');closeSheet();toast('Link copied')" class="space-y-2"><div class="w-14 h-14 mx-auto rounded-full bg-white/10 flex items-center justify-center text-xl"><i class="fa-solid fa-link"></i></div>Copy link</button>
    <button onclick="mkSticker('${id}')" class="space-y-2"><div class="w-14 h-14 mx-auto rounded-full bg-white/10 flex items-center justify-center text-xl"><i class="fa-solid fa-note-sticky"></i></div>Create sticker</button>
    <button onclick="saveVideo('${id}')" class="space-y-2"><div class="w-14 h-14 mx-auto rounded-full bg-[var(--a)] flex items-center justify-center text-xl"><i class="fa-solid fa-download"></i></div>Save video</button></div>`);
  };
  const cm2 = (c) => `<div class="flex gap-2">${avi(c.avatar, c.author, 'w-8 h-8 text-xs')}<div class="min-w-0"><b class="text-xs text-white/60">@${esc(c.author)}</b>${c.owner ? ownerTag : ''}${c.text ? `<p class="text-sm">${esc(c.text)}</p>` : ''}${media(c)}</div></div>`;
  window.comments = function (id) {
    const v = V[id];
    sheet(`<div class="p-4 h-[70vh] flex flex-col bg-[#1c1c1c] rounded-t-3xl"><h3 class="text-center text-sm font-bold mb-3">${v.comments.length} comments</h3>
    <div class="flex-1 overflow-y-auto ns space-y-3">${v.comments.map(cm2).join('') || '<p class="text-center text-white/40 text-sm mt-8">No comments yet</p>'}</div>
    <div class="flex items-center gap-2 pt-3 pb-[env(safe-area-inset-bottom)]">${avi(ME.avatar, ME.username, 'w-10 h-10')}
      <div class="flex-1 min-w-0 flex items-center bg-[#3a3a3a] rounded-full h-12 pl-4 pr-2">
        <input id="ci" oninput="$('csend').classList.toggle('hidden',!this.value.trim())" onkeydown="if(event.key=='Enter')postC('${id}')" placeholder="Add comment..." class="flex-1 min-w-0 bg-transparent outline-none text-sm placeholder:text-white/40">
        <label class="px-1.5 text-lg cursor-pointer"><i class="fa-regular fa-image"></i><input type="file" accept="image/*" class="hidden" onchange="upImg(this,(u)=>postC('${id}','',null,{image:u}))"></label>
        <button onclick="pickSticker((s)=>postC('${id}','',s),()=>comments('${id}'))" class="px-1.5 text-lg"><i class="fa-regular fa-note-sticky"></i></button>
        <button onclick="voice(this,(u)=>postC('${id}','',null,{audio:u}))" class="px-1.5 text-lg"><i class="fa-solid fa-microphone"></i></button>
        <button onclick="$('ci').value+='@';$('ci').focus();$('csend').classList.remove('hidden')" class="px-1.5 text-lg"><i class="fa-solid fa-at"></i></button>
        <button id="csend" onclick="postC('${id}')" class="hidden ml-1 w-8 h-8 rounded-full bg-[var(--a)] text-xs shrink-0"><i class="fa-solid fa-arrow-up"></i></button>
      </div></div></div>`);
  };

  // ---------- chat: no music button, and voice messages are no longer rebuilt while they play ----------
  let chatKey = '';
  window.openChat = async function (u) {
    if (!u) return;
    try {
      const m = await api('/api/messages/' + u); closeSheet(); if ($('ov')) $('ov').remove();
      S.tab = 'chat'; S.chat = u; hl('inbox'); chatKey = JSON.stringify(m);
      $('view').innerHTML = `<div class="h-full flex flex-col fi"><div class="p-3 flex items-center gap-3 border-b border-white/10"><button onclick="go('inbox')"><i class="fa-solid fa-chevron-left"></i></button><b>@${esc(u)}${u == OWNER ? crown : ''}</b></div>
      <div id="ml" class="flex-1 overflow-y-auto ns p-3 space-y-2">${m.map(bub).join('')}</div>
      <div class="p-3 flex items-center gap-1 border-t border-white/10">
        <button onclick="pickSticker((s)=>sendM('',s))" class="text-xl px-1.5"><i class="fa-solid fa-note-sticky"></i></button>
        <label class="text-xl px-1.5 cursor-pointer"><i class="fa-regular fa-image"></i><input type="file" accept="image/*" class="hidden" onchange="upImg(this,(u)=>sendM('',null,{image:u}))"></label>
        <button onclick="voice(this,(u)=>sendM('',null,{audio:u}))" class="text-xl px-1.5"><i class="fa-solid fa-microphone"></i></button>
        <input id="mi" onkeydown="if(event.key=='Enter')sendM()" placeholder="Message..." class="${inp}"><button onclick="sendM()" class="px-4 py-3 rounded-xl bg-[var(--a)] text-sm font-semibold">Send</button></div></div>`;
      $('ml').scrollTop = 1e9;
    } catch (e) { fail(e); }
  };
  // the chat screen uses S.tab = 'chat' so the old refresh timer (which rebuilt the list and cut off audio) never runs
  setInterval(async () => {
    if (S.tab != 'chat' || !S.chat || !$('ml') || $('sheet')) return;
    const who = S.chat, m = await api('/api/messages/' + who).catch(() => 0);
    if (!m || who != S.chat || !$('ml')) return;
    const k = JSON.stringify(m);
    if (k == chatKey || [...$('ml').querySelectorAll('audio')].some((a) => !a.paused)) return;
    chatKey = k; const b = $('ml').scrollTop; $('ml').innerHTML = m.map(bub).join(''); $('ml').scrollTop = b;
  }, 4000);

  // ---------- owner popup on the owner's profile ----------
  const oldProfile = window.profileView;
  window.profileView = async function (n) {
    n = n || ME.username; window._pn = n;
    await oldProfile(n);
    if (n == OWNER && $('view')) {
      $('view').querySelectorAll('b').forEach((b) => { if (b.textContent == '@' + OWNER && !b.querySelector('i')) b.insertAdjacentHTML('beforeend', crown); });
      if (ME.username != OWNER) ownerPop();
    }
  };

  // ---------- owner menu ----------
  const oldSettings = window.settings;
  window.settings = function () {
    oldSettings();
    if (!ME.owner) return;
    const h = document.querySelector('#sheet .sheet > div');
    if (h) h.insertAdjacentHTML('afterbegin', '<button onclick="adminMenu()" class="w-full py-3 rounded-xl font-bold bg-yellow-400 text-black">👑 Owner menu</button>');
  };
  window.adminMenu = async function () {
    try {
      const l = await api('/api/admin/users');
      sheet(`<div class="p-4"><div class="flex items-center justify-between mb-2"><h3 class="font-bold text-sm">👑 Owner menu</h3><button onclick="closeSheet()" class="text-white/60 text-sm">Close</button></div>
      <p class="text-xs text-white/50 mb-3">To delete a video, open it and tap the red trash button.</p>
      <div class="space-y-2">${l.map((u) => `<div class="flex items-center gap-2 p-2 rounded-xl bg-white/5">${avi(u.avatar, u.username, 'w-10 h-10')}
        <div class="min-w-0 flex-1"><b class="text-sm">@${esc(u.username)}</b>${u.owner ? crown : ''}${u.banned ? ' <span class="text-red-400 text-xs">banned</span>' : ''}<p class="text-xs text-white/50">${u.videos} videos</p></div>
        ${u.owner ? '' : `<button onclick="adminAct('ban','${u.username}')" class="px-3 py-1.5 rounded-lg bg-white/10 text-xs font-semibold">${u.banned ? 'Unban' : 'Ban'}</button><button onclick="adminAct('delete','${u.username}')" class="px-3 py-1.5 rounded-lg bg-red-600 text-xs font-semibold">Delete</button>`}</div>`).join('') || '<p class="text-center text-white/40 text-sm py-6">No other accounts yet</p>'}</div></div>`);
    } catch (e) { fail(e); }
  };
  window.adminAct = async function (a, n) {
    const msg = a == 'delete' ? 'Delete @' + n + ' and all their videos, comments and messages? This cannot be undone.' : 'Ban or unban @' + n + '?';
    if (!confirm(msg)) return;
    try { await api('/api/admin/' + a, J({ username: n })); toast('Done'); adminMenu(); } catch (e) { fail(e); }
  };

  if (!token) authView();
})();
