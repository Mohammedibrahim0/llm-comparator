// فيديو قصيرة — خادم التطبيق.
// Node فقط، بدون حزم خارجية: يخدم واجهة التطبيق وواجهة JSON للتغذية والغرف والبث والكوينز.
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

import {stripeConfigured, stripeCurrency, stripeRequest, verifyWebhookSignature} from './stripe.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PORT = Number(process.env.PORT || 3000);
const MAX_BODY = 60 * 1024 * 1024;

const uid = (prefix = 'id') => `${prefix}_${crypto.randomBytes(5).toString('hex')}`;
const iso = (offsetMinutes = 0) => new Date(Date.now() - offsetMinutes * 60000).toISOString();

const PACKAGES = [
  {id: 'p100', coins: 100, bonus: 0, price: 5, label: 'حزمة البداية'},
  {id: 'p500', coins: 500, bonus: 25, price: 20, label: 'الحزمة الشائعة'},
  {id: 'p1200', coins: 1200, bonus: 120, price: 40, label: 'حزمة المبدعين'},
  {id: 'p3000', coins: 3000, bonus: 450, price: 90, label: 'حزمة النجوم'},
];

const GIFTS = [
  {id: 'rose', label: 'وردة', emoji: '🌹', coins: 1},
  {id: 'heart', label: 'قلب', emoji: '❤️', coins: 5},
  {id: 'rocket', label: 'صاروخ', emoji: '🚀', coins: 99},
  {id: 'crown', label: 'تاج', emoji: '👑', coins: 499},
];

// أسعار الاشتراكات بالوحدة الصغرى للعملة (هللة/سنت) — تُدفع بالبطاقة عبر Stripe.
const TIER_PRICES = {basic: 900, plus: 2900, vip: 7900};

const TIERS = [
  {id: 'basic', name: 'أساسي', coins: 99, perks: 'شارة المشترك + منشورات خاصة'},
  {id: 'plus', name: 'مميز', coins: 299, perks: 'شارة + أولوية في الردود + غرفة خاصة'},
  {id: 'vip', name: 'VIP', coins: 999, perks: 'كل الميزات + بث خاص للمشتركين'},
];

const ROOM_REPLIES = [
  'أهلاً فيك 👋',
  'كلامك صح والله',
  'أنا معك في هذي 🙌',
  'وش رايكم بالمقطع الجديد؟',
  'من وين أنت؟',
  '😂😂😂',
  'تم المتابعة ✅',
];
const LIVE_REPLIES = [
  'يا سلام على البث 🔥',
  'أول مرة أحضر بثك',
  'كمّل كمّل 👏',
  'تحياتي من صنعاء 🇾🇪',
  'متابع من أول يوم ❤️',
  'أرسلتلك وردة 🌹',
];

function seed() {
  const tiers = () => TIERS.map((t) => ({...t}));
  const creators = [
    {id: 'c1', name: 'نورة', handle: 'noura', emoji: '👩🏻', color: '#FE2C55', bio: 'أزياء وإطلالات يومية', followers: 128400, verified: true, tiers: tiers()},
    {id: 'c2', name: 'فهد', handle: 'fahad', emoji: '🧑🏻', color: '#25F4EE', bio: 'تحديات ورياضة', followers: 92500, verified: true, tiers: tiers()},
    {id: 'c3', name: 'ليان', handle: 'layan', emoji: '👩🏽', color: '#FFC94A', bio: 'وصفات سريعة في دقيقة', followers: 54800, verified: false, tiers: tiers()},
    {id: 'c4', name: 'عمر', handle: 'omar', emoji: '🧔🏻', color: '#7C5CFF', bio: 'سفر ومغامرات', followers: 210300, verified: true, tiers: tiers()},
    {id: 'c5', name: 'دانة', handle: 'dana', emoji: '💃', color: '#FF7A45', bio: 'رقص وكوريغرافيا', followers: 76400, verified: false, tiers: tiers()},
    {id: 'c6', name: 'سلطان', handle: 'sultan', emoji: '😂', color: '#3DDC84', bio: 'ستاند أب وضحك', followers: 312000, verified: true, tiers: tiers()},
  ];

  const posts = [
    {
      id: 'p1', creatorId: 'c4', caption: 'مقطع سينمائي قصير ✨', hashtags: ['#سينما', '#إبداع'],
      media: {type: 'video', src: '/media/sintel.mp4'}, likes: 18400, shares: 320, saves: 1200,
      sound: 'الصوت الأصلي — عمر', at: iso(12),
      comments: [
        {id: 'cm1', name: 'ريم', text: 'ما شاء الله إبداع 🔥', at: iso(10)},
        {id: 'cm2', name: 'خالد', text: 'أفضل مقطع شفته اليوم', at: iso(8)},
      ],
    },
    {
      id: 'p2', creatorId: 'c1', caption: 'إطلالة الشتاء الجديدة ❄️', hashtags: ['#موضة', '#شتاء'],
      media: {type: 'gradient', g1: '#3a0d2e', g2: '#FE2C55', emoji: '🧥'}, likes: 9210, shares: 140, saves: 640,
      sound: 'أغنية الترند — Winter Vibes', at: iso(25),
      comments: [{id: 'cm3', name: 'سارة', text: 'وين أشتري الجاكيت؟ 😍', at: iso(20)}],
    },
    {
      id: 'p3', creatorId: 'c6', caption: 'لما تنسى مفتاح البيت 😂', hashtags: ['#ضحك', '#كوميديا'],
      media: {type: 'video', src: '/media/bunny.mp4'}, likes: 45200, shares: 2100, saves: 3300,
      sound: 'الصوت الأصلي — سلطان', at: iso(40),
      comments: [
        {id: 'cm4', name: 'أبو تركي', text: 'هههههههه والله نفسي', at: iso(35)},
        {id: 'cm5', name: 'نوف', text: 'أضحك لحالي 😂', at: iso(30)},
      ],
    },
    {
      id: 'p4', creatorId: 'c5', caption: 'كوريغرافيا على الترند 🔥', hashtags: ['#رقص', '#ترند'],
      media: {type: 'gradient', g1: '#1b0533', g2: '#7C5CFF', emoji: '💃'}, likes: 27600, shares: 980, saves: 1500,
      sound: 'Beat Drop — Dana', at: iso(55),
      comments: [{id: 'cm6', name: 'لينا', text: 'علّمينا الحركة 🙏', at: iso(50)}],
    },
    {
      id: 'p5', creatorId: 'c3', caption: 'وصفة العشاء في ١٠ ثواني 🍳', hashtags: ['#وصفات', '#طبخ'],
      media: {type: 'gradient', g1: '#3b1a00', g2: '#FFC94A', emoji: '🍝'}, likes: 12800, shares: 410, saves: 2600,
      sound: 'مطبخ ليان', at: iso(70),
      comments: [{id: 'cm7', name: 'منى', text: 'جربتها وطلعت رهيبة 😋', at: iso(60)}],
    },
    {
      id: 'p6', creatorId: 'c4', caption: 'عالم تحت الماء 🪼', hashtags: ['#طبيعة', '#سفر'],
      media: {type: 'video', src: '/media/jellyfish.mp4'}, likes: 33100, shares: 720, saves: 1900,
      sound: 'Ocean Dreams', at: iso(90),
      comments: [{id: 'cm8', name: 'يوسف', text: 'سبحان الله 😍', at: iso(85)}],
    },
    {
      id: 'p7', creatorId: 'c2', caption: 'تحدي ١٠٠ تمرين 💪', hashtags: ['#تحدي', '#رياضة'],
      media: {type: 'gradient', g1: '#00262b', g2: '#25F4EE', emoji: '🏋️'}, likes: 7600, shares: 210, saves: 520,
      sound: 'Gym Motivation', at: iso(120),
      comments: [],
    },
    {
      id: 'p8', creatorId: 'c1', caption: 'روتين الصباح في ٣٠ ثانية ☀️', hashtags: ['#روتين', '#يوميات'],
      media: {type: 'gradient', g1: '#2b0a1c', g2: '#FF7A45', emoji: '☀️'}, likes: 15400, shares: 330, saves: 880,
      sound: 'Morning Light', at: iso(150),
      comments: [{id: 'cm9', name: 'هند', text: 'أحب مقاطعك 🌸', at: iso(140)}],
    },
  ];

  const rooms = [
    {
      id: 'r1', name: 'قهوة وسوالف', topic: 'دردشة عامة لكل الناس', icon: '☕', members: 1240, at: iso(5),
      messages: [
        {id: 'm1', name: 'ريم', text: 'صباح الخير جميعاً ☀️', at: iso(40)},
        {id: 'm2', name: 'خالد', text: 'صباح النور، وش أخباركم؟', at: iso(38)},
        {id: 'm3', name: 'نوف', text: 'شفتوا مقطع سلطان الجديد؟ 😂', at: iso(30)},
        {id: 'm4', name: 'ريم', text: 'إيه، ما توقفت عن الضحك', at: iso(28)},
      ],
    },
    {
      id: 'r2', name: 'غرفة المبدعين', topic: 'نصائح للنشر وصناعة المحتوى', icon: '🎬', members: 680, at: iso(20),
      messages: [
        {id: 'm5', name: 'عمر', text: 'أفضل وقت للنشر عادة بعد المغرب', at: iso(60)},
        {id: 'm6', name: 'ليان', text: 'جربت وجبت نتائج حلوة ✅', at: iso(55)},
      ],
    },
    {
      id: 'r3', name: 'موسيقى وأغاني', topic: 'شارك الترند اللي تحبه', icon: '🎧', members: 2150, at: iso(45),
      messages: [
        {id: 'm7', name: 'دانة', text: 'ترند هذا الأسبوع رهيب 🔥', at: iso(90)},
        {id: 'm8', name: 'فهد', text: 'أرفقوه لنا هنا', at: iso(88)},
      ],
    },
  ];

  const lives = [
    {
      id: 'l1', creatorId: 'c1', title: 'أسئلة وأجوبة مع نورة', viewers: 1840, at: iso(30),
      media: {type: 'gradient', g1: '#3a0d2e', g2: '#FE2C55', emoji: '🎤'},
      chat: [
        {id: 'lc1', name: 'ريم', text: 'أهلاً نورة ❤️', at: iso(20)},
        {id: 'lc2', name: 'خالد', text: 'كمّل كمّل 🔥', at: iso(18)},
      ],
    },
    {
      id: 'l2', creatorId: 'c6', title: 'ستاند أب مباشر 😂', viewers: 4260, at: iso(15),
      media: {type: 'video', src: '/media/bunny.mp4'},
      chat: [
        {id: 'lc3', name: 'أبو تركي', text: 'والله ضحكت من قلبي', at: iso(12)},
        {id: 'lc4', name: 'نوف', text: 'أرسلتلك تاج 👑', at: iso(10)},
      ],
    },
    {
      id: 'l3', creatorId: 'c5', title: 'رقص على الطلب 💃', viewers: 940, at: iso(8),
      media: {type: 'gradient', g1: '#1b0533', g2: '#7C5CFF', emoji: '🎶'},
      chat: [{id: 'lc5', name: 'لينا', text: 'طلبت أغنية جديدة', at: iso(6)}],
    },
  ];

  return {
    me: {
      id: 'me', name: 'أنت', handle: 'you', emoji: '🙂', color: '#FE2C55',
      bio: 'أهلاً بك في فيديو قصيرة', coins: 1200, following: ['c1'], subscriptions: [],
    },
    creators,
    posts,
    rooms,
    lives,
    packages: PACKAGES,
    gifts: GIFTS,
    transactions: [{id: uid('tx'), type: 'bonus', label: 'هدية ترحيبية', amount: 1200, at: iso(200)}],
    hashtags: [
      {tag: '#تحدي_الرقص', views: 2100000},
      {tag: '#ضحك', views: 3200000},
      {tag: '#وصفات_سريعة', views: 890000},
      {tag: '#السفر', views: 1400000},
      {tag: '#موضة', views: 760000},
      {tag: '#بث_مباشر', views: 540000},
    ],
  };
}

let db;
try {
  db = JSON.parse(await fsp.readFile(DB_FILE, 'utf8'));
} catch {
  db = seed();
  await fsp.mkdir(DATA_DIR, {recursive: true});
  await fsp.writeFile(DB_FILE, JSON.stringify(db, null, 2));
}
await fsp.mkdir(UPLOAD_DIR, {recursive: true});

db.payments = db.payments || [];

let saveChain = Promise.resolve();
function save() {
  const snapshot = JSON.stringify(db, null, 2);
  saveChain = saveChain
    .then(async () => {
      await fsp.writeFile(`${DB_FILE}.tmp`, snapshot);
      await fsp.rename(`${DB_FILE}.tmp`, DB_FILE);
    })
    .catch((err) => console.error('save failed', err));
  return saveChain;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const buffer = await readBody(req);
  if (!buffer.length) return {};
  return JSON.parse(buffer.toString('utf8'));
}

function creatorById(id) {
  if (id === 'me') return db.me;
  return db.creators.find((c) => c.id === id);
}

function findPost(id) {
  return db.posts.find((p) => p.id === id);
}

function publicState() {
  return {
    ...db,
    payments: {configured: stripeConfigured(), currency: stripeCurrency()},
    tierPrices: TIER_PRICES,
  };
}

function siteOrigin(req) {
  const origin = req.headers.origin;
  if (origin && /^https?:\/\/[^/]+$/.test(origin)) return origin;
  return `http://${req.headers.host || `localhost:${PORT}`}`;
}

// تُستدعى مرة واحدة لكل جلسة دفع: تضيف الكوينز أو تفعّل الاشتراك.
async function fulfillSession(session) {
  const sessionId = session.id;
  if (!sessionId) return null;
  const meta = session.metadata || {};
  if (db.payments.some((entry) => entry.sessionId === sessionId)) return meta.kind || null;

  if (meta.kind === 'coins') {
    const pack = PACKAGES.find((p) => p.id === meta.packageId);
    if (!pack) return null;
    const total = pack.coins + pack.bonus;
    db.me.coins += total;
    db.transactions.unshift({
      id: uid('tx'),
      type: 'buy',
      label: `شراء ${pack.coins} كوين — بطاقة`,
      amount: total,
      at: iso(),
    });
  } else if (meta.kind === 'subscription') {
    const creator = creatorById(meta.creatorId);
    const tier = creator?.tiers?.find((t) => t.id === meta.tierId);
    if (!creator || !tier) return null;
    db.me.subscriptions = db.me.subscriptions.filter((sub) => sub.creatorId !== creator.id);
    db.me.subscriptions.push({creatorId: creator.id, tierId: tier.id, tierName: tier.name, at: iso()});
    if (!db.me.following.includes(creator.id)) db.me.following.push(creator.id);
  } else {
    return null;
  }

  db.payments.push({sessionId, kind: meta.kind, at: iso()});
  await save();
  return meta.kind;
}

function spend(amount, label, type) {
  if (db.me.coins < amount) return false;
  db.me.coins -= amount;
  db.transactions.unshift({id: uid('tx'), type, label, amount: -amount, at: iso()});
  return true;
}

function pushReply(list, pool) {
  if (Math.random() > 0.55) return;
  const names = ['ريم', 'خالد', 'نوف', 'يوسف', 'هند', 'أبو تركي'];
  list.push({
    id: uid('msg'),
    name: names[Math.floor(Math.random() * names.length)],
    text: pool[Math.floor(Math.random() * pool.length)],
    at: iso(),
  });
}

async function handleApi(req, res, url) {
  const {pathname} = url;
  const method = req.method;
  const parts = pathname.split('/').filter(Boolean); // ['api', ...]

  if (method === 'GET' && pathname === '/api/health') return sendJson(res, 200, {ok: true});
  if (method === 'GET' && pathname === '/api/state') return sendJson(res, 200, publicState());

  // نشر مقطع
  if (method === 'POST' && pathname === '/api/posts') {
    const body = await readJson(req);
    const caption = String(body.caption || '').trim().slice(0, 400);
    if (!caption) return sendJson(res, 400, {error: 'caption_required'});
    let media = {type: 'gradient', g1: '#2b0a1c', g2: '#FE2C55', emoji: '🎬'};
    const dataUrl = body.dataUrl;
    if (dataUrl) {
      const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
      if (!match) return sendJson(res, 400, {error: 'bad_media'});
      const [, mime, base64] = match;
      const ext = mime.includes('video') ? 'mp4' : mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
      const filename = `${uid('media')}.${ext}`;
      await fsp.writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(base64, 'base64'));
      media = {type: mime.startsWith('video') ? 'video' : 'image', src: `/uploads/${filename}`};
    }
    const post = {
      id: uid('post'),
      creatorId: 'me',
      caption,
      hashtags: (body.hashtags || []).slice(0, 6),
      media,
      likes: 0,
      shares: 0,
      saves: 0,
      sound: 'الصوت الأصلي — أنت',
      at: iso(),
      comments: [],
    };
    db.posts.unshift(post);
    await save();
    return sendJson(res, 200, {ok: true, post, me: db.me});
  }

  if (method === 'DELETE' && parts[1] === 'posts' && parts[2]) {
    const post = findPost(parts[2]);
    if (!post) return sendJson(res, 404, {error: 'not_found'});
    if (post.creatorId !== 'me') return sendJson(res, 403, {error: 'forbidden'});
    db.posts = db.posts.filter((item) => item.id !== post.id);
    await save();
    return sendJson(res, 200, {ok: true});
  }

  // تفاعلات المنشور
  if (method === 'POST' && parts[1] === 'posts' && parts[3] === 'like') {
    const post = findPost(parts[2]);
    if (!post) return sendJson(res, 404, {error: 'not_found'});
    post.liked = !post.liked;
    post.likes += post.liked ? 1 : -1;
    await save();
    return sendJson(res, 200, {ok: true, likes: post.likes, liked: post.liked});
  }
  if (method === 'POST' && parts[1] === 'posts' && parts[3] === 'save') {
    const post = findPost(parts[2]);
    if (!post) return sendJson(res, 404, {error: 'not_found'});
    post.saved = !post.saved;
    post.saves += post.saved ? 1 : -1;
    await save();
    return sendJson(res, 200, {ok: true, saved: post.saved, saves: post.saves});
  }
  if (method === 'POST' && parts[1] === 'posts' && parts[3] === 'share') {
    const post = findPost(parts[2]);
    if (!post) return sendJson(res, 404, {error: 'not_found'});
    post.shares += 1;
    await save();
    return sendJson(res, 200, {ok: true, shares: post.shares});
  }
  if (method === 'POST' && parts[1] === 'posts' && parts[3] === 'comments') {
    const post = findPost(parts[2]);
    if (!post) return sendJson(res, 404, {error: 'not_found'});
    const body = await readJson(req);
    const text = String(body.text || '').trim().slice(0, 300);
    if (!text) return sendJson(res, 400, {error: 'text_required'});
    const comment = {id: uid('cm'), name: 'أنت', text, at: iso(), me: true};
    post.comments.push(comment);
    await save();
    return sendJson(res, 200, {ok: true, comment, comments: post.comments});
  }

  // متابعة واشتراك
  if (method === 'POST' && parts[1] === 'creators' && parts[3] === 'follow') {
    const creator = creatorById(parts[2]);
    if (!creator) return sendJson(res, 404, {error: 'not_found'});
    const following = db.me.following.includes(creator.id);
    if (following) {
      db.me.following = db.me.following.filter((id) => id !== creator.id);
      creator.followers = Math.max(0, creator.followers - 1);
    } else {
      db.me.following.push(creator.id);
      creator.followers += 1;
    }
    await save();
    return sendJson(res, 200, {ok: true, following: !following, followers: creator.followers, me: db.me});
  }
  // ------- الدفع الحقيقي عبر Stripe -------
  if (method === 'POST' && pathname === '/api/checkout/coins') {
    if (!stripeConfigured()) return sendJson(res, 503, {error: 'payments_not_configured'});
    const body = await readJson(req);
    const pack = PACKAGES.find((item) => item.id === body.packageId);
    if (!pack) return sendJson(res, 400, {error: 'bad_package'});
    const origin = siteOrigin(req);
    const session = await stripeRequest('/checkout/sessions', {
      mode: 'payment',
      success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancel`,
      line_items: [
        {
          price_data: {
            currency: stripeCurrency(),
            unit_amount: pack.price * 100,
            product_data: {name: `${pack.coins} كوين — فيديو قصيرة`},
          },
          quantity: 1,
        },
      ],
      metadata: {kind: 'coins', packageId: pack.id},
    });
    return sendJson(res, 200, {ok: true, url: session.url});
  }

  if (method === 'POST' && pathname === '/api/checkout/subscription') {
    if (!stripeConfigured()) return sendJson(res, 503, {error: 'payments_not_configured'});
    const body = await readJson(req);
    const creator = creatorById(body.creatorId);
    const tier = creator?.tiers?.find((item) => item.id === body.tierId);
    const amount = tier ? TIER_PRICES[tier.id] : null;
    if (!creator || !tier || !amount) return sendJson(res, 400, {error: 'bad_tier'});
    const origin = siteOrigin(req);
    const session = await stripeRequest('/checkout/sessions', {
      mode: 'subscription',
      success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancel`,
      line_items: [
        {
          price_data: {
            currency: stripeCurrency(),
            unit_amount: amount,
            recurring: {interval: 'month'},
            product_data: {name: `اشتراك ${tier.name} — ${creator.name}`},
          },
          quantity: 1,
        },
      ],
      metadata: {kind: 'subscription', creatorId: creator.id, tierId: tier.id},
    });
    return sendJson(res, 200, {ok: true, url: session.url});
  }

  if (method === 'POST' && pathname === '/api/checkout/confirm') {
    if (!stripeConfigured()) return sendJson(res, 503, {error: 'payments_not_configured'});
    const body = await readJson(req);
    if (!body.sessionId) return sendJson(res, 400, {error: 'session_required'});
    const session = await stripeRequest(`/checkout/sessions/${encodeURIComponent(body.sessionId)}`, {}, 'GET');
    if (session.status !== 'complete') return sendJson(res, 400, {error: 'not_completed'});
    const kind = await fulfillSession(session);
    return sendJson(res, 200, {ok: true, kind, me: db.me, subscriptions: db.me.subscriptions});
  }

  if (method === 'POST' && pathname === '/api/stripe/webhook') {
    const raw = await readBody(req);
    const text = raw.toString('utf8');
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (secret && !verifyWebhookSignature(text, req.headers['stripe-signature'], secret)) {
      return sendJson(res, 400, {error: 'bad_signature'});
    }
    let event = {};
    try {
      event = JSON.parse(text || '{}');
    } catch {
      return sendJson(res, 400, {error: 'bad_payload'});
    }
    if (event.type === 'checkout.session.completed' && event.data?.object) {
      await fulfillSession(event.data.object);
    }
    return sendJson(res, 200, {received: true});
  }

  // غرف الدردشة
  if (method === 'POST' && pathname === '/api/rooms') {
    const body = await readJson(req);
    const name = String(body.name || '').trim().slice(0, 60);
    if (!name) return sendJson(res, 400, {error: 'name_required'});
    const room = {
      id: uid('room'),
      name,
      topic: String(body.topic || 'غرفة جديدة').trim().slice(0, 120),
      icon: '💬',
      members: 1,
      at: iso(),
      messages: [],
    };
    db.rooms.unshift(room);
    await save();
    return sendJson(res, 200, {ok: true, room});
  }
  if (method === 'POST' && parts[1] === 'rooms' && parts[3] === 'messages') {
    const room = db.rooms.find((r) => r.id === parts[2]);
    if (!room) return sendJson(res, 404, {error: 'not_found'});
    const body = await readJson(req);
    const text = String(body.text || '').trim().slice(0, 500);
    if (!text) return sendJson(res, 400, {error: 'text_required'});
    room.messages.push({id: uid('msg'), name: 'أنت', text, at: iso(), me: true});
    room.at = iso();
    pushReply(room.messages, ROOM_REPLIES);
    await save();
    return sendJson(res, 200, {ok: true, messages: room.messages});
  }

  // البث المباشر
  if (method === 'POST' && parts[1] === 'lives' && parts[3] === 'chat') {
    const live = db.lives.find((l) => l.id === parts[2]);
    if (!live) return sendJson(res, 404, {error: 'not_found'});
    const body = await readJson(req);
    const text = String(body.text || '').trim().slice(0, 300);
    if (!text) return sendJson(res, 400, {error: 'text_required'});
    live.chat.push({id: uid('lc'), name: 'أنت', text, at: iso(), me: true});
    pushReply(live.chat, LIVE_REPLIES);
    await save();
    return sendJson(res, 200, {ok: true, chat: live.chat});
  }
  if (method === 'POST' && parts[1] === 'lives' && parts[3] === 'gift') {
    const live = db.lives.find((l) => l.id === parts[2]);
    if (!live) return sendJson(res, 404, {error: 'not_found'});
    const body = await readJson(req);
    const gift = GIFTS.find((g) => g.id === body.giftId);
    if (!gift) return sendJson(res, 400, {error: 'bad_gift'});
    if (db.me.coins < gift.coins) return sendJson(res, 402, {error: 'not_enough_coins', coins: db.me.coins});
    const host = creatorById(live.creatorId);
    spend(gift.coins, `${gift.emoji} ${gift.label} — ${host ? host.name : 'بث'}`, 'gift');
    live.chat.push({
      id: uid('lc'),
      name: 'أنت',
      text: `أرسل ${gift.emoji} ${gift.label} (${gift.coins} كوين)`,
      at: iso(),
      me: true,
      gift: true,
    });
    await save();
    return sendJson(res, 200, {ok: true, me: db.me, chat: live.chat});
  }

  return sendJson(res, 404, {error: 'not_found'});
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

async function serveFile(req, res, baseDir, relative) {
  const filePath = path.resolve(baseDir, `.${relative}`);
  if (!filePath.startsWith(path.resolve(baseDir))) {
    return sendJson(res, 403, {error: 'forbidden'});
  }
  let stat;
  try {
    stat = await fsp.stat(filePath);
  } catch {
    return sendJson(res, 404, {error: 'not_found'});
  }
  if (stat.isDirectory()) return serveFile(req, res, baseDir, `${relative}/index.html`);

  const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  const range = req.headers.range;
  if (range && /^bytes=/.test(range)) {
    const [startRaw, endRaw] = range.replace(/bytes=/, '').split('-');
    const start = Number(startRaw || 0);
    const end = endRaw ? Math.min(Number(endRaw), stat.size - 1) : stat.size - 1;
    if (Number.isNaN(start) || start >= stat.size) {
      res.writeHead(416, {'Content-Range': `bytes */${stat.size}`});
      return res.end();
    }
    res.writeHead(206, {
      'Content-Type': type,
      'Content-Length': end - start + 1,
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
    });
    return fs.createReadStream(filePath, {start, end}).pipe(res);
  }

  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Accept-Ranges': 'bytes',
    'Cache-Control': type.startsWith('text/') ? 'no-cache' : 'public, max-age=3600',
  });
  return fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (url.pathname.startsWith('/uploads/')) {
      return await serveFile(req, res, UPLOAD_DIR, url.pathname.slice('/uploads'.length));
    }
    const relative = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    return await serveFile(req, res, PUBLIC_DIR, relative);
  } catch (err) {
    console.error('request failed', url.pathname, err);
    if (!res.headersSent) sendJson(res, 500, {error: 'server_error'});
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`فيديو قصيرة جاهز على http://0.0.0.0:${PORT}`);
});
