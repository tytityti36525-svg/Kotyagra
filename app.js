// ═══════════════════════════════════════════════════════
//  КотяГра — app.js  (Firebase Edition)
// ═══════════════════════════════════════════════════════
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, collection,
  query, orderBy, limit, onSnapshot, addDoc, getDocs,
  serverTimestamp, where, increment, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Firebase init ──────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCCVlCIXLQ_GMBPMR8A5-8myzkuolm-BCs",
  authDomain: "kotyagra-d737c.firebaseapp.com",
  projectId: "kotyagra-d737c",
  storageBucket: "kotyagra-d737c.firebasestorage.app",
  messagingSenderId: "674427128723",
  appId: "1:674427128723:web:a4ee00e479a0b284fb3666",
  measurementId: "G-GVHYLFV3P9"
};
const fbApp = initializeApp(firebaseConfig);
const auth  = getAuth(fbApp);
const db    = getFirestore(fbApp);

// ── Game config ────────────────────────────────────────
const GEMS_CFG = [
  { key:'sapphire', icon:'💎', name:'Сапфір',   bonus:'+🦋1',      cost:3 },
  { key:'amethyst', icon:'💜', name:'Аметист',  bonus:'+⭐10 XP',  cost:3 },
  { key:'emerald',  icon:'💚', name:'Смарагд',  bonus:'+❤️15',     cost:3 },
  { key:'topaz',    icon:'🟡', name:'Топаз',    bonus:'+🪙5',      cost:3 },
  { key:'opal',     icon:'🔵', name:'Опал',     bonus:'+⚡10',     cost:3 },
  { key:'ruby',     icon:'❤️‍🔥', name:'Рубін',  bonus:'+🦋2',      cost:4 },
];
const TRAIN_CFG = [
  { key:'clothes', icon:'👗', name:'Одяг',       desc:'Весь одяг дає +🦋1 більше краси' },
  { key:'access',  icon:'👑', name:'Аксесуари',  desc:'Аксесуари дають +🦋1 більше краси' },
  { key:'jewel',   icon:'💍', name:'Прикраси',   desc:'Прикраси дають +🦋1 більше краси' },
];
const CATS = ['🐱','😺','😸','😻','😹'];
const MOODS = [[80,'😻 в захваті!'],[60,'😊 щасливий'],[40,'😐 нормально'],[20,'😿 сумний'],[0,'😤 незадоволений']];

// ── State ──────────────────────────────────────────────
let P = null;      // current player data object
let uid = null;    // firebase uid
let chatUnsub = null;
let onlineInterval = null;
let decayInterval = null;
let walkTicker = null;
let mailTab = 'inbox';
let currentMailId = null;
let ratingTab = 'players';

// ── Helpers ────────────────────────────────────────────
const cl = (v, mn=0, mx=100) => Math.max(mn, Math.min(mx, v));
const $ = id => document.getElementById(id);
const now = () => new Date().toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'});

async function saveP() {
  if (!uid || !P) return;
  try {
    await setDoc(doc(db, 'players', uid), P, { merge: true });
  } catch (e) { console.error('saveP:', e); }
}

function showLoading(on) {
  $('loading-screen').style.display = on ? 'flex' : 'none';
}

// ── AUTH ───────────────────────────────────────────────
let authMode = 'login';
window.switchTab = function(m) {
  authMode = m;
  document.querySelectorAll('.auth-tab').forEach((t,i)=>
    t.classList.toggle('active',(i===0&&m==='login')||(i===1&&m==='reg')));
  $('a-name').style.display = m==='reg' ? 'block':'none';
  $('a-cat').style.display  = m==='reg' ? 'block':'none';
  $('auth-btn').textContent = m==='reg' ? 'Зареєструватися 🐾':'Увійти 🐾';
  $('auth-err').textContent = '';
};

window.doAuth = async function() {
  const email    = $('a-email').value.trim();
  const password = $('a-pass').value;
  const nickname = $('a-name').value.trim();
  const catname  = $('a-cat').value.trim();
  $('auth-err').textContent = '';
  if (!email || !password) { $('auth-err').textContent = 'Заповни всі поля!'; return; }
  showLoading(true);
  try {
    if (authMode === 'reg') {
      if (!nickname || !catname) { showLoading(false); $('auth-err').textContent = "Вкажи нікнейм та ім'я котика!"; return; }
      // check nickname uniqueness
      const nSnap = await getDocs(query(collection(db,'players'), where('nickname','==',nickname)));
      if (!nSnap.empty) { showLoading(false); $('auth-err').textContent = 'Такий нікнейм вже зайнятий!'; return; }
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db,'players',cred.user.uid), mkPlayer(nickname, catname));
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch(e) {
    showLoading(false);
    const msgs = {
      'auth/email-already-in-use': 'Цей email вже використовується!',
      'auth/invalid-email': 'Невірний формат email!',
      'auth/weak-password': 'Пароль мінімум 6 символів!',
      'auth/user-not-found': 'Гравця не знайдено!',
      'auth/wrong-password': 'Невірний пароль!',
      'auth/invalid-credential': 'Невірний логін або пароль!',
    };
    $('auth-err').textContent = msgs[e.code] || e.message;
  }
};

window.doGoogleAuth = async function() {
  showLoading(true);
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const u = result.user;
    const snap = await getDoc(doc(db,'players',u.uid));
    if (!snap.exists()) {
      const nickname = u.displayName?.replace(/\s+/g,'_') || 'Гравець_'+Math.floor(Math.random()*9999);
      await setDoc(doc(db,'players',u.uid), mkPlayer(nickname,'Котик'));
    }
  } catch(e) { showLoading(false); $('auth-err').textContent = e.message; }
};

window.logout = async function() {
  stopAll();
  await signOut(auth);
};

onAuthStateChanged(auth, async user => {
  showLoading(true);
  if (user) {
    uid = user.uid;
    const snap = await getDoc(doc(db,'players',uid));
    if (snap.exists()) {
      P = snap.data();
    } else {
      // Google new user fallback
      P = mkPlayer(user.displayName||'Гравець', 'Котик');
      await setDoc(doc(db,'players',uid), P);
    }
    startGame();
  } else {
    uid = null; P = null;
    stopAll();
    showLoading(false);
    $('game-wrap').style.display = 'none';
    $('bottom-nav').style.display = 'none';
    $('auth-screen').style.display = 'flex';
  }
});

function mkPlayer(nickname, catname) {
  return {
    nickname, catname,
    coins: 50, hearts: 500, butterflies: 0,
    xp: 0, level: 1,
    hunger: 70, thirst: 60, fun: 50, energy: 80,
    sleeping: false,
    skills: { clothes:0, access:0, jewel:0 },
    glamour: 0,
    gems: { sapphire:0, amethyst:0, emerald:0, topaz:0, opal:0, ruby:0 },
    walk: null, walkCoins: 0,
    showWins: 0,
    items: { ball:false, fish:false, milk:false, bow:false },
    clubId: null,
    createdAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
  };
}

// ── Game Start ─────────────────────────────────────────
function startGame() {
  $('auth-screen').style.display = 'none';
  $('game-wrap').style.display = 'flex';
  $('bottom-nav').style.display = 'flex';
  showLoading(false);

  $('s-pn').textContent = P.nickname + ' ▾';
  $('cat-dn').textContent = P.catname;

  buildGems();
  buildTrain();
  render();
  renderProfile();
  startDecay();
  startOnlinePresence();
  if (P.walk && Date.now() - P.walk.start < P.walk.dur) resumeWalk();
  else if (P.walk) finishWalk(true);

  // system welcome mail for new players
  if (!P.inbox) {
    P.inbox = [
      { id: 1, from:'КотяГра 🐱', subj:'Ласкаво просимо!', body:'Привіт, '+P.nickname+'! Виховуй котика, тренуй навики, вступай у клуби. Удачі!', time:now(), read:false, type:'system' },
      { id: 2, from:'КотяГра 🐱', subj:'Підказка: прогулянки 🌳', body:'Відправляй котика на прогулянку щодня — він знаходить монети і дорогоцінності!', time:now(), read:false, type:'system' },
    ];
    P.sent = [];
    saveP();
  }
  updateMailBadge();
}

function stopAll() {
  clearInterval(decayInterval);
  clearInterval(onlineInterval);
  clearInterval(walkTicker);
  if (chatUnsub) { chatUnsub(); chatUnsub = null; }
}

// ── Presence ───────────────────────────────────────────
function startOnlinePresence() {
  const ref = doc(db, 'online', uid);
  const update = () => setDoc(ref, { uid, nickname: P?.nickname, t: Date.now() }, { merge:true });
  update();
  onlineInterval = setInterval(update, 30000);
  // show online count
  setTimeout(async () => {
    const cutoff = Date.now() - 2*60*1000;
    const snap = await getDocs(collection(db,'online'));
    const cnt = snap.docs.filter(d => d.data().t > cutoff).length;
    $('s-on').textContent = cnt;
    if ($('chat-on')) $('chat-on').textContent = cnt;
  }, 1000);
}

// ── PAGE NAV ───────────────────────────────────────────
window.goPage = function(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
  const pg = $('pg-'+id);
  if (pg) pg.classList.add('active');
  const nb = $('nb-'+id);
  if (nb) nb.classList.add('active');

  if (id === 'gems')    renderGems();
  if (id === 'train')   { buildTrain(); renderTrain(); }
  if (id === 'clubs')   { renderClubs(); if (P.clubId) loadClubData(); }
  if (id === 'ratings') { loadRatings(ratingTab); }
  if (id === 'mail')    { renderMail(); closeCompose(); closeMailDetail(); }
  if (id === 'chat')    { startChat(); }
  if (id === 'walks')   { renderWalkLB(); }
  if (id === 'profile') renderProfile();
};

// ── RENDER ─────────────────────────────────────────────
function render() {
  $('s-b').textContent  = P.butterflies;
  $('s-c').textContent  = P.coins;
  $('s-h').textContent  = P.hearts;
  $('s-lv').textContent = P.level;
  const cap = P.level * 100;
  $('s-xp').textContent = P.xp + '/' + cap + ' XP';
  $('s-lf').style.width = (P.xp / cap * 100) + '%';

  [['hunger','h'],['thirst','t'],['fun','f'],['energy','e']].forEach(([k,id]) => {
    const v = cl(P[k]);
    $('b-'+id).style.width = v + '%';
    $('v-'+id).textContent = v + '%';
  });
  const avg = (P.hunger + P.thirst + P.fun + P.energy) / 4;
  let mood = MOODS[MOODS.length-1][1];
  for (const [t,m] of MOODS) if (avg >= t) { mood = m; break; }
  $('cat-mood').textContent = 'Настрій: ' + mood;
  if (!P.sleeping) {
    $('cat-emoji').textContent = CATS[Math.min(4, Math.floor(avg/100*5))];
  }
  $('sl-ov').classList.toggle('on', !!P.sleeping);
  updateMailBadge();
}

function updateMailBadge() {
  const cnt = (P.inbox||[]).filter(m=>!m.read).length;
  const badge = $('mail-badge');
  if (badge) { badge.style.display = cnt > 0 ? 'block':'none'; badge.textContent = cnt; }
  const uc = $('unread-cnt');
  if (uc) uc.textContent = cnt > 0 ? cnt : '';
}

function notify(t, b, dur=2800) {
  $('nt').textContent = t; $('nb').textContent = b;
  const n = $('notif'); n.classList.add('show');
  clearTimeout(n._t); n._t = setTimeout(() => n.classList.remove('show'), dur);
}

function addLog(msg) {
  const box = $('log-box'); if (!box) return;
  const el = document.createElement('div');
  el.className = 'log-e'; el.textContent = msg;
  box.appendChild(el); box.scrollTop = box.scrollHeight;
}

function wiggle() {
  const el = $('cat-emoji');
  el.classList.remove('wiggle'); void el.offsetWidth; el.classList.add('wiggle');
  setTimeout(() => el.classList.remove('wiggle'), 500);
}

function gainXP(n) {
  P.xp += n;
  const cap = P.level * 100;
  if (P.xp >= cap) {
    P.xp -= cap; P.level++;
    const r = P.level * 5; P.coins += r;
    notify('🎉 Новий рівень!', 'Рівень ' + P.level + '! Нагорода: 🪙 ' + r + ' монет');
    addLog('Досягнуто рівня ' + P.level + '! Отримано ' + r + ' монет!');
    wiggle();
  }
  render(); saveP();
}

window.petCat = function() {
  if (P.sleeping) { addLog('Тихіше! Котик спить...'); return; }
  P.hearts = cl(P.hearts+1, 0, 999999);
  P.fun = cl(P.fun+5);
  gainXP(2); wiggle();
  const msgs = ['Мур-р-р! 😻','Котик муркоче від задоволення!','Пррр-пррр! ❤️','Котик дуже радіє!'];
  addLog(msgs[Math.floor(Math.random()*msgs.length)]);
};

// ── ACTIONS ────────────────────────────────────────────
window.act = function(type) {
  if (P.sleeping && type !== 'sleep') { notify('💤 Сон', 'Котик спить! Зачекайте...'); return; }
  switch(type) {
    case 'feed':
      if (P.hunger >= 100) { notify('😋 Ситий!', 'Котик не хоче їсти.'); return; }
      P.hunger = cl(P.hunger+25); gainXP(3);
      addLog(P.catname + ' з апетитом поїв 🍖'); notify('🍖 Смачно!', '+25 їжа'); break;
    case 'water':
      if (P.thirst >= 100) { notify('💧 Напоєний!', 'Котик не хоче пити.'); return; }
      P.thirst = cl(P.thirst+30); gainXP(2);
      addLog(P.catname + ' попив водички 💧'); notify('💧 Освіжився!', '+30 вода'); break;
    case 'play':
      if (P.energy < 15) { notify('😴 Втомлений', 'Котик занадто втомлений!'); return; }
      P.fun = cl(P.fun+20); P.energy = cl(P.energy-15);
      P.hearts = cl(P.hearts+2, 0, 999999); gainXP(5);
      addLog(P.items.ball ? P.catname+' гарно пограв з м\'ячиком! 🎾' : P.catname+' побігав по кімнаті! 🎉');
      notify('🎾 Весело!', '+20 розваги'); break;
    case 'sleep':
      if (P.sleeping) {
        P.sleeping = false; P.energy = cl(P.energy+30); gainXP(4);
        $('cat-emoji').textContent = '😺';
        addLog(P.catname + ' прокинувся відпочилим! ⚡');
        notify('☀️ Прокинувся!', '+30 енергія');
      } else {
        P.sleeping = true; $('cat-emoji').textContent = '😴';
        addLog(P.catname + ' ліг спати... 💤');
        notify('💤 Спить', 'Натисніть знову щоб прокинутись');
      }
      render(); saveP(); break;
    case 'show':
      if (P.coins < 5) { notify('🪙 Мало монет', 'Потрібно 5 монет!'); return; }
      if (P.energy < 25) { notify('😴 Втомлений', 'Котик не готовий до виставки!'); return; }
      P.coins -= 5;
      const avg = (P.hunger + P.thirst + P.fun + P.energy) / 4;
      if (avg > 55 && Math.random() > .38) {
        P.showWins++;
        const pr = 15 + P.showWins*3;
        P.coins += pr; gainXP(20); P.hearts = cl(P.hearts+5, 0, 999999); wiggle();
        addLog(P.catname + ' виграв виставку! 🏆 +'+pr+' монет!');
        notify('🏆 Перемога!', '+'+pr+' монет, +20 XP');
      } else {
        gainXP(8);
        addLog(P.catname + ' взяв участь у виставці, але не виграв. 💪');
        notify('😿 Не цього разу', '+8 XP за участь');
      }
      saveP(); break;
  }
};

window.buy = function(item) {
  const map = { ball:{name:"М'ячик",cost:10}, fish:{name:'Рибку',cost:8}, milk:{name:'Молочко',cost:5}, bow:{name:'Бантик',cost:15} };
  const it = map[item];
  if (P.items[item]) { notify('✅ Вже є!', 'У '+P.catname+' вже є '+it.name); return; }
  if (P.coins < it.cost) { notify('🪙 Мало монет', 'Потрібно '+it.cost+' монет!'); return; }
  P.coins -= it.cost; P.items[item] = true; P.fun = cl(P.fun+10); gainXP(5); wiggle();
  addLog('Куплено: '+it.name+'! '+P.catname+' радіє!');
  notify('✨ Куплено!', it.name+' у '+P.catname+'!');
  renderProfile(); saveP();
};

// ── DECAY ──────────────────────────────────────────────
function startDecay() {
  clearInterval(decayInterval);
  decayInterval = setInterval(() => {
    if (!P) return;
    if (!P.sleeping) {
      P.hunger = cl(P.hunger-2); P.thirst = cl(P.thirst-3);
      P.fun = cl(P.fun-1);       P.energy = cl(P.energy-1);
    } else {
      P.energy = cl(P.energy+2); P.hunger = cl(P.hunger-1); P.thirst = cl(P.thirst-1);
    }
    if (Math.random() > .72) P.coins++;
    render();
    if (Math.random() > .95) {
      const evts = [
        P.catname+' знайшов пір\'їнку! 🪶', P.catname+' дивиться у вікно... 🐦',
        P.catname+' перекинув склянку! 💦',  P.catname+' ховається під ковдру 🛏️',
        P.catname+' принюхується до квітів 🌸', P.catname+' дряпає диван 😅'
      ];
      addLog(evts[Math.floor(Math.random()*evts.length)]);
    }
  }, 3500);
}

// ── TRAINING ───────────────────────────────────────────
function buildTrain() {
  const c = $('train-items'); if (!c) return;
  c.innerHTML = TRAIN_CFG.map(({key,icon,name,desc}) => {
    const lv = P.skills?.[key] || 0;
    const pct = Math.round(lv/80*100);
    return `<div class="train-item">
      <span class="train-icon">${icon}</span>
      <div style="flex:1">
        <div class="train-name">${name} + 🦋1</div>
        <div class="train-desc">${desc}</div>
        <div class="train-lvl" id="tl-${key}">Рівень: ${lv} з 80</div>
        <div class="lvl-mini-track"><div class="lvl-mini-fill" id="tf-${key}" style="width:${pct}%"></div></div>
        <button class="train-btn" onclick="trainSkill('${key}')">Тренувати за ❤️ 150</button>
      </div></div>`;
  }).join('');
}

function renderTrain() {
  $('t-gl').textContent = P.glamour || 0;
  $('t-bu').textContent = P.butterflies || 0;
  TRAIN_CFG.forEach(({key}) => {
    const lv = P.skills?.[key] || 0;
    const tl = $('tl-'+key); if (tl) tl.textContent = 'Рівень: '+lv+' з 80';
    const tf = $('tf-'+key); if (tf) tf.style.width = Math.round(lv/80*100)+'%';
  });
}

window.trainSkill = function(sk) {
  if (P.hearts < 150) { notify('❤️ Мало сердечок', 'Потрібно 150 сердечок!'); return; }
  if ((P.skills?.[sk]||0) >= 80) { notify('✅ Максимум!', 'Цей навик вже максимальний!'); return; }
  P.hearts = cl(P.hearts-150, 0, 999999);
  P.skills = P.skills || {}; P.skills[sk] = (P.skills[sk]||0) + 1;
  P.glamour = (P.glamour||0) + 1; P.butterflies++;
  gainXP(8);
  const nm = {clothes:'Одяг',access:'Аксесуари',jewel:'Прикраси'}[sk];
  addLog('Тренування "'+nm+'" рівень '+P.skills[sk]+'! Гламур: '+P.glamour);
  notify('🏋️ Тренування!', nm+' рівень '+P.skills[sk]+' · +🦋1 · +гламур');
  renderTrain(); saveP();
};

// ── GEMS ───────────────────────────────────────────────
const GEM_FX = {
  sapphire: () => { P.butterflies++; addLog('Сапфір дав +🦋1!'); },
  amethyst: () => { gainXP(10); addLog('Аметист дав +⭐10 XP!'); },
  emerald:  () => { P.hearts = cl(P.hearts+15, 0, 999999); addLog('Смарагд дав +❤️15!'); },
  topaz:    () => { P.coins += 5; addLog('Топаз дав +🪙5!'); },
  opal:     () => { P.energy = cl(P.energy+10); addLog('Опал дав +⚡10 енергії!'); },
  ruby:     () => { P.butterflies += 2; addLog('Рубін дав +🦋2!'); },
};

function buildGems() {
  const gl = $('gem-list'); if (!gl) return;
  const ga = $('gem-assemble'); if (!ga) return;
  gl.innerHTML = GEMS_CFG.map(({key,icon,name,bonus,cost}) =>
    `<div class="gem-row">
      <div class="gem-left"><span class="gem-icon">${icon}</span>
        <div><div class="gem-name">${name}</div><div class="gem-bonus">${bonus}</div></div>
      </div>
      <div style="display:flex;align-items:center;gap:7px">
        <span style="font-size:.85rem;font-weight:900;color:var(--tx)" id="gc-${key}">0</span>
        <button class="gem-add" onclick="collectGem('${key}',${cost})">+</button>
      </div></div>`
  ).join('');
  ga.innerHTML = GEMS_CFG.map(({key,icon,name}) =>
    `<button class="act-btn" onclick="assembleGem('${key}','${icon}')" style="padding:9px 5px">
      <span class="bi">${icon}</span><span class="bl">${name}</span><span class="bc">5 частин</span></button>`
  ).join('');
}

function renderGems() {
  GEMS_CFG.forEach(({key}) => {
    const el = $('gc-'+key); if (el) el.textContent = P.gems?.[key] || 0;
  });
  const si = $('gem-sum');
  if (si) si.textContent = GEMS_CFG.map(g => `${g.icon}${P.gems?.[g.key]||0}`).join(' ');
}

window.collectGem = function(g, cost) {
  if (P.coins < cost) { notify('🪙 Мало монет', 'Потрібно '+cost+' монет для пошуку!'); return; }
  P.coins -= cost; P.gems = P.gems||{}; P.gems[g] = (P.gems[g]||0) + 1;
  const cfg = GEMS_CFG.find(x=>x.key===g);
  addLog('Знайдено частину: '+cfg.name+'!');
  notify('💎 Знайдено!', cfg.name+' (+1 частина)');
  renderGems(); render(); saveP();
};

window.assembleGem = function(g, icon) {
  if ((P.gems?.[g]||0) < 5) { notify('💎 Недостатньо', 'Потрібно 5 частин '+g+'!'); return; }
  P.gems[g] -= 5; GEM_FX[g]?.(); gainXP(15); wiggle();
  notify(icon+' Зібрано!', 'Камінь зібрано! Отримано бонус!');
  renderGems(); render(); saveP();
};

// ── WALKS ──────────────────────────────────────────────
window.startWalk = function(type, secs, minC, maxC, xp) {
  if (P.walk) { notify('🌳 Вже на прогулянці!', 'Зачекайте поки котик повернеться.'); return; }
  if (P.energy < 20) { notify('😴 Мало енергії', 'Котику потрібно відпочити!'); return; }
  P.walk = { type, start: Date.now(), dur: secs*1000, minC, maxC, xp };
  P.energy = cl(P.energy-15);
  const names = { yard:'у двір', park:'у парк', forest:'у ліс' };
  addLog(P.catname + ' пішов на прогулянку (' + names[type] + ')!');
  notify('🌳 Прогулянка!', 'Котик пішов гуляти! ~'+secs+' сек.');
  showWalkUI(); render(); saveP();
};

function showWalkUI() {
  $('walk-active-div').style.display = 'block';
  $('walk-opts').style.display = 'none';
  clearInterval(walkTicker);
  walkTicker = setInterval(tickWalk, 500);
}

function resumeWalk() { showWalkUI(); }

function tickWalk() {
  if (!P?.walk) { clearInterval(walkTicker); return; }
  const el  = Date.now() - P.walk.start;
  const pct = Math.min(100, el / P.walk.dur * 100);
  const rem = Math.max(0, Math.ceil((P.walk.dur - el) / 1000));
  const pf = $('wpf'); if (pf) pf.style.width = pct + '%';
  const wt = $('walk-timer'); if (wt) wt.textContent = rem + ' сек';
  if (pct >= 100) { clearInterval(walkTicker); finishWalk(false); }
}

function finishWalk(skip) {
  if (!P?.walk) return;
  if (!skip) {
    const coins = P.walk.minC + Math.floor(Math.random()*(P.walk.maxC - P.walk.minC));
    P.coins += coins; gainXP(P.walk.xp); P.walkCoins = (P.walkCoins||0) + coins;
    const gems = ['sapphire','amethyst','emerald','topaz','opal','ruby'];
    if (Math.random() > .55) {
      const g = gems[Math.floor(Math.random()*gems.length)];
      P.gems = P.gems || {}; P.gems[g] = (P.gems[g]||0) + 1;
      const cfg = GEMS_CFG.find(x=>x.key===g);
      addLog('Знайдено '+cfg.icon+' '+cfg.name+' під час прогулянки!');
    }
    addLog(P.catname+' повернувся! Знайдено 🪙 '+coins+' монет!');
    notify('🏠 Повернувся!', P.catname+' приніс 🪙 '+coins+' + '+P.walk.xp+' XP!');
  }
  P.walk = null;
  $('walk-active-div').style.display = 'none';
  $('walk-opts').style.display = 'block';
  renderWalkLB(); render(); saveP();
}

async function renderWalkLB() {
  const lb = $('walk-lb'); if (!lb) return;
  lb.innerHTML = '<div class="loading-inline">Завантаження...</div>';
  try {
    const snap = await getDocs(query(collection(db,'players'), orderBy('walkCoins','desc'), limit(10)));
    const medals = ['🥇','🥈','🥉'];
    const rows = snap.docs.map((d,i) => {
      const data = d.data();
      return `<div class="lb-row">
        <span class="lb-rank">${medals[i]||i+1}</span>
        <span class="lb-player">${data.nickname}${d.id===uid?'🌟':''}</span>
        <span class="lb-coins">🪙 ${data.walkCoins||0}</span></div>`;
    }).join('');
    lb.innerHTML = rows || '<div class="loading-inline">Поки немає даних</div>';
  } catch(e) { lb.innerHTML = '<div class="loading-inline">Помилка завантаження</div>'; }
}

// ── CLUBS ──────────────────────────────────────────────
async function loadClubs() {
  const cb = $('club-browser'); if (!cb) return;
  cb.innerHTML = '<div class="loading-inline">Завантаження...</div>';
  try {
    const snap = await getDocs(query(collection(db,'clubs'), orderBy('level','desc'), limit(10)));
    if (snap.empty) {
      cb.innerHTML = '<div class="loading-inline">Клубів поки немає. Створи перший!</div>';
      return;
    }
    cb.innerHTML = snap.docs.map(d => {
      const c = d.data();
      return `<div class="club-list-item" onclick="joinClub('${d.id}')">
        <span class="cli-icon">${c.icon||'🎈'}</span>
        <div>
          <div class="cli-name">${c.name}</div>
          <div class="cli-info">${c.memberCount||1} учасників · Рівень ${c.level||1}</div>
        </div>
        ${c.level>=5?'<span class="cli-badge">ТОП</span>':''}</div>`;
    }).join('');
  } catch(e) { cb.innerHTML = '<div class="loading-inline">Помилка завантаження</div>'; }
}

function renderClubs() {
  if (P.clubId) {
    $('clubs-no-club').style.display = 'none';
    $('clubs-in-club').style.display = 'block';
  } else {
    $('clubs-no-club').style.display = 'block';
    $('clubs-in-club').style.display = 'none';
    loadClubs();
  }
}

async function loadClubData() {
  if (!P.clubId) return;
  try {
    const snap = await getDoc(doc(db,'clubs',P.clubId));
    if (!snap.exists()) { P.clubId = null; saveP(); renderClubs(); return; }
    const c = snap.data();
    $('cl-emblem').textContent = c.icon || '🏰';
    $('cl-name').textContent = c.name;
    const stars = Math.min(7, c.stars||1);
    $('cl-stars').textContent = '★'.repeat(stars)+'☆'.repeat(Math.max(0,7-stars));
    $('cl-desc').textContent = c.description || '—';
    $('cl-founded').textContent = c.founded || '—';
    $('cl-level').textContent = c.level || 1;
    $('cl-xp').textContent = ((c.xp||0)/1000).toFixed(2)+'g';
    $('cl-pc').textContent = c.piggyCoins || 0;
    $('cl-ph').textContent = ((c.piggyHearts||0)/1000).toFixed(2)+'g';
    $('cl-mc').textContent = c.memberCount || 1;
    $('cl-mcount').textContent = c.memberCount || 1;
    $('cl-blvl').textContent = c.buildingsLevel || 1;
    $('cl-role-badge').textContent = c.directorUid===uid ? '👑 Ти — Директор' : '👤 Учасник';
    $('club-settings-row').style.display = c.directorUid===uid ? 'flex':'none';
    // members
    const mSnap = await getDocs(query(collection(db,'clubs',P.clubId,'members'), limit(20)));
    const roles = { director:'Директор', deputy:'Зам. Директора', curator:'Куратор', member:'Учасник' };
    const roleClasses = { director:'role-dir', deputy:'role-dep', curator:'role-cur', member:'role-mem' };
    const avatars = ['🐱','😺','😸','😻','🐈','🐾','🦊','🐭','🐹','🐻'];
    $('cl-members').innerHTML = mSnap.docs.map(md => {
      const m = md.data();
      const av = avatars[Math.floor(Math.random()*avatars.length)];
      const rk = m.role||'member';
      return `<div class="member-row">
        <span class="member-av">${av}</span>
        <span class="member-name">${m.nickname}</span>
        <span class="member-pts">${((m.points||0)/1000).toFixed(2)}m</span>
        <span class="member-role ${roleClasses[rk]}">${roles[rk]}</span></div>`;
    }).join('');
  } catch(e) { console.error('loadClubData:', e); }
}

window.joinClub = async function(clubId) {
  if (P.clubId) { notify('✅ Вже в клубі', 'Спочатку вийди з поточного клубу!'); return; }
  if (P.level < 3) { notify('⬆️ Низький рівень', 'Потрібно 3 рівень для вступу!'); return; }
  try {
    const clubRef = doc(db,'clubs',clubId);
    const snap = await getDoc(clubRef);
    if (!snap.exists()) { notify('❌ Помилка', 'Клуб не знайдено!'); return; }
    // add member
    await setDoc(doc(db,'clubs',clubId,'members',uid), {
      uid, nickname: P.nickname, role:'member', points:0, joinedAt: new Date().toISOString()
    });
    await updateDoc(clubRef, { memberCount: increment(1) });
    P.clubId = clubId;
    await saveP();
    $('club-join-banner').style.display = 'block';
    notify('🎈 Ласкаво просимо!', 'Ти вступив до клубу!');
    addLog('Вступив до клубу "'+snap.data().name+'"! 🎈');
    renderClubs(); loadClubData();
  } catch(e) { notify('❌ Помилка', e.message); }
};

window.createClub = async function() {
  const name = $('new-club-name').value.trim();
  const desc = $('new-club-desc').value.trim();
  if (!name) { notify('📝 Введи назву', 'Назва клубу обов\'язкова!'); return; }
  if (P.clubId) { notify('✅ Вже в клубі', 'Спочатку вийди з поточного клубу!'); return; }
  const icons = ['🐱','🌟','🦋','💎','🌸','🏆','🎀','🎈','🔥','🌙','🏰','⚔️'];
  const icon = icons[Math.floor(Math.random()*icons.length)];
  try {
    const clubRef = await addDoc(collection(db,'clubs'), {
      name, description: desc || 'Наш чудовий клуб!', icon,
      level:1, xp:0, stars:1, memberCount:1,
      directorUid: uid, directorName: P.nickname,
      piggyCoins:0, piggyHearts:0, buildingsLevel:1,
      founded: new Date().toLocaleDateString('uk-UA'),
      createdAt: new Date().toISOString(),
    });
    await setDoc(doc(db,'clubs',clubRef.id,'members',uid), {
      uid, nickname: P.nickname, role:'director', points:0, joinedAt: new Date().toISOString()
    });
    P.clubId = clubRef.id;
    await saveP();
    notify('🏆 Клуб створено!', '"'+name+'" — ти Директор!');
    addLog('Створено клуб "'+name+'"! Ти — Директор! 🏆');
    renderClubs(); loadClubData();
  } catch(e) { notify('❌ Помилка', e.message); }
};

window.donateClub = async function() {
  if (P.coins < 10) { notify('🪙 Мало монет', 'Потрібно 10 монет!'); return; }
  if (!P.clubId) return;
  P.coins -= 10;
  try {
    await updateDoc(doc(db,'clubs',P.clubId), { piggyCoins: increment(10), xp: increment(10) });
    await updateDoc(doc(db,'clubs',P.clubId,'members',uid), { points: increment(10) });
    addLog('Пожертвував 🪙10 до копилки клубу!');
    notify('🐷 Копилка!', '🪙10 передано до клубу!');
    loadClubData(); render(); saveP();
  } catch(e) { console.error(e); }
};

window.leaveClub = async function() {
  if (!P.clubId) return;
  if (!confirm('Вийти з клубу?')) return;
  try {
    await deleteDoc(doc(db,'clubs',P.clubId,'members',uid));
    await updateDoc(doc(db,'clubs',P.clubId), { memberCount: increment(-1) });
    addLog('Вийшов з клубу');
    P.clubId = null;
    await saveP();
    renderClubs();
  } catch(e) { notify('❌ Помилка', e.message); }
};

window.showClubHistory = function() {
  notify('📜 Історія клубу', 'Функція буде доступна незабаром!');
};

// ── RATINGS ────────────────────────────────────────────
const medals = ['🥇','🥈','🥉'];
window.switchRating = function(type) {
  ratingTab = type;
  ['players','clubs','beauty'].forEach(t => {
    $('rt-'+t)?.classList.toggle('active', t===type);
  });
  loadRatings(type);
};

async function loadRatings(type) {
  const rl = $('rating-list'); if (!rl) return;
  rl.innerHTML = '<div class="loading-inline">Завантаження...</div>';
  try {
    if (type === 'players') {
      const snap = await getDocs(query(collection(db,'players'), orderBy('level','desc'), limit(20)));
      rl.innerHTML = snap.docs.map((d,i) => {
        const p = d.data();
        return `<div class="rating-row">
          <span class="rrank ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">${medals[i]||i+1}</span>
          <span class="rav">🐱</span>
          <div><div class="rname">${p.nickname}${d.id===uid?'🌟':''}</div>
          <div class="rsub">Рів.${p.level||1} · 🌳${p.walkCoins||0}🪙</div></div>
          <span class="rscore">⭐${(p.level||1)*1000+(p.butterflies||0)}</span></div>`;
      }).join('');
    } else if (type === 'clubs') {
      const snap = await getDocs(query(collection(db,'clubs'), orderBy('level','desc'), limit(20)));
      rl.innerHTML = snap.docs.map((d,i) => {
        const c = d.data();
        return `<div class="rating-row">
          <span class="rrank ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">${medals[i]||i+1}</span>
          <span class="rav">${c.icon||'🎈'}</span>
          <div><div class="rname">${c.name}</div>
          <div class="rsub">Рів.${c.level||1} · ${c.memberCount||1} учасників</div></div>
          <span class="rscore">⭐${(c.level||1)*100+(c.memberCount||1)}</span></div>`;
      }).join('');
    } else {
      const snap = await getDocs(query(collection(db,'players'), orderBy('butterflies','desc'), limit(20)));
      rl.innerHTML = snap.docs.map((d,i) => {
        const p = d.data();
        return `<div class="rating-row">
          <span class="rrank ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">${medals[i]||i+1}</span>
          <span class="rav">🦋</span>
          <div><div class="rname">${p.nickname}${d.id===uid?'🌟':''}</div>
          <div class="rsub">Рів.${p.level||1} · Гламур ${p.glamour||0}</div></div>
          <span class="rscore">🦋${p.butterflies||0}</span></div>`;
      }).join('');
    }
    if (!rl.children.length) rl.innerHTML = '<div class="loading-inline">Поки немає гравців</div>';
  } catch(e) { rl.innerHTML = '<div class="loading-inline">Помилка завантаження</div>'; }
}

// ── MAIL ───────────────────────────────────────────────
window.switchMail = function(tab) {
  mailTab = tab;
  ['inbox','sent','system'].forEach(t => $('mt-'+t)?.classList.toggle('active', t===tab));
  renderMail();
};

function renderMail() {
  const mi = $('mail-items'); if (!mi) return;
  let items = [];
  if (mailTab === 'inbox')  items = (P.inbox||[]).filter(m=>m.type!=='system');
  else if (mailTab === 'sent')   items = P.sent||[];
  else if (mailTab === 'system') items = (P.inbox||[]).filter(m=>m.type==='system');
  items = [...items].reverse();
  if (!items.length) {
    mi.innerHTML = '<div class="loading-inline">Немає повідомлень</div>'; return;
  }
  mi.innerHTML = items.map(m =>
    `<div class="mail-item ${m.read?'':'unread'}" onclick="openMail(${m.id},'${mailTab}')">
      <div style="display:flex;align-items:flex-start;gap:8px">
        ${!m.read?'<div class="mail-unread-dot"></div>':'<div style="width:8px"></div>'}
        <div style="flex:1">
          <div class="mail-from">${mailTab==='sent'?'→ '+m.to:m.from}</div>
          <div class="mail-subj">${m.subj}</div>
          <div class="mail-preview">${m.body.slice(0,55)}${m.body.length>55?'...':''}</div>
        </div>
      </div>
      <div class="mail-time">${m.time}</div></div>`
  ).join('');
  updateMailBadge();
}

window.openMail = function(id, tab) {
  let msg;
  if (tab === 'sent') msg = (P.sent||[]).find(m=>m.id===id);
  else msg = (P.inbox||[]).find(m=>m.id===id);
  if (!msg) return;
  msg.read = true; currentMailId = id;
  $('mail-list-view').style.display = 'none';
  $('mail-detail').style.display = 'flex';
  $('mail-detail').style.flexDirection = 'column';
  $('mail-detail').style.gap = '9px';
  $('md-from').textContent = tab==='sent' ? '→ '+msg.to : msg.from;
  $('md-time').textContent = msg.time;
  $('md-subj').textContent = msg.subj;
  $('md-body').textContent = msg.body;
  $('compose-view').style.display = 'none';
  saveP(); updateMailBadge();
};

window.closeMailDetail = function() {
  $('mail-detail').style.display = 'none';
  $('mail-list-view').style.display = 'block';
  renderMail();
};

window.replyTo = function() {
  const msg = (P.inbox||[]).find(m=>m.id===currentMailId);
  if (!msg) return;
  closeMailDetail(); showCompose();
  $('cm-to').value = msg.from.replace(' 🐱','');
  $('cm-subj').value = 'Re: '+msg.subj;
};

window.showCompose = function() {
  $('mail-list-view').style.display = 'none';
  $('mail-detail').style.display = 'none';
  $('compose-view').style.display = 'flex';
  $('compose-view').style.flexDirection = 'column';
  $('compose-view').style.gap = '9px';
};

window.closeCompose = function() {
  $('compose-view').style.display = 'none';
  $('mail-list-view').style.display = 'block';
};

window.sendMail = async function() {
  const to   = $('cm-to').value.trim();
  const subj = $('cm-subj').value.trim();
  const body = $('cm-body').value.trim();
  if (!to || !subj || !body) { notify('📬 Помилка', 'Заповни всі поля!'); return; }
  const msgObj = { id: Date.now(), to, subj, body, time: now(), read: true };
  P.sent = P.sent || []; P.sent.push(msgObj);

  // Find recipient by nickname in Firestore
  try {
    const snap = await getDocs(query(collection(db,'players'), where('nickname','==',to)));
    if (!snap.empty) {
      const recipientId = snap.docs[0].id;
      const recipientData = snap.docs[0].data();
      const inboxMsg = { id: Date.now()+1, from: P.nickname, subj, body, time: now(), read: false, type:'player' };
      const recipientInbox = [...(recipientData.inbox||[]), inboxMsg];
      await updateDoc(doc(db,'players',recipientId), { inbox: recipientInbox });
      notify('📤 Надіслано!', 'Повідомлення для '+to+' відправлено!');
    } else {
      notify('📤 Надіслано!', 'Збережено (гравець '+to+' не знайдений онлайн)');
    }
  } catch(e) { console.error(e); }

  $('cm-to').value = ''; $('cm-subj').value = ''; $('cm-body').value = '';
  addLog('Надіслано повідомлення гравцю '+to);
  closeCompose(); saveP(); renderMail();
};

// ── CHAT (Firestore realtime) ──────────────────────────
function startChat() {
  const box = $('chat-msgs'); if (!box) return;
  if (chatUnsub) return; // already listening
  box.innerHTML = '';
  const q = query(collection(db,'chat'), orderBy('ts','asc'), limit(60));
  chatUnsub = onSnapshot(q, snap => {
    snap.docChanges().forEach(change => {
      if (change.type === 'added') {
        const d = change.doc.data();
        addChatMsg(d.nickname, d.text, d.uid===uid, d.ts);
      }
    });
  });
}

function addChatMsg(nickname, text, isMine, ts) {
  const box = $('chat-msgs'); if (!box) return;
  const div = document.createElement('div');
  div.className = 'msg ' + (isMine ? 'mine':'theirs');
  const t = ts?.toDate ? ts.toDate().toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'}) : now();
  div.innerHTML = `${!isMine?`<div class="msg-sender">${nickname}</div>`:''}
    <div class="msg-bubble">${escapeHtml(text)}</div>
    <div class="msg-meta">${t}</div>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

window.sendChat = async function() {
  const inp = $('chat-in'); const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  try {
    await addDoc(collection(db,'chat'), {
      uid, nickname: P.nickname, text,
      ts: serverTimestamp()
    });
    // trim old messages periodically
  } catch(e) { console.error('sendChat:', e); }
};

function escapeHtml(t) {
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── PROFILE ────────────────────────────────────────────
function renderProfile() {
  $('prof-emoji').textContent = CATS[Math.min(4, Math.floor(((P.hunger+P.thirst+P.fun+P.energy)/4)/100*5))];
  $('prof-catname').textContent = P.catname;
  $('prof-name').textContent = '@'+P.nickname;
  $('prof-lv').textContent = P.level;
  $('prof-b').textContent = P.butterflies;
  $('prof-gl').textContent = P.glamour||0;
  $('prof-wc').textContent = P.walkCoins||0;
  // skills
  $('prof-skills').innerHTML = TRAIN_CFG.map(({key,icon,name}) => {
    const lv = P.skills?.[key]||0;
    return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px dashed var(--br)">
      <span style="font-size:1.3rem">${icon}</span>
      <div style="flex:1">
        <div style="font-size:.78rem;font-weight:800;color:var(--gdk)">${name}</div>
        <div class="lvl-mini-track"><div class="lvl-mini-fill" style="width:${Math.round(lv/80*100)}%"></div></div>
      </div>
      <div style="font-size:.75rem;font-weight:900;color:var(--tl)">${lv}/80</div>
    </div>`;
  }).join('');
  // items
  const itemMap = { ball:'🎾', fish:'🐟', milk:'🥛', bow:'🎀' };
  const owned = Object.entries(P.items||{}).filter(([,v])=>v).map(([k])=>k);
  $('prof-items').innerHTML = owned.length
    ? owned.map(k=>`<span style="font-size:2rem" title="${k}">${itemMap[k]||'❓'}</span>`).join('')
    : '<span style="font-size:.75rem;color:var(--tl);font-weight:700">Немає предметів</span>';
}
