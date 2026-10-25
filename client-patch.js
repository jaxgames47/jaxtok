// === PASTE THIS IN A NEW <script> TAG RIGHT AFTER YOUR EXISTING ONE (before </body>) ===
// It replaces the IndexedDB logic with calls to the shared server.

// Leave '' if the server also serves this HTML. Otherwise e.g. 'https://jaxtok.onrender.com'
const API_BASE = '';
let token = localStorage.getItem('jaxtok_token');
let feedVideos = [];

async function api(path, opts = {}) {
    opts.headers = { ...(opts.headers || {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) };
    const r = await fetch(API_BASE + path, opts);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Request failed');
    return d;
}
const jsonPost = (body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// --- AUTH ---
async function handleAuthSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    try {
        const d = await api(isSignUpMode ? '/api/signup' : '/api/login', jsonPost({ email, password }));
        token = d.token;
        localStorage.setItem('jaxtok_token', token);
        loginSuccess(d.username);
        showToast(isSignUpMode ? 'Account created successfully!' : 'Welcome back, ' + d.username);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function loginSuccess(name) {
    currentUser = name;
    document.getElementById('auth-gate').classList.add('hidden');
    document.getElementById('main-dashboard').classList.remove('hidden');
    document.getElementById('user-display-email').innerText = name;
    loadFeed();
}

function logoutUser() {
    currentUser = null;
    token = null;
    localStorage.removeItem('jaxtok_token');
    document.getElementById('main-dashboard').classList.add('hidden');
    document.getElementById('auth-gate').classList.remove('hidden');
    document.getElementById('auth-form').reset();
    stopWebcam();
}

// --- PUBLISH ---
async function publishVideo() {
    if (!activeVideoBlob) return;
    const btn = document.getElementById('publish-btn');
    btn.disabled = true;
    btn.innerText = 'Uploading...';
    const fd = new FormData();
    fd.append('caption', document.getElementById('video-caption-input').value.trim() || 'No caption');
    fd.append('video', activeVideoBlob, activeVideoBlob.name || 'recording.webm');
    try {
        await api('/api/videos', { method: 'POST', body: fd });
        showToast('Video published successfully!');
        closeUploadModal();
        loadFeed();
    } catch (err) {
        showToast(err.message, 'error');
    }
    btn.disabled = false;
    btn.innerText = 'Publish Video';
}

// --- FEED ---
async function loadFeed() {
    const container = document.getElementById('feed-container');
    const emptyState = document.getElementById('empty-feed');
    try {
        feedVideos = await api('/api/videos');
    } catch (err) {
        if (!feedVideos.length) { showToast('Could not load videos.', 'error'); return; }
    }
    const top = container.scrollTop;
    container.innerHTML = '';
    if (feedVideos.length === 0) { emptyState.classList.remove('hidden'); return; }
    emptyState.classList.add('hidden');

    feedVideos.forEach((video) => {
        const card = document.createElement('div');
        card.className = 'w-full h-full snap-start relative bg-black flex items-center justify-center overflow-hidden';
        card.innerHTML = `
            <video src="${API_BASE + video.url}" loop playsinline preload="metadata" class="w-full h-full object-cover cursor-pointer" onclick="togglePlayPause(this)"></video>
            <div class="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent pointer-events-none"></div>
            <div class="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none"></div>
            <div class="absolute right-4 bottom-24 flex flex-col items-center gap-5 z-20">
                <div class="w-11 h-11 rounded-full bg-gradient-to-tr from-pink-500 to-cyan-400 p-0.5 flex items-center justify-center shadow-lg">
                    <div class="w-full h-full bg-slate-900 rounded-full flex items-center justify-center font-bold text-xs text-white">${escapeHtml(video.author.charAt(0).toUpperCase())}</div>
                </div>
                <button onclick="toggleLike('${video.id}')" class="flex flex-col items-center gap-1 group">
                    <div class="w-11 h-11 rounded-full bg-slate-900/60 backdrop-blur-md flex items-center justify-center text-xl transition-transform transform active:scale-125 ${video.liked ? 'text-pink-500' : 'text-white hover:bg-slate-800/80'}">
                        <i class="fa-${video.liked ? 'solid' : 'regular'} fa-heart"></i>
                    </div>
                    <span class="text-xs font-semibold text-white drop-shadow">${video.likes}</span>
                </button>
                <button onclick="openComments('${video.id}')" class="flex flex-col items-center gap-1 group">
                    <div class="w-11 h-11 rounded-full bg-slate-900/60 backdrop-blur-md flex items-center justify-center text-lg text-white hover:bg-slate-800/80 transition-transform transform active:scale-125">
                        <i class="fa-solid fa-comment-dots"></i>
                    </div>
                    <span class="text-xs font-semibold text-white drop-shadow">${video.comments.length}</span>
                </button>
                <button onclick="shareVideo('${video.id}')" class="flex flex-col items-center gap-1 group">
                    <div class="w-11 h-11 rounded-full bg-slate-900/60 backdrop-blur-md flex items-center justify-center text-lg text-white hover:bg-slate-800/80 transition-transform transform active:scale-125">
                        <i class="fa-solid fa-share"></i>
                    </div>
                    <span class="text-xs font-semibold text-white drop-shadow">Share</span>
                </button>
            </div>
            <div class="absolute left-4 bottom-6 right-20 z-20 pointer-events-auto">
                <h4 class="font-bold text-white text-sm drop-shadow mb-1">@${escapeHtml(video.author)}</h4>
                <p class="text-xs text-slate-200 drop-shadow line-clamp-2 leading-relaxed">${escapeHtml(video.caption)}</p>
            </div>`;
        container.appendChild(card);
    });
    container.scrollTop = top; // stay on the same video after likes/comments
    setupIntersectionObserver();
}

// --- LIKES & COMMENTS ---
async function toggleLike(id) {
    try {
        await api('/api/videos/' + id + '/like', { method: 'POST' });
        loadFeed();
    } catch (err) { showToast(err.message, 'error'); }
}

function openComments(videoId) {
    const video = feedVideos.find((v) => v.id === videoId);
    if (!video) return;
    const modalId = 'comments-modal';
    const old = document.getElementById(modalId);
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4';
    const list = video.comments.map((c) => `
        <div class="flex items-start gap-3 py-2.5 border-b border-slate-800/50">
            <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-pink-400 shrink-0">${escapeHtml(c.author.charAt(0).toUpperCase())}</div>
            <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-semibold text-slate-300">@${escapeHtml(c.author)}</span>
                    <span class="text-[10px] text-slate-500">${new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p class="text-xs text-slate-200 mt-1 leading-relaxed">${escapeHtml(c.text)}</p>
            </div>
        </div>`).join('') || '<div class="text-center py-8 text-slate-500 text-xs">No comments yet. Be the first to comment!</div>';

    modal.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl flex flex-col h-[70vh] sm:h-[500px]">
            <div class="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <h3 class="text-sm font-bold text-white">${video.comments.length} Comments</h3>
                <button onclick="document.getElementById('${modalId}').remove()" class="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs transition-colors"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="flex-1 overflow-y-auto no-scrollbar space-y-1 pr-1">${list}</div>
            <form onsubmit="postComment(event, '${videoId}')" class="mt-3 pt-3 border-t border-slate-800 flex gap-2">
                <input type="text" id="comment-input" required placeholder="Add a comment..." class="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-pink-500">
                <button type="submit" class="px-4 py-2.5 bg-pink-500 hover:bg-pink-600 text-white font-semibold rounded-xl text-xs transition-colors">Post</button>
            </form>
        </div>`;
    document.body.appendChild(modal);
}

async function postComment(e, videoId) {
    e.preventDefault();
    const input = document.getElementById('comment-input');
    const text = input.value.trim();
    if (!text) return;
    try {
        const updated = await api('/api/videos/' + videoId + '/comments', jsonPost({ text }));
        const i = feedVideos.findIndex((v) => v.id === videoId);
        if (i > -1) feedVideos[i] = updated;
        openComments(videoId);
        loadFeed();
        showToast('Comment posted!');
    } catch (err) { showToast(err.message, 'error'); }
}

// --- STARTUP: restore session from the server ---
window.addEventListener('DOMContentLoaded', async () => {
    if (!token) return;
    try {
        const me = await api('/api/me');
        loginSuccess(me.username);
    } catch (err) {
        token = null;
        localStorage.removeItem('jaxtok_token');
    }
});
