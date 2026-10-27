/* JaxTok report + owner add-on. Load it AFTER patch.js:
   <script src="https://jaxtok.onrender.com/patch.js"></script>
   <script src="report.js"></script>
   Adds: Report button on every video, a Reports list in the owner menu,
   and a crown button on @jaxon's own profile that opens the owner menu. */
(function () {
  const isOwner = () => ME && (ME.owner || ME.username == 'jaxon');
  const REASONS = ['Nudity or sexual content', 'Violence or gore', 'Harassment or hate', 'Spam or scam', 'Something else'];

  // ---------- report button on every video that isn't yours ----------
  const oldCard = window.card;
  window.card = function (v) {
    let h = oldCard(v);
    if (v.author != ME.username) {
      const btn = `<button onclick="reportVideo('${v.id}')" class="flex flex-col items-center gap-1"><div class="w-12 h-12 rounded-full bg-black/40 flex items-center justify-center text-xl"><i class="fa-regular fa-flag"></i></div><span class="text-xs font-semibold">Report</span></button>`;
      const key = `<button onclick="useSound('${v.id}')" class="disc`;
      if (h.includes(key)) h = h.replace(key, btn + key);
    }
    return h;
  };

  let RV = null;
  window.reportVideo = function (id) {
    RV = id;
    sheet(`<div class="p-5 space-y-3"><h3 class="font-bold text-sm text-center">Report video</h3>
    <div class="space-y-2">${REASONS.map((r, i) => `<label class="flex items-center gap-3 p-3 rounded-xl bg-white/5 text-sm cursor-pointer"><input type="radio" name="rr" value="${esc(r)}" ${i == 0 ? 'checked' : ''} class="accent-[var(--a)]">${r}</label>`).join('')}</div>
    <textarea id="rd" rows="2" maxlength="300" placeholder="Anything else we should know? (optional)" class="${inp} resize-none"></textarea>
    <button id="rs" onclick="sendReport()" class="w-full py-3 rounded-xl font-semibold bg-[var(--a)]">Send report</button>
    <button onclick="closeSheet()" class="w-full py-3 rounded-xl font-semibold bg-white/10">Cancel</button></div>`);
  };
  window.sendReport = async function () {
    const r = document.querySelector('#sheet input[name=rr]:checked'), b = $('rs');
    b.disabled = true;
    try {
      await api('/api/videos/' + RV + '/report', J({ reason: r ? r.value : 'Something else', details: $('rd').value.trim() }));
      closeSheet(); toast('Thanks, your report was sent');
    } catch (e) { fail(e); b.disabled = false; }
  };

  // ---------- owner menu: add a Reports list on top ----------
  const oldAdmin = window.adminMenu;
  window.adminMenu = async function () {
    await oldAdmin();
    const h = document.querySelector('#sheet .sheet > div');
    if (h && !h.querySelector('[data-rep]')) h.insertAdjacentHTML('afterbegin', '<button data-rep onclick="adminReports()" class="w-full py-3 mb-3 rounded-xl font-bold bg-red-600 text-sm"><i class="fa-solid fa-flag"></i> Reported videos</button>');
  };
  window.adminReports = async function () {
    try {
      const l = await api('/api/admin/reports');
      sheet(`<div class="p-4"><div class="flex items-center justify-between mb-2"><h3 class="font-bold text-sm">🚩 Reported videos</h3><button onclick="adminMenu()" class="text-white/60 text-sm">Back</button></div>
      <p class="text-xs text-white/50 mb-3">Tap a thumbnail to unblur it. Delete the video, ban the poster, or dismiss the report.</p>
      <div class="space-y-3">${l.map((r) => `<div class="p-3 rounded-xl bg-white/5 space-y-2">
        <div class="flex gap-3"><video src="${API + r.url}#t=0.1" muted preload="metadata" playsinline style="filter:blur(14px)" onclick="this.style.filter='none'" class="w-16 h-24 object-cover rounded-lg bg-zinc-800 shrink-0"></video>
        <div class="min-w-0 flex-1"><b class="text-sm">@${esc(r.author)}</b><p class="text-xs text-white/60 truncate">${esc(r.caption || '')}</p>
        <p class="text-xs text-red-400 mt-1">${esc(r.reason)} · ${r.count || 1} report${(r.count || 1) > 1 ? 's' : ''}</p>${r.details ? `<p class="text-xs text-white/50">"${esc(r.details)}"</p>` : ''}</div></div>
        <div class="flex gap-2"><button onclick="repAct('video','${r.videoId}')" class="flex-1 py-2 rounded-lg bg-red-600 text-xs font-semibold">Delete video</button>
        <button onclick="repAct('ban','${r.videoId}','${r.author}')" class="flex-1 py-2 rounded-lg bg-white/10 text-xs font-semibold">${r.banned ? 'Unban' : 'Ban'} user</button>
        <button onclick="repAct('dismiss','${r.videoId}')" class="flex-1 py-2 rounded-lg bg-white/10 text-xs font-semibold">Dismiss</button></div></div>`).join('') || '<p class="text-center text-white/40 text-sm py-8">No reports. All clear!</p>'}</div></div>`);
    } catch (e) { fail(e); }
  };
  window.repAct = async function (a, videoId, who) {
    const msg = a == 'video' ? 'Delete this video for good?' : a == 'ban' ? 'Ban or unban @' + who + '?' : '';
    if (msg && !confirm(msg)) return;
    try {
      if (a == 'video') await api('/api/videos/' + videoId + '/delete', { method: 'POST' });
      if (a == 'ban') await api('/api/admin/ban', J({ username: who }));
      if (a != 'ban') await api('/api/admin/reports/dismiss', J({ videoId }));
      toast('Done'); adminReports();
    } catch (e) { fail(e); }
  };

  // ---------- crown button on the owner's own profile ----------
  const oldProfile = window.profileView;
  window.profileView = async function (n) {
    await oldProfile(n); n = n || ME.username;
    if (n == ME.username && isOwner() && $('view')) {
      const box = $('view').querySelector('.relative');
      if (box && !box.querySelector('[data-own]')) box.insertAdjacentHTML('afterbegin', '<button data-own onclick="adminMenu()" class="absolute left-4 top-4 text-xl text-yellow-400" title="Owner menu"><i class="fa-solid fa-crown"></i></button>');
    }
  };
})();
