// КотяГра app.js — v7
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection,
  query, orderBy, limit, onSnapshot, addDoc, getDocs,
  serverTimestamp, where, increment, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const _k=['AIzaSyB0XJ','50di5qf45q','BC23QKMuZJ','QorS593S0'].join('');
const FB = {
  apiKey:_k,
  authDomain:"kotyagra-47999.firebaseapp.com",
  projectId:"kotyagra-47999",
  storageBucket:"kotyagra-47999.firebasestorage.app",
  messagingSenderId:"580411094157",
  appId:"1:580411094157:web:62b1f1417349b1d7a99ec4"
};
const app  = initializeApp(FB);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── XP table ─────────────────────────────────────────
const XP_TABLE = [0,50,120,220,360,550,800,1100,1500,2000,2700,3500,4500,5700,7200,9000,11200,13800,16900,20500];
const xpCap = lv => XP_TABLE[Math.min(lv, XP_TABLE.length-1)] || lv*200;

// ── Pet types (FIX #4) ───────────────────────────────
const PET_TYPES = {
  cat:  { emojis:['🐱','😺','😸','😻','😹'], label:'Котик',   icon:'🐱' },
  dog:  { emojis:['🐶','😀','🐕','🦮','🐩'], label:'Собачка', icon:'🐶' },
};
function getPetEmojis(){ return (PET_TYPES[P?.petType]||PET_TYPES.cat).emojis; }
function getPetLabel(){  return (PET_TYPES[P?.petType]||PET_TYPES.cat).label; }
function getPetIcon(){   return (PET_TYPES[P?.petType]||PET_TYPES.cat).icon; }

// ── Clothes catalog ───────────────────────────────────
const CLOTHES_CATALOG = [
  {id:'shirt1',slot:'shirt',icon:'👕',name:'Проста сорочка',beauty:2,lvlReq:1,cost:20,rarity:'common'},
  {id:'collar1',slot:'collar',icon:'🔵',name:'Синій нашийник',beauty:2,lvlReq:1,cost:15,rarity:'common'},
  {id:'hat1',slot:'hat',icon:'🎩',name:'Циліндр',beauty:3,lvlReq:1,cost:25,rarity:'common'},
  {id:'ring1',slot:'ring',icon:'💍',name:'Срібне кільце',beauty:2,lvlReq:1,cost:20,rarity:'common'},
  {id:'toy1',slot:'toy',icon:'🎾',name:'М\'ячик',beauty:1,lvlReq:1,cost:10,rarity:'common'},
  {id:'shirt2',slot:'shirt',icon:'👔',name:'Парадна сорочка',beauty:5,lvlReq:3,cost:60,rarity:'uncommon'},
  {id:'collar2',slot:'collar',icon:'🟡',name:'Золотий нашийник',beauty:6,lvlReq:3,cost:80,rarity:'uncommon'},
  {id:'hat2',slot:'hat',icon:'🪖',name:'Шолом лицаря',beauty:5,lvlReq:3,cost:70,rarity:'uncommon'},
  {id:'toy2',slot:'toy',icon:'🧸',name:'Плюшевий ведмедик',beauty:4,lvlReq:3,cost:50,rarity:'uncommon'},
  {id:'shirt3',slot:'shirt',icon:'🥻',name:'Шовкове вбрання',beauty:10,lvlReq:5,cost:150,rarity:'rare'},
  {id:'collar3',slot:'collar',icon:'💎',name:'Діамантовий нашийник',beauty:12,lvlReq:5,cost:200,rarity:'rare'},
  {id:'ring2',slot:'ring',icon:'💎',name:'Золоте кільце з рубіном',beauty:10,lvlReq:5,cost:180,rarity:'rare'},
  {id:'medal1',slot:'medal',icon:'🥇',name:'Золота медаль',beauty:15,lvlReq:5,cost:250,rarity:'rare'},
  {id:'shirt4',slot:'shirt',icon:'🥋',name:'Королівський мантій',beauty:20,lvlReq:8,cost:400,rarity:'epic'},
  {id:'hat3',slot:'hat',icon:'👑',name:'Золота корона',beauty:25,lvlReq:8,cost:500,rarity:'epic'},
  {id:'medal2',slot:'medal',icon:'🏆',name:'Кубок чемпіона',beauty:30,lvlReq:8,cost:600,rarity:'epic'},
  {id:'shirt5',slot:'shirt',icon:'✨',name:'Зоряна мантія',beauty:40,lvlReq:12,cost:1000,rarity:'legendary'},
  {id:'collar4',slot:'collar',icon:'🌟',name:'Зоряний нашийник',beauty:35,lvlReq:12,cost:900,rarity:'legendary'},
];
const RARITY_COLOR = {common:'#aaa',uncommon:'var(--green)',rare:'var(--blue)',epic:'var(--purple)',legendary:'#f5c842'};
const RARITY_LABEL = {common:'Звичайний',uncommon:'Незвичайний',rare:'Рідкісний',epic:'Епічний',legendary:'Легендарний'};

// ── House star system ─────────────────────────────────
const HOUSE_COMPONENTS = [
  {key:'foundation',icon:'🧱',name:'Фундамент'},
  {key:'roof',icon:'🏗️',name:'Дах'},
  {key:'walls',icon:'🪟',name:'Стіни'},
  {key:'interior',icon:'🛋️',name:'Інтер\'єр'},
];
const HOUSE_COMP_COSTS = [50,120,280,600,1200];
const HOUSE_STARS = [
  {star:0,emoji:'🏚️',name:'Руїни',beauty:0},
  {star:1,emoji:'🏠',name:'Проста хатинка',beauty:0},
  {star:2,emoji:'🏡',name:'Затишний будиночок',beauty:8},
  {star:3,emoji:'🏘️',name:'Гарний дім',beauty:20},
  {star:4,emoji:'🏰',name:'Міні-замок',beauty:45},
  {star:5,emoji:'🏯',name:'Замок мрії',beauty:100},
];
function getHouseStar(){
  if(!P)return 0;
  const c=P.houseComponents||{foundation:0,roof:0,walls:0,interior:0};
  return Math.min(...HOUSE_COMPONENTS.map(x=>c[x.key]||0));
}
function getHouseStarData(){
  const s=getHouseStar();
  return HOUSE_STARS[Math.min(s,HOUSE_STARS.length-1)]||HOUSE_STARS[0];
}

// ── Gems ─────────────────────────────────────────────
const GEMS_CFG = [
  {key:'sapphire',icon:'💎',name:'Сапфір',bonus:'+🦋1',cost:3},
  {key:'amethyst',icon:'💜',name:'Аметист',bonus:'+⭐10 XP',cost:3},
  {key:'emerald',icon:'💚',name:'Смарагд',bonus:'+❤️15',cost:3},
  {key:'topaz',icon:'🟡',name:'Топаз',bonus:'+🪙5',cost:3},
  {key:'opal',icon:'🔵',name:'Опал',bonus:'+⚡10',cost:3},
  {key:'ruby',icon:'❤️‍🔥',name:'Рубін',bonus:'+🦋2',cost:4},
];
const GEM_FX = {
  sapphire:()=>{P.butterflies++;addLog('Сапфір дав +🦋1!');},
  amethyst:()=>{gainXP(10);addLog('Аметист дав +⭐10 XP!');},
  emerald: ()=>{P.hearts=cl(P.hearts+15,0,999999);addLog('Смарагд дав +❤️15!');},
  topaz:   ()=>{P.coins+=5;addLog('Топаз дав +🪙5!');},
  opal:    ()=>{P.energy=cl(P.energy+10);addLog('Опал дав +⚡10!');},
  ruby:    ()=>{P.butterflies+=2;addLog('Рубін дав +🦋2!');},
};
const TRAIN_CFG = [
  {key:'clothes',icon:'👗',name:'Одяг',desc:'Одяг дає +🦋1 більше краси'},
  {key:'access',icon:'👑',name:'Аксесуари',desc:'Аксесуари дають +🦋1 більше краси'},
  {key:'jewel',icon:'💍',name:'Прикраси',desc:'Прикраси дають +🦋1 більше краси'},
];
const MOODS = [[80,'😻 в захваті!'],[60,'😊 щасливий'],[40,'😐 нормально'],[20,'😿 сумний'],[0,'😤 незадоволений']];

// ── Club icons ────────────────────────────────────────
const CLUB_ICONS = ['🐱','🌟','🦋','💎','🌸','🏆','🎀','🎈','🔥','🌙','🏰','🐶','🦊','🐯','🦁'];

// ── State ─────────────────────────────────────────────
let P=null, uid=null, chatUnsub=null, onlineInt=null, decayInt=null;
let walkTicker=null, sleepTimer=null, saveTO=null;
let mailTab='inbox', currentMailId=null, ratingTab='players';
let shopFilter='food', wardrobeFilter='all', selectedGift=null, authMode='login';
let viewingPlayerId=null;

const cl  = (v,mn=0,mx=100)=>Math.max(mn,Math.min(mx,v));
const $   = id=>document.getElementById(id);
const now = ()=>new Date().toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'});
const esc = t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const san = o=>JSON.parse(JSON.stringify(o,(k,v)=>v===undefined?null:v));

// ── Save ──────────────────────────────────────────────
function saveP(){
  if(!uid||!P)return;
  try{localStorage.setItem('kg_local_'+uid,JSON.stringify(P));}catch(e){}
  clearTimeout(saveTO);
  saveTO=setTimeout(async()=>{
    try{await setDoc(doc(db,'players',uid),san(P),{merge:true});}
    catch(e){console.warn('save:',e.code);}
  },2500);
}

function showLoading(on){
  const el=$('loading-screen');
  if(!el)return;
  el.style.display=on?'flex':'none';
  if(on){
    // Safety: always hide loading after 12 seconds max
    clearTimeout(showLoading._t);
    showLoading._t=setTimeout(()=>{
      el.style.display='none';
      $('auth-screen').style.display='flex';
    },12000);
  }else{
    clearTimeout(showLoading._t);
  }
}
function setErr(m){$('auth-err').textContent=m;}
function resetBtn(){
  const b=$('auth-btn');b.disabled=false;
  b.textContent=authMode==='reg'?'Зареєструватися 🐾':'Увійти 🐾';
}

// ── mkPlayer ──────────────────────────────────────────
function mkPlayer(nickname,catname,petType='cat'){
  const pl=getPetLabel();
  return {
    nickname,catname,petType,
    coins:50,hearts:500,butterflies:0,xp:0,level:1,
    hunger:70,thirst:60,fun:50,energy:80,sleeping:false,
    sleepStart:null,sleepDur:null,
    skills:{clothes:0,access:0,jewel:0},glamour:0,
    gems:{sapphire:0,amethyst:0,emerald:0,topaz:0,opal:0,ruby:0},
    walk:null,walkCoins:0,showWins:0,
    wardrobe:[],equipped:{shirt:null,collar:null,hat:null,ring:null,toy:null,medal:null},
    clubId:null,clubDays:0,clubLoyalty:0,
    houseLevel:1,
    houseComponents:{foundation:0,roof:0,walls:0,interior:0},
    friends:[],
    bonuses:{}, // {type:{expiresAt:timestamp}}
    about:'',gifts:[],
    inbox:[
      {id:1,from:'КотяГра 🐾',subj:'Ласкаво просимо!',
       body:'Привіт, '+nickname+'! Виховуй свого '+pl.toLowerCase()+' '+catname+', тренуй навики, вступай у клуби. Удачі!',
       time:now(),read:false,type:'system'},
    ],
    sent:[],tasks:null,
    createdAt:new Date().toISOString(),
    lastSeen:new Date().toISOString(),
  };
}

// ── Sanitize ──────────────────────────────────────────
function sanitizePlayer(p){
  if(!p)return p;
  if(p.sleeping){
    if(!p.sleepStart||!p.sleepDur||Date.now()-p.sleepStart>=p.sleepDur){
      p.sleeping=false;p.sleepStart=null;p.sleepDur=null;
      p.energy=Math.min(100,(p.energy||0)+30);
    }
  }
  if(isNaN(p.butterflies))p.butterflies=0;
  if(isNaN(p.coins))p.coins=0;
  if(isNaN(p.hearts))p.hearts=500;
  if(!p.houseComponents)p.houseComponents={foundation:0,roof:0,walls:0,interior:0};
  if(!p.friends)p.friends=[];
  if(!p.bonuses)p.bonuses={};
  if(!p.petType)p.petType='cat';
  return p;
}

// ── Active bonuses ────────────────────────────────────
function hasBonus(type){ return P.bonuses?.[type]?.expiresAt > Date.now(); }
function bonusRemaining(type){
  const exp=P.bonuses?.[type]?.expiresAt||0;
  const rem=Math.max(0,exp-Date.now());
  const h=Math.floor(rem/3600000),m=Math.floor((rem%3600000)/60000);
  return h+'г '+m+'хв';
}

// ── AUTH ──────────────────────────────────────────────
window.switchTab=function(m){
  authMode=m;
  document.querySelectorAll('.auth-tab').forEach((t,i)=>t.classList.toggle('active',(i===0&&m==='login')||(i===1&&m==='reg')));
  $('a-name').style.display=m==='reg'?'block':'none';
  $('a-cat').style.display=m==='reg'?'block':'none';
  $('a-pettype').style.display=m==='reg'?'block':'none';
  $('auth-btn').textContent=m==='reg'?'Зареєструватися 🐾':'Увійти 🐾';
  setErr('');
};
window.doAuth=async function(){
  window._authQueue = null; // clear queue
  // Immediate feedback - if this runs, JS is working
  const btn=$('auth-btn');
  if(btn){btn.disabled=true;btn.textContent='⏳...';}
  setErr('');
  const email=($('a-email')?.value||'').trim();
  const pass=$('a-pass')?.value||'';
  const nick=($('a-name')?.value||'').trim();
  const cat=($('a-cat')?.value||'').trim();
  const petType=$('a-pettype')?.value||'cat';
  if(!email||!pass){setErr('❌ Заповни email і пароль!');resetBtn();return;}
  if(authMode==='reg'&&(!nick||!cat)){setErr("❌ Вкажи нікнейм та ім'я тваринки!");resetBtn();return;}
  // Timeout: if Firebase doesn't respond in 12s, show error
  const authTimer=setTimeout(()=>{
    resetBtn();
    setErr('❌ Firebase timeout (12с). Код помилки: TIMEOUT');
    alert('Firebase не відповідає 12 секунд. Можливо quota-exceeded або мережа блокує.');
  },12000);
  // Use fetch directly - we proved this works
  const API_KEY='AIzaSyB0XJ50di5qf45qBC23QKMuZJQorS593S0';
  const endpoint=authMode==='reg'
    ?'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+API_KEY
    :'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+API_KEY;

  setErr(authMode==='reg'?'Створюємо акаунт...':'Входимо...');
  try{
    const resp=await fetch(endpoint,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email,password:pass,returnSecureToken:true})
    });
    const data=await resp.json();
    clearTimeout(authTimer);

    if(data.error){
      resetBtn();
      const errMsgs={
        'EMAIL_EXISTS':'Email вже використовується!',
        'INVALID_LOGIN_CREDENTIALS':'Невірний логін або пароль!',
        'INVALID_PASSWORD':'Невірний пароль!',
        'EMAIL_NOT_FOUND':'Гравця не знайдено!',
        'TOO_MANY_ATTEMPTS_TRY_LATER':'Забагато спроб. Зачекай кілька хвилин.',
      };
      const m=data.error.message||'';
      setErr(errMsgs[m]||(m.includes('WEAK_PASSWORD')?'Пароль мінімум 6 символів!':'Помилка: '+m));
      return;
    }

    // Got token - now sign in via SDK to trigger onAuthStateChanged
    const userId=data.localId;
    setErr('✅ Успішно! Завантажуємо гру...');

    if(authMode==='reg'){
      const np=mkPlayer(nick,cat,petType);
      localStorage.setItem('kg_pending_'+userId,JSON.stringify(np));
    }

    // Sign in via SDK using email/pass (should work since account exists)
    try{
      await signInWithEmailAndPassword(auth,email,pass);
    }catch(sdkErr){
      // SDK failed but fetch worked - reload to pick up auth state
      console.warn('SDK signin failed, reloading:',sdkErr.code);
      setTimeout(()=>window.location.reload(),500);
    }
    setErr('');

  }catch(e){
    clearTimeout(authTimer);
    resetBtn();
    setErr('Помилка мережі: '+(e.message||String(e)));
  }
};
window.doGoogleAuth=async function(){
  try{
    const provider=new GoogleAuthProvider();
    // Use redirect (works on mobile Safari), popup for desktop
    const isMobile=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if(isMobile){
      await signInWithRedirect(auth,provider);
    }else{
      const r=await signInWithPopup(auth,provider);
      try{const s=await getDoc(doc(db,'players',r.user.uid));
        if(!s.exists()){const n=(r.user.displayName||'Гравець').replace(/\s+/g,'_').slice(0,20);
          await setDoc(doc(db,'players',r.user.uid),san(mkPlayer(n,'Котик','cat')));}}catch(e){}
    }
  }catch(e){if(e.code!=='auth/popup-closed-by-user')setErr(String(e.message||e));}
};
window.logout=async function(){stopAll();P=null;uid=null;await signOut(auth);};

// ── Auth observer ─────────────────────────────────────
// Handle Google redirect result - with timeout protection
Promise.race([
  getRedirectResult(auth),
  new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),5000))
]).then(async result=>{
  if(result&&result.user){
    const u=result.user;
    try{
      const s=await getDoc(doc(db,'players',u.uid));
      if(!s.exists()){
        const n=(u.displayName||u.email||'Гравець').replace(/[^a-zA-Zа-яА-Я0-9_]/g,'').slice(0,20)||'Гравець';
        await setDoc(doc(db,'players',u.uid),san(mkPlayer(n,'Котик','cat')));
      }
    }catch(e){}
  }
}).catch(e=>console.warn('redirect:',e.message));

onAuthStateChanged(auth,async user=>{
  if(!user){
    stopAll();P=null;uid=null;
    $('game-wrap').style.display='none';$('bottom-nav').style.display='none';
    $('loading-screen').style.display='none';
    $('auth-screen').style.display='flex';
    resetBtn();return;
  }
  uid=user.uid;
  $('auth-screen').style.display='none';
  showLoading(true);

  // FAST PATH: use localStorage cache immediately so game opens fast
  const local=localStorage.getItem('kg_local_'+uid);
  const pending=localStorage.getItem('kg_pending_'+uid);

  if(pending){
    try{P=sanitizePlayer(JSON.parse(pending));}catch(e){P=null;}
    localStorage.removeItem('kg_pending_'+uid);
    if(P){
      startGame();
      setDoc(doc(db,'players',uid),san(P)).catch(()=>{});
      return;
    }
  }

  if(local){
    try{P=sanitizePlayer(JSON.parse(local));}catch(e){P=null;}
    if(P){
      startGame(); // open immediately from cache
      // sync with Firestore in background (non-blocking)
      getDoc(doc(db,'players',uid)).then(s=>{
        if(s.exists()){
          const r=sanitizePlayer(s.data());
          if((r.level||1)>=(P.level||1)){P=r;render();renderPetPage();}
        }
        // Always write back to ensure Firestore is up to date
        setDoc(doc(db,'players',uid),san(P),{merge:true}).catch(()=>{});
      }).catch(()=>{});
      return;
    }
  }

  // NO cache — must fetch from Firestore (new device)
  // Add 10s timeout to avoid hanging forever
  const firestoreTimeout=new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),10000));
  try{
    const s=await Promise.race([getDoc(doc(db,'players',uid)),firestoreTimeout]);
    if(s.exists()){
      P=sanitizePlayer(s.data());
    }else{
      const emailNick=(user.email||'').split('@')[0].replace(/\W/g,'').slice(0,18)||'Гравець';
      P=mkPlayer(emailNick,'Котик','cat');
      setDoc(doc(db,'players',uid),san(P)).catch(()=>{});
    }
  }catch(e){
    // Firestore unavailable — create minimal player from email
    console.warn('Firestore unavailable:',e.message);
    const emailNick=(user.email||'').split('@')[0].replace(/\W/g,'').slice(0,18)||'Гравець';
    P=mkPlayer(emailNick,'Котик','cat');
    // Save to localStorage so next load is from cache
    try{localStorage.setItem('kg_local_'+uid,JSON.stringify(P));}catch(_){}
  }
  startGame();
});

function startGame(){
  try{
  $('game-wrap').style.display='flex';$('bottom-nav').style.display='flex';showLoading(false);
  // FIX #6: show actual catname everywhere
  const pname=P.catname||'Тваринка';
  $('s-pn').textContent=pname+' ▾';
  $('cat-dn').textContent=pname;
  buildGems();buildTrain();buildShop('food');buildShowPage();
  initTasks();render();renderPetPage();
  startDecay();startOnline();
  if(P.walk&&Date.now()-P.walk.start<P.walk.dur)resumeWalk();
  else if(P.walk)finishWalk(true);
  if(P.sleeping&&P.sleepStart&&P.sleepDur){$('cat-emoji').textContent='😴';startSleepTimer();}
  saveP();updateMailBadge();
  }catch(startErr){
    console.error('startGame error:',startErr);
    showLoading(false);
    $('game-wrap').style.display='flex';$('bottom-nav').style.display='flex';
  }
}

function stopAll(){
  clearInterval(decayInt);clearInterval(onlineInt);clearInterval(walkTicker);
  clearTimeout(saveTO);clearTimeout(sleepTimer);
  if(chatUnsub){chatUnsub();chatUnsub=null;}
}
function startOnline(){
  const u=async()=>{
    try{await setDoc(doc(db,'online',uid),{uid,nickname:P?.nickname,t:Date.now()},{merge:true});
      const s=await getDocs(collection(db,'online'));
      const c=s.docs.filter(d=>(d.data().t||0)>Date.now()-3*60*1000).length;
      if($('s-on'))$('s-on').textContent=c;if($('chat-on'))$('chat-on').textContent=c;}catch(e){}};
  u();onlineInt=setInterval(u,45000);
}

// ── Sleep ─────────────────────────────────────────────
function startSleepTimer(){
  clearTimeout(sleepTimer);
  const tick=()=>{
    if(!P||!P.sleeping){return;}
    const elapsed=Date.now()-(P.sleepStart||Date.now());
    const total=P.sleepDur||1200000;
    const rem=Math.max(0,total-elapsed);
    const pct=Math.min(100,elapsed/total*100);
    const mins=Math.floor(rem/60000),secs=Math.floor((rem%60000)/1000);
    const cd=$('sleep-countdown');if(cd)cd.textContent='⏱ '+mins+'хв '+String(secs).padStart(2,'0')+'с';
    const bar=$('sleep-bar');if(bar)bar.style.width=pct+'%';
    if(rem<=0){wakeUp();}else{sleepTimer=setTimeout(tick,1000);}
  };tick();
}
function wakeUp(){
  P.sleeping=false;P.sleepStart=null;P.sleepDur=null;
  P.energy=cl((P.energy||0)+30);P.hunger=cl((P.hunger||0)+5);
  const emojis=getPetEmojis();
  $('cat-emoji').textContent=emojis[1]||emojis[0];
  const cd=$('sleep-countdown');if(cd)cd.textContent='';
  const bar=$('sleep-bar');if(bar)bar.style.width='0%';
  addLog(P.catname+' прокинувся відпочилим! ⚡');
  notify('☀️ Прокинувся!','+30⚡ +5🍖');gainXP(4);render();saveP();
}

// ── Page nav ──────────────────────────────────────────
window.goPage=function(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.bnav-btn').forEach(b=>b.classList.remove('active'));
  const pg=$('pg-'+id);if(pg)pg.classList.add('active');
  const nb=$('nb-'+id);if(nb)nb.classList.add('active');
  if(id==='gems')renderGems();
  if(id==='train'){buildTrain();renderTrain();}
  if(id==='clubs'){renderClubs();if(P.clubId)loadClubData();}
  if(id==='ratings')loadRatings(ratingTab);
  if(id==='mail'){renderMail();closeCompose();closeMailDetail();}
  if(id==='chat')startChat();
  if(id==='walks')renderWalkLB();
  if(id==='pet')renderPetPage();
  if(id==='shop')buildShop(shopFilter);
  if(id==='show')buildShowPage();
  if(id==='tasks'){initTasks();renderTasks();}
  if(id==='settings')renderSettings();
  if(id==='friends')renderFriendsPage();
};

// ── Beauty calc ───────────────────────────────────────
function calcBeauty(){
  let b=P.butterflies||0;
  Object.values(P.equipped||{}).forEach(id=>{
    if(!id)return;
    const item=CLOTHES_CATALOG.find(c=>c.id===id);
    if(item){b+=item.beauty+(P.skills?.clothes||0);}
  });
  try{const sd=getHouseStarData();if(sd&&typeof sd.beauty==='number')b+=sd.beauty;}catch(e){}
  if(hasBonus('vip'))b+=20;
  return isNaN(b)?0:b;
}

// ── Render ────────────────────────────────────────────
function render(){
  P.butterflies=P.butterflies||0;P.coins=P.coins||0;P.hearts=P.hearts||0;
  P.xp=P.xp||0;P.level=P.level||1;
  const beauty=calcBeauty();
  $('s-b').textContent=beauty;
  $('s-c').textContent=P.coins;
  $('s-h').textContent=P.hearts;
  $('s-lv').textContent=P.level;
  const cap=xpCap(P.level);
  $('s-xp').textContent=P.xp+'/'+cap+' XP';
  $('s-lf').style.width=(P.xp/cap*100)+'%';
  [['hunger','h'],['thirst','t'],['fun','f'],['energy','e']].forEach(([k,id])=>{
    const v=cl(P[k]||0);$('b-'+id).style.width=v+'%';$('v-'+id).textContent=v+'%';
  });
  const avg=((P.hunger||0)+(P.thirst||0)+(P.fun||0)+(P.energy||0))/4;
  let mood=MOODS[MOODS.length-1][1];for(const[t,m]of MOODS)if(avg>=t){mood=m;break;}
  $('cat-mood').textContent='Настрій: '+mood;
  const emojis=getPetEmojis();
  if(!P.sleeping)$('cat-emoji').textContent=emojis[Math.min(4,Math.floor(avg/100*5))];
  $('sl-ov').classList.toggle('on',!!P.sleeping);
  // FIX #6: catname in top bar
  const pname=P.catname||'Тваринка';
  $('s-pn').textContent=pname+' ▾';
  $('cat-dn').textContent=pname;
  updateMailBadge();
  try{localStorage.setItem('kg_local_'+uid,JSON.stringify(P));}catch(e){}
}

function renderPetPage(){
  const beauty=calcBeauty();
  const emojis=getPetEmojis();
  $('pet-big-emoji').textContent=emojis[Math.min(4,Math.floor(((P.hunger||0)+(P.thirst||0)+(P.fun||0)+(P.energy||0))/400*5))];
  // FIX #6: always show catname
  const pname=P.catname||'Тваринка';
  $('pet-cat-name').textContent=pname;
  $('pet-cat-lvl').textContent=(P.level||1)+' рівень';
  $('ps-name').textContent=pname;
  $('ps-lv').textContent=P.level||1;
  $('ps-about').textContent=P.about||'заповнити...';
  $('ps-about').style.color=P.about?'var(--tx)':'var(--gold)';
  const cap=xpCap(P.level||1);
  $('ps-xp').textContent=P.xp||0;$('ps-cap').textContent=cap;
  $('ps-xpbar').style.width=((P.xp||0)/cap*100)+'%';
  $('ps-beauty').textContent=beauty;
  $('ps-club').textContent='Клуб: '+(P.clubId?'завантаження...':'—');
  $('ps-loyalty').textContent=(P.clubLoyalty||0)+'%';
  $('ps-clubdays').textContent=P.clubDays||0;
  const days=Math.floor((Date.now()-new Date(P.createdAt||Date.now()).getTime())/86400000);
  $('ps-gamedays').textContent=days;
  $('ps-coins').textContent=P.coins||0;
  $('ps-hearts').textContent=P.hearts||0;
  // pet type badge
  const ptEl=$('ps-pettype');if(ptEl)ptEl.textContent=getPetIcon()+' '+getPetLabel();
  // equipped slots
  const slotDefs={shirt:'👕',collar:'➿',hat:'🎩',ring:'💍',toy:'🎾',medal:'🏅'};
  Object.entries(slotDefs).forEach(([slot,def])=>{
    const eqId=(P.equipped||{})[slot];
    const eqEl=$('eq-'+slot);
    if(eqEl){const item=eqId?CLOTHES_CATALOG.find(c=>c.id===eqId):null;eqEl.textContent=item?item.icon:def;}
    const slotEl=$('slot-'+slot);if(slotEl)slotEl.classList.toggle('equipped',!!eqId);
  });
  // house
  const sd=getHouseStarData();const star=getHouseStar();
  $('house-emoji').textContent=sd.emoji;$('house-name').textContent=sd.name;
  $('house-beauty').textContent=sd.beauty;
  $('house-lvl').textContent=(P.houseLevel||1)+'/10';
  if($('house-star'))$('house-star').textContent=star;
  if($('house-stars-display'))$('house-stars-display').textContent='⭐'.repeat(star)+'☆'.repeat(Math.max(0,5-star));
  $('house-upgrade-btn').disabled=star>=5;
  $('house-upgrade-btn').textContent=star>=5?'🌟 Максимум! 5 зірок':'🏗️ Увійти та покращити будинок';
  // counters
  const unread=(P.inbox||[]).filter(m=>!m.read).length;
  $('pm-mail-cnt').textContent=unread>0?unread+' непрочитаних':'';
  $('pm-wardrobe-cnt').textContent=(P.wardrobe||[]).length+' з 20';
  $('pm-gifts-cnt').textContent=(P.gifts||[]).length;
  $('pm-gems-cnt').textContent=GEMS_CFG.map(g=>(P.gems?.[g.key])||0).reduce((a,b)=>a+b,0);
  $('pm-train-cnt').textContent=((P.skills?.clothes||0)+(P.skills?.access||0)+(P.skills?.jewel||0));
}

// ── House modal ───────────────────────────────────────
window.openHouseModal=function(){
  if(!P.houseComponents)P.houseComponents={foundation:0,roof:0,walls:0,interior:0};
  const modal=$('house-modal');if(!modal)return;
  renderHouseModal();modal.style.display='flex';
};
window.closeHouseModal=function(){$('house-modal').style.display='none';};
function renderHouseModal(){
  const comps=P.houseComponents||{foundation:0,roof:0,walls:0,interior:0};
  const star=getHouseStar();const sd=getHouseStarData();
  $('hm-visual').textContent=sd.emoji;$('hm-name').textContent=sd.name;
  $('hm-beauty').textContent='+'+sd.beauty+' 🦋 краси';
  const starsDisp='⭐'.repeat(star)+'☆'.repeat(Math.max(0,5-star));
  $('hm-stars').textContent=starsDisp;
  const cost=HOUSE_COMP_COSTS[Math.min(star,4)];
  $('hm-components').innerHTML=HOUSE_COMPONENTS.map(c=>{
    const lv=comps[c.key]||0;const maxed=lv>=5;
    const myStars='⭐'.repeat(lv)+'☆'.repeat(5-lv);
    const canAfford=(P.coins||0)>=cost;
    return `<div class="hm-comp-row">
      <span class="hm-comp-icon">${c.icon}</span>
      <div style="flex:1"><div class="hm-comp-name">${c.name}</div><div class="hm-comp-stars">${myStars}</div></div>
      ${maxed?'<span class="hm-comp-max">✅ Макс.</span>'
        :`<button class="hm-comp-btn ${!canAfford?'disabled':''}" ${!canAfford?'disabled':''} onclick="upgradeHouseComponent('${c.key}')">🪙 ${cost}</button>`}
    </div>`;
  }).join('');
  const minComp=Math.min(...HOUSE_COMPONENTS.map(c=>comps[c.key]||0));
  const nextStar=minComp+1;
  if(nextStar>5){$('hm-star-progress').innerHTML='<div style="text-align:center;color:var(--gn);font-weight:800">🌟 Будинок максимально покращено!</div>';}
  else{
    const needed=HOUSE_COMPONENTS.filter(c=>(comps[c.key]||0)<nextStar);
    $('hm-star-progress').innerHTML=`<div class="hm-progress-info">До ⭐${nextStar} зірки: покращ ${needed.map(c=>c.icon+' '+c.name).join(', ')}</div>`;
  }
}
window.upgradeHouseComponent=function(compKey){
  if(!P.houseComponents)P.houseComponents={foundation:0,roof:0,walls:0,interior:0};
  const comps=P.houseComponents;const curLv=comps[compKey]||0;
  if(curLv>=5){notify('✅ Максимум!','Ця складова вже максимальна!');return;}
  const star=getHouseStar();const cost=HOUSE_COMP_COSTS[Math.min(star,4)];
  if((P.coins||0)<cost){notify('🪙 Мало монет','Потрібно 🪙 '+cost+'!');return;}
  P.coins-=cost;comps[compKey]=curLv+1;
  const c=HOUSE_COMPONENTS.find(x=>x.key===compKey);
  addLog(c.icon+' '+c.name+' покращено до рівня '+(curLv+1)+'!');
  const newStar=getHouseStar();
  if(newStar>star){
    const sd=getHouseStarData();P.houseLevel=newStar*2;
    notify('⭐ Нова зірка!',sd.emoji+' '+sd.name+' — +'+sd.beauty+' 🦋!');
    addLog('🎉 Будинок отримав '+newStar+' зірку! '+sd.name);wiggle();
  }else{notify('🏗️ Покращено!',c.name+' рівень '+(curLv+1));}
  renderHouseModal();renderPetPage();render();saveP();
};
window.upgradeHouse=function(){openHouseModal();};

// ── Settings (FIX #4) ─────────────────────────────────
function renderSettings(){
  const el=$('settings-pettype');
  if(el)el.value=P.petType||'cat';
  const nick=$('settings-nickname');if(nick)nick.textContent=P.nickname||'';
  const cat=$('settings-catname-val');if(cat)cat.textContent=P.catname||'';
  // bonuses status
  const bonusEl=$('settings-bonuses');
  if(bonusEl){
    const active=[];
    if(hasBonus('premium'))active.push('👑 Преміум: '+bonusRemaining('premium'));
    if(hasBonus('vip'))active.push('💎 VIP: '+bonusRemaining('vip'));
    bonusEl.textContent=active.length?active.join(' · '):'Немає активних бонусів';
  }
}
window.savePetType=function(){
  const sel=$('settings-pettype');if(!sel)return;
  P.petType=sel.value;
  saveP();render();renderPetPage();
  notify('✅ Збережено','Тип тваринки змінено на '+getPetLabel());
  // update emoji
  const emojis=getPetEmojis();
  $('cat-emoji').textContent=emojis[0];
  $('pet-big-emoji').textContent=emojis[0];
};
window.openChangeCatname=function(){
  $('change-catname-modal').style.display='flex';
  $('new-catname-inp').value=P.catname||'';
};
window.closeChangeCatname=function(){$('change-catname-modal').style.display='none';};
window.saveCatname=function(){
  const v=$('new-catname-inp').value.trim();
  if(!v){notify('❌ Помилка','Введи ім\'я!');return;}
  P.catname=v.slice(0,20);
  closeChangeCatname();saveP();render();renderPetPage();
  notify('✅ Збережено','Ім\'я тваринки: '+P.catname);
};

// ── About ─────────────────────────────────────────────
window.editAbout=function(){$('about-text').value=P.about||'';$('about-modal').style.display='flex';};
window.closeAbout=function(){$('about-modal').style.display='none';};
window.saveAbout=function(){
  P.about=$('about-text').value.trim().slice(0,120);
  closeAbout();renderPetPage();saveP();notify('✅ Збережено','Інформацію оновлено!');
};
window.raiseClubLoyalty=function(){
  if((P.hearts||0)<50){notify('❤️ Мало сердечок','Потрібно 50 сердечок!');return;}
  if(!P.clubId){notify('🎈 Немає клубу','Спочатку вступи до клубу!');return;}
  P.hearts=cl((P.hearts||0)-50,0,999999);
  P.clubLoyalty=Math.min(100,(P.clubLoyalty||0)+10);
  notify('🎗️ Вірність підвищено!','Вірність клубу: '+P.clubLoyalty+'%');
  renderPetPage();render();saveP();
};

// ── Notify / Log ──────────────────────────────────────
function notify(t,b,dur=2800){
  $('nt').textContent=t;$('nb').textContent=b;
  const n=$('notif');n.classList.add('show');
  clearTimeout(n._t);n._t=setTimeout(()=>n.classList.remove('show'),dur);
}
function addLog(msg){
  const box=$('log-box');if(!box)return;
  const el=document.createElement('div');el.className='log-e';el.textContent=msg;
  box.appendChild(el);box.scrollTop=box.scrollHeight;
}
function wiggle(){const el=$('cat-emoji');if(!el)return;el.classList.remove('wiggle');void el.offsetWidth;el.classList.add('wiggle');setTimeout(()=>el.classList.remove('wiggle'),500);}
function updateMailBadge(){
  const cnt=(P.inbox||[]).filter(m=>!m.read).length;
  const b=$('mail-badge');if(b){b.style.display=cnt>0?'block':'none';b.textContent=cnt;}
  const uc=$('unread-cnt');if(uc)uc.textContent=cnt>0?cnt:'';
}

// ── XP / Level up ─────────────────────────────────────
function gainXP(n){
  const mult=hasBonus('vip')?4:hasBonus('premium')?2:1;
  P.xp=(P.xp||0)+n*mult;
  const cap=xpCap(P.level||1);
  if(P.xp>=cap){
    P.xp-=cap;P.level=(P.level||1)+1;
    showLevelUp(P.level);wiggle();
  }
  render();saveP();
}
function showLevelUp(lvl){
  const prizes=[];
  const coinPrize=lvl*10;prizes.push('🪙 '+coinPrize+' монет');P.coins=(P.coins||0)+coinPrize;
  const hPrize=lvl*20;prizes.push('❤️ '+hPrize+' сердечок');P.hearts=cl((P.hearts||0)+hPrize,0,999999);
  if(lvl%3===0){prizes.push('🦋 +'+lvl+' красу');P.butterflies=(P.butterflies||0)+lvl;}
  if(lvl%5===0){prizes.push('💎 Сапфір');P.gems=P.gems||{};P.gems.sapphire=(P.gems.sapphire||0)+1;}
  if(lvl===5)prizes.push('🎁 Нові магазинні предмети розблоковано!');
  if(lvl===8)prizes.push('🏆 Епічний одяг розблоковано!');
  $('lup-level').textContent=lvl;
  $('lup-rewards').innerHTML=prizes.map(p=>`<div class="lup-reward-item">${p}</div>`).join('');
  $('level-up-modal').style.display='flex';
  addLog('🎉 Рівень '+lvl+'! Нагороди: '+prizes.join(', '));
}
window.closeLevelUp=function(){$('level-up-modal').style.display='none';};

// ── Actions ───────────────────────────────────────────
window.petCat=function(){
  if(P.sleeping){addLog('Тихіше! '+P.catname+' спить...');return;}
  P.hearts=cl((P.hearts||0)+1,0,999999);P.fun=cl((P.fun||0)+5);gainXP(2);wiggle();
  const msgs=['Мур-р-р! 😻',P.catname+' муркоче від задоволення!','Пррр-пррр! ❤️',P.catname+' дуже радіє!'];
  addLog(msgs[Math.floor(Math.random()*msgs.length)]);
};
window.act=function(type){
  if(P.sleeping&&type!=='sleep'){notify('💤 Сон',P.catname+' спить! Зачекайте...');return;}
  switch(type){
    case'feed':
      if((P.hunger||0)>=100){notify('😋 Ситий!',P.catname+' не хоче їсти.');return;}
      P.hunger=cl((P.hunger||0)+25);gainXP(3);
      addLog(P.catname+' поїв 🍖');notify('🍖 Смачно!','+25 їжа');
      trackTask('feedCount');break;
    case'water':
      if((P.thirst||0)>=100){notify('💧 Напоєний!',P.catname+' не хоче пити.');return;}
      P.thirst=cl((P.thirst||0)+30);gainXP(2);
      addLog(P.catname+' попив 💧');notify('💧 Освіжився!','+30 вода');
      trackTask('waterCount');break;
    case'play':
      if((P.energy||0)<15){notify('😴 Втомлений',P.catname+' занадто втомлений!');return;}
      P.fun=cl((P.fun||0)+20);P.energy=cl((P.energy||0)-15);
      P.hearts=cl((P.hearts||0)+2,0,999999);gainXP(5);
      addLog(P.catname+' пограв! 🎉');notify('🎾 Весело!','+20 розваги');
      trackTask('playCount');break;
    case'sleep':
      if(P.sleeping){notify('💤 Вже спить',P.catname+' ще спить...');return;}
      P.sleeping=true;P.sleepStart=Date.now();P.sleepDur=20*60*1000;
      $('cat-emoji').textContent='😴';
      addLog(P.catname+' ліг спати на 20 хв 💤');
      notify('💤 Спить!','Прокинеться через 20 хвилин ⏱');
      render();startSleepTimer();saveP();return;
    case'show':goPage('show');return;
  }
  render();saveP();
};

// ── Shop ──────────────────────────────────────────────
// FIX #2: Bonuses category added
const SHOP_ITEMS = {
  food:[
    {id:'fish',icon:'🐟',name:'Рибка',desc:'+30🍖, +1🦋',cost:8,effect:()=>{P.hunger=cl((P.hunger||0)+30);P.butterflies=(P.butterflies||0)+1;}},
    {id:'milk',icon:'🥛',name:'Молочко',desc:'+20💧 вода',cost:5,effect:()=>{P.thirst=cl((P.thirst||0)+20);}},
    {id:'cake',icon:'🎂',name:'Тортик',desc:'+40🍖, +20😊',cost:15,effect:()=>{P.hunger=cl((P.hunger||0)+40);P.fun=cl((P.fun||0)+20);}},
    {id:'premium_food',icon:'🍱',name:'Преміум корм',desc:'+50🍖 +30💧',cost:30,effect:()=>{P.hunger=cl((P.hunger||0)+50);P.thirst=cl((P.thirst||0)+30);}},
    {id:'energy_drink',icon:'⚡',name:'Енергетик',desc:'+40⚡',cost:20,effect:()=>{P.energy=cl((P.energy||0)+40);}},
    {id:'ball',icon:'🎾',name:'М\'ячик',desc:'+20😊, +5⚡',cost:10,effect:()=>{P.fun=cl((P.fun||0)+20);P.energy=cl((P.energy||0)+5);}},
  ],
  clothes:CLOTHES_CATALOG.map(c=>({...c,isCloth:true})),
  accessories:CLOTHES_CATALOG.filter(c=>['collar','hat','ring','medal'].includes(c.slot)).map(c=>({...c,isCloth:true})),
  gems:[
    {id:'gem_pack1',icon:'💎',name:'Сапфір ×5',desc:'5 частин сапфіру',cost:50,effect:()=>{P.gems=P.gems||{};P.gems.sapphire=(P.gems.sapphire||0)+5;}},
    {id:'gem_pack2',icon:'💜',name:'Аметист ×5',desc:'5 частин аметисту',cost:50,effect:()=>{P.gems=P.gems||{};P.gems.amethyst=(P.gems.amethyst||0)+5;}},
    {id:'gem_pack3',icon:'💚',name:'Смарагд ×5',desc:'5 частин смарагду',cost:50,effect:()=>{P.gems=P.gems||{};P.gems.emerald=(P.gems.emerald||0)+5;}},
    {id:'gem_pack4',icon:'❤️‍🔥',name:'Рубін ×3',desc:'3 частини рубіну',cost:80,effect:()=>{P.gems=P.gems||{};P.gems.ruby=(P.gems.ruby||0)+3;}},
  ],
  special:[
    {id:'xp_boost',icon:'⭐',name:'Буст XP ×2',desc:'Подвійний XP на 5 хв',cost:100,effect:()=>{notify('⭐ Буст!','×2 XP на 5 хвилин!');}},
    {id:'heart_pack',icon:'❤️',name:'100 сердечок',desc:'Поповни сердечка',cost:50,effect:()=>{P.hearts=cl((P.hearts||0)+100,0,999999);}},
    {id:'beauty_elixir',icon:'🌟',name:'Еліксир краси',desc:'+10🦋 краси назавжди',cost:200,effect:()=>{P.butterflies=(P.butterflies||0)+10;}},
  ],
  bonuses:[], // built dynamically
};

const BONUS_DEFS = [
  {
    id:'premium',icon:'👑',name:'Преміум-акаунт',cost:30,dur:24*3600*1000,
    perks:['+⭐ 100% досвіду','+❤️ 50% відновлення сердечок'],
    effect:()=>{
      P.bonuses=P.bonuses||{};
      P.bonuses.premium={expiresAt:Date.now()+24*3600*1000};
      addLog('👑 Преміум-акаунт активовано на 24 год!');
      notify('👑 Преміум!','×2 XP на 24 години!',4000);
    }
  },
  {
    id:'vip',icon:'💎',name:'VIP-акаунт',cost:100,dur:24*3600*1000,
    perks:['+🦋 10 краси за кожну медаль','+⭐ 300% досвіду','+❤️ 200% відновлення'],
    effect:()=>{
      P.bonuses=P.bonuses||{};
      P.bonuses.vip={expiresAt:Date.now()+24*3600*1000};
      P.butterflies=(P.butterflies||0)+20;
      addLog('💎 VIP-акаунт активовано на 24 год!');
      notify('💎 VIP!','×4 XP + +20🦋 на 24 години!',4000);
    }
  },
];

window.filterShop=function(cat){
  shopFilter=cat;
  document.querySelectorAll('.shop-cat-btn').forEach(b=>{
    const matches=b.dataset.cat===cat||b.getAttribute('onclick')?.includes("'"+cat+"'");
    b.classList.toggle('active',!!matches);
  });
  buildShop(cat);
};

function buildShop(cat){
  const container=$('shop-items');if(!container)return;
  if(cat==='bonuses'){buildBonusShop();return;}
  const items=SHOP_ITEMS[cat]||[];
  container.innerHTML='';
  items.forEach(item=>{
    const div=document.createElement('div');div.className='shop-item-card';
    const isCloth=item.isCloth;
    const isOwned=isCloth&&(P.wardrobe||[]).includes(item.id);
    const isEquipped=isCloth&&Object.values(P.equipped||{}).includes(item.id);
    const lvlOk=(P.level||1)>=(item.lvlReq||1);
    const rarColor=RARITY_COLOR[item.rarity]||'#aaa';
    const rarLabel=RARITY_LABEL[item.rarity]||'';
    div.innerHTML=`<span class="si-icon">${item.icon}</span>
      <div class="si-info">
        <div class="si-name">${item.name}</div>
        ${item.rarity?`<div class="si-req" style="color:${rarColor}">${rarLabel}</div>`:''}
        <div class="si-desc">${item.desc||item.bonus||''}</div>
        ${(item.lvlReq||1)>1?`<div class="si-req">Потрібно ${item.lvlReq} рівень</div>`:''}
      </div>
      ${isEquipped?`<span class="si-owned">✅ Одягнено</span>`:
        isOwned?`<button class="si-buy" onclick="equipItem('${item.id}')">Одягнути</button>`:
        `<button class="si-buy" ${(!lvlOk||((P.coins||0)<item.cost))?'disabled':''} onclick="buyShopItem('${item.id}','${cat}')">
          ${!lvlOk?'Рів.'+item.lvlReq:'🪙 '+item.cost}
        </button>`}`;
    container.appendChild(div);
  });
}

function buildBonusShop(){
  const container=$('shop-items');if(!container)return;
  container.innerHTML=`<div class="bonus-shop-header">🎁 Бонуси діють 24 години після покупки</div>`;
  BONUS_DEFS.forEach(b=>{
    const active=hasBonus(b.id);
    const rem=active?bonusRemaining(b.id):'';
    const div=document.createElement('div');div.className='bonus-card';
    div.innerHTML=`
      <div class="bonus-card-top">
        <span class="bonus-icon">${b.icon}</span>
        <div class="bonus-info">
          <div class="bonus-name">${b.name}</div>
          ${b.perks.map(p=>`<div class="bonus-perk">+ ${p}</div>`).join('')}
        </div>
      </div>
      ${active
        ?`<div class="bonus-active-badge">✅ Активний · залишилось ${rem}</div>`
        :`<button class="bonus-buy-btn ${(P.coins||0)<b.cost?'disabled':''}" ${(P.coins||0)<b.cost?'disabled':''} onclick="buyBonus('${b.id}')">
            Купити за 🪙 ${b.cost}
          </button>`}
      <div class="bonus-dur">на 24 години</div>`;
    container.appendChild(div);
  });
}

window.buyBonus=function(id){
  const b=BONUS_DEFS.find(x=>x.id===id);if(!b)return;
  if((P.coins||0)<b.cost){notify('🪙 Мало монет','Потрібно 🪙 '+b.cost+'!');return;}
  P.coins-=b.cost;
  b.effect();
  render();saveP();buildBonusShop();
};

window.buyShopItem=function(id,cat){
  const items=[...SHOP_ITEMS.food,...SHOP_ITEMS.gems,...SHOP_ITEMS.special,...CLOTHES_CATALOG];
  const item=items.find(i=>i.id===id);if(!item)return;
  if((P.coins||0)<item.cost){notify('🪙 Мало монет','Потрібно '+item.cost+' монет!');return;}
  if((P.level||1)<(item.lvlReq||1)){notify('⬆️ Низький рівень','Потрібно '+item.lvlReq+' рівень!');return;}
  P.coins-=item.cost;
  if(item.isCloth){
    P.wardrobe=P.wardrobe||[];
    if(!P.wardrobe.includes(id)){
      if(P.wardrobe.length>=20){notify('🚪 Шафа повна','Продай або видали речі!');P.coins+=item.cost;return;}
      P.wardrobe.push(id);
    }
    if(!(P.equipped||{})[item.slot]){P.equipped=P.equipped||{};P.equipped[item.slot]=id;}
    addLog('Куплено '+item.name+'!');notify('✨ Куплено!',item.name+' у шафі!');
  }else{
    item.effect?.();addLog('Куплено: '+item.name);notify('✨ Куплено!',item.name);
  }
  gainXP(5);renderPetPage();render();saveP();buildShop(cat);
};

window.equipItem=function(id){
  const item=CLOTHES_CATALOG.find(c=>c.id===id);if(!item)return;
  P.equipped=P.equipped||{};
  if(P.equipped[item.slot]===id){P.equipped[item.slot]=null;notify('✅ Знято',item.name+' знято');}
  else{P.equipped[item.slot]=id;notify('✅ Одягнено',item.name+'! +'+item.beauty+' 🦋');}
  renderPetPage();render();saveP();
  if($('wardrobe-modal')?.style.display!=='none')renderWardrobe(wardrobeFilter);
};

// ── Wardrobe ──────────────────────────────────────────
window.openWardrobe=function(filter){
  wardrobeFilter=filter==='all'?'all':filter;
  $('wardrobe-title').textContent='🚪 Шафа — '+P.catname;
  renderWardrobe(wardrobeFilter);
  $('wardrobe-modal').style.display='flex';
};
window.closeWardrobe=function(){$('wardrobe-modal').style.display='none';};
window.filterWardrobe=function(f){
  wardrobeFilter=f;
  document.querySelectorAll('.cf-btn').forEach(b=>b.classList.toggle('active',
    (b.textContent.includes('Всі')&&f==='all')||b.getAttribute('onclick')?.includes("'"+f+"'")));
  renderWardrobe(f);
};
function renderWardrobe(filter){
  const grid=$('wardrobe-grid');if(!grid)return;
  const owned=P.wardrobe||[];$('wardrobe-used').textContent=owned.length;
  let items=CLOTHES_CATALOG.filter(c=>owned.includes(c.id));
  if(filter&&filter!=='all')items=items.filter(c=>c.slot===filter);
  const emptySlots=Math.max(0,Math.min(8,20-owned.length));
  grid.innerHTML=items.map(item=>{
    const isEq=Object.values(P.equipped||{}).includes(item.id);
    const rarColor=RARITY_COLOR[item.rarity]||'#aaa';
    return `<div class="wardrobe-item ${isEq?'equipped':''}" onclick="equipItem('${item.id}')">
      <span class="wi-icon">${item.icon}</span><span class="wi-name">${item.name}</span>
      <span class="wi-beauty" style="color:${rarColor}">+${item.beauty}🦋</span>
      ${isEq?'<span class="wi-badge">Одягнено</span>':''}
    </div>`;
  }).join('');
  if(!items.length&&!emptySlots){grid.innerHTML='<div class="loading-inline" style="grid-column:span 4">Шафа порожня!</div>';}
  for(let i=0;i<Math.min(emptySlots,4);i++){
    grid.innerHTML+=`<div class="wardrobe-item empty-slot"><span class="wi-icon">➕</span><span class="wi-name">Порожньо</span></div>`;
  }
}

// ── Show / Exhibition ─────────────────────────────────
const SHOW_CATS = [
  {id:'beauty',name:'Краса',icon:'🦋',reqLvl:1,entryFee:5,prizes:['🪙 50','🦋 +10','💎 Камінь']},
  {id:'glamour',name:'Гламур',icon:'🌸',reqLvl:3,entryFee:10,prizes:['🪙 150','❤️ 200','👑 Корона']},
  {id:'fashion',name:'Мода',icon:'👗',reqLvl:5,entryFee:20,prizes:['🪙 300','🦋 +30','🥇 Медаль']},
  {id:'champion',name:'Чемпіон клубу',icon:'🏆',reqLvl:8,entryFee:50,prizes:['🪙 1000','🎀 Бантик','👑 Трон']},
  {id:'summer',name:'Літня виставка',icon:'☀️',reqLvl:1,entryFee:0,prizes:['🪙 500','🦋 +50','🌟 Особл. нагорода'],special:true},
];


// ── Training ──────────────────────────────────────────
function buildTrain(){
  const c=$('train-items');if(!c)return;
  c.innerHTML=TRAIN_CFG.map(({key,icon,name,desc})=>{
    const lv=(P.skills?.[key])||0;
    return `<div class="train-item"><span class="train-icon">${icon}</span>
      <div style="flex:1"><div class="train-name">${name} + 🦋1</div>
      <div class="train-desc">${desc}</div>
      <div class="train-lvl" id="tl-${key}">Рівень: ${lv} з 80</div>
      <div class="lvl-mini-track"><div class="lvl-mini-fill" id="tf-${key}" style="width:${Math.round(lv/80*100)}%"></div></div>
      <button class="train-btn" onclick="trainSkill('${key}')">Тренувати за ❤️ 150</button>
      </div></div>`;
  }).join('');
}
function renderTrain(){
  $('t-gl').textContent=P.glamour||0;$('t-bu').textContent=P.butterflies||0;
  TRAIN_CFG.forEach(({key})=>{const lv=(P.skills?.[key])||0;
    const tl=$('tl-'+key);if(tl)tl.textContent='Рівень: '+lv+' з 80';
    const tf=$('tf-'+key);if(tf)tf.style.width=Math.round(lv/80*100)+'%';
  });
}
window.trainSkill=function(sk){
  if((P.hearts||0)<150){notify('❤️ Мало сердечок','Потрібно 150 сердечок!');return;}
  if((P.skills?.[sk]||0)>=80){notify('✅ Максимум!','Цей навик вже максимальний!');return;}
  P.hearts=cl((P.hearts||0)-150,0,999999);P.skills=P.skills||{};
  P.skills[sk]=(P.skills[sk]||0)+1;P.glamour=(P.glamour||0)+1;P.butterflies=(P.butterflies||0)+1;
  gainXP(8);
  const nm={clothes:'Одяг',access:'Аксесуари',jewel:'Прикраси'}[sk];
  addLog('Тренування "'+nm+'" рівень '+P.skills[sk]+'!');
  notify('🏋️ Тренування!',nm+' рівень '+P.skills[sk]+' · +🦋1');
  trackTask('trainCount');
  renderTrain();saveP();
};

// ── Gems ──────────────────────────────────────────────
function buildGems(){
  const gl=$('gem-list');if(!gl)return;const ga=$('gem-assemble');if(!ga)return;
  gl.innerHTML=GEMS_CFG.map(({key,icon,name,bonus,cost})=>
    `<div class="gem-row">
      <div class="gem-left"><span class="gem-icon">${icon}</span>
        <div><div class="gem-name">${name}</div><div class="gem-bonus">${bonus}</div>
        <div class="gem-mini-bar-wrap"><div class="gem-mini-bar" id="gmb-${key}" style="width:0%"></div></div>
        <div style="font-size:.6rem;color:var(--tl);font-weight:700" id="gmc-txt-${key}">0/5 частин</div></div></div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:5px">
        <span style="font-size:.85rem;font-weight:900;color:var(--tx)" id="gc-${key}">0</span>
        <button class="gem-add" onclick="collectGem('${key}',${cost})">+🪙${cost}</button>
      </div></div>`
  ).join('');
  ga.innerHTML=GEMS_CFG.map(({key,icon,name})=>
    `<button class="act-btn" onclick="assembleGem('${key}','${icon}')" style="padding:9px 5px">
      <span class="bi">${icon}</span><span class="bl">${name}</span>
      <span class="bc" id="gab-${key}">?/5</span></button>`
  ).join('');
}
function renderGems(){
  GEMS_CFG.forEach(({key})=>{
    const cnt=(P.gems?.[key])||0;const pct=Math.min(100,cnt/5*100);
    const el=$('gc-'+key);if(el)el.textContent=cnt;
    const bar=$('gmb-'+key);if(bar)bar.style.width=pct+'%';
    const txt=$('gmc-txt-'+key);if(txt)txt.textContent=cnt+'/5 частин'+(cnt>=5?' ✅':'');
    const gab=$('gab-'+key);if(gab)gab.textContent=cnt+'/5';
  });
  const si=$('gem-sum');if(si)si.textContent=GEMS_CFG.map(g=>`${g.icon}${(P.gems?.[g.key])||0}`).join(' ');
}
window.collectGem=function(g,cost){
  if((P.coins||0)<cost){notify('🪙 Мало монет','Потрібно '+cost+' монет!');return;}
  P.coins-=cost;P.gems=P.gems||{};P.gems[g]=(P.gems[g]||0)+1;
  const cfg=GEMS_CFG.find(x=>x.key===g);
  addLog('Знайдено частину: '+cfg.name+'!');notify('💎 Знайдено!',cfg.name+' (+1 частина)');
  trackTask('gemsCollected');
  renderGems();render();saveP();
};
window.assembleGem=function(g,icon){
  if((P.gems?.[g]||0)<5){notify('💎 Недостатньо','Потрібно 5 частин!');return;}
  P.gems[g]-=5;GEM_FX[g]?.();gainXP(15);wiggle();
  notify(icon+' Зібрано!','Камінь зібрано! Отримано бонус!');
  trackTask('gemsAssembled');
  renderGems();render();saveP();
};

// ── Walks ─────────────────────────────────────────────
window.startWalk=function(type,secs,minC,maxC,xp){
  if(P.walk){notify('🌳 Вже на прогулянці!','Зачекайте поки '+P.catname+' повернеться.');return;}
  if((P.energy||0)<20){notify('😴 Мало енергії',P.catname+' потрібно відпочити!');return;}
  P.walk={type,start:Date.now(),dur:secs*1000,minC,maxC,xp};P.energy=cl((P.energy||0)-15);
  const names={yard:'у двір',park:'у парк',forest:'у ліс'};
  addLog(P.catname+' пішов '+names[type]+'!');
  notify('🌳 Прогулянка!','~'+secs+' сек. Вдалого полювання!');
  showWalkUI();render();saveP();
};
function showWalkUI(){$('walk-active-div').style.display='block';$('walk-opts').style.display='none';clearInterval(walkTicker);walkTicker=setInterval(tickWalk,500);}
function resumeWalk(){showWalkUI();}
function tickWalk(){
  if(!P?.walk){clearInterval(walkTicker);return;}
  const el=Date.now()-P.walk.start;const pct=Math.min(100,el/P.walk.dur*100);
  const rem=Math.max(0,Math.ceil((P.walk.dur-el)/1000));
  const pf=$('wpf');if(pf)pf.style.width=pct+'%';
  const wt=$('walk-timer');if(wt)wt.textContent=rem+' сек';
  if(pct>=100){clearInterval(walkTicker);finishWalk(false);}
}
function finishWalk(skip){
  if(!P?.walk)return;
  if(!skip){
    const coins=P.walk.minC+Math.floor(Math.random()*(P.walk.maxC-P.walk.minC));
    P.coins=(P.coins||0)+coins;gainXP(P.walk.xp);P.walkCoins=(P.walkCoins||0)+coins;
    const gems=['sapphire','amethyst','emerald','topaz','opal','ruby'];
    const gemCount=P.walk.type==='forest'?2:1;
    for(let i=0;i<gemCount;i++){
      if(Math.random()>.45){
        const g=gems[Math.floor(Math.random()*gems.length)];
        P.gems=P.gems||{};P.gems[g]=(P.gems[g]||0)+1;
        const cfg=GEMS_CFG.find(x=>x.key===g);
        addLog('Знайдено '+cfg.icon+' '+cfg.name+' на прогулянці!');
      }
    }
    addLog(P.catname+' повернувся! Знайдено 🪙 '+coins+' монет!');
    notify('🏠 Повернувся!',P.catname+' приніс 🪙 '+coins+' + '+P.walk.xp+' XP!');
    P.tasks=P.tasks||{};P.tasks.progress=P.tasks.progress||{};
    P.tasks.progress.walkDone=(P.tasks.progress.walkDone||0)+1;
    P.tasks.progress.walkTotal=(P.tasks.progress.walkTotal||0)+1;
    trackTask('walkDone',0);trackTask('walkTotal',0);
  }
  P.walk=null;
  $('walk-active-div').style.display='none';$('walk-opts').style.display='block';
  renderWalkLB();render();saveP();
}
async function renderWalkLB(){
  const lb=$('walk-lb');if(!lb)return;lb.innerHTML='<div class="loading-inline">Завантаження...</div>';
  try{
    const snap=await getDocs(query(collection(db,'players'),orderBy('walkCoins','desc'),limit(10)));
    const m=['🥇','🥈','🥉'];
    lb.innerHTML=snap.docs.map((d,i)=>{const p=d.data();
      return `<div class="lb-row"><span class="lb-rank">${m[i]||i+1}</span>
        <span class="lb-player">${esc(p.catname||p.nickname||'?')} <span style="font-size:.65rem;opacity:.7">@${esc(p.nickname||'?')}</span>${d.id===uid?' 🌟':''}</span>
        <span class="lb-coins">🪙 ${p.walkCoins||0}</span></div>`;
    }).join('')||'<div class="loading-inline">Поки немає даних</div>';
  }catch(e){lb.innerHTML='<div class="loading-inline">Помилка</div>';}
}

// ── Decay ─────────────────────────────────────────────
function startDecay(){
  clearInterval(decayInt);
  decayInt=setInterval(()=>{
    if(!P)return;
    if(!P.sleeping){
      P.hunger=cl((P.hunger||0)-2);P.thirst=cl((P.thirst||0)-3);
      P.fun=cl((P.fun||0)-1);P.energy=cl((P.energy||0)-1);
    }else{P.energy=cl((P.energy||0)+2);P.hunger=cl((P.hunger||0)-1);P.thirst=cl((P.thirst||0)-1);}
    if(Math.random()>.75)P.coins=(P.coins||0)+1;
    // Heal hearts with premium bonus
    if(hasBonus('premium')||hasBonus('vip')){P.hearts=cl((P.hearts||0)+2,0,999999);}
    render();
    if(Math.random()>.95){
      const emojis=getPetEmojis();
      const evts=[P.catname+' знайшов пір\'їнку! 🪶',P.catname+' дивиться у вікно... 🐦',
        P.catname+' перекинув склянку! 💦',P.catname+' принюхується до квітів 🌸'];
      addLog(evts[Math.floor(Math.random()*evts.length)]);
    }
  },3500);
}

// ══════════════════════════════════════
// FIX #1: CLUBS — full rewrite
// ══════════════════════════════════════
async function loadClubs(){
  const cb=$('club-browser');if(!cb)return;
  cb.innerHTML='<div class="loading-inline">Завантаження...</div>';
  // Timeout fallback — if Firestore hangs, show error after 8s
  const clubTimeout=setTimeout(()=>{
    if(cb.innerHTML.includes('Завантаження'))
      cb.innerHTML='<div class="loading-inline">Перевір підключення до інтернету</div>';
  },8000);
  try{
    const snap=await getDocs(collection(db,'clubs'));
    clearTimeout(clubTimeout);
    if(snap.empty){
      cb.innerHTML='<div class="loading-inline">Клубів поки немає. Створи перший!</div>';
      return;
    }
    const clubs=snap.docs.map(d=>({...d.data(),_id:d.id}))
      .sort((a,b)=>(b.level||1)-(a.level||1));
    cb.innerHTML=clubs.map(c=>{
      const isMine=c.directorUid===uid||false;
      return '<div class="club-list-item" onclick="joinClub(''+c._id+'')">'
        +'<span class="cli-icon">'+(c.icon||'🎈')+'</span>'
        +'<div style="flex:1">'
          +'<div class="cli-name">'+esc(c.name||'?')+'</div>'
          +'<div class="cli-info">'+(c.memberCount||1)+' учасників · Рів.'+(c.level||1)+'</div>'
          +(c.description?'<div class="cli-desc">'+esc(c.description)+'</div>':'')
        +'</div>'
        +((c.level||1)>=5?'<span class="cli-badge">ТОП</span>':'')
        +'</div>';
    }).join('');
  }catch(e){
    console.error('[clubs] error:',e.code,e.message);
    cb.innerHTML='<div class="loading-inline" style="color:red">Помилка: '+esc(e.code||e.message)+'</div>';
  }
}

function renderClubs(){
  if(P.clubId){
    $('clubs-no-club').style.display='none';
    $('clubs-in-club').style.display='block';
  }else{
    $('clubs-no-club').style.display='block';
    $('clubs-in-club').style.display='none';
    loadClubs();
  }
}

async function loadClubData(){
  if(!P.clubId)return;
  // ensure club view is visible before writing to DOM
  const inClubEl=$('clubs-in-club');
  const noClubEl=$('clubs-no-club');
  if(inClubEl)inClubEl.style.display='block';
  if(noClubEl)noClubEl.style.display='none';
  try{
    const snap=await getDoc(doc(db,'clubs',P.clubId));
    if(!snap.exists()){P.clubId=null;saveP();renderClubs();return;}
    const c=snap.data();
    const isDirector=c.directorUid===uid;
    const S=(id,val)=>{const el=$(id);if(el)el.textContent=val;};
    // Header
    S('cl-emblem',c.icon||'🏰');
    S('cl-name',c.name||'Клуб');
    const stars=Math.min(7,c.stars||1);
    S('cl-stars','★'.repeat(stars)+'☆'.repeat(Math.max(0,7-stars)));
    const badge=$('cl-role-badge');
    if(badge){badge.textContent=isDirector?'👑 Директор':'👤 Учасник';
      badge.className='club-role-badge '+(isDirector?'role-dir':'role-mem');}
    // Info
    S('cl-desc',c.description||'—');
    S('cl-founded',c.founded||'—');
    S('cl-level',c.level||1);
    S('cl-xp',((c.xp||0)/1000).toFixed(2)+'g');
    S('cl-mc',c.memberCount||1);
    S('cl-mcount',c.memberCount||1);
    S('cl-pc',formatNum(c.piggyCoins||0));
    S('cl-ph',formatNum(c.piggyHearts||0));
    S('cl-blvl',c.buildingsLevel||1);
    S('ps-club','Клуб: '+c.name);
    const dirRow=$('club-director-row');
    if(dirRow)dirRow.style.display=isDirector?'block':'none';
    const xpNeeded=(c.level||1)*500;
    const canLvlUp=(c.xp||0)>=xpNeeded;
    const lvlBtn=$('club-lvlup-btn');
    if(lvlBtn){lvlBtn.style.display=isDirector&&canLvlUp?'block':'none';}
    // Members list
    const mSnap=await getDocs(query(collection(db,'clubs',P.clubId,'members'),limit(50)));
    const roles={director:'Директор',deputy:'Зам. Директора',curator:'Куратор',member:'Учасник'};
    const rcls={director:'role-dir',deputy:'role-dep',curator:'role-cur',member:'role-mem'};
    const emojis=getPetEmojis();
    $('cl-members').innerHTML=mSnap.docs.map(md=>{
      const m=md.data();const rk=m.role||'member';
      const av=emojis[Math.floor(Math.random()*emojis.length)];
      return `<div class="member-row">
        <span class="member-av">${av}</span>
        <span class="member-name">${esc(m.nickname||'?')}</span>
        <span class="member-pts">${formatNum(m.points||0)}</span>
        <span class="member-role ${rcls[rk]}">${roles[rk]}</span>
        ${isDirector&&md.id!==uid?`<button class="member-role-btn" onclick="promoteClubMember('${md.id}','${m.role||'member'}')">⬆️</button>`:''}
      </div>`;
    }).join('');
  }catch(e){console.error('loadClubData:',e);notify('❌ Помилка клубу',e.message);}
}

function formatNum(n){
  if(n>=1000000)return (n/1000000).toFixed(2)+'m';
  if(n>=1000)return (n/1000).toFixed(1)+'k';
  return String(n);
}

window.joinClub=async function(clubId){
  if(P.clubId){notify('✅ Вже в клубі','Спочатку вийди з поточного!');return;}
  if((P.level||1)<2){notify('⬆️ Низький рівень','Потрібно 2 рівень!');return;}
  try{
    const snap=await getDoc(doc(db,'clubs',clubId));
    if(!snap.exists()){notify('❌ Помилка','Клуб не знайдено!');return;}
    const cname=snap.data().name||'Клуб';
    await setDoc(doc(db,'clubs',clubId,'members',uid),{
      uid:String(uid),
      nickname:String(P.nickname||'?'),
      catname:String(P.catname||'Тваринка'),
      role:'member',points:0,
      joinedAt:new Date().toISOString(),
    });
    await updateDoc(doc(db,'clubs',clubId),{memberCount:increment(1)});
    P.clubId=clubId;P.clubDays=0;
    if(!P.tasks)initTasks();
    if(P.tasks&&P.tasks.progress)
      P.tasks.progress.clubJoined=(P.tasks.progress.clubJoined||0)+1;
    await saveP();
    const banner=$('club-join-banner');
    if(banner){banner.style.display='block';setTimeout(()=>banner.style.display='none',4000);}
    notify('🎈 Ласкаво просимо!','Ти вступив до клубу '+cname+'!');
    addLog('Вступив до клубу "'+cname+'"! 🎈');
    renderClubs();
    setTimeout(()=>loadClubData(),600);
  }catch(e){notify('❌ Помилка',String(e.message||e).slice(0,80));}
};

window.createClub=async function(){
  const nameEl=$('new-club-name');
  const descEl=$('new-club-desc');
  const iconEl=$('new-club-icon');
  const name=(nameEl?.value||'').trim();
  const desc=(descEl?.value||'').trim();
  const iconSel=(iconEl?.value)||'🐱';
  if(!name||name.length<3){notify('📝 Введи назву','Мінімум 3 символи!');return;}
  if(P.clubId){notify('✅ Вже в клубі','Спочатку вийди з поточного!');return;}
  if((P.coins||0)<50){notify('🪙 Мало монет','Потрібно 🪙50!');return;}
  const btn=document.querySelector('button[onclick="createClub()"]');
  if(btn){btn.disabled=true;btn.textContent='⏳...';}
  try{
    P.coins-=50;
    const clubDoc={
      name:name,
      description:desc||'Наш чудовий клуб!',
      icon:iconSel,
      level:1,xp:0,stars:1,memberCount:1,
      directorUid:String(uid),
      directorName:String(P.nickname||'?'),
      piggyCoins:0,piggyHearts:0,buildingsLevel:1,
      founded:new Date().toLocaleDateString('uk-UA'),
      createdAt:new Date().toISOString(),
    };
    const ref=await addDoc(collection(db,'clubs'),clubDoc);
    const memberDoc={
      uid:String(uid),
      nickname:String(P.nickname||'?'),
      catname:String(P.catname||'Тваринка'),
      role:'director',points:0,
      joinedAt:new Date().toISOString(),
    };
    await setDoc(doc(db,'clubs',ref.id,'members',uid),memberDoc);
    P.clubId=ref.id;
    if(nameEl)nameEl.value='';
    if(descEl)descEl.value='';
    // safe task tracking
    if(!P.tasks)initTasks();
    if(P.tasks&&P.tasks.progress)
      P.tasks.progress.clubJoined=(P.tasks.progress.clubJoined||0)+1;
    saveP();
    notify('🏆 Клуб створено!','"'+name+'" — ти Директор!');
    addLog('Створено клуб "'+name+'"! 🏆');
    renderClubs();
    setTimeout(()=>loadClubData(),600);
  }catch(e){
    P.coins+=50;
    console.error('createClub',e);
    notify('❌ Помилка створення',String(e.message||e).slice(0,80));
  }finally{
    if(btn){btn.disabled=false;btn.textContent='🏆 Створити і стати Директором';}
  }
};

window.donateClub=async function(){
  const amount=parseInt($('donate-amount')?.value||'10')||10;
  if((P.coins||0)<amount){notify('🪙 Мало монет','Потрібно '+amount+' монет!');return;}
  if(!P.clubId){notify('🎈 Немає клубу','Вступи до клубу!');return;}
  P.coins-=amount;
  try{
    await updateDoc(doc(db,'clubs',P.clubId),{piggyCoins:increment(amount),xp:increment(amount)});
    await updateDoc(doc(db,'clubs',P.clubId,'members',uid),{points:increment(amount)});
    addLog('Пожертвував 🪙'+amount+' до копилки клубу!');
    notify('🐷 Копилка!','🪙'+amount+' передано!');
    trackTask('donateCount');
    loadClubData();render();saveP();
  }catch(e){P.coins+=amount;}
};

window.leaveClub=async function(){
  if(!P.clubId||!confirm('Вийти з клубу?'))return;
  try{
    await deleteDoc(doc(db,'clubs',P.clubId,'members',uid));
    await updateDoc(doc(db,'clubs',P.clubId),{memberCount:increment(-1)});
    P.clubId=null;P.clubLoyalty=0;P.clubDays=0;await saveP();
    addLog('Вийшов з клубу');renderClubs();
    notify('👋 Вийшов','Ти вийшов з клубу');
  }catch(e){notify('❌ Помилка',e.message);}
};

window.levelUpClub=async function(){
  if(!P.clubId)return;
  try{
    const snap=await getDoc(doc(db,'clubs',P.clubId));
    if(!snap.exists())return;
    const c=snap.data();
    if(c.directorUid!==uid){notify('❌ Тільки директор','Тільки директор може підвищити рівень!');return;}
    const xpNeeded=(c.level||1)*500;
    if((c.xp||0)<xpNeeded){notify('⭐ Мало XP','Потрібно '+xpNeeded+' XP клубу!');return;}
    await updateDoc(doc(db,'clubs',P.clubId),{level:increment(1),xp:increment(-xpNeeded),stars:Math.min(7,(c.stars||1)+1)});
    notify('🎉 Клуб підвищено!','Рівень '+(( c.level||1)+1)+'!');
    addLog('Клуб підвищено до рівня '+((c.level||1)+1)+'!');
    loadClubData();
  }catch(e){notify('❌ Помилка',e.message);}
};

window.promoteClubMember=async function(memberId,currentRole){
  if(!P.clubId)return;
  const roles=['member','curator','deputy'];
  const idx=roles.indexOf(currentRole);
  if(idx>=roles.length-1){notify('✅ Максимум','Цей учасник вже заступник!');return;}
  const newRole=roles[idx+1];
  try{
    await updateDoc(doc(db,'clubs',P.clubId,'members',memberId),{role:newRole});
    notify('⬆️ Підвищено','Учасник отримав роль: '+newRole);
    loadClubData();
  }catch(e){notify('❌ Помилка',e.message);}
};

window.openCollectionExchange=function(){notify('🔄 Обмін колекціями','Незабаром!');};
window.showClubHistory=function(){notify('📜 Незабаром','Ця функція буде додана!');};
window.openClubSettings=function(){
  const modal=$('club-settings-modal');if(!modal)return;
  modal.style.display='flex';
};
window.closeClubSettings=function(){$('club-settings-modal').style.display='none';};
window.saveClubSettings=async function(){
  if(!P.clubId)return;
  const newDesc=$('club-settings-desc').value.trim();
  const newIcon=$('club-settings-icon').value;
  try{
    await updateDoc(doc(db,'clubs',P.clubId),{description:newDesc,icon:newIcon});
    notify('✅ Збережено','Налаштування клубу оновлено!');
    closeClubSettings();loadClubData();
  }catch(e){notify('❌ Помилка',e.message);}
};

// ── Ratings (FIX #5) ──────────────────────────────────
const medals=['🥇','🥈','🥉'];
window.switchRating=function(type){
  ratingTab=type;
  ['players','clubs','beauty'].forEach(t=>$('rt-'+t)?.classList.toggle('active',t===type));
  loadRatings(type);
};
async function loadRatings(type){
  const rl=$('rating-list');if(!rl)return;
  rl.innerHTML='<div class="loading-inline">Завантаження...</div>';
  try{
    if(type==='players'){
      const snap=await getDocs(collection(db,'players'));
      const allDocs=snap.docs.map(d=>({...d.data(),_id:d.id}));
      // Show ALL documents, even incomplete ones
      const players=allDocs.sort((a,b)=>((b.level||1)*1000+(b.butterflies||0))-((a.level||1)*1000+(a.butterflies||0)));
      rl.innerHTML='<div class="rating-count-info">👥 Гравців у базі: '+players.length+'</div>';
      if(!players.length){
        rl.innerHTML+='<div class="loading-inline">Поки немає гравців</div>';
        return;
      }
      rl.innerHTML+=players.map((p,i)=>{
        const isMe=p._id===uid;
        const av=(PET_TYPES[p.petType]||PET_TYPES.cat).emojis[0];
        const displayName=p.catname||p.nickname||'Тваринка';
        return `<div class="rating-row ${isMe?'rating-row-me':''}" onclick="openPlayerProfile('${p._id}')">
          <span class="rrank ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">${medals[i]||i+1}</span>
          <span class="rav">${av}</span>
          <div style="flex:1">
            <div class="rname">${esc(displayName)}${isMe?' 🌟':''}</div>
            <div class="rsub">@${esc(p.nickname||'?')} · Рів.${p.level||1} · 🦋${p.butterflies||0}</div>
          </div>
          <span class="rscore">⭐${((p.level||1)*1000)+(p.butterflies||0)}</span>
        </div>`;
      }).join('');
    }else if(type==='clubs'){
      const snap=await getDocs(collection(db,'clubs'));
      const clubs=snap.docs.map(d=>({...d.data(),_id:d.id}))
        .sort((a,b)=>((b.level||1)*100+(b.memberCount||1))-((a.level||1)*100+(a.memberCount||1)));
      if(!clubs.length){rl.innerHTML='<div class="loading-inline">Поки немає клубів</div>';return;}
      rl.innerHTML=clubs.map((c,i)=>
        `<div class="rating-row">
          <span class="rrank ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">${medals[i]||i+1}</span>
          <span class="rav">${c.icon||'🎈'}</span>
          <div style="flex:1"><div class="rname">${esc(c.name||'?')}</div>
          <div class="rsub">Рів.${c.level||1} · ${c.memberCount||1} учасн.</div></div>
          <span class="rscore">⭐${((c.level||1)*100)+(c.memberCount||1)}</span>
        </div>`
      ).join('');
    }else{
      const snap=await getDocs(collection(db,'players'));
      const players=snap.docs.map(d=>({...d.data(),_id:d.id}))
        .filter(p=>p.nickname)
        .sort((a,b)=>(b.butterflies||0)-(a.butterflies||0));
      if(!players.length){rl.innerHTML='<div class="loading-inline">Поки немає даних</div>';return;}
      rl.innerHTML=players.map((p,i)=>{
        const isMe=p._id===uid;
        const av=(PET_TYPES[p.petType]||PET_TYPES.cat).emojis[0];
        const displayName=p.catname||p.nickname||'Тваринка';
        return `<div class="rating-row ${isMe?'rating-row-me':''}" onclick="openPlayerProfile('${p._id}')">
          <span class="rrank ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">${medals[i]||i+1}</span>
          <span class="rav">${av}</span>
          <div style="flex:1"><div class="rname">${esc(displayName)}${isMe?' 🌟':''}</div>
          <div class="rsub">@${esc(p.nickname||'?')} · Гламур ${p.glamour||0}</div></div>
          <span class="rscore">🦋${p.butterflies||0}</span>
        </div>`;
      }).join('');
    }
  }catch(e){rl.innerHTML='<div class="loading-inline">Помилка: '+esc(e.message)+'</div>';}
}

// ── Player profile modal ──────────────────────────────
window.openPlayerProfile=async function(playerId){
  viewingPlayerId=playerId;
  const modal=$('player-modal');if(!modal)return;
  const isMe=playerId===uid;
  $('pm-catname').textContent='Завантаження...';
  modal.style.display='flex';
  try{
    const snap=await getDoc(doc(db,'players',playerId));
    if(!snap.exists()){notify('❌ Помилка','Гравець не знайдений!');modal.style.display='none';return;}
    const p=snap.data();
    const av=(PET_TYPES[p.petType]||PET_TYPES.cat).emojis[0];
    $('pm-av').textContent=av;
    $('pm-catname').textContent=p.catname||'Тваринка';
    $('pm-nick').textContent='@'+(p.nickname||'?');
    $('pm-lvl').textContent='Рівень '+(p.level||1)+' · '+((p.level||1)*1000+(p.butterflies||0))+' очок';
    $('pm-stats').innerHTML=`
      <div class="pm-stat-row"><span>⭐ Рівень:</span><b>${p.level||1}</b></div>
      <div class="pm-stat-row"><span>🦋 Краса:</span><b>${p.butterflies||0}</b></div>
      <div class="pm-stat-row"><span>🌸 Гламур:</span><b>${p.glamour||0}</b></div>
      <div class="pm-stat-row"><span>🏆 Перемог:</span><b>${p.showWins||0}</b></div>
      <div class="pm-stat-row"><span>🌳 Монет з прогулянок:</span><b>🪙${p.walkCoins||0}</b></div>
      <div class="pm-stat-row"><span>🎈 Клуб:</span><b>${p.clubId?'Є':'—'}</b></div>
      <div class="pm-stat-row"><span>📅 Днів у грі:</span><b>${Math.floor((Date.now()-new Date(p.createdAt||Date.now()).getTime())/86400000)}</b></div>`;
    if(p.about){$('pm-about-box').style.display='block';$('pm-about').textContent=p.about;}
    else{$('pm-about-box').style.display='none';}
    const achiev=[];
    if((p.level||1)>=5)achiev.push('⭐ Рівень 5+');
    if((p.level||1)>=10)achiev.push('🌟 Рівень 10+');
    if((p.butterflies||0)>=50)achiev.push('🦋 Красуня 50+');
    if((p.showWins||0)>=1)achiev.push('🏆 Переможець виставки');
    if(p.clubId)achiev.push('🎈 Учасник клубу');
    $('pm-achiev').innerHTML=achiev.length
      ?'<div class="pm-achiev-title">🏅 Досягнення</div>'+achiev.map(a=>`<span class="pm-achiev-badge">${a}</span>`).join(''):'';
    const friendBtn=$('pm-add-friend-btn');
    if(isMe){if(friendBtn)friendBtn.style.display='none';}
    else{
      const friends=P.friends||[];const alreadyFriend=friends.includes(playerId);
      if(friendBtn){friendBtn.style.display='block';friendBtn.textContent=alreadyFriend?'✅ Вже в друзях':'👤+ Додати в друзі';friendBtn.disabled=alreadyFriend;}
    }
  }catch(e){notify('❌ Помилка',e.message);modal.style.display='none';}
};
window.closePlayerModal=function(){$('player-modal').style.display='none';viewingPlayerId=null;};
window.addFriend=function(){
  if(!viewingPlayerId||viewingPlayerId===uid)return;
  P.friends=P.friends||[];
  if(P.friends.includes(viewingPlayerId)){notify('✅ Вже в друзях','Цей гравець вже у вашому списку!');return;}
  P.friends.push(viewingPlayerId);saveP();
  notify('👤 Додано!','Гравця додано у друзі!');
  const btn=$('pm-add-friend-btn');if(btn){btn.textContent='✅ Вже в друзях';btn.disabled=true;}
};
window.openMessageTo=function(){
  const nick=($('pm-nick')?.textContent||'').replace('@','');
  closePlayerModal();goPage('mail');
  setTimeout(()=>{showCompose();if($('cm-to'))$('cm-to').value=nick;},150);
};

// ══════════════════════════════════════
// LEAGUES + TOURNAMENT (FIX #2)
// ══════════════════════════════════════
const LEAGUES=[
  {id:'bronze',  name:'Бронзова ліга',  icon:'🥉',minScore:0,   coins:30, xp:20, bf:2},
  {id:'silver',  name:'Срібна ліга',    icon:'🥈',minScore:50,  coins:80, xp:50, bf:5},
  {id:'gold',    name:'Золота ліга',    icon:'🥇',minScore:200, coins:200,xp:120,bf:12},
  {id:'platinum',name:'Платинова ліга', icon:'💎',minScore:500, coins:500,xp:300,bf:30},
  {id:'diamond', name:'Діамантова ліга',icon:'💠',minScore:1000,coins:1200,xp:700,bf:70},
];
function getLeague(){
  const score=(P.level||1)*50+(P.butterflies||0)+(P.showWins||0)*20;
  let lg=LEAGUES[0];
  for(const l of LEAGUES)if(score>=l.minScore)lg=l;
  return lg;
}
function buildShowPage(){
  const emojis=getPetEmojis();
  if($('show-cat-emoji'))$('show-cat-emoji').textContent=emojis[0];
  if($('show-cat-name'))$('show-cat-name').textContent=P.catname||'Тваринка';
  if($('show-beauty'))$('show-beauty').textContent=calcBeauty();
  if($('show-level'))$('show-level').textContent=P.level||1;
  // league badge
  const lg=getLeague();
  const leagueEl=$('show-league');
  if(leagueEl)leagueEl.innerHTML=`
    <div class="league-card">
      <span class="league-icon">${lg.icon}</span>
      <div>
        <div class="league-name">${lg.name}</div>
        <div class="league-prizes">🥇 Приз: 🪙${lg.coins} · ⭐${lg.xp} XP · 🦋+${lg.bf}</div>
      </div>
    </div>`;
  const cats=$('show-categories');if(!cats)return;
  cats.innerHTML=SHOW_CATS.map(sc=>{
    const canEnter=(P.level||1)>=sc.reqLvl;
    const fee=sc.entryFee>0?'Внесок: 🪙'+sc.entryFee:'Безкоштовно!';
    return `<div class="show-category ${sc.special?'show-special':''}">
      <div class="show-cat-title"><span>${sc.icon} ${sc.name}</span>
        <span style="font-size:.68rem;color:var(--tl);font-weight:700">${fee}</span></div>
      <div class="show-prize-row">${sc.prizes.map(p=>`<div class="prize-item">${p}</div>`).join('')}</div>
      <button class="show-enter-btn" ${!canEnter?'disabled':''} onclick="enterShow('${sc.id}')">
        ${canEnter?'Взяти участь 🐾':'Потрібно '+sc.reqLvl+' рів.'}</button>
    </div>`;
  }).join('');
}
window.enterShow=function(catId){
  const sc=SHOW_CATS.find(c=>c.id===catId);if(!sc)return;
  if((P.coins||0)<sc.entryFee){notify('🪙 Мало монет','Потрібно '+sc.entryFee+'!');return;}
  P.coins-=sc.entryFee;
  const lg=getLeague();
  const myScore=calcBeauty()+(Math.random()*15|0);
  // 8 opponents scaled to league level
  const base=lg.minScore*0.8;
  const spread=Math.max(30,lg.minScore*0.6);
  const opponents=[];
  for(let i=0;i<7;i++)
    opponents.push({n:'Суперник '+(i+1),s:Math.max(0,base+Math.random()*spread|0)});
  opponents.push({n:P.catname||'Ти',s:myScore,me:true});
  opponents.sort((a,b)=>b.s-a.s);
  const place=opponents.findIndex(o=>o.me)+1;
  const mul=place===1?2:place===2?1.5:place===3?1:0.25;
  const earnCoins=Math.floor(lg.coins*mul+(parseInt(sc.prizes[0].replace(/\D/g,''))||30)*mul);
  const earnBf=place<=3?Math.floor(lg.bf*mul):0;
  const earnXp=Math.floor(lg.xp*(place<=4?mul:0.15));
  P.coins=(P.coins||0)+earnCoins;
  P.butterflies=(P.butterflies||0)+earnBf;
  gainXP(earnXp);
  if(place<=3){P.showWins=(P.showWins||0)+1;wiggle();}
  const placeStr=place===1?'🥇 1-е':place===2?'🥈 2-е':place===3?'🥉 3-є':place+'-е';
  notify(place<=3?'🏆 '+placeStr+' місце!':'📊 '+placeStr+' місце',
    '+🪙'+earnCoins+(earnBf?' · +🦋'+earnBf:'')+(earnXp?' · +⭐'+earnXp:''),3500);
  addLog(P.catname+' — '+placeStr+' місце у "'+sc.name+'" ('+lg.icon+' '+lg.name+')');
  const lb=$('show-leaderboard');
  if(lb){
    const m=['🥇','🥈','🥉'];
    const emojis=getPetEmojis();
    lb.innerHTML='<div class="tournament-header">'+lg.icon+' '+lg.name+' · Результати</div>'
      +opponents.map((o,i)=>`<div class="show-contestant ${o.me?'show-contestant-me':''}">
        <span class="show-rank">${m[i]||i+1}</span>
        <span style="font-size:1.1rem">${o.me?emojis[0]:'🐾'}</span>
        <span style="flex:1;font-weight:${o.me?900:700};color:${o.me?'var(--gdk)':'var(--tx)'};font-size:.78rem">${esc(o.n)}</span>
        <span style="font-weight:900;font-size:.78rem">🦋${o.s}</span>
      </div>`).join('');
  }
  if(!P.tasks)initTasks();
  if(P.tasks&&P.tasks.progress)
    P.tasks.progress.showCount=(P.tasks.progress.showCount||0)+1;
  trackTask('showCount',0);
  render();saveP();
};

// ══════════════════════════════════════
// FRIENDS (FIX #5)
// ══════════════════════════════════════
async function renderFriendsPage(){
  const list=document.getElementById('friends-list');
  if(!list)return;
  const friends=P.friends||[];
  if(!friends.length){
    list.innerHTML='<div class="loading-inline">Немає друзів. Додай у Рейтингу!</div>';
    return;
  }
  list.innerHTML='<div class="loading-inline">Завантаження...</div>';
  try{
    const rows=await Promise.all(friends.map(async function(fid){
      try{
        const snap=await getDoc(doc(db,'players',fid));
        if(!snap.exists())return null;
        const p=snap.data();
        const av=(PET_TYPES[p.petType]||PET_TYPES.cat).emojis[0];
        const div=document.createElement('div');
        div.className='friend-row';
        div.dataset.pid=fid;
        div.innerHTML=
          '<span class="friend-av">'+av+'</span>'+
          '<div style="flex:1">'+
            '<div class="friend-name">'+esc(p.catname||p.nickname||'Тваринка')+'</div>'+
            '<div class="friend-sub">@'+esc(p.nickname||'?')+' Рів.'+(p.level||1)+'</div>'+
          '</div>'+
          '<button class="small-btn friend-remove-btn" data-fid="'+fid+'">✕</button>';
        div.addEventListener('click',function(e){
          if(!e.target.classList.contains('friend-remove-btn'))
            openPlayerProfile(fid);
        });
        div.querySelector('.friend-remove-btn').addEventListener('click',function(e){
          e.stopPropagation();removeFriend(fid);
        });
        return div.outerHTML;
      }catch(e){return null;}
    }));
    const html=rows.filter(Boolean).join('');
    list.innerHTML=html||'<div class="loading-inline">Не знайдено</div>';
  }catch(e){
    list.innerHTML='<div class="loading-inline">Помилка</div>';
  }
}
window.removeFriend=function(fid){
  P.friends=(P.friends||[]).filter(function(id){return id!==fid;});
  saveP();renderFriendsPage();
  notify('Видалено','Гравця видалено з друзів');
};
window.searchPlayer=async function(){
  const inp=document.getElementById('friend-search-inp');
  const nick=inp?inp.value.trim():'';
  const res=document.getElementById('friend-search-result');
  if(!res)return;
  if(!nick){res.innerHTML='';return;}
  res.innerHTML='<div class="loading-inline">Пошук...</div>';
  try{
    const snap=await getDocs(query(collection(db,'players'),where('nickname','==',nick),limit(3)));
    if(snap.empty){res.innerHTML='<div class="loading-inline">Не знайдено</div>';return;}
    const frag=document.createDocumentFragment();
    snap.docs.forEach(function(d){
      const p=d.data();
      const av=(PET_TYPES[p.petType]||PET_TYPES.cat).emojis[0];
      const already=(P.friends||[]).includes(d.id);
      const isMe=d.id===uid;
      const row=document.createElement('div');
      row.className='friend-row';
      let actionHtml;
      if(isMe) actionHtml='<span style="font-size:.7rem;color:var(--tl)">Це ти</span>';
      else if(already) actionHtml='<span style="font-size:.7rem;color:var(--gn)">V В друзях</span>';
      else actionHtml='<button class="green-btn add-friend-btn" data-fid="'+d.id+'" style="padding:6px 10px;font-size:.72rem">+Додати</button>';
      row.innerHTML=
        '<span class="friend-av">'+av+'</span>'+
        '<div style="flex:1">'+
          '<div class="friend-name">'+esc(p.catname||p.nickname||'?')+'</div>'+
          '<div class="friend-sub">@'+esc(p.nickname||'?')+' Рів.'+(p.level||1)+'</div>'+
        '</div>'+actionHtml;
      const btn=row.querySelector('.add-friend-btn');
      if(btn) btn.addEventListener('click',function(){addFriendById(d.id);});
      frag.appendChild(row);
    });
    res.innerHTML='';
    res.appendChild(frag);
  }catch(e){res.innerHTML='<div class="loading-inline">Помилка</div>';}
};
window.addFriendById=function(fid){
  if(!fid||fid===uid)return;
  P.friends=P.friends||[];
  if(!P.friends.includes(fid))P.friends.push(fid);
  saveP();notify('Додано!','Гравця додано у друзі!');
  renderFriendsPage();
  const r=document.getElementById('friend-search-result');if(r)r.innerHTML='';
  const i=document.getElementById('friend-search-inp');if(i)i.value='';
};



// ── Mail ──────────────────────────────────────────────
window.switchMail=function(tab){
  mailTab=tab;['inbox','sent','system'].forEach(t=>$('mt-'+t)?.classList.toggle('active',t===tab));renderMail();
};
function renderMail(){
  const mi=$('mail-items');if(!mi)return;
  let items=mailTab==='inbox'?(P.inbox||[]).filter(m=>m.type!=='system'):
    mailTab==='sent'?(P.sent||[]):(P.inbox||[]).filter(m=>m.type==='system');
  items=[...items].reverse();
  if(!items.length){mi.innerHTML='<div class="loading-inline">Немає повідомлень</div>';return;}
  mi.innerHTML=items.map(m=>
    `<div class="mail-item ${m.read?'':'unread'}" onclick="openMail(${m.id},'${mailTab}')">
      <div style="display:flex;align-items:flex-start;gap:8px">
        ${!m.read?'<div class="mail-unread-dot"></div>':'<div style="width:8px"></div>'}
        <div style="flex:1"><div class="mail-from">${esc(mailTab==='sent'?'→ '+(m.to||'?'):(m.from||'?'))}</div>
        <div class="mail-subj">${esc(m.subj||'')}</div>
        <div class="mail-preview">${esc((m.body||'').slice(0,55))}...</div></div>
      </div><div class="mail-time">${m.time||''}</div></div>`
  ).join('');updateMailBadge();
}
window.openMail=function(id,tab){
  let msg=tab==='sent'?(P.sent||[]).find(m=>m.id===id):(P.inbox||[]).find(m=>m.id===id);
  if(!msg)return;msg.read=true;currentMailId=id;
  $('mail-list-view').style.display='none';
  const md=$('mail-detail');md.style.display='flex';md.style.flexDirection='column';md.style.gap='9px';
  $('md-from').textContent=tab==='sent'?'→ '+(msg.to||'?'):(msg.from||'?');
  $('md-time').textContent=msg.time||'';$('md-subj').textContent=msg.subj||'';$('md-body').textContent=msg.body||'';
  $('compose-view').style.display='none';saveP();updateMailBadge();
};
window.closeMailDetail=function(){$('mail-detail').style.display='none';$('mail-list-view').style.display='block';renderMail();};
window.replyTo=function(){
  const msg=(P.inbox||[]).find(m=>m.id===currentMailId);if(!msg)return;
  closeMailDetail();showCompose();
  $('cm-to').value=(msg.from||'').replace(' 🐾','').replace(' 🐱','');
  $('cm-subj').value='Re: '+(msg.subj||'');
};
window.showCompose=function(){
  $('mail-list-view').style.display='none';$('mail-detail').style.display='none';
  const cv=$('compose-view');cv.style.display='flex';cv.style.flexDirection='column';cv.style.gap='9px';
};
window.closeCompose=function(){$('compose-view').style.display='none';$('mail-list-view').style.display='block';};
window.sendMail=async function(){
  const to=$('cm-to').value.trim(),subj=$('cm-subj').value.trim(),body=$('cm-body').value.trim();
  if(!to||!subj||!body){notify('📬 Помилка','Заповни всі поля!');return;}
  const msgObj={id:Date.now(),to,subj,body,time:now(),read:true};
  P.sent=P.sent||[];P.sent.push(msgObj);
  try{
    const snap=await getDocs(query(collection(db,'players'),where('nickname','==',to),limit(1)));
    if(!snap.empty){
      const rId=snap.docs[0].id;const rData=snap.docs[0].data();
      const rInbox=[...(rData.inbox||[]),{id:Date.now()+1,from:P.nickname,subj,body,time:now(),read:false,type:'player'}];
      await updateDoc(doc(db,'players',rId),{inbox:rInbox});
      notify('📤 Надіслано!','Повідомлення для '+to+' відправлено!');
    }else notify('📤 Збережено','Гравець '+to+' не знайдений');
  }catch(e){}
  $('cm-to').value='';$('cm-subj').value='';$('cm-body').value='';
  addLog('Надіслано повідомлення гравцю '+to);closeCompose();saveP();renderMail();
};

// ── Gifts ─────────────────────────────────────────────
const GIFT_CATALOG = [
  {id:'rose',icon:'🌹',name:'Троянда',cost:5},
  {id:'fish_gift',icon:'🐟',name:'Рибка',cost:8},
  {id:'cake_gift',icon:'🎂',name:'Тортик',cost:15},
  {id:'gem_gift',icon:'💎',name:'Сапфір',cost:30},
  {id:'heart',icon:'❤️',name:'Сердечко ×10',cost:20},
  {id:'crown',icon:'👑',name:'Корона',cost:100},
];
window.openGifts=function(){
  const sec=$('gifts-received-section');
  if(sec){
    const gifts=P.gifts||[];
    sec.innerHTML=gifts.length
      ?'<div class="sec-title">Отримані подарунки</div>'+
        gifts.map(g=>`<div class="gift-item"><span style="font-size:2rem">${g.icon}</span>
          <div><div style="font-size:.78rem;font-weight:800;color:var(--gdk)">Від: ${esc(g.from)}</div>
          <div style="font-size:.7rem;color:var(--tl)">${g.name} · ${g.time}</div></div></div>`).join('')
      :'<div class="loading-inline">Немає подарунків</div>';
  }
  const gp=$('gift-picker');
  if(gp){gp.innerHTML=GIFT_CATALOG.map(g=>`<div class="gift-opt" id="gopt-${g.id}" onclick="selectGift('${g.id}')">
    <span class="go-icon">${g.icon}</span><span class="go-name">${g.name}</span>
    <span class="go-cost">🪙${g.cost}</span></div>`).join('');}
  selectedGift=null;$('gifts-modal').style.display='flex';
};
window.closeGifts=function(){$('gifts-modal').style.display='none';};
window.selectGift=function(id){
  selectedGift=id;document.querySelectorAll('.gift-opt').forEach(el=>el.classList.remove('selected'));
  $('gopt-'+id)?.classList.add('selected');
};
window.sendGift=async function(){
  const to=$('gift-to').value.trim();
  if(!to){notify('❌ Помилка','Вкажи нікнейм!');return;}
  if(!selectedGift){notify('❌ Помилка','Вибери подарунок!');return;}
  const gift=GIFT_CATALOG.find(g=>g.id===selectedGift);if(!gift)return;
  if((P.coins||0)<gift.cost){notify('🪙 Мало монет','Потрібно '+gift.cost+' монет!');return;}
  P.coins-=gift.cost;
  try{
    const snap=await getDocs(query(collection(db,'players'),where('nickname','==',to),limit(1)));
    if(!snap.empty){
      const rId=snap.docs[0].id;const rData=snap.docs[0].data();
      const newGift={icon:gift.icon,name:gift.name,from:P.nickname,time:now()};
      await updateDoc(doc(db,'players',rId),{gifts:[...(rData.gifts||[]),newGift]});
      notify('🎁 Надіслано!',gift.name+' для '+to+'!');
      addLog('Надіслав '+gift.icon+' '+gift.name+' гравцю '+to);
    }else notify('❌ Не знайдено','Гравець '+to+' не знайдений');
  }catch(e){notify('❌ Помилка',e.message);}
  $('gift-to').value='';selectedGift=null;closeGifts();render();saveP();
};

// ── Chat (FIX #7) — persistent Firestore messages ─────
// ── CHAT: persistent realtime, never loses old messages ──
function startChat(){
  const box=$('chat-msgs');
  if(!box)return;
  if(chatUnsub){chatUnsub();chatUnsub=null;}
  box.innerHTML='<div class="loading-inline">Завантаження...</div>';
  // Use desc+limit to get newest 80, then reverse for display
  const q=query(collection(db,'chat'),orderBy('ts','desc'),limit(80));
  let loaded=false;
  chatUnsub=onSnapshot(q,
    snap=>{
      if(!loaded){
        loaded=true;
        box.innerHTML='';
        // docs are newest-first, reverse to show oldest-first
        const docs=[...snap.docs].reverse();
        docs.forEach(d=>{
          const m=d.data();
          _addChatBubble(d.id,m.nickname,m.catname,m.text,m.uid===uid,m.ts);
        });
        box.scrollTop=box.scrollHeight;
      }else{
        snap.docChanges().forEach(ch=>{
          if(ch.type==='added'){
            const m=ch.doc.data();
            // only append if not already in DOM
            if(!document.getElementById('cmsg-'+ch.doc.id)){
              _addChatBubble(ch.doc.id,m.nickname,m.catname,m.text,m.uid===uid,m.ts);
              box.scrollTop=box.scrollHeight;
            }
          }
        });
      }
    },
    err=>{
      console.warn('chat snapshot error:',err.code,err.message);
      if(!loaded)
        box.innerHTML='<div class="loading-inline">Помилка: '+esc(err.message)+'</div>';
    }
  );
}

function _addChatBubble(docId,nickname,catname,text,isMine,ts){
  const box=$('chat-msgs');
  if(!box)return;
  const div=document.createElement('div');
  div.className='msg '+(isMine?'mine':'theirs');
  if(docId)div.id='cmsg-'+docId;
  let timeStr='';
  try{timeStr=ts&&ts.toDate?ts.toDate().toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'}):now();}
  catch(e){timeStr=now();}
  const senderLine=(catname?esc(catname)+' ':'')+
    '<span style="font-size:.62rem;opacity:.75">@'+esc(nickname||'?')+'</span>';
  div.innerHTML=
    '<div class="msg-sender'+(isMine?' msg-sender-mine':'')+'">'+senderLine+'</div>'+
    '<div class="msg-bubble">'+esc(text||'')+'</div>'+
    '<div class="msg-meta">'+timeStr+'</div>';
  box.appendChild(div);
}

window.sendChat=async function(){
  const inp=$('chat-in');
  if(!inp)return;
  const text=inp.value.trim();
  if(!text||text.length>300)return;
  inp.value='';
  try{
    await addDoc(collection(db,'chat'),{
      uid:String(uid),
      nickname:String(P.nickname||'?'),
      catname:String(P.catname||'Тваринка'),
      text:text,
      ts:serverTimestamp(),
    });
    // task tracking safely
    if(P&&P.tasks&&P.tasks.progress){
      P.tasks.progress.chatCount=(P.tasks.progress.chatCount||0)+1;
      P.tasks.progress.chatCountTotal=(P.tasks.progress.chatCountTotal||0)+1;
      trackTask('chatCount',0);
    }
  }catch(e){
    console.error('sendChat error:',e.code,e.message);
    inp.value=text;
    notify('❌ Помилка чату',String(e.message||e).slice(0,60));
  }
};

// ══════════════════════════════════════
// FIX #3: TASKS — fixed daily/weekly logic, removed pet task
// ══════════════════════════════════════
const TASKS_DEF = [
  // Daily — reset each calendar day
  { id:'daily_feed',  cat:'daily', icon:'🍖', title:'Нагодуй тваринку',    desc:'Погодуй 3 рази',              goal:3, reward:{coins:20,xp:15},  track:'feedCount' },
  { id:'daily_water', cat:'daily', icon:'💧', title:'Напій тваринку',      desc:'Напій 3 рази',                goal:3, reward:{coins:15,xp:10},  track:'waterCount' },
  { id:'daily_play',  cat:'daily', icon:'🎾', title:'Пограй з тваринкою',  desc:'Пограй 2 рази',               goal:2, reward:{coins:25,xp:20},  track:'playCount' },
  { id:'daily_walk',  cat:'daily', icon:'🌳', title:'Прогулянка дня',      desc:'Відправ на прогулянку',       goal:1, reward:{coins:50,xp:30},  track:'walkDone' },
  { id:'daily_chat',  cat:'daily', icon:'💬', title:'Спілкування',         desc:'Напиши 3 повідомлення в чат', goal:3, reward:{coins:15,xp:10},  track:'chatCount' },
  { id:'daily_gems',  cat:'daily', icon:'💎', title:'Збирач скарбів',      desc:'Збери 3 частини каменів',     goal:3, reward:{coins:20,xp:15},  track:'gemsCollected' },
  // Weekly — reset each Monday
  { id:'week_show',   cat:'weekly', icon:'🏆', title:'Учасник виставки',   desc:'Візьми участь у 3 виставках', goal:3, reward:{coins:200,xp:100,hearts:50}, track:'showCount' },
  { id:'week_train',  cat:'weekly', icon:'🏋️',title:'Тренування тижня',   desc:'Тренуй навик 5 разів',        goal:5, reward:{coins:150,xp:80,hearts:30},  track:'trainCount' },
  { id:'week_walk5',  cat:'weekly', icon:'🌲', title:'Мандрівник тижня',   desc:'Зроби 5 прогулянок',          goal:5, reward:{coins:300,xp:150},            track:'walkTotal' },
  { id:'week_donate', cat:'weekly', icon:'🐷', title:'Щедрість',           desc:'Поповни копилку клубу 3 рази',goal:3, reward:{coins:100,xp:50,hearts:100},  track:'donateCount' },
  // Achievements — permanent, claim once
  { id:'ach_level5',  cat:'achiev', icon:'⬆️', title:'Рівень 5',           desc:'Досягни 5 рівня',             goal:5,  reward:{coins:500,hearts:200},  track:'level', once:true },
  { id:'ach_level10', cat:'achiev', icon:'🌟', title:'Рівень 10',          desc:'Досягни 10 рівня',            goal:10, reward:{coins:2000,hearts:500}, track:'level', once:true },
  { id:'ach_beauty50',cat:'achiev', icon:'🦋', title:'Красуня',            desc:'Набери 50 одиниць краси',     goal:50, reward:{coins:500,xp:200},      track:'butterflies', once:true },
  { id:'ach_walks10', cat:'achiev', icon:'🥾', title:'Мандрівник',         desc:'Зроби 10 прогулянок',         goal:10, reward:{coins:300,xp:100},      track:'walkTotal', once:true },
  { id:'ach_club',    cat:'achiev', icon:'🎈', title:'Учасник клубу',      desc:'Вступи до клубу',             goal:1,  reward:{coins:200,hearts:50},   track:'clubJoined', once:true },
  { id:'ach_gems5',   cat:'achiev', icon:'💎', title:'Збирач скарбів',     desc:'Збери 5 повних каменів',      goal:5,  reward:{coins:400,xp:150},      track:'gemsAssembled', once:true },
  { id:'ach_house3',  cat:'achiev', icon:'🏠', title:'Хороший дім',        desc:'Покращи будинок до ⭐3',       goal:3,  reward:{coins:600,xp:200},      track:'houseStar', once:true },
  { id:'ach_chat50',  cat:'achiev', icon:'💬', title:'Балакучий',          desc:'Надішли 50 повідомлень в чат',goal:50, reward:{coins:300,xp:100},      track:'chatCountTotal', once:true },
];

function initTasks(){
  if(!P.tasks){
    P.tasks={
      progress:{},
      completed:{},
      claimed:{},
      lastDailyReset:new Date().toDateString(),
      lastWeeklyReset:getMondayKey(),
    };
  }
  // Reset daily: only if a new calendar day
  const today=new Date().toDateString();
  if(P.tasks.lastDailyReset!==today){
    TASKS_DEF.filter(t=>t.cat==='daily').forEach(t=>{delete P.tasks.completed[t.id];});
    // Reset only daily counters
    const dc=['feedCount','waterCount','playCount','walkDone','chatCount','gemsCollected'];
    dc.forEach(k=>{P.tasks.progress[k]=0;});
    P.tasks.lastDailyReset=today;
    saveP();
  }
  // Reset weekly: only if a new Monday
  const wk=getMondayKey();
  if(P.tasks.lastWeeklyReset!==wk){
    TASKS_DEF.filter(t=>t.cat==='weekly').forEach(t=>{delete P.tasks.completed[t.id];});
    const wc=['showCount','trainCount','walkTotal','donateCount'];
    wc.forEach(k=>{P.tasks.progress[k]=0;});
    P.tasks.lastWeeklyReset=wk;
    saveP();
  }
}

function getMondayKey(){
  const d=new Date();
  const day=d.getDay();// 0=Sun,1=Mon,...
  const diff=d.getDate()-day+(day===0?-6:1);// adjust to Monday
  const mon=new Date(d.setDate(diff));
  return mon.toDateString();
}

function trackTask(key,amount=1){
  if(!P||!P.tasks)return;
  P.tasks.progress[key]=(P.tasks.progress[key]||0)+amount;
  // Track total chat separately for achievement
  if(key==='chatCount'){P.tasks.progress.chatCountTotal=(P.tasks.progress.chatCountTotal||0)+amount;}
  // Check completions
  TASKS_DEF.forEach(t=>{
    if(t.track!==key)return;
    if(P.tasks.completed[t.id]||P.tasks.claimed[t.id])return;
    const val=getProgressVal(t);
    if(val>=t.goal){
      P.tasks.completed[t.id]=true;
      notify('✅ Завдання виконано!',t.icon+' '+t.title+' — забери нагороду!',4000);
    }
  });
}

function getProgressVal(t){
  switch(t.track){
    case'level':return P.level||1;
    case'houseStar':return getHouseStar();
    case'butterflies':return P.butterflies||0;
    case'chatCountTotal':return P.tasks?.progress?.chatCountTotal||0;
    default:return P.tasks?.progress?.[t.track]||0;
  }
}

window.claimTask=function(taskId){
  if(!P.tasks)initTasks();
  const t=TASKS_DEF.find(x=>x.id===taskId);if(!t)return;
  const done=!!P.tasks.completed[taskId]||(getProgressVal(t)>=t.goal);
  if(!done){notify('❌ Не виконано','Спочатку виконай завдання!');return;}
  if(t.once&&P.tasks.claimed[taskId]){notify('✅ Вже отримано','Нагороду вже забрано!');return;}
  if(t.reward.coins)P.coins=(P.coins||0)+t.reward.coins;
  if(t.reward.hearts)P.hearts=cl((P.hearts||0)+t.reward.hearts,0,999999);
  if(t.reward.xp&&t.reward.xp>0)gainXP(t.reward.xp);
  const rewardStr=Object.entries(t.reward).filter(([k,v])=>v>0)
    .map(([k,v])=>({coins:'🪙'+v,xp:'⭐'+v,hearts:'❤️'+v})[k]).join(' · ');
  notify('🎁 Нагорода!',t.icon+' '+t.title+' · '+rewardStr,4000);
  addLog('Завдання "'+t.title+'" виконано! Нагорода: '+rewardStr);
  if(t.once){
    P.tasks.claimed[taskId]=true;
  }else{
    // Reset progress counter for repeatable tasks so it doesn't immediately re-trigger
    if(t.track&&P.tasks.progress)
      P.tasks.progress[t.track]=0;
  }
  P.tasks.completed[taskId]=false;
  renderTasks();render();saveP();
};

let tasksFilter='daily';
window.switchTasksTab=function(tab){
  tasksFilter=tab;
  document.querySelectorAll('.tasks-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  renderTasks();
};
function renderTasks(){
  if(!P.tasks)initTasks();
  const list=$('tasks-list');if(!list)return;
  const tasks=TASKS_DEF.filter(t=>t.cat===tasksFilter);
  // Show reset info
  const resetInfo=$('tasks-reset-info');
  if(resetInfo){
    if(tasksFilter==='daily')resetInfo.textContent='🔄 Оновлюється щодня опівночі';
    else if(tasksFilter==='weekly')resetInfo.textContent='🔄 Оновлюється щопонеділка';
    else resetInfo.textContent='🏅 Постійні досягнення';
  }
  list.innerHTML=tasks.map(t=>{
    const prog=getProgressVal(t);
    const pct=Math.min(100,Math.round(prog/t.goal*100));
    // done = explicitly flagged by trackTask, NOT raw progress (prevents re-triggering)
    const done=!!P.tasks.completed[t.id];
    const claimed=t.once&&!!P.tasks.claimed[t.id];
    const rewardStr=Object.entries(t.reward).filter(([k,v])=>v>0)
      .map(([k,v])=>({coins:'🪙'+v,xp:'⭐'+v,hearts:'❤️'+v})[k]).join(' ');
    return `<div class="task-card ${done&&!claimed?'task-done':''} ${claimed?'task-claimed':''}">
      <div class="task-header">
        <span class="task-icon">${t.icon}</span>
        <div class="task-info">
          <div class="task-title">${t.title}</div>
          <div class="task-desc">${t.desc}</div>
        </div>
        <div class="task-reward">${rewardStr}</div>
      </div>
      <div class="task-progress-row">
        <div class="task-bar-wrap"><div class="task-bar" style="width:${pct}%"></div></div>
        <span class="task-count">${Math.min(prog,t.goal)}/${t.goal}</span>
      </div>
      ${done&&!claimed
        ?`<button class="task-claim-btn" onclick="claimTask('${t.id}')">🎁 Забрати нагороду</button>`
        :claimed
          ?`<div class="task-claimed-lbl">✅ Отримано</div>`
          :`<div class="task-progress-lbl">${pct}% виконано</div>`
      }
    </div>`;
  }).join('');
  const total=tasks.length;
  const doneCount=tasks.filter(t=>(t.once?P.tasks.claimed[t.id]:false)||(P.tasks.completed[t.id])||(getProgressVal(t)>=t.goal)).length;
  const el=$('tasks-summary');
  if(el)el.textContent=doneCount+'/'+total+' завдань';
}

// ── Bind auth buttons after module loads ─────────────
// Process any queued click that happened before module loaded
if(window._authQueue === 'login'){
  window._authQueue = null;
  window.doAuth();
}

(function bindAuthButtons(){
  const bindBtn = (id, fn) => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('click', fn);
  };
  bindBtn('auth-btn',      ()=>window.doAuth&&window.doAuth());
  bindBtn('auth-google-btn',()=>window.doGoogleAuth&&window.doGoogleAuth());
  bindBtn('tab-login',     ()=>window.switchTab&&window.switchTab('login'));
  bindBtn('tab-reg',       ()=>window.switchTab&&window.switchTab('reg'));
  // Also bind Enter key on password field
  const passEl = document.getElementById('a-pass');
  if(passEl) passEl.addEventListener('keydown', e=>{ if(e.key==='Enter') window.doAuth&&window.doAuth(); });
  const emailEl = document.getElementById('a-email');
  if(emailEl) emailEl.addEventListener('keydown', e=>{ if(e.key==='Enter') window.doAuth&&window.doAuth(); });
})();
