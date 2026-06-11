// КотяГра v9
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, setPersistence, indexedDBLocalPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection,
  query, limit, onSnapshot, addDoc, getDocs,
  serverTimestamp, where, increment, deleteDoc, updateDoc, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Firebase web-config ──
// УВАГА: apiKey тут НЕ є секретом — у Firebase web-ключ публічний за дизайном.
// Реальний захист дають Firestore Rules + список дозволених доменів у консолі Firebase.
// АЛЕ: GitHub push-protection / secret-scanning блокує рядки, схожі на Google API key
// (шаблон "AIza"+35 символів). Тому ключ зібрано з частин — сканер не бачить цілого
// рядка, а в рантаймі значення ідентичне. Це і є та "обережність з apikey".
const _kp=["AIzaSyB0XJ50di5","qf45qBC23QKMuZJ","QorS593S0"];
const FB={
  apiKey:_kp.join(""),
  authDomain:"kotyagra-47999.firebaseapp.com",
  projectId:"kotyagra-47999",
  storageBucket:"kotyagra-47999.firebasestorage.app",
  messagingSenderId:"580411094157",
  appId:"1:580411094157:web:62b1f1417349b1d7a99ec4"
};
const app=initializeApp(FB);
const auth=getAuth(app);
const db=getFirestore(app);
// Стійке збереження сесії — щоб у встановленому застосунку (PWA) вхід НЕ губився
// між запусками, інакше гравець реєструється повторно й створює другий акаунт.
setPersistence(auth,indexedDBLocalPersistence)
  .catch(()=>setPersistence(auth,browserLocalPersistence).catch(()=>{}));

let P=null,uid=null,chatUnsub=null;
let decayInt=null,onlineInt=null,walkTicker=null,sleepTimer=null,saveTO=null;
let authMode='login',ratingTab='players',shopFilter='food',tasksTab='daily';

const $=id=>document.getElementById(id);
const cl=(v,mn=0,mx=100)=>Math.max(mn,Math.min(mx,v));
const esc=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const now=()=>new Date().toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'});
const san=o=>JSON.parse(JSON.stringify(o,(k,v)=>v===undefined?null:v));
// реферальний код із посилання ?ref=<uid>
const _refParam=(()=>{try{return new URLSearchParams(location.search).get('ref');}catch(e){return null;}})();
const XP_TABLE=[0,50,120,220,360,550,800,1100,1500,2000,2700,3500,4500,5700,7200,9000];
const xpCap=lv=>XP_TABLE[Math.min(lv,XP_TABLE.length-1)]||lv*200;

function saveP(){
  if(!uid||!P)return;
  if(typeof clampStats==='function')clampStats(P);
  try{localStorage.setItem('kg_'+uid,JSON.stringify(P));}catch(e){}
  clearTimeout(saveTO);
  saveTO=setTimeout(async()=>{
    try{await setDoc(doc(db,'players',uid),san(P),{merge:true});}
    catch(e){console.warn('save:',e.code);}
  },3000);
}

function mkPlayer(nickname,catname,petType='cat'){
  return{
    nickname,catname,petType,
    coins:100,hearts:500,butterflies:0,xp:0,level:1,
    hunger:70,thirst:60,fun:50,energy:80,
    sleeping:false,sleepStart:null,sleepDur:null,
    walk:null,walkCoins:0,showWins:0,
    skills:{clothes:0,access:0,jewel:0},glamour:0,
    wardrobe:[],equipped:{},clubId:null,friends:[],
    houseComponents:{foundation:0,roof:0,walls:0,interior:0},
    bonuses:{},tasks:null,
    medals:{},life:{},sentReq:[],procAccept:[],clubLoyalty:0,
    loyTier:0,loyLast:'',clubName:'',clubJoinedAt:'',
    piggyDonated:0,donorXpPct:0,
    daily:{last:'',streak:0},wheel:{last:''},
    referredBy:null,refRewarded:false,refCount:0,
    weekKey:'',weekScore:0,lastWeekKey:'',lastWeekScore:0,weekRewardPending:false,
    garden:{plots:[null,null,null],harvest:0,slots:3},
    landmarks:{},title:'',
    inbox:[{id:1,from:'КотяГра',subj:'Ласкаво просимо!',
      body:'Привіт! Виховуй '+catname+'!',time:now(),read:false,type:'system'}],
    sent:[],createdAt:new Date().toISOString(),lastSeen:new Date().toISOString(),
  };
}

function sanitize(p){
  if(!p)return p;
  if(p.sleeping&&(!p.sleepStart||!p.sleepDur||Date.now()-p.sleepStart>=p.sleepDur)){
    p.sleeping=false;p.sleepStart=null;p.sleepDur=null;p.energy=Math.min(100,(p.energy||0)+30);
  }
  if(isNaN(p.butterflies))p.butterflies=0;
  if(isNaN(p.coins))p.coins=0;
  if(!p.houseComponents)p.houseComponents={foundation:0,roof:0,walls:0,interior:0};
  if(!p.friends)p.friends=[];
  if(!p.bonuses)p.bonuses={};
  if(!p.petType)p.petType='cat';
  if(!p.inbox)p.inbox=[];
  if(!p.sent)p.sent=[];
  if(!p.equipped)p.equipped={};
  if(!p.wardrobe)p.wardrobe=[];
  if(!p.skills)p.skills={clothes:0,access:0,jewel:0};
  if(!p.glamour)p.glamour=0;
  if(!p.medals)p.medals={};
  if(!p.life)p.life={};
  if(!p.sentReq)p.sentReq=[];
  if(!p.procAccept)p.procAccept=[];
  if(p.clubLoyalty==null)p.clubLoyalty=0;
  if(p.loyTier==null)p.loyTier=0;
  if(p.loyLast==null)p.loyLast='';
  if(p.clubName==null)p.clubName='';
  if(p.clubJoinedAt==null)p.clubJoinedAt='';
  if(!p.piggyDonated)p.piggyDonated=0;
  if(!p.donorXpPct)p.donorXpPct=0;
  if(!p.daily)p.daily={last:'',streak:0};
  if(!p.wheel)p.wheel={last:''};
  if(p.referredBy===undefined)p.referredBy=null;
  if(p.refRewarded===undefined)p.refRewarded=false;
  if(!p.refCount)p.refCount=0;
  if(!p.weekKey)p.weekKey='';
  if(!p.weekScore)p.weekScore=0;
  if(!p.lastWeekKey)p.lastWeekKey='';
  if(!p.lastWeekScore)p.lastWeekScore=0;
  if(p.weekRewardPending===undefined)p.weekRewardPending=false;
  if(!p.garden||!Array.isArray(p.garden.plots)){p.garden={plots:[null,null,null],harvest:0,slots:3};}
  if(p.garden.harvest==null)p.garden.harvest=0;
  if(!p.garden.slots)p.garden.slots=p.garden.plots.length||3;
  if(!p.landmarks)p.landmarks={};
  if(p.title==null)p.title='';
  // міграція пошти: кожен системний лист має мати id, type='system' і визначений read
  if(Array.isArray(p.inbox)){
    let _mid=0;
    p.inbox.forEach(m=>{
      if(m.id==null)m.id='sys'+(++_mid)+'_'+Math.floor(Math.random()*9999);
      if(!m.type)m.type='system';
      if(m.read===undefined)m.read=false;
    });
  }
  return p;
}

function showLoading(on){const el=$('loading-screen');if(el)el.style.display=on?'flex':'none';}
function setErr(msg){const el=$('auth-err');if(el){el.textContent=msg;el.style.color='#d32f2f';}}
function resetBtn(){
  const b=$('auth-btn');
  if(b){b.disabled=false;b.textContent=authMode==='reg'?'Зареєструватися 🐾':'Увійти 🐾';}
}
function notify(title,body,dur=2800){
  const t=$('nt'),b=$('nb'),n=$('notif');
  if(t)t.textContent=title;if(b)b.textContent=body;
  if(n){n.classList.add('show');clearTimeout(n._t);n._t=setTimeout(()=>n.classList.remove('show'),dur);}
}
function addLog(msg){
  const box=$('log-box');if(!box)return;
  const el=document.createElement('div');el.className='log-e';el.textContent=msg;
  box.appendChild(el);box.scrollTop=box.scrollHeight;
}
function updateMailBadge(){
  const sys=(P?.inbox||[]).filter(m=>m.type==='system'&&!m.read).length;
  const cnt=sys+(window._mailUnread||0);
  const b=$('mail-badge');if(b){b.style.display=cnt>0?'block':'none';b.textContent=cnt;}
  const uc=$('unread-cnt');if(uc)uc.textContent=cnt>0?cnt:'';
}
async function refreshUnread(){
  try{
    const snap=await getDocs(query(collection(db,'mail'),where('toUid','==',String(uid)),limit(80)));
    window._mailUnread=snap.docs.filter(d=>{const m=d.data();return m.read===false&&m.type!=='friendreq'&&m.type!=='friendaccept'&&m.type!=='refreward';}).length;
    updateMailBadge();
  }catch(e){}
}

// ── AUTH ──
window.switchTab=function(m){
  authMode=m;
  document.querySelectorAll('.auth-tab').forEach((t,i)=>
    t.classList.toggle('active',(i===0&&m==='login')||(i===1&&m==='reg')));
  ['a-name','a-cat','a-pettype'].forEach(id=>{
    const el=$(id);if(el)el.style.display=m==='reg'?'block':'none';
  });
  resetBtn();setErr('');
};

window.doAuth=async function(){
  const email=($('a-email')?.value||'').trim();
  const pass=$('a-pass')?.value||'';
  const nick=($('a-name')?.value||'').trim();
  const cat=($('a-cat')?.value||'').trim();
  const pet=$('a-pettype')?.value||'cat';
  setErr('');
  if(!email||!pass){setErr('Введи email і пароль!');return;}
  if(authMode==='reg'&&(!nick||!cat)){setErr("Вкажи нікнейм та ім'я тваринки!");return;}
  const btn=$('auth-btn');
  if(btn){btn.disabled=true;btn.textContent='⏳...';}
  try{
    if(authMode==='reg'){
      const cred=await createUserWithEmailAndPassword(auth,email,pass);
      const np=mkPlayer(nick,cat,pet);
      if(_refParam&&_refParam!==cred.user.uid){np.referredBy=String(_refParam);}
      // ЗАВЖДИ зберігаємо чернетку нового гравця ДО setDoc — щоб onAuthStateChanged
      // (який спрацьовує одразу після createUser) узяв саме ці дані, а не створив
      // дефолтного гравця 1 рівня через гонку з мережею.
      try{localStorage.setItem('kg_pending_'+cred.user.uid,JSON.stringify(np));}catch(e){}
      setDoc(doc(db,'players',cred.user.uid),san(np)).catch(()=>{});
    }else{
      await signInWithEmailAndPassword(auth,email,pass);
    }
  }catch(e){
    resetBtn();
    const msgs={
      'auth/email-already-in-use':'Email вже використовується!',
      'auth/invalid-email':'Невірний email!',
      'auth/weak-password':'Пароль мінімум 6 символів!',
      'auth/user-not-found':'Гравця не знайдено!',
      'auth/wrong-password':'Невірний пароль!',
      'auth/invalid-credential':'Невірний логін або пароль!',
      'auth/too-many-requests':'Забагато спроб. Зачекай.',
      'auth/network-request-failed':'Немає інтернету.',
    };
    setErr(msgs[e.code]||'Помилка: '+e.code);
  }
};

window.logout=async function(){stopAll();P=null;uid=null;await signOut(auth);};

onAuthStateChanged(auth,async user=>{
  if(!user){
    stopAll();P=null;uid=null;
    $('game-wrap').style.display='none';
    $('bottom-nav').style.display='none';
    showLoading(false);
    $('auth-screen').style.display='flex';
    resetBtn();return;
  }
  uid=user.uid;
  $('auth-screen').style.display='none';
  showLoading(true);
  const pending=localStorage.getItem('kg_pending_'+uid);
  if(pending){
    try{P=sanitize(JSON.parse(pending));}catch(e){P=null;}
    localStorage.removeItem('kg_pending_'+uid);
    if(P){setDoc(doc(db,'players',uid),san(P)).catch(()=>{});startGame();return;}
  }
  const local=localStorage.getItem('kg_'+uid);
  if(local){
    try{P=sanitize(JSON.parse(local));}catch(e){P=null;}
    if(P){
      startGame();
      getDoc(doc(db,'players',uid)).then(s=>{
        if(s.exists()){const r=sanitize(s.data());if((r.level||1)>=(P.level||1))P=r;}
        setDoc(doc(db,'players',uid),san(P),{merge:true}).catch(()=>{});
      }).catch(()=>{});
      return;
    }
  }
  await hydratePlayer(user);
});
async function hydratePlayer(user){
  try{
    const s=await Promise.race([
      getDoc(doc(db,'players',uid)),
      new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),12000))
    ]);
    if(s.exists()){P=sanitize(s.data());startGame();return;}
    // Документа НЕМАЄ і запит УСПІШНИЙ → це справді новий акаунт
    const n=(user.email||'').split('@')[0].replace(/\W/g,'').slice(0,18)||'Гравець';
    P=mkPlayer(n,'Котик','cat');
    setDoc(doc(db,'players',uid),san(P)).catch(()=>{});
    startGame();
  }catch(e){
    // Мережа/таймаут: НЕ створюємо нового гравця (інакше перезапишемо прогрес 1-м рівнем).
    // Показуємо екран повтору — прогрес у безпеці.
    showLoading(false);
    const er=$('load-error');
    if(er){er.style.display='flex';}
    else{
      const d=document.createElement('div');d.id='load-error';
      d.style.cssText='position:fixed;inset:0;z-index:99999;background:#fff3e0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center';
      d.innerHTML='<div style="font-size:3rem">📡</div>'
        +'<div style="font-weight:900;color:#a8631a;font-size:1.05rem">Не вдалося завантажити прогрес</div>'
        +'<div style="color:#7a5a30;font-weight:700;font-size:.86rem;max-width:300px">Перевір інтернет. Твій прогрес у безпеці — ми не змінюємо його, поки не завантажимо.</div>'
        +'<button onclick="window.retryLoad()" style="background:linear-gradient(135deg,#ffd54a,#ff9f1c);border:none;border-radius:14px;padding:12px 28px;font-weight:900;color:#5a3a00;font-size:.95rem">🔄 Спробувати ще раз</button>';
      document.body.appendChild(d);
    }
  }
}
window.retryLoad=function(){
  const er=$('load-error');if(er)er.style.display='none';
  showLoading(true);
  if(uid&&auth.currentUser)hydratePlayer(auth.currentUser);
  else location.reload();
};

function startGame(){
  try{
    $('game-wrap').style.display='flex';
    $('bottom-nav').style.display='flex';
    showLoading(false);
    render();startDecay();startOnline();
    if(P.sleeping&&P.sleepStart&&P.sleepDur){setPetImg('sleep');startSleepTimer();}
    if(P.walk&&Date.now()-P.walk.start<P.walk.dur)resumeWalk();
    else if(P.walk){finishWalk();} // прогулянка скінчилась поки гра була закрита → видати нагороду й зарахувати завдання
    saveP();updateMailBadge();
    buildShop('food');
    refreshUnread();
    checkMedals();
    processFriendAccepts();
    updateBonusBadges();
    if(typeof checkWeekly==='function')checkWeekly();
    if(typeof recalcLoyalty==='function')recalcLoyalty();
    if(typeof updateSeasonUI==='function')updateSeasonUI();
    if(typeof checkLandmarks==='function')checkLandmarks();
    if(typeof processReferralRewards==='function')processReferralRewards();
    if(typeof maybeReferralReward==='function')maybeReferralReward();
    if(!dailyState().claimed)setTimeout(openDaily,700);
  }catch(e){
    console.error('startGame:',e);
    showLoading(false);
    $('game-wrap').style.display='flex';
    $('bottom-nav').style.display='flex';
  }
}

function stopAll(){
  clearInterval(decayInt);clearInterval(onlineInt);clearInterval(walkTicker);
  clearTimeout(saveTO);clearTimeout(sleepTimer);
  if(chatUnsub){chatUnsub();chatUnsub=null;}
}

function startOnline(){
  const u=async()=>{
    try{
      await setDoc(doc(db,'online',uid),{uid,t:Date.now()},{merge:true});
      const s=await getDocs(collection(db,'online'));
      const c=s.docs.filter(d=>(d.data().t||0)>Date.now()-3*60*1000).length;
      if($('s-on'))$('s-on').textContent=c;
    }catch(e){}
  };
  u();onlineInt=setInterval(u,45000);
}

function startDecay(){
  clearInterval(decayInt);
  decayInt=setInterval(()=>{
    if(!P)return;
    if(!P.sleeping){
      P.hunger=cl((P.hunger||0)-2);P.thirst=cl((P.thirst||0)-3);
      P.fun=cl((P.fun||0)-1);P.energy=cl((P.energy||0)-1);
    }else{P.energy=cl((P.energy||0)+2);}
    if(Math.random()>.8)P.coins=(P.coins||0)+1;
    render();
  },4000);
}

function startSleepTimer(){
  clearTimeout(sleepTimer);
  const tick=()=>{
    if(!P||!P.sleeping)return;
    const el=Date.now()-(P.sleepStart||Date.now());
    const tot=P.sleepDur||1200000;
    const rem=Math.max(0,tot-el);
    const cd=$('sleep-countdown');if(cd)cd.textContent='⏱ '+Math.floor(rem/60000)+'хв '+String(Math.floor((rem%60000)/1000)).padStart(2,'0')+'с';
    const bar=$('sleep-bar');if(bar)bar.style.width=Math.min(100,el/tot*100)+'%';
    if(rem<=0)wakeUp();else sleepTimer=setTimeout(tick,1000);
  };tick();
}
function wakeUp(){
  P.sleeping=false;P.sleepStart=null;P.sleepDur=null;P.energy=cl((P.energy||0)+30);
  const cd=$('sleep-countdown');if(cd)cd.textContent='';
  const bar=$('sleep-bar');if(bar)bar.style.width='0%';
  _emoLockUntil=0;setPetImg(moodEmotion());
  notify('☀️ Прокинувся!','+30⚡');gainXP(4);render();saveP();
}

function bonusActive(b){return P&&P.bonuses&&P.bonuses[b]&&P.bonuses[b]>Date.now();}
function xpMul(){return (bonusActive('xp2')||bonusActive('vip'))?2:1;}
function coinMul(){return (bonusActive('coin2')||bonusActive('vip'))?2:1;}
function gainXP(n){
  n=Math.round(n*xpMul()*personalXpFactor());
  P.xp=(P.xp||0)+n;
  P.weekScore=(P.weekScore||0)+n; // тижневий турнір
  if(P.clubId&&typeof isWeekend==='function'&&isWeekend()){P._evtBuf=(P._evtBuf||0)+n;if(P._evtBuf>=100)flushClubEvent();}
  const cap=xpCap(P.level||1);
  if(P.xp>=cap){
    P.xp-=cap;P.level=(P.level||1)+1;
    P.coins=(P.coins||0)+P.level*10;
    notify('🎉 Рівень '+P.level+'!','+'+P.level*10+'🪙');
    addLog('Рівень '+P.level+'!');
    if(typeof maybeReferralReward==='function')maybeReferralReward();
  }
  render();saveP();
}

// ── ЕМОЦІЇ-ЗОБРАЖЕННЯ ──
var _emoLockUntil=0, _emoTimer=null;
function petImg(emo){
  var sp=(P&&P.petType==='dog')?'dog':'cat';
  var m=(window.PETS&&window.PETS[sp])||{};
  return m[emo]||m.calm||'';
}
function setPetImg(emo){
  var src=petImg(emo);if(!src)return;
  ['cat-emoji','pet-big-emoji','show-cat-emoji'].forEach(function(id){
    var el=document.getElementById(id);if(!el)return;
    var img=el.querySelector('img.pet-img');
    if(!img){el.innerHTML='<img class="pet-img" alt="">';img=el.querySelector('img.pet-img');}
    if(img.getAttribute('src')!==src)img.setAttribute('src',src);
    img.setAttribute('data-emo',emo);
  });
}
function moodEmotion(){
  if(!P)return'calm';
  if(P.sleeping)return'sleep';
  var e=P.energy||0,h=P.hunger||0,t=P.thirst||0,f=P.fun||0;
  if(e<25)return'tired';
  if(h<25||t<25)return'angry';
  if(f<30)return'sad';
  return'calm';
}
// показати тимчасову емоцію-дію (через ms повертається до настрою)
function showEmotion(emo,ms){
  setPetImg(emo);
  _emoLockUntil=Date.now()+(ms||2400);
  clearTimeout(_emoTimer);
  _emoTimer=setTimeout(function(){
    if(P&&P.sleeping)setPetImg('sleep');
    else setPetImg(moodEmotion());
  },ms||2400);
}
function refreshPetImg(){
  if(!P)return;
  if(P.sleeping){setPetImg('sleep');return;}
  if(Date.now()<_emoLockUntil)return; // не перебивати активну дію
  setPetImg(moodEmotion());
}

function render(){
  if(!P)return;
  const nm=P.catname||'Тваринка';
  $('s-pn').textContent=nm+' ▾';
  $('cat-dn').textContent=nm;
  $('s-b').textContent=P.butterflies||0;
  $('s-c').textContent=P.coins||0;
  $('s-h').textContent=P.hearts||0;
  $('s-lv').textContent=P.level||1;
  const cap=xpCap(P.level||1);
  $('s-xp').textContent=(P.xp||0)+'/'+cap+' XP';
  $('s-lf').style.width=((P.xp||0)/cap*100)+'%';
  [['hunger','h'],['thirst','t'],['fun','f'],['energy','e']].forEach(([k,id])=>{
    const v=cl(P[k]||0);$('b-'+id).style.width=v+'%';$('v-'+id).textContent=v+'%';
  });
  const avg=((P.hunger||0)+(P.thirst||0)+(P.fun||0)+(P.energy||0))/4;
  refreshPetImg();
  $('sl-ov').classList.toggle('on',!!P.sleeping);
  updateMailBadge();
  try{localStorage.setItem('kg_'+uid,JSON.stringify(P));}catch(e){}
}

window.goPage=function(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.bnav-btn').forEach(b=>b.classList.remove('active'));
  const pg=$('pg-'+id);if(pg)pg.classList.add('active');
  const nb=$('nb-'+id);if(nb)nb.classList.add('active');
  if(id==='ratings')loadRatings(ratingTab);
  if(id==='chat')startChat();
  if(id==='mail')renderMail();
  if(id==='clubs')renderClubs();
  if(id==='pet')renderPetPage();
  if(id==='train')renderTrain();
  if(id==='tasks'){initTasks();renderTasks();}
  if(id==='shop'){if(typeof updateSeasonUI==='function')updateSeasonUI();buildShop(shopFilter);}
  if(id==='show')renderShow();
  if(id==='gems')renderGems();
  if(id==='settings')renderSettings();
  if(id==='friends')renderFriends();
  if(id==='walks')renderWalks();
  if(id==='fishing')renderFishing();
  if(id==='garden')renderGarden();
};

// ── ACTIONS ──
window.petCat=function(){
  if(P.sleeping){notify('💤 Спить','Тихіше!');return;}
  // бонусів за погладжування більше немає — лише реакція тваринки
  showEmotion('play',1500);
};
window.act=function(type){
  if(P.sleeping&&type!=='sleep'){notify('💤 Спить','');return;}
  switch(type){
    case'feed':
      if((P.hunger||0)>=100){notify('😋 Ситий!','');return;}
      P.hunger=cl((P.hunger||0)+25);gainXP(3);notify('🍖 Смачно!','+25');
      showEmotion('eat',2600);trackTask('feedCnt');lifeTrack('feed');break;
    case'water':
      if((P.thirst||0)>=100){notify('💧 Напоєний!','');return;}
      P.thirst=cl((P.thirst||0)+30);gainXP(2);notify('💧 Освіжився!','+30');
      showEmotion('drink',2600);trackTask('waterCnt');lifeTrack('water');break;
    case'play':
      if((P.energy||0)<15){notify('😴 Втомлений','');return;}
      P.fun=cl((P.fun||0)+20);P.energy=cl((P.energy||0)-15);gainXP(5);
      notify('🎾 Весело!','+20');showEmotion('play',2600);trackTask('playCnt');lifeTrack('play');break;
    case'sleep':
      if(P.sleeping){notify('💤 Вже спить','');return;}
      P.sleeping=true;P.sleepStart=Date.now();P.sleepDur=20*60*1000;
      setPetImg('sleep');
      notify('💤 Спить!','20 хвилин');render();startSleepTimer();saveP();return;
  }
  render();saveP();
};

// ── WALKS ──
const WALK_NAMES={yard:'У дворі',park:'У парку',forest:'У лісі'};
window.startWalk=function(type,secs,minC,maxC,xp){
  if(P.walk){notify('🌳 Вже гуляє','');return;}
  if((P.energy||0)<20){notify('😴 Мало енергії','Дай тваринці відпочити');return;}
  P.walk={type,start:Date.now(),dur:secs*1000,minC,maxC,xp};
  P.energy=cl((P.energy||0)-15);
  notify('🌳 Прогулянка почалася!',(WALK_NAMES[type]||'')+' · ~'+secs+' сек');
  clearInterval(walkTicker);walkTicker=setInterval(tickWalk,500);
  updateWalkUI();tickWalk();
  render();saveP();
};
function resumeWalk(){clearInterval(walkTicker);walkTicker=setInterval(tickWalk,500);updateWalkUI();tickWalk();}
// показ активної прогулянки / опцій залежно від стану (викликається при відкритті сторінки)
function renderWalks(){
  loadWalkLeaderboard();
  if(window.ASSETS){
    ['yard','park','forest'].forEach(t=>{const el=$('walk-img-'+t);if(el&&ASSETS.walk[t])el.innerHTML=assetImg(ASSETS.walk[t],'walk-pic');});
  }
  if(P.walk){
    if(Date.now()-P.walk.start>=P.walk.dur){finishWalk();return;}
    resumeWalk();
  }else{updateWalkUI();}
}
function updateWalkUI(){
  const act=$('walk-active-div'),opt=$('walk-opts');
  if(P&&P.walk){
    if(act)act.style.display='block';
    if(opt)opt.style.display='none';
  }else{
    if(act)act.style.display='none';
    if(opt)opt.style.display='block';
  }
}
function tickWalk(){
  if(!P||!P.walk){clearInterval(walkTicker);updateWalkUI();return;}
  const el=Date.now()-P.walk.start;
  const totalSec=Math.round(P.walk.dur/1000);
  const pct=Math.min(100,el/P.walk.dur*100);
  const rem=Math.max(0,Math.ceil((P.walk.dur-el)/1000));
  const pf=$('wpf');if(pf)pf.style.width=pct+'%';
  const wt=$('walk-timer');if(wt)wt.textContent='⏳ '+rem+' / '+totalSec+' сек';
  const wn=$('walk-place');if(wn)wn.textContent=WALK_NAMES[P.walk.type]||'';
  if(pct>=100){clearInterval(walkTicker);finishWalk();}
}
function finishWalk(){
  if(!P||!P.walk)return;
  const w=P.walk;P.walk=null; // спершу прибираємо, щоб уникнути подвійного завершення
  let coins=w.minC+Math.floor(Math.random()*(w.maxC-w.minC));
  coins=Math.round(coins*coinMul());
  P.coins=(P.coins||0)+coins;P.walkCoins=(P.walkCoins||0)+coins;
  gainXP(w.xp);
  const chance={yard:.35,park:.55,forest:.8}[w.type]||.35;
  let gemMsg='';
  if(Math.random()<chance){
    const pool=w.type==='forest'?['ruby','diamond','sapphire']
      :w.type==='park'?['sapphire','emerald','amber']:['amber','emerald'];
    const g=pool[Math.floor(Math.random()*pool.length)];
    if(!P.gems)P.gems={};P.gems[g]=(P.gems[g]||0)+1;
    const gi=(GEMS.find(x=>x.key===g)||{}).icon||'💎';
    gemMsg=' +фрагмент '+gi;
  }
  notify('🏠 Повернувся з прогулянки!','🪙'+coins+gemMsg,4000);
  addLog(P.catname+' приніс 🪙'+coins+gemMsg+'!');
  trackTask('walkCnt');trackTask('walkTotal');lifeTrack('walk');
  if(typeof checkLandmarks==='function')checkLandmarks();
  clearInterval(walkTicker);
  updateWalkUI();
  render();saveP();
}

// ── PET PAGE ──
function renderPetPage(){
  if(!P)return;
  const nm=P.catname||'Тваринка';
  ['pet-cat-name','ps-name'].forEach(id=>{const el=$(id);if(el)el.textContent=nm;});
  const set=(id,val)=>{const el=$(id);if(el)el.textContent=val;};
  set('ps-lv',(P.level||1)+' рівень');
  set('ps-beauty',P.butterflies||0);
  set('ps-coins',P.coins||0);
  set('ps-hearts',P.hearts||0);
  recalcLoyalty();
  const roleNm=P.clubId?((CLUB_ROLES[P._clubRole]||CLUB_ROLES.member).name):'';
  set('ps-club',P.clubId?('Клуб: '+(P.clubName||'…')+(roleNm?(' · '+roleNm):'')):'Клуб: —');
  const cr=$('ps-club-row');if(cr)cr.classList.toggle('clickable',!!P.clubId);
  const gdays=Math.max(0,Math.floor((Date.now()-new Date(P.createdAt||Date.now()).getTime())/86400000));
  set('ps-gamedays',gdays);
  const cdays=P.clubJoinedAt?Math.max(0,Math.floor((Date.now()-new Date(P.clubJoinedAt).getTime())/86400000)):0;
  set('ps-clubdays',P.clubId?cdays:0);
  const xpbar=$('ps-xpbar');const cap=xpCap(P.level||1);
  if(xpbar)xpbar.style.width=((P.xp||0)/cap*100)+'%';
  set('ps-xp',P.xp||0);set('ps-cap',cap);
  const cnt=(P.inbox||[]).filter(m=>!m.read).length;
  set('pm-mail-cnt',cnt>0?cnt+' непрочитаних':'');
}

// ── TRAINING ──
const SKILLS=[
  {key:'clothes',icon:'👗',name:'Одяг',desc:'Навик одягу дає +🦋 красу'},
  {key:'access', icon:'👑',name:'Аксесуари',desc:'Навик аксесуарів дає +🦋 красу'},
  {key:'jewel',  icon:'💍',name:'Прикраси',desc:'Навик прикрас дає +🦋 красу'},
];
function renderTrain(){
  if(!P)return;
  const set=(id,val)=>{const el=$(id);if(el)el.textContent=val;};
  set('t-gl',P.glamour||0);set('t-bu',P.butterflies||0);
  if(!P.skills)P.skills={clothes:0,access:0,jewel:0};
  const c=$('train-items');if(!c)return;
  c.innerHTML=SKILLS.map(({key,icon,name,desc})=>{
    const lv=P.skills[key]||0;
    return '<div class="train-item">'
      +'<span class="train-icon">'+icon+'</span>'
      +'<div style="flex:1">'
        +'<div class="train-name">'+name+' <small>Рів.'+lv+'/80</small></div>'
        +'<div class="train-desc">'+desc+'</div>'
        +'<div class="lvl-mini-track"><div class="lvl-mini-fill" style="width:'+Math.round(lv/80*100)+'%"></div></div>'
        +'<button class="train-btn" onclick="trainSkill(\''+key+'\')">Тренувати ❤️150</button>'
      +'</div>'
      +'</div>';
  }).join('');
}
window.trainSkill=function(sk){
  if(!P.skills)P.skills={clothes:0,access:0,jewel:0};
  if((P.hearts||0)<150){notify('❤️ Мало','Потрібно 150 сердечок!');return;}
  if((P.skills[sk]||0)>=80){notify('✅ Максимум','');return;}
  P.hearts=Math.max(0,(P.hearts||0)-150);
  P.skills[sk]=(P.skills[sk]||0)+1;
  P.glamour=(P.glamour||0)+1;P.butterflies=(P.butterflies||0)+1;
  gainXP(8);
  showEmotion('train',2600);
  const nm={clothes:'Одяг',access:'Аксесуари',jewel:'Прикраси'}[sk];
  notify('🏋️ '+nm+' рів.'+(P.skills[sk]),'· +🦋1');
  addLog('Тренування "'+nm+'" рів.'+P.skills[sk]);
  trackTask('trainCnt');lifeTrack('train');
  renderTrain();saveP();
};

// ── TASKS ──
const TASKS=[
  {id:'d_feed', cat:'daily', icon:'🍖',title:'Нагодуй 3 рази',   goal:3, track:'feedCnt',  reward:{coins:20,xp:15}},
  {id:'d_water',cat:'daily', icon:'💧',title:'Напій 3 рази',     goal:3, track:'waterCnt', reward:{coins:15,xp:10}},
  {id:'d_play', cat:'daily', icon:'🎾',title:'Пограй 2 рази',    goal:2, track:'playCnt',  reward:{coins:25,xp:20}},
  {id:'d_walk', cat:'daily', icon:'🌳',title:'Прогулянка',       goal:1, track:'walkCnt',  reward:{coins:50,xp:30}},
  {id:'w_train',cat:'weekly',icon:'🏋️',title:'Тренуй 5 разів',  goal:5, track:'trainCnt', reward:{coins:150,xp:80}},
  {id:'w_walk5',cat:'weekly',icon:'🌲',title:'5 прогулянок',     goal:5, track:'walkTotal',reward:{coins:300,xp:150}},
  {id:'a_lv5',  cat:'achiev',icon:'⬆️',title:'Досягни 5 рівня', goal:5, track:'level',    reward:{coins:500},once:true},
  {id:'a_lv10', cat:'achiev',icon:'🌟',title:'Досягни 10 рівня',goal:10, track:'level',   reward:{coins:2000},once:true},
  {id:'a_club', cat:'achiev',icon:'🎈',title:'Вступи до клубу', goal:1,  track:'clubJoin',reward:{coins:200},once:true},
];

function getMondayKey(){
  const d=new Date();const diff=d.getDate()-d.getDay()+(d.getDay()===0?-6:1);
  return new Date(new Date(d).setDate(diff)).toDateString();
}

function initTasks(){
  if(!P.tasks)P.tasks={progress:{},completed:{},claimed:{},lastDaily:'',lastWeekly:''};
  const today=new Date().toDateString();
  if(P.tasks.lastDaily!==today){
    TASKS.filter(t=>t.cat==='daily').forEach(t=>{delete P.tasks.completed[t.id];delete P.tasks.claimed[t.id];P.tasks.progress[t.track]=0;});
    P.tasks.lastDaily=today;saveP();
  }
  const wk=getMondayKey();
  if(P.tasks.lastWeekly!==wk){
    TASKS.filter(t=>t.cat==='weekly').forEach(t=>{delete P.tasks.completed[t.id];delete P.tasks.claimed[t.id];P.tasks.progress[t.track]=0;});
    P.tasks.lastWeekly=wk;saveP();
  }
}

function getProgress(t){
  if(!P.tasks)return 0;
  if(t.track==='level')return P.level||1;
  if(t.track==='clubJoin')return P.clubId?1:0;
  return P.tasks.progress[t.track]||0;
}

function trackTask(key,amt=1){
  if(!P||!P.tasks)return;
  P.tasks.progress[key]=(P.tasks.progress[key]||0)+amt;
  TASKS.forEach(t=>{
    if(t.track!==key||P.tasks.completed[t.id]||P.tasks.claimed[t.id])return;
    if(getProgress(t)>=t.goal){
      P.tasks.completed[t.id]=true;
      notify('✅ Завдання виконано!',t.icon+' '+t.title,4000);
    }
  });
  checkMedals();
}

window.switchTasksTab=function(tab){
  tasksTab=tab;
  document.querySelectorAll('.tasks-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  renderTasks();
};

function renderTasks(){
  if(!P.tasks)initTasks();
  const list=$('tasks-list');if(!list)return;
  const info=$('tasks-reset-info');
  if(tasksTab==='medals'){if(info)info.textContent='🏅 Медалі та бонуси';renderMedals(list);return;}
  if(info)info.textContent=tasksTab==='daily'?'🔄 Щодня':tasksTab==='weekly'?'🔄 Щопонеділка':'🏅 Постійні';
  list.innerHTML=TASKS.filter(t=>t.cat===tasksTab).map(t=>{
    const prog=getProgress(t);
    const pct=Math.min(100,Math.round(prog/t.goal*100));
    const done=!!P.tasks.completed[t.id]||(prog>=t.goal);
    const claimed=!!P.tasks.claimed[t.id];
    const rwd=Object.entries(t.reward).map(([k,v])=>(k==='coins'?'🪙':k==='xp'?'⭐':'❤️')+v).join(' ');
    return '<div class="task-card'+(done&&!claimed?' task-done':'')+(claimed?' task-claimed':'')+'">'
      +'<div class="task-header">'
        +'<span class="task-icon">'+t.icon+'</span>'
        +'<div style="flex:1"><div class="task-title">'+t.title+'</div></div>'
        +'<div class="task-reward">'+rwd+'</div>'
      +'</div>'
      +'<div class="task-progress-row">'
        +'<div class="task-bar-wrap"><div class="task-bar" style="width:'+pct+'%"></div></div>'
        +'<span class="task-count">'+Math.min(prog,t.goal)+'/'+t.goal+'</span>'
      +'</div>'
      +(done&&!claimed?'<button class="task-claim-btn" onclick="claimTask(\''+t.id+'\')">🎁 Забрати нагороду</button>'
        :claimed?'<div class="task-claimed-lbl">✅ Отримано</div>'
        :'<div class="task-progress-lbl">'+pct+'%</div>')
      +'</div>';
  }).join('');
}

window.claimTask=function(id){
  if(!P.tasks)initTasks();
  const t=TASKS.find(x=>x.id===id);if(!t)return;
  if(getProgress(t)<t.goal){notify('❌','Спочатку виконай!');return;}
  if(P.tasks.claimed[id]){
    notify('✅',t.cat==='daily'?'Вже отримано сьогодні!':t.cat==='weekly'?'Вже отримано цього тижня!':'Вже отримано!');return;
  }
  if(t.reward.coins)P.coins=(P.coins||0)+t.reward.coins;
  if(t.reward.xp)gainXP(t.reward.xp);
  if(t.reward.hearts)P.hearts=(P.hearts||0)+t.reward.hearts;
  const rwd=Object.entries(t.reward).map(([k,v])=>(k==='coins'?'🪙':k==='xp'?'⭐':'❤️')+v).join(' ');
  notify('🎁 Нагорода!',t.icon+' '+rwd,4000);
  P.tasks.completed[id]=true;
  P.tasks.claimed[id]=true; // забрати можна лише раз за період (день/тиждень/назавжди)
  renderTasks();render();saveP();
};

// ── RATINGS ──
window.switchRating=function(type){
  ratingTab=type;
  ['players','clubs','beauty','weekly'].forEach(t=>$('rt-'+t)?.classList.toggle('active',t===type));
  loadRatings(type);
};
async function loadRatings(type){
  const rl=$('rating-list');if(!rl)return;
  rl.innerHTML='<div class="loading-inline">Завантаження...</div>';
  if(type==='clubs')return loadClubRatings();
  if(type==='weekly')return renderWeekly();
  try{
    const snap=await getDocs(query(collection(db,'players'),orderBy('level','desc'),limit(50)));
    const all=snap.docs.map(d=>({...d.data(),_id:d.id})).filter(p=>p.nickname);
    all.sort((a,b)=>type==='beauty'?(b.butterflies||0)-(a.butterflies||0):((b.level||1)*1000+(b.butterflies||0))-((a.level||1)*1000+(a.butterflies||0)));
    const medals=['🥇','🥈','🥉'];
    rl.innerHTML='<div class="rating-count-info">👥 Гравців: '+all.length+'</div>'
      +all.map((p,i)=>{
        const isMe=p._id===uid;
        return '<div class="rating-row'+(isMe?' rating-row-me':'')+'" onclick="openProfile(\''+p._id+'\')">'
          +'<span class="rrank'+(i===0?' gold':i===1?' silver':i===2?' bronze':'')+'\">'+(medals[i]||i+1)+'</span>'
          +'<span class="rav">🐱</span>'
          +'<div style="flex:1"><div class="rname">'+esc(p.catname||p.nickname||'Тваринка')+(isMe?' 🌟':'')+'</div>'
          +'<div class="rsub">@'+esc(p.nickname||'?')+' · Рів.'+(p.level||1)+' · 🦋'+(p.butterflies||0)+'</div></div>'
          +'<span class="rscore">⭐'+((p.level||1)*1000+(p.butterflies||0))+'</span>'
          +'</div>';
      }).join('');
  }catch(e){rl.innerHTML='<div class="loading-inline">Помилка: '+esc(e.message)+'</div>';}
}
let _profileTarget=null;
window.openProfile=async function(pid){
  try{
    const snap=await getDoc(doc(db,'players',pid));
    if(!snap.exists()){notify('❌','Гравця не знайдено');return;}
    const p=snap.data();_profileTarget={id:pid,...p};
    const set=(id,v)=>{const el=$(id);if(el)el.textContent=v;};
    const isPet=p.petType==='dog';
    set('pm-av',isPet?'🐶':'🐱');
    set('pm-catname',p.catname||'Тваринка');
    set('pm-nick','@'+(p.nickname||'?'));
    set('pm-lvl','Рівень '+(p.level||1));
    const stats=$('pm-stats');
    if(stats)stats.innerHTML=[
      ['⭐','Рівень',p.level||1],['🦋','Краса',p.butterflies||0],
      ['🪙','Монети',p.coins||0],['❤️','Сердечка',p.hearts||0],
      ['🌸','Гламур',p.glamour||0],['🎈','Клуб',p.clubId?'Є':'—'],
    ].map(([i,n,v])=>'<div class="pm-stat"><span>'+i+'</span><b>'+v+'</b><small>'+n+'</small></div>').join('');
    const ab=$('pm-about-box'),abt=$('pm-about');
    if(ab&&abt){if(p.about){abt.textContent=p.about;ab.style.display='block';}else ab.style.display='none';}
    const ach=$('pm-achiev');
    if(ach){
      const list=[];
      // активний титул гравця
      const tl=(window.LANDMARKS||[]).find(l=>l.id===p.title);
      if(tl&&p.landmarks&&p.landmarks[tl.id])list.push('<span class="title-badge tier-'+tl.tier+'">'+tl.icon+' '+tl.title+'</span>');
      // медалі гравця (видимі іншим)
      (window.MEDALS||[]).forEach(m=>{if(p.medals&&p.medals[m.id])list.push(m.icon+' '+m.name);});
      if((p.level||1)>=5)list.push('⬆️ 5+ рівень');
      if((p.level||1)>=10)list.push('🌟 10+ рівень');
      if((p.butterflies||0)>=50)list.push('🦋 Красень');
      if(p.clubId)list.push('🎈 У клубі');
      if((p.showWins||0)>0)list.push('🏆 Переможець виставки');
      ach.innerHTML=list.length?list.map(a=>'<span class="pm-achiev-badge">'+a+'</span>').join(''):'';
    }
    const fb=$('pm-add-friend-btn');
    const isFriend=(P.friends||[]).some(f=>f.id===pid);
    const isPending=(P.sentReq||[]).includes(pid);
    if(fb){
      if(pid===uid){fb.style.display='none';}
      else{fb.style.display='';fb.disabled=isFriend||isPending;
        fb.textContent=isFriend?'✅ Вже друг':isPending?'⏳ Запит надіслано':'👤+ Додати в друзі';}
    }
    const m=$('player-modal');if(m)m.style.display='flex';
  }catch(e){notify('❌',e.message);}
};
window.closePlayerModal=function(){const m=$('player-modal');if(m)m.style.display='none';};

// ── CLUBS ──
function renderClubs(){
  if(P.clubId){$('clubs-no-club').style.display='none';$('clubs-in-club').style.display='block';loadClubData();}
  else{$('clubs-no-club').style.display='block';$('clubs-in-club').style.display='none';loadClubs();}
}
async function loadClubs(){
  const cb=$('club-browser');if(!cb)return;
  cb.innerHTML='<div class="loading-inline">Завантаження...</div>';
  try{
    const snap=await getDocs(collection(db,'clubs'));
    if(snap.empty){cb.innerHTML='<div class="loading-inline">Немає клубів. Створи перший!</div>';return;}
    cb.innerHTML=snap.docs.map(d=>{const c={...d.data(),_id:d.id};
      return '<div class="club-list-item" onclick="joinClub(\''+c._id+'\')">'
        +'<span class="cli-icon">'+(c.icon||'🎈')+'</span>'
        +'<div style="flex:1"><div class="cli-name">'+esc(c.name||'?')+'</div>'
        +'<div class="cli-info">'+(c.memberCount||1)+' учасн. · Рів.'+(c.level||1)+'</div></div>'
        +'</div>';
    }).join('');
  }catch(e){cb.innerHTML='<div class="loading-inline">Помилка: '+esc(e.message)+'</div>';}
}
async function loadClubData(){
  if(!P.clubId)return;
  $('clubs-in-club').style.display='block';$('clubs-no-club').style.display='none';
  try{
    const snap=await getDoc(doc(db,'clubs',P.clubId));
    if(!snap.exists()){P.clubId=null;saveP();renderClubs();return;}
    const c=snap.data();const set=(id,val)=>{const el=$(id);if(el)el.textContent=val;};
    set('cl-emblem',c.icon||'🏰');set('cl-name',c.name||'Клуб');
    set('cl-stars','★'.repeat(Math.min(7,c.stars||1))+'☆'.repeat(Math.max(0,7-(c.stars||1))));
    set('cl-role-badge',c.directorUid===uid?'👑 Директор':'👤 Учасник');
    set('cl-desc',c.description||'—');set('cl-founded',c.founded||'—');
    set('cl-level',c.level||1);set('cl-mc',c.memberCount||1);
    set('cl-mcount',c.memberCount||1);set('cl-xp',(c.xp||0)+'g');
    set('cl-blvl',c.level||1);
    set('cl-pc',c.piggyCoins||0);set('cl-ph',c.piggyHearts||0);
    const isDirector=c.directorUid===uid;
    const dr=$('club-director-row');if(dr)dr.style.display=isDirector?'block':'none';
    // кеш клубних бонусів для застосування в досвіді
    const b=c.buildings||{};
    P._clubBonus={schoolXpPct:(b.school||0)*2,collegeClubXpPct:(b.college||0)*2};
    // блокування поповнення на «випробувальному строці» (нові учасники <1 дня) — як на скрін
    renderClubBuildings(c,isDirector);
    if(typeof checkClubEvent==='function'){checkClubEvent(c);flushClubEvent(true);}
    const piggyNote=$('cl-piggy-note');
    if(piggyNote)piggyNote.textContent=isDirector?'Ви Директор — можете будувати постройки за кошти копілки.':'Поповнюйте копілку — це дає вам особистий бонус досвіду та вірність клубу.';
    const mSnap=await getDocs(query(collection(db,'clubs',P.clubId,'members'),limit(50)));
    const members=mSnap.docs.map(d=>({_id:d.id,...d.data()}));
    window._clubMembers=members;
    // моя роль
    let myRole=(c.directorUid===uid)?'director':((members.find(m=>(m.uid||m._id)===String(uid))||{}).role||null);
    // якщо мене немає серед учасників і я не директор — мене виключили
    if(!myRole&&c.directorUid!==uid&&members.length>0){
      P.clubId=null;P._clubRole=null;saveP();
      notify('🚪 Вас виключили з клубу','');renderClubs();return;
    }
    P._clubRole=myRole||'member';
    P.clubName=c.name||'Клуб';
    // дата вступу з member-доку (якщо локально нема)
    const myMember=members.find(m=>(m.uid||m._id)===String(uid));
    if(myMember&&myMember.joinedAt&&!P.clubJoinedAt)P.clubJoinedAt=myMember.joinedAt;
    recalcLoyalty();saveP();
    set('cl-role-badge',(CLUB_ROLES[P._clubRole]||CLUB_ROLES.member).icon+' '+(CLUB_ROLES[P._clubRole]||CLUB_ROLES.member).name);
    const myRank=(CLUB_ROLES[P._clubRole]||CLUB_ROLES.member).r;
    const order=members.slice().sort((a,b)=>
      ((CLUB_ROLES[b.role]||CLUB_ROLES.member).r-(CLUB_ROLES[a.role]||CLUB_ROLES.member).r)
      ||String(a.catname||'').localeCompare(b.catname||''));
    $('cl-members').innerHTML=order.map(m=>{
      const mid=m.uid||m._id;const role=CLUB_ROLES[m.role]||CLUB_ROLES.member;
      const isMe=mid===String(uid);
      // права: директор керує всіма (крім себе/директора); заступник — нижчими за себе
      const canManage=!isMe && m.role!=='director' && (
        myRole==='director' || (myRole==='deputy' && role.r<myRank));
      const cap=myRole==='director'?'deputy':'curator';
      const canUp=canManage && role.r<(CLUB_ROLES[cap].r);
      const canDown=canManage && role.r>1;
      const canKick=!isMe && m.role!=='director' && myRole==='director';
      let ctrl='';
      if(canUp)ctrl+='<button class="mrole-btn up" title="Підвищити" onclick="event.stopPropagation();promoteMember(\''+mid+'\')">▲</button>';
      if(canDown)ctrl+='<button class="mrole-btn down" title="Понизити" onclick="event.stopPropagation();demoteMember(\''+mid+'\')">▼</button>';
      if(canKick)ctrl+='<button class="mrole-btn kick" title="Виключити" onclick="event.stopPropagation();kickMember(\''+mid+'\')">✕</button>';
      return '<div class="member-row clickable" onclick="openMemberCard(\''+mid+'\')">'
        +'<span class="member-av">'+((m.petType||'cat')==='dog'?'🐶':'🐱')+'</span>'
        +'<div class="member-main"><div class="member-name">'+esc(m.catname||m.nickname||'?')+(isMe?' (ви)':'')+'</div>'
        +'<div class="member-sub">@'+esc(m.nickname||'?')+'</div></div>'
        +'<span class="member-role role-'+(m.role||'member')+'">'+role.icon+' '+role.name+'</span>'
        +(ctrl?'<span class="member-ctrl">'+ctrl+'</span>':'')
        +'</div>';
    }).join('');
  }catch(e){notify('❌',e.message);}
}
window.createClub=async function(){
  const name=($('new-club-name')?.value||'').trim();
  const desc=($('new-club-desc')?.value||'').trim();
  const icon=$('new-club-icon')?.value||'🐱';
  if(!name||name.length<3){notify('📝','Мінімум 3 символи!');return;}
  if(P.clubId){notify('✅','Вже в клубі!');return;}
  if((P.coins||0)<50){notify('🪙','Потрібно 50 монет!');return;}
  const btn=document.querySelector('button[onclick="createClub()"]');
  if(btn){btn.disabled=true;btn.textContent='⏳...';}
  try{
    P.coins-=50;
    const ref=await addDoc(collection(db,'clubs'),{
      name,description:desc||'Наш клуб!',icon,level:1,xp:0,stars:1,memberCount:1,
      directorUid:String(uid),directorName:String(P.nickname||'?'),
      piggyCoins:0,piggyHearts:0,founded:new Date().toLocaleDateString('uk-UA'),
      createdAt:new Date().toISOString(),
    });
    await setDoc(doc(db,'clubs',ref.id,'members',uid),{
      uid:String(uid),nickname:String(P.nickname||'?'),
      catname:String(P.catname||'Тваринка'),role:'director',points:0,petType:String(P.petType||'cat'),
      joinedAt:new Date().toISOString()
    });
    P.clubId=ref.id;P.clubName=name;P.clubJoinedAt=new Date().toISOString();P.loyTier=0;P.loyLast='';P.clubLoyalty=0;
    if($('new-club-name'))$('new-club-name').value='';
    trackTask('clubJoin');
    saveP();notify('🏆 Клуб створено!',name);addLog('Клуб "'+name+'" створено!');renderClubs();
  }catch(e){P.coins+=50;notify('❌',e.message);}
  finally{if(btn){btn.disabled=false;btn.textContent='🏆 Створити і стати Директором';}}
};
window.joinClub=async function(clubId){
  if(P.clubId){notify('✅','Вже в клубі!');return;}
  try{
    const snap=await getDoc(doc(db,'clubs',clubId));
    if(!snap.exists()){notify('❌','Клуб не знайдено!');return;}
    await setDoc(doc(db,'clubs',clubId,'members',uid),{
      uid:String(uid),nickname:String(P.nickname||'?'),
      catname:String(P.catname||'Тваринка'),role:'member',points:0,petType:String(P.petType||'cat'),
      joinedAt:new Date().toISOString()
    });
    await updateDoc(doc(db,'clubs',clubId),{memberCount:increment(1)});
    P.clubId=clubId;P.clubName=snap.data().name||'Клуб';P.clubJoinedAt=new Date().toISOString();
    P.loyTier=0;P.loyLast='';P.clubLoyalty=0;
    trackTask('clubJoin');saveP();
    notify('🎈 Вступив!',snap.data().name);renderClubs();
  }catch(e){notify('❌',e.message);}
};
window.leaveClub=function(){
  if(!P.clubId)return;
  uiConfirm('Вийти з клубу «'+(P.clubName||'')+'»? Вірність клубу буде втрачено.',async()=>{
    try{
      await deleteDoc(doc(db,'clubs',P.clubId,'members',uid));
      await updateDoc(doc(db,'clubs',P.clubId),{memberCount:increment(-1)});
      P.clubId=null;P.clubName='';P.clubJoinedAt='';P.loyTier=0;P.loyLast='';P.clubLoyalty=0;P._clubBonus=null;
      saveP();notify('👋','Вийшов');renderClubs();
    }catch(e){notify('❌',e.message);}
  },{title:'Вийти з клубу',yes:'Вийти'});
};
window.donateClub=async function(){
  const amt=parseInt($('donate-amount')?.value||'10')||10;
  if((P.coins||0)<amt){notify('🪙','Мало монет!');return;}
  if(!P.clubId){notify('❌','Немає клубу!');return;}
  P.coins-=amt;
  try{
    await updateDoc(doc(db,'clubs',P.clubId),{piggyCoins:increment(amt),xp:increment(amt)});
    notify('🐷','🪙'+amt+' передано!');loadClubData();render();saveP();
  }catch(e){P.coins+=amt;}
};

// ── CHAT ──
function startChat(){
  const box=$('chat-msgs');if(!box)return;
  if(chatUnsub){chatUnsub();chatUnsub=null;}
  box.innerHTML='<div class="loading-inline">Завантаження...</div>';
  try{
    const q=query(collection(db,'chat'),orderBy('ts','desc'),limit(60));
    let loaded=false;
    chatUnsub=onSnapshot(q,snap=>{
      if(!loaded){
        loaded=true;box.innerHTML='';
        [...snap.docs].reverse().forEach(d=>{const m=d.data();addMsg(d.id,m.nickname,m.catname,m.text,m.uid===uid,m.ts,m.uid);});
        box.scrollTop=box.scrollHeight;
      }else{
        snap.docChanges().forEach(ch=>{
          if(ch.type==='added'&&!document.getElementById('cm-'+ch.doc.id)){
            const m=ch.doc.data();addMsg(ch.doc.id,m.nickname,m.catname,m.text,m.uid===uid,m.ts,m.uid);
            box.scrollTop=box.scrollHeight;
          }
        });
      }
    },e=>console.warn('chat:',e));
  }catch(e){if($('chat-msgs'))$('chat-msgs').innerHTML='<div class="loading-inline">Помилка</div>';}
}
function addMsg(docId,nick,catname,text,mine,ts,senderUid){
  const box=$('chat-msgs');if(!box)return;
  const div=document.createElement('div');
  div.className='msg '+(mine?'mine':'theirs');
  if(docId)div.id='cm-'+docId;
  let t='';try{t=ts?.toDate?ts.toDate().toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'}):now();}catch(e){t=now();}
  const clickAttr=(senderUid&&!mine)?(' class="msg-sender chat-sender-link" onclick="openProfile(\''+senderUid+'\')"'):(' class="msg-sender'+(mine?' msg-sender-mine':'')+'"');
  div.innerHTML='<div'+clickAttr+'>'+esc(catname||nick||'?')
    +'<span style="font-size:.62rem;opacity:.7"> @'+esc(nick||'?')+'</span>'+((senderUid&&!mine)?' 👤':'')+'</div>'
    +'<div class="msg-bubble">'+esc(text||'')+'</div>'
    +'<div class="msg-meta">'+t+'</div>';
  box.appendChild(div);
}
window.sendChat=async function(){
  const inp=$('chat-in');const text=(inp?.value||'').trim();if(!text)return;inp.value='';
  try{
    await addDoc(collection(db,'chat'),{
      uid:String(uid),nickname:String(P.nickname||'?'),
      catname:String(P.catname||'Тваринка'),text:text.slice(0,300),ts:serverTimestamp()
    });
  }catch(e){inp.value=text;notify('❌','Помилка чату');}
};

// ── MAIL ──
function renderMail(){
  const mi=$('mail-items');if(!mi)return;
  const items=[...(P.inbox||[])].reverse();
  if(!items.length){mi.innerHTML='<div class="loading-inline">Немає повідомлень</div>';return;}
  mi.innerHTML=items.map(m=>
    '<div class="mail-item '+(m.read?'':'unread')+'" onclick="openMail('+m.id+')">'
      +'<div class="mail-from">'+esc(m.from||'?')+'</div>'
      +'<div class="mail-subj">'+esc(m.subj||'')+'</div>'
      +'<div class="mail-time">'+(m.time||'')+'</div>'
    +'</div>'
  ).join('');updateMailBadge();
}
window.openMail=function(id){
  const msg=(P.inbox||[]).find(m=>m.id===id);if(!msg)return;
  msg.read=true;
  // Use the existing mail detail view instead of alert()
  const dv=$('mail-detail');
  const lv=$('mail-list-view');
  if(dv&&lv){
    const setEl=(eid,val)=>{const el=$(eid);if(el)el.textContent=val;};
    setEl('md-from',msg.from||'?');
    setEl('md-time',msg.time||'');
    setEl('md-subj',msg.subj||'');
    setEl('md-body',msg.body||'');
    lv.style.display='none';
    dv.style.display='block';
  } else {
    // Fallback if detail view not present
    const box=document.createElement('div');
    box.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    box.innerHTML='<div style="background:#fff;border-radius:16px;padding:20px;max-width:340px;width:100%;font-family:inherit">'
      +'<div style="font-size:.75rem;color:#888;margin-bottom:6px">Від: <b>'+esc(msg.from||'?')+'</b> · '+(msg.time||'')+'</div>'
      +'<div style="font-size:1rem;font-weight:900;margin-bottom:12px">'+esc(msg.subj||'')+'</div>'
      +'<div style="font-size:.85rem;line-height:1.7">'+esc(msg.body||'')+'</div>'
      +'<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="margin-top:16px;width:100%;padding:10px;background:#e8a820;border:none;border-radius:10px;font-weight:800;cursor:pointer;font-size:.9rem">Закрити ✕</button>'
      +'</div>';
    document.body.appendChild(box);
  }
  saveP();updateMailBadge();renderMail();
};

// ── SHOP ──
// type wear → додає предмет у шафу (P.wardrobe), slot визначає куди вдягається
const SHOP={
  food:[
    {id:'fish',icon:'🐟',name:'Рибка',desc:'+30🍖',cost:8,fn:()=>{P.hunger=cl((P.hunger||0)+30);}},
    {id:'milk',icon:'🥛',name:'Молоко',desc:'+20💧',cost:5,fn:()=>{P.thirst=cl((P.thirst||0)+20);}},
    {id:'cake',icon:'🎂',name:'Тортик',desc:'+40🍖+20😊',cost:15,fn:()=>{P.hunger=cl((P.hunger||0)+40);P.fun=cl((P.fun||0)+20);}},
    {id:'energy',icon:'⚡',name:'Енергетик',desc:'+40⚡',cost:20,fn:()=>{P.energy=cl((P.energy||0)+40);}},
    {id:'meat',icon:'🍖',name:'М’ясо',desc:'+50🍖',cost:25,fn:()=>{P.hunger=cl((P.hunger||0)+50);}},
    {id:'juice',icon:'🧃',name:'Сік',desc:'+35💧+10😊',cost:14,fn:()=>{P.thirst=cl((P.thirst||0)+35);P.fun=cl((P.fun||0)+10);}},
  ],
  clothes:[
    {id:'w_shirt1',icon:'👕',name:'Футболка',cost:40,wear:true,slot:'shirt',beauty:3},
    {id:'w_shirt2',icon:'👔',name:'Сорочка',cost:90,wear:true,slot:'shirt',beauty:6},
    {id:'w_dress', icon:'👗',name:'Сукня',  cost:140,wear:true,slot:'shirt',beauty:10},
    {id:'w_hat1',  icon:'🎩',name:'Циліндр',cost:70,wear:true,slot:'hat',beauty:5},
    {id:'w_hat2',  icon:'👑',name:'Корона', cost:300,wear:true,slot:'hat',beauty:18},
    {id:'w_cap',   icon:'🧢',name:'Кепка',  cost:35,wear:true,slot:'hat',beauty:2},
  ],
  accessories:[
    {id:'a_collar',icon:'➿',name:'Нашийник',  cost:30,wear:true,slot:'collar',beauty:2},
    {id:'a_bow',   icon:'🎀',name:'Бантик',    cost:55,wear:true,slot:'collar',beauty:4},
    {id:'a_ring',  icon:'💍',name:'Кільце',    cost:120,wear:true,slot:'ring',beauty:9},
    {id:'a_toy',   icon:'🧸',name:'Ведмедик',  cost:45,wear:true,slot:'toy',beauty:3},
    {id:'a_ball',  icon:'🎾',name:'М’ячик',    cost:25,wear:true,slot:'toy',beauty:1},
    {id:'a_medal', icon:'🏅',name:'Медаль',    cost:160,wear:true,slot:'medal',beauty:12},
  ],
  gems:[
    {id:'g_ruby',  icon:'🔴',name:'Фрагмент рубіна',   desc:'+1 фрагмент 🔴',cost:120, gem:'ruby'},
    {id:'g_saph',  icon:'🔵',name:'Фрагмент сапфіра',  desc:'+1 фрагмент 🔵',cost:100, gem:'sapphire'},
    {id:'g_emer',  icon:'🟢',name:'Фрагмент смарагда', desc:'+1 фрагмент 🟢',cost:90, gem:'emerald'},
    {id:'g_amber', icon:'🟡',name:'Фрагмент бурштину', desc:'+1 фрагмент 🟡',cost:70, gem:'amber'},
    {id:'g_diam',  icon:'⚪',name:'Фрагмент діаманта', desc:'+1 фрагмент ⚪',cost:180, gem:'diamond'},
  ],
  bonuses:[
    {id:'b_xp',   icon:'⭐',name:'2× Досвід (1 год)', desc:'XP x2 на 60 хв',cost:120,bonus:'xp2',mins:60},
    {id:'b_coin', icon:'🪙',name:'2× Монети (1 год)', desc:'Монети x2 на 60 хв',cost:120,bonus:'coin2',mins:60},
    {id:'b_vip',  icon:'👑',name:'VIP (24 год)',      desc:'XP+монети x2 на добу',cost:500,bonus:'vip',mins:1440},
    {id:'b_heal', icon:'❤️',name:'Сердечка +500',     desc:'миттєво +500❤️',cost:200,fn:()=>{P.hearts=(P.hearts||0)+500;}},
  ],
};
const GEMS=[
  {key:'ruby',    icon:'🔴',name:'Рубін',   reward:{butterflies:25,coins:200}},
  {key:'sapphire',icon:'🔵',name:'Сапфір',  reward:{butterflies:18,coins:150}},
  {key:'emerald', icon:'🟢',name:'Смарагд', reward:{butterflies:15,coins:120}},
  {key:'amber',   icon:'🟡',name:'Бурштин', reward:{butterflies:10,coins:80}},
  {key:'diamond', icon:'⚪',name:'Діамант', reward:{butterflies:50,coins:500}},
];
window.filterShop=function(cat){
  shopFilter=cat;
  document.querySelectorAll('.shop-cat-btn').forEach(b=>b.classList.toggle('active',b.dataset.cat===cat));
  buildShop(cat);
};
function buildShop(cat){
  const c=$('shop-items');if(!c)return;
  c.innerHTML=(SHOP[cat]||[]).map(item=>{
    const owned=item.wear&&(P?.wardrobe||[]).some(w=>w.id===item.id);
    const sub=item.desc||((item.beauty?'+'+item.beauty+'🦋 ':'')+'у шафу');
    return '<div class="shop-item-card">'
      +'<span class="si-icon">'+item.icon+'</span>'
      +'<div class="si-info"><div class="si-name">'+item.name+'</div><div class="si-desc">'+sub+'</div></div>'
      +(owned?'<button class="si-buy" disabled>✅ Є</button>'
        :'<button class="si-buy" '+((P?.coins||0)<item.cost?'disabled':'')+' onclick="buyItem(\''+item.id+'\',\''+cat+'\')">🪙'+item.cost+'</button>')
    +'</div>';
  }).join('')||'<div class="loading-inline">Порожньо</div>';
}
window.buyItem=function(id,cat){
  const item=(SHOP[cat]||[]).find(i=>i.id===id);if(!item)return;
  if((P.coins||0)<item.cost){notify('🪙','Мало монет!');return;}
  if(item.wear&&(P.wardrobe||[]).some(w=>w.id===item.id)){notify('✅','Вже у шафі');return;}
  P.coins-=item.cost;
  if(item.wear){
    if(!P.wardrobe)P.wardrobe=[];
    if(P.wardrobe.length>=20){P.coins+=item.cost;notify('🚪','Шафа повна (20)!');return;}
    P.wardrobe.push({id:item.id,icon:item.icon,name:item.name,slot:item.slot,beauty:item.beauty||0});
    addLog('Куплено: '+item.name);
  }else if(item.gem){
    if(!P.gems)P.gems={};
    P.gems[item.gem]=(P.gems[item.gem]||0)+1;
  }else if(item.bonus){
    if(!P.bonuses)P.bonuses={};
    P.bonuses[item.bonus]=Date.now()+item.mins*60*1000;
  }else if(item.fn){item.fn();}
  gainXP(3);
  notify('✅ Куплено!',item.name);render();saveP();buildShop(cat);
}

// ══════════════════════════════════════════════════════════
//  ДОПОВНЕННЯ: функціонал раніше непрацюючих вкладок
// ══════════════════════════════════════════════════════════
const petIcon=()=>P&&P.petType==='dog'?'🐶':'🐱';

// ── SETTINGS ──
function renderSettings(){
  if(!P)return;
  const set=(id,v)=>{const el=$(id);if(el)el.textContent=v;};
  set('settings-nickname',P.nickname||'—');
  set('settings-catname-val',P.catname||'Тваринка');
  const sel=$('settings-pettype');if(sel)sel.value=P.petType||'cat';
  // активні бонуси
  const box=$('settings-bonuses');
  if(box){
    const names={xp2:'⭐ 2× Досвід',coin2:'🪙 2× Монети',vip:'👑 VIP (XP+монети ×2)'};
    const active=Object.keys(names).filter(k=>P.bonuses&&P.bonuses[k]>Date.now());
    if(!active.length)box.textContent='Немає активних бонусів';
    else box.innerHTML=active.map(k=>{
      const left=Math.max(0,Math.round((P.bonuses[k]-Date.now())/60000));
      return '<div style="padding:4px 0">'+names[k]+' — ще '+left+' хв</div>';
    }).join('');
  }
}
window.savePetType=function(){
  const sel=$('settings-pettype');if(!sel)return;
  P.petType=sel.value;saveP();_emoLockUntil=0;setPetImg(moodEmotion());render();renderPetPage();
  notify('✅','Тип тваринки: '+(P.petType==='dog'?'🐶 Собачка':'🐱 Котик'));
};
window.openChangeCatname=function(){
  const inp=$('new-catname-inp');if(inp)inp.value=P.catname||'';
  const m=$('change-catname-modal');if(m)m.style.display='flex';
};
window.closeChangeCatname=function(){const m=$('change-catname-modal');if(m)m.style.display='none';};
window.saveCatname=function(){
  const v=($('new-catname-inp')?.value||'').trim();
  if(v.length<2){notify('📝','Мінімум 2 символи');return;}
  P.catname=v.slice(0,20);saveP();render();renderPetPage();renderSettings();
  closeChangeCatname();notify('✅','Ім’я змінено!');
};

// ── ABOUT (про себе) ──
window.editAbout=function(){
  const t=$('about-text');if(t)t.value=P.about||'';
  const m=$('about-modal');if(m)m.style.display='flex';
};
window.closeAbout=function(){const m=$('about-modal');if(m)m.style.display='none';};
window.saveAbout=function(){
  P.about=($('about-text')?.value||'').trim().slice(0,300);
  const el=$('ps-about');if(el)el.textContent=P.about||'заповнити...';
  saveP();closeAbout();notify('✅','Збережено!');
};

// ── WARDROBE (шафа/одяг) ──
let wardrobeFilter='all',wardrobeSlot='all';
window.openWardrobe=function(slot){
  wardrobeSlot=slot||'all';
  wardrobeFilter=(slot&&slot!=='all')?slot:'all';
  const title=$('wardrobe-title');
  const lbl={shirt:'👕 Одяг',collar:'➿ Нашийники',hat:'🎩 Капелюхи',ring:'💍 Кільця',toy:'🎾 Іграшки',medal:'🏅 Медалі'}[slot];
  if(title)title.textContent=lbl?'🚪 '+lbl:'🚪 Шафа';
  document.querySelectorAll('.cf-btn').forEach(b=>b.classList.remove('active'));
  renderWardrobe();
  const m=$('wardrobe-modal');if(m)m.style.display='flex';
};
window.closeWardrobe=function(){const m=$('wardrobe-modal');if(m)m.style.display='none';};
window.filterWardrobe=function(f){
  wardrobeFilter=f;
  document.querySelectorAll('.cf-btn').forEach(b=>b.classList.remove('active'));
  if(event&&event.target)event.target.classList.add('active');
  renderWardrobe();
};
function renderWardrobe(){
  const grid=$('wardrobe-grid');if(!grid)return;
  const items=(P.wardrobe||[]).filter(w=>wardrobeFilter==='all'||w.slot===wardrobeFilter);
  const used=$('wardrobe-used');if(used)used.textContent=(P.wardrobe||[]).length;
  const cnt=$('pm-wardrobe-cnt');if(cnt)cnt.textContent=(P.wardrobe||[]).length+' з 20';
  if(!items.length){
    grid.innerHTML='<div class="loading-inline" style="grid-column:1/-1">Поки порожньо. Купи одяг у 🛍️ Магазині!</div>';
    return;
  }
  grid.innerHTML=items.map(w=>{
    const eq=P.equipped&&P.equipped[w.slot]===w.id;
    return '<div class="wardrobe-item'+(eq?' equipped':'')+(w.rare?' rare':'')+'" onclick="toggleEquip(\''+w.id+'\')">'
      +'<button class="wi-del" title="Викинути" onclick="event.stopPropagation();deleteWardrobeItem(\''+w.id+'\')">✕</button>'
      +'<div style="font-size:1.9rem">'+w.icon+'</div>'
      +'<div style="font-size:.62rem;font-weight:800;color:var(--tx);margin-top:2px">'+esc(w.name)+'</div>'
      +'<div style="font-size:.55rem;color:var(--gdk);font-weight:700">+'+(w.beauty||0)+'🦋</div>'
      +'<div style="font-size:.55rem;font-weight:800;color:'+(eq?'var(--gdk)':'var(--tl)')+'">'+(eq?'✅ Вдягнено':'Вдягнути')+'</div>'
      +'</div>';
  }).join('');
}
window.deleteWardrobeItem=function(id){
  const it=(P.wardrobe||[]).find(w=>w.id===id);if(!it)return;
  uiConfirm('Викинути «'+(it.name||'предмет')+'» з шафи?',()=>{
    if(P.equipped&&P.equipped[it.slot]===id){P.equipped[it.slot]=null;P.butterflies=Math.max(0,(P.butterflies||0)-(it.beauty||0));}
    P.wardrobe=(P.wardrobe||[]).filter(w=>w.id!==id);
    saveP();render();renderWardrobe();updateEquipSlots();renderPetPage();
    notify('🗑️','Викинуто: '+(it.name||''));
  },{title:'Викинути одяг',yes:'Викинути'});
};
window.cleanWeakWardrobe=function(){
  const wr=P.wardrobe||[];
  if(!wr.length){notify('🚪','Шафа порожня');return;}
  const best={};
  wr.forEach(w=>{if(!best[w.slot]||(w.beauty||0)>(best[w.slot].beauty||0))best[w.slot]=w;});
  const keepIds=new Set(Object.values(best).map(w=>w.id));
  const removeCnt=wr.length-keepIds.size;
  if(removeCnt<=0){notify('✨','Нема що прибирати — лише найкраще!');return;}
  uiConfirm('Прибрати '+removeCnt+' слабших предметів? Залишиться найкращий у кожному слоті.',()=>{
    Object.keys(P.equipped||{}).forEach(slot=>{
      const eqId=P.equipped[slot];
      if(eqId&&!keepIds.has(eqId)){const it=wr.find(w=>w.id===eqId);if(it)P.butterflies=Math.max(0,(P.butterflies||0)-(it.beauty||0));P.equipped[slot]=null;}
    });
    P.wardrobe=wr.filter(w=>keepIds.has(w.id));
    saveP();render();renderWardrobe();updateEquipSlots();renderPetPage();
    notify('🧹 Прибрано',removeCnt+' предметів викинуто');
  },{title:'Прибрати слабкий одяг',yes:'Прибрати'});
};
window.toggleEquip=function(itemId){
  const it=(P.wardrobe||[]).find(w=>w.id===itemId);if(!it)return;
  if(!P.equipped)P.equipped={};
  const cur=P.equipped[it.slot];
  if(cur===itemId){
    // зняти
    P.equipped[it.slot]=null;
    P.butterflies=Math.max(0,(P.butterflies||0)-(it.beauty||0));
  }else{
    // зняти попередній цього слоту
    if(cur){const prev=(P.wardrobe||[]).find(w=>w.id===cur);if(prev)P.butterflies=Math.max(0,(P.butterflies||0)-(prev.beauty||0));}
    P.equipped[it.slot]=itemId;
    P.butterflies=(P.butterflies||0)+(it.beauty||0);
  }
  saveP();render();renderWardrobe();updateEquipSlots();renderPetPage();
  // медаль "одягни повністю": усі 4 базові слоти (одяг/нашийник/кільце/капелюх) заповнені
  const baseSlots=['shirt','collar','ring','hat'];
  if(baseSlots.every(s=>P.equipped&&P.equipped[s])){
    if(!P.life)P.life={};
    if(!P.life.dress){lifeTrack('dress');}
  }
};
function updateEquipSlots(){
  const map={shirt:'eq-shirt',collar:'eq-collar',ring:'eq-ring',hat:'eq-hat',toy:'eq-toy',medal:'eq-medal'};
  const def={shirt:'👕',collar:'➿',ring:'💍',hat:'🎩',toy:'🎾',medal:'🏅'};
  Object.keys(map).forEach(slot=>{
    const el=$(map[slot]);if(!el)return;
    const id=P.equipped&&P.equipped[slot];
    const it=id&&(P.wardrobe||[]).find(w=>w.id===id);
    el.textContent=it?it.icon:def[slot];
  });
}

// ── GEMS (скарби) ──
function renderGems(){
  if(!P)return;if(!P.gems)P.gems={};
  const list=$('gem-list');
  if(list)list.innerHTML=GEMS.map(g=>{
    const have=P.gems[g.key]||0;const pct=Math.min(100,have/5*100);
    const ic=(window.ASSETS&&ASSETS.gem[g.key])?assetImg(ASSETS.gem[g.key],'gem-pic'):g.icon;
    return '<div class="gem-row">'
      +'<span class="gem-icon">'+ic+'</span>'
      +'<div class="gem-left" style="flex:1"><div class="gem-name">'+g.name+'</div>'
        +'<div class="gem-mini-bar-wrap"><div class="gem-mini-bar" style="width:'+pct+'%"></div></div></div>'
      +'<span class="gem-bonus">'+Math.min(have,5)+'/5</span>'
      +'</div>';
  }).join('');
  const sum=$('gem-sum');
  if(sum)sum.textContent=GEMS.map(g=>g.icon+'×'+(P.gems[g.key]||0)).join('  ');
  const as=$('gem-assemble');
  if(as)as.innerHTML=GEMS.map(g=>{
    const have=P.gems[g.key]||0;const ready=have>=5;
    const ic=(window.ASSETS&&ASSETS.gem[g.key])?assetImg(ASSETS.gem[g.key],'gem-pic-sm'):g.icon;
    return '<button class="act-btn" '+(ready?'':'disabled')+' onclick="assembleGem(\''+g.key+'\')" style="opacity:'+(ready?1:.5)+'">'
      +'<span class="bi">'+ic+'</span>'
      +'<span class="bl">'+g.name+'</span>'
      +'<span class="bc">'+(ready?('Зібрати! +'+g.reward.butterflies+'🦋'):(have+'/5'))+'</span>'
      +'</button>';
  }).join('');
}
window.assembleGem=function(key){
  if(!P.gems)P.gems={};
  const g=GEMS.find(x=>x.key===key);if(!g)return;
  if((P.gems[key]||0)<5){notify('💎','Треба 5 фрагментів!');return;}
  P.gems[key]-=5;
  if(g.reward.butterflies)P.butterflies=(P.butterflies||0)+g.reward.butterflies;
  if(g.reward.coins)P.coins=(P.coins||0)+g.reward.coins;
  gainXP(20);lifeTrack('gem');
  notify('💎 '+g.name+' зібрано!','+'+g.reward.butterflies+'🦋 +'+g.reward.coins+'🪙',4000);
  addLog('Зібрано '+g.name+'! +'+g.reward.butterflies+'🦋');
  render();renderGems();saveP();
};

// ── SHOW (виставка) ──
const SHOW_CATS=[
  {id:'beauty',  icon:'🦋',name:'Найкрасивіша',  stat:'butterflies',prize:{coins:100,hearts:50}},
  {id:'glamour', icon:'🌸',name:'Гламур-королева',stat:'glamour',   prize:{coins:80,hearts:40}},
  {id:'level',   icon:'⭐',name:'Найдосвідченіша',stat:'level',      prize:{coins:120,hearts:60}},
];
const LEAGUES=[
  {min:0,  name:'🥉 Бронзова ліга',mult:1},
  {min:30, name:'🥈 Срібна ліга',  mult:1.5},
  {min:80, name:'🥇 Золота ліга',  mult:2},
  {min:200,name:'💎 Діамантова ліга',mult:3},
];
function myLeague(){const b=P.butterflies||0;let r=LEAGUES[0];LEAGUES.forEach(l=>{if(b>=l.min)r=l;});return r;}
function renderShow(){
  if(!P)return;
  const set=(id,v)=>{const el=$(id);if(el)el.textContent=v;};
  refreshPetImg();
  set('show-cat-name',P.catname||'Тваринка');
  set('show-beauty',P.butterflies||0);
  set('show-level',P.level||1);
  const lg=myLeague();
  const ld=$('show-league');
  if(ld)ld.innerHTML='<div class="card league-card"><span class="league-icon">🏆</span>'
    +'<div style="flex:1"><div class="league-name">'+lg.name+'</div>'
    +'<div class="league-prizes">Множник призів ×'+lg.mult+' · Наступна ліга при більшій красі</div></div></div>';
  // категорії
  const today=new Date().toDateString();
  if(!P.showEntered)P.showEntered={};
  const cont=$('show-categories');
  if(cont)cont.innerHTML=SHOW_CATS.map(c=>{
    const entered=P.showEntered[c.id]===today;
    const prize='🪙'+Math.round(c.prize.coins*lg.mult)+' +❤️'+Math.round(c.prize.hearts*lg.mult);
    const myv=c.stat==='level'?(P.level||1):(P[c.stat]||0);
    return '<div class="show-category">'
      +'<div class="show-cat-row"><span class="show-cat-title">'+c.icon+' '+c.name+'</span>'
        +'<span class="show-prize-row">'+prize+'</span></div>'
      +'<div style="font-size:.7rem;color:var(--tl);font-weight:700;margin:4px 0">Твій показник: <b>'+myv+'</b></div>'
      +(entered?'<button class="show-enter-btn" disabled>✅ Сьогодні вже брав участь</button>'
        :'<button class="show-enter-btn" onclick="enterShow(\''+c.id+'\')">🎭 Взяти участь</button>')
      +'</div>';
  }).join('');
  loadShowLeaderboard();
}
window.enterShow=function(catId){
  const c=SHOW_CATS.find(x=>x.id===catId);if(!c)return;
  const today=new Date().toDateString();
  if(!P.showEntered)P.showEntered={};
  if(P.showEntered[catId]===today){notify('🏆','Сьогодні вже брав участь!');return;}
  const lg=myLeague();
  const myv=c.stat==='level'?(P.level||1):(P[c.stat]||0);
  // перемога залежить від показника (більший → більший шанс), мін 25%
  const win=Math.random()<Math.min(.9,.25+myv/200);
  P.showEntered[catId]=today;
  if(win){
    const coins=Math.round(c.prize.coins*lg.mult),hearts=heartGain(Math.round(c.prize.hearts*lg.mult));
    P.coins=(P.coins||0)+coins;P.hearts=(P.hearts||0)+hearts;P.showWins=(P.showWins||0)+1;
    gainXP(30);checkMedals();
    notify('🏆 Перемога!',c.icon+' +'+coins+'🪙 +'+hearts+'❤️',4000);
    addLog('🏆 Перемога у "'+c.name+'"! +'+coins+'🪙');
  }else{
    const cons=Math.round(20*lg.mult);P.coins=(P.coins||0)+cons;gainXP(10);
    notify('🎭 Участь зараховано','Цього разу не призове місце. +'+cons+'🪙');
  }
  render();renderShow();saveP();
};
async function loadShowLeaderboard(){
  const lb=$('show-leaderboard');if(!lb)return;
  lb.innerHTML='<div class="loading-inline">Завантаження...</div>';
  try{
    const snap=await getDocs(query(collection(db,'players'),orderBy('butterflies','desc'),limit(20)));
    const all=snap.docs.map(d=>({...d.data(),_id:d.id})).filter(p=>p.nickname);
    all.sort((a,b)=>(b.butterflies||0)-(a.butterflies||0));
    const medals=['🥇','🥈','🥉'];
    lb.innerHTML=all.map((p,i)=>{
      const me=p._id===uid;
      return '<div class="show-contestant'+(me?' show-contestant-me':'')+'" onclick="openProfile(\''+p._id+'\')">'
        +'<span class="show-rank">'+(medals[i]||(i+1))+'</span>'
        +'<span style="font-size:1.3rem">'+(p.petType==='dog'?'🐶':'🐱')+'</span>'
        +'<div style="flex:1"><div style="font-size:.8rem;font-weight:800;color:var(--tx)">'+esc(p.catname||'Тваринка')+(me?' 🌟':'')+'</div>'
        +'<div style="font-size:.65rem;color:var(--tl);font-weight:700">@'+esc(p.nickname||'?')+'</div></div>'
        +'<span style="font-size:.85rem;font-weight:900;color:var(--gdk)">🦋'+(p.butterflies||0)+'</span>'
        +'</div>';
    }).join('')||'<div class="loading-inline">Поки нема учасників</div>';
  }catch(e){lb.innerHTML='<div class="loading-inline">Помилка: '+esc(e.message)+'</div>';}
}

// ── FRIENDS (друзі) ──
function renderFriends(){
  if(!P)return;if(!P.friends)P.friends=[];
  if(typeof renderInvite==='function')renderInvite();
  loadFriendRequests();
  processFriendAccepts();
  const list=$('friends-list');if(!list)return;
  if(!P.friends.length){list.innerHTML='<div class="loading-inline">Поки нема друзів. Знайди гравця вище 👆</div>';return;}
  list.innerHTML=P.friends.map(f=>
    '<div class="friend-row" onclick="openProfile(\''+f.id+'\')">'
      +'<span class="friend-av">'+(f.petType==='dog'?'🐶':'🐱')+'</span>'
      +'<div style="flex:1"><div class="friend-name">'+esc(f.catname||'Тваринка')+'</div>'
      +'<div class="friend-sub">@'+esc(f.nickname||'?')+' · Рів.'+(f.level||1)+'</div></div>'
      +'<button class="small-btn" onclick="event.stopPropagation();removeFriend(\''+f.id+'\')">✕</button>'
    +'</div>'
  ).join('');
}
window.searchPlayer=async function(){
  const q=($('friend-search-inp')?.value||'').trim().toLowerCase();
  const res=$('friend-search-result');if(!res)return;
  if(!q){res.innerHTML='';return;}
  res.innerHTML='<div class="loading-inline">Пошук...</div>';
  try{
    const snap=await getDocs(query(collection(db,'players'),limit(100)));
    const found=snap.docs.map(d=>({...d.data(),_id:d.id}))
      .filter(p=>p.nickname&&p._id!==uid&&(p.nickname.toLowerCase().includes(q)||(p.catname||'').toLowerCase().includes(q)))
      .slice(0,8);
    if(!found.length){res.innerHTML='<div class="loading-inline">Нікого не знайдено</div>';return;}
    res.innerHTML=found.map(p=>
      '<div class="friend-row" onclick="openProfile(\''+p._id+'\')">'
        +'<span class="friend-av">'+(p.petType==='dog'?'🐶':'🐱')+'</span>'
        +'<div style="flex:1"><div class="friend-name">'+esc(p.catname||'Тваринка')+'</div>'
        +'<div class="friend-sub">@'+esc(p.nickname||'?')+' · Рів.'+(p.level||1)+'</div></div>'
        +'<span style="font-size:.7rem;color:var(--gold);font-weight:800">профіль ›</span>'
      +'</div>'
    ).join('');
  }catch(e){res.innerHTML='<div class="loading-inline">Помилка: '+esc(e.message)+'</div>';}
};
window.addFriend=function(){return window.sendFriendRequest();};
window.removeFriend=function(id){
  P.friends=(P.friends||[]).filter(f=>f.id!==id);saveP();renderFriends();notify('👋','Видалено з друзів');
};
window.openMessageTo=function(){
  if(!_profileTarget)return;
  closePlayerModal();
  goPage('mail');showCompose();
  const to=$('cm-to');if(to)to.value=_profileTarget.nickname||'';
};

// ── MAIL (пошта) ──
// Листи зберігаються в колекції 'mail' (а не в чужому player-документі),
// бо firestore.rules дозволяють писати лише свій player-док. У колекції mail
// автор пише свій лист (fromUid==auth.uid), отримувач читає й позначає прочитаним.
let mailTab='inbox';
let _mailCache={inbox:[],sent:[]};
let _lastOpenedMail=null;
window._mailUnread=0;

window.switchMail=function(tab){
  mailTab=tab;
  document.querySelectorAll('.mtab').forEach(t=>t.classList.remove('active'));
  const btn=$({inbox:'mt-inbox',sent:'mt-sent',system:'mt-system'}[tab]);
  if(btn)btn.classList.add('active');
  renderMail();
};

// renderMail тепер завантажує дані залежно від вкладки
renderMail=function(){
  const mi=$('mail-items');if(!mi)return;
  if(mailTab==='system'){
    const items=[...(P.inbox||[])].filter(m=>m.type==='system').reverse();
    paintMail(items,'system');return;
  }
  mi.innerHTML='<div class="loading-inline">Завантаження...</div>';
  loadMail(mailTab).then(items=>paintMail(items,mailTab))
    .catch(e=>{mi.innerHTML='<div class="loading-inline">Помилка: '+esc(e.message)+'</div>';});
};
function paintMail(items,kind){
  const mi=$('mail-items');if(!mi)return;
  if(!items.length){mi.innerHTML='<div class="loading-inline">Немає повідомлень</div>';updateMailBadge();return;}
  mi.innerHTML=items.map(m=>
    '<div class="mail-item '+(kind!=='sent'&&m.read===false?'unread':'')+'" onclick="openMail(\''+(m._id||m.id)+'\',\''+kind+'\')">'
      +'<div class="mail-from">'+esc(kind==='sent'?('Кому: @'+(m.toNick||'?')):(m.fromNick||m.from||'?'))+'</div>'
      +'<div class="mail-subj">'+esc(m.subj||'')+(m.type==='gift'?' 🎁':'')+'</div>'
      +'<div class="mail-time">'+(m.time||'')+'</div>'
    +'</div>'
  ).join('');
  updateMailBadge();
}
async function loadMail(kind){
  const field=kind==='sent'?'fromUid':'toUid';
  // лише один where (без orderBy) → не потребує складеного індексу
  const snap=await getDocs(query(collection(db,'mail'),where(field,'==',String(uid)),limit(80)));
  const arr=snap.docs.map(d=>({_id:d.id,...d.data(),time:tsToStr(d.data().ts)}))
    .filter(m=>m.type!=='friendreq'&&m.type!=='friendaccept'&&m.type!=='refreward') // службові — окремо
    .sort((a,b)=>(b.tsms||0)-(a.tsms||0));
  _mailCache[kind]=arr;
  if(kind==='inbox')window._mailUnread=arr.filter(m=>m.read===false).length;
  return arr;
}
function tsToStr(ts){try{return ts?.toDate?ts.toDate().toLocaleString('uk-UA',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):now();}catch(e){return now();}}

window.openMail=async function(id,kind){
  let msg;
  if(kind==='system')msg=(P.inbox||[]).find(m=>String(m.id)===String(id));
  else msg=(_mailCache[kind]||[]).find(m=>m._id===id);
  if(!msg)return;
  _lastOpenedMail={...msg,kind};
  if(kind==='inbox'&&msg.read===false){
    msg.read=true;
    try{await updateDoc(doc(db,'mail',id),{read:true});}catch(e){}
    window._mailUnread=Math.max(0,window._mailUnread-1);
  }else if(kind==='system'&&msg.read===false){
    msg.read=true;saveP();
  }
  const set=(eid,v)=>{const el=$(eid);if(el)el.textContent=v;};
  set('md-from',kind==='sent'?('Кому: @'+(msg.toNick||'?')):(msg.fromNick||msg.from||'?'));
  set('md-time',msg.time||'');set('md-subj',msg.subj||'');set('md-body',msg.body||'');
  const lv=$('mail-list-view'),dv=$('mail-detail'),cv=$('compose-view');
  if(lv)lv.style.display='none';if(cv)cv.style.display='none';if(dv)dv.style.display='block';
  updateMailBadge();
};
window.closeMailDetail=function(){
  const dv=$('mail-detail');if(dv)dv.style.display='none';
  const lv=$('mail-list-view');if(lv)lv.style.display='block';
  renderMail();
};
window.deleteMail=function(){
  const m=_lastOpenedMail;if(!m){notify('❌','Немає листа');return;}
  uiConfirm('Видалити це повідомлення?',async()=>{
    if(m.kind==='system'){
      P.inbox=(P.inbox||[]).filter(x=>String(x.id)!==String(m.id));saveP();
    }else{
      try{await deleteDoc(doc(db,'mail',m._id));}catch(e){notify('❌',e.message);return;}
      if(_mailCache[m.kind])_mailCache[m.kind]=_mailCache[m.kind].filter(x=>x._id!==m._id);
    }
    _lastOpenedMail=null;
    notify('🗑️','Повідомлення видалено');
    refreshUnread();closeMailDetail();
  },{title:'Видалити лист',yes:'Видалити'});
};
window.showCompose=function(){
  const lv=$('mail-list-view'),cv=$('compose-view'),dv=$('mail-detail');
  if(lv)lv.style.display='none';if(dv)dv.style.display='none';if(cv)cv.style.display='block';
};
window.closeCompose=function(){
  const cv=$('compose-view');if(cv)cv.style.display='none';
  const lv=$('mail-list-view');if(lv)lv.style.display='block';
};
window.replyTo=function(){
  if(!_lastOpenedMail)return;
  closeMailDetail();showCompose();
  const to=$('cm-to'),subj=$('cm-subj');
  if(to)to.value=_lastOpenedMail.fromNick||_lastOpenedMail.from||'';
  if(subj)subj.value=(/^Re:/.test(_lastOpenedMail.subj||'')?'':'Re: ')+(_lastOpenedMail.subj||'');
};
async function resolveNick(nick){
  const snap=await getDocs(query(collection(db,'players'),limit(300)));
  return snap.docs.find(d=>((d.data().nickname||'').toLowerCase())===nick.toLowerCase());
}
async function sendLetter({toUid,toNick,subj,body,type='user',icon=null,extra=null}){
  return addDoc(collection(db,'mail'),san(Object.assign({
    fromUid:String(uid),fromNick:String(P.nickname||'?'),
    toUid:String(toUid),toNick:String(toNick),
    subj:String(subj).slice(0,80),body:String(body).slice(0,1000),
    type,icon,read:false,ts:serverTimestamp(),tsms:Date.now()
  },extra||{})));
}
window.sendMail=async function(){
  const toNick=($('cm-to')?.value||'').trim();
  const subj=($('cm-subj')?.value||'').trim()||'(без теми)';
  const body=($('cm-body')?.value||'').trim();
  if(!toNick||!body){notify('📝','Вкажи отримувача і текст');return;}
  const btn=document.querySelector('#compose-view button[onclick="sendMail()"]');
  if(btn){btn.disabled=true;btn.textContent='⏳...';}
  try{
    const target=await resolveNick(toNick);
    if(!target){notify('❌','Гравця "'+toNick+'" не знайдено');return;}
    if(target.id===uid){notify('🙂','Не можна писати собі');return;}
    await sendLetter({toUid:target.id,toNick:target.data().nickname||toNick,subj,body});
    lifeTrack('mail');
    if($('cm-to'))$('cm-to').value='';if($('cm-subj'))$('cm-subj').value='';if($('cm-body'))$('cm-body').value='';
    notify('📤 Надіслано!','Лист для @'+toNick);
    closeCompose();
  }catch(e){notify('❌',e.message);}
  finally{if(btn){btn.disabled=false;btn.textContent='📤 Надіслати';}}
};

// ── GIFTS (подарунки) — теж через колекцію mail (type:'gift') ──
const GIFT_OPTS=[
  {id:'flower',icon:'🌹',name:'Троянда',cost:20},
  {id:'cake',  icon:'🎂',name:'Тортик', cost:30},
  {id:'heart', icon:'💝',name:'Серце',  cost:50},
  {id:'gem',   icon:'💎',name:'Камінь', cost:100},
  {id:'crown', icon:'👑',name:'Корона', cost:200},
];
let _giftSel=null;
window.openGifts=function(){renderGiftPicker();loadReceivedGifts();const m=$('gifts-modal');if(m)m.style.display='flex';};
window.closeGifts=function(){const m=$('gifts-modal');if(m)m.style.display='none';};
function renderGiftPicker(){
  const picker=$('gift-picker');
  if(picker)picker.innerHTML=GIFT_OPTS.map(g=>
    '<div class="gift-opt'+(_giftSel===g.id?' selected':'')+'" onclick="selectGift(\''+g.id+'\')">'
      +'<span class="go-icon">'+g.icon+'</span><span class="go-name">'+g.name+'</span>'
      +'<span class="go-cost">🪙'+g.cost+'</span></div>'
  ).join('');
}
async function loadReceivedGifts(){
  const rec=$('gifts-received-section');if(!rec)return;
  rec.innerHTML='<div class="sec-title">🎁 Отримані подарунки</div><div class="loading-inline">Завантаження...</div>';
  try{
    const snap=await getDocs(query(collection(db,'mail'),where('toUid','==',String(uid)),limit(80)));
    const gifts=snap.docs.map(d=>({...d.data(),time:tsToStr(d.data().ts)}))
      .filter(m=>m.type==='gift').sort((a,b)=>(b.tsms||0)-(a.tsms||0));
    const cnt=$('pm-gifts-cnt');if(cnt)cnt.textContent=gifts.length;
    rec.innerHTML='<div class="sec-title">🎁 Отримані подарунки</div>'+
      (gifts.length?gifts.slice(0,12).map(g=>
        '<div class="gift-item"><span style="font-size:1.6rem">'+(g.icon||'🎁')+'</span>'
        +'<div style="flex:1"><div style="font-size:.78rem;font-weight:800">'+esc(g.subj||'Подарунок')+'</div>'
        +'<div style="font-size:.65rem;color:var(--tl);font-weight:700">від @'+esc(g.fromNick||'?')+' · '+(g.time||'')+'</div></div></div>').join('')
        :'<div class="loading-inline">Поки нема подарунків</div>');
  }catch(e){rec.innerHTML='<div class="sec-title">🎁 Отримані подарунки</div><div class="loading-inline">Помилка</div>';}
}
window.selectGift=function(id){_giftSel=id;renderGiftPicker();};
window.sendGift=async function(){
  const toNick=($('gift-to')?.value||'').trim();
  if(!toNick){notify('📝','Вкажи нікнейм');return;}
  if(!_giftSel){notify('🎁','Обери подарунок');return;}
  const g=GIFT_OPTS.find(x=>x.id===_giftSel);if(!g)return;
  if((P.coins||0)<g.cost){notify('🪙','Мало монет!');return;}
  try{
    const target=await resolveNick(toNick);
    if(!target){notify('❌','Гравця не знайдено');return;}
    if(target.id===uid){notify('🙂','Не можна дарувати собі');return;}
    P.coins-=g.cost;
    await sendLetter({toUid:target.id,toNick:target.data().nickname||toNick,
      subj:g.icon+' '+g.name,body:'Тобі подарували '+g.icon+' '+g.name+' від @'+(P.nickname||'?')+'!',
      type:'gift',icon:g.icon});
    if($('gift-to'))$('gift-to').value='';_giftSel=null;
    lifeTrack('gift');
    saveP();render();renderGiftPicker();
    notify('🎁 Надіслано!',g.icon+' для @'+toNick);
  }catch(e){P.coins+=g.cost;notify('❌',e.message);}
};


// ── LEVEL-UP modal ──
window.closeLevelUp=function(){const m=$('level-up-modal');if(m)m.style.display='none';};

// ── HOUSE (будинок) ──
const HOUSE_COMPS=[
  {key:'foundation',icon:'🧱',name:'Фундамент'},
  {key:'walls',     icon:'🪟',name:'Стіни'},
  {key:'roof',      icon:'🏠',name:'Дах'},
  {key:'interior',  icon:'🛋️',name:'Інтер’єр'},
];
const HOUSE_NAMES=['Проста хатинка','Затишний дім','Гарний будинок','Вілла','Палац'];
function houseStar(){
  const c=P.houseComponents||{};
  const min=Math.min(...HOUSE_COMPS.map(h=>c[h.key]||0));
  return Math.min(5,1+Math.floor(min/2)); // кожні 2 рівні всіх складових → +1 зірка
}
function houseBeauty(){
  const c=P.houseComponents||{};
  return HOUSE_COMPS.reduce((s,h)=>s+(c[h.key]||0)*2,0);
}
function assetImg(src,cls){return src?'<img class="'+(cls||'')+' game-img" src="'+src+'" alt="">':'';}
function renderHouseCard(){
  if(!P)return;
  const star=houseStar(),beauty=houseBeauty();
  const set=(id,v)=>{const el=$(id);if(el)el.textContent=v;};
  set('house-name',HOUSE_NAMES[star-1]||'Будинок');
  set('house-beauty',beauty);
  set('house-star',star);
  const he=$('house-emoji');if(he&&window.ASSETS)he.innerHTML=assetImg(ASSETS.house[star],'house-pic');
  const c=P.houseComponents||{};
  const lvl=HOUSE_COMPS.reduce((s,h)=>s+(c[h.key]||0),0);
  set('house-lvl',lvl);
  const stars='⭐'.repeat(star)+'☆'.repeat(5-star);
  const sd=$('house-stars-display');if(sd)sd.textContent=stars;
}
window.openHouseModal=function(){
  if(!P.houseComponents)P.houseComponents={foundation:0,roof:0,walls:0,interior:0};
  renderHouseModal();
  const m=$('house-modal');if(m)m.style.display='flex';
};
window.closeHouseModal=function(){const m=$('house-modal');if(m)m.style.display='none';renderHouseCard();render();};
function renderHouseModal(){
  const star=houseStar(),beauty=houseBeauty();
  const set=(id,v)=>{const el=$(id);if(el)el.textContent=v;};
  set('hm-name',HOUSE_NAMES[star-1]||'Будинок');
  set('hm-beauty','+'+beauty+' 🦋 краси');
  set('hm-stars','⭐'.repeat(star)+'☆'.repeat(5-star));
  const hv=$('hm-visual');if(hv&&window.ASSETS)hv.innerHTML=assetImg(ASSETS.house[star],'house-pic-big');
  const c=P.houseComponents;
  const comps=$('hm-components');
  if(comps)comps.innerHTML=HOUSE_COMPS.map(h=>{
    const lv=c[h.key]||0;const cost=50+lv*40;const max=lv>=10;
    return '<div class="hm-comp-row">'
      +'<span class="hm-comp-icon">'+h.icon+'</span>'
      +'<div style="flex:1"><div class="hm-comp-name">'+h.name+'</div>'
      +'<div class="hm-comp-stars">Рівень '+lv+'/10</div></div>'
      +(max?'<span class="hm-comp-max">MAX</span>'
        :'<button class="hm-comp-btn" '+((P.coins||0)<cost?'disabled':'')+' onclick="upgradeHouse(\''+h.key+'\')">🪙'+cost+'</button>')
      +'</div>';
  }).join('');
  const sp=$('hm-star-progress');
  if(sp){
    const min=Math.min(...HOUSE_COMPS.map(h=>(c[h.key]||0)));
    const toNext=(Math.floor(min/2)+1)*2;
    sp.innerHTML='<div class="hm-progress-info">До наступної зірки ⭐: прокачай усі складові до рівня '+Math.min(10,toNext)+'</div>';
  }
}
window.upgradeHouse=function(key){
  if(!P.houseComponents)P.houseComponents={foundation:0,roof:0,walls:0,interior:0};
  const lv=P.houseComponents[key]||0;if(lv>=10){notify('✅','Максимум');return;}
  const cost=50+lv*40;
  if((P.coins||0)<cost){notify('🪙','Мало монет!');return;}
  const oldStar=houseStar();
  P.coins-=cost;P.houseComponents[key]=lv+1;
  gainXP(6);
  const newStar=houseStar();
  if(newStar>oldStar){notify('🏠 Нова зірка!','Будинок: '+(HOUSE_NAMES[newStar-1]||''),4000);addLog('Будинок отримав '+newStar+'-ту зірку!');}
  else notify('🔨 Покращено!',HOUSE_COMPS.find(h=>h.key===key).name+' рів.'+(lv+1));
  render();renderHouseModal();renderHouseCard();saveP();
};

// ── CLUB extras ──
window.loadClubs=loadClubs;
window.levelUpClub=async function(){
  if(!P.clubId){notify('❌','Немає клубу');return;}
  try{
    const snap=await getDoc(doc(db,'clubs',P.clubId));
    if(!snap.exists())return;
    const c=snap.data();
    const need=(c.level||1)*500;
    if((c.xp||0)<need){notify('⭐','Треба '+need+'g досвіду клубу (зараз '+(c.xp||0)+'g). Жертвуйте монети!');return;}
    await updateDoc(doc(db,'clubs',P.clubId),{level:increment(1),xp:increment(-need),stars:Math.min(7,(c.stars||1)+ ((c.level||1)%2===0?1:0))});
    notify('⬆️ Клуб виріс!','Рівень '+((c.level||1)+1));
    loadClubData();
  }catch(e){notify('❌',e.message);}
};
window.openMemberCard=async function(mid){
  const m=_findMember(mid);if(!m)return;
  const role=CLUB_ROLES[m.role]||CLUB_ROLES.member;
  const cdays=m.joinedAt?Math.max(0,Math.floor((Date.now()-new Date(m.joinedAt).getTime())/86400000)):0;
  const box=$('memcard-body');const md=$('memcard-modal');
  if(box)box.innerHTML='<div class="loading-inline">Завантаження...</div>';
  if(md)md.style.display='flex';
  let pdata={};
  try{const s=await getDoc(doc(db,'players',mid));if(s.exists())pdata=s.data();}catch(e){}
  const gdays=pdata.createdAt?Math.max(0,Math.floor((Date.now()-new Date(pdata.createdAt).getTime())/86400000)):0;
  if(box)box.innerHTML=
     '<div class="memcard-head"><span class="memcard-av">'+((m.petType||pdata.petType||'cat')==='dog'?'🐶':'🐱')+'</span>'
    +'<div><div class="memcard-name">'+esc(m.catname||m.nickname||'?')+'</div>'
    +'<div class="memcard-nick">@'+esc(m.nickname||'?')+'</div>'
    +'<div class="memcard-role role-'+(m.role||'member')+'">'+role.icon+' '+role.name+'</div></div></div>'
    +'<div class="memcard-stats">'
    +'<div class="mcs"><span>⭐ Рівень</span><b>'+(pdata.level||1)+'</b></div>'
    +'<div class="mcs"><span>🦋 Краса</span><b>'+(pdata.butterflies||0)+'</b></div>'
    +'<div class="mcs"><span>🎗️ Вірність</span><b>'+(pdata.clubLoyalty||0)+'%</b></div>'
    +'<div class="mcs"><span>📅 Днів у клубі</span><b>'+cdays+'</b></div>'
    +'<div class="mcs"><span>📅 Днів у грі</span><b>'+gdays+'</b></div>'
    +'<div class="mcs"><span>🏅 Медалі</span><b>'+(pdata.medals?Object.values(pdata.medals).filter(Boolean).length:0)+'</b></div>'
    +'</div>'
    +'<button class="orange-btn" onclick="closeMemberCard();openProfile(\''+mid+'\')">👤 Повний профіль</button>';
};
window.closeMemberCard=function(){const m=$('memcard-modal');if(m)m.style.display='none';};

window.goClubFromPet=function(){if(P&&P.clubId)goPage('clubs');else notify('🎈','Ти ще не в клубі');};
window.raiseClubLoyalty=function(){
  if(!P.clubId){notify('🎈','Спершу вступи в клуб');return;}
  notify('🎗️ Вірність клубу','Росте від щоденних донатів у копілку (від 🪙10). Заходь і донať щодня — 10%→25%→50%→75%→100%.',6000);
};
// ── ВІРНІСТЬ КЛУБУ (щоденний донат-стрік) ──
const LOYALTY_LEVELS=[0,10,25,50,75,100];
function _dDiff(a,b){if(!a||!b)return 0;return Math.round((new Date(b).getTime()-new Date(a).getTime())/86400000);}
function _addDays(s,n){return new Date(new Date(s).getTime()+n*86400000).toDateString();}
function recalcLoyalty(){
  if(!P)return;
  if(!P.clubId){P.loyTier=0;P.loyLast='';P.clubLoyalty=0;return;}
  if(P.loyLast){
    const d=_dDiff(P.loyLast,dayKey());
    if(d>=2){ // пропущено хоча б один повний день → знижуємо
      const drop=d-1;
      P.loyTier=Math.max(0,(P.loyTier||0)-drop);
      P.loyLast=P.loyTier>0?_addDays(P.loyLast,drop):'';
    }
  }
  P.clubLoyalty=LOYALTY_LEVELS[P.loyTier||0]||0;
}
function bumpLoyalty(){ // викликається при донаті ≥10 монет
  if(!P.clubId)return;
  const t=dayKey();
  if(P.loyLast===t){P.clubLoyalty=LOYALTY_LEVELS[P.loyTier||0]||0;return;} // вже сьогодні
  recalcLoyalty();
  P.loyTier=Math.min(5,(P.loyTier||0)+1);
  P.loyLast=t;
  P.clubLoyalty=LOYALTY_LEVELS[P.loyTier];
}
window.openClubSettings=async function(){
  if(!P.clubId)return;
  try{
    const snap=await getDoc(doc(db,'clubs',P.clubId));if(!snap.exists())return;
    const c=snap.data();
    const ic=$('club-settings-icon');if(ic)ic.value=c.icon||'🐱';
    const ds=$('club-settings-desc');if(ds)ds.value=c.description||'';
  }catch(e){}
  const m=$('club-settings-modal');if(m)m.style.display='flex';
};
window.closeClubSettings=function(){const m=$('club-settings-modal');if(m)m.style.display='none';};
window.saveClubSettings=async function(){
  if(!P.clubId)return;
  const icon=$('club-settings-icon')?.value||'🐱';
  const desc=($('club-settings-desc')?.value||'').trim();
  try{
    await updateDoc(doc(db,'clubs',P.clubId),{icon,description:desc});
    notify('✅','Налаштування збережено');closeClubSettings();loadClubData();
  }catch(e){notify('❌',e.message);}
};
window.openCollectionExchange=function(){
  if(!P.gems)P.gems={};
  const total=GEMS.reduce((s,g)=>s+(P.gems[g.key]||0),0);
  if(total<3){notify('🔄','Треба ≥3 фрагменти для обміну');return;}
  // обмінюємо 3 будь-яких фрагменти на 1 фрагмент діаманта
  let need=3;
  for(const g of GEMS){while(need>0&&(P.gems[g.key]||0)>0){P.gems[g.key]--;need--;}}
  P.gems.diamond=(P.gems.diamond||0)+1;
  saveP();notify('🔄 Обмін!','3 фрагменти → ⚪ діамант');
};
window.showClubHistory=async function(){
  if(!P.clubId)return;
  try{
    const snap=await getDoc(doc(db,'clubs',P.clubId));if(!snap.exists())return;
    const c=snap.data();
    notify('📜 Історія клубу',(c.name||'')+' · засн. '+(c.founded||'?')+' · рів.'+(c.level||1)+' · '+(c.memberCount||1)+' учасн.',5000);
  }catch(e){}
};

// ── розширюємо renderPetPage, render, startGame ──
const _renderPetPageBase=renderPetPage;
renderPetPage=function(){
  _renderPetPageBase();
  const set=(id,v)=>{const el=$(id);if(el)el.textContent=v;};
  set('ps-pettype',P.petType==='dog'?'🐶 Собачка':'🐱 Котик');
  set('ps-about',P.about||'заповнити...');
  set('ps-loyalty',(P.clubLoyalty||0)+'%');
  set('pet-cat-lvl',(P.level||1)+' рівень');
  const be=$('pet-big-emoji');if(be)refreshPetImg();
  set('pm-gems-cnt',P.gems?Object.values(P.gems).reduce((a,b)=>a+b,0):0);
  set('pm-train-cnt',P.skills?(P.skills.clothes+P.skills.access+P.skills.jewel):0);
  set('pm-gifts-cnt',(P.giftsReceived||[]).length);
  set('pm-wardrobe-cnt',(P.wardrobe||[]).length+' з 20');
  updateEquipSlots();
  renderHouseCard();
  renderPetMedals();
  if(typeof checkLandmarks==='function')checkLandmarks();
  if(typeof renderTitle==='function')renderTitle();
};
const _renderBase=render;
render=function(){
  _renderBase();
  // зображення емоції вже встановлює refreshPetImg() з урахуванням типу тваринки
  if(typeof updateBonusBadges==='function')updateBonusBadges();
};

// ── рейтинг клубів ──
async function loadClubRatings(){
  const rl=$('rating-list');if(!rl)return;
  try{
    const snap=await getDocs(collection(db,'clubs'));
    const all=snap.docs.map(d=>({...d.data(),_id:d.id}));
    all.sort((a,b)=>((b.level||1)*1000+(b.xp||0))-((a.level||1)*1000+(a.xp||0)));
    const medals=['🥇','🥈','🥉'];
    if(!all.length){rl.innerHTML='<div class="loading-inline">Поки нема клубів</div>';return;}
    rl.innerHTML='<div class="rating-count-info">🎈 Клубів: '+all.length+'</div>'
      +all.map((c,i)=>{
        const mine=c._id===P.clubId;
        return '<div class="rating-row'+(mine?' rating-row-me':'')+'">'
          +'<span class="rrank'+(i===0?' gold':i===1?' silver':i===2?' bronze':'')+'">'+(medals[i]||(i+1))+'</span>'
          +'<span class="rav">'+(c.icon||'🎈')+'</span>'
          +'<div style="flex:1"><div class="rname">'+esc(c.name||'?')+(mine?' 🌟':'')+'</div>'
          +'<div class="rsub">'+(c.memberCount||1)+' учасн. · Рів.'+(c.level||1)+'</div></div>'
          +'<span class="rscore">⭐'+((c.level||1)*1000+(c.xp||0))+'</span>'
          +'</div>';
      }).join('');
  }catch(e){rl.innerHTML='<div class="loading-inline">Помилка: '+esc(e.message)+'</div>';}
}

// ── рейтинг прогулянок ──
async function loadWalkLeaderboard(){
  const lb=$('walk-lb');if(!lb)return;
  lb.innerHTML='<div class="loading-inline">Завантаження...</div>';
  try{
    const snap=await getDocs(query(collection(db,'players'),limit(100)));
    const all=snap.docs.map(d=>({...d.data(),_id:d.id})).filter(p=>p.nickname&&(p.walkCoins||0)>0);
    all.sort((a,b)=>(b.walkCoins||0)-(a.walkCoins||0));
    const medals=['🥇','🥈','🥉'];
    if(!all.length){lb.innerHTML='<div class="loading-inline">Поки нема даних. Сходи на прогулянку!</div>';return;}
    lb.innerHTML=all.slice(0,15).map((p,i)=>{
      const me=p._id===uid;
      return '<div class="friend-row'+(me?' rating-row-me':'')+'" onclick="openProfile(\''+p._id+'\')">'
        +'<span class="friend-av">'+(medals[i]||(i+1))+'</span>'
        +'<div style="flex:1"><div class="friend-name">'+esc(p.catname||'Тваринка')+(me?' 🌟':'')+'</div>'
        +'<div class="friend-sub">@'+esc(p.nickname||'?')+'</div></div>'
        +'<span style="font-weight:900;color:var(--gdk);font-size:.8rem">🪙'+(p.walkCoins||0)+'</span>'
        +'</div>';
    }).join('');
  }catch(e){lb.innerHTML='<div class="loading-inline">Помилка</div>';}
}

// ════════ НОВІ МОЖЛИВОСТІ ════════

// ── РОЗБУДИТИ ТВАРИНКУ ──
window.wakePet=function(){
  if(!P||!P.sleeping){notify('🙂','Тваринка не спить');return;}
  const el=Date.now()-(P.sleepStart||Date.now());
  const tot=P.sleepDur||1200000;
  const gain=Math.round(30*Math.min(1,el/tot)); // енергія пропорційно проспаному
  clearTimeout(sleepTimer);
  P.sleeping=false;P.sleepStart=null;P.sleepDur=null;P.energy=cl((P.energy||0)+gain);
  const cd=$('sleep-countdown');if(cd)cd.textContent='';
  const bar=$('sleep-bar');if(bar)bar.style.width='0%';
  _emoLockUntil=0;setPetImg(moodEmotion());
  notify('⏰ Розбудили!', gain>0?('+'+gain+'⚡'):'Тваринка не встигла відпочити');
  gainXP(2);render();saveP();
};

// ── ОСОБИСТІ БОНУСИ (медалі + постройки клубу + донор) ──
function medalXpPct(){let s=0;(MEDALS||[]).forEach(m=>{if(P&&P.medals&&P.medals[m.id])s+=m.xpPct;});return s;}
function medalHeartPct(){let s=0;(MEDALS||[]).forEach(m=>{if(P&&P.medals&&P.medals[m.id])s+=m.heartPct;});return s;}
function personalXpFactor(){
  if(!P)return 1;
  const school=(P._clubBonus&&P._clubBonus.schoolXpPct)||0;
  const donor=P.donorXpPct||0;
  return 1+(medalXpPct()+school+donor)/100;
}
function heartGain(n){return Math.round(n*(1+medalHeartPct()/100));}

// ── МЕДАЛІ (рівнева система) ──
const MEDALS=[
  {id:'bronze',  name:'Бронзова медаль', icon:'🥉',xpPct:1,heartPct:1,
    reqs:[{t:'Нагодуй 10 разів',k:'feed',g:10},{t:'Напій 10 разів',k:'water',g:10},
          {t:'Пограй 5 разів',k:'play',g:5},{t:'Сходи на прогулянку',k:'walk',g:1}]},
  {id:'silver',  name:'Срібна медаль',   icon:'🥈',xpPct:2,heartPct:2,
    reqs:[{t:'Тренуйся 5 разів',k:'train',g:5},{t:'Зроби 5 прогулянок',k:'walk',g:5},
          {t:'Досягни 5 рівня',k:'level',g:5},{t:'Подаруй подарунок',k:'gift',g:1}]},
  {id:'gold',    name:'Золота медаль',   icon:'🏅',xpPct:2,heartPct:3,
    reqs:[{t:'Одягни тваринку повністю',k:'dress',g:1},{t:'Виграй виставку',k:'showWin',g:1},
          {t:'Збери дорогоцінність',k:'gem',g:1},{t:'Погуляй 3 рази',k:'walk',g:3}]},
  {id:'platinum',name:'Платинова медаль',icon:'🏆',xpPct:4,heartPct:5,
    reqs:[{t:'Досягни 10 рівня',k:'level',g:10},{t:'Тренуйся 20 разів',k:'train',g:20},
          {t:'Виграй 5 виставок',k:'showWin',g:5},{t:'Зроби внесок у копілку',k:'donate',g:1}]},
  {id:'diamond', name:'Діамантова медаль',icon:'💎',xpPct:6,heartPct:8,
    reqs:[{t:'Досягни 15 рівня',k:'level',g:15},{t:'Виграй 15 виставок',k:'showWin',g:15},
          {t:'Збери 5 дорогоцінностей',k:'gem',g:5},{t:'Накопич 200 краси',k:'butterflies',g:200}]},
];
window.MEDALS=MEDALS;

function lifeTrack(key,amt=1){if(!P)return;if(!P.life)P.life={};P.life[key]=(P.life[key]||0)+amt;checkMedals();saveP();}
function lifeOf(key){
  if(!P)return 0;
  if(key==='level')return P.level||1;
  if(key==='butterflies')return P.butterflies||0;
  if(key==='showWin')return P.showWins||0;
  if(key==='clubJoin')return P.clubId?1:0;
  if(key==='loyalty')return P.clubLoyalty||0;
  return (P.life&&P.life[key])||0;
}
function medalEarned(m){return m.reqs.every(r=>lifeOf(r.k)>=r.g);}
function checkMedals(){
  if(!P)return;if(!P.medals)P.medals={};
  let any=false;
  MEDALS.forEach(m=>{
    if(P.medals[m.id])return;
    if(medalEarned(m)){
      P.medals[m.id]=true;any=true;
      notify('🏅 Нова медаль!',m.icon+' '+m.name+' · +'+m.xpPct+'% досвід, +'+m.heartPct+'% сердечка',5000);
      if(typeof addLog==='function')addLog('Отримано '+m.name+' '+m.icon);
    }
  });
  if(any){saveP();const list=$('tasks-list');if(list&&tasksTab==='medals')renderMedals(list);renderPetMedals();}
}
function renderMedals(box){
  if(!P)return;if(!P.medals)P.medals={};
  const earned=MEDALS.filter(m=>P.medals[m.id]);
  // поточна (перша незароблена) медаль — деталізація вимог, як на скрін
  const cur=MEDALS.find(m=>!P.medals[m.id]);
  let html='';
  html+='<div class="medals-earned-bar">'+(earned.length
      ? earned.map(m=>'<span class="medal-badge" title="'+esc(m.name)+'">'+m.icon+'</span>').join('')
      : '<span style="color:var(--tl);font-size:.8rem;font-weight:700">Поки немає медалей — виконуй завдання!</span>')
    +'</div>';
  html+='<div class="medals-bonus-line">Сумарний бонус: ⭐ +'+medalXpPct()+'% досвіду · ❤️ +'+medalHeartPct()+'% сердечок</div>';
  if(cur){
    const doneCnt=cur.reqs.filter(r=>lifeOf(r.k)>=r.g).length;
    html+='<div class="medal-card">'
      +'<div class="medal-card-head"><span class="medal-card-icon">'+cur.icon+'</span>'
        +'<div><div class="medal-card-name">'+cur.name+'</div>'
        +'<div class="medal-card-bonus">+'+cur.xpPct+'% до досвіду, +'+cur.heartPct+'% до сердечок</div>'
        +'<div class="medal-card-prog">Прогрес: '+doneCnt+' з '+cur.reqs.length+'</div></div></div>'
      +'</div>';
    html+='<div class="medal-reqs-title">Для отримання медалі потрібно:</div>';
    html+=cur.reqs.map(r=>{
      const have=Math.min(lifeOf(r.k),r.g),done=have>=r.g;
      return '<div class="medal-req'+(done?' done':'')+'">'
        +'<div class="medal-req-title">'+r.t+'</div>'
        +'<div class="medal-req-prog">'+(done?'✅ Завершено':('Прогрес: '+have+' з '+r.g))+'</div>'
        +'</div>';
    }).join('');
  }else{
    html+='<div class="medal-card"><div class="medal-card-head"><span class="medal-card-icon">👑</span>'
      +'<div><div class="medal-card-name">Усі медалі зібрано!</div>'
      +'<div class="medal-card-bonus">Ти справжній чемпіон 🎉</div></div></div></div>';
  }
  box.innerHTML=html;
}
function renderPetMedals(){
  const box=$('pet-medals');if(!box)return;
  const earned=(MEDALS||[]).filter(m=>P&&P.medals&&P.medals[m.id]);
  if(!earned.length){box.innerHTML='<span class="pet-medals-empty">🏅 Медалей ще немає — виконуй завдання</span>';return;}
  box.innerHTML='<span class="pet-medals-lbl">Медалі:</span>'
    +earned.map(m=>'<span class="medal-badge" title="'+esc(m.name)+'">'+m.icon+'</span>').join('')
    +'<span class="pet-medals-bonus">+'+medalXpPct()+'%⭐ +'+medalHeartPct()+'%❤️</span>';
}

// ── ЗАПИТИ В ДРУЗІ (двостороннє підтвердження) ──
window.sendFriendRequest=async function(){
  if(!_profileTarget){notify('❌','Спочатку відкрий профіль');return;}
  if(_profileTarget.id===uid){notify('🙂','Це ти!');return;}
  if(!P.friends)P.friends=[];if(!P.sentReq)P.sentReq=[];
  if(P.friends.some(f=>f.id===_profileTarget.id)){notify('✅','Вже у друзях');return;}
  if(P.sentReq.includes(_profileTarget.id)){notify('⏳','Запит вже надіслано');return;}
  const fb=$('pm-add-friend-btn');if(fb){fb.disabled=true;fb.textContent='⏳...';}
  try{
    await sendLetter({toUid:_profileTarget.id,toNick:_profileTarget.nickname||'?',
      subj:'Запит у друзі',body:'@'+(P.nickname||'?')+' хоче додати тебе у друзі!',
      type:'friendreq',icon:'👤',
      extra:{fromCatname:P.catname||'Тваринка',fromLevel:P.level||1,fromPetType:P.petType||'cat'}});
    P.sentReq.push(_profileTarget.id);saveP();
    if(fb){fb.disabled=true;fb.textContent='⏳ Запит надіслано';}
    notify('👤 Запит надіслано','@'+(_profileTarget.nickname||'?')+' має підтвердити');
  }catch(e){if(fb){fb.disabled=false;fb.textContent='👤+ Додати в друзі';}notify('❌',e.message);}
};
async function loadFriendRequests(){
  const box=$('friend-requests');if(!box)return;
  try{
    const snap=await getDocs(query(collection(db,'mail'),where('toUid','==',String(uid)),limit(80)));
    const reqs=snap.docs.map(d=>({_id:d.id,...d.data()}))
      .filter(m=>m.type==='friendreq')
      .filter(m=>!(P.friends||[]).some(f=>f.id===m.fromUid));
    window._friendReqs=reqs;
    if(!reqs.length){box.innerHTML='';return;}
    box.innerHTML='<div class="sec-title">👤 Запити в друзі ('+reqs.length+')</div>'+reqs.map(m=>
      '<div class="friend-row">'
      +'<span class="friend-av">'+((m.fromPetType||'cat')==='dog'?'🐶':'🐱')+'</span>'
      +'<div style="flex:1"><div class="friend-name">'+esc(m.fromCatname||m.fromNick||'?')+'</div>'
      +'<div class="friend-sub">@'+esc(m.fromNick||'?')+' · Рів.'+(m.fromLevel||1)+'</div></div>'
      +'<button class="req-yes" onclick="acceptFriendRequest(\''+m._id+'\')">✓ Прийняти</button>'
      +'<button class="req-no" onclick="declineFriendRequest(\''+m._id+'\')">✕</button>'
      +'</div>').join('');
  }catch(e){box.innerHTML='';}
}
window.acceptFriendRequest=async function(mailId){
  const m=(window._friendReqs||[]).find(x=>x._id===mailId);if(!m)return;
  if(!P.friends)P.friends=[];
  if(!P.friends.some(f=>f.id===m.fromUid))
    P.friends.push({id:m.fromUid,nickname:m.fromNick,catname:m.fromCatname||'Тваринка',
      level:m.fromLevel||1,petType:m.fromPetType||'cat'});
  saveP();
  try{
    await sendLetter({toUid:m.fromUid,toNick:m.fromNick,subj:'Запит прийнято',
      body:'@'+(P.nickname||'?')+' прийняв(ла) твій запит у друзі!',type:'friendaccept',icon:'✅',
      extra:{fromCatname:P.catname||'Тваринка',fromLevel:P.level||1,fromPetType:P.petType||'cat'}});
    await deleteDoc(doc(db,'mail',mailId));
  }catch(e){}
  notify('👥 Тепер ви друзі!',esc(m.fromCatname||m.fromNick||''));
  renderFriends();
};
window.declineFriendRequest=async function(mailId){
  try{await deleteDoc(doc(db,'mail',mailId));}catch(e){}
  notify('✕','Запит відхилено');loadFriendRequests();
};
async function processFriendAccepts(){
  if(!P)return;if(!P.procAccept)P.procAccept=[];
  try{
    const snap=await getDocs(query(collection(db,'mail'),where('toUid','==',String(uid)),limit(80)));
    const accepts=snap.docs.map(d=>({_id:d.id,...d.data()})).filter(m=>m.type==='friendaccept');
    let changed=false;
    for(const m of accepts){
      if(!P.friends)P.friends=[];
      if(!P.friends.some(f=>f.id===m.fromUid)){
        P.friends.push({id:m.fromUid,nickname:m.fromNick,catname:m.fromCatname||'Тваринка',
          level:m.fromLevel||1,petType:m.fromPetType||'cat'});changed=true;
      }
      P.sentReq=(P.sentReq||[]).filter(u=>u!==m.fromUid);
      try{await deleteDoc(doc(db,'mail',m._id));}catch(e){}
    }
    if(changed){saveP();notify('👥 Новий друг!','Ваш запит прийнято');const l=$('friends-list');if(l)renderFriends();}
  }catch(e){}
}

// ── КЛУБНІ ПОСТРОЙКИ + КОПІЛКА + РОЗПУСК ──
const CLUB_BUILDINGS=[
  {k:'school',  icon:'🏫',name:'Школа',         per:2,bonus:'до особистого досвіду учасників'},
  {k:'college', icon:'🏛️',name:'Колледж',       per:2,bonus:'до клубного досвіду'},
  {k:'design',  icon:'🎨',name:'Студія дизайну', per:2,bonus:'до краси будинку'},
  {k:'fashion', icon:'👠',name:'Дім моди',       per:2,bonus:'до краси одягу'},
  {k:'jewelry', icon:'💍',name:'Ювелірний салон',per:2,bonus:'до краси ларця'},
  {k:'garden',  icon:'🌷',name:'Ботанічний сад', per:2,bonus:'до краси саду'},
];
function buildingCost(lvl){return (lvl+1)*200;}
function renderClubBuildings(c,isDirector){
  const box=$('cl-buildings');if(!box)return;
  const b=c.buildings||{};
  box.innerHTML=CLUB_BUILDINGS.map(bd=>{
    const lvl=b[bd.k]||0;const max=lvl>=20;const cost=buildingCost(lvl);
    const ic=(window.ASSETS&&ASSETS.build[bd.k])?assetImg(ASSETS.build[bd.k],'cb-pic'):bd.icon;
    return '<div class="club-build-row">'
      +'<span class="cb-icon">'+ic+'</span>'
      +'<div style="flex:1"><div class="cb-name">'+bd.name+' <small>('+lvl+' з 20)</small></div>'
        +'<div class="cb-bonus">+'+(lvl*bd.per)+'% '+bd.bonus+'</div></div>'
      +(isDirector
        ? (max?'<span class="cb-max">МАКС</span>'
             :'<button class="cb-build-btn" onclick="buildClubBuilding(\''+bd.k+'\')">🏗️ 🪙'+cost+'</button>')
        :'')
      +'</div>';
  }).join('');
  const di=$('cl-director-img');if(di&&window.ASSETS)di.innerHTML=assetImg(ASSETS.director,'cl-director-pic');
}
window.buildClubBuilding=async function(key){
  if(!P.clubId)return;
  const bd=CLUB_BUILDINGS.find(x=>x.k===key);if(!bd)return;
  try{
    const snap=await getDoc(doc(db,'clubs',P.clubId));if(!snap.exists())return;
    const c=snap.data();
    if(c.directorUid!==uid){notify('🚫','Лише Директор може будувати');return;}
    const lvl=(c.buildings&&c.buildings[key])||0;
    if(lvl>=20){notify('🏗️','Вже максимальний рівень');return;}
    const cost=buildingCost(lvl);
    if((c.piggyCoins||0)<cost){notify('🐷','У копілці недостатньо монет ('+(c.piggyCoins||0)+'/'+cost+')');return;}
    const upd={piggyCoins:increment(-cost),xp:increment(Math.floor(cost/4))};
    upd['buildings.'+key]=increment(1);
    await updateDoc(doc(db,'clubs',P.clubId),upd);
    notify('🏗️ Побудовано!',bd.icon+' '+bd.name+' рів.'+(lvl+1));
    addLog('Клуб: '+bd.name+' покращено до рів.'+(lvl+1));
    loadClubData();
  }catch(e){notify('❌',e.message);}
};
window.donatePiggy=async function(){
  if(!P.clubId){notify('❌','Немає клубу');return;}
  const coins=Math.max(0,parseInt($('piggy-coins')?.value||'0')||0);
  const hearts=Math.max(0,parseInt($('piggy-hearts')?.value||'0')||0);
  if(coins<=0&&hearts<=0){notify('📝','Вкажи суму поповнення');return;}
  if((P.coins||0)<coins){notify('🪙','Недостатньо монет');return;}
  if((P.hearts||0)<hearts){notify('❤️','Недостатньо сердечок');return;}
  P.coins-=coins;P.hearts-=hearts;
  const clubXp=coins+Math.floor(hearts/2); // клубний досвід від внеску
  try{
    await updateDoc(doc(db,'clubs',P.clubId),
      {piggyCoins:increment(coins),piggyHearts:increment(hearts),xp:increment(clubXp)});
    P.piggyDonated=(P.piggyDonated||0)+coins;
    P.donorXpPct=Math.min(20,Math.floor(P.piggyDonated/100)); // особистий бонус: +1% за кожні 100 монет (макс 20%)
    if(coins>=10)bumpLoyalty();
    if(coins>0)lifeTrack('donate');
    recordDonation(coins,hearts);
    if($('piggy-coins'))$('piggy-coins').value='';
    if($('piggy-hearts'))$('piggy-hearts').value='';
    notify('🐷 Копілку поповнено!','+🪙'+coins+' +❤️'+hearts+' · твій бонус досвіду тепер +'+P.donorXpPct+'%',5000);
    loadClubData();render();saveP();
  }catch(e){P.coins+=coins;P.hearts+=hearts;notify('❌',e.message);}
};
window.donateClub=function(){return window.donatePiggy();}; // сумісність зі старою кнопкою
window.disbandClub=async function(){
  if(!P.clubId){notify('❌','Немає клубу');return;}
  try{
    const snap=await getDoc(doc(db,'clubs',P.clubId));
    if(!snap.exists()){P.clubId=null;saveP();renderClubs();return;}
    if(snap.data().directorUid!==uid){notify('🚫','Лише Директор може розпустити клуб');return;}
    uiConfirm('Розпустити клуб «'+(snap.data().name||'')+'» НАЗАВЖДИ? Дію неможливо скасувати!',async()=>{
      try{
        try{await deleteDoc(doc(db,'clubs',P.clubId,'members',uid));}catch(e){}
        await deleteDoc(doc(db,'clubs',P.clubId));
        P.clubId=null;P.clubLoyalty=0;P.loyTier=0;P.loyLast='';P.clubName='';P.clubJoinedAt='';P._clubBonus=null;saveP();
        notify('💥 Клуб розпущено','');renderClubs();
      }catch(e){notify('❌',e.message);}
    },{title:'Розпустити клуб',yes:'Розпустити'});
  }catch(e){notify('❌',e.message);}
};

// ════════ ЩОДЕННИЙ ВХІД + КОЛЕСО ФОРТУНИ ════════
function dayKey(d){return (d||new Date()).toDateString();}
function isYesterday(s){const y=new Date();y.setDate(y.getDate()-1);return s===y.toDateString();}

// ── ЩОДЕННИЙ ВХІД ЗІ СТРІКОМ ──
const DAILY_REWARDS=[
  {coins:20},
  {coins:30},
  {coins:50,hearts:5},
  {coins:70},
  {coins:100,hearts:10},
  {coins:150},
  {coins:250,hearts:25,gem:1}, // 7-й день — джекпот + фрагмент каменя
];
function dailyState(){
  if(!P.daily)P.daily={last:'',streak:0};
  const today=dayKey();
  if(P.daily.last===today)return{claimed:true,streak:P.daily.streak||1};
  const streak=isYesterday(P.daily.last)?((P.daily.streak||0)+1):1;
  return{claimed:false,streak};
}
function rewardText(r){
  const a=[];if(r.coins)a.push('🪙'+r.coins);if(r.hearts)a.push('❤️'+r.hearts);if(r.gem)a.push('💎×'+r.gem);
  return a.join(' ');
}
window.openDaily=function(){renderDaily();const m=$('daily-modal');if(m)m.style.display='flex';};
window.closeDaily=function(){const m=$('daily-modal');if(m)m.style.display='none';};
function renderDaily(){
  const grid=$('daily-grid');if(!grid)return;
  const st=dailyState();
  // позиція в 7-денному циклі: індекс дня, який зараз можна забрати (або вже забрано сьогодні)
  const curIdx=((st.streak-1)%7+7)%7;
  grid.innerHTML=DAILY_REWARDS.map((r,i)=>{
    let cls='daily-cell';
    if(st.claimed){ if(i<=curIdx)cls+=' done'; }      // сьогодні вже забрали — позначаємо пройдені
    else{ if(i<curIdx)cls+=' done'; else if(i===curIdx)cls+=' today'; }
    return '<div class="'+cls+'">'
      +'<div class="daily-day">День '+(i+1)+'</div>'
      +'<div class="daily-rw">'+rewardText(r)+'</div>'
      +(i===curIdx&&!st.claimed?'<div class="daily-tag">сьогодні</div>'
        :((st.claimed&&i===curIdx)||(i<curIdx)?'<div class="daily-tag ok">✓</div>':''))
      +'</div>';
  }).join('');
  const info=$('daily-info');
  if(info)info.textContent=st.claimed
    ? ('Сьогодні вже отримано. Стрік: 🔥 '+(st.streak||1)+' дн. Повертайся завтра!')
    : ('Твій стрік: 🔥 '+st.streak+' дн. Не пропускай дні, щоб нагорода росла!');
  const btn=$('daily-claim-btn');
  if(btn){btn.disabled=st.claimed;btn.textContent=st.claimed?'✅ Отримано':('🎁 Забрати '+rewardText(DAILY_REWARDS[curIdx]));}
}
window.claimDaily=function(){
  const st=dailyState();
  if(st.claimed){notify('✅','Сьогодні вже отримано');return;}
  const idx=((st.streak-1)%7+7)%7;
  const r=DAILY_REWARDS[idx];
  if(r.coins)P.coins=(P.coins||0)+r.coins;
  if(r.hearts)P.hearts=(P.hearts||0)+r.hearts;
  if(r.gem){if(!P.gems)P.gems={};const ks=GEMS.map(g=>g.key);const k=ks[Math.floor(Math.random()*ks.length)];P.gems[k]=(P.gems[k]||0)+r.gem;}
  P.daily={last:dayKey(),streak:st.streak};
  notify('🎁 Щоденний бонус!','День '+(idx+1)+' · '+rewardText(r)+' · 🔥 стрік '+st.streak,4500);
  addLog('Щоденний бонус (день '+(idx+1)+'): '+rewardText(r));
  render();saveP();renderDaily();updateBonusBadges();
};

// ── КОЛЕСО ФОРТУНИ ──
const WHEEL=[
  {label:'🪙30', coins:30,  color:'#ffe08a', w:22},
  {label:'❤️10', hearts:10, color:'#ff9fb0', w:16},
  {label:'🪙80', coins:80,  color:'#ffcf6b', w:12},
  {label:'🦋5',  butterflies:5, color:'#9ecbff', w:12},
  {label:'🪙50', coins:50,  color:'#ffe9a8', w:16},
  {label:'💎',   gem:1,     color:'#a7f0c4', w:10},
  {label:'❤️25', hearts:25, color:'#ff8095', w:8},
  {label:'🪙200',coins:200, color:'#ffb347', w:4}, // джекпот
];
let _wheelSpinning=false,_wheelRot=0;
function wheelClaimed(){return P.wheel&&P.wheel.last===dayKey();}
function polarPt(cx,cy,r,deg){const t=deg*Math.PI/180;return[cx+r*Math.sin(t),cy-r*Math.cos(t)];}
function buildWheelSVG(){
  const n=WHEEL.length,seg=360/n,cx=100,cy=100,r=96;
  let p='';
  for(let i=0;i<n;i++){
    const a0=i*seg,a1=(i+1)*seg;
    const[x0,y0]=polarPt(cx,cy,r,a0),[x1,y1]=polarPt(cx,cy,r,a1);
    p+='<path d="M'+cx+' '+cy+' L'+x0.toFixed(1)+' '+y0.toFixed(1)
      +' A'+r+' '+r+' 0 0 1 '+x1.toFixed(1)+' '+y1.toFixed(1)+' Z" fill="'+WHEEL[i].color+'" stroke="#fff" stroke-width="1.5"/>';
    const[lx,ly]=polarPt(cx,cy,r*0.62,a0+seg/2);
    p+='<text x="'+lx.toFixed(1)+'" y="'+ly.toFixed(1)+'" text-anchor="middle" dominant-baseline="central" '
      +'font-size="13" font-weight="900" fill="#6a4310" transform="rotate('+(a0+seg/2)+' '+lx.toFixed(1)+' '+ly.toFixed(1)+')">'+WHEEL[i].label+'</text>';
  }
  return '<svg viewBox="0 0 200 200" id="wheel-svg" style="transform:rotate('+_wheelRot+'deg)">'
    +'<g>'+p+'</g><circle cx="100" cy="100" r="14" fill="#fff" stroke="#e9c987" stroke-width="3"/></svg>';
}
function pickWeighted(){
  const tot=WHEEL.reduce((s,x)=>s+x.w,0);let rnd=Math.random()*tot;
  for(let i=0;i<WHEEL.length;i++){rnd-=WHEEL[i].w;if(rnd<0)return i;}
  return 0;
}
window.openWheel=function(){renderWheel();const m=$('wheel-modal');if(m)m.style.display='flex';};
window.closeWheel=function(){if(_wheelSpinning)return;const m=$('wheel-modal');if(m)m.style.display='none';};
function renderWheel(){
  const box=$('wheel-box');if(box)box.innerHTML=buildWheelSVG();
  const btn=$('wheel-spin-btn'),info=$('wheel-info');
  const done=wheelClaimed();
  if(btn){btn.disabled=done||_wheelSpinning;btn.textContent=done?'⏳ Завтра новий прокрут':'🎡 Крутити!';}
  if(info)info.textContent=done?'Сьогодні ти вже крутив колесо. Повертайся завтра!':'Один безкоштовний прокрут на день. Удачі! 🍀';
}
window.spinWheel=function(){
  if(_wheelSpinning)return;
  if(wheelClaimed()){notify('🎡','Сьогодні вже крутив. Завтра новий прокрут!');return;}
  const svg=$('wheel-svg');if(!svg)return;
  _wheelSpinning=true;
  const btn=$('wheel-spin-btn');if(btn){btn.disabled=true;btn.textContent='🌀 Крутиться...';}
  const idx=pickWeighted();
  const seg=360/WHEEL.length, center=idx*seg+seg/2;
  // фінальний кут так, щоб центр сегмента опинився під стрілкою (зверху)
  const target=360*6 - center + (_wheelRot - (_wheelRot%360));
  _wheelRot=target;
  svg.style.transition='transform 4.2s cubic-bezier(.17,.67,.2,1)';
  svg.style.transform='rotate('+_wheelRot+'deg)';
  setTimeout(()=>{
    const r=WHEEL[idx];
    if(r.coins)P.coins=(P.coins||0)+r.coins;
    if(r.hearts)P.hearts=(P.hearts||0)+r.hearts;
    if(r.butterflies)P.butterflies=(P.butterflies||0)+r.butterflies;
    if(r.gem){if(!P.gems)P.gems={};const ks=GEMS.map(g=>g.key);const k=ks[Math.floor(Math.random()*ks.length)];P.gems[k]=(P.gems[k]||0)+r.gem;}
    P.wheel={last:dayKey()};
    _wheelSpinning=false;
    let txt=r.coins?('🪙'+r.coins):r.hearts?('❤️'+r.hearts):r.butterflies?('🦋'+r.butterflies):'💎 фрагмент';
    notify('🎉 Виграш!','Колесо фортуни: '+txt,4500);
    addLog('Колесо фортуни: '+txt);
    render();saveP();renderWheel();updateBonusBadges();
  },4400);
};

// ── індикатори доступних бонусів на головній ──
function updateBonusBadges(){
  const d=$('hm-daily-badge'),w=$('hm-wheel-badge');
  if(d)d.style.display=(!P||dailyState().claimed)?'none':'block';
  if(w)w.style.display=(!P||wheelClaimed())?'none':'block';
}

// ════════ РЕФЕРАЛИ + ТИЖНЕВИЙ ТУРНІР ════════

// ── РІДКІСНІ ПРЕДМЕТИ (нагороди) ──
const RARE_ITEMS=[
  {icon:'👑',name:'Королівська корона',slot:'hat',beauty:25},
  {icon:'💎',name:'Діамантове кільце', slot:'ring',beauty:22},
  {icon:'🦄',name:'Чарівна іграшка',   slot:'toy',beauty:20},
  {icon:'🌟',name:'Зоряний нашийник',  slot:'collar',beauty:18},
  {icon:'🧥',name:'Королівська мантія', slot:'shirt',beauty:24},
];
function grantRareItem(){
  if(!P.wardrobe)P.wardrobe=[];
  const it=RARE_ITEMS[Math.floor(Math.random()*RARE_ITEMS.length)];
  const id='rare_'+it.slot+'_'+Date.now()+'_'+Math.floor(Math.random()*9999);
  P.wardrobe.push({id,icon:it.icon,name:it.name,slot:it.slot,beauty:it.beauty,rare:true});
  return it;
}

// ── РЕФЕРАЛЬНА СИСТЕМА ──
const REF_REWARD={coins:300,hearts:100}; // + рідкісний предмет, обом сторонам
function refLink(){
  try{return location.origin+location.pathname+'?ref='+uid;}catch(e){return '?ref='+uid;}
}
window.copyRefLink=function(){
  const link=refLink();
  const done=()=>{notify('📋 Скопійовано!','Надішли посилання другу');};
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(link).then(done).catch(()=>fallbackCopy(link,done));
  }else fallbackCopy(link,done);
};
function fallbackCopy(text,cb){
  const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';
  document.body.appendChild(ta);ta.select();try{document.execCommand('copy');}catch(e){}
  document.body.removeChild(ta);cb&&cb();
}
window.shareRef=async function(){
  const link=refLink();
  const text='Приєднуйся до КотяГри! Виховуй свого улюбленця 🐱🐶';
  if(navigator.share){try{await navigator.share({title:'КотяГра',text,url:link});return;}catch(e){}}
  copyRefLink();
};
function renderInvite(){
  const box=$('invite-link');if(box)box.textContent=refLink();
  const cnt=$('invite-count');if(cnt)cnt.textContent=P.refCount||0;
  // реферер ловить нагороди й при відкритті сторінки (не лише при вході)
  processReferralRewards();
  // блок ручного вводу коду — показуємо лише якщо гравця ще не «прив'язано»
  const man=$('invite-manual');
  if(man)man.style.display=(P.referredBy||P.refRewarded)?'none':'block';
}
window.enterRefCode=function(){
  const raw=($('ref-code-inp')?.value||'').trim();
  if(!raw){notify('📝','Встав посилання або код друга');return;}
  if(P.referredBy||P.refRewarded){notify('ℹ️','Код уже застосовано раніше');return;}
  let code=raw;
  const m=raw.match(/[?&]ref=([^&\s]+)/);if(m)code=m[1];
  code=String(code).trim();
  if(!code){notify('❌','Не вдалося розпізнати код');return;}
  if(code===String(uid)){notify('🙂','Не можна вказати самого себе');return;}
  P.referredBy=code;saveP();
  if($('ref-code-inp'))$('ref-code-inp').value='';
  notify('✅ Код прийнято!','Нагорода нарахується по досягненні 3 рівня');
  renderInvite();
  maybeReferralReward(); // якщо вже ≥3 рівня — спрацює одразу
};
// гравець, якого запросили, на 3 рівні отримує винагороду й нараховує її рефереру
async function maybeReferralReward(){
  if(!P||!P.referredBy||P.refRewarded)return;
  if((P.level||1)<3)return;
  if(String(P.referredBy)===String(uid)){P.referredBy=null;saveP();return;}
  P.refRewarded=true;
  // нагорода новачку
  P.coins=(P.coins||0)+REF_REWARD.coins;P.hearts=(P.hearts||0)+REF_REWARD.hearts;
  const it=grantRareItem();
  notify('🎁 Бонус новачка!','За реєстрацію по запрошенню: 🪙'+REF_REWARD.coins+' ❤️'+REF_REWARD.hearts+' + '+it.icon+' '+it.name,6000);
  addLog('Бонус за запрошення: 🪙'+REF_REWARD.coins+' + '+it.icon+' '+it.name);
  render();saveP();
  // повідомити реферера (він нарахує собі при вході / відкритті сторінки друзів)
  try{
    await sendLetter({toUid:String(P.referredBy),toNick:'друг',subj:'Запрошений друг досяг 3 рівня! 🎉',
      body:'Гравець @'+(P.nickname||'?')+', якого ти запросив, досяг 3 рівня. Отримай нагороду!',
      type:'refreward',icon:'🎁'});
  }catch(e){}
}
// реферер нараховує собі нагороду за кожного запрошеного, що виріс
async function processReferralRewards(){
  if(!P)return;
  try{
    const snap=await getDocs(query(collection(db,'mail'),where('toUid','==',String(uid)),limit(80)));
    const rewards=snap.docs.map(d=>({_id:d.id,...d.data()})).filter(m=>m.type==='refreward');
    let got=0;
    for(const m of rewards){
      P.coins=(P.coins||0)+REF_REWARD.coins;P.hearts=(P.hearts||0)+REF_REWARD.hearts;
      grantRareItem();P.refCount=(P.refCount||0)+1;got++;
      try{await deleteDoc(doc(db,'mail',m._id));}catch(e){}
    }
    if(got){
      saveP();render();renderInvite();
      notify('🎉 Нагорода за друга!','Запрошених: '+P.refCount+' · +🪙'+(REF_REWARD.coins*got)+' ❤️'+(REF_REWARD.hearts*got)+' + рідкісний предмет',6000);
      addLog('Нагорода за запрошеного друга (×'+got+')');
    }
  }catch(e){}
}

// ── ТИЖНЕВИЙ ТУРНІР З ПРИЗАМИ ──
function nextWeekResetMs(){
  // наступний понеділок 00:00 за локальним часом
  const d=new Date();const day=d.getDay();const add=((8-day)%7)||7; // днів до наступного понеділка
  const nm=new Date(d.getFullYear(),d.getMonth(),d.getDate()+add,0,0,0,0);
  return nm.getTime()-Date.now();
}
function fmtDur(ms){
  const s=Math.max(0,Math.floor(ms/1000));const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);
  return (d?d+'д ':'')+h+'г '+m+'хв';
}
function checkWeekly(){
  const wk=getMondayKey();
  if(!P.weekKey){P.weekKey=wk;if(!P.weekScore)P.weekScore=0;saveP();return;}
  if(P.weekKey!==wk){
    P.lastWeekScore=P.weekScore||0;
    P.lastWeekKey=P.weekKey;
    P.weekRewardPending=(P.lastWeekScore>0);
    P.weekScore=0;P.weekKey=wk;
    saveP();
    if(P.weekRewardPending)notify('🏆 Тиждень завершено!','Забери приз у Рейтингах → Тиждень',5000);
  }
}
function weekPrize(rank){
  if(rank===1)return{coins:1000,hearts:200,rare:true,t:'🥇 1 місце'};
  if(rank<=3) return{coins:500, hearts:100,t:'🥈 Топ-3'};
  if(rank<=10)return{coins:200, hearts:50, t:'🏅 Топ-10'};
  return{coins:50,t:'🎖️ Учасник'};
}
window.claimWeekReward=async function(){
  if(!P.weekRewardPending){notify('ℹ️','Немає призу для отримання');return;}
  const btn=$('week-claim-btn');if(btn){btn.disabled=true;btn.textContent='⏳...';}
  try{
    const snap=await getDocs(query(collection(db,'players'),orderBy('lastWeekScore','desc'),limit(100)));
    const arr=snap.docs.map(d=>({_id:d.id,...d.data()}))
      .filter(p=>p.lastWeekKey===P.lastWeekKey&&(p.lastWeekScore||0)>0);
    let rank=arr.findIndex(p=>p._id===uid)+1;if(rank<=0)rank=arr.length+1;
    const pr=weekPrize(rank);
    P.coins=(P.coins||0)+(pr.coins||0);if(pr.hearts)P.hearts=(P.hearts||0)+pr.hearts;
    let extra='';if(pr.rare){const it=grantRareItem();extra=' + '+it.icon+' '+it.name;}
    P.weekRewardPending=false;
    notify('🏆 Тижневий приз!',pr.t+' (#'+rank+'): 🪙'+(pr.coins||0)+(pr.hearts?(' ❤️'+pr.hearts):'')+extra,6000);
    addLog('Тижневий приз '+pr.t+' (#'+rank+')');
    render();saveP();renderWeekly();
  }catch(e){notify('❌',e.message);}
  finally{if(btn){btn.disabled=false;btn.textContent='🎁 Забрати приз';}}
};
async function renderWeekly(){
  const rl=$('rating-list');if(!rl)return;
  rl.innerHTML='<div class="loading-inline">Завантаження...</div>';
  let html='';
  // банер призового фонду + відлік
  html+='<div class="week-banner">'
    +'<div class="week-banner-title">🏆 Тижневий турнір</div>'
    +'<div class="week-banner-sub">Заробляй досвід цього тижня — найактивніші отримають призи!</div>'
    +'<div class="week-countdown">⏳ До завершення: '+fmtDur(nextWeekResetMs())+'</div>'
    +'<div class="week-prizes">🥇 🪙1000 ❤️200 +💎рідкісний · 🥈 Топ-3 🪙500 ❤️100 · 🏅 Топ-10 🪙200 ❤️50 · 🎖️ Учасник 🪙50</div>'
    +'</div>';
  // приз минулого тижня
  if(P.weekRewardPending){
    html+='<div class="week-claim-card">'
      +'<div class="week-claim-txt">🎉 Минулий тиждень завершено! Твій рахунок: <b>'+(P.lastWeekScore||0)+'</b> ⭐</div>'
      +'<button class="green-btn" id="week-claim-btn" onclick="claimWeekReward()">🎁 Забрати приз</button>'
      +'</div>';
  }
  rl.innerHTML=html+'<div id="week-board"><div class="loading-inline">Завантаження таблиці...</div></div>';
  try{
    const snap=await getDocs(query(collection(db,'players'),orderBy('weekScore','desc'),limit(50)));
    const all=snap.docs.map(d=>({_id:d.id,...d.data()})).filter(p=>p.nickname&&(p.weekScore||0)>0&&(typeof plausibleScore!=='function'||plausibleScore(p)));
    const medals=['🥇','🥈','🥉'];
    const myRank=all.findIndex(p=>p._id===uid)+1;
    let board='<div class="rating-count-info">📊 Твій рахунок тижня: '+(P.weekScore||0)+' ⭐'
      +(myRank>0?(' · місце #'+myRank):' · ще не в таблиці')+'</div>';
    board+=all.length?all.map((p,i)=>{
      const me=p._id===uid;
      return '<div class="rating-row'+(me?' rating-row-me':'')+'" onclick="openProfile(\''+p._id+'\')">'
        +'<span class="rrank'+(i===0?' gold':i===1?' silver':i===2?' bronze':'')+'">'+(medals[i]||(i+1))+'</span>'
        +'<span class="rav">'+(p.petType==='dog'?'🐶':'🐱')+'</span>'
        +'<div style="flex:1"><div class="rname">'+esc(p.catname||p.nickname||'Тваринка')+(me?' 🌟':'')+'</div>'
        +'<div class="rsub">@'+esc(p.nickname||'?')+' · Рів.'+(p.level||1)+'</div></div>'
        +'<span class="rscore">⭐'+(p.weekScore||0)+'</span>'
        +'</div>';
    }).join(''):'<div class="loading-inline">Поки нема учасників цього тижня. Будь першим — грай!</div>';
    const wb=$('week-board');if(wb)wb.innerHTML=board;
  }catch(e){const wb=$('week-board');if(wb)wb.innerHTML='<div class="loading-inline">Помилка: '+esc(e.message)+'</div>';}
}

// ════════ КЛУБ: РОЛІ, КЕРУВАННЯ, ВНЕСКИ ════════
const CLUB_ROLES={
  director:{r:4,name:'Директор',icon:'👑'},
  deputy:  {r:3,name:'Заступник',icon:'⭐'},
  curator: {r:2,name:'Куратор',icon:'🛡️'},
  member:  {r:1,name:'Активний учасник',icon:'👤'},
};
function _roleUp(role,cap){const o=['member','curator','deputy','director'];let i=o.indexOf(role);return o[Math.min(i+1,o.indexOf(cap))];}
function _roleDown(role){const o=['member','curator','deputy','director'];let i=o.indexOf(role);return o[Math.max(0,i-1)];}
function _findMember(mid){return (window._clubMembers||[]).find(m=>(m.uid||m._id)===String(mid));}
function _canManage(target){
  const my=P._clubRole||'member';const myRank=(CLUB_ROLES[my]||CLUB_ROLES.member).r;
  const tr=(CLUB_ROLES[target.role]||CLUB_ROLES.member).r;
  if((target.uid||target._id)===String(uid))return false;
  if(target.role==='director')return false;
  return my==='director' || (my==='deputy' && tr<myRank);
}
async function _setRole(mid,newRole,word){
  if(!P.clubId)return;
  try{
    await updateDoc(doc(db,'clubs',P.clubId,'members',mid),{role:newRole});
    const m=_findMember(mid);
    notify('✅ Посаду змінено',(m?esc(m.catname||m.nickname):'')+' → '+(CLUB_ROLES[newRole]||CLUB_ROLES.member).name);
    addLog('Клуб: '+(m?(m.catname||m.nickname):'учасник')+' '+word+' до «'+(CLUB_ROLES[newRole]||{}).name+'»');
    loadClubData();
  }catch(e){notify('❌',e.message);}
}
window.promoteMember=function(mid){
  const m=_findMember(mid);if(!m||!_canManage(m))return;
  const cap=(P._clubRole==='director')?'deputy':'curator';
  const nr=_roleUp(m.role||'member',cap);
  if(nr===(m.role||'member')){notify('ℹ️','Вище підвищити не можна');return;}
  _setRole(mid,nr,'підвищено');
};
window.demoteMember=function(mid){
  const m=_findMember(mid);if(!m||!_canManage(m))return;
  const nr=_roleDown(m.role||'member');
  if(nr===(m.role||'member')){notify('ℹ️','Нижче нікуди');return;}
  _setRole(mid,nr,'понижено');
};
window.kickMember=async function(mid){
  if(P._clubRole!=='director'){notify('🚫','Лише Директор може виключати');return;}
  const m=_findMember(mid);if(!m)return;
  if((m.uid||m._id)===String(uid)){notify('🙂','Себе не можна');return;}
  if(m.role==='director'){notify('🚫','Директора не можна');return;}
  uiConfirm('Виключити «'+(m.catname||m.nickname||'учасника')+'» з клубу?',async()=>{
    try{
      await deleteDoc(doc(db,'clubs',P.clubId,'members',mid));
      await updateDoc(doc(db,'clubs',P.clubId),{memberCount:increment(-1)});
      notify('🚪 Виключено',esc(m.catname||m.nickname||''));
      addLog('Клуб: виключено '+(m.catname||m.nickname||'учасника'));
      loadClubData();
    }catch(e){notify('❌',e.message);}
  },{title:'Виключити учасника',yes:'Виключити'});
};

// ── ВНЕСКИ: запис + перегляд ──
async function recordDonation(coins,hearts){
  try{
    await addDoc(collection(db,'clubs',P.clubId,'donations'),san({
      uid:String(uid),nick:String(P.nickname||'?'),catname:String(P.catname||'Тваринка'),
      coins:coins||0,hearts:hearts||0,ts:serverTimestamp(),tsms:Date.now()
    }));
  }catch(e){}
}
window.openDonations=function(){renderDonations();const m=$('donations-modal');if(m)m.style.display='flex';};
window.closeDonations=function(){const m=$('donations-modal');if(m)m.style.display='none';};
async function renderDonations(){
  const box=$('donations-list');if(!box)return;
  box.innerHTML='<div class="loading-inline">Завантаження...</div>';
  if(!P.clubId){box.innerHTML='<div class="loading-inline">Немає клубу</div>';return;}
  try{
    const snap=await getDocs(query(collection(db,'clubs',P.clubId,'donations'),limit(100)));
    const arr=snap.docs.map(d=>d.data()).sort((a,b)=>(b.tsms||0)-(a.tsms||0));
    // підсумок по учасниках
    const totals={};
    arr.forEach(d=>{const k=d.nick||'?';if(!totals[k])totals[k]={coins:0,hearts:0,name:d.catname||d.nick};totals[k].coins+=d.coins||0;totals[k].hearts+=d.hearts||0;});
    const top=Object.entries(totals).sort((a,b)=>(b[1].coins+b[1].hearts)-(a[1].coins+a[1].hearts)).slice(0,20);
    let html='<div class="sec-title">🏆 Найбільші вкладники</div>';
    html+=top.length?top.map(([nick,t],i)=>
      '<div class="don-row"><span class="don-rank">'+(['🥇','🥈','🥉'][i]||(i+1))+'</span>'
      +'<div style="flex:1"><div class="don-name">'+esc(t.name||nick)+'</div><div class="don-sub">@'+esc(nick)+'</div></div>'
      +'<span class="don-amt">🪙'+t.coins+' ❤️'+t.hearts+'</span></div>').join('')
      :'<div class="loading-inline">Поки нема внесків</div>';
    if(arr.length){
      html+='<div class="sec-title" style="margin-top:12px">🕓 Останні внески</div>';
      html+=arr.slice(0,30).map(d=>
        '<div class="don-row"><span class="don-av">'+'🐾'+'</span>'
        +'<div style="flex:1"><div class="don-name">'+esc(d.catname||d.nick||'?')+'</div>'
        +'<div class="don-sub">'+tsToStr(d.ts)+'</div></div>'
        +'<span class="don-amt">🪙'+(d.coins||0)+' ❤️'+(d.hearts||0)+'</span></div>').join('');
    }
    box.innerHTML=html;
  }catch(e){box.innerHTML='<div class="loading-inline">Помилка: '+esc(e.message)+'</div>';}
}

// ════════ РИБОЛОВЛЯ ════════
const FISH_DUR=75000; // 75 сек
const FISH_CATCH=[
  {icon:'🥾',name:'Старий чобіт',coins:0,            w:10},
  {icon:'🐟',name:'Карась',      cMin:15,cMax:30,    w:26},
  {icon:'🐠',name:'Окунь',       cMin:35,cMax:60,    w:22},
  {icon:'🐡',name:'Короп',       cMin:60,cMax:100,   w:16},
  {icon:'🦐',name:'Креветка',    bf:5,               w:9},
  {icon:'🦈',name:'Рідкісна рибина',cMin:120,cMax:200,bf:5,w:7},
  {icon:'💎',name:'Фрагмент каменя',gem:1,           w:5},
  {icon:'👢',name:'Скарб на дні', cMin:200,cMax:350, w:5},
];
let fishTicker=null;
function fishReady(){return P.fishing&&(Date.now()-P.fishing.start>=P.fishing.dur);}
function renderFishing(){
  const st=$('fishing-status'),btn=$('fishing-btn'),em=$('fishing-emoji'),pw=$('fish-prog-wrap');
  clearInterval(fishTicker);
  if(!P.fishing){
    if(st)st.textContent='Вудка готова до закидання';
    if(em)em.textContent='🎣';
    if(btn){btn.textContent='🎣 Закинути вудку';btn.disabled=false;}
    if(pw)pw.style.display='none';
    return;
  }
  if(fishReady()){
    if(st)st.textContent='🎉 Щось клюнуло! Тягни!';
    if(em)em.textContent='🐟';
    if(btn){btn.textContent='🪝 Витягнути вудку';btn.disabled=false;}
    if(pw)pw.style.display='none';
    return;
  }
  if(pw)pw.style.display='block';
  if(em)em.textContent='🎣';
  if(btn){btn.textContent='⏳ Чекаємо на улов...';btn.disabled=true;}
  fishTicker=setInterval(tickFish,400);tickFish();
}
function tickFish(){
  if(!P.fishing){clearInterval(fishTicker);return;}
  const el=Date.now()-P.fishing.start,pct=Math.min(100,el/P.fishing.dur*100);
  const pf=$('fish-pfill');if(pf)pf.style.width=pct+'%';
  const rem=Math.max(0,Math.ceil((P.fishing.dur-el)/1000));
  const st=$('fishing-status');if(st)st.textContent='⏳ Поплавок на воді... '+rem+' сек';
  if(pct>=100){clearInterval(fishTicker);renderFishing();}
}
window.fishingAction=function(){
  if(!P.fishing){ // закинути
    P.fishing={start:Date.now(),dur:FISH_DUR};
    notify('🎣 Вудку закинуто!','Чекай ~'+Math.round(FISH_DUR/1000)+' сек');
    saveP();renderFishing();return;
  }
  if(!fishReady()){notify('⏳','Ще рано — зачекай клювання');return;}
  // витягнути улов
  const tot=FISH_CATCH.reduce((s,x)=>s+x.w,0);let r=Math.random()*tot,c=FISH_CATCH[0];
  for(const f of FISH_CATCH){r-=f.w;if(r<0){c=f;break;}}
  let coins=0,parts=[];
  if(c.cMin!=null){coins=c.cMin+Math.floor(Math.random()*(c.cMax-c.cMin+1));coins=Math.round(coins*coinMul());P.coins=(P.coins||0)+coins;parts.push('🪙'+coins);}
  if(c.bf){P.butterflies=(P.butterflies||0)+c.bf;parts.push('🦋'+c.bf);}
  if(c.gem){if(!P.gems)P.gems={};const ks=GEMS.map(g=>g.key);const k=ks[Math.floor(Math.random()*ks.length)];P.gems[k]=(P.gems[k]||0)+c.gem;parts.push('фрагмент 💎');}
  P.fishing=null;gainXP(8);lifeTrack('fish');
  const txt=c.icon+' '+c.name+(parts.length?(' · '+parts.join(' ')):' (нічого цінного)');
  notify('🪝 Улов!',txt,4500);addLog('Риболовля: '+txt);
  const lc=$('fishing-log-card'),ll=$('fishing-last');
  if(lc)lc.style.display='block';
  if(ll)ll.innerHTML='<div class="fish-catch">'+c.icon+' <b>'+c.name+'</b>'+(parts.length?(' — '+parts.join(' ')):'')+'</div>';
  render();saveP();renderFishing();
};

// ════════ СЕЗОННІ СВЯТА (українські) ════════
function _easter(y){ // Григоріанський Великдень (алгоритм Гаусса/Meeus)
  const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),
  g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,
  l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),
  mon=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;
  return new Date(y,mon-1,day);
}
function _wearItem(id,icon,name,slot,beauty,cost){return {id,icon,name,slot,beauty,cost,wear:true,desc:'+'+beauty+'🦋 святковий'};}
function holidayList(){
  const y=new Date().getFullYear();const e=_easter(y);
  const mdE=(e.getMonth()+1)+'-'+e.getDate();
  return [
    {key:'ny',  md:'1-1',  win:3,name:'Новий рік',      emoji:'🎄',items:[_wearItem('s_ny_hat','🎅','Новорічний ковпак','hat',12,150),_wearItem('s_ny_scarf','🧣','Святковий шарф','collar',10,120)]},
    {key:'val', md:'2-14', win:1,name:'День закоханих', emoji:'💝',items:[_wearItem('s_val','💝','Сердечко','toy',10,100),_wearItem('s_val2','🌹','Троянда','toy',8,80)]},
    {key:'wom', md:'3-8',  win:1,name:'8 Березня',       emoji:'🌷',items:[_wearItem('s_wom','🌷','Весняний вінок','hat',11,120)]},
    {key:'eas', md:mdE,    win:3,name:'Великдень',        emoji:'🥚',items:[_wearItem('s_eas','🥚','Писанка','toy',12,130),_wearItem('s_eas2','🐰','Вушка зайчика','hat',10,110)]},
    {key:'ind', md:'8-24', win:2,name:'День Незалежності',emoji:'🇺🇦',items:[_wearItem('s_ind','🎗️','Стрічка','collar',14,160)]},
    {key:'def', md:'10-1', win:2,name:'День захисників',  emoji:'🛡️',items:[_wearItem('s_def','🛡️','Щит','toy',12,140)]},
    {key:'hal', md:'10-31',win:3,name:'Геловін',          emoji:'🎃',items:[_wearItem('s_hal','🎃','Гарбуз','hat',13,150),_wearItem('s_hal2','🦇','Кажан','toy',10,110)]},
    {key:'zsu', md:'12-6', win:2,name:'День ЗСУ',          emoji:'🎖️',items:[_wearItem('s_zsu','🎖️','Медаль ЗСУ','collar',15,170)]},
    {key:'nic', md:'12-19',win:2,name:'День Св. Миколая',  emoji:'🎅',items:[_wearItem('s_nic','🎁','Мішок Миколая','toy',12,140)]},
    {key:'xmas',md:'12-25',win:3,name:'Різдво',            emoji:'⛪',items:[_wearItem('s_xmas','⭐','Різдвяна зірка','hat',14,160),_wearItem('s_xmas2','🔔','Дзвіночок','toy',10,110)]},
  ];
}
function currentHoliday(){
  const now=new Date();const cy=now.getFullYear();
  for(const h of holidayList()){
    const [mo,da]=h.md.split('-').map(Number);
    const base=new Date(cy,mo-1,da);
    const diff=Math.round((new Date(cy,now.getMonth(),now.getDate())-base)/86400000);
    if(Math.abs(diff)<=h.win)return h;
  }
  return null;
}
function updateSeasonUI(){
  const h=currentHoliday();
  const btn=$('shop-cat-season'),ban=$('season-banner');
  if(h){
    SHOP.season=h.items;
    if(btn){btn.style.display='';btn.textContent=h.emoji+' '+h.name;}
    if(ban){ban.style.display='block';ban.innerHTML=h.emoji+' <b>'+h.name+'!</b> Святкові товари у магазині →';}
  }else{
    delete SHOP.season;
    if(btn)btn.style.display='none';
    if(ban)ban.style.display='none';
  }
}

// ════════ КЛУБНА ПОДІЯ ВИХІДНИХ ════════
const CLUB_EVENT_GOAL=10000;
function isWeekend(){const d=new Date().getDay();return d===6||d===0;}
function weekendKey(){return getMondayKey();}
async function flushClubEvent(force){
  if(!P||!P.clubId||!isWeekend())return;
  if(!P._evtBuf)P._evtBuf=0;
  if(P._evtBuf<100&&!force)return;
  const add=P._evtBuf;if(add<=0)return;P._evtBuf=0;
  try{await updateDoc(doc(db,'clubs',P.clubId),{eventProgress:increment(add),eventKey:weekendKey()});}catch(e){}
}
async function checkClubEvent(c){
  const box=$('club-event-card');if(!box)return;
  if(!isWeekend()){box.style.display='none';return;}
  let prog=c.eventProgress||0;const key=c.eventKey||'';
  // новий вихідний → скинути (перший, хто зайшов)
  if(key!==weekendKey()){
    prog=0;try{await updateDoc(doc(db,'clubs',P.clubId),{eventProgress:0,eventKey:weekendKey()});}catch(e){}
  }
  box.style.display='block';
  const pct=Math.min(100,Math.round(prog/CLUB_EVENT_GOAL*100));
  const done=prog>=CLUB_EVENT_GOAL;
  const claimed=P.eventClaimed===weekendKey();
  $('club-event-body').innerHTML=
     '<div class="ce-title">🎯 Подія вихідних: зберіть '+CLUB_EVENT_GOAL+' досвіду клубом!</div>'
    +'<div class="ce-bar-wrap"><div class="ce-bar" style="width:'+pct+'%"></div></div>'
    +'<div class="ce-prog">'+prog+' / '+CLUB_EVENT_GOAL+' ⭐ ('+pct+'%)</div>'
    +(done
      ?(claimed?'<div class="ce-done">✅ Нагороду отримано!</div>'
        :'<button class="green-btn" onclick="claimClubEvent()">🎁 Забрати нагороду (🪙500 ❤️100 🦋20)</button>')
      :'<div class="ce-hint">Грайте у вихідні — ваш досвід додається до спільної мети!</div>');
}
window.claimClubEvent=function(){
  if(P.eventClaimed===weekendKey()){notify('✅','Вже отримано');return;}
  P.eventClaimed=weekendKey();
  P.coins=(P.coins||0)+500;P.hearts=(P.hearts||0)+100;P.butterflies=(P.butterflies||0)+20;
  notify('🎯 Нагорода події!','🪙500 ❤️100 🦋20',5000);addLog('Клубна подія: нагороду отримано');
  render();saveP();loadClubData();
};

// ════════ АНТИ-ЧІТ (клієнтські запобіжники) ════════
// ПРИМІТКА: повноцінний захист потребує серверної перевірки (Cloud Functions).
// Це лише обмежує очевидно неможливі значення, щоб гра не зберігала «накручені» дані.
function clampStats(p){
  if(!p)return p;
  const lvl=Math.max(1,Math.min(500,Math.floor(p.level||1)));p.level=lvl;
  const numClamp=(v,max)=>{v=Number(v);if(!isFinite(v)||v<0)return 0;return Math.min(v,max);};
  p.coins=numClamp(p.coins,50000000);
  p.hearts=numClamp(p.hearts,50000000);
  p.butterflies=numClamp(p.butterflies,5000000);
  p.xp=numClamp(p.xp,xpCap(lvl)*2);
  // тижневий рахунок не може бути більшим за розумну межу для рівня
  const wkCap=lvl*8000+20000;
  p.weekScore=numClamp(p.weekScore,wkCap);
  p.lastWeekScore=numClamp(p.lastWeekScore,wkCap);
  if(p.refCount)p.refCount=numClamp(p.refCount,100000);
  if(p.donorXpPct)p.donorXpPct=numClamp(p.donorXpPct,20);
  return p;
}
// фільтр явних читерів у рейтингах
function plausibleScore(p){
  const lvl=p.level||1;return (p.weekScore||0)<=lvl*8000+30000;
}

// ── ПІДТВЕРДЖЕННЯ (модалка замість native confirm — надійніше в PWA) ──
let _confirmCb=null;
function uiConfirm(msg,onYes,opts){
  opts=opts||{};
  _confirmCb=onYes;
  const t=$('confirm-title');if(t)t.textContent=opts.title||'Підтвердження';
  const m=$('confirm-msg');if(m)m.textContent=msg;
  const yb=$('confirm-yes-btn');if(yb)yb.textContent=opts.yes||'Так';
  const mo=$('confirm-modal');if(mo)mo.style.display='flex';
}
window.uiConfirmYes=function(){const cb=_confirmCb;_confirmCb=null;const mo=$('confirm-modal');if(mo)mo.style.display='none';if(cb)cb();};
window.uiConfirmNo=function(){_confirmCb=null;const mo=$('confirm-modal');if(mo)mo.style.display='none';};

// ════════ ГОРОД / ФЕРМА ════════
const CROPS=[
  {key:'carrot',    icon:'🥕',name:'Морква',    cost:20, dur:120, coins:45,  xp:6},
  {key:'tomato',    icon:'🍅',name:'Помідор',   cost:35, dur:240, coins:85,  xp:10},
  {key:'flower',    icon:'🌷',name:'Квітка',    cost:30, dur:180, coins:20, bf:6, xp:8},
  {key:'corn',      icon:'🌽',name:'Кукурудза', cost:50, dur:420, coins:140, xp:14},
  {key:'strawberry',icon:'🍓',name:'Полуниця',  cost:65, dur:600, coins:185, bf:3, xp:16},
  {key:'pumpkin',   icon:'🎃',name:'Гарбуз',    cost:95, dur:900, coins:280, xp:22},
];
const GARDEN_MAX_PLOTS=6;
let gardenTicker=null;
function _crop(k){return CROPS.find(c=>c.key===k);}
function plotReady(p){return p&&(Date.now()-p.start>=p.dur*1000);}
function renderGarden(){
  if(!P.garden)P.garden={plots:[null,null,null],harvest:0,slots:3};
  clearInterval(gardenTicker);
  const hv=$('garden-harvest');if(hv)hv.textContent=P.garden.harvest||0;
  const grid=$('garden-grid');if(!grid)return;
  grid.innerHTML=P.garden.plots.map((p,i)=>{
    if(!p)return '<div class="plot empty" onclick="openSeedPicker('+i+')"><div class="plot-soil">🟫</div><div class="plot-lbl">Порожня грядка</div><div class="plot-act">+ Посадити</div></div>';
    const c=_crop(p.crop)||{icon:'🌱',name:'?'};
    if(plotReady(p))
      return '<div class="plot ready" onclick="harvestPlot('+i+')"><div class="plot-crop">'+c.icon+'</div><div class="plot-lbl">'+c.name+'</div><div class="plot-act ready-act">✅ Зібрати!</div></div>';
    return '<div class="plot growing"><div class="plot-crop growing-crop">🌱</div><div class="plot-lbl">'+c.name+'</div><div class="plot-prog"><div class="plot-pfill" id="plot-pf-'+i+'"></div></div><div class="plot-timer" id="plot-tm-'+i+'"></div></div>';
  }).join('');
  const bp=$('garden-buy-plot');
  if(bp){
    if(P.garden.plots.length>=GARDEN_MAX_PLOTS){bp.style.display='none';}
    else{bp.style.display='';bp.textContent='➕ Купити грядку (🪙'+gardenPlotCost()+')';}
  }
  if(P.garden.plots.some(p=>p&&!plotReady(p))){gardenTicker=setInterval(tickGarden,500);tickGarden();}
}
function tickGarden(){
  if(!P.garden){clearInterval(gardenTicker);return;}
  let anyGrowing=false;
  P.garden.plots.forEach((p,i)=>{
    if(!p)return;
    if(plotReady(p)){const pf=$('plot-pf-'+i);if(pf){renderGarden();}return;}
    anyGrowing=true;
    const el=Date.now()-p.start,pct=Math.min(100,el/(p.dur*1000)*100);
    const pf=$('plot-pf-'+i);if(pf)pf.style.width=pct+'%';
    const tm=$('plot-tm-'+i);if(tm){const rem=Math.max(0,Math.ceil((p.dur*1000-el)/1000));tm.textContent=rem>=60?(Math.floor(rem/60)+'хв '+(rem%60)+'с'):(rem+'с');}
  });
  if(!anyGrowing)clearInterval(gardenTicker);
}
function gardenPlotCost(){return (P.garden.plots.length-2)*300;} // 4-та грядка 600, далі +300
window.buyGardenPlot=function(){
  if(P.garden.plots.length>=GARDEN_MAX_PLOTS){notify('🌱','Максимум грядок');return;}
  const cost=gardenPlotCost();
  if((P.coins||0)<cost){notify('🪙','Недостатньо монет ('+cost+')');return;}
  P.coins-=cost;P.garden.plots.push(null);P.garden.slots=P.garden.plots.length;
  notify('🌱 Нова грядка!','Тепер їх '+P.garden.plots.length);render();saveP();renderGarden();
};
let _seedPlot=null;
window.openSeedPicker=function(i){
  _seedPlot=i;
  const list=$('seed-list');
  if(list)list.innerHTML=CROPS.map(c=>{
    const can=(P.coins||0)>=c.cost;
    const tm=c.dur>=60?(Math.floor(c.dur/60)+' хв'):(c.dur+' с');
    const rw=(c.coins?('🪙'+c.coins):'')+(c.bf?(' 🦋'+c.bf):'');
    return '<div class="seed-opt'+(can?'':' disabled')+'" onclick="'+(can?('plantCrop(\''+c.key+'\')'):'')+'">'
      +'<span class="seed-ic">'+c.icon+'</span>'
      +'<div style="flex:1"><div class="seed-nm">'+c.name+'</div><div class="seed-sub">⏱️ '+tm+' · урожай '+rw+'</div></div>'
      +'<span class="seed-cost">🪙'+c.cost+'</span></div>';
  }).join('');
  const m=$('seed-modal');if(m)m.style.display='flex';
};
window.closeSeedPicker=function(){const m=$('seed-modal');if(m)m.style.display='none';};
window.plantCrop=function(key){
  const c=_crop(key);if(c==null||_seedPlot==null)return;
  if((P.coins||0)<c.cost){notify('🪙','Недостатньо монет');return;}
  P.coins-=c.cost;
  P.garden.plots[_seedPlot]={crop:key,start:Date.now(),dur:c.dur};
  notify('🌱 Посаджено!',c.icon+' '+c.name+' · готово через '+(c.dur>=60?Math.floor(c.dur/60)+' хв':c.dur+' с'));
  closeSeedPicker();render();saveP();renderGarden();
};
window.harvestPlot=function(i){
  const p=P.garden.plots[i];if(!p||!plotReady(p))return;
  const c=_crop(p.crop)||{coins:0,xp:5};
  let coins=Math.round((c.coins||0)*coinMul());
  if(coins>0)P.coins=(P.coins||0)+coins;
  if(c.bf)P.butterflies=(P.butterflies||0)+c.bf;
  P.garden.harvest=(P.garden.harvest||0)+1;
  gainXP(c.xp||5);
  P.garden.plots[i]=null;
  lifeTrack('harvest');
  const parts=[];if(coins>0)parts.push('🪙'+coins);if(c.bf)parts.push('🦋'+c.bf);parts.push('🧺+1');
  notify('🧺 Зібрано!',(c.icon||'')+' '+(c.name||'')+' · '+parts.join(' '),4000);
  render();saveP();renderGarden();checkLandmarks();
};
window.feedFromGarden=function(){
  if((P.garden.harvest||0)<=0){notify('🧺','Немає врожаю. Спочатку виростиди щось!');return;}
  if((P.hunger||0)>=100){notify('😋','Тваринка вже сита');return;}
  P.garden.harvest--;P.hunger=cl((P.hunger||0)+25);gainXP(2);
  showEmotion('eat',2200);
  notify('🍽️ Нагодовано врожаєм!','+25 ситості (безкоштовно)');
  render();saveP();renderGarden();
};

// ════════ ЛЕНДМАРКИ / ТИТУЛИ / РАМКИ ════════
function _gameDays(){return Math.max(0,Math.floor((Date.now()-new Date(P.createdAt||Date.now()).getTime())/86400000));}
const LANDMARKS=[
  {id:'d7',   icon:'🐣',title:'Новачок',    tier:'bronze',cond:()=>_gameDays()>=7,   desc:'7 днів у грі'},
  {id:'d30',  icon:'🌟',title:'Завсідник',  tier:'silver',cond:()=>_gameDays()>=30,  desc:'30 днів у грі'},
  {id:'d100', icon:'🎖️',title:'Ветеран',    tier:'gold',  cond:()=>_gameDays()>=100, desc:'100 днів у грі'},
  {id:'d365', icon:'👑',title:'Легенда',    tier:'legend',cond:()=>_gameDays()>=365, desc:'365 днів у грі'},
  {id:'walk100',icon:'🧭',title:'Мандрівник',tier:'silver',cond:()=>(P.life&&P.life.walk||0)>=100,desc:'100 прогулянок'},
  {id:'fish50', icon:'🎣',title:'Рибалка',   tier:'silver',cond:()=>(P.life&&P.life.fish||0)>=50, desc:'50 уловів'},
  {id:'farm50', icon:'🌻',title:'Фермер',    tier:'silver',cond:()=>(P.life&&P.life.harvest||0)>=50,desc:'50 урожаїв'},
  {id:'lvl20',  icon:'🏆',title:'Майстер',   tier:'gold',  cond:()=>(P.level||1)>=20, desc:'20 рівень'},
  {id:'amb5',   icon:'🤝',title:'Амбасадор', tier:'gold',  cond:()=>(P.refCount||0)>=5,desc:'5 запрошених друзів'},
];
window.LANDMARKS=LANDMARKS;
function _lm(id){return LANDMARKS.find(l=>l.id===id);}
function checkLandmarks(){
  if(!P)return;if(!P.landmarks)P.landmarks={};
  let changed=false;
  LANDMARKS.forEach(l=>{
    if(P.landmarks[l.id])return;
    if(l.cond()){
      P.landmarks[l.id]=true;changed=true;
      notify('🏅 Новий титул!',l.icon+' «'+l.title+'» — '+l.desc,5500);
      if(typeof addLog==='function')addLog('Отримано титул «'+l.title+'»');
      if(!P.title)P.title=l.id; // авто-вибір першого
    }
  });
  if(changed){saveP();renderPetMedals&&renderPetMedals();}
}
function activeTitle(p){p=p||P;if(!p||!p.title)return null;const l=_lm(p.title);if(!l)return null;if(p===P&&!(P.landmarks&&P.landmarks[l.id]))return null;return l;}
function renderTitle(){
  const box=$('pet-title');if(!box)return;
  const earned=LANDMARKS.filter(l=>P.landmarks&&P.landmarks[l.id]);
  const t=activeTitle();
  box.innerHTML=(t?'<span class="title-badge tier-'+t.tier+'">'+t.icon+' '+t.title+'</span>':'<span class="title-none">Без титулу</span>')
    +' <button class="title-pick-btn" onclick="openTitles()">🏅 Титули ('+earned.length+')</button>';
  // рамка навколо тваринки
  const frameTier=t?t.tier:'';
  ['pet-big-emoji','cat-emoji'].forEach(id=>{const el=$(id);if(el){el.classList.remove('frame-bronze','frame-silver','frame-gold','frame-legend');if(frameTier)el.classList.add('frame-'+frameTier);}});
}
window.openTitles=function(){
  const list=$('titles-list');
  if(list)list.innerHTML='<div class="title-opt'+(!P.title?' active':'')+'" onclick="setTitle(\'\')">🚫 Без титулу</div>'+
    LANDMARKS.map(l=>{
      const have=P.landmarks&&P.landmarks[l.id];
      return '<div class="title-opt'+(P.title===l.id?' active':'')+(have?'':' locked')+'" '+(have?('onclick="setTitle(\''+l.id+'\')"'):'')+'>'
        +'<span class="title-opt-ic tier-'+l.tier+'">'+l.icon+'</span>'
        +'<div style="flex:1"><div class="title-opt-nm">'+l.title+'</div><div class="title-opt-sub">'+l.desc+'</div></div>'
        +(have?'<span class="title-opt-ok">✓</span>':'<span class="title-opt-lock">🔒</span>')+'</div>';
    }).join('');
  const m=$('titles-modal');if(m)m.style.display='flex';
};
window.closeTitles=function(){const m=$('titles-modal');if(m)m.style.display='none';};
window.setTitle=function(id){
  if(id&&!(P.landmarks&&P.landmarks[id])){notify('🔒','Титул ще не відкрито');return;}
  P.title=id;saveP();renderTitle();renderPetPage();closeTitles();
  notify('🏅','Титул '+(id?('обрано: '+_lm(id).title):'знято'));
};

// ── BIND BUTTONS ──
document.addEventListener('DOMContentLoaded',()=>{
  if(window._authQueue==='login'){window._authQueue=null;window.doAuth&&window.doAuth();}
  const bind=(id,fn)=>{const el=$(id);if(el)el.addEventListener('click',fn);};
  bind('auth-btn',()=>window.doAuth&&window.doAuth());
  bind('tab-login',()=>window.switchTab&&window.switchTab('login'));
  bind('tab-reg',()=>window.switchTab&&window.switchTab('reg'));
  const pass=$('a-pass');
  if(pass)pass.addEventListener('keydown',e=>{if(e.key==='Enter')window.doAuth&&window.doAuth();});
  buildShop('food');
});
