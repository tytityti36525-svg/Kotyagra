// КотяГра app.js — v3 (all 12 fixes)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection,
  query, orderBy, limit, onSnapshot, addDoc, getDocs,
  serverTimestamp, where, increment, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const FB = {
  apiKey:"AIzaSyCCVlCIXLQ_GMBPMR8A5-8myzkuolm-BCs",
  authDomain:"kotyagra-d737c.firebaseapp.com",
  projectId:"kotyagra-d737c",
  storageBucket:"kotyagra-d737c.firebasestorage.app",
  messagingSenderId:"674427128723",
  appId:"1:674427128723:web:a4ee00e479a0b284fb3666"
};
const app  = initializeApp(FB);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── FIX #10: XP table — easy early, harder later ──────
const XP_TABLE = [0,50,120,220,360,550,800,1100,1500,2000,2700,3500,4500,5700,7200,9000,11200,13800,16900,20500];
const xpCap = lv => XP_TABLE[Math.min(lv, XP_TABLE.length-1)] || lv*200;

// ── FIX #11: Clothing classes by level ────────────────
const CLOTHES_CATALOG = [
  // Рівень 1+
  {id:'shirt1',slot:'shirt',icon:'👕',name:'Проста сорочка',beauty:2,lvlReq:1,cost:20,rarity:'common'},
  {id:'collar1',slot:'collar',icon:'🔵',name:'Синій нашийник',beauty:2,lvlReq:1,cost:15,rarity:'common'},
  {id:'hat1',slot:'hat',icon:'🎩',name:'Циліндр',beauty:3,lvlReq:1,cost:25,rarity:'common'},
  {id:'ring1',slot:'ring',icon:'💍',name:'Срібне кільце',beauty:2,lvlReq:1,cost:20,rarity:'common'},
  {id:'toy1',slot:'toy',icon:'🎾',name:'М\'ячик',beauty:1,lvlReq:1,cost:10,rarity:'common'},
  // Рівень 3+
  {id:'shirt2',slot:'shirt',icon:'👔',name:'Парадна сорочка',beauty:5,lvlReq:3,cost:60,rarity:'uncommon'},
  {id:'collar2',slot:'collar',icon:'🟡',name:'Золотий нашийник',beauty:6,lvlReq:3,cost:80,rarity:'uncommon'},
  {id:'hat2',slot:'hat',icon:'🪖',name:'Шолом лицаря',beauty:5,lvlReq:3,cost:70,rarity:'uncommon'},
  {id:'toy2',slot:'toy',icon:'🧸',name:'Плюшевий ведмедик',beauty:4,lvlReq:3,cost:50,rarity:'uncommon'},
  // Рівень 5+
  {id:'shirt3',slot:'shirt',icon:'🥻',name:'Шовкове вбрання',beauty:10,lvlReq:5,cost:150,rarity:'rare'},
  {id:'collar3',slot:'collar',icon:'💎',name:'Діамантовий нашийник',beauty:12,lvlReq:5,cost:200,rarity:'rare'},
  {id:'ring2',slot:'ring',icon:'💎',name:'Золоте кільце з рубіном',beauty:10,lvlReq:5,cost:180,rarity:'rare'},
  {id:'medal1',slot:'medal',icon:'🥇',name:'Золота медаль',beauty:15,lvlReq:5,cost:250,rarity:'rare'},
  // Рівень 8+
  {id:'shirt4',slot:'shirt',icon:'🥋',name:'Королівський мантій',beauty:20,lvlReq:8,cost:400,rarity:'epic'},
  {id:'hat3',slot:'hat',icon:'👑',name:'Золота корона',beauty:25,lvlReq:8,cost:500,rarity:'epic'},
  {id:'medal2',slot:'medal',icon:'🏆',name:'Кубок чемпіона',beauty:30,lvlReq:8,cost:600,rarity:'epic'},
  // Рівень 12+
  {id:'shirt5',slot:'shirt',icon:'✨',name:'Зоряна мантія',beauty:40,lvlReq:12,cost:1000,rarity:'legendary'},
  {id:'collar4',slot:'collar',icon:'🌟',name:'Зоряний нашийник',beauty:35,lvlReq:12,cost:900,rarity:'legendary'},
];
const RARITY_COLOR = {common:'#aaa',uncommon:'var(--green)',rare:'var(--blue)',epic:'var(--purple)',legendary:'#f5c842'};
const RARITY_LABEL = {common:'Звичайний',uncommon:'Незвичайний',rare:'Рідкісний',epic:'Епічний',legendary:'Легендарний'};

// ── FIX #12: House levels ──────────────────────────────
const HOUSES = [
  {lvl:1,emoji:'🏠',name:'Проста хатинка',beauty:0,cost:100},
  {lvl:2,emoji:'🏡',name:'Затишний будиночок',beauty:5,cost:200},
  {lvl:3,emoji:'🏘️',name:'Гарний дім',beauty:12,cost:400},
  {lvl:4,emoji:'🏗️',name:'Двоповерховий дім',beauty:20,cost:700},
  {lvl:5,emoji:'🏰',name:'Міні-замок',beauty:35,cost:1200},
  {lvl:6,emoji:'🏯',name:'Середньовічний замок',beauty:55,cost:2000},
  {lvl:7,emoji:'🗼',name:'Вежа з кришталю',beauty:80,cost:3500},
  {lvl:8,emoji:'🌟',name:'Палац зірок',beauty:120,cost:6000},
  {lvl:9,emoji:'🏛️',name:'Олімпійський палац',beauty:180,cost:10000},
  {lvl:10,emoji:'🌌',name:'Космічна фортеця',beauty:999,cost:Infinity},
];

// ── GEMS ──────────────────────────────────────────────
const GEMS_CFG = [
  {key:'sapphire',icon:'💎',name:'Сапфір',bonus:'+🦋1',cost:3},
  {key:'amethyst',icon:'💜',name:'Аметист',bonus:'+⭐10 XP',cost:3},
  {key:'emerald', icon:'💚',name:'Смарагд',bonus:'+❤️15',cost:3},
  {key:'topaz',   icon:'🟡',name:'Топаз',  bonus:'+🪙5', cost:3},
  {key:'opal',    icon:'🔵',name:'Опал',   bonus:'+⚡10',cost:3},
  {key:'ruby',    icon:'❤️‍🔥',name:'Рубін',bonus:'+🦋2', cost:4},
];

// ── House star system constants (must be top-level) ──
const HOUSE_COMPONENTS = [
  {key:'foundation', icon:'🧱', name:'Фундамент'},
  {key:'roof',       icon:'🏗️', name:'Дах'},
  {key:'walls',      icon:'🪟', name:'Стіни'},
  {key:'interior',   icon:'🛋️', name:'Інтер\'єр'},
];
const HOUSE_COMP_COSTS = [50, 120, 280, 600, 1200];
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
  const comps=P.houseComponents||{foundation:0,roof:0,walls:0,interior:0};
  return Math.min(...HOUSE_COMPONENTS.map(c=>comps[c.key]||0));
}
function getHouseStarData(){
  const star=getHouseStar();
  return HOUSE_STARS[Math.min(star,HOUSE_STARS.length-1)]||HOUSE_STARS[0];
}
const GEM_FX = {
  sapphire:()=>{P.butterflies++;addLog('Сапфір дав +🦋1!');},
  amethyst:()=>{gainXP(10);addLog('Аметист дав +⭐10 XP!');},
  emerald: ()=>{P.hearts=cl(P.hearts+15,0,999999);addLog('Смарагд дав +❤️15!');},
  topaz:   ()=>{P.coins+=5;addLog('Топаз дав +🪙5!');},
  opal:    ()=>{P.energy=cl(P.energy+10);addLog('Опал дав +⚡10!');},
  ruby:    ()=>{P.butterflies+=2;addLog('Рубін дав +🦋2!');},
};
const TRAIN_CFG = [
  {key:'clothes',icon:'👗',name:'Одяг',      desc:'Одяг дає +🦋1 більше краси'},
  {key:'access', icon:'👑',name:'Аксесуари', desc:'Аксесуари дають +🦋1 більше краси'},
  {key:'jewel',  icon:'💍',name:'Прикраси',  desc:'Прикраси дають +🦋1 більше краси'},
];
const CATS = ['🐱','😺','😸','😻','😹'];
const MOODS = [[80,'😻 в захваті!'],[60,'😊 щасливий'],[40,'😐 нормально'],[20,'😿 сумний'],[0,'😤 незадоволений']];

// ── State ─────────────────────────────────────────────
let P=null,uid=null,chatUnsub=null,onlineInt=null,decayInt=null,walkTicker=null,sleepTimer=null;
let mailTab='inbox',currentMailId=null,ratingTab='players',saveTO=null;
let shopFilter='food',wardrobeFilter='all',selectedGift=null,authMode='login';

const cl  = (v,mn=0,mx=100)=>Math.max(mn,Math.min(mx,v));
const $   = id=>document.getElementById(id);
const now = ()=>new Date().toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'});
const esc = t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const san = o=>JSON.parse(JSON.stringify(o,(k,v)=>v===undefined?null:v));

function saveP(){
  if(!uid||!P)return;
  try{localStorage.setItem('kg_local_'+uid,JSON.stringify(P));}catch(e){}
  clearTimeout(saveTO);
  saveTO=setTimeout(async()=>{
    try{await setDoc(doc(db,'players',uid),san(P),{merge:true});}
    catch(e){console.warn('save:',e.code);}
  },2500);
}

function showLoading(on){$('loading-screen').style.display=on?'flex':'none';}
function setErr(m){$('auth-err').textContent=m;}
function resetBtn(){
  const b=$('auth-btn');b.disabled=false;
  b.textContent=authMode==='reg'?'Зареєструватися 🐾':'Увійти 🐾';
}

function mkPlayer(nickname,catname){
  return {
    nickname,catname,
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
    about:'',
    gifts:[],
    inbox:[
      {id:1,from:'КотяГра 🐱',subj:'Ласкаво просимо!',
       body:'Привіт, '+nickname+'! Виховуй котика '+catname+', тренуй навики, вступай у клуби. Удачі!',
       time:now(),read:false,type:'system'},
      {id:2,from:'КотяГра 🐱',subj:'Підказка: прогулянки 🌳',
       body:'Відправляй '+catname+' на прогулянку — вона знаходить монети і дорогоцінності!',
       time:now(),read:false,type:'system'},
    ],
    sent:[],
    createdAt:new Date().toISOString(),
    lastSeen:new Date().toISOString(),
  };
}

// ── AUTH ──────────────────────────────────────────────
window.switchTab=function(m){
  authMode=m;
  document.querySelectorAll('.auth-tab').forEach((t,i)=>t.classList.toggle('active',(i===0&&m==='login')||(i===1&&m==='reg')));
  $('a-name').style.display=m==='reg'?'block':'none';
  $('a-cat').style.display=m==='reg'?'block':'none';
  $('auth-btn').textContent=m==='reg'?'Зареєструватися 🐾':'Увійти 🐾';
  setErr('');
};
window.doAuth=async function(){
  const email=$('a-email').value.trim(),pass=$('a-pass').value;
  const nick=$('a-name').value.trim(),cat=$('a-cat').value.trim();
  setErr('');
  if(!email||!pass){setErr('Заповни всі поля!');return;}
  if(authMode==='reg'&&(!nick||!cat)){setErr("Вкажи нікнейм та ім'я котика!");return;}
  $('auth-btn').disabled=true;$('auth-btn').textContent='⏳ Зачекайте...';
  try{
    if(authMode==='reg'){
      try{const nq=await getDocs(query(collection(db,'players'),where('nickname','==',nick),limit(1)));
        if(!nq.empty){setErr('Такий нікнейм вже зайнятий!');resetBtn();return;}}catch(e){}
      const cred=await createUserWithEmailAndPassword(auth,email,pass);
      const np=mkPlayer(nick,cat);
      try{await setDoc(doc(db,'players',cred.user.uid),san(np));}
      catch(e){localStorage.setItem('kg_pending_'+cred.user.uid,JSON.stringify(np));}
    }else{
      await signInWithEmailAndPassword(auth,email,pass);
    }
  }catch(e){
    resetBtn();
    const msgs={'auth/email-already-in-use':'Email вже використовується!',
      'auth/invalid-email':'Невірний формат email!','auth/weak-password':'Пароль мінімум 6 символів!',
      'auth/user-not-found':'Гравця не знайдено!','auth/wrong-password':'Невірний пароль!',
      'auth/invalid-credential':'Невірний логін або пароль!',
      'auth/too-many-requests':'Забагато спроб. Спробуй пізніше.',
      'auth/network-request-failed':'Немає інтернету.'};
    setErr(msgs[e.code]||'Помилка: '+e.message);
  }
};
window.doGoogleAuth=async function(){
  try{
    const r=await signInWithPopup(auth,new GoogleAuthProvider());
    try{const s=await getDoc(doc(db,'players',r.user.uid));
      if(!s.exists()){const n=(r.user.displayName||'Гравець').replace(/\s+/g,'_').slice(0,20);
        await setDoc(doc(db,'players',r.user.uid),san(mkPlayer(n,'Котик')));}}catch(e){}
  }catch(e){if(e.code!=='auth/popup-closed-by-user')setErr(e.message);}
};
window.logout=async function(){stopAll();P=null;uid=null;await signOut(auth);};

// ── Auth Observer ─────────────────────────────────────
// ── Sanitize loaded player data (fix bad legacy saves) ─
function sanitizePlayer(p){
  if(!p)return p;
  // Fix stuck sleep: if sleeping but no valid sleepStart, force wake
  if(p.sleeping){
    if(!p.sleepStart||!p.sleepDur){
      p.sleeping=false;p.sleepStart=null;p.sleepDur=null;
      p.energy=Math.min(100,(p.energy||0)+30);
    } else {
      // Check if sleep already expired
      if(Date.now()-p.sleepStart >= p.sleepDur){
        p.sleeping=false;p.sleepStart=null;p.sleepDur=null;
        p.energy=Math.min(100,(p.energy||0)+30);
      }
    }
  }
  // Fix NaN beauty fields
  if(isNaN(p.butterflies))p.butterflies=0;
  if(isNaN(p.coins))p.coins=0;
  if(isNaN(p.hearts))p.hearts=500;
  // Ensure houseComponents exists
  if(!p.houseComponents)p.houseComponents={foundation:0,roof:0,walls:0,interior:0};
  if(!p.friends)p.friends=[];
  return p;
}

onAuthStateChanged(auth,async user=>{
  if(!user){
    stopAll();P=null;uid=null;showLoading(false);
    $('game-wrap').style.display='none';$('bottom-nav').style.display='none';
    $('auth-screen').style.display='flex';resetBtn();return;
  }
  showLoading(true);$('auth-screen').style.display='none';uid=user.uid;
  const local=localStorage.getItem('kg_local_'+uid);
  const pending=localStorage.getItem('kg_pending_'+uid);
  if(pending){
    P=sanitizePlayer(JSON.parse(pending));localStorage.removeItem('kg_pending_'+uid);
    setDoc(doc(db,'players',uid),san(P)).catch(e=>console.warn(e));
    startGame();return;
  }
  if(local){
    P=sanitizePlayer(JSON.parse(local));
    startGame();
    getDoc(doc(db,'players',uid)).then(s=>{
      if(s.exists()){const r=sanitizePlayer(s.data());if((r.level||1)>=(P.level||1)){P=r;render();renderPetPage();}}
    }).catch(()=>{});return;
  }
  try{
    const s=await getDoc(doc(db,'players',uid));
    if(s.exists()){P=sanitizePlayer(s.data());}
    else{const n=(user.displayName||'Гравець').replace(/\s+/g,'_').slice(0,20);
      P=mkPlayer(n,'Котик');
      setDoc(doc(db,'players',uid),san(P)).catch(()=>{});}
  }catch(e){
    const n=(user.displayName||'Гравець').replace(/\s+/g,'_').slice(0,20);
    P=mkPlayer(n,'Котик');
  }
  startGame();
});

function startGame(){
  $('game-wrap').style.display='flex';$('bottom-nav').style.display='flex';showLoading(false);
  $('s-pn').textContent=(P.catname||P.nickname||'Котик')+' ▾';
  $('cat-dn').textContent=P.catname||'Котик';
  buildGems();buildTrain();buildShop('food');buildShowPage();
  initTasks();
  render();renderPetPage();
  startDecay();startOnline();
  if(P.walk&&Date.now()-P.walk.start<P.walk.dur)resumeWalk();
  else if(P.walk)finishWalk(true);
  // Sleep: sanitizePlayer already cleared invalid/expired sleep
  if(P.sleeping&&P.sleepStart&&P.sleepDur){
    $('cat-emoji').textContent='😴';
    startSleepTimer();
  }
  // Persist sanitized data immediately (fixes NaN/stuck-sleep for existing users)
  saveP();
  updateMailBadge();
}

function startSleepTimer(){
  clearTimeout(sleepTimer);
  const tick=()=>{
    if(!P||!P.sleeping){return;}
    const elapsed=Date.now()-(P.sleepStart||Date.now());
    const total=P.sleepDur||1200000;
    const rem=Math.max(0,total-elapsed);
    const pct=Math.min(100,(elapsed/total*100));
    const mins=Math.floor(rem/60000);const secs=Math.floor((rem%60000)/1000);
    const cd=$('sleep-countdown');
    if(cd)cd.textContent='⏱ '+mins+'хв '+String(secs).padStart(2,'0')+'с';
    const bar=$('sleep-bar');if(bar)bar.style.width=pct+'%';
    if(rem<=0){wakeUp();}else{sleepTimer=setTimeout(tick,1000);}
  };
  tick();
}
function wakeUp(){
  P.sleeping=false;P.sleepStart=null;P.sleepDur=null;
  P.energy=cl((P.energy||0)+30);P.hunger=cl((P.hunger||0)+5);
  $('cat-emoji').textContent='😺';
  const cd=$('sleep-countdown');if(cd)cd.textContent='';
  const bar=$('sleep-bar');if(bar)bar.style.width='0%';
  addLog(P.catname+' прокинувся відпочилим! ⚡');
  notify('☀️ Прокинувся!','+30⚡ +5🍖');gainXP(4);render();saveP();
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

// ── Page Nav ──────────────────────────────────────────
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
};

// ── Render ────────────────────────────────────────────
function calcBeauty(){
  let b=P.butterflies||0;
  // equipped clothes bonus
  Object.values(P.equipped||{}).forEach(id=>{
    if(!id)return;
    const item=CLOTHES_CATALOG.find(c=>c.id===id);
    if(item){b+=item.beauty+(P.skills?.clothes||0);}
  });
  // house star beauty bonus
  try{const sd=getHouseStarData();if(sd&&typeof sd.beauty==='number')b+=sd.beauty;}catch(e){}
  return isNaN(b)?0:b;
}

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
  if(!P.sleeping)$('cat-emoji').textContent=CATS[Math.min(4,Math.floor(avg/100*5))];
  $('sl-ov').classList.toggle('on',!!P.sleeping);
  updateMailBadge();
  try{localStorage.setItem('kg_local_'+uid,JSON.stringify(P));}catch(e){}
}

function renderPetPage(){
  const beauty=calcBeauty();
  // FIX #9: use catname
  $('pet-big-emoji').textContent=CATS[Math.min(4,Math.floor(((P.hunger||0)+(P.thirst||0)+(P.fun||0)+(P.energy||0))/400*5))];
  $('pet-cat-name').textContent=P.catname||'Котик';
  $('pet-cat-lvl').textContent=(P.level||1)+' рівень';
  $('ps-name').textContent=P.catname||'Котик';
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
  // equipped slots
  const slotDefs={shirt:'👕',collar:'➿',hat:'🎩',ring:'💍',toy:'🎾',medal:'🏅'};
  Object.entries(slotDefs).forEach(([slot,def])=>{
    const eqId=(P.equipped||{})[slot];
    const eqEl=$('eq-'+slot);
    if(eqEl){
      if(eqId){const item=CLOTHES_CATALOG.find(c=>c.id===eqId);eqEl.textContent=item?item.icon:def;}
      else eqEl.textContent=def;
    }
    const slotEl=$('slot-'+slot);
    if(slotEl)slotEl.classList.toggle('equipped',!!eqId);
  });
  // house — star system
  const sd=getHouseStarData();
  const star=getHouseStar();
  $('house-emoji').textContent=sd.emoji;
  $('house-name').textContent=sd.name;
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

// ── FIX #5: House component & star system ─────────────
window.openHouseModal=function(){
  if(!P.houseComponents)P.houseComponents={foundation:0,roof:0,walls:0,interior:0};
  const modal=$('house-modal');if(!modal)return;
  renderHouseModal();
  modal.style.display='flex';
};
window.closeHouseModal=function(){$('house-modal').style.display='none';};

function renderHouseModal(){
  const comps=P.houseComponents||{foundation:0,roof:0,walls:0,interior:0};
  const star=getHouseStar();
  const sd=getHouseStarData();
  $('hm-visual').textContent=sd.emoji;
  $('hm-name').textContent=sd.name;
  $('hm-beauty').textContent='+'+sd.beauty+' 🦋 краси';
  const starsDisp='⭐'.repeat(star)+'☆'.repeat(Math.max(0,5-star));
  $('hm-stars').textContent=starsDisp;
  // components list
  const nextStarTier=Math.min(star,4); // cost tier for next upgrade
  const cost=HOUSE_COMP_COSTS[nextStarTier];
  $('hm-components').innerHTML=HOUSE_COMPONENTS.map(c=>{
    const lv=comps[c.key]||0;const maxed=lv>=5;
    const myStars='⭐'.repeat(lv)+'☆'.repeat(5-lv);
    const canAfford=(P.coins||0)>=cost;
    return `<div class="hm-comp-row">
      <span class="hm-comp-icon">${c.icon}</span>
      <div style="flex:1">
        <div class="hm-comp-name">${c.name}</div>
        <div class="hm-comp-stars">${myStars}</div>
      </div>
      ${maxed?'<span class="hm-comp-max">✅ Макс.</span>'
        :`<button class="hm-comp-btn ${!canAfford?'disabled':''}" ${!canAfford?'disabled':''} onclick="upgradeHouseComponent('${c.key}')">
          🪙 ${cost}
        </button>`}
    </div>`;
  }).join('');
  // star progress
  const minComp=Math.min(...HOUSE_COMPONENTS.map(c=>comps[c.key]||0));
  const nextStar=minComp+1;
  if(nextStar>5){
    $('hm-star-progress').innerHTML='<div style="text-align:center;color:var(--gn);font-weight:800">🌟 Будинок максимально покращено!</div>';
  }else{
    const needed=HOUSE_COMPONENTS.filter(c=>(comps[c.key]||0)<nextStar);
    $('hm-star-progress').innerHTML=`<div class="hm-progress-info">
      До ⭐ зірки ${nextStar}: покращ ${needed.map(c=>c.icon+' '+c.name).join(', ')}
    </div>`;
  }
}

window.upgradeHouseComponent=function(compKey){
  if(!P.houseComponents)P.houseComponents={foundation:0,roof:0,walls:0,interior:0};
  const comps=P.houseComponents;
  const curLv=comps[compKey]||0;
  if(curLv>=5){notify('✅ Максимум!','Ця складова вже максимальна!');return;}
  const star=getHouseStar();
  const cost=HOUSE_COMP_COSTS[Math.min(star,4)];
  if((P.coins||0)<cost){notify('🪙 Мало монет','Потрібно 🪙 '+cost+'!');return;}
  P.coins-=cost;
  comps[compKey]=curLv+1;
  const c=HOUSE_COMPONENTS.find(x=>x.key===compKey);
  addLog(c.icon+' '+c.name+' покращено до рівня '+(curLv+1)+'!');
  // check if star increased
  const newStar=getHouseStar();
  if(newStar>star){
    const sd=getHouseStarData();
    P.houseLevel=newStar*2; // sync old houseLevel for beauty calc
    notify('⭐ Нова зірка!',sd.emoji+' '+sd.name+' — +'+sd.beauty+' 🦋!');
    addLog('🎉 Будинок отримав '+newStar+' зірку! '+sd.name);
    wiggle();
  }else{
    notify('🏗️ Покращено!',c.name+' рівень '+(curLv+1));
  }
  renderHouseModal();renderPetPage();render();saveP();
};

// Legacy upgradeHouse kept for task hook compatibility
window.upgradeHouse=function(){openHouseModal();};

// Update calcBeauty to use star system
// (patched in calcBeauty below)

window.editAbout=function(){
  $('about-text').value=P.about||'';
  $('about-modal').style.display='flex';
};
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

// ── NOTIFY ────────────────────────────────────────────
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
function wiggle(){const el=$('cat-emoji');el.classList.remove('wiggle');void el.offsetWidth;
  el.classList.add('wiggle');setTimeout(()=>el.classList.remove('wiggle'),500);}
function updateMailBadge(){
  const cnt=(P.inbox||[]).filter(m=>!m.read).length;
  const b=$('mail-badge');if(b){b.style.display=cnt>0?'block':'none';b.textContent=cnt;}
  const uc=$('unread-cnt');if(uc)uc.textContent=cnt>0?cnt:'';
}

// ── FIX #10: gainXP uses new table ───────────────────
function gainXP(n){
  P.xp=(P.xp||0)+n;
  const cap=xpCap(P.level||1);
  if(P.xp>=cap){
    P.xp-=cap;P.level=(P.level||1)+1;
    showLevelUp(P.level);
    wiggle();
  }
  trackTask('level',0);
  render();saveP();
}

// ── FIX #3: Level-up modal with prizes ────────────────
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

// ── ACTIONS ───────────────────────────────────────────
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
      addLog(P.catname+' з апетитом поїв 🍖');notify('🍖 Смачно!','+25 їжа');break;
    case'water':
      if((P.thirst||0)>=100){notify('💧 Напоєний!',P.catname+' не хоче пити.');return;}
      P.thirst=cl((P.thirst||0)+30);gainXP(2);
      addLog(P.catname+' попив водички 💧');notify('💧 Освіжився!','+30 вода');break;
    case'play':
      if((P.energy||0)<15){notify('😴 Втомлений',P.catname+' занадто втомлений!');return;}
      P.fun=cl((P.fun||0)+20);P.energy=cl((P.energy||0)-15);
      P.hearts=cl((P.hearts||0)+2,0,999999);gainXP(5);
      addLog(P.catname+' весело пограв! 🎉');notify('🎾 Весело!','+20 розваги');break;
    case'sleep':
      if(P.sleeping){notify('💤 Вже спить',P.catname+' ще спить...');return;}
      P.sleeping=true;P.sleepStart=Date.now();P.sleepDur=20*60*1000; // 20 real minutes
      $('cat-emoji').textContent='😴';
      addLog(P.catname+' ліг спати на 20 хв... 💤');
      notify('💤 Спить!','Прокинеться через 20 хвилин ⏱');
      render();startSleepTimer();saveP();return;
    // FIX #2: show goes to page
    case'show':goPage('show');return;
  }
  render();saveP();
};

// ── FIX #5: Shop with categories ─────────────────────
const SHOP_ITEMS = {
  food:[
    {id:'fish',icon:'🐟',name:'Рибка',desc:'+30🍖, +10🦋 краси',cost:8,effect:()=>{P.hunger=cl((P.hunger||0)+30);P.butterflies=(P.butterflies||0)+1;}},
    {id:'milk',icon:'🥛',name:'Молочко',desc:'+20💧 вода',cost:5,effect:()=>{P.thirst=cl((P.thirst||0)+20);}},
    {id:'cake',icon:'🎂',name:'Тортик',desc:'+40🍖, +20😊 настрій',cost:15,effect:()=>{P.hunger=cl((P.hunger||0)+40);P.fun=cl((P.fun||0)+20);}},
    {id:'premium_food',icon:'🍱',name:'Преміум корм',desc:'+50🍖 +30💧',cost:30,effect:()=>{P.hunger=cl((P.hunger||0)+50);P.thirst=cl((P.thirst||0)+30);}},
    {id:'energy_drink',icon:'⚡',name:'Енергетик',desc:'+40⚡ енергія',cost:20,effect:()=>{P.energy=cl((P.energy||0)+40);}},
    {id:'ball',icon:'🎾',name:'М\'ячик',desc:'+20😊 розваги, +5⚡',cost:10,effect:()=>{P.fun=cl((P.fun||0)+20);P.energy=cl((P.energy||0)+5);}},
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
    {id:'house_material',icon:'🏗️',name:'Будматеріали',desc:'-20% ціна покращення будинку',cost:150,effect:()=>{notify('🏗️ Незабаром','Знижка на будинок!');}},
  ],
};

window.filterShop=function(cat){
  shopFilter=cat;
  document.querySelectorAll('.shop-cat-btn').forEach(b=>b.classList.toggle('active',b.textContent.toLowerCase().includes(cat.slice(0,3))));
  buildShop(cat);
};

function buildShop(cat){
  const container=$('shop-items');if(!container)return;
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
        `<button class="si-buy" ${(!lvlOk||((P.coins||0)<item.cost))?'disabled':''} onclick="buyShopItem('${item.id}','${cat}')" style="flex-shrink:0">
          ${!lvlOk?'Рів.'+item.lvlReq:'🪙 '+item.cost}
        </button>`}`;
    container.appendChild(div);
  });
}

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
    // Auto-equip if slot empty
    if(!(P.equipped||{})[item.slot]){P.equipped=P.equipped||{};P.equipped[item.slot]=id;}
    addLog('Куплено '+item.name+'! Одягнуто на '+P.catname);
    notify('✨ Куплено!',item.name+' у шафі!');
  }else{
    item.effect?.();
    addLog('Куплено: '+item.name);notify('✨ Куплено!',item.name);
  }
  gainXP(5);renderPetPage();render();saveP();buildShop(cat);
};

window.equipItem=function(id){
  const item=CLOTHES_CATALOG.find(c=>c.id===id);if(!item)return;
  P.equipped=P.equipped||{};
  if(P.equipped[item.slot]===id){
    P.equipped[item.slot]=null;
    notify('✅ Знято',item.name+' знято');
  }else{
    P.equipped[item.slot]=id;
    notify('✅ Одягнено',item.name+' одягнено! +'+item.beauty+' 🦋');
  }
  renderPetPage();render();saveP();
  if($('wardrobe-modal').style.display!=='none')renderWardrobe(wardrobeFilter);
};

// ── FIX #6: Wardrobe / clothes UI ────────────────────
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
  const owned=P.wardrobe||[];
  $('wardrobe-used').textContent=owned.length;
  let items=CLOTHES_CATALOG.filter(c=>owned.includes(c.id));
  if(filter&&filter!=='all')items=items.filter(c=>c.slot===filter);
  const emptySlots=Math.max(0,Math.min(8,20-owned.length));
  grid.innerHTML=items.map(item=>{
    const isEq=Object.values(P.equipped||{}).includes(item.id);
    const rarColor=RARITY_COLOR[item.rarity]||'#aaa';
    return `<div class="wardrobe-item ${isEq?'equipped':''}" onclick="equipItem('${item.id}')">
      <span class="wi-icon">${item.icon}</span>
      <span class="wi-name">${item.name}</span>
      <span class="wi-beauty" style="color:${rarColor}">+${item.beauty}🦋</span>
      ${isEq?'<span class="wi-badge">Одягнено</span>':''}
    </div>`;
  }).join('');
  if(!items.length&&!emptySlots){
    grid.innerHTML='<div class="loading-inline" style="grid-column:span 4">Шафа порожня. Купи одяг у магазині!</div>';
  }
  // empty slots
  for(let i=0;i<Math.min(emptySlots,4);i++){
    grid.innerHTML+=`<div class="wardrobe-item empty-slot"><span class="wi-icon">➕</span><span class="wi-name">Порожньо</span></div>`;
  }
}

// ── FIX #2: Exhibition page ───────────────────────────
const SHOW_CATS = [
  {id:'beauty',    name:'Краса',           icon:'🦋', reqLvl:1,  entryFee:5,  prizes:['🪙 50','🦋 +10','💎 Камінь']},
  {id:'glamour',   name:'Гламур',          icon:'🌸', reqLvl:3,  entryFee:10, prizes:['🪙 150','❤️ 200','👑 Корона']},
  {id:'fashion',   name:'Мода',            icon:'👗', reqLvl:5,  entryFee:20, prizes:['🪙 300','🦋 +30','🥇 Медаль']},
  {id:'champion',  name:'Чемпіон клубу',   icon:'🏆', reqLvl:8,  entryFee:50, prizes:['🪙 1000','🎀 Бантик','👑 Трон']},
  {id:'summer',    name:'Червнева виставка',icon:'☀️', reqLvl:1,  entryFee:0,  prizes:['🪙 500','🦋 +50','🌟 Особл. нагорода'],special:true},
];

function buildShowPage(){
  $('show-cat-emoji').textContent=CATS[0];
  $('show-cat-name').textContent=P.catname||'Котик';
  $('show-beauty').textContent=calcBeauty();
  $('show-level').textContent=P.level||1;
  const cats=$('show-categories');if(!cats)return;
  cats.innerHTML=SHOW_CATS.map(sc=>{
    const canEnter=(P.level||1)>=sc.reqLvl;
    const fee=sc.entryFee>0?'Внесок: 🪙 '+sc.entryFee:'Безкоштовно!';
    return `<div class="show-category ${sc.special?'show-special':''}">
      <div class="show-cat-title">
        <span>${sc.icon} ${sc.name}</span>
        <span style="font-size:.68rem;color:var(--tl);font-weight:700">${fee}</span>
      </div>
      <div class="show-prize-row">
        ${sc.prizes.map(p=>`<div class="prize-item">${p}</div>`).join('')}
      </div>
      <button class="show-enter-btn" ${!canEnter?'disabled':''} onclick="enterShow('${sc.id}')">
        ${canEnter?'Взяти участь 🐾':'Потрібно '+sc.reqLvl+' рівень'}
      </button>
    </div>`;
  }).join('');
  buildShowLeaderboard();
}

function buildShowLeaderboard(){
  const lb=$('show-leaderboard');if(!lb)return;
  const myScore=calcBeauty();
  const contenders=[
    {name:'Котолюб99',score:320+Math.floor(Math.random()*50),av:'😺'},
    {name:'Wilidon',score:210+Math.floor(Math.random()*50),av:'😸'},
    {name:'МурзикPRO',score:180+Math.floor(Math.random()*50),av:'😻'},
    {name:'Пухнастик',score:140+Math.floor(Math.random()*50),av:'🐱'},
    {name:P.nickname||'Ти 🌟',score:myScore,av:'🐾'},
  ].sort((a,b)=>b.score-a.score);
  const medals=['🥇','🥈','🥉'];
  lb.innerHTML=contenders.map((c,i)=>`<div class="show-contestant">
    <span style="font-size:.8rem;font-weight:900;color:var(--tl)">${medals[i]||i+1}</span>
    <span style="font-size:1.3rem">${c.av}</span>
    <span style="flex:1;font-weight:800;color:var(--gdk);font-size:.78rem">${esc(c.name)}</span>
    <span style="font-weight:900;color:var(--tx);font-size:.78rem">🦋 ${c.score}</span>
  </div>`).join('');
}

window.enterShow=function(catId){
  const sc=SHOW_CATS.find(c=>c.id===catId);if(!sc)return;
  if((P.coins||0)<sc.entryFee){notify('🪙 Мало монет','Потрібно '+sc.entryFee+' монет!');return;}
  P.coins-=sc.entryFee;
  const myScore=calcBeauty()+(Math.random()*20|0);
  const topScore=200+Math.floor(Math.random()*200);
  const win=myScore>topScore*0.7;
  if(win){
    P.showWins=(P.showWins||0)+1;
    const coins=parseInt(sc.prizes[0].replace(/\D/g,''))||50;
    P.coins=(P.coins||0)+coins;gainXP(20+sc.reqLvl*5);
    P.butterflies=(P.butterflies||0)+(sc.reqLvl>=5?30:10);
    wiggle();
    notify('🏆 Перемога!',P.catname+' переміг на виставці "'+sc.name+'"! +'+coins+'🪙');
    addLog(P.catname+' виграв виставку "'+sc.name+'"! 🏆');
  }else{
    gainXP(8);
    notify('😿 Не цього разу','Наступного разу пощастить! +8 XP');
    addLog(P.catname+' взяв участь у "'+sc.name+'", але не виграв. 💪');
  }
  buildShowLeaderboard();render();saveP();
};

// ── TRAINING ──────────────────────────────────────────
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
  renderTrain();saveP();
};

// ── FIX #6: GEMS ──────────────────────────────────────
function buildGems(){
  const gl=$('gem-list');if(!gl)return;const ga=$('gem-assemble');if(!ga)return;
  gl.innerHTML=GEMS_CFG.map(({key,icon,name,bonus,cost})=>
    `<div class="gem-row">
      <div class="gem-left">
        <span class="gem-icon">${icon}</span>
        <div>
          <div class="gem-name">${name}</div>
          <div class="gem-bonus">${bonus}</div>
          <div class="gem-mini-bar-wrap"><div class="gem-mini-bar" id="gmb-${key}" style="width:0%"></div></div>
          <div style="font-size:.6rem;color:var(--tl);font-weight:700" id="gmc-txt-${key}">0/5 частин</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:5px">
        <span style="font-size:.85rem;font-weight:900;color:var(--tx)" id="gc-${key}">0</span>
        <button class="gem-add" onclick="collectGem('${key}',${cost})" title="Придбати частину за 🪙${cost}">
          +🪙${cost}
        </button>
      </div>
    </div>`
  ).join('');
  ga.innerHTML=GEMS_CFG.map(({key,icon,name})=>
    `<button class="act-btn" onclick="assembleGem('${key}','${icon}')" style="padding:9px 5px">
      <span class="bi">${icon}</span><span class="bl">${name}</span>
      <span class="bc" id="gab-${key}">? / 5</span></button>`
  ).join('');
}
function renderGems(){
  GEMS_CFG.forEach(({key})=>{
    const cnt=(P.gems?.[key])||0;
    const pct=Math.min(100,cnt/5*100);
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
  renderGems();render();saveP();
};
window.assembleGem=function(g,icon){
  if((P.gems?.[g]||0)<5){notify('💎 Недостатньо','Потрібно 5 частин!');return;}
  P.gems[g]-=5;GEM_FX[g]?.();gainXP(15);wiggle();
  notify(icon+' Зібрано!','Камінь зібрано! Отримано бонус!');renderGems();render();saveP();
};

// ── WALKS ─────────────────────────────────────────────
window.startWalk=function(type,secs,minC,maxC,xp){
  if(P.walk){notify('🌳 Вже на прогулянці!','Зачекайте поки '+P.catname+' повернеться.');return;}
  if((P.energy||0)<20){notify('😴 Мало енергії','Котику потрібно відпочити!');return;}
  P.walk={type,start:Date.now(),dur:secs*1000,minC,maxC,xp};P.energy=cl((P.energy||0)-15);
  const names={yard:'у двір',park:'у парк',forest:'у ліс'};
  addLog(P.catname+' пішов '+names[type]+'!');
  notify('🌳 Прогулянка!','~'+secs+' сек. Вдалого полювання!');
  showWalkUI();render();saveP();
};
function showWalkUI(){
  $('walk-active-div').style.display='block';$('walk-opts').style.display='none';
  clearInterval(walkTicker);walkTicker=setInterval(tickWalk,500);
}
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
    // FIX #6: gems found on walks
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
  }
  P.walk=null;
  if(!skip){P.tasks=P.tasks||{};P.tasks.progress=P.tasks.progress||{};P.tasks.progress.walkDone=(P.tasks.progress.walkDone||0)+1;P.tasks.progress.walkTotal=(P.tasks.progress.walkTotal||0)+1;trackTask('walkDone',0);trackTask('walkTotal',0);}
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
        <span class="lb-player">${esc(p.nickname||'?')}${d.id===uid?' 🌟':''}</span>
        <span class="lb-coins">🪙 ${p.walkCoins||0}</span></div>`;
    }).join('')||'<div class="loading-inline">Поки немає даних</div>';
  }catch(e){lb.innerHTML='<div class="loading-inline">Помилка</div>';}
}

// ── DECAY ─────────────────────────────────────────────
function startDecay(){
  clearInterval(decayInt);
  decayInt=setInterval(()=>{
    if(!P)return;
    if(!P.sleeping){
      P.hunger=cl((P.hunger||0)-2);P.thirst=cl((P.thirst||0)-3);
      P.fun=cl((P.fun||0)-1);P.energy=cl((P.energy||0)-1);
    }else{P.energy=cl((P.energy||0)+2);P.hunger=cl((P.hunger||0)-1);P.thirst=cl((P.thirst||0)-1);}
    if(Math.random()>.75)P.coins=(P.coins||0)+1;
    render();
    if(Math.random()>.95){
      const evts=[P.catname+' знайшов пір\'їнку! 🪶',P.catname+' дивиться у вікно... 🐦',
        P.catname+' перекинув склянку! 💦',P.catname+' принюхується до квітів 🌸'];
      addLog(evts[Math.floor(Math.random()*evts.length)]);
    }
  },3500);
}

// ── FIX #7: Clubs ─────────────────────────────────────
async function loadClubs(){
  const cb=$('club-browser');if(!cb)return;cb.innerHTML='<div class="loading-inline">Завантаження...</div>';
  try{
    const snap=await getDocs(query(collection(db,'clubs'),orderBy('level','desc'),limit(10)));
    if(snap.empty){cb.innerHTML='<div class="loading-inline">Клубів поки немає. Створи перший!</div>';return;}
    cb.innerHTML=snap.docs.map(d=>{const c=d.data();
      return `<div class="club-list-item" onclick="joinClub('${d.id}')">
        <span class="cli-icon">${c.icon||'🎈'}</span>
        <div><div class="cli-name">${esc(c.name||'?')}</div>
        <div class="cli-info">${c.memberCount||1} учасників · Рів.${c.level||1} · Засн. ${c.founded||'—'}</div></div>
        ${(c.level||1)>=5?'<span class="cli-badge">ТОП</span>':''}</div>`;
    }).join('');
  }catch(e){cb.innerHTML='<div class="loading-inline">Помилка: '+esc(e.message)+'</div>';}
}
function renderClubs(){
  if(P.clubId){$('clubs-no-club').style.display='none';$('clubs-in-club').style.display='block';}
  else{$('clubs-no-club').style.display='block';$('clubs-in-club').style.display='none';loadClubs();}
}
async function loadClubData(){
  if(!P.clubId)return;
  try{
    const snap=await getDoc(doc(db,'clubs',P.clubId));
    if(!snap.exists()){P.clubId=null;saveP();renderClubs();return;}
    const c=snap.data();
    $('cl-emblem').textContent=c.icon||'🏰';$('cl-name').textContent=c.name||'Клуб';
    const stars=Math.min(7,c.stars||1);
    $('cl-stars').textContent='★'.repeat(stars)+'☆'.repeat(Math.max(0,7-stars));
    $('cl-desc').textContent=c.description||'—';$('cl-founded').textContent=c.founded||'—';
    $('cl-level').textContent=c.level||1;$('cl-xp').textContent=((c.xp||0)/1000).toFixed(2)+'g';
    $('cl-pc').textContent=c.piggyCoins||0;$('cl-ph').textContent=((c.piggyHearts||0)/1000).toFixed(2)+'g';
    $('cl-mc').textContent=c.memberCount||1;$('cl-mcount').textContent=c.memberCount||1;
    $('cl-blvl').textContent=c.buildingsLevel||1;
    $('cl-role-badge').textContent=c.directorUid===uid?'👑 Ти — Директор':'👤 Учасник';
    $('club-settings-row').style.display=c.directorUid===uid?'flex':'none';
    $('ps-club').textContent='Клуб: '+c.name+' · Новачок';
    const mSnap=await getDocs(query(collection(db,'clubs',P.clubId,'members'),limit(30)));
    const roles={director:'Директор',deputy:'Зам. Директора',curator:'Куратор',member:'Учасник'};
    const rcls={director:'role-dir',deputy:'role-dep',curator:'role-cur',member:'role-mem'};
    const avs=['🐱','😺','😸','😻','🐈','🐾'];
    $('cl-members').innerHTML=mSnap.docs.map(md=>{const m=md.data();const rk=m.role||'member';
      return `<div class="member-row"><span class="member-av">${avs[Math.floor(Math.random()*avs.length)]}</span>
        <span class="member-name">${esc(m.nickname||'?')}</span>
        <span class="member-pts">${((m.points||0)/1000).toFixed(2)}m</span>
        <span class="member-role ${rcls[rk]}">${roles[rk]}</span></div>`;
    }).join('');
  }catch(e){console.error('loadClubData:',e);}
}
window.joinClub=async function(clubId){
  if(P.clubId){notify('✅ Вже в клубі','Спочатку вийди з поточного!');return;}
  if((P.level||1)<3){notify('⬆️ Низький рівень','Потрібно 3 рівень!');return;}
  try{
    const snap=await getDoc(doc(db,'clubs',clubId));if(!snap.exists()){notify('❌ Помилка','Клуб не знайдено!');return;}
    await setDoc(doc(db,'clubs',clubId,'members',uid),{uid,nickname:P.nickname,role:'member',points:0,joinedAt:new Date().toISOString()});
    await updateDoc(doc(db,'clubs',clubId),{memberCount:increment(1)});
    P.clubId=clubId;P.clubDays=0;await saveP();
    $('club-join-banner').style.display='block';
    notify('🎈 Ласкаво просимо!','Ти вступив до клубу!');
    addLog('Вступив до клубу "'+snap.data().name+'"! 🎈');
    renderClubs();loadClubData();
  }catch(e){notify('❌ Помилка',e.message);}
};
window.createClub=async function(){
  const name=$('new-club-name').value.trim();const desc=$('new-club-desc').value.trim();
  if(!name){notify('📝 Введи назву','Назва обов\'язкова!');return;}
  if(P.clubId){notify('✅ Вже в клубі','Спочатку вийди з поточного!');return;}
  const icons=['🐱','🌟','🦋','💎','🌸','🏆','🎀','🎈','🔥','🌙','🏰'];
  const icon=icons[Math.floor(Math.random()*icons.length)];
  try{
    const ref=await addDoc(collection(db,'clubs'),{
      name,description:desc||'Наш чудовий клуб!',icon,level:1,xp:0,stars:1,memberCount:1,
      directorUid:uid,directorName:P.nickname,piggyCoins:0,piggyHearts:0,buildingsLevel:1,
      founded:new Date().toLocaleDateString('uk-UA'),createdAt:new Date().toISOString(),
    });
    await setDoc(doc(db,'clubs',ref.id,'members',uid),{uid,nickname:P.nickname,role:'director',points:0,joinedAt:new Date().toISOString()});
    P.clubId=ref.id;await saveP();
    notify('🏆 Клуб створено!','"'+name+'" — ти Директор!');addLog('Створено клуб "'+name+'"! 🏆');
    renderClubs();loadClubData();
  }catch(e){notify('❌ Помилка',e.message);}
};
window.donateClub=async function(){
  if((P.coins||0)<10){notify('🪙 Мало монет','Потрібно 10 монет!');return;}if(!P.clubId)return;
  P.coins-=10;
  try{
    await updateDoc(doc(db,'clubs',P.clubId),{piggyCoins:increment(10),xp:increment(10)});
    await updateDoc(doc(db,'clubs',P.clubId,'members',uid),{points:increment(10)});
    addLog('Пожертвував 🪙10 до копилки клубу!');notify('🐷 Копилка!','🪙10 передано!');
    loadClubData();render();saveP();
  }catch(e){}
};
window.leaveClub=async function(){
  if(!P.clubId||!confirm('Вийти з клубу?'))return;
  try{
    await deleteDoc(doc(db,'clubs',P.clubId,'members',uid));
    await updateDoc(doc(db,'clubs',P.clubId),{memberCount:increment(-1)});
    P.clubId=null;P.clubLoyalty=0;P.clubDays=0;await saveP();
    addLog('Вийшов з клубу');renderClubs();
  }catch(e){notify('❌ Помилка',e.message);}
};
window.openCollectionExchange=function(){notify('🔄 Обмін колекціями','Незабаром!');};
window.showClubHistory=function(){notify('📜 Незабаром','Ця функція буде додана!');};

// ── FIX #2 #3: Ratings — show ALL players, catname+nickname, clickable ───
const medals=['🥇','🥈','🥉'];
window.switchRating=function(type){
  ratingTab=type;
  ['players','clubs','beauty'].forEach(t=>$('rt-'+t)?.classList.toggle('active',t===type));
  loadRatings(type);
};
async function loadRatings(type){
  const rl=$('rating-list');if(!rl)return;rl.innerHTML='<div class="loading-inline">Завантаження...</div>';
  try{
    if(type==='players'){
      const snap=await getDocs(collection(db,'players'));
      const players=snap.docs.map(d=>({...d.data(),_id:d.id}))
        .filter(p=>p.nickname) // only real accounts
        .sort((a,b)=>((b.level||1)*1000+(b.butterflies||0))-((a.level||1)*1000+(a.butterflies||0)));
      rl.innerHTML=players.slice(0,30).map((p,i)=>{
        const isMe=p._id===uid;
        return `<div class="rating-row ${isMe?'rating-row-me':''}" onclick="openPlayerProfile('${p._id}')">
          <span class="rrank ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">${medals[i]||i+1}</span>
          <span class="rav">🐱</span>
          <div style="flex:1">
            <div class="rname">${esc(p.catname||'Котик')}${isMe?' 🌟':''}</div>
            <div class="rsub">@${esc(p.nickname||'?')} · Рів.${p.level||1} · 🦋${p.butterflies||0}</div>
          </div>
          <span class="rscore">⭐${((p.level||1)*1000)+(p.butterflies||0)}</span>
        </div>`;
      }).join('')||'<div class="loading-inline">Поки немає гравців</div>';
    }else if(type==='clubs'){
      const snap=await getDocs(collection(db,'clubs'));
      const clubs=snap.docs.map(d=>({...d.data(),_id:d.id})).sort((a,b)=>((b.level||1)*100+(b.memberCount||1))-((a.level||1)*100+(a.memberCount||1)));
      rl.innerHTML=clubs.slice(0,20).map((c,i)=>
        `<div class="rating-row"><span class="rrank ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">${medals[i]||i+1}</span>
          <span class="rav">${c.icon||'🎈'}</span>
          <div style="flex:1"><div class="rname">${esc(c.name||'?')}</div>
          <div class="rsub">Рів.${c.level||1} · ${c.memberCount||1} учасн. · ${c.founded||'—'}</div></div>
          <span class="rscore">⭐${((c.level||1)*100)+(c.memberCount||1)}</span></div>`
      ).join('')||'<div class="loading-inline">Поки немає клубів</div>';
    }else{
      const snap=await getDocs(collection(db,'players'));
      const players=snap.docs.map(d=>({...d.data(),_id:d.id})).filter(p=>p.nickname).sort((a,b)=>(b.butterflies||0)-(a.butterflies||0));
      rl.innerHTML=players.slice(0,30).map((p,i)=>{
        const isMe=p._id===uid;
        return `<div class="rating-row ${isMe?'rating-row-me':''}" onclick="openPlayerProfile('${p._id}')">
          <span class="rrank ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">${medals[i]||i+1}</span>
          <span class="rav">🦋</span>
          <div style="flex:1"><div class="rname">${esc(p.catname||'Котик')}${isMe?' 🌟':''}</div>
          <div class="rsub">@${esc(p.nickname||'?')} · Гламур ${p.glamour||0}</div></div>
          <span class="rscore">🦋${p.butterflies||0}</span></div>`;
      }).join('')||'<div class="loading-inline">Поки немає даних</div>';
    }
  }catch(e){rl.innerHTML='<div class="loading-inline">Помилка: '+esc(e.message)+'</div>';}
}

// ── FIX #10: Player profile modal ────────────────────
let viewingPlayerId=null;
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
    const cats=['🐱','😺','😸','😻','🐾'];
    const av=cats[Math.floor(Math.random()*cats.length)];
    $('pm-av').textContent=av;
    $('pm-catname').textContent=p.catname||'Котик';
    $('pm-nick').textContent='@'+(p.nickname||'?');
    $('pm-lvl').textContent='Рівень '+(p.level||1)+' · '+((p.level||1)*1000+(p.butterflies||0))+' очок';
    // stats
    const beauty=(p.butterflies||0);
    $('pm-stats').innerHTML=`
      <div class="pm-stat-row"><span>⭐ Рівень:</span><b>${p.level||1}</b></div>
      <div class="pm-stat-row"><span>🦋 Краса:</span><b>${beauty}</b></div>
      <div class="pm-stat-row"><span>🌸 Гламур:</span><b>${p.glamour||0}</b></div>
      <div class="pm-stat-row"><span>🏆 Перемог:</span><b>${p.showWins||0}</b></div>
      <div class="pm-stat-row"><span>🌳 Монет з прогулянок:</span><b>🪙${p.walkCoins||0}</b></div>
      <div class="pm-stat-row"><span>🏠 Рівень будинку:</span><b>${p.houseLevel||1}/10</b></div>
      <div class="pm-stat-row"><span>🎈 Клуб:</span><b>${p.clubId?'Є':'—'}</b></div>
      <div class="pm-stat-row"><span>📅 Днів у грі:</span><b>${Math.floor((Date.now()-new Date(p.createdAt||Date.now()).getTime())/86400000)}</b></div>
    `;
    // about
    if(p.about){$('pm-about-box').style.display='block';$('pm-about').textContent=p.about;}
    else{$('pm-about-box').style.display='none';}
    // achievements
    const achiev=[];
    if((p.level||1)>=5)achiev.push('⭐ Рівень 5+');
    if((p.level||1)>=10)achiev.push('🌟 Рівень 10+');
    if((p.butterflies||0)>=50)achiev.push('🦋 Красуня 50+');
    if((p.showWins||0)>=1)achiev.push('🏆 Переможець виставки');
    if(p.clubId)achiev.push('🎈 Учасник клубу');
    if((p.walkCoins||0)>=500)achiev.push('🌳 Мандрівник');
    $('pm-achiev').innerHTML=achiev.length
      ?'<div class="pm-achiev-title">🏅 Досягнення</div>'
        +achiev.map(a=>`<span class="pm-achiev-badge">${a}</span>`).join('')
      :'';
    // friend/message buttons
    const friendBtn=$('pm-add-friend-btn');
    if(isMe){
      if(friendBtn)friendBtn.style.display='none';
    }else{
      const friends=P.friends||[];
      const alreadyFriend=friends.includes(playerId);
      if(friendBtn){
        friendBtn.style.display='block';
        friendBtn.textContent=alreadyFriend?'✅ Вже в друзях':'👤+ Додати в друзі';
        friendBtn.disabled=alreadyFriend;
      }
    }
  }catch(e){notify('❌ Помилка',e.message);modal.style.display='none';}
};
window.closePlayerModal=function(){$('player-modal').style.display='none';viewingPlayerId=null;};
window.addFriend=function(){
  if(!viewingPlayerId||viewingPlayerId===uid)return;
  P.friends=P.friends||[];
  if(P.friends.includes(viewingPlayerId)){notify('✅ Вже в друзях','Цей гравець вже у вашому списку друзів!');return;}
  P.friends.push(viewingPlayerId);
  saveP();notify('👤 Додано!','Гравця додано у друзі!');
  const btn=$('pm-add-friend-btn');if(btn){btn.textContent='✅ Вже в друзях';btn.disabled=true;}
};
window.openMessageTo=function(){
  // pre-fill compose with player's nickname
  closePlayerModal();
  goPage('mail');
  setTimeout(async()=>{
    showCompose();
    if(viewingPlayerId||$('pm-nick')){
      // get nickname from modal text
      const nick=($('pm-nick')?.textContent||'').replace('@','');
      if($('cm-to'))$('cm-to').value=nick;
    }
  },100);
};
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
  $('cm-to').value=(msg.from||'').replace(' 🐱','');$('cm-subj').value='Re: '+(msg.subj||'');
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

// ── GIFTS ─────────────────────────────────────────────
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
          <div style="font-size:.7rem;color:var(--tl);font-weight:700">${g.name} · ${g.time}</div></div></div>`
        ).join('')
      :'<div class="loading-inline">Немає подарунків</div>';
  }
  const gp=$('gift-picker');
  if(gp){gp.innerHTML=GIFT_CATALOG.map(g=>`<div class="gift-opt" id="gopt-${g.id}" onclick="selectGift('${g.id}')">
    <span class="go-icon">${g.icon}</span><span class="go-name">${g.name}</span>
    <span class="go-cost">🪙${g.cost}</span></div>`).join('');}
  selectedGift=null;
  $('gifts-modal').style.display='flex';
};
window.closeGifts=function(){$('gifts-modal').style.display='none';};
window.selectGift=function(id){
  selectedGift=id;
  document.querySelectorAll('.gift-opt').forEach(el=>el.classList.remove('selected'));
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

// ── FIX #9: CHAT — persistent, nickname-signed ─────────
function startChat(){
  const box=$('chat-msgs');if(!box)return;
  box.innerHTML='<div class="loading-inline">Завантаження чату...</div>';
  if(chatUnsub){chatUnsub();chatUnsub=null;}
  try{
    const q=query(collection(db,'chat'),orderBy('ts','asc'),limit(100));
    chatUnsub=onSnapshot(q,snap=>{
      if(snap.docChanges().some(ch=>ch.type==='added'&&snap.docChanges().length===snap.docs.length)){
        // initial load
        box.innerHTML='';
        snap.docs.forEach(docSnap=>{
          const d=docSnap.data();
          addChatMsg(d.nickname||'?',d.catname||'',d.text||'',d.uid===uid,d.ts);
        });
      }else{
        snap.docChanges().forEach(ch=>{
          if(ch.type==='added'){
            const d=ch.doc.data();
            addChatMsg(d.nickname||'?',d.catname||'',d.text||'',d.uid===uid,d.ts);
          }
        });
      }
    },e=>console.warn('chat:',e));
  }catch(e){$('chat-msgs').innerHTML='<div class="loading-inline">Помилка чату</div>';}
}
function addChatMsg(nickname,catname,text,isMine,ts){
  const box=$('chat-msgs');if(!box)return;
  const div=document.createElement('div');div.className='msg '+(isMine?'mine':'theirs');
  const t=ts?.toDate?ts.toDate().toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'}):now();
  const displayName=catname?`${esc(catname)} <span style="font-size:.6rem;opacity:.7">@${esc(nickname)}</span>`:`@${esc(nickname)}`;
  div.innerHTML=`<div class="msg-sender ${isMine?'msg-sender-mine':''}">${displayName}</div>
    <div class="msg-bubble">${esc(text)}</div><div class="msg-meta">${t}</div>`;
  box.appendChild(div);box.scrollTop=box.scrollHeight;
}
window.sendChat=async function(){
  const inp=$('chat-in');const text=inp.value.trim();if(!text)return;inp.value='';
  try{
    await addDoc(collection(db,'chat'),{
      uid,
      nickname:P.nickname||'?',
      catname:P.catname||'Котик',
      text,
      ts:serverTimestamp()
    });
  }catch(e){console.error('sendChat:',e);}
};

// ══════════════════════════════════════════════════════
//  FIX #4: TASKS SYSTEM
// ══════════════════════════════════════════════════════
const TASKS_DEF = [
  // Daily
  { id:'daily_feed',    cat:'daily',  icon:'🍖', title:'Нагодуй котика',         desc:'Погодуй котика 3 рази',           goal:3,  reward:{coins:20, xp:15},  track:'feedCount' },
  { id:'daily_water',   cat:'daily',  icon:'💧', title:'Напій котика',            desc:'Напій котика 3 рази',             goal:3,  reward:{coins:15, xp:10},  track:'waterCount' },
  { id:'daily_play',    cat:'daily',  icon:'🎾', title:'Пограй з котиком',        desc:'Пограй 2 рази',                   goal:2,  reward:{coins:25, xp:20},  track:'playCount' },
  { id:'daily_pet',     cat:'daily',  icon:'🐾', title:'Погладь котика',          desc:'Погладь 5 разів',                 goal:5,  reward:{coins:10, xp:8},   track:'petCount' },
  { id:'daily_walk',    cat:'daily',  icon:'🌳', title:'Прогулянка дня',          desc:'Відправ котика на прогулянку',    goal:1,  reward:{coins:50, xp:30},  track:'walkDone' },
  { id:'daily_chat',    cat:'daily',  icon:'💬', title:'Спілкування',             desc:'Напиши 3 повідомлення в чат',     goal:3,  reward:{coins:15, xp:10},  track:'chatCount' },
  // Weekly
  { id:'week_show',     cat:'weekly', icon:'🏆', title:'Учасник виставки',        desc:'Візьми участь у 3 виставках',     goal:3,  reward:{coins:200, xp:100, hearts:50}, track:'showCount' },
  { id:'week_train',    cat:'weekly', icon:'🏋️', title:'Тренування тижня',       desc:'Тренуй навик 5 разів',            goal:5,  reward:{coins:150, xp:80, hearts:30},  track:'trainCount' },
  { id:'week_gems',     cat:'weekly', icon:'💎', title:'Колекціонер',            desc:'Збери 10 частин коштовностей',    goal:10, reward:{coins:100, xp:60, hearts:20},  track:'gemsCollected' },
  { id:'week_walk3',    cat:'weekly', icon:'🌲', title:'Мандрівник',             desc:'Зроби 5 прогулянок',              goal:5,  reward:{coins:300, xp:150},             track:'walkTotal' },
  { id:'week_donate',   cat:'weekly', icon:'🐷', title:'Щедрість',               desc:'Поповни копилку клубу 3 рази',    goal:3,  reward:{coins:100, xp:50, hearts:100},  track:'donateCount' },
  // Achievements
  { id:'ach_level5',    cat:'achiev', icon:'⬆️', title:'Рівень 5',               desc:'Досягни 5 рівня',                 goal:5,  reward:{coins:500, xp:0, hearts:200},  track:'level', once:true },
  { id:'ach_level10',   cat:'achiev', icon:'🌟', title:'Рівень 10',              desc:'Досягни 10 рівня',                goal:10, reward:{coins:2000, xp:0, hearts:500}, track:'level', once:true },
  { id:'ach_beauty50',  cat:'achiev', icon:'🦋', title:'Красуня',                desc:'Набери 50 одиниць краси',         goal:50, reward:{coins:500, xp:200},             track:'butterflies', once:true },
  { id:'ach_walks10',   cat:'achiev', icon:'🥾', title:'Мандрівник',             desc:'Зроби 10 прогулянок загалом',    goal:10, reward:{coins:300, xp:100},             track:'walkTotal', once:true },
  { id:'ach_club',      cat:'achiev', icon:'🎈', title:'Учасник клубу',           desc:'Вступи до клубу',                 goal:1,  reward:{coins:200, xp:100, hearts:50},  track:'clubJoined', once:true },
  { id:'ach_gems5',     cat:'achiev', icon:'💎', title:'Збирач скарбів',         desc:'Зберися 5 повних каменів',        goal:5,  reward:{coins:400, xp:150},             track:'gemsAssembled', once:true },
  { id:'ach_house3',    cat:'achiev', icon:'🏠', title:'Хороший дім',            desc:'Покращи будинок до 3 рівня',      goal:3,  reward:{coins:600, xp:200},             track:'houseLevel', once:true },
  { id:'ach_chat50',    cat:'achiev', icon:'💬', title:'Балакучий',              desc:'Надішли 50 повідомлень у чат',    goal:50, reward:{coins:300, xp:100},             track:'chatCount', once:true },
];

// Init tasks state
function initTasks(){
  if(!P.tasks){
    P.tasks={
      progress:{},    // track -> count
      completed:{},   // taskId -> true (daily/weekly reset each day/week)
      claimed:{},     // taskId -> true (achievements, permanent)
      lastDailyReset: new Date().toDateString(),
      lastWeeklyReset: getWeekKey(),
    };
  }
  // Reset daily tasks
  const today = new Date().toDateString();
  if(P.tasks.lastDailyReset !== today){
    TASKS_DEF.filter(t=>t.cat==='daily').forEach(t=>{ delete P.tasks.completed[t.id]; });
    P.tasks.progress.feedCount=0;P.tasks.progress.waterCount=0;
    P.tasks.progress.playCount=0;P.tasks.progress.petCount=0;
    P.tasks.progress.walkDone=0;P.tasks.progress.chatCount=0;
    P.tasks.lastDailyReset=today;
  }
  // Reset weekly tasks
  const wk = getWeekKey();
  if(P.tasks.lastWeeklyReset !== wk){
    TASKS_DEF.filter(t=>t.cat==='weekly').forEach(t=>{ delete P.tasks.completed[t.id]; });
    P.tasks.progress.showCount=0;P.tasks.progress.trainCount=0;
    P.tasks.progress.gemsCollected=0;P.tasks.progress.donateCount=0;
    P.tasks.lastWeeklyReset=wk;
  }
}
function getWeekKey(){
  const d=new Date();const jan1=new Date(d.getFullYear(),0,1);
  return d.getFullYear()+'-W'+Math.ceil(((d-jan1)/86400000+jan1.getDay()+1)/7);
}

// Track progress
function trackTask(key, amount=1){
  if(!P.tasks)initTasks();
  P.tasks.progress[key]=(P.tasks.progress[key]||0)+amount;
  // check completions
  TASKS_DEF.forEach(t=>{
    if(t.track!==key)return;
    if(P.tasks.completed[t.id]||P.tasks.claimed[t.id])return;
    const val = t.track==='level'?(P.level||1):
                t.track==='houseLevel'?(P.houseLevel||1):
                t.track==='butterflies'?(P.butterflies||0):
                (P.tasks.progress[t.track]||0);
    if(val>=t.goal){
      P.tasks.completed[t.id]=true;
      notify('✅ Завдання виконано!',t.icon+' '+t.title+' — забери нагороду!',4000);
    }
  });
  saveP();
}

window.claimTask=function(taskId){
  if(!P.tasks)initTasks();
  const t=TASKS_DEF.find(x=>x.id===taskId);if(!t)return;
  if(!P.tasks.completed[taskId]&&!isMet(t)){notify('❌ Не виконано','Спочатку виконай завдання!');return;}
  if(t.once&&P.tasks.claimed[taskId]){notify('✅ Вже отримано','Нагороду вже забрано!');return;}
  // Give rewards
  if(t.reward.coins) P.coins=(P.coins||0)+t.reward.coins;
  if(t.reward.hearts) P.hearts=cl((P.hearts||0)+t.reward.hearts,0,999999);
  if(t.reward.xp && t.reward.xp>0) gainXP(t.reward.xp);
  const rewardStr=Object.entries(t.reward).filter(([k,v])=>v>0).map(([k,v])=>
    ({coins:'🪙 '+v,xp:'⭐ '+v+' XP',hearts:'❤️ '+v})[k]).join(' · ');
  notify('🎁 Нагорода!',t.icon+' '+t.title+' · '+rewardStr,4000);
  addLog('Завдання "'+t.title+'" виконано! Нагорода: '+rewardStr);
  if(t.once) P.tasks.claimed[taskId]=true;
  P.tasks.completed[taskId]=false; // reset for repeatable
  renderTasks();render();saveP();
};

function isMet(t){
  const val = t.track==='level'?(P.level||1):
              t.track==='houseLevel'?(P.houseLevel||1):
              t.track==='butterflies'?(P.butterflies||0):
              (P.tasks?.progress?.[t.track]||0);
  return val>=t.goal;
}

function getProgress(t){
  return t.track==='level'?(P.level||1):
         t.track==='houseLevel'?(P.houseLevel||1):
         t.track==='butterflies'?(P.butterflies||0):
         (P.tasks?.progress?.[t.track]||0);
}

// Render tasks page
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
  list.innerHTML=tasks.map(t=>{
    const prog=getProgress(t);
    const pct=Math.min(100,Math.round(prog/t.goal*100));
    const done=P.tasks.completed[t.id]||isMet(t);
    const claimed=t.once&&P.tasks.claimed[t.id];
    const rewardStr=Object.entries(t.reward).filter(([k,v])=>v>0)
      .map(([k,v])=>({coins:'🪙'+v,xp:'⭐'+v,hearts:'❤️'+v})[k]).join(' ');
    return `<div class="task-card ${done?'task-done':''} ${claimed?'task-claimed':''}">
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
  // Stats summary
  const total=tasks.length;
  const done=tasks.filter(t=>isMet(t)||P.tasks.completed[t.id]).length;
  const el=$('tasks-summary');
  if(el)el.textContent=done+'/'+total+' завдань виконано';
}

// Hook task tracking into existing actions
const _origAct=window.act;
window.act=function(type){
  _origAct(type);
  if(!P?.tasks)return;
  if(type==='feed')trackTask('feedCount');
  if(type==='water')trackTask('waterCount');
  if(type==='play')trackTask('playCount');
};

const _origPet=window.petCat;
window.petCat=function(){
  _origPet();
  trackTask('petCount');
};

const _origSendChat=window.sendChat;
window.sendChat=async function(){
  await _origSendChat();
  trackTask('chatCount');
};

const _origTrain=window.trainSkill;
window.trainSkill=function(sk){
  _origTrain(sk);
  trackTask('trainCount');
};

const _origCollect=window.collectGem;
window.collectGem=function(g,cost){
  _origCollect(g,cost);
  trackTask('gemsCollected');
};

const _origAssemble=window.assembleGem;
window.assembleGem=function(g,icon){
  _origAssemble(g,icon);
  trackTask('gemsAssembled');
};

const _origDonate=window.donateClub;
window.donateClub=async function(){
  await _origDonate();
  trackTask('donateCount');
};

const _origEnterShow=window.enterShow;
window.enterShow=function(catId){
  _origEnterShow(catId);
  trackTask('showCount');
};

const _origJoinClub=window.joinClub;
window.joinClub=async function(clubId){
  await _origJoinClub(clubId);
  trackTask('clubJoined');
};

const _origUpgradeHouse=window.upgradeHouse;
window.upgradeHouse=function(){
  _origUpgradeHouse();
  trackTask('houseLevel', 0); // just re-check level
};

// Hook into walk finish
const _origFinish=finishWalk;
// (finishWalk is internal — we patch it differently)
// Track walks via walkTotal in P directly
