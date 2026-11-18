// فيديو قصيرة — واجهة التطبيق (بدون أي إطار عمل).
const S = {
  data: null,
  route: {name: 'feed'},
  tab: 'foryou',
  stack: [],
  pendingMedia: null,
  timers: [],
  observer: null,
  scrollTo: null,
};

const fmt = (n = 0) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.0', '')}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace('.0', '')}K` : String(n);
const nf = (n = 0) => Number(n).toLocaleString('en-US');
const esc = (value = '') =>
  String(value).replace(/[&<>"']/g, (ch) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  chat: '<path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.5-4.5A8 8 0 1 1 21 12z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  heart: '<path d="M12 21s-7.5-4.6-9.3-9A5.2 5.2 0 0 1 12 6.6 5.2 5.2 0 0 1 21.3 12C19.5 16.4 12 21 12 21z"/>',
  comment: '<path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.5-4.5A8 8 0 1 1 21 12z"/>',
  share: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
  save: '<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.2h3.2a1.8 1.8 0 0 1 0 3.6H10a1.8 1.8 0 0 0 0 3.6h3.5"/>',
  live: '<circle cx="12" cy="12" r="2"/><path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 16.5a6.4 6.4 0 0 0 0-9M4.5 4.5a10.6 10.6 0 0 0 0 15M19.5 19.5a10.6 10.6 0 0 0 0-15"/>',
  back: '<path d="M9 5l7 7-7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.6"/>',
};

const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

async function loadState() {
  const res = await fetch('/api/state', {cache: 'no-store'});
  S.data = await res.json();
}

async function api(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || 'request_failed');
    error.status = res.status;
    throw error;
  }
  return data;
}

let toastTimer;
function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

const creatorOf = (id) => (id === 'me' ? S.data.me : S.data.creators.find((c) => c.id === id) || S.data.me);
const findPost = (id) => S.data.posts.find((p) => p.id === id);

/* ---------------- navigation ---------------- */
function navigate(route, {stack = true} = {}) {
  if (stack) S.stack.push(S.route);
  S.route = route;
  render();
}

function goBack() {
  S.route = S.stack.pop() || {name: 'feed'};
  render();
}

function clearTimers() {
  S.timers.forEach(clearInterval);
  S.timers = [];
  if (S.observer) {
    S.observer.disconnect();
    S.observer = null;
  }
}

function render() {
  clearTimers();
  document.getElementById('topbar').innerHTML = topbarHTML();
  document.getElementById('tabbar').innerHTML = tabbarHTML();
  document.getElementById('view').innerHTML = viewHTML();
  afterRender();
}

function topbarHTML() {
  const r = S.route;
  if (r.name === 'live') return '';
  if (r.name === 'feed') {
    return `<div class="topbar feed">
      <div class="brand">فيديو <span>قصيرة</span></div>
      <div class="feed-tabs">
        <button data-act="feedtab" data-tab="foryou" class="${S.tab === 'foryou' ? 'active' : ''}" data-testid="tab-foryou">لك</button>
        <button data-act="feedtab" data-tab="following" class="${S.tab === 'following' ? 'active' : ''}" data-testid="tab-following">متابعة</button>
      </div>
      <button class="icon-btn" data-act="lives" aria-label="البث المباشر" data-testid="lives-btn">${icon('live')}</button>
      <button class="coin-chip" data-act="wallet" data-testid="coin-chip">🪙 ${fmt(S.data.me.coins)}</button>
    </div>`;
  }
  let title = 'فيديو قصيرة';
  if (r.name === 'discover') title = 'اكتشف';
  if (r.name === 'create') title = 'نشر فيديو';
  if (r.name === 'rooms') title = 'غرف الدردشة';
  if (r.name === 'room') title = S.data.rooms.find((x) => x.id === r.id)?.name || 'غرفة';
  if (r.name === 'lives') title = 'البث المباشر';
  if (r.name === 'me') title = 'ملفي';
  if (r.name === 'creator') title = creatorOf(r.id).name;
  if (r.name === 'wallet') title = 'محفظة الكوينز';
  return `<div class="topbar">
    <button class="icon-btn" data-act="back" aria-label="رجوع" data-testid="back-btn">${icon('back')}</button>
    <span class="title">${esc(title)}</span>
    <span class="spacer"></span>
    <button class="coin-chip" data-act="wallet" data-testid="coin-chip">🪙 ${fmt(S.data.me.coins)}</button>
  </div>`;
}

function tabbarHTML() {
  const active = (...names) => (names.includes(S.route.name) ? 'active' : '');
  return `<div class="tabbar">
    <button class="tab ${active('feed')}" data-act="nav" data-to="feed" data-testid="nav-home">${icon('home')}<span>الرئيسية</span></button>
    <button class="tab ${active('discover')}" data-act="nav" data-to="discover" data-testid="nav-discover">${icon('compass')}<span>اكتشف</span></button>
    <button class="tab" data-act="nav" data-to="create" data-testid="nav-create"><span class="plus">+</span></button>
    <button class="tab ${active('rooms', 'room')}" data-act="nav" data-to="rooms" data-testid="nav-rooms">${icon('chat')}<span>الدردشة</span></button>
    <button class="tab ${active('me', 'creator', 'wallet')}" data-act="nav" data-to="me" data-testid="nav-me">${icon('user')}<span>أنا</span></button>
  </div>`;
}

function viewHTML() {
  switch (S.route.name) {
    case 'feed':
      return feedHTML();
    case 'discover':
      return discoverHTML();
    case 'create':
      return createHTML();
    case 'rooms':
      return roomsHTML();
    case 'room':
      return roomHTML(S.route.id);
    case 'lives':
      return livesHTML();
    case 'live':
      return liveHTML(S.route.id);
    case 'me':
      return meHTML();
    case 'creator':
      return creatorHTML(S.route.id);
    case 'wallet':
      return walletHTML();
    default:
      return feedHTML();
  }
}

function afterRender() {
  const {name} = S.route;
  if (name === 'feed') {
    setupFeedVideos();
    if (S.scrollTo) {
      document.querySelector(`[data-post="${S.scrollTo}"]`)?.scrollIntoView();
      S.scrollTo = null;
    }
  }
  if (name === 'room') {
    scrollBottom('messages');
    S.timers.push(setInterval(() => refreshRoom().catch(() => {}), 4000));
  }
  if (name === 'live') {
    scrollBottom('live-chat');
    S.timers.push(setInterval(() => refreshLive().catch(() => {}), 4000));
  }
}

function scrollBottom(id) {
  const el = document.getElementById(id);
  if (el) el.scrollTop = el.scrollHeight;
}

function setupFeedVideos() {
  if (!('IntersectionObserver' in window)) return;
  S.observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const video = entry.target.querySelector('video');
        if (!video) return;
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      });
    },
    {threshold: 0.55},
  );
  document.querySelectorAll('.post').forEach((post) => S.observer.observe(post));
}

/* ---------------- feed ---------------- */
function mediaHTML(media) {
  if (!media) return '';
  if (media.type === 'video') {
    return `<video src="${esc(media.src)}" muted loop playsinline autoplay preload="metadata"></video>`;
  }
  if (media.type === 'image') return `<img src="${esc(media.src)}" alt="" />`;
  return `<div class="gradient" style="--g1:${media.g1};--g2:${media.g2}"><span>${media.emoji}</span></div>`;
}

function postHTML(post) {
  const creator = creatorOf(post.creatorId);
  const following = S.data.me.following.includes(creator.id);
  return `<article class="post" data-post="${post.id}" data-testid="post-${post.id}">
    ${mediaHTML(post.media)}
    <div class="post-shade"></div>
    <div class="rail">
      <div class="rail-avatar">
        <button class="bubble" data-act="creator" data-id="${creator.id}" aria-label="${esc(creator.name)}" style="border-color:${creator.color}">${creator.emoji}</button>
        ${
          creator.id === 'me'
            ? ''
            : `<button class="follow-badge ${following ? 'on' : ''}" data-act="follow" data-id="${creator.id}" data-testid="follow-${creator.id}" aria-label="متابعة">${following ? '✓' : '+'}</button>`
        }
      </div>
      <button class="rail-btn ${post.liked ? 'on' : ''}" data-act="like" data-id="${post.id}" data-testid="like-${post.id}" aria-label="إعجاب">
        ${icon('heart')}<span data-count>${fmt(post.likes)}</span>
      </button>
      <button class="rail-btn" data-act="comments" data-id="${post.id}" data-testid="comments-${post.id}" aria-label="التعليقات">
        ${icon('comment')}<span data-count>${fmt(post.comments.length)}</span>
      </button>
      <button class="rail-btn" data-act="share" data-id="${post.id}" data-testid="share-${post.id}" aria-label="مشاركة">
        ${icon('share')}<span data-count>${fmt(post.shares)}</span>
      </button>
      <button class="rail-btn ${post.saved ? 'on' : ''}" data-act="save" data-id="${post.id}" data-testid="save-${post.id}" aria-label="حفظ">
        ${icon('save')}<span data-count>${fmt(post.saves)}</span>
      </button>
    </div>
    <div class="post-meta">
      <button class="creator" data-act="creator" data-id="${creator.id}">@${esc(creator.handle)} ${creator.verified ? '<i class="verified">✓</i>' : ''}</button>
      <p class="caption">${esc(post.caption)}</p>
      <div class="tags">${post.hashtags.map((tag) => `<span>${esc(tag)}</span>`).join('')}</div>
      <p class="sound">♪ ${esc(post.sound)}</p>
    </div>
  </article>`;
}

function feedHTML() {
  const me = S.data.me;
  let posts = S.data.posts;
  if (S.tab === 'following') {
    posts = posts.filter((post) => post.creatorId === 'me' || me.following.includes(post.creatorId));
  }
  if (!posts.length) {
    return `<div class="empty">لا توجد فيديوهات هنا بعد — تابع صنّاع المحتوى أو انشر أول فيديو لك.</div>`;
  }
  return `<div class="feed">${posts.map(postHTML).join('')}</div>`;
}

/* ---------------- discover ---------------- */
function liveCardHTML(live) {
  const creator = creatorOf(live.creatorId);
  return `<button class="live-card" data-act="live" data-id="${live.id}" data-testid="live-card-${live.id}">
    <div class="thumb">${mediaHTML(live.media)}</div>
    <span class="live-tag"><i></i>مباشر</span>
    <div class="card-meta">
      <b>${esc(creator.name)}</b>
      <span>${esc(live.title)} · ${fmt(live.viewers)}</span>
    </div>
  </button>`;
}

function discoverHTML() {
  const me = S.data.me;
  return `<div class="page">
    <div class="searchbox">${icon('search')}<input placeholder="ابحث عن صنّاع أو هاشتاق" data-act="search" data-testid="search-input" /></div>
    <div class="section-head"><h3>مباشر الآن</h3><button data-act="lives">عرض الكل</button></div>
    <div class="live-strip">${S.data.lives.map(liveCardHTML).join('')}</div>
    <div class="section-head"><h3>الترند</h3></div>
    <div class="trend-list">
      ${S.data.hashtags
        .map(
          (item, index) => `<div class="trend-row" data-searchable="${esc(item.tag)}">
            <span class="rank">${index + 1}</span>
            <div><b>${esc(item.tag)}</b><span>${fmt(item.views)} مشاهدة</span></div>
          </div>`,
        )
        .join('')}
    </div>
    <div class="section-head"><h3>صنّاع المحتوى</h3></div>
    <div>
      ${S.data.creators
        .map((creator) => {
          const following = me.following.includes(creator.id);
          return `<div class="creator-row" data-searchable="${esc(creator.name)} ${esc(creator.handle)}">
            <div class="avatar" style="border-color:${creator.color}">${creator.emoji}</div>
            <div class="who" data-act="creator" data-id="${creator.id}">
              <b>${esc(creator.name)} ${creator.verified ? '<i class="verified">✓</i>' : ''}</b>
              <span>@${esc(creator.handle)} · ${fmt(creator.followers)} متابع</span>
            </div>
            <button class="btn ${following ? 'ghost' : 'primary'}" data-act="follow" data-id="${creator.id}" data-testid="discover-follow-${creator.id}">${following ? 'متابع' : 'متابعة'}</button>
          </div>`;
        })
        .join('')}
    </div>
    <div class="section-head"><h3>غرف الدردشة</h3><button data-act="nav" data-to="rooms">عرض الكل</button></div>
    <div>
      ${S.data.rooms
        .map(
          (room) => `<div class="room-row" data-act="room" data-id="${room.id}">
            <div class="icon">${room.icon}</div>
            <div class="who"><b>${esc(room.name)}</b><p>${esc(room.topic)} · ${fmt(room.members)} عضو</p></div>
          </div>`,
        )
        .join('')}
    </div>
  </div>`;
}

/* ---------------- create ---------------- */
function createHTML() {
  return `<div class="page create">
    <h2>انشر فيديو قصير</h2>
    <label class="upload" data-testid="upload-box">
      <input type="file" accept="video/*,image/*" data-testid="file-input" hidden />
      <div id="upload-preview" class="upload-preview">
        ${icon('plus')}
        <span>اختر فيديو أو صورة للنشر</span>
      </div>
    </label>
    <div class="field">
      <label>الوصف</label>
      <textarea data-testid="caption-input" placeholder="اكتب وصف الفيديو..."></textarea>
    </div>
    <div class="field">
      <label>هاشتاقات (اختياري)</label>
      <input data-testid="tags-input" placeholder="#ترند #تحدي" />
    </div>
    <div class="field">
      <button class="btn primary block" data-act="publish" data-testid="publish-btn">نشر الآن</button>
    </div>
    <p class="hint">النشر بدون قيود: يظهر مقطعك مباشرة في الصفحة الرئيسية وفي ملفك الشخصي.</p>
  </div>`;
}

/* ---------------- rooms ---------------- */
function roomsHTML() {
  return `<div class="page">
    <button class="btn primary block" data-act="new-room" data-testid="new-room-btn" style="margin-top:12px">+ إنشاء غرفة دردشة</button>
    <div class="section-head"><h3>الغرف النشطة</h3><span style="font-size:11.5px;color:var(--muted)">${S.data.rooms.length} غرفة</span></div>
    ${S.data.rooms
      .map(
        (room) => `<button class="room-row" data-act="room" data-id="${room.id}" data-testid="room-${room.id}">
          <div class="icon">${room.icon}</div>
          <div class="who">
            <b>${esc(room.name)}</b>
            <p>${esc(room.messages.length ? room.messages[room.messages.length - 1].text : room.topic)}</p>
          </div>
          <span style="font-size:11px;color:var(--muted)">${fmt(room.members)}</span>
        </button>`,
      )
      .join('')}
  </div>`;
}

function messagesHTML(room) {
  if (!room.messages.length) return `<p class="empty">لا توجد رسائل بعد — ابدأ الحديث.</p>`;
  return room.messages
    .map(
      (message) => `<div class="msg ${message.me ? 'me' : ''} ${message.gift ? 'gift' : ''}">
        ${message.me ? '' : `<span class="who">${esc(message.name)}</span>`}
        <p>${esc(message.text)}</p>
      </div>`,
    )
    .join('');
}

function roomHTML(id) {
  const room = S.data.rooms.find((item) => item.id === id);
  if (!room) return `<div class="empty">الغرفة غير موجودة.</div>`;
  return `<div class="chat-page">
    <div style="padding:10px 14px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:10px">
      <div class="avatar">${room.icon}</div>
      <div style="flex:1"><b style="font-size:13.5px">${esc(room.name)}</b>
        <div style="font-size:11.5px;color:var(--muted)">${esc(room.topic)} · ${fmt(room.members)} عضو</div>
      </div>
    </div>
    <div class="messages" id="messages">${messagesHTML(room)}</div>
    <div class="composer">
      <input data-testid="room-input" placeholder="اكتب رسالة..." />
      <button data-act="send-room" data-id="${room.id}" data-testid="send-room" aria-label="إرسال">${icon('send')}</button>
    </div>
  </div>`;
}

/* ---------------- live ---------------- */
function livesHTML() {
  return `<div class="page">
    <div class="section-head"><h3>بث مباشر الآن</h3><span style="font-size:11.5px;color:var(--muted)">${S.data.lives.length} بث</span></div>
    <div class="live-grid">${S.data.lives.map(liveCardHTML).join('')}</div>
    <p class="note">أرسل هدايا بالكوينز لدعم المذيعين أثناء البث المباشر.</p>
  </div>`;
}

function liveChatHTML(live) {
  return live.chat
    .map(
      (message) => `<div class="msg ${message.me ? 'me' : ''} ${message.gift ? 'gift' : ''}">
        ${message.me ? '' : `<span class="who">${esc(message.name)}</span>`}
        <p>${esc(message.text)}</p>
      </div>`,
    )
    .join('');
}

function liveHTML(id) {
  const live = S.data.lives.find((item) => item.id === id);
  if (!live) return `<div class="empty">البث غير موجود.</div>`;
  const host = creatorOf(live.creatorId);
  return `<div class="live-stage">
    <div class="live-bg">${mediaHTML(live.media)}</div>
    <div class="live-top">
      <button class="icon-btn" data-act="back" aria-label="رجوع">${icon('back')}</button>
      <div class="live-host">
        <div class="avatar" style="border-color:${host.color}">${host.emoji}</div>
        <div>
          <b>${esc(host.name)}</b>
          <div style="display:flex;gap:4px;align-items:center">
            <span class="pill"><i></i>مباشر</span>
          </div>
        </div>
      </div>
      <div class="viewers">${icon('eye')} ${fmt(live.viewers)}</div>
    </div>
    <div class="live-spacer"></div>
    <div class="live-chat" id="live-chat">${liveChatHTML(live)}</div>
    <div class="live-actions">
      <div class="gift-bar">
        ${S.data.gifts
          .map(
            (gift) => `<button class="gift" data-act="gift" data-id="${live.id}" data-gift="${gift.id}" data-testid="gift-${gift.id}">
              ${gift.emoji} ${gift.label} · ${gift.coins}
            </button>`,
          )
          .join('')}
      </div>
      <div class="composer">
        <input data-testid="live-input" placeholder="اكتب في البث..." />
        <button data-act="send-live" data-id="${live.id}" data-testid="send-live" aria-label="إرسال">${icon('send')}</button>
      </div>
    </div>
  </div>`;
}

async function refreshLive() {
  await loadState();
  const live = S.data.lives.find((item) => item.id === S.route.id);
  const box = document.getElementById('live-chat');
  if (live && box) {
    box.innerHTML = liveChatHTML(live);
    box.scrollTop = box.scrollHeight;
  }
}

async function refreshRoom() {
  await loadState();
  const room = S.data.rooms.find((item) => item.id === S.route.id);
  const box = document.getElementById('messages');
  if (room && box) {
    box.innerHTML = messagesHTML(room);
    box.scrollTop = box.scrollHeight;
  }
}

/* ---------------- profile ---------------- */
function tileHTML(post) {
  const inner =
    post.media.type === 'video'
      ? `<video src="${esc(post.media.src)}" muted playsinline preload="metadata"></video>`
      : post.media.type === 'image'
        ? `<img src="${esc(post.media.src)}" alt="" />`
        : `<div class="tile-emoji" style="background:linear-gradient(160deg,${post.media.g1},${post.media.g2})">${post.media.emoji}</div>`;
  return `<div class="tile">
    <button class="tile-open" data-act="post" data-id="${post.id}">${inner}<span class="views">▶ ${fmt(post.likes)}</span></button>
    ${post.creatorId === 'me' ? `<button class="tile-del" data-act="delete-post" data-id="${post.id}" data-testid="delete-${post.id}" aria-label="حذف الفيديو">✕</button>` : ''}
  </div>`;
}

function meHTML() {
  const me = S.data.me;
  const myPosts = S.data.posts.filter((post) => post.creatorId === 'me');
  const subs = me.subscriptions
    .map((sub) => ({...sub, creator: S.data.creators.find((c) => c.id === sub.creatorId)}))
    .filter((sub) => sub.creator);
  return `<div class="page">
    <div class="profile-head">
      <div class="avatar big" style="border-color:${me.color}">${me.emoji}</div>
      <h2>${esc(me.name)}</h2>
      <p class="handle">@${esc(me.handle)}</p>
      <p class="bio">${esc(me.bio)}</p>
      <div class="stats">
        <div><b>${myPosts.length}</b><span>فيديو</span></div>
        <div><b>${fmt(me.following.length)}</b><span>يتابع</span></div>
        <div><b>${nf(me.coins)}</b><span>كوين</span></div>
      </div>
    </div>
    <div class="coin-card">
      <div><span>رصيد الكوينز</span><b>🪙 ${nf(me.coins)}</b></div>
      <button class="btn primary" data-act="wallet" data-testid="buy-coins-btn">شراء كوينز</button>
    </div>
    <div class="section-head"><h3>فيديوهاتي</h3><button data-act="nav" data-to="create">+ نشر</button></div>
    ${myPosts.length ? `<div class="grid">${myPosts.map(tileHTML).join('')}</div>` : `<p class="empty">لم تنشر أي فيديو بعد — اضغط + وانشر أول مقطع.</p>`}
    <div class="section-head"><h3>اشتراكاتي</h3></div>
    ${
      subs.length
        ? subs
            .map(
              (sub) => `<div class="sub-row">
                <div class="avatar" style="border-color:${sub.creator.color}">${sub.creator.emoji}</div>
                <div><b style="font-size:13px">${esc(sub.creator.name)}</b><div style="font-size:11.5px;color:var(--muted)">@${esc(sub.creator.handle)}</div></div>
                <span class="badge">${esc(sub.tierName)}</span>
              </div>`,
            )
            .join('')
        : `<p class="empty">لا توجد اشتراكات — اشترك في صفحاتك المفضلة بالكوينز.</p>`
    }
  </div>`;
}

function creatorHTML(id) {
  const creator = creatorOf(id);
  const posts = S.data.posts.filter((post) => post.creatorId === creator.id);
  const following = S.data.me.following.includes(creator.id);
  const sub = S.data.me.subscriptions.find((item) => item.creatorId === creator.id);
  return `<div class="page">
    <div class="profile-head">
      <div class="avatar big" style="border-color:${creator.color}">${creator.emoji}</div>
      <h2>${esc(creator.name)} ${creator.verified ? '<i class="verified">✓</i>' : ''}</h2>
      <p class="handle">@${esc(creator.handle)}</p>
      <p class="bio">${esc(creator.bio)}</p>
      <div class="stats">
        <div><b>${fmt(creator.followers)}</b><span>متابع</span></div>
        <div><b>${posts.length}</b><span>فيديو</span></div>
        <div><b>${sub ? esc(sub.tierName) : '—'}</b><span>الاشتراك</span></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="btn ${following ? 'ghost' : 'primary'}" data-act="follow" data-id="${creator.id}" data-testid="creator-follow">${following ? 'إلغاء المتابعة' : 'متابعة'}</button>
        <button class="btn outline" data-act="tiers" data-id="${creator.id}" data-testid="creator-subscribe">${sub ? 'تجديد الاشتراك' : 'اشتراك بالكوينز'}</button>
      </div>
    </div>
    <div class="section-head"><h3>فيديوهاته</h3></div>
    ${posts.length ? `<div class="grid">${posts.map(tileHTML).join('')}</div>` : `<p class="empty">لا توجد فيديوهات بعد.</p>`}
  </div>`;
}

/* ---------------- wallet ---------------- */
function walletHTML() {
  return `<div class="page">
    <div class="balance-card">
      <span>رصيدك الحالي</span>
      <b>🪙 ${nf(S.data.me.coins)}</b>
      <span>كوين — يُستخدم للهدايا والاشتراك في الصفحات المشهورة</span>
    </div>
    <div class="section-head"><h3>حزم الكوينز</h3></div>
    <div class="packages">
      ${S.data.packages
        .map(
          (pack) => `<button class="pack" data-act="buy" data-id="${pack.id}" data-testid="buy-${pack.id}">
            <b>${nf(pack.coins)} كوين</b>
            <span>${esc(pack.label)}${pack.bonus ? ` · +${pack.bonus} هدية` : ''}</span>
            <em>${pack.price} ر.س</em>
          </button>`,
        )
        .join('')}
    </div>
    <p class="note">الدفع الحالي تجريبي ولا يخصم أي مبلغ. في المرحلة المتقدمة سيتم ربط بوابة الدفع لشراء الكوينز والاشتراك في الصفحات المشهورة.</p>
    <div class="section-head"><h3>سجل العمليات</h3></div>
    ${S.data.transactions
      .map(
        (tx) => `<div class="tx-row">
          <span>${tx.type === 'buy' ? '🪙' : tx.type === 'gift' ? '🎁' : tx.type === 'subscribe' ? '⭐' : '✨'}</span>
          <div style="flex:1">${esc(tx.label)}</div>
          <span class="amt ${tx.amount > 0 ? 'plus' : 'minus'}">${tx.amount > 0 ? '+' : ''}${nf(tx.amount)}</span>
        </div>`,
      )
      .join('')}
  </div>`;
}

/* ---------------- sheets ---------------- */
function openSheet(html) {
  const overlay = document.getElementById('overlay');
  overlay.innerHTML = `<div class="sheet-backdrop" data-act="close-sheet"></div><div class="sheet">${html}</div>`;
  overlay.classList.add('open');
}

function closeSheet() {
  const overlay = document.getElementById('overlay');
  overlay.classList.remove('open');
  overlay.innerHTML = '';
}

function commentsHTML(post) {
  if (!post.comments.length) return `<p class="empty">كن أول من يعلّق.</p>`;
  return post.comments
    .map(
      (comment) => `<div class="comment">
        <div class="avatar">${comment.me ? '🙂' : '💬'}</div>
        <div><b>${esc(comment.name)}</b><p>${esc(comment.text)}</p></div>
      </div>`,
    )
    .join('');
}

function openComments(postId) {
  const post = findPost(postId);
  if (!post) return;
  openSheet(`<div class="sheet-grip"></div>
    <div class="sheet-head"><h3>التعليقات (${post.comments.length})</h3><button data-act="close-sheet" aria-label="إغلاق">✕</button></div>
    <div class="comments" id="comments-list">${commentsHTML(post)}</div>
    <div class="composer">
      <input data-testid="comment-input" placeholder="أضف تعليقاً..." />
      <button data-act="send-comment" data-id="${post.id}" data-testid="send-comment" aria-label="إرسال">${icon('send')}</button>
    </div>`);
  setTimeout(() => document.querySelector('[data-testid="comment-input"]')?.focus(), 50);
}

function openPay(packageId) {
  const pack = S.data.packages.find((item) => item.id === packageId);
  if (!pack) return;
  const total = pack.coins + pack.bonus;
  openSheet(`<div class="sheet-grip"></div>
    <h3>تأكيد الشراء</h3>
    <div class="pay-summary"><span>${nf(pack.coins)} كوين${pack.bonus ? ` + ${pack.bonus} هدية` : ''}</span><b>${pack.price} ر.س</b></div>
    <p class="note">دفع تجريبي — لن يتم خصم أي مبلغ فعلي. ستُضاف ${nf(total)} كوين إلى رصيدك مباشرة.</p>
    <button class="btn primary block" data-act="confirm-buy" data-id="${pack.id}" data-testid="confirm-buy">تأكيد الدفع</button>
    <button class="btn ghost block" data-act="close-sheet">إلغاء</button>`);
}

function openTiers(creatorId) {
  const creator = creatorOf(creatorId);
  openSheet(`<div class="sheet-grip"></div>
    <h3>اشترك في ${esc(creator.name)}</h3>
    ${creator.tiers
      .map(
        (tier) => `<div class="tier">
          <div class="avatar" style="border-color:${creator.color}">⭐</div>
          <div class="who"><b>${esc(tier.name)}</b><span>${esc(tier.perks)}</span></div>
          <button class="btn primary" data-act="subscribe" data-id="${creator.id}" data-tier="${tier.id}" data-testid="tier-${tier.id}">${tier.coins} 🪙</button>
        </div>`,
      )
      .join('')}
    <p class="note">الاشتراك شهري بالكوينز ويمنحك شارة بجانب اسمك في البث والغرف.</p>`);
}

function openNewRoom() {
  openSheet(`<div class="sheet-grip"></div>
    <h3>غرفة دردشة جديدة</h3>
    <div class="field"><label>اسم الغرفة</label><input data-testid="room-name" placeholder="مثال: سوالف الليل" /></div>
    <div class="field"><label>الموضوع</label><input data-testid="room-topic" placeholder="عن ماذا تتحدث الغرفة؟" /></div>
    <button class="btn primary block" data-act="create-room" data-testid="create-room">إنشاء الغرفة</button>`);
}

/* ---------------- actions ---------------- */
function updateCoins() {
  document.querySelectorAll('.coin-chip').forEach((el) => {
    el.innerHTML = `🪙 ${fmt(S.data.me.coins)}`;
  });
}

function updatePostButton(postId, act, value, count) {
  const btn = document.querySelector(`[data-act="${act}"][data-id="${postId}"]`);
  if (!btn) return;
  if (value !== undefined) btn.classList.toggle('on', Boolean(value));
  if (count !== undefined) {
    const counter = btn.querySelector('[data-count]');
    if (counter) counter.textContent = fmt(count);
  }
}

function handleError(error) {
  if (error.status === 402) {
    toast('رصيد الكوينز غير كافٍ — اشترِ كوينز أولاً');
    navigate({name: 'wallet'});
    return;
  }
  toast('تعذّر إتمام العملية، حاول مرة أخرى');
  console.error(error);
}

document.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-act]');
  if (!target) return;
  const act = target.dataset.act;
  const id = target.dataset.id;
  try {
    if (act === 'nav') {
      S.stack = [];
      navigate({name: target.dataset.to}, {stack: false});
      return;
    }
    if (act === 'back') return goBack();
    if (act === 'close-sheet') return closeSheet();
    if (act === 'wallet') return navigate({name: 'wallet'});
    if (act === 'lives') return navigate({name: 'lives'});
    if (act === 'feedtab') {
      S.tab = target.dataset.tab;
      return render();
    }
    if (act === 'creator') return navigate({name: 'creator', id});
    if (act === 'post') {
      S.scrollTo = id;
      S.stack = [];
      return navigate({name: 'feed'}, {stack: false});
    }
    if (act === 'delete-post') {
      const response = await fetch(`/api/posts/${id}`, {method: 'DELETE'});
      if (!response.ok) throw new Error('delete_failed');
      S.data.posts = S.data.posts.filter((post) => post.id !== id);
      render();
      toast('تم حذف الفيديو');
      return;
    }
    if (act === 'room') return navigate({name: 'room', id});
    if (act === 'live') return navigate({name: 'live', id});
    if (act === 'new-room') return openNewRoom();
    if (act === 'tiers') return openTiers(id);
    if (act === 'buy') return openPay(id);

    if (act === 'like') {
      const result = await api(`/api/posts/${id}/like`);
      const post = findPost(id);
      if (post) Object.assign(post, {liked: result.liked, likes: result.likes});
      updatePostButton(id, 'like', result.liked, result.likes);
      return;
    }
    if (act === 'save') {
      const result = await api(`/api/posts/${id}/save`);
      const post = findPost(id);
      if (post) Object.assign(post, {saved: result.saved, saves: result.saves});
      updatePostButton(id, 'save', result.saved, result.saves);
      toast(result.saved ? 'تم الحفظ في المفضلة 🔖' : 'تمت الإزالة من المفضلة');
      return;
    }
    if (act === 'share') {
      const result = await api(`/api/posts/${id}/share`);
      const post = findPost(id);
      if (post) post.shares = result.shares;
      updatePostButton(id, 'share', undefined, result.shares);
      toast('تمت مشاركة الفيديو ↗');
      return;
    }
    if (act === 'comments') return openComments(id);
    if (act === 'send-comment') {
      const input = document.querySelector('[data-testid="comment-input"]');
      const text = (input?.value || '').trim();
      if (!text) return toast('اكتب تعليقاً أولاً');
      const result = await api(`/api/posts/${id}/comments`, {text});
      const post = findPost(id);
      if (post) post.comments = result.comments;
      const list = document.getElementById('comments-list');
      if (list && post) list.innerHTML = commentsHTML(post);
      if (input) input.value = '';
      updatePostButton(id, 'comments', undefined, post.comments.length);
      toast('تم إضافة تعليقك 💬');
      return;
    }
    if (act === 'follow') {
      const result = await api(`/api/creators/${id}/follow`);
      S.data.me.following = result.me.following;
      const creator = creatorOf(id);
      if (creator && creator.id !== 'me') creator.followers = result.followers;
      if (S.route.name === 'feed') {
        const badge = document.querySelector(`[data-act="follow"][data-id="${id}"]`);
        if (badge) {
          badge.classList.toggle('on', result.following);
          badge.textContent = result.following ? '✓' : '+';
        }
        const rowBtn = document.querySelector(`[data-testid="discover-follow-${id}"]`);
        if (rowBtn) rowBtn.textContent = result.following ? 'متابع' : 'متابعة';
        toast(result.following ? 'تمت المتابعة ✅' : 'تم إلغاء المتابعة');
      } else {
        render();
        toast(result.following ? 'تمت المتابعة ✅' : 'تم إلغاء المتابعة');
      }
      return;
    }
    if (act === 'confirm-buy') {
      const result = await api('/api/wallet/buy', {packageId: id});
      S.data.me = result.me;
      S.data.transactions = result.transactions;
      closeSheet();
      updateCoins();
      if (S.route.name === 'wallet') render();
      toast(`تمت إضافة الكوينز 🪙 (دفع تجريبي)`);
      return;
    }
    if (act === 'subscribe') {
      const result = await api(`/api/creators/${id}/subscribe`, {tierId: target.dataset.tier});
      S.data.me = result.me;
      closeSheet();
      updateCoins();
      render();
      toast('تم تفعيل الاشتراك ⭐');
      return;
    }
    if (act === 'gift') {
      const result = await api(`/api/lives/${id}/gift`, {giftId: target.dataset.gift});
      S.data.me = result.me;
      const live = S.data.lives.find((item) => item.id === id);
      if (live) live.chat = result.chat;
      updateCoins();
      const box = document.getElementById('live-chat');
      if (box && live) {
        box.innerHTML = liveChatHTML(live);
        box.scrollTop = box.scrollHeight;
      }
      toast('تم إرسال الهدية 🎁');
      return;
    }
    if (act === 'send-live') {
      const input = document.querySelector('[data-testid="live-input"]');
      const text = (input?.value || '').trim();
      if (!text) return;
      const result = await api(`/api/lives/${id}/chat`, {text});
      const live = S.data.lives.find((item) => item.id === id);
      if (live) live.chat = result.chat;
      if (input) input.value = '';
      const box = document.getElementById('live-chat');
      if (box && live) {
        box.innerHTML = liveChatHTML(live);
        box.scrollTop = box.scrollHeight;
      }
      return;
    }
    if (act === 'send-room') {
      const input = document.querySelector('[data-testid="room-input"]');
      const text = (input?.value || '').trim();
      if (!text) return;
      const result = await api(`/api/rooms/${id}/messages`, {text});
      const room = S.data.rooms.find((item) => item.id === id);
      if (room) room.messages = result.messages;
      if (input) input.value = '';
      const box = document.getElementById('messages');
      if (box && room) {
        box.innerHTML = messagesHTML(room);
        box.scrollTop = box.scrollHeight;
      }
      return;
    }
    if (act === 'create-room') {
      const name = document.querySelector('[data-testid="room-name"]')?.value.trim();
      const topic = document.querySelector('[data-testid="room-topic"]')?.value.trim();
      if (!name) return toast('اكتب اسم الغرفة');
      const result = await api('/api/rooms', {name, topic});
      S.data.rooms.unshift(result.room);
      closeSheet();
      toast('تم إنشاء الغرفة 💬');
      navigate({name: 'room', id: result.room.id});
      return;
    }
    if (act === 'publish') {
      const caption = document.querySelector('[data-testid="caption-input"]')?.value.trim();
      if (!caption) return toast('اكتب وصفاً للفيديو أولاً');
      const rawTags = document.querySelector('[data-testid="tags-input"]')?.value.trim() || '';
      const hashtags = rawTags
        .split(/[\s,]+/)
        .filter(Boolean)
        .slice(0, 6)
        .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`));
      const body = {caption, hashtags};
      if (S.pendingMedia) body.dataUrl = S.pendingMedia.dataUrl;
      target.disabled = true;
      await api('/api/posts', body);
      S.pendingMedia = null;
      await loadState();
      S.stack = [];
      navigate({name: 'feed'}, {stack: false});
      toast('تم نشر الفيديو ✅');
      return;
    }
  } catch (error) {
    handleError(error);
  }
});

document.addEventListener('change', (event) => {
  const input = event.target.closest('[data-testid="file-input"]');
  if (!input || !input.files || !input.files[0]) return;
  const file = input.files[0];
  if (file.size > 45 * 1024 * 1024) {
    toast('الملف كبير جداً — الحد 45 ميجابايت');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    S.pendingMedia = {dataUrl: reader.result, type: file.type.startsWith('video') ? 'video' : 'image'};
    const preview = document.getElementById('upload-preview');
    if (!preview) return;
    preview.innerHTML =
      file.type.startsWith('video')
        ? `<video src="${reader.result}" muted loop playsinline autoplay></video>`
        : `<img src="${reader.result}" alt="" />`;
    toast('تم اختيار الملف — أضف الوصف وانشر');
  };
  reader.readAsDataURL(file);
});

document.addEventListener('input', (event) => {
  const input = event.target.closest('[data-act="search"]');
  if (!input) return;
  const query = input.value.trim().toLowerCase();
  document.querySelectorAll('[data-searchable]').forEach((row) => {
    row.style.display = !query || row.dataset.searchable.toLowerCase().includes(query) ? '' : 'none';
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeSheet();
});

/* ---------------- boot ---------------- */
(async () => {
  await loadState();
  render();
})();
