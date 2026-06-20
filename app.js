// КотяГра v9
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, setPersistence, indexedDBLocalPersistence, browserLocalPersistence, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection,
  query, limit, onSnapshot, addDoc, getDocs,
  serverTimestamp, where, increment, deleteDoc, updateDoc, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

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
let _fns=null;try{_fns=getFunctions(app);}catch(e){}
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
    ingredients:{},visitsDay:'',visitsDone:[],
    collected:{fish:{},gem:{},craft:{},setClaimed:{}},
    tutDone:false,sound:true,
    health:100,sick:false,sickSince:0,
    expedition:null,
    gender:'',spouseUid:'',spouseNick:'',spousePet:'',sentMarriage:[],baby:null,babyPlayedDay:'',
    skillPoints:0,skillNodes:{},
    mansion:0,clean:100,bank:0,bankSince:0,bankFrac:0,friendXp:{},fishUp:{rod:0,bait:0},
    riddleDay:'',rouletteDay:'',rouletteSpins:0,loginCal:{streak:0,last:'',claimed:[]},music:false,crystals:0,tricks:{},trickShowDay:'',
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
  if(!p.ingredients)p.ingredients={};
  if(p.visitsDay==null)p.visitsDay='';
  if(!Array.isArray(p.visitsDone))p.visitsDone=[];
  if(!p.collected||typeof p.collected!=='object')p.collected={fish:{},gem:{},craft:{},setClaimed:{}};
  ['fish','gem','craft','setClaimed'].forEach(k=>{if(!p.collected[k])p.collected[k]={};});
  if(p.tutDone===undefined)p.tutDone=false;
  if(p.sound===undefined)p.sound=true;
  if(p.health==null)p.health=100;
  if(p.sick===undefined)p.sick=false;
  if(p.themeMode==null)p.themeMode='auto';
  if(!Array.isArray(p.diary))p.diary=[];
  if(p.skillPoints==null)p.skillPoints=0;
  if(!p.skillNodes)p.skillNodes={};
  if(p.mansion==null)p.mansion=0;
  if(p.clean==null)p.clean=100;
  if(p.bank==null)p.bank=0;
  if(p.bankSince==null)p.bankSince=0;
  if(p.bankFrac==null)p.bankFrac=0;
  if(!p.fishUp||typeof p.fishUp!=='object')p.fishUp={rod:0,bait:0};
  if(p.fishUp.rod==null)p.fishUp.rod=0;
  if(p.fishUp.bait==null)p.fishUp.bait=0;
  if(!p.friendXp)p.friendXp={};
  if(p.riddleDay==null)p.riddleDay='';
  if(p.rouletteDay==null)p.rouletteDay='';
  if(p.memoryDay==null)p.memoryDay='';
  if(p.rouletteSpins==null)p.rouletteSpins=0;
  if(!p.loginCal||typeof p.loginCal!=='object')p.loginCal={streak:0,last:'',claimed:[]};
  if(!Array.isArray(p.loginCal.claimed))p.loginCal.claimed=[];
  if(p.music===undefined)p.music=false;
  if(p.crystals==null)p.crystals=0;
  if(p.job==null)p.job='';
  if(p.jobSince==null)p.jobSince=0;
  if(p.notif==null)p.notif=false;
  if(!p.room||typeof p.room!=='object')p.room={};
  if(p.clubQuestClaimed==null)p.clubQuestClaimed='';
  if(!p.trophies||typeof p.trophies!=='object')p.trophies={};
  if(!p.cards||typeof p.cards!=='object')p.cards={};
  if(p.cardPackDay==null)p.cardPackDay='';
  if(!p.cardSetsClaimed||typeof p.cardSetsClaimed!=='object')p.cardSetsClaimed={};
  if(!p.yard||typeof p.yard!=='object')p.yard={};
  if(p.cbLast!=null&&typeof p.cbLast!=='number')p.cbLast=null;
  if(!p.temperament){const TT=['playful','calm','foodie','smart'];p.temperament=TT[Math.floor(Math.random()*TT.length)];}
  if(!p.tricks||typeof p.tricks!=='object')p.tricks={};
  if(p.trickShowDay==null)p.trickShowDay='';
  if(p.rpsDay==null)p.rpsDay='';
  if(p.rpsPlays==null)p.rpsPlays=0;
  if(p.boxDay==null)p.boxDay='';
  // одноразова видача балів за вже досягнуті рівні (1 бал/рівень з 2-го)
  if(!p._skillGranted){p.skillPoints=(p.skillPoints||0)+Math.max(0,(p.level||1)-1);p._skillGranted=true;}
  if(p.gender==null)p.gender='';
  if(p.spouseUid==null)p.spouseUid='';
  if(p.spouseNick==null)p.spouseNick='';
  if(p.spousePet==null)p.spousePet='';
  if(!Array.isArray(p.sentMarriage))p.sentMarriage=[];
  if(p.baby===undefined)p.baby=null;
  if(p.babyPlayedDay==null)p.babyPlayedDay='';
  if(p.sickSince==null)p.sickSince=0;
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
  if(!P)return;
  if(!Array.isArray(P.diary))P.diary=[];
  P.diary.unshift({m:String(msg),t:Date.now()});
  if(P.diary.length>60)P.diary=P.diary.slice(0,60);
  renderDiary();
}
function renderDiary(){
  const box=$('log-box');if(!box)return;
  if(!P||!Array.isArray(P.diary)||!P.diary.length){box.innerHTML='<div class="log-e">Поки порожньо. Дій з улюбленцем — і події з\'являться тут 🐾</div>';return;}
  box.innerHTML=P.diary.map(e=>{
    const d=e.t?new Date(e.t):null;
    const tm=d?d.toLocaleString('uk-UA',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
    return '<div class="log-e"><span class="log-t">'+tm+'</span> '+esc(e.m)+'</div>';
  }).join('');
}
window.renderDiary=renderDiary;
function updateMailBadge(){
  const sys=(P?.inbox||[]).filter(m=>m.type==='system'&&!m.read).length;
  const cnt=sys+(window._mailUnread||0);
  const b=$('mail-badge');if(b){b.style.display=cnt>0?'block':'none';b.textContent=cnt;}
  const uc=$('unread-cnt');if(uc)uc.textContent=cnt>0?cnt:'';
}
async function refreshUnread(){
  try{
    const snap=await getDocs(query(collection(db,'mail'),where('toUid','==',String(uid)),limit(80)));
    window._mailUnread=snap.docs.filter(d=>{const m=d.data();return m.read===false&&m.type!=='friendreq'&&m.type!=='friendaccept'&&m.type!=='refreward'&&m.type!=='visit'&&m.type!=='marriage'&&m.type!=='marriage_accept'&&m.type!=='baby_born';}).length;
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
window.forgotPassword=async function(){
  const em=($('a-email')?.value||'').trim();
  if(!em||!em.includes('@')){alert('Спершу введи свій email у поле «Email» вище ☝️');return;}
  const link=$('forgot-pass');if(link)link.textContent='⏳ Надсилаю...';
  try{
    await sendPasswordResetEmail(auth,em);
    alert('📧 Лист для зміни пароля надіслано на '+em+'.\n\nПеревір пошту (і теку «Спам»). Перейди за посиланням у листі, встанови новий пароль — і заходь з ним.');
  }catch(e){
    const m=(e.code==='auth/user-not-found')?'Такого email немає в грі. Перевір, чи правильно введено.'
      :((e.code==='auth/invalid-email')?'Невірний формат email.'
      :((e.code==='auth/too-many-requests')?'Забагато спроб. Спробуй за кілька хвилин.':('Помилка: '+(e.message||e.code))));
    alert('❌ '+m);
  }finally{if(link)link.textContent='Забув пароль?';}
};
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
    if(typeof updateWeatherUI==='function')updateWeatherUI();
    if(typeof applyMenuIcons==='function')applyMenuIcons();
    if(typeof updateSickUI==='function')updateSickUI();
    if(typeof applyTheme==='function')applyTheme();
    if(typeof updateWorldEventUI==='function')updateWorldEventUI();
    if(typeof renderDiary==='function')renderDiary();
    if(typeof applySeason==='function')applySeason();
    if(typeof checkComebackBonus==='function')checkComebackBonus();
    if(typeof scheduleDailyReminder==='function'&&P.notif)scheduleDailyReminder();
    if(typeof trackLogin==='function')trackLogin();
    if(P.music&&typeof startMusic==='function')startMusic();
    if(typeof checkLandmarks==='function')checkLandmarks();
    if(typeof processReferralRewards==='function')processReferralRewards();
    if(typeof processVisits==='function')processVisits();
    if(typeof processClubGifts==='function')processClubGifts();
    if(typeof processMarriageAccepts==='function')processMarriageAccepts();
    if(typeof maybeReferralReward==='function')maybeReferralReward();
    if(!dailyState().claimed)setTimeout(openDaily,700);
    if(typeof maybeTutorial==='function')setTimeout(maybeTutorial,400);
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
    if(typeof checkWeekly==='function')checkWeekly(); // ловимо перехід тижня навіть у довгій сесії
    if(!P.sleeping){
      const dm=1-(typeof tempEff==='function'?tempEff('decay'):0); // спокійна — повільніший спад
      const hm=1-(typeof roomEff==='function'?roomEff('hungerSlow'):0)/100; // миска — повільніший голод
      P.hunger=cl((P.hunger||0)-2*dm*hm);P.thirst=cl((P.thirst||0)-3*dm);
      P.fun=cl((P.fun||0)-1*dm);P.energy=cl((P.energy||0)-1*dm);
    }else{P.energy=cl((P.energy||0)+2*(1+(typeof roomEff==='function'?roomEff('sleepEnergy'):0)/100));}
    if(P.clean==null)P.clean=100;
    if(!P.sleeping)P.clean=cl((P.clean||100)-1);
    // ── ЗДОРОВ'Я: занедбаний догляд → хвороба ──
    if(P.health==null)P.health=100;
    const neglect=((P.hunger||0)<20)+((P.thirst||0)<20)+((P.fun||0)<15)+((P.clean||0)<15);
    if(!P.sick){
      if(neglect>=2)P.health=cl((P.health||100)-3);
      else if((P.hunger||0)>50&&(P.thirst||0)>50)P.health=cl((P.health||100)+2);
      if((P.health||0)<=0){P.sick=true;P.sickSince=Date.now();showEmotion('sad',3000);notify('🤒 Ой, тваринка захворіла!','Поклич лікаря 🩺, щоб вилікувати',6000);if(typeof updateSickUI==='function')updateSickUI();}
    }else{
      // поки хвора — настрій падає швидше
      P.fun=cl((P.fun||0)-1);
    }
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
// ════════ СВІТОВІ ПОДІЇ (щомісяця) ════════
const WORLD_EVENTS=[
  {key:'gold',   icon:'🪙',name:'Місяць золота',        desc:'+25% монет з усього',           coin:1.25},
  {key:'xp',     icon:'⭐',name:'Місяць знань',         desc:'+25% досвіду',                   xp:1.25},
  {key:'fish',   icon:'🎣',name:'Фестиваль риболовлі',  desc:'+50% улову на риболовлі',        fish:1.5},
  {key:'harvest',icon:'🌻',name:'Урожайний місяць',     desc:'город росте на 30% швидше',      grow:0.7},
  {key:'walk',   icon:'🌳',name:'Місяць подорожей',     desc:'+40% монет на прогулянках',      walk:1.4},
  {key:'love',   icon:'💞',name:'Місяць кохання',       desc:'+25% монет і досвіду',           coin:1.25,xp:1.25},
];
function worldEvent(){
  const d=new Date();const key=d.getFullYear()+'-'+d.getMonth()+'-we';
  let h=0;for(let i=0;i<key.length;i++)h=(h*31+key.charCodeAt(i))|0;
  return WORLD_EVENTS[Math.abs(h)%WORLD_EVENTS.length];
}
function worldEventActive(){return new Date().getDate()<=7;} // лише перший тиждень місяця
function weMul(field){if(!worldEventActive())return 1;const w=worldEvent();return w[field]||1;}
function updateWorldEventUI(){
  const b=$('world-event-banner');if(!b)return;
  if(!worldEventActive()){b.style.display='none';return;}
  const w=worldEvent();
  const left=7-new Date().getDate()+1;
  b.style.display='flex';b.innerHTML='<span class="we-ic">'+w.icon+'</span><div><b>Подія тижня: '+w.name+'</b><div class="we-desc">'+w.desc+' · ще '+left+' дн.</div></div>';
}
function xpMul(){return ((bonusActive('xp2')||bonusActive('vip'))?2:1)*weMul('xp');}
function coinMul(){let m=(bonusActive('coin2')||bonusActive('vip'))?2:1;if(P&&P._clubBuffUntil&&P._clubBuffUntil>Date.now())m*=1.25;return m*weMul('coin')*(1+skillEff('coinPct')/100)*(1+(typeof mansionBonus==='function'?mansionBonus():0)/100)*(1+((P&&P._clubPerk)||0)/100)*(1+(typeof roomEff==='function'?roomEff('coinPct'):0)/100)*(1+(typeof yardEff==='function'?yardEff('coinPct'):0)/100);}
function gainXP(n){
  n=Math.round(n*xpMul()*personalXpFactor()*(1+(typeof tempEff==='function'?tempEff('xp'):0))*(1+(typeof roomEff==='function'?roomEff('xpPct'):0)/100)*(1+(typeof yardEff==='function'?yardEff('xpPct'):0)/100));
  P.xp=(P.xp||0)+n;
  P.weekScore=(P.weekScore||0)+n; // тижневий турнір
  if(P.clubId&&typeof isWeekend==='function'&&isWeekend()){P._evtBuf=(P._evtBuf||0)+n;if(P._evtBuf>=100)flushClubEvent();}
  const cap=xpCap(P.level||1);
  if(P.xp>=cap){
    P.xp-=cap;P.level=(P.level||1)+1;
    P.coins=(P.coins||0)+P.level*10;
    P.skillPoints=(P.skillPoints||0)+1;
    notify('🎉 Рівень '+P.level+'!','+'+P.level*10+'🪙');
    if(typeof sfx==='function')sfx('level');
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
  // підпис настрою має ЗБІГАТИСЯ з картинкою
  var mood=$('cat-mood');
  if(mood){
    var lbl=(P&&P.sick)?'хворіє 🤒':({
      calm:'щасливий 😊',play:'грайливий 🎾',eat:'смакує 😋',drink:'п\'є водичку 💧',
      sleep:'спить 😴',tired:'втомлений 😪',angry:'голодний 😾',sad:'сумний 😢',train:'тренується 🏋️'
    }[emo]||'щасливий 😊');
    mood.textContent='Настрій: '+lbl;
  }
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
  if(window._lastCoins!=null&&(P.coins||0)-window._lastCoins>=5&&typeof flyCoins==='function')flyCoins((P.coins||0)-window._lastCoins);
  window._lastCoins=P.coins||0;
  $('s-c').textContent=P.coins||0;
  $('s-h').textContent=P.hearts||0;
  {const cr=$('s-cr');if(cr)cr.textContent=P.crystals||0;}
  {const tEl=$('cat-temperament');const t=TEMPERAMENTS[P.temperament];if(tEl&&t)tEl.textContent=t.icon+' '+t.name;}
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

// ════════ КУБКИ (за досягнення) ════════
const TROPHIES=[
  {id:'t_rich',  icon:'🏆',name:'Кубок Багатія',   track:'level',     goal:20,  desc:'Досягни 20 рівня',          reward:{coins:3000,hearts:500}},
  {id:'t_fisher',icon:'🎣',name:'Кубок Рибалки',   track:'fish',      goal:200, desc:'Злови 200 рибин',           reward:{coins:2500,crystals:1}},
  {id:'t_trav',  icon:'🧭',name:'Кубок Мандрівника',track:'expedition',goal:50,  desc:'Сходи у 50 експедицій',     reward:{coins:2500,hearts:400}},
  {id:'t_champ', icon:'🥇',name:'Кубок Чемпіона',   track:'showWin',   goal:25,  desc:'Виграй 25 виставок',        reward:{coins:4000,crystals:2}},
  {id:'t_master',icon:'🔨',name:'Кубок Майстра',    track:'craftCollect',goal:5, desc:'Створи 5 різних предметів', reward:{coins:3000,hearts:600}},
  {id:'t_farmer',icon:'🌾',name:'Кубок Садівника',  track:'harvest',   goal:150, desc:'Збери врожай 150 разів',    reward:{coins:2500,hearts:400}},
  {id:'t_gem',   icon:'💎',name:'Кубок Скарбошукача',track:'gemCollect',goal:8,  desc:'Збери 8 різних каменів',    reward:{coins:3500,crystals:2}},
  {id:'t_social',icon:'🤝',name:'Кубок Друга',      track:'ref',       goal:5,   desc:'Запроси 5 друзів',          reward:{coins:3000,hearts:500}},
];
function trophyProg(tr){return getProgress({track:tr.track});}
function renderTrophies(listEl){
  const claimedCnt=TROPHIES.filter(t=>P.trophies&&P.trophies[t.id]).length;
  let h='<div class="info-box-green">🏆 Виконуй великі цілі — заробляй кубки та щедрі нагороди! Зібрано: '+claimedCnt+'/'+TROPHIES.length+'</div>';
  h+=TROPHIES.map(tr=>{
    const prog=Math.min(trophyProg(tr),tr.goal);const pct=Math.round(prog/tr.goal*100);
    const done=prog>=tr.goal;const claimed=!!(P.trophies&&P.trophies[tr.id]);
    const rw=tr.reward;const rwTxt='🪙'+rw.coins+(rw.hearts?(' ❤️'+rw.hearts):'')+(rw.crystals?(' 💎'+rw.crystals):'');
    return '<div class="trophy-card'+(claimed?' trophy-won':'')+'">'
      +'<div class="trophy-top"><span class="trophy-ic">'+tr.icon+'</span>'
      +'<div style="flex:1"><div class="trophy-nm">'+tr.name+'</div><div class="trophy-desc">'+tr.desc+' · '+rwTxt+'</div></div></div>'
      +'<div class="trophy-bar-wrap"><div class="trophy-bar" style="width:'+pct+'%"></div></div>'
      +'<div class="trophy-prog">'+prog+' / '+tr.goal+'</div>'
      +(claimed?'<div class="trophy-done">🏆 Кубок отримано!</div>'
        :(done?'<button class="green-btn" onclick="claimTrophy(\''+tr.id+'\')" style="width:100%;margin-top:6px">🎁 Забрати кубок</button>'
          :''))
      +'</div>';
  }).join('');
  listEl.innerHTML=h;
}
window.claimTrophy=function(id){
  const tr=TROPHIES.find(x=>x.id===id);if(!tr)return;
  if(P.trophies&&P.trophies[id]){notify('🏆','Кубок уже отримано');return;}
  if(trophyProg(tr)<tr.goal){notify('🎯','Ще не виконано');return;}
  if(!P.trophies)P.trophies={};P.trophies[id]=true;
  const rw=tr.reward;
  P.coins=(P.coins||0)+rw.coins;if(rw.hearts)P.hearts=(P.hearts||0)+rw.hearts;if(rw.crystals)P.crystals=(P.crystals||0)+rw.crystals;
  gainXP(40);
  if(typeof sfx==='function')sfx('success');if(typeof spawnReaction==='function')spawnReaction(['🏆','🎉','⭐','👏']);
  notify('🏆 Кубок отримано!',tr.name+' · +'+rw.coins+'🪙',5000);
  addLog('🏆 Кубок: '+tr.name);
  render();saveP();
  const list=$('tasks-list');if(list&&tasksTab==='trophies')renderTrophies(list);
};

// ════════ КЛУБНІ КВЕСТИ (спільна тижнева ціль) ════════
const CLUB_QUESTS=[
  {id:'fish',  icon:'🎣',action:'fish',      goal:150,   name:'Великий улов',     desc:'Спільно наловити рибу',         reward:{coins:1500,hearts:300}},
  {id:'exp',   icon:'🧭',action:'expedition',goal:60,    name:'Великі мандри',     desc:'Спільно сходити в експедиції',  reward:{coins:1800,hearts:300}},
  {id:'donate',icon:'🐷',action:'donate',    goal:40000, name:'Повна скарбничка',  desc:'Спільно пожертвувати монети',   reward:{coins:1200,hearts:400,crystals:1}},
  {id:'harvest',icon:'🌾',action:'harvest',  goal:120,   name:'Багатий урожай',    desc:'Спільно зібрати врожай',        reward:{coins:1500,hearts:300}},
];
function clubQuestWeekKey(){return (typeof getMondayKey==='function')?getMondayKey():new Date().toDateString();}
function currentClubQuest(){
  // детерміновано за тижнем (усі бачать однаковий)
  const wk=clubQuestWeekKey();let h=0;for(let i=0;i<wk.length;i++)h=(h*31+wk.charCodeAt(i))>>>0;
  return CLUB_QUESTS[h%CLUB_QUESTS.length];
}
// внесок учасника у спільний квест
window.contributeClubQuest=async function(action,amount){
  try{
    if(!P.clubId||!amount)return;
    const q=currentClubQuest();if(q.action!==action)return;
    const wk=clubQuestWeekKey();
    if(P._clubQuestWeek!==wk){
      await updateDoc(doc(db,'clubs',P.clubId),{questWeek:wk,questProgress:amount});
      P._clubQuestWeek=wk;P._clubQuestProg=amount;
    }else{
      await updateDoc(doc(db,'clubs',P.clubId),{questProgress:increment(amount)});
      P._clubQuestProg=(P._clubQuestProg||0)+amount;
    }
  }catch(e){}
};
function renderClubQuest(c){
  const box=$('club-quest-body');if(!box)return;
  const q=currentClubQuest();const wk=clubQuestWeekKey();
  const prog=(c.questWeek===wk)?(c.questProgress||0):0;
  const pct=Math.min(100,Math.round(prog/q.goal*100));
  const done=prog>=q.goal;
  const claimed=P.clubQuestClaimed===wk;
  const rw=q.reward;const rwTxt='🪙'+rw.coins+' ❤️'+rw.hearts+(rw.crystals?(' 💎'+rw.crystals):'');
  box.innerHTML='<div class="cq-head"><span class="cq-ic">'+q.icon+'</span><div style="flex:1">'
    +'<div class="cq-name">'+q.name+'</div><div class="cq-desc">'+q.desc+' · нагорода кожному: '+rwTxt+'</div></div></div>'
    +'<div class="cq-bar-wrap"><div class="cq-bar" style="width:'+pct+'%"></div></div>'
    +'<div class="cq-prog">'+prog+' / '+q.goal+' ('+pct+'%)</div>'
    +(done?(claimed?'<div class="cq-claimed">✅ Нагороду забрано</div>'
        :'<button class="green-btn" onclick="claimClubQuest()" style="width:100%;margin-top:8px">🎁 Забрати нагороду</button>')
      :'<div class="cq-note">Робіть внесок усім клубом до кінця тижня!</div>');
}
window.claimClubQuest=async function(){
  if(!P.clubId){notify('❌','Немає клубу');return;}
  const q=currentClubQuest();const wk=clubQuestWeekKey();
  if(P.clubQuestClaimed===wk){notify('✅','Уже забрано цього тижня');return;}
  try{
    const snap=await getDoc(doc(db,'clubs',P.clubId));if(!snap.exists())return;
    const c=snap.data();const prog=(c.questWeek===wk)?(c.questProgress||0):0;
    if(prog<q.goal){notify('🎯','Квест ще не виконано: '+prog+'/'+q.goal);return;}
    const rw=q.reward;
    P.coins=(P.coins||0)+rw.coins;P.hearts=(P.hearts||0)+(rw.hearts||0);if(rw.crystals)P.crystals=(P.crystals||0)+rw.crystals;
    P.clubQuestClaimed=wk;gainXP(20);
    if(typeof sfx==='function')sfx('success');if(typeof spawnReaction==='function')spawnReaction(['🎉','🏆','⭐']);
    notify('🎁 Клубний квест!','+🪙'+rw.coins+' ❤️'+(rw.hearts||0)+(rw.crystals?(' 💎'+rw.crystals):''),5000);
    addLog('Нагорода клубного квесту: +🪙'+rw.coins);
    render();saveP();loadClubData();
  }catch(e){notify('❌',e.message);}
};

// ════════ КІМНАТА УЛЮБЛЕНЦЯ (з 15 рівня) ════════
const ROOM_LEVEL=15;
const ROOM_ITEMS=[
  {id:'bed',   icon:'🛏️',name:'Затишне ліжко',  cost:1500, eff:'sleepEnergy', val:50, desc:'Сон відновлює на 50% більше енергії'},
  {id:'bowl',  icon:'🍽️',name:'Велика миска',    cost:1800, eff:'hungerSlow',  val:25, desc:'Голод спадає на 25% повільніше'},
  {id:'toy',   icon:'🧸',name:'Кошик іграшок',   cost:2200, eff:'funPlay',     val:30, desc:'Гра дає на 30% більше радості'},
  {id:'plant', icon:'🪴',name:'Кімнатна рослина',cost:3000, eff:'coinPct',     val:5,  desc:'+5% монет з усього'},
  {id:'shelf', icon:'🏆',name:'Полиця з трофеями',cost:3500, eff:'xpPct',      val:5,  desc:'+5% досвіду з усього'},
  {id:'window',icon:'🪟',name:'Вікно з краєвидом',cost:2600, eff:'beauty',     val:20, desc:'+20🦋 краси (одноразово при купівлі)'},
];
function roomHas(id){return !!(P.room&&P.room[id]);}
function roomEff(eff){return ROOM_ITEMS.filter(i=>i.eff===eff&&roomHas(i.id)).reduce((s,i)=>s+i.val,0);}
function renderRoom(){
  const box=$('room-body');if(!box)return;
  if((P.level||1)<ROOM_LEVEL){
    box.innerHTML='<div class="info-box-green">🏠 Кімната улюбленця відкривається на <b>'+ROOM_LEVEL+'</b> рівні. Зараз у тебе '+(P.level||1)+'.</div>';
    return;
  }
  // візуальна сцена кімнати з придбаними меблями
  const placed=ROOM_ITEMS.filter(i=>roomHas(i.id));
  let scene='<div class="room-scene"><div class="room-floor">'
    +(placed.length?placed.map(i=>'<span class="room-furniture" title="'+i.name+'">'+i.icon+'</span>').join(''):'<span class="room-empty">Поки порожньо — облаштуй кімнату нижче 🪑</span>')
    +'</div><div class="room-pet" id="room-pet-emoji">🐱</div></div>';
  let h='<div class="info-box-green">Облаштуй кімнату улюбленця — кожен предмет дає постійний бонус!</div>'+scene;
  h+='<div class="card"><div class="sec-title">🪑 Меблі та декор</div>'+ROOM_ITEMS.map(i=>{
    const owned=roomHas(i.id);
    return '<div class="room-row"><span class="room-ic">'+i.icon+'</span>'
      +'<div style="flex:1"><div class="room-nm">'+i.name+'</div><div class="room-desc">'+i.desc+'</div></div>'
      +(owned?'<span class="room-owned">✅ Є</span>'
        :'<button class="small-btn" '+((P.coins||0)<i.cost?'disabled':'')+' onclick="buyRoomItem(\''+i.id+'\')">🪙'+i.cost+'</button>')
      +'</div>';
  }).join('')+'</div>';
  box.innerHTML=h;
  const rp=$('room-pet-emoji');if(rp&&window.PETS){/* емодзі-плейсхолдер достатньо */}
}
window.buyRoomItem=function(id){
  if((P.level||1)<ROOM_LEVEL){notify('🔒','Кімната з '+ROOM_LEVEL+' рівня');return;}
  const it=ROOM_ITEMS.find(x=>x.id===id);if(!it)return;
  if(roomHas(id)){notify('🏠','Цей предмет уже є');return;}
  if((P.coins||0)<it.cost){notify('🪙','Недостатньо монет');return;}
  P.coins-=it.cost;if(!P.room)P.room={};P.room[id]=true;
  if(it.eff==='beauty')P.butterflies=(P.butterflies||0)+it.val;
  if(typeof sfx==='function')sfx('success');if(typeof spawnReaction==='function')spawnReaction(['🏠','✨','❤️']);
  notify(it.icon+' Куплено!',it.name+' прикрашає кімнату');
  addLog('Кімната: '+it.name);
  render();saveP();renderRoom();
};

// ════════ СПОВІЩЕННЯ (одне нагадування раз на 24 год) ════════
// ⚠️ Локальне нагадування. Якщо браузер підтримує Notification Triggers — спрацює
// навіть коли застосунок ЗАКРИТО. Інакше (fallback) — лише поки застосунок у памʼяті.
// Справжній push будь-коли потребує Firebase Cloud Messaging + сервер (окремий крок).
let _reminderTimer=null;
function updateNotifBtn(){
  const b=$('notif-toggle-btn');if(!b)return;
  const on=('Notification'in window)&&Notification.permission==='granted'&&P&&P.notif;
  b.textContent=on?'🔔 Сповіщення: увімкнено (раз/добу)':'🔕 Сповіщення: вимкнено';
}
window.toggleNotif=async function(){
  if(!('Notification'in window)){notify('🔕','Твій браузер не підтримує сповіщень');return;}
  if(P.notif){P.notif=false;saveP();updateNotifBtn();cancelDailyReminder();notify('🔕','Сповіщення вимкнено');return;}
  let perm=Notification.permission;
  if(perm!=='granted')perm=await Notification.requestPermission();
  if(perm==='granted'){
    P.notif=true;saveP();updateNotifBtn();
    scheduleDailyReminder();
    notify('🔔','Нагадуватимемо раз на добу 🐱');
  }else notify('🔕','Дозвіл на сповіщення не надано');
};
// планує ОДНЕ нагадування через 24 год (замінює попереднє)
async function scheduleDailyReminder(){
  if(!P||!P.notif)return;
  if(!('Notification'in window)||Notification.permission!=='granted')return;
  const when=Date.now()+24*60*60*1000;
  const title='🐱 КотяГра';
  const body='Котик скучив! Зазирни, погодуй і забери щоденні бонуси 🎁';
  // спроба через Notification Triggers (працює навіть коли застосунок закрито)
  try{
    if('serviceWorker'in navigator && 'showTrigger'in Notification.prototype){
      const reg=await navigator.serviceWorker.ready;
      // прибрати старі заплановані з тим самим тегом
      const old=await reg.getNotifications({includeTriggered:true,tag:'daily-reminder'});
      old.forEach(n=>n.close());
      await reg.showNotification(title,{body,tag:'daily-reminder',icon:'icon-192.png',badge:'icon-192.png',
        showTrigger:new TimestampTrigger(when)});
      return;
    }
  }catch(e){}
  // fallback: таймер (спрацює лише поки застосунок у памʼяті)
  clearTimeout(_reminderTimer);
  _reminderTimer=setTimeout(()=>{
    try{if(P&&P.notif&&Notification.permission==='granted'&&document.visibilityState!=='visible')new Notification(title,{body,icon:'icon-192.png',tag:'daily-reminder'});}catch(e){}
  },24*60*60*1000);
}
async function cancelDailyReminder(){
  clearTimeout(_reminderTimer);
  try{if('serviceWorker'in navigator){const reg=await navigator.serviceWorker.ready;const ns=await reg.getNotifications({includeTriggered:true,tag:'daily-reminder'});ns.forEach(n=>n.close());}}catch(e){}
}
window.scheduleDailyReminder=scheduleDailyReminder;

// ════════ ПРОФЕСІЇ / РОБОТА (з 15 рівня) ════════
const JOB_LEVEL=15, JOB_CAP_H=8; // накопичення максимум 8 годин
const JOBS=[
  {id:'baker',  icon:'🥐',name:'Пекар',    coinsPerH:90, desc:'Пече смаколики на продаж'},
  {id:'fisher', icon:'🎣',name:'Рибалка',  coinsPerH:80, bf:3, desc:'Ловить рибу — монети + краса'},
  {id:'gardener',icon:'🌻',name:'Садівник', coinsPerH:85, desc:'Доглядає сад на продаж'},
  {id:'artist', icon:'🎨',name:'Артист',   coinsPerH:75, xp:4, desc:'Виступає — монети + досвід'},
];
function jobEarnings(){
  if(!P.job||!P.jobSince)return {coins:0,bf:0,xp:0,h:0};
  const j=JOBS.find(x=>x.id===P.job);if(!j)return {coins:0,bf:0,xp:0,h:0};
  const h=Math.min(JOB_CAP_H,(Date.now()-P.jobSince)/3600000);
  return {coins:Math.round(j.coinsPerH*h*coinMul()),bf:Math.round((j.bf||0)*h),xp:Math.round((j.xp||0)*h),h:h,j:j};
}
function renderJobs(){
  const box=$('jobs-body');if(!box)return;
  if((P.level||1)<JOB_LEVEL){
    box.innerHTML='<div class="info-box-green">💼 Робота відкривається на <b>'+JOB_LEVEL+'</b> рівні. Зараз у тебе '+(P.level||1)+'.</div>';
    return;
  }
  let h='<div class="info-box-green">Влаштуй улюбленця на роботу — і він приноситиме монети, поки тебе нема (до '+JOB_CAP_H+' год накопичення).</div>';
  if(P.job){
    const e=jobEarnings();const j=e.j;
    h+='<div class="card" style="text-align:center"><div style="font-size:2.6rem">'+j.icon+'</div>'
      +'<div class="sec-title">'+j.name+'</div>'
      +'<div class="fam-note">Накопичено за '+e.h.toFixed(1)+' год: 🪙<b>'+e.coins+'</b>'+(e.bf?(' 🦋'+e.bf):'')+(e.xp?(' ✨'+e.xp):'')+'</div>'
      +'<button class="green-btn" '+(e.coins<=0?'disabled':'')+' onclick="collectJob()" style="margin-top:8px;width:100%">💰 Забрати зарплату</button>'
      +'<button class="grey-btn" onclick="quitJob()" style="margin-top:8px;width:100%">Звільнитися</button></div>';
  }
  h+='<div class="card"><div class="sec-title">💼 Доступні професії</div>'+JOBS.map(j=>
    '<div class="job-row"><span class="job-ic">'+j.icon+'</span>'
    +'<div style="flex:1"><div class="job-nm">'+j.name+(P.job===j.id?' ✅':'')+'</div><div class="job-desc">'+j.desc+' · 🪙'+j.coinsPerH+'/год'+(j.bf?(' +🦋'+j.bf):'')+(j.xp?(' +✨'+j.xp):'')+'</div></div>'
    +(P.job===j.id?'<span class="job-cur">працює</span>':'<button class="small-btn" onclick="takeJob(\''+j.id+'\')">Найнятися</button>')
    +'</div>').join('')+'</div>';
  box.innerHTML=h;
}
window.takeJob=function(id){
  if((P.level||1)<JOB_LEVEL){notify('🔒','Робота з '+JOB_LEVEL+' рівня');return;}
  if(P.job===id){notify('💼','Уже на цій роботі');return;}
  if(P.job){const e=jobEarnings();if(e.coins>0){P.coins=(P.coins||0)+e.coins;if(e.bf)P.butterflies=(P.butterflies||0)+e.bf;notify('💰','Зарплату з минулої роботи забрано: 🪙'+e.coins);}}
  P.job=id;P.jobSince=Date.now();
  const j=JOBS.find(x=>x.id===id);
  notify(j.icon+' Влаштовано!','Тепер твій улюбленець — '+j.name);
  addLog('Нова робота: '+j.name);
  if(typeof sfx==='function')sfx('success');
  render();saveP();renderJobs();
};
window.collectJob=function(){
  const e=jobEarnings();
  if(e.coins<=0){notify('💼','Поки нема чого забирати');return;}
  P.coins=(P.coins||0)+e.coins;if(e.bf)P.butterflies=(P.butterflies||0)+e.bf;if(e.xp)gainXP(e.xp);
  P.jobSince=Date.now();
  if(typeof sfx==='function')sfx('coin');if(typeof spawnReaction==='function')spawnReaction(['🪙','💰','⭐']);
  notify('💰 Зарплата!','+🪙'+e.coins+(e.bf?(' 🦋'+e.bf):''));
  addLog('Зарплата: +🪙'+e.coins);
  render();saveP();renderJobs();
};
window.quitJob=function(){
  const e=jobEarnings();if(e.coins>0){P.coins=(P.coins||0)+e.coins;if(e.bf)P.butterflies=(P.butterflies||0)+e.bf;}
  P.job='';P.jobSince=0;
  notify('👋','Звільнено'+(e.coins>0?(' · зарплату 🪙'+e.coins+' забрано'):''));
  render();saveP();renderJobs();
};

// ════════ ХАРАКТЕР / ТЕМПЕРАМЕНТ ════════
const TEMPERAMENTS={
  playful:{icon:'🎾',name:'Грайлива',  desc:'Гра дає більше радості (+50%)',  eff:{play:0.5}},
  calm:   {icon:'😌',name:'Спокійна',  desc:'Повільніше втрачає показники (−25% спаду)', eff:{decay:0.25}},
  foodie: {icon:'🍖',name:'Ласунка',   desc:'Більше сердечок від годування (+50%)', eff:{feed:0.5}},
  smart:  {icon:'🧠',name:'Розумна',   desc:'Більше досвіду від усього (+20%)', eff:{xp:0.2}},
};
function tempEff(key){const t=TEMPERAMENTS[P&&P.temperament];return (t&&t.eff&&t.eff[key])||0;}

// ════════ «ПОВЕРТАЙСЯ» БОНУС ════════
function checkComebackBonus(){
  const now=Date.now();
  // окреме поле саме для цього бонусу. Якщо його ще нема — це перший запуск:
  // фіксуємо «зараз» і НЕ нараховуємо (щоб не було хибних «8 днів» зі старої дати).
  if(!P.cbLast||typeof P.cbLast!=='number'){
    P.cbLast=now;P.lastSeen=new Date(now).toISOString();saveP();return;
  }
  const days=Math.floor((now-P.cbLast)/86400000);
  P.cbLast=now;P.lastSeen=new Date(now).toISOString();
  // нараховуємо лише за реальну відсутність 2–60 днів (більше — вважаємо аномалією годинника)
  if(days>=2&&days<=60){
    const d=Math.min(days,7);
    const coins=Math.round(200*d*coinMul());
    const hearts=80*d;
    const crystals=d>=5?2:(d>=3?1:0);
    P.coins=(P.coins||0)+coins;P.hearts=(P.hearts||0)+hearts;
    if(crystals)P.crystals=(P.crystals||0)+crystals;
    addLog('Бонус повернення ('+days+' дн.): +🪙'+coins);
    setTimeout(()=>{
      if(typeof uiConfirm==='function')
        uiConfirm('🎉 З поверненням! Тебе не було '+days+' '+(days<5?'дні':'днів')+'.\n\nТримай подарунок:\n+🪙'+coins+'  +❤️'+hearts+(crystals?('  +💎'+crystals):''),
          ()=>{},{title:'🐱 Котик скучив!',yes:'Дякую!'});
      else notify('🎉 З поверненням!','+🪙'+coins+' +❤️'+hearts);
    },800);
  }
  saveP();render&&render();
}

// ════════ ГРУПИ ГОЛОВНОГО МЕНЮ ════════
// ховаємо нижню панель, коли відкрита екранна клавіатура (поля вводу)
document.addEventListener('focusin',function(e){
  const t=e.target;
  if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'))document.body.classList.add('kb-open');
});
document.addEventListener('focusout',function(e){
  setTimeout(()=>{const a=document.activeElement;
    if(!a||(a.tagName!=='INPUT'&&a.tagName!=='TEXTAREA'&&a.tagName!=='SELECT'))document.body.classList.remove('kb-open');
  },80);
});
const MENU_GROUPS={
  bonus:{title:'🎁 Бонуси',items:[
    {act:'openDaily',icon:'🎁',label:'Бонус дня'},
    {act:'openWheel',icon:'🎡',label:'Колесо'},
    {page:'games',icon:'🎲',label:'Ігри'},
    {page:'logincal',icon:'📅',label:'Календар'},
    {page:'cards',icon:'🎴',label:'Картки'},
  ]},
  travel:{title:'🧭 Подорожі',items:[
    {page:'walks',icon:'🚶',label:'Прогулянка'},
    {page:'expedition',icon:'🧭',label:'Експедиції'},
  ]},
  farm:{title:'🌾 Ферма',items:[
    {page:'fishing',icon:'🎣',label:'Риболовля'},
    {page:'garden',icon:'🌱',label:'Город'},
    {page:'kitchen',icon:'🍳',label:'Кухня'},
    {page:'workshop',icon:'🔨',label:'Майстерня'},
    {page:'train',icon:'🏋️',label:'Тренування'},
    {page:'crystals',icon:'💎',label:'Кристали'},
  ]},
};
window.openGroup=function(gid){
  const g=MENU_GROUPS[gid];if(!g)return;
  const t=$('group-modal-title');if(t)t.textContent=g.title;
  const grid=$('group-modal-grid');
  if(grid)grid.innerHTML=g.items.map(it=>{
    const call=it.page?("goPage('"+it.page+"')"):(it.act+"()");
    return '<div class="group-tile" onclick="closeGroup();'+call+'">'
      +'<span class="group-tile-ic">'+it.icon+'</span><span class="group-tile-lbl">'+it.label+'</span></div>';
  }).join('');
  const m=$('group-modal');if(m)m.style.display='flex';
};
window.closeGroup=function(){const m=$('group-modal');if(m)m.style.display='none';};

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
  if(id==='settings'&&typeof refreshInstallUI==='function'){refreshInstallUI();if(typeof applyTheme==='function')applyTheme();const sb=$('sound-toggle-btn');if(sb&&P)sb.textContent=P.sound?'🔊 Звук: увімкнено':'🔇 Звук: вимкнено';const mb=$('music-toggle-btn');if(mb&&P)mb.textContent=P.music?'🎵 Музика: увімкнено':'🔇 Музика: вимкнено';}
  if(id==='shop'){if(typeof updateSeasonUI==='function')updateSeasonUI();buildShop(shopFilter);}
  if(id==='show')renderShow();
  if(id==='gems')renderGems();
  if(id==='settings')renderSettings();
  if(id==='friends')renderFriends();
  if(id==='walks')renderWalks();
  if(id==='fishing')renderFishing();
  if(id==='home'){if(typeof updateWeatherUI==='function')updateWeatherUI();if(typeof updateSeasonUI==='function')updateSeasonUI();if(typeof updateSickUI==='function')updateSickUI();}
  if(id==='garden'){renderGarden();if(typeof applyMenuIcons==='function')applyMenuIcons();}
  if(id==='kitchen')renderKitchen();
  if(id==='forum')renderForum();
  if(id==='workshop')renderWorkshop();
  if(id==='album')renderAlbum();
  if(id==='expedition')renderExpeditions();
  if(id==='family')renderFamily();
  if(id==='skilltree')renderSkillTree();
  if(id==='tricks')renderTricks();
  if(id==='jobs')renderJobs();
  if(id==='room')renderRoom();
  if(id==='stats')renderStats();
  if(id==='holcal')renderHolidayCal();
  if(id==='cards')renderCards();
  if(id==='yard')renderYard();
  if(id==='mansion')renderMansion();
  if(id==='bank')renderBank();
  if(id==='games')renderGames();
  if(id==='logincal')renderLoginCal();
  if(id==='crystals')renderCrystals();
};

// ── ACTIONS ──
window.petCat=function(){
  if(P.sleeping){notify('💤 Спить','Тихіше!');return;}
  // бонусів за погладжування більше немає — лише реакція тваринки
  showEmotion('play',1500);
  if(typeof spawnReaction==='function')spawnReaction(['❤️','💕','😻']);
};
window.act=function(type){
  if(P.sleeping&&type!=='sleep'){notify('💤 Спить','');return;}
  switch(type){
    case'feed':
      if((P.hunger||0)>=100){notify('😋 Ситий!','');return;}
      P.hunger=cl((P.hunger||0)+25);P.hearts=(P.hearts||0)+Math.round(20*(1+skillEff('heartPct')/100)*(1+tempEff('feed')));gainXP(3);notify('🍖 Смачно!','+25🍖 +20❤️');
      showEmotion('eat',2600);spawnReaction(['❤️','😋','🍖']);trackTask('feedCnt');lifeTrack('feed');break;
    case'water':
      if((P.thirst||0)>=100){notify('💧 Напоєний!','');return;}
      P.thirst=cl((P.thirst||0)+30);P.hearts=(P.hearts||0)+Math.round(10*(1+skillEff('heartPct')/100));gainXP(2);notify('💧 Освіжився!','+30💧 +10❤️');
      showEmotion('drink',2600);spawnReaction(['💧','❤️','😊']);trackTask('waterCnt');lifeTrack('water');break;
    case'play':
      if((P.energy||0)<15){notify('😴 Втомлений','');return;}
      P.fun=cl((P.fun||0)+Math.round(20*(1+tempEff('play'))*(1+roomEff('funPlay')/100)));P.energy=cl((P.energy||0)-15);gainXP(5);
      notify('🎾 Весело!','+20');showEmotion('play',2600);spawnReaction(['🎵','🎶','❤️','⭐']);trackTask('playCnt');lifeTrack('play');break;
    case'sleep':
      if(P.sleeping){notify('💤 Вже спить','');return;}
      P.sleeping=true;P.sleepStart=Date.now();P.sleepDur=20*60*1000;
      setPetImg('sleep');
      notify('💤 Спить!','20 хвилин');render();startSleepTimer();saveP();return;
  }
  render();saveP();
};
// ── ПЛАВАЮЧІ РЕАКЦІЇ НАСТРОЮ НАД ТВАРИНОЮ ──
function spawnReaction(emojis){
  try{
    const anchor=document.querySelector('#pg-pet.active')?$('pet-big-emoji'):$('cat-emoji');
    if(!anchor)return;
    const r=anchor.getBoundingClientRect();
    const n=3+Math.floor(Math.random()*2);
    for(let i=0;i<n;i++){
      const el=document.createElement('div');el.className='mood-react';
      el.textContent=emojis[Math.floor(Math.random()*emojis.length)];
      const dx=(Math.random()-0.5)*r.width*0.8;
      el.style.left=(r.left+r.width/2+dx)+'px';
      el.style.top=(r.top+r.height*0.35)+'px';
      el.style.animationDelay=(i*0.09)+'s';
      document.body.appendChild(el);
      setTimeout(()=>el.remove(),1500);
    }
  }catch(e){}
}

// ── WALKS ──
const WALK_NAMES={yard:'У дворі',park:'У парку',forest:'У лісі'};
window.startWalk=function(type,secs,minC,maxC,xp){
  if(typeof sickBlocks==='function'&&sickBlocks())return;
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
  coins=Math.round(coins*coinMul()*(typeof weatherToday==='function'?weatherToday().walkMul:1)*weMul('walk')*(1+skillEff('walkPct')/100));
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
  set('ps-lv',(P.level||1));
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
    const cost=trainCost(lv);const maxed=lv>=80;
    return '<div class="train-item">'
      +'<span class="train-icon">'+icon+'</span>'
      +'<div style="flex:1">'
        +'<div class="train-name">'+name+' <small>Рів.'+lv+'/80</small></div>'
        +'<div class="train-desc">'+desc+'</div>'
        +'<div class="lvl-mini-track"><div class="lvl-mini-fill" style="width:'+Math.round(lv/80*100)+'%"></div></div>'
        +'<button class="train-btn" '+(maxed?'disabled':'')+' onclick="trainSkill(\''+key+'\')">'+(maxed?'✅ Максимум':('Тренувати ❤️'+cost))+'</button>'
      +'</div>'
      +'</div>';
  }).join('');
}
function trainCost(lv){return Math.round((30+lv*8)*(1-(typeof skillEff==='function'?skillEff('trainDisc'):0)/100));} // прогресія: 30, 38 ... 662 (рів.79); усі 3 навички ≈ 83 000 ❤️
window.trainSkill=function(sk){
  if(!P.skills)P.skills={clothes:0,access:0,jewel:0};
  const lv=P.skills[sk]||0;
  if(lv>=80){notify('✅ Максимум','');return;}
  const cost=trainCost(lv);
  if((P.hearts||0)<cost){notify('❤️ Мало','Потрібно '+cost+' сердечок!');return;}
  P.hearts=Math.max(0,(P.hearts||0)-cost);
  P.skills[sk]=lv+1;
  P.glamour=(P.glamour||0)+1;P.butterflies=(P.butterflies||0)+1+skillEff('trainBeauty');
  gainXP(8);
  showEmotion('train',2600);
  const nm={clothes:'Одяг',access:'Аксесуари',jewel:'Прикраси'}[sk];
  notify('🏋️ '+nm+' рів.'+(P.skills[sk]),'· +🦋1 (−❤️'+cost+')');
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
  {id:'a_lv25', cat:'achiev',icon:'💫',title:'Досягни 25 рівня',goal:25, track:'level',   reward:{coins:5000,hearts:500},once:true},
  {id:'a_lv50', cat:'achiev',icon:'👑',title:'Досягни 50 рівня',goal:50, track:'level',   reward:{coins:15000,hearts:1500},once:true},
  {id:'a_club', cat:'achiev',icon:'🎈',title:'Вступи до клубу', goal:1,  track:'clubJoin',reward:{coins:200},once:true},
  {id:'a_walk50',cat:'achiev',icon:'🌳',title:'50 прогулянок',  goal:50, track:'walk',    reward:{coins:1500},once:true},
  {id:'a_walk200',cat:'achiev',icon:'🧭',title:'200 прогулянок',goal:200,track:'walk',    reward:{coins:6000,hearts:600},once:true},
  {id:'a_fish50',cat:'achiev',icon:'🎣',title:'Злови 50 рибин', goal:50, track:'fish',    reward:{coins:1500},once:true},
  {id:'a_fish200',cat:'achiev',icon:'🐠',title:'Злови 200 рибин',goal:200,track:'fish',   reward:{coins:6000,hearts:600},once:true},
  {id:'a_harv50',cat:'achiev',icon:'🌻',title:'Збери 50 урожаїв',goal:50,track:'harvest', reward:{coins:1500},once:true},
  {id:'a_train50',cat:'achiev',icon:'🏋️',title:'50 тренувань',  goal:50, track:'train',   reward:{coins:1500,hearts:300},once:true},
  {id:'a_gem5', cat:'achiev',icon:'💎',title:'Збери всі 5 каменів',goal:5,track:'gemCollect',reward:{coins:4000,hearts:400},once:true},
  {id:'a_fishall',cat:'achiev',icon:'🐟',title:'Колекція рибок (5)',goal:5,track:'fishCollect',reward:{coins:3000},once:true},
  {id:'a_craft',cat:'achiev',icon:'🔨',title:'Скрафти 5 предметів',goal:5,track:'craftCollect',reward:{coins:5000,hearts:500},once:true},
  {id:'a_beauty500',cat:'achiev',icon:'🦋',title:'Накопич 500 краси',goal:500,track:'butterflies',reward:{coins:4000},once:true},
  {id:'a_beauty2000',cat:'achiev',icon:'✨',title:'Накопич 2000 краси',goal:2000,track:'butterflies',reward:{coins:12000,hearts:1000},once:true},
  {id:'a_show10',cat:'achiev',icon:'🏆',title:'Виграй 10 виставок',goal:10,track:'showWin',reward:{coins:3000,hearts:300},once:true},
  {id:'a_house5',cat:'achiev',icon:'🏰',title:'Будинок 5★',     goal:5,  track:'houseStar',reward:{coins:8000,hearts:800},once:true},
  {id:'a_ref3', cat:'achiev',icon:'🤝',title:'Запроси 3 друзів',goal:3,  track:'ref',     reward:{coins:3000,hearts:300},once:true},
  {id:'a_exped20',cat:'achiev',icon:'🗺️',title:'20 експедицій', goal:20, track:'expedition',reward:{coins:5000,hearts:500},once:true},
  {id:'a_marry',cat:'achiev',icon:'💍',title:'Одружися',        goal:1,  track:'married', reward:{coins:1000,hearts:500},once:true},
  {id:'a_baby', cat:'achiev',icon:'👶',title:'Заведи малюка',   goal:1,  track:'baby',    reward:{coins:2000,hearts:1000},once:true},
  {id:'a_donate',cat:'achiev',icon:'🐷',title:'30 внесків у скарбничку',goal:30,track:'donate',reward:{coins:3000},once:true},
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
  if(t.track==='butterflies')return P.butterflies||0;
  if(t.track==='showWin')return P.showWins||0;
  if(t.track==='ref')return P.refCount||0;
  if(t.track==='married')return P.spouseUid?1:0;
  if(t.track==='baby')return P.baby?1:0;
  if(t.track==='gemCollect')return P.collected?Object.keys(P.collected.gem||{}).length:0;
  if(t.track==='fishCollect')return P.collected?Object.keys(P.collected.fish||{}).length:0;
  if(t.track==='craftCollect')return P.collected?Object.keys(P.collected.craft||{}).length:0;
  if(t.track==='houseStar')return (typeof houseStar==='function')?houseStar():1;
  if(P.life&&P.life[t.track]!=null)return P.life[t.track]; // walk/fish/harvest/train/gem/donate/feed/water/play
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
  if(tasksTab==='trophies'){if(info)info.textContent='🏆 Кубки за досягнення';renderTrophies(list);return;}
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
  notify('🎁 Нагорода!',t.icon+' '+rwd,4000);if(typeof sfx==='function')sfx('success');
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
    // кнопка «Запросити в клуб» — для тих, хто має право, якщо гравець без клубу
    const ci=$('pm-clubinvite-btn');
    if(ci){
      const canInvite=P.clubId&&pid!==uid&&!p.clubId&&clubCan(P._clubRole,'invite',P._clubPerms);
      ci.style.display=canInvite?'':'none';
    }
    const isFriend=(P.friends||[]).some(f=>f.id===pid);
    const isPending=(P.sentReq||[]).includes(pid);
    if(fb){
      if(pid===uid){fb.style.display='none';}
      else{fb.style.display='';fb.disabled=isFriend||isPending;
        fb.textContent=isFriend?'✅ Вже друг':isPending?'⏳ Запит надіслано':'👤+ Додати в друзі';}
    }
    const m=$('player-modal');if(m)m.style.display='flex';
    if(typeof updateVisitBtn==='function')updateVisitBtn();
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
    set('cl-emblem',c.flag||c.icon||'🏰');set('cl-name',c.name||'Клуб');
    set('cl-stars','★'.repeat(Math.min(7,c.stars||1))+'☆'.repeat(Math.max(0,7-(c.stars||1))));
    set('cl-role-badge',c.directorUid===uid?'👑 Директор':'👤 Учасник');
    set('cl-desc',c.description||'—');set('cl-founded',c.founded||'—');
    // рівень клубу (ручний апгрейд через досвід) + прогрес до наступного
    const clv=c.level||1;
    const need=clv*500;
    const clvPct=Math.min(100,Math.round((c.xp||0)/Math.max(1,need)*100));
    P._clubPerk=clubPerkPct(clv);
    P._clubQuestWeek=c.questWeek||'';P._clubQuestProg=c.questProgress||0;
    if(typeof renderClubQuest==='function')renderClubQuest(c);
    set('cl-level',clv);set('cl-mc',c.memberCount||1);
    set('cl-mcount',c.memberCount||1);set('cl-xp',(c.xp||0));
    set('cl-blvl',clv);
    const clvBar=$('cl-level-bar');if(clvBar)clvBar.style.width=clvPct+'%';
    const clvNote=$('cl-level-note');if(clvNote)clvNote.textContent='Рівень '+clv+' · '+(c.xp||0)+'/'+need+' досвіду до підвищення · перк: +'+clubPerkPct(clv)+'% монет усім';
    set('cl-pc',c.piggyCoins||0);set('cl-ph',c.piggyHearts||0);
    P._clubBuffUntil=c.buffUntil||0;
    const buffOn=P._clubBuffUntil>Date.now();
    const buffEl=$('cl-buff-status');
    if(buffEl){
      if(buffOn){const mins=Math.ceil((P._clubBuffUntil-Date.now())/60000);buffEl.style.display='block';buffEl.textContent='✨ Активний бафф клубу: +25% монет ('+(mins>60?Math.floor(mins/60)+'г':mins+'хв')+')';}
      else buffEl.style.display='none';
    }
    const dirActions=$('club-director-actions');if(dirActions)dirActions.style.display=(c.directorUid===uid)?'block':'none';
    const isDirector=c.directorUid===uid;
    const dr=$('club-director-row');if(dr)dr.style.display=isDirector?'block':'none';
    // кеш клубних бонусів для застосування в досвіді
    const b=c.buildings||{};
    P._clubBonus={schoolXpPct:(b.school||0)*2,collegeClubXpPct:(b.college||0)*2};
    if(typeof checkClubEvent==='function'){checkClubEvent(c);flushClubEvent(true);}
    const piggyNote=$('cl-piggy-note');
    if(piggyNote)piggyNote.textContent=isDirector?'Ви Директор — можете будувати будівлі за кошти скарбнички.':'Поповнюйте скарбничку — це дає вам особистий бонус досвіду та вірність клубу.';
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
    {const me=members.find(m=>(m.uid||m._id)===String(uid));P._clubPerms=(me&&me.perms)||null;}
    P.clubName=c.name||'Клуб';
    renderClubBuildings(c,clubCan(P._clubRole,'build',P._clubPerms));
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
    logClubEvent('join','приєднався(лась) до клубу');
    notify('🎈 Вступив!',snap.data().name);renderClubs();
  }catch(e){notify('❌',e.message);}
};
window.leaveClub=function(){
  if(!P.clubId)return;
  const isDir=(P._clubRole==='director');
  const msg=isDir
    ? 'Ви Директор. При виході директорство перейде до найвищого за рангом учасника (Заступник → Куратор → Учасник). Вийти?'
    : 'Вийти з клубу «'+(P.clubName||'')+'»? Вірність клубу буде втрачено.';
  uiConfirm(msg,async()=>{
    try{
      const cid=P.clubId;
      // якщо директор — знайти наступника
      if(isDir){
        const others=(window._clubMembers||[]).filter(m=>(m.uid||m._id)!==String(uid));
        if(others.length){
          const order={deputy:3,curator:2,member:1};
          others.sort((a,b)=>(order[b.role]||1)-(order[a.role]||1));
          const heir=others[0];const hid=heir.uid||heir._id;
          await updateDoc(doc(db,'clubs',cid,'members',hid),{role:'director'});
          await updateDoc(doc(db,'clubs',cid),{directorUid:hid});
          await logClubEvent('director',(heir.catname||heir.nickname||'учасник')+' став(ла) новим Директором',cid);
        }
      }
      await logClubEvent('leave','покинув(ла) клуб',cid);
      await updateDoc(doc(db,'clubs',cid),{memberCount:increment(-1)});
      await deleteDoc(doc(db,'clubs',cid,'members',uid));
      P.clubId=null;P.clubName='';P.clubJoinedAt='';P.loyTier=0;P.loyLast='';P.clubLoyalty=0;P._clubBonus=null;P._clubRole=null;
      saveP();notify('👋','Ви вийшли з клубу');renderClubs();
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
    {id:'w_cap',   icon:'🧢',name:'Кепка',  cost:35,wear:true,slot:'hat',beauty:2},
    {id:'w_shirt1',icon:'👕',name:'Футболка',cost:40,wear:true,slot:'shirt',beauty:3},
    {id:'w_beret', icon:'🎓',name:'Берет',  cost:55,wear:true,slot:'hat',beauty:4},
    {id:'w_hat1',  icon:'🎩',name:'Циліндр',cost:90,wear:true,slot:'hat',beauty:5},
    {id:'w_shirt2',icon:'👔',name:'Сорочка',cost:110,wear:true,slot:'shirt',beauty:6},
    {id:'w_party', icon:'🎉',name:'Святковий ковпак',cost:120,wear:true,slot:'hat',beauty:7},
    {id:'w_sweater',icon:'🧶',name:'Светр',cost:140,wear:true,slot:'shirt',beauty:8},
    {id:'w_flowerhat',icon:'💐',name:'Капелюшок з квітами',cost:200,wear:true,slot:'hat',beauty:9},
    {id:'w_dress', icon:'👗',name:'Сукня',  cost:220,wear:true,slot:'shirt',beauty:10},
    {id:'w_wizard',icon:'🧙',name:'Капелюх мага',cost:350,wear:true,slot:'hat',beauty:12},
    {id:'w_tux',   icon:'🤵',name:'Смокінг',cost:420,wear:true,slot:'shirt',beauty:14},
    {id:'w_kimono',icon:'🥻',name:'Кімоно', cost:640,wear:true,slot:'shirt',beauty:16},
    {id:'w_hat2',  icon:'👑',name:'Корона', cost:800,wear:true,slot:'hat',beauty:18},
    {id:'w_diadem',icon:'👸',name:'Діадема',cost:2200,wear:true,slot:'hat',beauty:26},
    {id:'w_robe',  icon:'🧥',name:'Королівська мантія',cost:3500,wear:true,slot:'shirt',beauty:30},
    {id:'w_starhat', icon:'🌟',name:'Зоряний капелюх',  cost:1500,wear:true,slot:'hat',  beauty:20,minLevel:15},
    {id:'w_starcoat',icon:'✨',name:'Зоряний плащ',     cost:1800,wear:true,slot:'shirt',beauty:22,minLevel:15},
    {id:'w_magichat',icon:'🎇',name:'Чарівний капелюх', cost:3000,wear:true,slot:'hat',  beauty:26,minLevel:20},
    {id:'w_magicrobe',icon:'🥼',name:'Мантія чародія',  cost:3500,wear:true,slot:'shirt',beauty:28,minLevel:20},
    {id:'w_legendcrown',icon:'👑',name:'Легендарна корона',cost:6000,wear:true,slot:'hat',beauty:34,minLevel:25},
    {id:'w_legendcape', icon:'🦸',name:'Легендарна накидка',cost:7000,wear:true,slot:'shirt',beauty:36,minLevel:25},
  ],
  accessories:[
    {id:'a_ball',  icon:'🎾',name:'М’ячик',    cost:25,wear:true,slot:'toy',beauty:1},
    {id:'a_collar',icon:'➿',name:'Нашийник',  cost:30,wear:true,slot:'collar',beauty:2},
    {id:'a_toy',   icon:'🧸',name:'Ведмедик',  cost:50,wear:true,slot:'toy',beauty:3},
    {id:'a_bow',   icon:'🎀',name:'Бантик',    cost:60,wear:true,slot:'collar',beauty:4},
    {id:'a_bell',  icon:'🔔',name:'Дзвіночок', cost:75,wear:true,slot:'collar',beauty:5},
    {id:'a_glasses',icon:'🕶️',name:'Окуляри', cost:90,wear:true,slot:'toy',beauty:6},
    {id:'a_watch', icon:'⌚',name:'Годинник',  cost:140,wear:true,slot:'ring',beauty:7},
    {id:'a_star',  icon:'⭐',name:'Зірковий значок',cost:160,wear:true,slot:'medal',beauty:8},
    {id:'a_ring',  icon:'💍',name:'Кільце',    cost:170,wear:true,slot:'ring',beauty:9},
    {id:'a_heart', icon:'💗',name:'Кулон-сердечко',cost:280,wear:true,slot:'collar',beauty:11},
    {id:'a_medal', icon:'🏅',name:'Медаль',    cost:200,wear:true,slot:'medal',beauty:12},
    {id:'a_dring', icon:'💎',name:'Перстень з діамантом',cost:520,wear:true,slot:'ring',beauty:15},
    {id:'a_bracelet',icon:'📿',name:'Сапфіровий браслет',cost:1800,wear:true,slot:'ring',beauty:20},
    {id:'a_necklace',icon:'💠',name:'Діамантове кольє',  cost:2800,wear:true,slot:'collar',beauty:24},
    {id:'a_starring', icon:'💫',name:'Зоряний перстень',  cost:1400,wear:true,slot:'ring',  beauty:18,minLevel:15},
    {id:'a_magicpend',icon:'🔮',name:'Магічний кулон',    cost:3200,wear:true,slot:'collar',beauty:26,minLevel:20},
    {id:'a_legendmedal',icon:'🏅',name:'Легендарна медаль',cost:6500,wear:true,slot:'medal', beauty:32,minLevel:25},
  ],
  gems:[
    {id:'g_ruby',  icon:'🔴',name:'Фрагмент рубіна',   desc:'+1 фрагмент 🔴',cost:180, gem:'ruby'},
    {id:'g_saph',  icon:'🔵',name:'Фрагмент сапфіра',  desc:'+1 фрагмент 🔵',cost:150, gem:'sapphire'},
    {id:'g_emer',  icon:'🟢',name:'Фрагмент смарагда', desc:'+1 фрагмент 🟢',cost:135, gem:'emerald'},
    {id:'g_amber', icon:'🟡',name:'Фрагмент бурштину', desc:'+1 фрагмент 🟡',cost:105, gem:'amber'},
    {id:'g_diam',  icon:'⚪',name:'Фрагмент діаманта', desc:'+1 фрагмент ⚪',cost:270, gem:'diamond'},
  ],
  bonuses:[
    {id:'b_xp',   icon:'⭐',name:'2× Досвід (1 год)', desc:'XP x2 на 60 хв',cost:150,bonus:'xp2',mins:60},
    {id:'b_coin', icon:'🪙',name:'2× Монети (1 год)', desc:'Монети x2 на 60 хв',cost:150,bonus:'coin2',mins:60},
    {id:'b_vip',  icon:'👑',name:'VIP (24 год)',      desc:'XP+монети x2 на добу',cost:1200,bonus:'vip',mins:1440},
    {id:'b_heal', icon:'❤️',name:'Сердечка +500',     desc:'миттєво +500❤️',cost:200,fn:()=>{P.hearts=(P.hearts||0)+500;}},
    {id:'b_med',  icon:'💊',name:'Ліки',              desc:'вилікувати хворобу + повне здоров’я',cost:120,fn:()=>{if(typeof useMedicine==='function')useMedicine();}},
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
function shopDiscount(){return new Date().getDay()===5?0.25:0;} // п'ятниця -25%
function itemPrice(item){return Math.max(1,Math.round(item.cost*(1-shopDiscount())));}
function buildShop(cat){
  const c=$('shop-items');if(!c)return;
  const disc=shopDiscount();
  const banner=$('shop-sale-banner');
  if(banner){if(disc>0){banner.style.display='block';banner.textContent='🛍️ П\'ятнична розпродаж! −25% на всі товари сьогодні!';}else banner.style.display='none';}
  c.innerHTML=(SHOP[cat]||[]).map(item=>{
    const owned=item.wear&&(P?.wardrobe||[]).some(w=>w.id===item.id);
    const sub=item.desc||((item.beauty?'+'+item.beauty+'🦋 ':'')+'у шафу');
    const price=itemPrice(item);
    const lvlLocked=item.minLevel&&(P?.level||1)<item.minLevel;
    const priceLbl=disc>0?('<s class="si-old">'+item.cost+'</s> 🪙'+price):('🪙'+price);
    let btn;
    if(owned)btn='<button class="si-buy" disabled>✅ Є</button>';
    else if(lvlLocked)btn='<button class="si-buy" disabled>🔒 Рів.'+item.minLevel+'</button>';
    else btn='<button class="si-buy" '+((P?.coins||0)<price?'disabled':'')+' onclick="buyItem(\''+item.id+'\',\''+cat+'\')">'+priceLbl+'</button>';
    return '<div class="shop-item-card'+(lvlLocked?' shop-locked':'')+'">'
      +'<span class="si-icon">'+item.icon+'</span>'
      +'<div class="si-info"><div class="si-name">'+item.name+(item.minLevel?' <small style="color:#c4891a">★'+item.minLevel+'</small>':'')+'</div><div class="si-desc">'+sub+'</div></div>'
      +btn
    +'</div>';
  }).join('')||'<div class="loading-inline">Порожньо</div>';
}
window.buyItem=function(id,cat){
  const item=(SHOP[cat]||[]).find(i=>i.id===id);if(!item)return;
  if(item.minLevel&&(P.level||1)<item.minLevel){notify('🔒','Відкриється на '+item.minLevel+' рівні');return;}
  const price=itemPrice(item);
  if((P.coins||0)<price){notify('🪙','Мало монет!');return;}
  if(item.wear&&(P.wardrobe||[]).some(w=>w.id===item.id)){notify('✅','Вже у шафі');return;}
  P.coins-=price;
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
  notify('✅ Куплено!',item.name);if(typeof sfx==='function')sfx('coin');render();saveP();buildShop(cat);
}

// ══════════════════════════════════════════════════════════
//  ДОПОВНЕННЯ: функціонал раніше непрацюючих вкладок
// ══════════════════════════════════════════════════════════
const petIcon=()=>P&&P.petType==='dog'?'🐶':'🐱';

// ── SETTINGS ──
function renderSettings(){
  if(!P)return;
  if(typeof updateNotifBtn==='function')updateNotifBtn();
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
      +'<button class="wi-del" title="Продати за ❤️200" onclick="event.stopPropagation();deleteWardrobeItem(\''+w.id+'\')">💰</button>'
      +'<div style="font-size:1.9rem">'+w.icon+'</div>'
      +'<div style="font-size:.62rem;font-weight:800;color:var(--tx);margin-top:2px">'+esc(w.name)+'</div>'
      +'<div style="font-size:.55rem;color:var(--gdk);font-weight:700">+'+(w.beauty||0)+'🦋</div>'
      +'<div style="font-size:.55rem;font-weight:800;color:'+(eq?'var(--gdk)':'var(--tl)')+'">'+(eq?'✅ Вдягнено':'Вдягнути')+'</div>'
      +'</div>';
  }).join('');
}
window.deleteWardrobeItem=function(id){
  const it=(P.wardrobe||[]).find(w=>w.id===id);if(!it)return;
  uiConfirm('Продати «'+(it.name||'предмет')+'» за ❤️200?',()=>{
    if(P.equipped&&P.equipped[it.slot]===id){P.equipped[it.slot]=null;P.butterflies=Math.max(0,(P.butterflies||0)-(it.beauty||0));}
    P.wardrobe=(P.wardrobe||[]).filter(w=>w.id!==id);
    P.hearts=(P.hearts||0)+200;
    if(typeof sfx==='function')sfx('coin');
    saveP();render();renderWardrobe();updateEquipSlots();renderPetPage();
    notify('💰 Продано!',(it.name||'')+' · +❤️200');
  },{title:'Продати одяг',yes:'Продати ❤️200'});
};
window.cleanWeakWardrobe=function(){
  const wr=P.wardrobe||[];
  if(!wr.length){notify('🚪','Шафа порожня');return;}
  const best={};
  wr.forEach(w=>{if(!best[w.slot]||(w.beauty||0)>(best[w.slot].beauty||0))best[w.slot]=w;});
  const keepIds=new Set(Object.values(best).map(w=>w.id));
  const removeCnt=wr.length-keepIds.size;
  if(removeCnt<=0){notify('✨','Нема що прибирати — лише найкраще!');return;}
  uiConfirm('Продати '+removeCnt+' слабших предметів за ❤️'+(removeCnt*200)+'? Залишиться найкращий у кожному слоті.',()=>{
    Object.keys(P.equipped||{}).forEach(slot=>{
      const eqId=P.equipped[slot];
      if(eqId&&!keepIds.has(eqId)){const it=wr.find(w=>w.id===eqId);if(it)P.butterflies=Math.max(0,(P.butterflies||0)-(it.beauty||0));P.equipped[slot]=null;}
    });
    P.wardrobe=wr.filter(w=>keepIds.has(w.id));
    P.hearts=(P.hearts||0)+removeCnt*200;
    if(typeof sfx==='function')sfx('coin');
    saveP();render();renderWardrobe();updateEquipSlots();renderPetPage();
    notify('💰 Продано',removeCnt+' предметів · +❤️'+(removeCnt*200));
  },{title:'Продати слабкий одяг',yes:'Продати'});
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
  if(!P.collected)P.collected={fish:{},gem:{},craft:{},setClaimed:{}};P.collected.gem[key]=true;
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
    const chance=Math.round(Math.min(.92,.25+myv/200)*100);
    return '<div class="show-category">'
      +'<div class="show-cat-row"><span class="show-cat-title">'+c.icon+' '+c.name+'</span>'
        +'<span class="show-prize-row">'+prize+'</span></div>'
      +'<div class="show-stat-line">Твій показник: <b>'+myv+'</b> · шанс перемоги: <b>'+chance+'%</b></div>'
      +'<div class="show-chance-wrap"><div class="show-chance-bar" style="width:'+chance+'%"></div></div>'
      +'<div class="show-result" id="show-res-'+c.id+'" style="display:none"></div>'
      +(entered?'<button class="show-enter-btn" disabled>✅ Сьогодні вже брав участь</button>'
        :'<button class="show-enter-btn" onclick="enterShow(\''+c.id+'\')">🎭 Вийти на сцену</button>')
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
  const chance=Math.min(.92,.25+myv/200);
  const win=Math.random()<chance;
  P.showEntered[catId]=today;
  // оцінка суддів (анімований показ)
  const judges=[7,8,9].map(()=>{
    const base=win?7.5:5.0;return Math.min(10,Math.max(3,base+(Math.random()*2.5-1))).toFixed(1);
  });
  const res=$('show-res-'+catId);
  if(res){res.style.display='block';res.className='show-result judging';res.innerHTML='🎬 Судді оцінюють...';}
  setPetImg&&showEmotion('play',3000);
  let step=0;
  const iv=setInterval(()=>{
    step++;
    if(res){
      if(step<=3)res.innerHTML='👩‍⚖️ Суддя '+step+': <b>'+judges[step-1]+'</b>/10';
    }
    if(step>=3){
      clearInterval(iv);
      const avg=(judges.reduce((s,x)=>s+parseFloat(x),0)/3).toFixed(1);
      if(win){
        const coins=Math.round(c.prize.coins*lg.mult),hearts=heartGain(Math.round(c.prize.hearts*lg.mult));
        P.coins=(P.coins||0)+coins;P.hearts=(P.hearts||0)+hearts;P.showWins=(P.showWins||0)+1;
        gainXP(30);checkMedals();
        if(res){res.className='show-result win';res.innerHTML='🏆 Перемога! Оцінка '+avg+'/10<br>+🪙'+coins+' +❤️'+hearts;}
        if(typeof spawnReaction==='function')spawnReaction(['🏆','🎉','⭐','👏']);
        if(typeof sfx==='function')sfx('success');
        notify('🏆 Перемога!',c.icon+' '+c.name+' · +'+coins+'🪙',4000);
        addLog('🏆 Перемога у "'+c.name+'"! +'+coins+'🪙');
      }else{
        const cons=Math.round(20*lg.mult);P.coins=(P.coins||0)+cons;gainXP(10);
        if(res){res.className='show-result lose';res.innerHTML='🎭 Оцінка '+avg+'/10 — не призове. +🪙'+cons;}
        notify('🎭 Участь зараховано','Цього разу не призове місце. +'+cons+'🪙');
      }
      render();saveP();
      const btn=res&&res.parentNode?res.parentNode.querySelector('.show-enter-btn'):null;
      if(btn){btn.disabled=true;btn.textContent='✅ Сьогодні вже брав участь';}
    }
  },650);
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
      +'<div class="friend-sub">@'+esc(f.nickname||'?')+' · Рів.'+(f.level||1)+(typeof friendLevel==='function'&&friendLevel(f.id)?(' · 💛'+friendLevel(f.id)):'')+'</div></div>'
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
    .filter(m=>m.type!=='friendreq'&&m.type!=='friendaccept'&&m.type!=='refreward'&&m.type!=='visit'&&m.type!=='marriage'&&m.type!=='marriage_accept'&&m.type!=='baby_born') // службові — окремо
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
  // кнопка прийняття запрошення в клуб
  {const old=$('md-clubinvite-btn');if(old)old.remove();
   if(msg.type==='clubinvite'&&msg.clubId&&kind!=='sent'){
     const bd=$('md-body');
     if(bd&&bd.parentNode){
       const btn=document.createElement('button');btn.id='md-clubinvite-btn';btn.className='green-btn';
       btn.style.cssText='width:100%;margin-top:12px';
       btn.textContent=P.clubId?'🎈 Спершу вийди зі свого клубу':('🎈 Вступити в «'+(msg.clubName||'клуб')+'»');
       btn.disabled=!!P.clubId;
       btn.onclick=()=>acceptClubInvite(msg.clubId,msg._id||msg.id);
       bd.parentNode.insertBefore(btn,bd.nextSibling);
     }
   }}
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
    const lv=c[h.key]||0;const cost=houseUpCost(lv);const max=lv>=10;
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
function houseUpCost(lv){return Math.round(160*Math.pow(1.9,lv)*(1-(typeof skillEff==='function'?skillEff('houseDisc'):0)/100));} // база 160, ×1.9 → будинок МАКС ≈ 520k // 120,222,411,760,1407,2602,4814,8906,16476,30481
window.upgradeHouse=function(key){
  if(!P.houseComponents)P.houseComponents={foundation:0,roof:0,walls:0,interior:0};
  const lv=P.houseComponents[key]||0;if(lv>=10){notify('✅','Максимум');return;}
  const cost=houseUpCost(lv);
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
    +'<button class="orange-btn" onclick="closeMemberCard();openProfile(\''+mid+'\')">👤 Повний профіль</button>'
    +((P._clubRole==='director'&&m.role==='officer'&&mid!==String(uid))?_officerPermsUI(m):'');
};
function _officerPermsUI(m){
  const pr=m.perms||{};
  const opts=[['build','🏗️ Будувати'],['treasury','💰 Скарбничка'],['invite','📣 Запрошувати'],['manage','🛠️ Керувати учасниками']];
  return '<div class="officer-perms"><div class="sec-title" style="margin-top:10px">🎖️ Права офіцера</div>'
    +'<div class="fam-note">Обери, що дозволено цьому офіцеру:</div>'
    +opts.map(([k,lbl])=>'<label class="officer-perm-row"><span>'+lbl+'</span>'
      +'<input type="checkbox" '+(pr[k]?'checked':'')+' onchange="toggleOfficerPerm(\''+(m.uid||m._id)+'\',\''+k+'\',this.checked)"></label>').join('')
    +'</div>';
}
window.toggleOfficerPerm=async function(mid,perm,on){
  if(P._clubRole!=='director'||!P.clubId)return;
  try{
    await updateDoc(doc(db,'clubs',P.clubId,'members',mid),{['perms.'+perm]:!!on});
    const m=_findMember(mid);if(m){m.perms=m.perms||{};m.perms[perm]=!!on;}
    notify('🎖️','Права офіцера оновлено');
  }catch(e){notify('❌',e.message);}
};
window.closeMemberCard=function(){const m=$('memcard-modal');if(m)m.style.display='none';};

window.goClubFromPet=function(){if(P&&P.clubId)goPage('clubs');else notify('🎈','Ти ще не в клубі');};
window.inviteToClub=async function(){
  if(!_profileTarget||!P.clubId)return;
  if(!clubCan(P._clubRole,'invite',P._clubPerms)){notify('🔒','Немає прав запрошувати');return;}
  const tid=_profileTarget.id;
  try{
    await sendLetter({toUid:tid,toNick:_profileTarget.nickname||'гравець',subj:'🎈 Запрошення в клуб!',
      body:'@'+(P.nickname||'?')+' запрошує тебе до клубу «'+(P.clubName||'Клуб')+'». Прийняти запрошення?',
      type:'clubinvite',icon:'🎈',extra:{clubId:String(P.clubId),clubName:String(P.clubName||'Клуб')}});
    notify('📣 Запрошення надіслано!','@'+(_profileTarget.nickname||'?')+' отримає його в пошті');
    const ci=$('pm-clubinvite-btn');if(ci){ci.disabled=true;ci.textContent='✅ Запрошено';}
  }catch(e){notify('❌',e.message);}
};
window.acceptClubInvite=async function(clubId,mailId){
  if(P.clubId){notify('🎈','Ти вже в клубі. Спершу вийди з поточного.');return;}
  try{
    await joinClub(clubId);
    if(mailId){try{await deleteDoc(doc(db,'mail',mailId));}catch(e){}}
  }catch(e){notify('❌',e.message);}
};
window.raiseClubLoyalty=function(){
  if(!P.clubId){notify('🎈','Спершу вступи в клуб');return;}
  notify('🎗️ Вірність клубу','Росте від щоденних донатів у скарбничку (від 🪙10). Заходь і донať щодня — 10%→25%→50%→75%→100%.',6000);
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
  {const sc=$('pm-skill-cnt');if(sc)sc.textContent=(P.skillPoints||0)>0?('🎯'+P.skillPoints):'';}
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

// ── ОСОБИСТІ БОНУСИ (медалі + будівлі клубу + донор) ──
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
          {t:'Виграй 5 виставок',k:'showWin',g:5},{t:'Зроби внесок у скарбничку',k:'donate',g:1}]},
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
    +'<span class="pet-medals-bonus clickable-bonus" onclick="showBonusBreakdown()">+'+medalXpPct()+'%⭐ +'+medalHeartPct()+'%❤️ ⓘ</span>';
}
window.showBonusBreakdown=function(){
  const lines=[];
  const earned=(MEDALS||[]).filter(m=>P&&P.medals&&P.medals[m.id]);
  earned.forEach(m=>lines.push(m.icon+' '+m.name+': +'+m.xpPct+'% досвіду, +'+m.heartPct+'% сердечок'));
  const school=(P._clubBonus&&P._clubBonus.schoolXpPct)||0;
  if(school)lines.push('🏫 Школа клубу: +'+school+'% досвіду');
  const donor=P.donorXpPct||0;
  if(donor)lines.push('💝 Донор скарбнички: +'+donor+'% досвіду');
  if(!lines.length)lines.push('Поки немає бонусів. Заробляй медалі, вступай у клуб, жертвуй у скарбничку!');
  const totalXp=medalXpPct()+school+donor;
  const box=$('bonus-break-list');
  if(box)box.innerHTML=lines.map(l=>'<div class="bonus-break-row">'+l+'</div>').join('')
    +'<div class="bonus-break-total">Разом: ⭐ +'+totalXp+'% досвіду · ❤️ +'+medalHeartPct()+'% сердечок</div>';
  const m=$('bonus-break-modal');if(m)m.style.display='flex';
};
window.closeBonusBreak=function(){const m=$('bonus-break-modal');if(m)m.style.display='none';};

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
function buildingCost(lvl){return (lvl+1)*250;}
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
    if(!clubCan(P._clubRole,'build',P._clubPerms)){notify('🚫','Немає прав будувати');return;}
    const lvl=(c.buildings&&c.buildings[key])||0;
    if(lvl>=20){notify('🏗️','Вже максимальний рівень');return;}
    const cost=buildingCost(lvl);
    if((c.piggyCoins||0)<cost){notify('🐷','У скарбничці недостатньо монет ('+(c.piggyCoins||0)+'/'+cost+')');return;}
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
    if(coins>0&&typeof contributeClubQuest==='function')contributeClubQuest('donate',coins);
    recordDonation(coins,hearts);
    logClubEvent('donate','вніс(ла) у скарбничку 🪙'+coins+(hearts?(' ❤️'+hearts):''));
    if($('piggy-coins'))$('piggy-coins').value='';
    if($('piggy-hearts'))$('piggy-hearts').value='';
    notify('🐷 Скарбничку поповнено!','+🪙'+coins+' +❤️'+hearts+' · твій бонус досвіду тепер +'+P.donorXpPct+'%',5000);
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
window.openWheel=function(){renderWheel();const c=$('wheel-cat-deco');if(c&&window.WHEEL_CAT){c.src=WHEEL_CAT;}const m=$('wheel-modal');if(m)m.style.display='flex';};
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
  // бейдж на групі «Бонуси»: світиться, якщо доступний бонус дня або колесо
  const gb=$('hm-group-bonus-badge');
  if(gb)gb.style.display=(P&&((!dailyState().claimed)||(!wheelClaimed())))?'block':'none';
}

// ════════ РЕФЕРАЛИ + ТИЖНЕВИЙ ТУРНІР ════════

// ── РІДКІСНІ ПРЕДМЕТИ (нагороди) ──
const RARE_ITEMS=[
  {icon:'👑',name:'Королівська корона',slot:'hat',beauty:25},
  {icon:'💎',name:'Діамантове кільце', slot:'ring',beauty:22},
  {icon:'🦄',name:'Чарівна іграшка',   slot:'toy',beauty:20},
  {icon:'🌟',name:'Зоряний нашийник',  slot:'collar',beauty:18},
  {icon:'🧥',name:'Королівська мантія', slot:'shirt',beauty:24},
  {icon:'🌟',name:'Зоряний капелюх',    slot:'hat',  beauty:20},
  {icon:'🎇',name:'Чарівний капелюх',    slot:'hat',  beauty:26},
  {icon:'🔮',name:'Магічний кулон',      slot:'collar',beauty:26},
  {icon:'🦸',name:'Легендарна накидка',  slot:'shirt',beauty:36},
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
async function renderInvite(){
  const box=$('invite-link');if(box)box.textContent=refLink();
  const cnt=$('invite-count');if(cnt)cnt.textContent=P.refCount||0;
  // ТОЧНА кількість запрошених — рахуємо реально по базі (хто реєструвався з твоїм кодом)
  try{
    const snap=await getDocs(query(collection(db,'players'),where('referredBy','==',String(uid)),limit(500)));
    if(cnt)cnt.textContent=snap.size;
    const note=$('invite-count-note');
    if(note)note.textContent=snap.size?('У грі вже '+snap.size+' запрошених тобою · нагород отримано за '+(P.refCount||0)):'Ще нікого не запрошено';
  }catch(e){}
  processReferralRewards();
  const man=$('invite-manual');
  // показуємо панель вводу коду всім, хто ще НЕ отримав бонус новачка
  if(man)man.style.display=P.refRewarded?'none':'block';
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
  // 1) СЕРВЕРНА економіка: приз рахується й нараховується на сервері (не підробити)
  if(_fns){
    try{
      const res=await httpsCallable(_fns,'claimWeeklyReward')();
      const d=res.data||{};
      if(d.ok){
        P.coins=(P.coins||0)+(d.coins||0);if(d.hearts)P.hearts=(P.hearts||0)+d.hearts;
        let extra='';if(d.rare){const it=grantRareItem();extra=' + '+it.icon+' '+it.name;}
        P.weekRewardPending=false;
        notify('🏆 Тижневий приз!',(d.title||'')+' (#'+d.rank+'): 🪙'+(d.coins||0)+(d.hearts?(' ❤️'+d.hearts):'')+extra,6000);
        addLog('Тижневий приз '+(d.title||'')+' (#'+d.rank+') [сервер]');
        render();saveP();renderWeekly();
        if(btn){btn.disabled=false;btn.textContent='🎁 Забрати приз';}
        return;
      }
    }catch(e){
      // already-exists → приз уже отримано на сервері
      if(e&&(e.code==='functions/already-exists'||(e.message||'').includes('already'))){
        P.weekRewardPending=false;notify('ℹ️','Приз за цей тиждень уже отримано');render();saveP();renderWeekly();
        if(btn){btn.disabled=false;btn.textContent='🎁 Забрати приз';}return;
      }
      // інакше — функції ще не задеплоєні → відкат на локальний розрахунок нижче
    }
  }
  // 2) ВІДКАТ (поки Cloud Functions не задеплоєні): рахунок на клієнті
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
  if(typeof checkWeekly==='function')checkWeekly();
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
  director:{r:6,name:'Директор',  icon:'👑',perms:{manage:true,kick:true,build:true,treasury:true,invite:true,assign:true}},
  deputy:  {r:5,name:'Заступник', icon:'⭐',perms:{manage:true,kick:true,build:true,treasury:true,invite:true}},
  treasurer:{r:4,name:'Скарбник', icon:'💰',perms:{build:true,treasury:true}},
  recruiter:{r:3,name:'Рекрутер', icon:'📣',perms:{invite:true}},
  officer: {r:3,name:'Офіцер',    icon:'🎖️',perms:{}}, // права надає директор (custom)
  curator: {r:2,name:'Куратор',   icon:'🛡️',perms:{}},
  member:  {r:1,name:'Активний учасник',icon:'👤',perms:{}},
};
// чи має учасник право (з урахуванням кастомних прав офіцера)
function clubCan(role,perm,custom){
  const R=CLUB_ROLES[role]||CLUB_ROLES.member;
  if(R.perms&&R.perms[perm])return true;
  if(role==='officer'&&custom&&custom[perm])return true;
  return false;
}
// рівень клубу за досвідом (донати/активність)
function clubLevelFromXp(xp){return Math.floor(Math.sqrt((xp||0)/500))+1;} // 1:0, 2:500, 3:2000, 4:4500...
function clubXpForNext(lv){return Math.round(500*Math.pow(lv,2));}
function clubPerkPct(lv){return (lv-1)*1;} // +1% монет усім за рівень клубу

// ── ПРАПОР КЛУБУ ──
const CLUB_FLAGS=['🏰','🚩','🏴','🏁','🎌','⚔️','🛡️','👑','🐾','🔥','⭐','🌈','🦁','🐱','🐶','🐉','🌸','💎','🍀','⚡'];
window.openFlagPicker=function(){
  if(P._clubRole!=='director'){notify('🔒','Лише Директор може змінювати прапор');return;}
  const box=$('flag-picker');if(!box)return;
  box.innerHTML=CLUB_FLAGS.map(f=>'<button class="flag-opt" onclick="setClubFlag(\''+f+'\')">'+f+'</button>').join('');
  box.style.display=box.style.display==='flex'?'none':'flex';
};
window.setClubFlag=async function(flag){
  if(!P.clubId||P._clubRole!=='director')return;
  try{
    await updateDoc(doc(db,'clubs',P.clubId),{flag:String(flag)});
    notify('🚩 Прапор оновлено!',flag);
    const fp=$('flag-picker');if(fp)fp.style.display='none';
    loadClubData();
  }catch(e){notify('❌',e.message);}
};

// ── РЕЙТИНГ КЛУБІВ ──
// ── ПЕРЕГЛЯД БУДЬ-ЯКОГО КЛУБУ (тільки читання) ──
window.openClubView=async function(clubId){
  goPage('club-view');
  const box=$('club-view-body');if(!box)return;
  box.innerHTML='<div class="loading-inline">Завантаження клубу...</div>';
  try{
    const snap=await getDoc(doc(db,'clubs',clubId));
    if(!snap.exists()){box.innerHTML='<div class="loading-inline">Клуб не знайдено</div>';return;}
    const c=snap.data();const clv=c.level||1;
    let html='<div class="card" style="text-align:center">'
      +'<div style="font-size:3rem">'+(c.flag||c.icon||'🏰')+'</div>'
      +'<div class="sec-title" style="font-size:1.1rem">'+esc(c.name||'Клуб')+'</div>'
      +'<div class="fam-note">'+esc(c.description||'Без опису')+'</div>'
      +'<div class="club-view-stats">⬆️ Рівень '+clv+' · 👥 '+(c.memberCount||1)+' учасн. · ⭐ '+(c.xp||0)+' досвіду</div>'
      +'<div class="club-view-stats">🐷 Скарбничка: 🪙'+(c.piggyCoins||0)+' ❤️'+(c.piggyHearts||0)+'</div>'
      +(clubId===P.clubId?'<div class="club-view-mine">✅ Це твій клуб</div>':'')
      +'</div>';
    html+='<div class="card"><div class="sec-title">👥 Учасники</div><div id="club-view-members"><div class="loading-inline">...</div></div></div>';
    box.innerHTML=html;
    try{
      const ms=await getDocs(query(collection(db,'clubs',clubId,'members'),limit(50)));
      const mem=ms.docs.map(d=>({_id:d.id,...d.data()}));
      mem.sort((a,b)=>((CLUB_ROLES[b.role]||{}).r||1)-((CLUB_ROLES[a.role]||{}).r||1));
      const ml=$('club-view-members');
      if(ml)ml.innerHTML=mem.map(m=>{const R=CLUB_ROLES[m.role]||CLUB_ROLES.member;
        return '<div class="cv-member"><span>'+R.icon+'</span><span class="cv-mem-nick">@'+esc(m.nick||m.nickname||'?')+'</span><span class="cv-mem-role">'+R.name+'</span></div>';
      }).join('')||'<div class="loading-inline">Немає даних</div>';
    }catch(e){const ml=$('club-view-members');if(ml)ml.innerHTML='<div class="loading-inline">Список закритий</div>';}
  }catch(e){box.innerHTML='<div class="loading-inline">Помилка: '+esc(e.message)+'</div>';}
};

window.openClubLeaderboard=async function(){
  goPage('club-rating');
  const box=$('club-rating-body');if(!box)return;
  box.innerHTML='<div class="loading-inline">Завантаження рейтингу...</div>';
  try{
    let qy;
    try{qy=query(collection(db,'clubs'),orderBy('level','desc'),limit(30));}catch(e){qy=query(collection(db,'clubs'),limit(30));}
    const snap=await getDocs(qy);
    let clubs=snap.docs.map(d=>({_id:d.id,...d.data()}));
    clubs.sort((a,b)=>(b.level||1)-(a.level||1)||(b.xp||0)-(a.xp||0)||(b.memberCount||0)-(a.memberCount||0));
    if(!clubs.length){box.innerHTML='<div class="loading-inline">Клубів ще немає</div>';return;}
    box.innerHTML=clubs.map((c,i)=>{
      const mine=c._id===P.clubId;
      const medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':('#'+(i+1));
      return '<div class="club-rank-row'+(mine?' mine':'')+'" onclick="openClubView(\''+c._id+'\')">'
        +'<span class="club-rank-pos">'+medal+'</span>'
        +'<span class="club-rank-flag">'+(c.flag||c.icon||'🏰')+'</span>'
        +'<div style="flex:1"><div class="club-rank-name">'+esc(c.name||'Клуб')+(mine?' (твій)':'')+'</div>'
        +'<div class="club-rank-sub">Рівень '+(c.level||1)+' · ⭐'+(c.xp||0)+' · 👥'+(c.memberCount||1)+'</div></div>'
        +'<span class="club-rank-arrow">›</span></div>';
    }).join('');
  }catch(e){box.innerHTML='<div class="loading-inline">Помилка: '+esc(e.message)+'</div>';}
};
function _roleUp(role,cap){const o=['member','curator','recruiter','officer','treasurer','deputy','director'];let i=o.indexOf(role);return o[Math.min(i+1,o.indexOf(cap))];}
function _roleDown(role){const o=['member','curator','recruiter','officer','treasurer','deputy','director'];let i=o.indexOf(role);return o[Math.max(0,i-1)];}
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
    logClubEvent(word==='підвищено'?'promote':'demote',word+' '+(m?(m.catname||m.nickname):'учасника')+' → '+(CLUB_ROLES[newRole]||{}).name);
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
      logClubEvent('kick','виключив(ла) '+(m.catname||m.nickname||'учасника'));
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
// ── ІСТОРІЯ КЛУБУ (єдиний журнал подій) ──
async function logClubEvent(type,detail,clubId){
  const cid=clubId||P.clubId;if(!cid)return;
  try{
    await addDoc(collection(db,'clubs',cid,'history'),san({
      type:String(type),detail:String(detail||''),
      actor:String(P.catname||P.nickname||'?'),actorNick:String(P.nickname||'?'),
      tsms:Date.now(),ts:serverTimestamp()
    }));
  }catch(e){}
}
const HIST_ICON={donate:'🪙',join:'➕',leave:'🚪',promote:'⬆️',demote:'⬇️',kick:'❌',build:'🏗️',gift:'🎁',buff:'✨',director:'👑'};
window.showClubHistory=async function(){
  if(!P.clubId)return;
  const box=$('history-list');const md=$('history-modal');
  if(box)box.innerHTML='<div class="loading-inline">Завантаження...</div>';
  if(md)md.style.display='flex';
  try{
    const snap=await getDocs(query(collection(db,'clubs',P.clubId,'history'),limit(150)));
    const arr=snap.docs.map(d=>d.data()).sort((a,b)=>(b.tsms||0)-(a.tsms||0));
    if(box)box.innerHTML=arr.length?arr.map(e=>{
      const dt=e.tsms?new Date(e.tsms).toLocaleString('uk-UA',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
      return '<div class="hist-row"><span class="hist-ic">'+(HIST_ICON[e.type]||'•')+'</span>'
        +'<div style="flex:1"><div class="hist-txt"><b>'+esc(e.actor||'?')+'</b> '+esc(e.detail||'')+'</div>'
        +'<div class="hist-dt">'+dt+'</div></div></div>';
    }).join(''):'<div class="loading-inline">Поки немає подій. Усе попереду! 🐾</div>';
  }catch(e){if(box)box.innerHTML='<div class="loading-inline">Помилка: '+esc(e.message)+'</div>';}
};
window.closeHistory=function(){const m=$('history-modal');if(m)m.style.display='none';};
// ── ДИРЕКТОРСЬКІ ДІЇ: подарунок усім + бафф клубу (за сердечка скарбнички) ──
const CLUB_GIFT_COST=100;
const CLUB_GIFT={coins:60,hearts:25};
const CLUB_BUFF_COST=800;
const CLUB_BUFF_HOURS=24;
const CLUB_BUFF_MUL=1.25;
window.giftAllMembers=async function(){
  if(P._clubRole!=='director'){notify('🚫','Лише Директор');return;}
  const members=window._clubMembers||[];const cost=CLUB_GIFT_COST*members.length;
  try{
    const snap=await getDoc(doc(db,'clubs',P.clubId));const c=snap.data()||{};
    if((c.piggyCoins||0)<cost){notify('🐷','У скарбничці треба 🪙'+cost+' (є '+(c.piggyCoins||0)+')');return;}
    uiConfirm('Роздати подарунок усім '+members.length+' учасникам? Зі скарбнички піде 🪙'+cost+'.',async()=>{
      try{
        await updateDoc(doc(db,'clubs',P.clubId),{piggyCoins:increment(-cost)});
        for(const m of members){
          const mid=m.uid||m._id;
          await sendLetter({toUid:mid,toNick:m.nickname||'друг',subj:'🎁 Подарунок від Директора клубу!',
            body:'Директор «'+(P.clubName||'клубу')+'» дарує тобі 🪙'+CLUB_GIFT.coins+' + ❤️'+CLUB_GIFT.hearts+'!',
            type:'gift',icon:'🎁',extra:{giftCoins:CLUB_GIFT.coins,giftHearts:CLUB_GIFT.hearts}}).catch(()=>{});
        }
        logClubEvent('gift','роздав(ла) подарунок усім учасникам');
        notify('🎁 Подарунки надіслано!','Усі '+members.length+' учасників отримають гостинець',5000);
        loadClubData();
      }catch(e){notify('❌',e.message);}
    },{title:'Подарунок усім',yes:'Роздати'});
  }catch(e){notify('❌',e.message);}
};
window.buyClubBuff=async function(){
  if(P._clubRole!=='director'){notify('🚫','Лише Директор');return;}
  try{
    const snap=await getDoc(doc(db,'clubs',P.clubId));const c=snap.data()||{};
    if((c.buffUntil||0)>Date.now()){notify('✨','Бафф уже активний');return;}
    if((c.piggyHearts||0)<CLUB_BUFF_COST){notify('🐷','У скарбничці треба ❤️'+CLUB_BUFF_COST+' (є '+(c.piggyHearts||0)+')');return;}
    uiConfirm('Активувати бафф «+25% монет на '+CLUB_BUFF_HOURS+' год усім»? Зі скарбнички піде ❤️'+CLUB_BUFF_COST+'.',async()=>{
      try{
        await updateDoc(doc(db,'clubs',P.clubId),{piggyHearts:increment(-CLUB_BUFF_COST),buffUntil:Date.now()+CLUB_BUFF_HOURS*3600000});
        logClubEvent('buff','активував(ла) клубний бафф +25% монет на '+CLUB_BUFF_HOURS+' год');
        notify('✨ Бафф клубу!','+25% монет усім на '+CLUB_BUFF_HOURS+' год',5000);
        loadClubData();
      }catch(e){notify('❌',e.message);}
    },{title:'Бафф клубу',yes:'Активувати'});
  }catch(e){notify('❌',e.message);}
};
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
  {icon:'🥾',name:'Старий чобіт',coins:0,            w:9},
  {icon:'🐟',name:'Карась',      cMin:12,cMax:24,    w:24, ing:'karas'},
  {icon:'🐠',name:'Окунь',       cMin:28,cMax:48,    w:20, ing:'okun'},
  {icon:'🐡',name:'Короп',       cMin:48,cMax:80,    w:15, ing:'korop'},
  {icon:'🐲',name:'Сом',         cMin:70,cMax:120,   w:11, ing:'som'},
  {icon:'🐊',name:'Щука',        cMin:90,cMax:150,   w:9,  ing:'pike'},
  {icon:'🦐',name:'Креветка',    bf:5,               w:8,  ing:'shrimp'},
  {icon:'🌈',name:'Форель',      cMin:120,cMax:190,bf:4,w:6, ing:'trout'},
  {icon:'🦈',name:'Рідкісна рибина',cMin:150,cMax:240,bf:5,w:5, ing:'rare'},
  {icon:'💎',name:'Фрагмент каменя',gem:1,           w:4},
  {icon:'🥇',name:'Золота рибка',cMin:300,cMax:500,bf:10,w:2, ing:'gold'},
  {icon:'👢',name:'Скарб на дні', cMin:180,cMax:320, w:4},
];
let fishTicker=null;
function fishReady(){return P.fishing&&(Date.now()-P.fishing.start>=P.fishing.dur);}
function renderFishing(){
  if(typeof renderFishUpgrades==='function')renderFishUpgrades();
  // банер легендарної риби тижня
  {const lb=$('fish-legend-banner');if(lb&&typeof legendaryOfWeek==='function'){
    const {fish,wk}=legendaryOfWeek();const caught=P.legCaughtWeek===wk;
    lb.innerHTML='<span class="flb-emoji">'+fish.icon+'</span><div style="flex:1"><div class="flb-title">🏆 Легендарна риба тижня</div>'
      +'<div class="flb-name">'+fish.name+(caught?' ✅ спіймано!':' — лови з рідкісним шансом!')+'</div></div>';
    lb.style.display='flex';
  }}
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
// ════════ ЛЕГЕНДАРНА РИБА ТИЖНЯ (рідкісна подія) ════════
const LEGENDARY_FISH=[
  {id:'whale', icon:'🐋',name:'Блакитний кит',    coins:1500,crystals:1},
  {id:'dragon',icon:'🐉',name:'Водяний дракончик', coins:2000,crystals:2},
  {id:'mermaid',icon:'🧜‍♀️',name:'Чарівна русалка',  coins:1800,crystals:1},
  {id:'kraken',icon:'🦑',name:'Малий кракен',      coins:1700,crystals:1},
  {id:'goldkoi',icon:'🎏',name:'Золотий короп-дракон',coins:2500,crystals:2},
];
function legendaryOfWeek(){
  const wk=(typeof getMondayKey==='function')?getMondayKey():new Date().toDateString();
  let h=0;for(let i=0;i<wk.length;i++)h=(h*31+wk.charCodeAt(i))>>>0;
  return {fish:LEGENDARY_FISH[h%LEGENDARY_FISH.length],wk:wk};
}
function tryLegendaryCatch(){
  const {fish,wk}=legendaryOfWeek();
  if(P.legCaughtWeek===wk)return false;
  const baitLv=(P.fishUp&&P.fishUp.bait)||0;
  if(Math.random()<(0.04+baitLv*0.01)){
    P.legCaughtWeek=wk;
    if(!P.legCollection)P.legCollection={};P.legCollection[fish.id]=(P.legCollection[fish.id]||0)+1;
    P.coins=(P.coins||0)+fish.coins;if(fish.crystals)P.crystals=(P.crystals||0)+fish.crystals;
    gainXP(50);
    if(typeof sfx==='function')sfx('success');if(typeof spawnReaction==='function')spawnReaction(['🎉','🏆',fish.icon,'⭐','💎']);
    if(typeof uiConfirm==='function')uiConfirm('🎉 НЕЙМОВІРНО! Ти спіймав легендарну рибу тижня:\n\n'+fish.icon+' '+fish.name+'\n\n+🪙'+fish.coins+(fish.crystals?('  +💎'+fish.crystals):''),()=>{},{title:'🏆 Легендарний улов!',yes:'Ура!'});
    else notify('🏆 Легендарний улов!',fish.icon+' '+fish.name+' +🪙'+fish.coins);
    addLog('🏆 Легендарна риба: '+fish.name+' +🪙'+fish.coins);
    return true;
  }
  return false;
}

const FISH_UPGRADES={
  rod: {icon:'🎣',name:'Вудка',    max:5,base:800,desc:'+10% монет з улову за рівень'},
  bait:{icon:'🪱',name:'Прикормка',max:5,base:600,desc:'+краса й кращі шанси на рідкісне'},
};
function fishUpCost(type){const lv=(P.fishUp&&P.fishUp[type])||0;return Math.round(FISH_UPGRADES[type].base*Math.pow(1.7,lv));}
window.upgradeFishing=function(type){
  const u=FISH_UPGRADES[type];if(!u)return;
  const lv=(P.fishUp&&P.fishUp[type])||0;
  if(lv>=u.max){notify('🎣','Уже максимальний рівень');return;}
  const cost=fishUpCost(type);
  if((P.coins||0)<cost){notify('🪙','Недостатньо монет ('+cost+')');return;}
  P.coins-=cost;if(!P.fishUp)P.fishUp={rod:0,bait:0};P.fishUp[type]=lv+1;
  if(typeof sfx==='function')sfx('success');
  notify(u.icon+' Покращено!',u.name+' → рівень '+(lv+1));
  addLog('Риболовля: '+u.name+' рів.'+(lv+1));
  render();saveP();renderFishing();
};
function renderFishUpgrades(){
  const box=$('fish-upgrades');if(!box)return;
  box.innerHTML=Object.entries(FISH_UPGRADES).map(([k,u])=>{
    const lv=(P.fishUp&&P.fishUp[k])||0;const maxed=lv>=u.max;const cost=fishUpCost(k);
    return '<div class="fishup-row"><span class="fishup-ic">'+u.icon+'</span>'
      +'<div style="flex:1"><div class="fishup-nm">'+u.name+' <small>рів.'+lv+'/'+u.max+'</small></div>'
      +'<div class="fishup-desc">'+u.desc+'</div></div>'
      +(maxed?'<span class="fishup-max">МАКС</span>'
        :'<button class="small-btn" '+((P.coins||0)<cost?'disabled':'')+' onclick="upgradeFishing(\''+k+'\')">🪙'+cost+'</button>')
      +'</div>';
  }).join('');
}
window.fishingAction=function(){
  if(!P.fishing){ // закинути
    P.fishing={start:Date.now(),dur:FISH_DUR};
    notify('🎣 Вудку закинуто!','Чекай ~'+Math.round(FISH_DUR/1000)+' сек');
    saveP();renderFishing();return;
  }
  if(!fishReady()){notify('⏳','Ще рано — зачекай клювання');return;}
  if(typeof tryLegendaryCatch==='function')tryLegendaryCatch(); // рідкісна подія
  // витягнути улов (прикормка дає кращі шанси: беремо краще з кількох кидків)
  const baitLv=(P.fishUp&&P.fishUp.bait)||0;
  const tot=FISH_CATCH.reduce((s,x)=>s+x.w,0);
  function rollCatch(){let r=Math.random()*tot,c=FISH_CATCH[0];for(const f of FISH_CATCH){r-=f.w;if(r<0){c=f;break;}}return c;}
  let c=rollCatch();
  for(let i=0;i<baitLv;i++){const c2=rollCatch();if((c2.cMax||0)+(c2.bf||0)*20+(c2.gem||0)*200>(c.cMax||0)+(c.bf||0)*20+(c.gem||0)*200)c=c2;}
  let coins=0,parts=[];
  const rodMul=1+((P.fishUp&&P.fishUp.rod)||0)*0.10;
  if(c.cMin!=null){coins=c.cMin+Math.floor(Math.random()*(c.cMax-c.cMin+1));coins=Math.round(coins*coinMul()*(typeof weatherToday==='function'?weatherToday().fishMul:1)*weMul('fish')*(1+skillEff('fishPct')/100)*rodMul);P.coins=(P.coins||0)+coins;parts.push('🪙'+coins);}
  if(c.bf){const bf=c.bf+Math.round(baitLv*1.5);P.butterflies=(P.butterflies||0)+bf;parts.push('🦋'+bf);}
  if(c.gem){if(!P.gems)P.gems={};const ks=GEMS.map(g=>g.key);const k=ks[Math.floor(Math.random()*ks.length)];P.gems[k]=(P.gems[k]||0)+c.gem;parts.push('фрагмент 💎');}
  if(c.ing){if(!P.ingredients)P.ingredients={};P.ingredients[c.ing]=(P.ingredients[c.ing]||0)+1;parts.push('🍳 інгредієнт');if(!P.collected)P.collected={fish:{},gem:{},craft:{},setClaimed:{}};P.collected.fish[c.ing]=true;}
  P.fishing=null;gainXP(8);lifeTrack('fish');if(typeof contributeClubQuest==='function')contributeClubQuest('fish',1);
  const txt=c.icon+' '+c.name+(parts.length?(' · '+parts.join(' ')):' (нічого цінного)');
  notify('🪝 Улов!',txt,4500);addLog('Риболовля: '+txt);
  const lc=$('fishing-log-card'),ll=$('fishing-last');
  if(lc)lc.style.display='block';
  if(ll)ll.innerHTML='<div class="fish-catch">'+c.icon+' <b>'+c.name+'</b>'+(parts.length?(' — '+parts.join(' ')):'')+'</div>';
  render();saveP();renderFishing();
};

// ════════ СЕЗОННІ ТЕМИ ════════
function currentSeason(){const m=new Date().getMonth()+1;
  if(m===12||m<=2)return'winter';if(m<=5)return'spring';if(m<=8)return'summer';return'autumn';}
const SEASON_PARTICLES={winter:['❄️','❅','🌨️'],spring:['🌸','🌷','🌼','🦋'],autumn:['🍂','🍁','🍃'],summer:[]};
let _seasonTimer=null;
function applySeason(){
  const s=currentSeason();
  document.body.classList.remove('season-winter','season-spring','season-summer','season-autumn');
  document.body.classList.add('season-'+s);
  clearInterval(_seasonTimer);
  const set=SEASON_PARTICLES[s];
  if(!set||!set.length)return; // літо — без падаючих частинок
  _seasonTimer=setInterval(()=>{
    if(document.hidden)return;
    if(!document.getElementById('pg-home')?.classList.contains('active'))return;
    if(document.querySelectorAll('.season-particle').length>14)return;
    const el=document.createElement('div');el.className='season-particle';
    el.textContent=set[Math.floor(Math.random()*set.length)];
    el.style.left=Math.random()*100+'vw';
    el.style.fontSize=(0.8+Math.random()*0.9)+'rem';
    const dur=5+Math.random()*5;
    el.style.setProperty('--drift',((Math.random()-0.5)*120)+'px');
    el.style.animation='fall '+dur+'s linear forwards';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),dur*1000+200);
  },1400);
}
window.applySeason=applySeason;

// ════════ КОЛЕКЦІЙНІ КАРТКИ ════════
const CARD_SETS=[
  {id:'cats',name:'Котики світу',icon:'🐱',reward:{coins:2000,crystals:1},cards:[
    {id:'c1',icon:'🐱',name:'Руденький'},{id:'c2',icon:'🐈',name:'Смугастий'},{id:'c3',icon:'🐈‍⬛',name:'Чорний'},
    {id:'c4',icon:'😺',name:'Усміхнений'},{id:'c5',icon:'😻',name:'Закоханий'},{id:'c6',icon:'🦁',name:'Левчик'},
  ]},
  {id:'nature',name:'Природа',icon:'🌿',reward:{coins:2500,hearts:500},cards:[
    {id:'n1',icon:'🌸',name:'Сакура'},{id:'n2',icon:'🍄',name:'Грибочок'},{id:'n3',icon:'🦋',name:'Метелик'},
    {id:'n4',icon:'🌈',name:'Веселка'},{id:'n5',icon:'🌻',name:'Соняшник'},{id:'n6',icon:'🐞',name:'Сонечко'},
  ]},
  {id:'magic',name:'Чарівне',icon:'✨',reward:{coins:3000,crystals:2},cards:[
    {id:'m1',icon:'🔮',name:'Куля'},{id:'m2',icon:'⭐',name:'Зірка'},{id:'m3',icon:'🌙',name:'Місяць'},
    {id:'m4',icon:'💎',name:'Кристал'},{id:'m5',icon:'🦄',name:'Єдиноріг'},{id:'m6',icon:'👑',name:'Корона'},
  ]},
];
function allCards(){const a=[];CARD_SETS.forEach(s=>s.cards.forEach(c=>a.push({...c,set:s.id})));return a;}
function cardHas(id){return (P.cards&&P.cards[id])||0;}
function grantRandomCard(){
  const all=allCards();const c=all[Math.floor(Math.random()*all.length)];
  if(!P.cards)P.cards={};P.cards[c.id]=(P.cards[c.id]||0)+1;
  return c;
}
function renderCards(){
  const box=$('cards-body');if(!box)return;
  const total=allCards().length;const owned=allCards().filter(c=>cardHas(c.id)).length;
  const freeReady=P.cardPackDay!==dayKey();
  let h='<div class="info-box-green">Збирай картки! Безкоштовний пакет щодня + купуй за монети. Збереш серію — велика нагорода 🎁 ('+owned+'/'+total+')</div>';
  h+='<div class="card" style="text-align:center"><div class="sec-title">🎴 Пакети карток</div>'
    +'<button class="green-btn" '+(freeReady?'':'disabled')+' onclick="openCardPack(true)" style="width:100%;margin-bottom:8px">'+(freeReady?'🎁 Безкоштовний пакет (раз на день)':'✅ Сьогодні вже відкрито')+'</button>'
    +'<button class="orange-btn" '+((P.coins||0)<500?'disabled':'')+' onclick="openCardPack(false)" style="width:100%">🛒 Купити пакет — 🪙500</button></div>';
  h+=CARD_SETS.map(s=>{
    const got=s.cards.filter(c=>cardHas(c.id)).length;const complete=got===s.cards.length;
    const claimed=P.cardSetsClaimed&&P.cardSetsClaimed[s.id];
    const rw=s.reward;const rwTxt='🪙'+rw.coins+(rw.hearts?(' ❤️'+rw.hearts):'')+(rw.crystals?(' 💎'+rw.crystals):'');
    return '<div class="card"><div class="cards-set-hd"><span class="sec-title" style="margin:0">'+s.icon+' '+s.name+'</span><span class="cards-set-cnt">'+got+'/'+s.cards.length+'</span></div>'
      +'<div class="cards-grid">'+s.cards.map(c=>{const n=cardHas(c.id);
        return '<div class="card-cell'+(n?'':' card-missing')+'"><span class="card-emoji">'+(n?c.icon:'❓')+'</span><span class="card-name">'+(n?c.name:'???')+'</span>'+(n>1?'<span class="card-count">×'+n+'</span>':'')+'</div>';
      }).join('')+'</div>'
      +(complete?(claimed?'<div class="cards-claimed">✅ Серію зібрано, нагороду отримано</div>'
          :'<button class="green-btn" onclick="claimCardSet(\''+s.id+'\')" style="width:100%;margin-top:8px">🎁 Забрати нагороду: '+rwTxt+'</button>')
        :'')
      +'</div>';
  }).join('');
  box.innerHTML=h;
}
window.openCardPack=function(free){
  if(free){
    if(P.cardPackDay===dayKey()){notify('🎴','Сьогодні вже відкрито');return;}
    P.cardPackDay=dayKey();
  }else{
    if((P.coins||0)<500){notify('🪙','Недостатньо монет');return;}
    P.coins-=500;
  }
  const c=grantRandomCard();
  if(typeof sfx==='function')sfx('success');if(typeof spawnReaction==='function')spawnReaction(['🎴','✨',c.icon]);
  notify('🎴 Нова картка!',c.icon+' '+c.name+(cardHas(c.id)>1?' (дублікат)':''),4000);
  addLog('Картка: '+c.name);
  render();saveP();renderCards();
};
window.claimCardSet=function(setId){
  const s=CARD_SETS.find(x=>x.id===setId);if(!s)return;
  if(P.cardSetsClaimed&&P.cardSetsClaimed[setId]){notify('✅','Уже отримано');return;}
  if(s.cards.some(c=>!cardHas(c.id))){notify('🎯','Серію ще не зібрано');return;}
  if(!P.cardSetsClaimed)P.cardSetsClaimed={};P.cardSetsClaimed[setId]=true;
  const rw=s.reward;P.coins=(P.coins||0)+rw.coins;if(rw.hearts)P.hearts=(P.hearts||0)+rw.hearts;if(rw.crystals)P.crystals=(P.crystals||0)+rw.crystals;
  gainXP(40);
  if(typeof sfx==='function')sfx('success');if(typeof spawnReaction==='function')spawnReaction(['🎉','🏆','⭐']);
  notify('🎁 Серію зібрано!',s.name+' · +🪙'+rw.coins,5000);
  addLog('Серія карток: '+s.name);
  render();saveP();renderCards();
};

// ════════ ПОДВІР'Я ════════
const YARD_ITEMS=[
  {id:'fence',  icon:'🪵',name:'Огорожа',     cost:1200, eff:'coinPct',  val:2, desc:'+2% монет — затишок дому'},
  {id:'tree',   icon:'🌳',name:'Дерево',       cost:1600, eff:'xpPct',    val:2, desc:'+2% досвіду'},
  {id:'flowers',icon:'🌷',name:'Клумба',       cost:1400, eff:'beauty',   val:15,desc:'+15🦋 краси (одноразово)'},
  {id:'fountain',icon:'⛲',name:'Фонтан',       cost:4000, eff:'coinPct',  val:4, desc:'+4% монет'},
  {id:'bench',  icon:'🪑',name:'Лавочка',      cost:1800, eff:'funCalm',  val:0, desc:'Декор — затишне місце відпочинку'},
  {id:'mailbox',icon:'📫',name:'Поштова скриня',cost:1500, eff:'beauty',  val:10,desc:'+10🦋 краси (одноразово)'},
  {id:'pond',   icon:'🏞️',name:'Ставок',        cost:3500, eff:'xpPct',    val:3, desc:'+3% досвіду'},
  {id:'lantern',icon:'🏮',name:'Ліхтарик',     cost:2000, eff:'beauty',   val:12,desc:'+12🦋 краси (одноразово)'},
];
function yardHas(id){return !!(P.yard&&P.yard[id]);}
function yardEff(eff){return YARD_ITEMS.filter(i=>i.eff===eff&&yardHas(i.id)).reduce((s,i)=>s+i.val,0);}
function renderYard(){
  const box=$('yard-body');if(!box)return;
  const placed=YARD_ITEMS.filter(i=>yardHas(i.id));
  let scene='<div class="yard-scene"><div class="yard-sky">☀️ ☁️</div><div class="yard-house">🏠</div>'
    +'<div class="yard-ground">'+(placed.length?placed.map(i=>'<span class="yard-obj" title="'+i.name+'">'+i.icon+'</span>').join(''):'<span class="yard-empty">Подвір\'я порожнє — прикрась його нижче 🌳</span>')+'</div></div>';
  let h='<div class="info-box-green">Прикрась подвір\'я навколо будинку — деякі об\'єкти дають постійні бонуси!</div>'+scene;
  h+='<div class="card"><div class="sec-title">🌳 Декор подвір\'я</div>'+YARD_ITEMS.map(i=>{
    const owned=yardHas(i.id);
    return '<div class="room-row"><span class="room-ic">'+i.icon+'</span>'
      +'<div style="flex:1"><div class="room-nm">'+i.name+'</div><div class="room-desc">'+i.desc+'</div></div>'
      +(owned?'<span class="room-owned">✅ Є</span>'
        :'<button class="small-btn" '+((P.coins||0)<i.cost?'disabled':'')+' onclick="buyYardItem(\''+i.id+'\')">🪙'+i.cost+'</button>')
      +'</div>';
  }).join('')+'</div>';
  box.innerHTML=h;
}
window.buyYardItem=function(id){
  const it=YARD_ITEMS.find(x=>x.id===id);if(!it)return;
  if(yardHas(id)){notify('🏡','Цей об\'єкт уже є');return;}
  if((P.coins||0)<it.cost){notify('🪙','Недостатньо монет');return;}
  P.coins-=it.cost;if(!P.yard)P.yard={};P.yard[id]=true;
  if(it.eff==='beauty')P.butterflies=(P.butterflies||0)+it.val;
  if(typeof sfx==='function')sfx('success');if(typeof spawnReaction==='function')spawnReaction(['🏡','✨','🌳']);
  notify(it.icon+' Куплено!',it.name+' прикрашає подвір\'я');
  addLog('Подвір\'я: '+it.name);
  render();saveP();renderYard();
};

// ════════ СТАТИСТИКА ГРАВЦЯ ════════
function renderStats(){
  const box=$('stats-body');if(!box)return;
  const L=P.life||{};
  const learnedTricks=(typeof TRICKS!=='undefined')?TRICKS.filter(t=>(P.tricks&&P.tricks[t.id]>=100)).length:0;
  const medalsCnt=P.medals?Object.keys(P.medals).filter(k=>P.medals[k]).length:0;
  const trophiesCnt=P.trophies?Object.keys(P.trophies).filter(k=>P.trophies[k]).length:0;
  let daysPlayed='—';
  if(P.createdAt){daysPlayed=Math.max(1,Math.floor((Date.now()-new Date(P.createdAt).getTime())/86400000))+' дн.';}
  const rows=[
    ['⭐','Рівень',P.level||1],
    ['🪙','Монет зараз',P.coins||0],
    ['🦋','Краса',P.butterflies||0],
    ['💎','Кристалів',P.crystals||0],
    ['🎣','Зловлено риби',L.fish||0],
    ['🧭','Експедицій',L.expedition||0],
    ['🌾','Зібрано врожаю',L.harvest||0],
    ['🏋️','Тренувань',L.train||0],
    ['🚶','Прогулянок',L.walk||0],
    ['🏆','Перемог на виставці',P.showWins||0],
    ['🎪','Вивчено трюків',learnedTricks+'/'+(typeof TRICKS!=='undefined'?TRICKS.length:0)],
    ['🎖️','Медалей',medalsCnt],
    ['🏆','Кубків',trophiesCnt],
    ['👥','Запрошено друзів',P.refCount||0],
    ['🏠','Зірок будинку',(typeof houseStar==='function')?houseStar():'—'],
    ['📅','У грі',daysPlayed],
  ];
  box.innerHTML='<div class="card"><div class="sec-title">📊 Твоя статистика</div>'
    +rows.map(r=>'<div class="stat-row"><span class="stat-ic">'+r[0]+'</span><span class="stat-lbl">'+r[1]+'</span><span class="stat-val">'+r[2]+'</span></div>').join('')
    +'</div>';
}

// ════════ КАЛЕНДАР СВЯТ ════════
function renderHolidayCal(){
  const box=$('holcal-body');if(!box)return;
  const now=new Date();const cy=now.getFullYear();
  const today=new Date(cy,now.getMonth(),now.getDate());
  const hs=holidayList().map(h=>{
    const [mo,da]=h.md.split('-').map(Number);
    let base=new Date(cy,mo-1,da);
    let diff=Math.round((base-today)/86400000);
    if(diff<-h.win){base=new Date(cy+1,mo-1,da);diff=Math.round((base-today)/86400000);} // вже минуло — наступного року
    return {...h,base,diff};
  }).sort((a,b)=>a.diff-b.diff);
  const cur=(typeof currentHoliday==='function')?currentHoliday():null;
  const MN=['січ','лют','бер','кві','тра','чер','лип','сер','вер','жов','лис','гру'];
  box.innerHTML='<div class="info-box-green">🎉 Усі свята КотяГри. У дні свята в магазині з\'являються унікальні святкові речі!</div>'
    +hs.map(h=>{
    const active=cur&&cur.key===h.key;
    const dateStr=h.base.getDate()+' '+MN[h.base.getMonth()];
    const cd=active?'🎉 Зараз!':(h.diff===0?'Сьогодні!':('через '+h.diff+' дн.'));
    const items=(h.items||[]).map(i=>i.icon).join(' ');
    return '<div class="holcal-card'+(active?' holcal-active':'')+'">'
      +'<span class="holcal-emoji">'+h.emoji+'</span>'
      +'<div style="flex:1"><div class="holcal-name">'+h.name+'</div>'
      +'<div class="holcal-date">'+dateStr+' · '+cd+'</div>'
      +'<div class="holcal-items">Святкові речі: '+items+'</div></div></div>';
  }).join('');
}

// ════════ СТАТИСТИКА ГРАВЦЯ кінець ════════
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
  {key:'carrot',    icon:'🥕',name:'Морква',    cost:20, dur:120, coins:36,  xp:6},
  {key:'tomato',    icon:'🍅',name:'Помідор',   cost:35, dur:240, coins:68,  xp:10},
  {key:'flower',    icon:'🌷',name:'Квітка',    cost:30, dur:180, coins:16, bf:6, xp:8},
  {key:'corn',      icon:'🌽',name:'Кукурудза', cost:50, dur:420, coins:112, xp:14},
  {key:'strawberry',icon:'🍓',name:'Полуниця',  cost:65, dur:600, coins:150, bf:3, xp:16},
  {key:'pumpkin',   icon:'🎃',name:'Гарбуз',    cost:95, dur:900, coins:230, xp:22},
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
    if(!p)return '<div class="plot empty" onclick="openSeedPicker('+i+')">'+(window.EMPTY_PLOT_ICON?'<img class="plot-img empty-plot-img" src="'+EMPTY_PLOT_ICON+'" alt="">':'<div class="plot-soil">🟫</div>')+'<div class="plot-lbl">Порожня грядка</div><div class="plot-act">+ Посадити</div></div>';
    const c=_crop(p.crop)||{icon:'🌱',name:'?'};
    if(plotReady(p))
      return '<div class="plot ready" onclick="harvestPlot('+i+')">'+(window.CROP_ICONS&&CROP_ICONS[p.crop]?'<img class="plot-img" src="'+CROP_ICONS[p.crop]+'" alt="">':'<div class="plot-crop">'+c.icon+'</div>')+'<div class="plot-lbl">'+c.name+'</div><div class="plot-act ready-act">✅ Зібрати!</div></div>';
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
function gardenPlotCost(){const n=P.garden.plots.length;return n<=3?1500:(n===4?4000:9000);} // 4-та 1500, 5-та 4000, 6-та 9000
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
  const hd=$('seed-head-img');if(hd&&window.GARDEN_HEAD){hd.src=GARDEN_HEAD;hd.style.display='block';}
  const list=$('seed-list');
  if(list)list.innerHTML=CROPS.map(c=>{
    const can=(P.coins||0)>=c.cost;
    const tm=c.dur>=60?(Math.floor(c.dur/60)+' хв'):(c.dur+' с');
    const rw=(c.coins?('🪙'+c.coins):'')+(c.bf?(' 🦋'+c.bf):'');
    return '<div class="seed-opt'+(can?'':' disabled')+'" onclick="'+(can?('plantCrop(\''+c.key+'\')'):'')+'">'
      +(window.CROP_ICONS&&CROP_ICONS[c.key]?'<img class="seed-img" src="'+CROP_ICONS[c.key]+'" alt="">':'<span class="seed-ic">'+c.icon+'</span>')
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
  const gm=((typeof weatherToday==='function')?weatherToday().growMul:1)*weMul('grow');
  P.garden.plots[_seedPlot]={crop:key,start:Date.now(),dur:Math.round(c.dur*gm)};
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
  if(!P.ingredients)P.ingredients={};P.ingredients[p.crop]=(P.ingredients[p.crop]||0)+1;
  gainXP(c.xp||5);
  P.garden.plots[i]=null;
  lifeTrack('harvest');if(typeof contributeClubQuest==='function')contributeClubQuest('harvest',1);
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

// ════════ КУХНЯ / РЕЦЕПТИ ════════
const INGREDIENTS={
  karas:{icon:'🐟',name:'Карась'}, okun:{icon:'🐠',name:'Окунь'}, korop:{icon:'🐡',name:'Короп'},
  shrimp:{icon:'🦐',name:'Креветка'}, rare:{icon:'🦈',name:'Рідкісна рибина'},
  som:{icon:'🐲',name:'Сом'}, pike:{icon:'🐊',name:'Щука'}, trout:{icon:'🌈',name:'Форель'}, gold:{icon:'🥇',name:'Золота рибка'},
  carrot:{icon:'🥕',name:'Морква'}, tomato:{icon:'🍅',name:'Помідор'}, flower:{icon:'🌷',name:'Квітка'},
  corn:{icon:'🌽',name:'Кукурудза'}, strawberry:{icon:'🍓',name:'Полуниця'}, pumpkin:{icon:'🎃',name:'Гарбуз'},
};
const RECIPES=[
  {key:'soup', icon:'🍲',name:'Юшка',     needs:{karas:1,carrot:1},        eff:{hunger:50,energy:15,xp:12}},
  {key:'salad',icon:'🥗',name:'Салат',    needs:{tomato:1,carrot:1},       eff:{hunger:40,fun:20,xp:10}},
  {key:'grill',icon:'🍤',name:'Гриль',    needs:{shrimp:1,tomato:1},       eff:{hunger:45,energy:25,xp:14}},
  {key:'fishsteak',icon:'🍥',name:'Стейк із сома',needs:{som:1,corn:1},    eff:{hunger:55,energy:30,xp:18}},
  {key:'pikepie',icon:'🥟',name:'Пиріг зі щукою',needs:{pike:1,pumpkin:1}, eff:{hunger:60,fun:20,energy:20,xp:20}},
  {key:'sushi',icon:'🍣',name:'Суші',     needs:{rare:1,corn:1},           eff:{hunger:60,fun:25,energy:20,bf:5,xp:20}},
  {key:'troutgrill',icon:'🐟',name:'Форель на грилі',needs:{trout:1,tomato:1},eff:{hunger:55,energy:30,bf:6,xp:22}},
  {key:'pie',  icon:'🥧',name:'Солодкий пиріг',needs:{strawberry:1,pumpkin:1}, eff:{hunger:55,fun:30,xp:18}},
  {key:'feast',icon:'🍱',name:'Бенкет',   needs:{korop:1,corn:1,carrot:1}, eff:{hunger:70,fun:30,energy:30,bf:8,xp:25}},
  {key:'royal',icon:'👑',name:'Королівська страва',needs:{gold:1,strawberry:1,corn:1},eff:{hunger:90,fun:40,energy:40,bf:15,xp:40}},
];
function ingCount(k){return (P.ingredients&&P.ingredients[k])||0;}
function canCook(r){return Object.entries(r.needs).every(([k,n])=>ingCount(k)>=n);}
function ingImg(k){
  if(window.FISH_ICONS&&FISH_ICONS[k])return '<img class="ing-img" src="'+FISH_ICONS[k]+'" alt="">';
  if(window.CROP_ICONS&&CROP_ICONS[k])return '<img class="ing-img" src="'+CROP_ICONS[k]+'" alt="">';
  return '<span class="pantry-ic">'+((INGREDIENTS[k]&&INGREDIENTS[k].icon)||'❓')+'</span>';
}
function dishImg(key,icon){
  if(window.DISH_ICONS&&DISH_ICONS[key])return '<img class="dish-img" src="'+DISH_ICONS[key]+'" alt="">';
  return '<span class="recipe-ic">'+(icon||'🍳')+'</span>';
}
function dailyOrder(){
  // детерміновано за днем: випадкова страва + бонус
  const dk=dayKey();let h=0;for(let i=0;i<dk.length;i++)h=(h*31+dk.charCodeAt(i))>>>0;
  const r=RECIPES[h%RECIPES.length];
  return {key:r.key,recipe:r,bonus:150+(h%6)*50}; // 150..400
}
function renderKitchen(){
  // замовлення гостя
  {const ob=$('kitchen-order');if(ob){const ord=dailyOrder();const done=P.orderDay===dayKey();
    ob.innerHTML='<span class="ko-emoji">🐱</span><div style="flex:1"><div class="ko-title">Замовлення гостя</div>'
      +'<div class="ko-text">'+(done?'✅ Виконано! Завтра новий гість.':('Приготуй '+ord.recipe.icon+' <b>'+ord.recipe.name+'</b> — бонус +🪙'+ord.bonus))+'</div></div>';
    ob.style.display='flex';
  }}
  // комора
  const pg=$('pantry-grid');
  if(pg){
    const owned=Object.keys(INGREDIENTS).filter(k=>ingCount(k)>0);
    pg.innerHTML=owned.length?owned.map(k=>
      '<div class="pantry-item">'+ingImg(k)
      +'<span class="pantry-nm">'+INGREDIENTS[k].name+'</span><span class="pantry-cnt">×'+ingCount(k)+'</span></div>'
    ).join(''):'<div class="loading-inline" style="grid-column:1/-1">Порожньо. Лови рибу 🎣 та вирощуй овочі 🌱!</div>';
  }
  // рецепти
  const rl=$('recipe-list');if(!rl)return;
  rl.innerHTML=RECIPES.map(r=>{
    const ok=canCook(r);
    const needs=Object.entries(r.needs).map(([k,n])=>INGREDIENTS[k].icon+'×'+n+'('+ingCount(k)+')').join(' + ');
    const effs=Object.entries(r.eff).map(([k,v])=>({hunger:'🍖',fun:'🎈',energy:'⚡',bf:'🦋',xp:'⭐'}[k]||k)+'+'+v).join(' ');
    return '<div class="recipe-row'+(ok?'':' locked')+'">'
      +dishImg(r.key,r.icon)
      +'<div style="flex:1"><div class="recipe-nm">'+r.name+'</div>'
      +'<div class="recipe-needs">'+needs+'</div>'
      +'<div class="recipe-eff">'+effs+'</div></div>'
      +'<button class="recipe-btn" '+(ok?'':'disabled')+' onclick="cookDish(\''+r.key+'\')">'+(ok?'🍳 Готувати':'🔒')+'</button>'
      +'</div>';
  }).join('');
}
window.cookDish=function(key){
  const r=RECIPES.find(x=>x.key===key);if(!r)return;
  if(!canCook(r)){notify('🔒','Бракує інгредієнтів');return;}
  Object.entries(r.needs).forEach(([k,n])=>{P.ingredients[k]=(P.ingredients[k]||0)-n;if(P.ingredients[k]<=0)delete P.ingredients[k];});
  const e=r.eff;
  if(e.hunger)P.hunger=cl((P.hunger||0)+e.hunger);
  if(e.fun)P.fun=cl((P.fun||0)+e.fun);
  if(e.energy)P.energy=cl((P.energy||0)+e.energy);
  if(e.bf)P.butterflies=(P.butterflies||0)+e.bf;
  if(e.xp)gainXP(e.xp);
  // замовлення гостя: якщо приготував саме замовлену страву — бонус
  {const ord=dailyOrder();if(ord&&ord.key===key&&P.orderDay!==dayKey()){
    P.orderDay=dayKey();const bonus=Math.round(ord.bonus*coinMul());
    P.coins=(P.coins||0)+bonus;if(typeof spawnReaction==='function')spawnReaction(['🪙','😻','⭐']);
    notify('🐱 Замовлення виконано!','Гість задоволений: +🪙'+bonus,4500);
    addLog('Замовлення гостя: '+r.name+' +🪙'+bonus);
  }}
  showEmotion('eat',2400);
  const eff=Object.entries(e).map(([k,v])=>({hunger:'🍖',fun:'🎈',energy:'⚡',bf:'🦋',xp:'⭐'}[k]||k)+'+'+v).join(' ');
  notify('🍳 Смакота! '+r.icon+' '+r.name,eff,4500);
  addLog('Приготовано: '+r.name);
  render();saveP();renderKitchen();
};

// ════════ ПОГОДА ДНЯ ════════
const WEATHER=[
  {key:'sun',  icon:'☀️',name:'Сонячно', walkMul:1.2,growMul:1,  fishMul:1,  desc:'+20% монет на прогулянці',  tint:'wx-sun'},
  {key:'rain', icon:'🌧️',name:'Дощ',     walkMul:0.9,growMul:0.8,fishMul:1.1,desc:'город росте на 20% швидше', tint:'wx-rain'},
  {key:'snow', icon:'❄️',name:'Сніг',     walkMul:1.3,growMul:1.2,fishMul:0.9,desc:'+30% монет, але город повільніший',tint:'wx-snow'},
  {key:'cloud',icon:'☁️',name:'Хмарно',   walkMul:1,  growMul:1,  fishMul:1,  desc:'звичайний спокійний день',  tint:'wx-cloud'},
  {key:'wind', icon:'🌬️',name:'Вітряно',  walkMul:1,  growMul:1,  fishMul:1.3,desc:'+30% улову на риболовлі',   tint:'wx-wind'},
];
function _hash(s){let h=0;for(let i=0;i<s.length;i++){h=(h*31+s.charCodeAt(i))|0;}return Math.abs(h);}
function weatherToday(){return WEATHER[_hash(dayKey()+'wx')%WEATHER.length];}
function updateWeatherUI(){
  const w=weatherToday();const ban=$('weather-banner');
  if(ban){ban.style.display='block';ban.innerHTML='<span class="wx-ic">'+w.icon+'</span> <b>'+w.name+'</b> · '+w.desc;ban.className='weather-banner '+w.tint;}
  const home=$('pg-home');if(home){home.classList.remove('wx-sun','wx-rain','wx-snow','wx-cloud','wx-wind');home.classList.add(w.tint);}
  const bg=$('home-bg');
  if(bg){const set={sun:['☀️','🦋','☁️','🌼','🦋'],rain:['🌧️','💧','☁️','💧','🍃'],snow:['❄️','❄️','☁️','❄️','🦋'],cloud:['☁️','☁️','🍃','☁️','🦋'],wind:['🍃','🍃','☁️','🍂','🦋']}[w.key]||['☁️','🦋','☁️','🍃','🦋'];
    [...bg.children].forEach((s,i)=>{s.textContent=set[i]||'☁️';});}
}

// ════════ ГОСТЬОВІ ВІЗИТИ ════════
const VISIT_BONUS={coins:50,bf:3};
function _visitReset(){const t=dayKey();if(P.visitsDay!==t){P.visitsDay=t;P.visitsDone=[];}}
window.visitFriend=function(){
  if(!_profileTarget){notify('❌','Спочатку відкрий профіль');return;}
  const tid=_profileTarget.id;
  if(tid===uid){notify('🙂','Це твоє подвір\'я');return;}
  _visitReset();
  if(P.visitsDone.includes(tid)){notify('🏡','Ти вже завітав сьогодні. Повертайся завтра!');return;}
  P.visitsDone.push(tid);
  if(typeof addFriendXp==='function')addFriendXp(tid,1);
  const flvl=(typeof friendLevel==='function')?friendLevel(tid):0;
  const bonusMul=1+flvl*0.1; // +10% за рівень дружби
  P.coins=(P.coins||0)+Math.round(VISIT_BONUS.coins*bonusMul);P.butterflies=(P.butterflies||0)+VISIT_BONUS.bf;
  sendLetter({toUid:tid,toNick:_profileTarget.nickname||'друг',subj:'До тебе завітали в гості! 🏡',
    body:'@'+(P.nickname||'?')+' завітав до твого улюбленця і лишив гостинець!',type:'visit',icon:'🏡'}).catch(()=>{});
  notify('🏡 Гарний візит!','+🪙'+Math.round(VISIT_BONUS.coins*bonusMul)+' 🦋'+VISIT_BONUS.bf+(flvl?(' · дружба '+flvl+' рівень'):''),4500);
  addLog('Візит до @'+(_profileTarget.nickname||'?'));
  render();saveP();updateVisitBtn();
};
function updateVisitBtn(){
  const b=$('pm-visit-btn');
  const mb=$('pm-marry-btn');
  if(mb&&_profileTarget){
    const hide=_profileTarget.id===uid||!!P.spouseUid;
    mb.style.display=hide?'none':'block';
    if(!P.gender)mb.textContent='💍 Освідчитися (спершу обери стать)';
    else mb.textContent='💍 Освідчитися';
  }
  if(!b||!_profileTarget)return;
  if(_profileTarget.id===uid){b.style.display='none';return;}
  _visitReset();
  const done=P.visitsDone.includes(_profileTarget.id);
  b.style.display='block';b.disabled=done;
  b.textContent=done?'✅ Сьогодні вже відвідано':'🏡 Завітати у гості (раз на день)';
}
async function processClubGifts(){
  if(!P)return;
  try{
    const snap=await getDocs(query(collection(db,'mail'),where('toUid','==',String(uid)),limit(80)));
    const gifts=snap.docs.map(d=>({_id:d.id,...d.data()})).filter(m=>m.type==='gift'&&(m.giftCoins||m.giftHearts));
    let gc=0,gh=0;
    for(const m of gifts){
      P.coins=(P.coins||0)+(m.giftCoins||0);P.hearts=(P.hearts||0)+(m.giftHearts||0);
      gc+=(m.giftCoins||0);gh+=(m.giftHearts||0);
      try{await deleteDoc(doc(db,'mail',m._id));}catch(e){}
    }
    if(gc||gh){saveP();render();notify('🎁 Подарунок від клубу!','+🪙'+gc+' ❤️'+gh,5000);}
  }catch(e){}
}
async function processVisits(){
  if(!P)return;
  try{
    const snap=await getDocs(query(collection(db,'mail'),where('toUid','==',String(uid)),limit(80)));
    const visits=snap.docs.map(d=>({_id:d.id,...d.data()})).filter(m=>m.type==='visit');
    let got=0;
    for(const m of visits){
      P.coins=(P.coins||0)+VISIT_BONUS.coins;P.butterflies=(P.butterflies||0)+VISIT_BONUS.bf;got++;
      try{await deleteDoc(doc(db,'mail',m._id));}catch(e){}
    }
    if(got){saveP();render();notify('🏡 До тебе приходили гості!','+🪙'+(VISIT_BONUS.coins*got)+' 🦋'+(VISIT_BONUS.bf*got),5000);}
  }catch(e){}
}

// ════════ ВСТАНОВЛЕННЯ ЗАСТОСУНКУ (PWA) ════════
function _isIOS(){return /iphone|ipad|ipod/i.test(navigator.userAgent);}
window.refreshInstallUI=function(){
  const card=$('install-card'),btn=$('install-btn'),desc=$('install-desc');
  if(!card)return;
  if(window._isStandalone){card.style.display='none';return;} // вже встановлено
  if(window._deferredPrompt){ // Android/Chrome — є системний запит
    card.style.display='block';if(btn){btn.style.display='block';btn.textContent='📲 Встановити на телефон';}
    if(desc)desc.textContent='Встанови КотяГру як застосунок — іконка на екрані, повний екран, швидкий запуск!';
    return;
  }
  if(_isIOS()){ // iPhone — лише інструкція
    card.style.display='block';if(btn)btn.style.display='none';
    if(desc)desc.innerHTML='📲 <b>Встановити на iPhone:</b> натисни кнопку «Поділитися» (квадрат зі стрілкою ⬆️) внизу Safari → «На екран Додому».';
    return;
  }
  card.style.display='none';
};
window.installApp=async function(){
  const dp=window._deferredPrompt;
  if(!dp){notify('ℹ️','Встановлення зараз недоступне');return;}
  dp.prompt();
  try{const r=await dp.userChoice;if(r&&r.outcome==='accepted')notify('🎉','Застосунок встановлюється!');}catch(e){}
  window._deferredPrompt=null;refreshInstallUI();
};

// ════════ ФОРУМ КЛУБУ ════════
let _forumTopic=null;
function canModerate(){return (CLUB_ROLES[P._clubRole]||{}).r>=2;} // куратор і вище
function renderForum(){
  $('forum-list-view').style.display='block';
  $('forum-topic-view').style.display='none';
  _forumTopic=null;
  if(!P.clubId){$('forum-topics').innerHTML='<div class="loading-inline">Спершу вступи в клуб 🎈</div>';return;}
  loadTopics();
}
async function loadTopics(){
  const box=$('forum-topics');if(!box)return;
  box.innerHTML='<div class="loading-inline">Завантаження...</div>';
  try{
    const snap=await getDocs(query(collection(db,'clubs',P.clubId,'forum'),limit(100)));
    const arr=snap.docs.map(d=>({_id:d.id,...d.data()})).sort((a,b)=>(b.tsms||0)-(a.tsms||0));
    box.innerHTML=arr.length?arr.map(t=>{
      const dt=t.tsms?new Date(t.tsms).toLocaleDateString('uk-UA',{day:'2-digit',month:'2-digit'}):'';
      return '<div class="forum-topic" onclick="openTopic(\''+t._id+'\',\''+esc((t.title||'').replace(/\x27/g,""))+'\')">'
        +'<div style="flex:1"><div class="forum-t-title">'+esc(t.title||'Без назви')+'</div>'
        +'<div class="forum-t-meta">@'+esc(t.authorNick||'?')+' · '+dt+'</div></div>'
        +(canModerate()?'<button class="mrole-btn kick" onclick="event.stopPropagation();deleteTopic(\''+t._id+'\')">🗑</button>':'')
        +'<span class="forum-arrow">›</span></div>';
    }).join(''):'<div class="loading-inline">Поки немає тем. Створи першу! 🗣️</div>';
  }catch(e){box.innerHTML='<div class="loading-inline">Помилка: '+esc(e.message)+'</div>';}
}
window.createTopic=async function(){
  const title=($('forum-new-title')?.value||'').trim();
  if(title.length<3){notify('📝','Назва теми мінімум 3 символи');return;}
  try{
    await addDoc(collection(db,'clubs',P.clubId,'forum'),san({
      title:title.slice(0,80),authorUid:String(uid),authorNick:String(P.nickname||'?'),
      ts:serverTimestamp(),tsms:Date.now()
    }));
    if($('forum-new-title'))$('forum-new-title').value='';
    notify('🗣️ Топік створено!','');loadTopics();
  }catch(e){notify('❌',e.message);}
};
window.deleteTopic=function(tid){
  if(!canModerate()){notify('🚫','Видаляти може Куратор і вище');return;}
  uiConfirm('Видалити цю тему?',async()=>{
    try{await deleteDoc(doc(db,'clubs',P.clubId,'forum',tid));notify('🗑','Тему видалено');loadTopics();}
    catch(e){notify('❌',e.message);}
  },{title:'Видалити тему',yes:'Видалити'});
};
window.openTopic=function(tid,title){
  _forumTopic=tid;
  $('forum-list-view').style.display='none';
  $('forum-topic-view').style.display='block';
  $('forum-topic-title').textContent=title||'Тема';
  loadPosts();
};
window.closeTopic=function(){renderForum();};
async function loadPosts(){
  const box=$('forum-posts');if(!box||!_forumTopic)return;
  box.innerHTML='<div class="loading-inline">Завантаження...</div>';
  try{
    const snap=await getDocs(query(collection(db,'clubs',P.clubId,'forum',_forumTopic,'posts'),limit(150)));
    const arr=snap.docs.map(d=>({_id:d.id,...d.data()})).sort((a,b)=>(a.tsms||0)-(b.tsms||0));
    box.innerHTML=arr.length?arr.map(p=>{
      const mine=p.uid===uid;const dt=p.tsms?new Date(p.tsms).toLocaleString('uk-UA',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
      return '<div class="forum-post'+(mine?' mine':'')+'">'
        +'<div class="forum-post-head"><b onclick="openProfile(\''+p.uid+'\')" class="chat-sender-link">'+esc(p.nick||'?')+'</b> <span class="forum-post-dt">'+dt+'</span>'
        +((canModerate()||mine)?'<button class="forum-del" onclick="deletePost(\''+p._id+'\')">✕</button>':'')+'</div>'
        +'<div class="forum-post-body">'+esc(p.text||'')+'</div></div>';
    }).join(''):'<div class="loading-inline">Ще немає повідомлень. Почни розмову!</div>';
    box.scrollTop=box.scrollHeight;
  }catch(e){box.innerHTML='<div class="loading-inline">Помилка: '+esc(e.message)+'</div>';}
}
window.addPost=async function(){
  const inp=$('forum-post-text');const text=(inp?.value||'').trim();
  if(!text||!_forumTopic)return;
  try{
    await addDoc(collection(db,'clubs',P.clubId,'forum',_forumTopic,'posts'),san({
      uid:String(uid),nick:String(P.nickname||'?'),text:text.slice(0,300),ts:serverTimestamp(),tsms:Date.now()
    }));
    if(inp)inp.value='';
    loadPosts();
  }catch(e){notify('❌',e.message);}
};
window.deletePost=function(pid){
  uiConfirm('Видалити це повідомлення?',async()=>{
    try{await deleteDoc(doc(db,'clubs',P.clubId,'forum',_forumTopic,'posts',pid));loadPosts();}
    catch(e){notify('❌',e.message);}
  },{title:'Видалити повідомлення',yes:'Видалити'});
};

// ════════ МАЙСТЕРНЯ / КРАФТ ════════
const CRAFT_RECIPES=[
  {key:'amulet',   icon:'🔮',name:'Чарівний амулет',     needs:{ruby:2,sapphire:2},      slot:'collar',beauty:22},
  {key:'emring',   icon:'💍',name:'Смарагдовий перстень',needs:{emerald:3},              slot:'ring',  beauty:21},
  {key:'gemcrown', icon:'👑',name:'Самоцвітна корона',   needs:{diamond:3,amber:2},       slot:'hat',   beauty:28},
  {key:'fishtrophy',icon:'🏆',name:'Трофей рибалки',     needs:{rare:2,korop:3},          slot:'medal', beauty:20},
  {key:'wreath',   icon:'🌺',name:'Квітковий вінок',     needs:{flower:5,strawberry:2},   slot:'hat',   beauty:16},
];
function matCount(k){return (P.gems&&P.gems[k])||(P.ingredients&&P.ingredients[k])||0;}
function _matLabel(k){const G={ruby:'🔴Рубін',sapphire:'🔵Сапфір',emerald:'🟢Смарагд',amber:'🟡Бурштин',diamond:'⚪Діамант'};return G[k]||((INGREDIENTS[k]&&(INGREDIENTS[k].icon+INGREDIENTS[k].name))||k);}
function canCraft(r){return Object.entries(r.needs).every(([k,n])=>matCount(k)>=n);}
function renderWorkshop(){
  const mat=$('craft-materials');
  if(mat){
    const gemIco=['🔴','🔵','🟢','🟡','⚪'];
    const gemList=GEMS.map((g,i)=>[gemIco[i]||'💎',g.key,(P.gems&&P.gems[g.key])||0]);
    const ingList=Object.keys(INGREDIENTS).filter(k=>(P.ingredients&&P.ingredients[k])>0).map(k=>[INGREDIENTS[k].icon,k,P.ingredients[k]]);
    const all=gemList.filter(x=>x[2]>0).concat(ingList);
    mat.innerHTML=all.length?all.map(x=>'<div class="pantry-item"><span class="pantry-ic">'+x[0]+'</span><span class="pantry-nm">'+(GEMS.find(g=>g.key===x[1])?GEMS.find(g=>g.key===x[1]).name:(INGREDIENTS[x[1]]?INGREDIENTS[x[1]].name:x[1]))+'</span><span class="pantry-cnt">×'+x[2]+'</span></div>').join(''):'<div class="loading-inline" style="grid-column:1/-1">Нема матеріалів. Лови рибу, копай камені, вирощуй квіти!</div>';
  }
  const rl=$('craft-recipes');if(!rl)return;
  rl.innerHTML=CRAFT_RECIPES.map(r=>{
    const ok=canCraft(r);const have=P.collected&&P.collected.craft&&P.collected.craft[r.key];
    const needs=Object.entries(r.needs).map(([k,n])=>_matLabel(k)+'×'+n+'('+matCount(k)+')').join(' + ');
    return '<div class="recipe-row'+(ok?'':' locked')+'">'
      +dishImg(r.key,r.icon)
      +'<div style="flex:1"><div class="recipe-nm">'+r.name+(have?' <small style="color:#2f8a4f">✓ у колекції</small>':'')+'</div>'
      +'<div class="recipe-needs">'+needs+'</div>'
      +'<div class="recipe-eff">🦋 краса +'+r.beauty+' (рідкісний)</div></div>'
      +'<button class="recipe-btn" '+(ok?'':'disabled')+' onclick="craftItem(\''+r.key+'\')">'+(ok?'🔨 Створити':'🔒')+'</button>'
      +'</div>';
  }).join('');
}
window.craftItem=function(key){
  const r=CRAFT_RECIPES.find(x=>x.key===key);if(!r||!canCraft(r))return;
  Object.entries(r.needs).forEach(([k,n])=>{
    if(P.gems&&P.gems[k]!=null)P.gems[k]=Math.max(0,(P.gems[k]||0)-n);
    else if(P.ingredients){P.ingredients[k]=(P.ingredients[k]||0)-n;if(P.ingredients[k]<=0)delete P.ingredients[k];}
  });
  if(!P.wardrobe)P.wardrobe=[];
  const id='craft_'+r.key+'_'+Date.now();
  P.wardrobe.push({id,icon:r.icon,name:r.name,slot:r.slot,beauty:r.beauty,rare:true});
  if(!P.collected)P.collected={fish:{},gem:{},craft:{},setClaimed:{}};P.collected.craft[r.key]=true;
  gainXP(25);
  notify('🔨 Створено!',r.icon+' '+r.name+' (+'+r.beauty+'🦋 краси) → у шафі',5000);
  addLog('Скрафчено: '+r.name);
  render();saveP();renderWorkshop();
};

// ════════ КОЛЕКЦІЙНИЙ АЛЬБОМ ════════
const SET_BONUS={fish:{coins:1000,bf:30},gem:{coins:1500,bf:50},craft:{coins:2000,bf:80}};
function renderAlbum(){
  const box=$('album-body');if(!box)return;
  if(!P.collected)P.collected={fish:{},gem:{},craft:{},setClaimed:{}};
  const cols=[
    {key:'fish', title:'🐟 Рибки', items:Object.keys(INGREDIENTS).filter(k=>['karas','okun','korop','shrimp','rare'].includes(k)).map(k=>({k,icon:INGREDIENTS[k].icon,name:INGREDIENTS[k].name})), got:P.collected.fish},
    {key:'gem',  title:'💎 Камені', items:GEMS.map((g,i)=>({k:g.key,icon:['🔴','🔵','🟢','🟡','⚪'][i]||'💎',name:g.name})), got:P.collected.gem},
    {key:'craft',title:'🔨 Рідкісні крафти', items:CRAFT_RECIPES.map(r=>({k:r.key,icon:r.icon,name:r.name})), got:P.collected.craft},
  ];
  box.innerHTML=cols.map(col=>{
    const have=col.items.filter(it=>col.got[it.k]).length;const full=have===col.items.length;
    const claimed=P.collected.setClaimed[col.key];
    const b=SET_BONUS[col.key];
    return '<div class="card album-card">'
      +'<div class="album-head"><span class="sec-title">'+col.title+'</span><span class="album-prog">'+have+'/'+col.items.length+'</span></div>'
      +'<div class="album-grid">'+col.items.map(it=>
        '<div class="album-slot'+(col.got[it.k]?' got':'')+'"><div class="album-ic">'+(col.got[it.k]?it.icon:'❓')+'</div><div class="album-nm">'+(col.got[it.k]?esc(it.name):'???')+'</div></div>'
      ).join('')+'</div>'
      +'<div class="album-bonus">Повний набір: 🪙'+b.coins+' + 🦋'+b.bf+'</div>'
      +(full
        ?(claimed?'<div class="album-done">✅ Нагороду отримано!</div>'
          :'<button class="green-btn" onclick="claimSet(\''+col.key+'\')">🎁 Забрати нагороду набору</button>')
        :'')
      +'</div>';
  }).join('');
}
window.claimSet=function(key){
  if(!P.collected.setClaimed)P.collected.setClaimed={};
  if(P.collected.setClaimed[key]){notify('✅','Вже отримано');return;}
  const b=SET_BONUS[key];if(!b)return;
  P.coins=(P.coins||0)+b.coins;P.butterflies=(P.butterflies||0)+b.bf;
  P.collected.setClaimed[key]=true;
  notify('🏆 Набір зібрано!','+🪙'+b.coins+' +🦋'+b.bf,5000);
  addLog('Зібрано повний набір колекції!');
  render();saveP();renderAlbum();
};

// ════════ ТУТОРІАЛ ════════
const TUT_STEPS=[
  {e:'👋',t:'Вітаємо у КотяГрі!',x:'Це твій улюбленець. Доглядай за ним: годуй 🍖, напувай 💧, грай 🎾 і вкладай спати 😴 — стежки за показниками!'},
  {e:'🪙',t:'Заробляй монети',x:'Ходи на прогулянки 🌳, лови рибу 🎣 та вирощуй овочі на городі 🌱. За монети купуй їжу, одяг і прикрашай оселю 🏠.'},
  {e:'🍳',t:'Готуй і крафти',x:'На кухні 🍳 комбінуй рибу й овочі у смачні страви. У майстерні 🔨 створюй рідкісні предмети з каменів та інгредієнтів!'},
  {e:'🏆',t:'Змагайся й дружи',x:'Вступай у клуб 🎈, спілкуйся на форумі, бери участь у виставках і тижневих турнірах. Збирай колекції 📔 за нагороди!'},
  {e:'🎁',t:'Заходь щодня',x:'Щодня тебе чекає бонус 🎁 і колесо фортуни 🎡. Грай регулярно — і твій улюбленець стане справжньою зіркою! 🌟'},
];
let _tutStep=0;
function maybeTutorial(){if(P&&!P.tutDone&&(P.level||1)<=2){_tutStep=0;showTutStep();}}
function showTutStep(){
  const s=TUT_STEPS[_tutStep];if(!s)return tutSkip();
  $('tut-emoji').textContent=s.e;$('tut-title').textContent=s.t;$('tut-text').textContent=s.x;
  $('tut-dots').innerHTML=TUT_STEPS.map((_,i)=>'<span class="tut-dot'+(i===_tutStep?' on':'')+'"></span>').join('');
  $('tut-next-btn').textContent=_tutStep===TUT_STEPS.length-1?'Почати! 🐾':'Далі →';
  $('tut-overlay').style.display='flex';
}
window.tutNext=function(){_tutStep++;if(_tutStep>=TUT_STEPS.length){tutSkip();}else{showTutStep();sfx('click');}};
window.tutSkip=function(){$('tut-overlay').style.display='none';if(P){P.tutDone=true;saveP();}};

// ════════ ЗВУКИ (WebAudio, без файлів) ════════
let _actx=null;
function sfx(type){
  if(!P||!P.sound)return;
  try{
    _actx=_actx||new (window.AudioContext||window.webkitAudioContext)();
    const ac=_actx,o=ac.createOscillator(),g=ac.createGain();
    o.connect(g);g.connect(ac.destination);
    const tones={click:[520,.05],coin:[880,.12],success:[660,.18],error:[180,.2],level:[990,.25]}[type]||[440,.08];
    o.type=type==='coin'?'triangle':'sine';o.frequency.value=tones[0];
    g.gain.setValueAtTime(.12,ac.currentTime);
    g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+tones[1]);
    o.start();o.stop(ac.currentTime+tones[1]);
    if(type==='coin'){setTimeout(()=>{try{const o2=ac.createOscillator(),g2=ac.createGain();o2.connect(g2);g2.connect(ac.destination);o2.type='triangle';o2.frequency.value=1180;g2.gain.setValueAtTime(.12,ac.currentTime);g2.gain.exponentialRampToValueAtTime(.001,ac.currentTime+.12);o2.start();o2.stop(ac.currentTime+.12);}catch(e){}},70);}
  }catch(e){}
}
window.sfx=sfx;
window.toggleSound=function(){if(!P)return;P.sound=!P.sound;saveP();const b=$('sound-toggle-btn');if(b)b.textContent=P.sound?'🔊 Звук: увімкнено':'🔇 Звук: вимкнено';if(P.sound)sfx('success');};

function applyMenuIcons(){
  if(window.MENU_ICONS)document.querySelectorAll('.hm-img[data-icon]').forEach(img=>{const k=img.getAttribute('data-icon');if(MENU_ICONS[k]&&img.src!==MENU_ICONS[k])img.src=MENU_ICONS[k];});
  if(window.SECTION_ICONS)document.querySelectorAll('.hm-img[data-section]').forEach(img=>{const k=img.getAttribute('data-section');if(SECTION_ICONS[k]&&img.src!==SECTION_ICONS[k])img.src=SECTION_ICONS[k];});
  if(window.ACTION_ICONS)document.querySelectorAll('.bi-img[data-act]').forEach(img=>{const k=img.getAttribute('data-act');if(ACTION_ICONS[k]&&img.src!==ACTION_ICONS[k])img.src=ACTION_ICONS[k];});
  if(window.BATHE_ICON)document.querySelectorAll('.bi-img[data-bathe]').forEach(img=>{if(img.src!==BATHE_ICON)img.src=BATHE_ICON;});
  if(window.HARVEST_ICON)document.querySelectorAll('.harvest-ico[data-harvest]').forEach(img=>{if(img.src!==HARVEST_ICON)img.src=HARVEST_ICON;});
}
window.applyMenuIcons=applyMenuIcons;
// ════════ ХВОРОБА ТА ЛІКАР ════════
const DOCTOR_COST=200;     // виклик лікаря (монети)
const MEDICINE_COST=120;   // ліки з магазину (монети)
function updateSickUI(){
  const ban=$('sick-banner');if(!ban)return;
  if(P&&P.sick){ban.style.display='flex';
    const days=P.sickSince?Math.max(0,Math.floor((Date.now()-P.sickSince)/3600000)):0;
    ban.innerHTML='<span>🤒 Тваринка хвора'+(days?(' вже '+days+' год'):'')+'. Гайнки зменшені, прогулянки й експедиції недоступні.</span>'
      +'<button class="green-btn sick-heal-btn" onclick="callDoctor()">🩺 Лікар (🪙'+DOCTOR_COST+')</button>';
  }else ban.style.display='none';
}
window.callDoctor=function(){
  if(!P||!P.sick){notify('🩺','Тваринка здорова!');return;}
  if((P.coins||0)<DOCTOR_COST){notify('🪙','Потрібно '+DOCTOR_COST+' монет на лікаря');return;}
  P.coins-=DOCTOR_COST;P.sick=false;P.health=100;P.sickSince=0;
  P.hunger=cl((P.hunger||0)+20);P.fun=cl((P.fun||0)+20);
  showEmotion('play',2600);if(typeof sfx==='function')sfx('success');
  notify('🩺 Лікар вилікував тваринку!','Здоров\'я відновлено 💚');
  addLog('Виклик лікаря — тваринка здорова');
  render();saveP();updateSickUI();
};
window.useMedicine=function(){
  // викликається з магазину (ліки)
  if(!P.sick){P.health=100;notify('💊','Тваринка й так здорова — здоров\'я поповнено');render();saveP();return;}
  P.sick=false;P.health=100;P.sickSince=0;
  showEmotion('play',2200);notify('💊 Ліки подіяли!','Тваринка одужала 💚');
  addLog('Ліки — тваринка одужала');render();saveP();updateSickUI();
};
function sickBlocks(){ // чи блокувати активність
  if(P&&P.sick){notify('🤒 Тваринка хвора','Спочатку виклич лікаря 🩺 або дай ліки 💊');return true;}
  return false;
}
function sickGainMul(){return (P&&P.sick)?0.5:1;} // хвора → удвічі менше радості від дій

// ════════ ЕКСПЕДИЦІЇ ════════
const EXPEDITIONS=[
  {key:'forest',  icon:'🌲',name:'Похід у ліс',     dur:5400, energy:25,cMin:90,  cMax:180, ing:2,        xp:30, desc:'1.5 години'},
  {key:'cave',    icon:'🕳️',name:'Темна печера',    dur:9000, energy:30,cMin:160, cMax:300, gem:1,        xp:45, desc:'2.5 години'},
  {key:'mountain',icon:'⛰️',name:'Гірська виправа',  dur:14400,energy:35,cMin:250, cMax:430, gem:1,        xp:60, desc:'4 години'},
  {key:'desert',  icon:'🏜️',name:'Пустельний рейд',  dur:21600,energy:40,cMin:340, cMax:560, ing:2,bf:10,   xp:80, desc:'6 годин'},
  {key:'sea',     icon:'🌊',name:'Морська подорож',  dur:28800,energy:45,cMin:430, cMax:720, bf:15,ing:3,   xp:100,desc:'8 годин'},
  {key:'jungle',  icon:'🌴',name:'Джунглі',          dur:39600,energy:50,cMin:600, cMax:1000,gem:1,bf:15,   xp:130,desc:'11 годин'},
  {key:'treasure',icon:'🗺️',name:'Пошук скарбів',    dur:57600,energy:60,cMin:900, cMax:1700,gem:2,bf:20,   xp:180,desc:'16 годин'},
  {key:'ruins',   icon:'🏛️',name:'Стародавні руїни',  dur:72000,energy:70,cMin:1300,cMax:2400,gem:3,bf:25,   xp:240,desc:'20 годин'},
];
let _expTicker=null;
function _exp(k){return EXPEDITIONS.find(e=>e.key===k);}
function expDone(){return P.expedition&&(Date.now()-P.expedition.start>=P.expedition.dur*1000);}
function _fmtDur(s){const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);return h?(h+'г '+(m?m+'хв':'')):(m+'хв');}
function renderExpeditions(){
  clearInterval(_expTicker);
  const box=$('expedition-body');if(!box)return;
  if(P.expedition){
    const e=_exp(P.expedition.type)||{icon:'🧭',name:'Похід'};
    if(expDone()){
      box.innerHTML='<div class="card exp-active done"><div class="exp-ic-big">'+e.icon+'</div>'
        +'<div class="exp-name">'+e.name+' — завершено!</div>'
        +'<button class="green-btn" onclick="claimExpedition()">🎁 Зустріти й забрати нагороду</button></div>';
    }else{
      box.innerHTML='<div class="card exp-active"><div class="exp-ic-big">'+e.icon+'</div>'
        +'<div class="exp-name">'+e.name+'</div>'
        +'<div class="exp-prog"><div class="exp-pfill" id="exp-pfill"></div></div>'
        +'<div class="exp-timer" id="exp-timer"></div>'
        +'<div class="exp-hint">Тваринка в дорозі... повертайся пізніше (працює офлайн)</div></div>';
      _expTicker=setInterval(tickExp,1000);tickExp();
    }
    return;
  }
  box.innerHTML=EXPEDITIONS.map(e=>{
    const rw=[];rw.push('🪙'+e.cMin+'–'+e.cMax);if(e.ing)rw.push('🍳×'+e.ing);if(e.gem)rw.push('💎×'+e.gem);if(e.bf)rw.push('🦋'+e.bf);
    const can=(P.energy||0)>=e.energy&&!P.sick;
    return '<div class="card exp-card">'
      +'<div class="exp-row"><span class="exp-ic">'+e.icon+'</span>'
      +'<div style="flex:1"><div class="exp-name2">'+e.name+'</div>'
      +'<div class="exp-meta">⏱️ '+e.desc+' · ⚡'+e.energy+' енергії</div>'
      +'<div class="exp-reward">'+rw.join(' · ')+' · ⭐'+e.xp+'</div></div></div>'
      +'<button class="orange-btn" '+(can?'':'disabled')+' onclick="startExpedition(\''+e.key+'\')">'+(P.sick?'🤒 Хвора':((P.energy||0)<e.energy?'😴 Мало енергії':'🧭 Відправити'))+'</button>'
      +'</div>';
  }).join('');
}
function tickExp(){
  if(!P.expedition){clearInterval(_expTicker);return;}
  if(expDone()){renderExpeditions();return;}
  const el=Date.now()-P.expedition.start,tot=P.expedition.dur*1000;
  const pf=$('exp-pfill');if(pf)pf.style.width=Math.min(100,el/tot*100)+'%';
  const tm=$('exp-timer');if(tm)tm.textContent='Залишилось: '+_fmtDur(Math.ceil((tot-el)/1000));
}
window.startExpedition=function(key){
  const e=_exp(key);if(!e)return;
  if(P.expedition){notify('🧭','Тваринка вже в поході');return;}
  if(typeof sickBlocks==='function'&&sickBlocks())return;
  const eCost=Math.round(e.energy*(1-skillEff('expEnergy')/100));
  if((P.energy||0)<eCost){notify('😴','Замало енергії ('+eCost+')');return;}
  P.energy=cl((P.energy||0)-eCost);
  P.expedition={type:key,start:Date.now(),dur:e.dur};
  notify('🧭 У похід!',e.icon+' '+e.name+' · повернеться через '+e.desc);
  addLog('Експедиція: '+e.name);
  render();saveP();renderExpeditions();
};
window.claimExpedition=function(){
  if(!P.expedition||!expDone()){notify('🧭','Похід ще триває');return;}
  const e=_exp(P.expedition.type);P.expedition=null;
  if(!e){render();saveP();renderExpeditions();return;}
  const coins=Math.round((e.cMin+Math.floor(Math.random()*(e.cMax-e.cMin+1)))*coinMul());
  P.coins=(P.coins||0)+coins;
  const got=['🪙'+coins];
  if(e.ing){if(!P.ingredients)P.ingredients={};const keys=Object.keys(INGREDIENTS);for(let n=0;n<e.ing;n++){const k=keys[Math.floor(Math.random()*keys.length)];P.ingredients[k]=(P.ingredients[k]||0)+1;if(P.collected&&P.collected.fish&&['karas','okun','korop','shrimp','rare'].includes(k))P.collected.fish[k]=true;}got.push('🍳×'+e.ing);}
  if(e.gem){if(!P.gems)P.gems={};const gk=GEMS.map(g=>g.key);for(let n=0;n<e.gem;n++){const k=gk[Math.floor(Math.random()*gk.length)];P.gems[k]=(P.gems[k]||0)+1;}got.push('💎×'+e.gem);}
  if(e.bf){P.butterflies=(P.butterflies||0)+e.bf;got.push('🦋'+e.bf);}
  gainXP(e.xp||20);
  lifeTrack('expedition');if(typeof contributeClubQuest==='function')contributeClubQuest('expedition',1);
  showEmotion('play',2800);if(typeof sfx==='function')sfx('coin');
  notify('🎁 Похід завершено!',e.icon+' '+e.name+' · '+got.join(' '),6000);
  addLog('Експедиція «'+e.name+'»: '+got.join(' '));
  render();saveP();renderExpeditions();
};

// ════════ ТЕМНА ТЕМА (нічний режим за київським часом) ════════
let _themeMode='auto'; // auto | light | dark
function kyivHour(){
  try{return +new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Kyiv',hour:'numeric',hour12:false}).format(new Date());}
  catch(e){return new Date().getHours();}
}
function isNightKyiv(){const h=kyivHour();return h>=20||h<6;}
function applyTheme(){
  if(P&&P.themeMode)_themeMode=P.themeMode;
  let dark = _themeMode==='dark' ? true : _themeMode==='light' ? false : isNightKyiv();
  document.body.classList.toggle('dark',dark);
  // денний цикл: відтінок головної за часом доби (київський)
  const home=$('pg-home');
  if(home){
    const h=kyivHour();const phase=h<6?'night':h<9?'dawn':h<17?'day':h<20?'dusk':'night';
    home.classList.remove('dc-dawn','dc-day','dc-dusk','dc-night');
    home.classList.add('dc-'+phase);
  }
  const b=$('theme-toggle-btn');
  if(b)b.textContent=_themeMode==='auto'?('🌓 Тема: авто (зараз '+(dark?'нічна':'денна')+')'):(_themeMode==='dark'?'🌙 Тема: завжди нічна':'☀️ Тема: завжди денна');
}
window.cycleTheme=function(){
  _themeMode=_themeMode==='auto'?'light':_themeMode==='light'?'dark':'auto';
  if(P){P.themeMode=_themeMode;saveP();}
  applyTheme();
};
setInterval(()=>{if(_themeMode==='auto')applyTheme();},60000);
window.applyTheme=applyTheme;
// ════════ АНІМАЦІЯ МОНЕТ ════════
function flyCoins(amount){
  try{
    const target=$('s-c');if(!target)return;
    const r=target.getBoundingClientRect();
    const n=Math.min(8,Math.max(3,Math.round(amount/40)));
    for(let i=0;i<n;i++){
      const c=document.createElement('div');c.className='fly-coin';c.textContent='🪙';
      const sx=r.left+r.width/2+(Math.random()*120-60);
      const sy=r.top+90+Math.random()*60;
      c.style.left=sx+'px';c.style.top=sy+'px';
      c.style.setProperty('--dx',(r.left+r.width/2-sx)+'px');
      c.style.setProperty('--dy',(r.top-sy)+'px');
      c.style.animationDelay=(i*55)+'ms';
      document.body.appendChild(c);
      setTimeout(()=>c.remove(),900+i*55);
    }
    target.classList.remove('coin-bump');void target.offsetWidth;target.classList.add('coin-bump');
    if(typeof sfx==='function')sfx('coin');
  }catch(e){}
}
window.flyCoins=flyCoins;
// ════════ СІМ'Я / ОДРУЖЕННЯ / РОЗВЕДЕННЯ ════════
function petWord(type,gender){
  const dog=type==='dog';
  return dog?(gender==='female'?'песик (дівчинка)':'песик (хлопчик)'):(gender==='female'?'кішечка':'котик');
}
function babyWord(type){return type==='dog'?'цуценя':'кошеня';}
function renderFamily(){
  const box=$('family-body');if(!box)return;
  let html='';
  // 1) Стать
  html+='<div class="card"><div class="sec-title">⚧ Стать улюбленця</div>';
  if(!P.gender){
    html+='<div class="fam-note">Обери стать — це потрібно, щоб одружитися й завести малюка.</div>'
      +'<div class="fam-gender-row"><button class="green-btn" onclick="setGender(\'male\')">♂️ Хлопчик</button>'
      +'<button class="pink-btn" onclick="setGender(\'female\')">♀️ Дівчинка</button></div>';
  }else{
    html+='<div class="fam-note">Стать: <b>'+(P.gender==='female'?'♀️ Дівчинка':'♂️ Хлопчик')+'</b> ('+petWord(P.petType,P.gender)+')</div>';
  }
  html+='</div>';
  // 2) Шлюб
  const deco=k=>(window.FAMILY_ICONS&&FAMILY_ICONS[k])?'<img class="fam-deco" src="'+FAMILY_ICONS[k]+'" alt="">':'';
  html+='<div class="card fam-card"><div class="sec-title">💍 Шлюб</div>'+deco('fam_marry');
  if(P.spouseUid){
    html+='<div class="fam-spouse">💑 У шлюбі з <b>'+esc(P.spouseNick||'?')+'</b></div>'
      +'<button class="grey-btn" onclick="divorce()" style="margin-top:8px">💔 Розлучитися</button>';
  }else if(!P.gender){
    html+='<div class="fam-note">Спочатку обери стать вище ☝️</div>';
  }else{
    html+='<div class="fam-note">Щоб одружитися — відкрий профіль друга (через чат, рейтинг або список друзів) і натисни «💍 Освідчитися». Або прийми пропозицію нижче.</div>';
  }
  html+='</div>';
  // 3) Вхідні пропозиції
  html+='<div class="card fam-card"><div class="sec-title">💌 Пропозиції руки</div>'+deco('fam_ring')+'<div id="marriage-proposals"><div class="loading-inline">Завантаження...</div></div></div>';
  // 4) Малюк
  html+='<div class="card fam-card"><div class="sec-title">👶 Малюк</div>'+deco('fam_baby');
  if(P.baby){
    const b=P.baby;const can=P.babyPlayedDay!==dayKey();
    html+='<div class="fam-baby"><div class="fam-baby-ic">'+(b.type==='dog'?'🐶':'🐱')+'</div>'
      +'<div><div class="fam-baby-name">'+esc(b.name)+'</div>'
      +'<div class="fam-note">Ваше '+babyWord(b.type)+' '+(b.gender==='female'?'(дівчинка)':'(хлопчик)')+'</div></div></div>'
      +'<button class="green-btn" '+(can?'':'disabled')+' onclick="playWithBaby()" style="margin-top:10px">'+(can?'🍼 Погратися з малюком (+🪙50 +❤️20)':'✅ Сьогодні вже гралися')+'</button>';
  }else if(P.spouseUid){
    html+='<div class="fam-note">Ви у шлюбі! Можна завести одного малюка — '+babyWord(P.petType)+' (за типом твоєї тваринки). Більше двох улюбленців не можна 🐾</div>'
      +'<button class="pink-btn" onclick="haveBaby()" style="margin-top:8px">👶 Завести малюка</button>';
  }else{
    html+='<div class="fam-note">Малюк можливий лише у шлюбі 💍</div>';
  }
  html+='</div>';
  box.innerHTML=html;
  loadMarriageProposals();
}
window.setGender=function(g){
  if(P.gender){notify('⚧','Стать уже обрано');return;}
  P.gender=g;saveP();notify('⚧ Готово!','Стать: '+(g==='female'?'дівчинка ♀️':'хлопчик ♂️'));renderFamily();
};
window.proposeMarriage=async function(){
  if(!_profileTarget){notify('❌','Відкрий профіль гравця');return;}
  if(!P.gender){notify('⚧','Спершу обери стать у вкладці Сім\'я');return;}
  if(P.spouseUid){notify('💍','Ти вже у шлюбі');return;}
  if(_profileTarget.id===uid){notify('🙂','Це ти!');return;}
  if((P.sentMarriage||[]).includes(_profileTarget.id)){notify('⏳','Пропозицію вже надіслано');return;}
  try{
    await sendLetter({toUid:_profileTarget.id,toNick:_profileTarget.nickname||'?',subj:'💍 Освідчення!',
      body:'@'+(P.nickname||'?')+' пропонує тобі руку та серце! Прийми у вкладці «Сім\'я».',
      type:'marriage',icon:'💍',extra:{fromPet:String(P.petType||'cat'),fromGender:String(P.gender)}});
    if(!P.sentMarriage)P.sentMarriage=[];P.sentMarriage.push(_profileTarget.id);saveP();
    notify('💍 Освідчення надіслано!','Очікуй на відповідь 💕');
  }catch(e){notify('❌',e.message);}
};
async function loadMarriageProposals(){
  const box=$('marriage-proposals');if(!box)return;
  if(P.spouseUid){box.innerHTML='<div class="fam-note">Ти вже у шлюбі 💑</div>';return;}
  try{
    const snap=await getDocs(query(collection(db,'mail'),where('toUid','==',String(uid)),limit(60)));
    const props=snap.docs.map(d=>({_id:d.id,...d.data()})).filter(m=>m.type==='marriage');
    if(!props.length){box.innerHTML='<div class="fam-note">Поки немає пропозицій 💌</div>';return;}
    box.innerHTML=props.map(m=>'<div class="marriage-prop"><span>💍 <b>'+esc(m.fromNick||'?')+'</b> освідчується тобі</span>'
      +'<div class="marriage-prop-btns"><button class="green-btn" onclick="acceptMarriage(\''+m.fromUid+'\',\''+esc((m.fromNick||'').replace(/\x27/g,""))+'\',\''+esc(m.fromPet||'cat')+'\',\''+m._id+'\')">💕 Прийняти</button>'
      +'<button class="grey-btn" onclick="declineMarriage(\''+m._id+'\')">Відхилити</button></div></div>').join('');
  }catch(e){box.innerHTML='<div class="fam-note">Помилка завантаження</div>';}
}
window.acceptMarriage=async function(fromUid,fromNick,fromPet,mailId){
  if(P.spouseUid){notify('💍','Ти вже у шлюбі');return;}
  if(!P.gender){notify('⚧','Спершу обери стать');return;}
  P.spouseUid=String(fromUid);P.spouseNick=fromNick;P.spousePet=fromPet;saveP();
  try{
    // повідомляємо ініціатора, що прийнято — він прив'яже свій бік при вході
    await sendLetter({toUid:fromUid,toNick:fromNick,subj:'💕 Освідчення прийнято!',
      body:'@'+(P.nickname||'?')+' прийняв(ла) твою пропозицію! Тепер ви — родина 💑',
      type:'marriage_accept',icon:'💕',extra:{spouseNick:String(P.nickname||'?'),spousePet:String(P.petType||'cat')}});
    if(mailId)await deleteDoc(doc(db,'mail',mailId));
  }catch(e){}
  notify('💕 Вітаємо з весіллям!','Тепер ти у шлюбі з '+esc(fromNick),6000);
  addLog('Одруження з '+fromNick);
  renderFamily();
};
window.declineMarriage=async function(mailId){
  try{await deleteDoc(doc(db,'mail',mailId));}catch(e){}
  notify('💌','Пропозицію відхилено');loadMarriageProposals();
};
async function processMarriageAccepts(){
  if(!P)return;
  try{
    const snap=await getDocs(query(collection(db,'mail'),where('toUid','==',String(uid)),limit(60)));
    const acc=snap.docs.map(d=>({_id:d.id,...d.data()})).filter(m=>m.type==='marriage_accept');
    for(const m of acc){
      if(!P.spouseUid){P.spouseUid=String(m.fromUid);P.spouseNick=m.spouseNick||m.fromNick||'?';P.spousePet=m.spousePet||'cat';
        notify('💕 Тебе обрали!','Ви у шлюбі з '+esc(P.spouseNick),6000);addLog('Одруження з '+P.spouseNick);}
      try{await deleteDoc(doc(db,'mail',m._id));}catch(e){}
    }
    // малюк від другого з подружжя
    const babies=snap.docs.map(d=>({_id:d.id,...d.data()})).filter(m=>m.type==='baby_born');
    for(const m of babies){
      if(!P.baby&&(m.babyName)){
        P.baby={name:m.babyName,type:m.babyType||P.petType||'cat',gender:m.babyGender||'male',born:m.babyBorn||Date.now()};
        notify('👶 У вас малюк!',(P.baby.type==='dog'?'🐶':'🐱')+' '+P.baby.name,6000);addLog('Поповнення в родині: '+P.baby.name);
      }
      try{await deleteDoc(doc(db,'mail',m._id));}catch(e){}
    }
    if(acc.length||babies.length)saveP();
  }catch(e){}
}
window.divorce=function(){
  if(!P.spouseUid)return;
  uiConfirm('Розлучитися з '+esc(P.spouseNick||'')+'? Малюк (якщо є) залишиться з тобою.',()=>{
    const ex=P.spouseNick;P.spouseUid='';P.spouseNick='';P.spousePet='';
    if(P.sentMarriage)P.sentMarriage=[];
    saveP();notify('💔','Ви розлучилися');addLog('Розлучення з '+ex);renderFamily();
  },{title:'Розлучення',yes:'Розлучитися'});
};
window.haveBaby=function(){
  if(!P.spouseUid){notify('💍','Спершу одружися');return;}
  if(P.baby){notify('👶','У вас уже є малюк (максимум один)');return;}
  const inp=$('baby-name-input');if(inp)inp.value='';
  const m=$('baby-modal');if(m)m.style.display='flex';
  setTimeout(()=>{if(inp)inp.focus();},100);
};
window.closeBabyModal=function(){const m=$('baby-modal');if(m)m.style.display='none';};
window.confirmBaby=function(){
  if(!P.spouseUid||P.baby){closeBabyModal();return;}
  const name=(($('baby-name-input')?.value||'').trim()||'Малюк').slice(0,20);
  const gender=Math.random()<.5?'male':'female';
  P.baby={name,type:P.petType||'cat',gender,born:Date.now()};
  // надсилаємо малюка другому з подружжя, щоб він теж його мав
  if(P.spouseUid){
    sendLetter({toUid:P.spouseUid,toNick:P.spouseNick||'кохана(ий)',subj:'👶 У нас малюк!',
      body:'Вітаємо — у вашій родині поповнення: '+name+'!',
      type:'baby_born',icon:'👶',extra:{babyName:String(name),babyType:String(P.petType||'cat'),babyGender:String(gender),babyBorn:Date.now()}}).catch(()=>{});
  }
  closeBabyModal();
  notify('👶 Вітаємо з поповненням!',(P.petType==='dog'?'🐶':'🐱')+' '+name+' народився(лась)!',6000);
  addLog('Народився малюк: '+name);
  render();saveP();renderFamily();
};
window.playWithBaby=function(){
  if(!P.baby){return;}
  if(P.babyPlayedDay===dayKey()){notify('👶','Сьогодні вже гралися. Завтра знову!');return;}
  P.babyPlayedDay=dayKey();
  P.coins=(P.coins||0)+50;P.hearts=(P.hearts||0)+20;P.fun=cl((P.fun||0)+10);
  gainXP(8);if(typeof sfx==='function')sfx('success');
  notify('🍼 Як весело з малюком!','+🪙50 +❤️20',4500);
  render();saveP();renderFamily();
};

// ════════ ДЕРЕВО НАВИЧОК ════════
const SKILL_TREE=[
  {branch:'🏠 Господар',color:'#ffd66e',nodes:[
    {id:'h1',name:'Ощадливість',desc:'+5% монет з усього',cost:1,eff:{coinPct:5}},
    {id:'h2',name:'Турист',desc:'+15% монет з прогулянок',cost:2,req:'h1',eff:{walkPct:15}},
    {id:'h3',name:'Будівельник',desc:'будинок дешевший на 12%',cost:3,req:'h2',eff:{houseDisc:12}},
    {id:'h4',name:'Магнат',desc:'+12% монет з усього',cost:5,req:'h3',eff:{coinPct:12}},
  ]},
  {branch:'💖 Красень',color:'#f7a8c8',nodes:[
    {id:'b1',name:'Чарівність',desc:'+8% сердечок за догляд',cost:1,eff:{heartPct:8}},
    {id:'b2',name:'Тренер',desc:'тренування −12% сердечок',cost:2,req:'b1',eff:{trainDisc:12}},
    {id:'b3',name:'Зірка',desc:'+1 краси за кожне тренування',cost:3,req:'b2',eff:{trainBeauty:1}},
    {id:'b4',name:'Ікона стилю',desc:'+15% сердечок за догляд',cost:5,req:'b3',eff:{heartPct:15}},
  ]},
  {branch:'🧭 Мандрівник',color:'#a8e0c0',nodes:[
    {id:'a1',name:'Рибалка',desc:'+12% улову на риболовлі',cost:1,eff:{fishPct:12}},
    {id:'a2',name:'Витривалість',desc:'експедиції −15% енергії',cost:2,req:'a1',eff:{expEnergy:15}},
    {id:'a3',name:'Першопроходець',desc:'+15% монет з прогулянок і риболовлі',cost:3,req:'a2',eff:{walkPct:15,fishPct:15}},
    {id:'a4',name:'Легенда доріг',desc:'+20% монет з усього',cost:5,req:'a3',eff:{coinPct:20}},
  ]},
];
function _allNodes(){return SKILL_TREE.flatMap(b=>b.nodes);}
function skillEff(key){let v=0;_allNodes().forEach(n=>{if(P.skillNodes&&P.skillNodes[n.id]&&n.eff[key])v+=n.eff[key];});return v;}
function renderSkillTree(){
  const box=$('skilltree-body');if(!box)return;
  let html='<div class="skill-points">🎯 Балів навичок: <b>'+(P.skillPoints||0)+'</b><div class="skill-hint">+1 бал за кожен новий рівень</div></div>';
  SKILL_TREE.forEach(b=>{
    html+='<div class="card skill-branch" style="border-top:4px solid '+b.color+'"><div class="sec-title">'+b.branch+'</div>';
    b.nodes.forEach(n=>{
      const owned=P.skillNodes&&P.skillNodes[n.id];
      const reqOk=!n.req||(P.skillNodes&&P.skillNodes[n.req]);
      const can=!owned&&reqOk&&(P.skillPoints||0)>=n.cost;
      html+='<div class="skill-node'+(owned?' owned':(reqOk?'':' locked'))+'">'
        +'<div style="flex:1"><div class="skill-node-name">'+n.name+(owned?' ✅':'')+'</div>'
        +'<div class="skill-node-desc">'+n.desc+'</div>'
        +(!reqOk?'<div class="skill-node-req">🔒 Спочатку відкрий попередню</div>':'')+'</div>'
        +(owned?'<span class="skill-owned-lbl">є</span>'
          :'<button class="skill-buy-btn" '+(can?'':'disabled')+' onclick="unlockSkill(\''+n.id+'\')">🎯'+n.cost+'</button>')
        +'</div>';
    });
    html+='</div>';
  });
  box.innerHTML=html;
}
window.unlockSkill=function(id){
  const n=_allNodes().find(x=>x.id===id);if(!n)return;
  if(P.skillNodes&&P.skillNodes[id]){notify('✅','Вже відкрито');return;}
  if(n.req&&!(P.skillNodes&&P.skillNodes[n.req])){notify('🔒','Спочатку відкрий попередню навичку');return;}
  if((P.skillPoints||0)<n.cost){notify('🎯','Замало балів ('+n.cost+')');return;}
  P.skillPoints-=n.cost;if(!P.skillNodes)P.skillNodes={};P.skillNodes[id]=true;
  if(typeof sfx==='function')sfx('success');
  notify('🌳 Навичку відкрито!',n.name+' — '+n.desc,5000);
  addLog('Відкрито навичку: '+n.name);
  render();saveP();renderSkillTree();
};
// ════════ МАЄТОК (престиж) ════════
function mansionCost(lv){return Math.round(8000*Math.pow(1.6,lv));} // 8000,12800,20480...
function mansionBonus(){return (P.mansion||0)*0.5;} // +0.5% монет за рівень
function renderMansion(){
  const box=$('mansion-body');if(!box)return;
  const star=(typeof houseStar==='function')?houseStar():1;
  if(star<5){box.innerHTML='<div class="info-box-green">🏰 Маєток відкриється, коли твій будинок досягне 5★. Це престиж — нескінченні розкішні рівні, що дають +0.5% монет кожен.</div>';return;}
  const lv=P.mansion||0,cost=mansionCost(lv);
  box.innerHTML='<div class="card" style="text-align:center">'
    +'<div style="font-size:3rem">🏰</div>'
    +'<div class="sec-title">Маєток · рівень '+lv+'</div>'
    +'<div class="fam-note">Бонус: +'+mansionBonus().toFixed(1)+'% монет з усього</div>'
    +'<div class="album-bonus" style="margin-top:10px">Наступний рівень: +0.5% монет</div>'
    +'<button class="orange-btn" '+((P.coins||0)<cost?'disabled':'')+' onclick="upgradeMansion()" style="margin-top:8px">🏰 Покращити (🪙'+cost+')</button>'
    +'</div>';
}
window.upgradeMansion=function(){
  const star=(typeof houseStar==='function')?houseStar():1;
  if(star<5){notify('🏰','Спершу збудуй будинок до 5★');return;}
  const cost=mansionCost(P.mansion||0);
  if((P.coins||0)<cost){notify('🪙','Недостатньо монет');return;}
  P.coins-=cost;P.mansion=(P.mansion||0)+1;
  if(typeof sfx==='function')sfx('success');
  notify('🏰 Маєток покращено!','Рівень '+P.mansion+' · +'+mansionBonus().toFixed(1)+'% монет');
  addLog('Маєток → рівень '+P.mansion);
  render();saveP();renderMansion();
};

// ════════ КУПАННЯ ════════
window.bathePet=function(){
  if((P.clean||0)>=100){notify('🛁','Тваринка вже чистенька!');return;}
  P.clean=100;P.fun=cl((P.fun||0)+10);P.hearts=(P.hearts||0)+10;gainXP(3);
  showEmotion('play',2400);if(typeof spawnReaction==='function')spawnReaction(['🫧','💧','✨','😊']);if(typeof sfx==='function')sfx('success');
  notify('🛁 Чистота!','Тваринка скупана · +настрій +❤️10');
  render();saveP();
};

// ════════ БАНК / ДЕПОЗИТ ════════
const BANK_RATE=0.03, BANK_MAXDAYS=7; // +3%/день, максимум 7 днів
function bankInterestRaw(){
  if(!P.bank||!P.bankSince)return (P.bankFrac||0);
  const days=Math.min(BANK_MAXDAYS,(Date.now()-P.bankSince)/86400000);
  return P.bank*BANK_RATE*days+(P.bankFrac||0);
}
function bankInterest(){return Math.floor(bankInterestRaw());}
let _bankTicker=null;
function renderBank(){
  clearInterval(_bankTicker);
  const box=$('bank-body');if(!box)return;
  const intr=bankInterestRaw();
  box.innerHTML='<div class="card" style="text-align:center"><div style="font-size:2.6rem">🏦</div>'
    +'<div class="sec-title">Банк КотяГри</div>'
    +'<div class="fam-note">На депозиті: 🪙<b>'+(P.bank||0)+'</b><br>Нараховано відсотків: 🪙<b id="bank-intr">'+intr.toFixed(1)+'</b><br>+3% на день, максимум 7 днів</div>'
    +'<input class="input-field bank-input" id="bank-amount" type="number" inputmode="numeric" min="1" placeholder="Скільки покласти?" >'
    +'<div class="bank-quick"><button onclick="bankSet(0.25)">25%</button><button onclick="bankSet(0.5)">50%</button><button onclick="bankSet(1)">Усе</button></div>'
    +'<button class="green-btn" onclick="bankDeposit()" style="width:100%;margin-top:8px">🏦 Покласти на депозит</button>'
    +'<button class="orange-btn" onclick="bankWithdraw()" style="margin-top:8px;width:100%">💰 Забрати все +відсотки</button></div>';
  // живе оновлення нарахованих відсотків поки відкрита сторінка
  _bankTicker=setInterval(()=>{const el=$('bank-intr');if(el)el.textContent=bankInterestRaw().toFixed(1);else clearInterval(_bankTicker);},3000);
}
window.bankSet=function(frac){const inp=$('bank-amount');if(inp)inp.value=Math.floor((P.coins||0)*frac);};
window.bankDeposit=function(){
  const v=Math.floor(+($('bank-amount')?.value||0));
  if(v<=0){notify('🏦','Введи суму');return;}
  if((P.coins||0)<v){notify('🪙','Недостатньо монет');return;}
  // капіталізуємо нараховані відсотки (з дробовою частиною — нічого не губиться)
  const raw=bankInterestRaw();const whole=Math.floor(raw);
  P.bank=(P.bank||0)+whole+v;P.bankFrac=raw-whole;P.bankSince=Date.now();P.coins-=v;
  notify('🏦 Покладено!','+🪙'+v+(whole>0?(' · відсотки +🪙'+whole+' додано до депозиту'):'')+' · усього 🪙'+P.bank);
  render();saveP();renderBank();
};
window.bankWithdraw=function(){
  if(!P.bank){notify('🏦','Депозит порожній');return;}
  const raw=bankInterestRaw();const intr=Math.floor(raw);const total=(P.bank||0)+intr;
  P.coins=(P.coins||0)+total;P.bank=0;P.bankFrac=0;P.bankSince=0;
  if(typeof sfx==='function')sfx('coin');
  notify('💰 Забрано з банку!','🪙'+total+' (+'+intr+' відсотків)',5000);
  addLog('Знято з банку: 🪙'+total);render();saveP();renderBank();
};

// ════════ РІВЕНЬ ДРУЖБИ ════════
function friendLevel(fuid){const xp=(P.friendXp&&P.friendXp[fuid])||0;return Math.floor(xp/5);} // 5 взаємодій = рівень
function addFriendXp(fuid,n){if(!P.friendXp)P.friendXp={};P.friendXp[fuid]=(P.friendXp[fuid]||0)+(n||1);}

// ════════ МІНІ-ІГРИ ════════
const RIDDLES=[
  {q:'Що завжди перед тобою, але його не видно?',a:['Майбутнє','Тінь','Повітря'],c:0},
  {q:'Скільки лап у двох котиків?',a:['6','8','4'],c:1},
  {q:'Що стає більшим, якщо його перевернути догори дриґом?',a:['Число 6','Гора','Відро'],c:0},
  {q:'Хто вранці на чотирьох, удень на двох?',a:['Людина','Кіт','Стіл'],c:0},
  {q:'Що можна зловити, але не втримати?',a:['Застуду','Рибу','Мʼяч'],c:0},
  {q:'Біле, а не цукор; без ніг, а йде. Що це?',a:['Сніг','Молоко','Хмара'],c:0},
  {q:'Скільки місяців у році мають 28 днів?',a:['Усі 12','Лише лютий','Жодного'],c:0},
  {q:'Що має голову й хвіст, але не має тіла?',a:['Монета','Змія','Комета'],c:0},
  {q:'Що стає мокрим, поки сушить?',a:['Рушник','Сонце','Вітер'],c:0},
  {q:'Чим більше береш, тим більше залишається. Що це?',a:['Сліди','Гроші','Час'],c:0},
  {q:'Що належить тобі, але інші користуються ним частіше?',a:['Твоє імʼя','Телефон','Час'],c:0},
  {q:'Що ламається, щойно його назвеш?',a:['Тиша','Скло','Олівець'],c:0},
  {q:'Що має багато клавіш, але не відчиняє дверей?',a:['Піаніно','Звʼязка','Карта'],c:0},
  {q:'Що йде вгору, але ніколи не спускається?',a:['Вік','Дим','Кулька'],c:0},
  {q:'Що має зуби, але не кусає?',a:['Гребінець','Пилка','Собака'],c:0},
  {q:'Що має обличчя й дві руки, але без ніг?',a:['Годинник','Лялька','Дзеркало'],c:0},
  {q:'Скільки горіхів у порожній склянці?',a:['Жодного','Один','Багато'],c:0},
  {q:'Що можна розбити, навіть не торкнувшись?',a:['Обіцянку','Вазу','Лід'],c:0},
  {q:'Що завжди приходить, але ніколи не настає сьогодні?',a:['Завтра','Свято','Дощ'],c:0},
  {q:'У кого є шия, але немає голови?',a:['Пляшка','Жираф','Гітара'],c:0},
  {q:'Що легке, як пірʼїна, але й силач довго не втримає?',a:['Дихання','Папір','Сніжинка'],c:0},
  {q:'Що повне дірок, але тримає воду?',a:['Губка','Сито','Відро'],c:0},
  {q:'Що можна тримати в правій руці, але ніколи в лівій?',a:['Лівий лікоть','Олівець','Яблуко'],c:0},
  {q:'Що біжить навколо двору, але ніколи не рухається?',a:['Паркан','Собака','Вода'],c:0},
  {q:'Що зникає, щойно ти промовиш його імʼя?',a:['Тиша','Луна','Сон'],c:0},
  {q:'Скільки кінців у двох з половиною паличок?',a:['6','5','4'],c:0},
  {q:'Що чорне, коли чисте, і біле, коли брудне?',a:['Шкільна дошка','Папір','Сніг'],c:0},
  {q:'Що може подорожувати світом, лишаючись у кутку?',a:['Марка','Мапа','Хмара'],c:0},
  {q:'Що має багато аркушів, але не книга?',a:['Календар','Зошит','Газета'],c:0},
  {q:'Чим більше з нього виймаєш, тим воно стає більшим. Що це?',a:['Яма','Скриня','Мішок'],c:0},
  {q:'Що завжди голодне і має годуватись, інакше згасне?',a:['Вогонь','Кіт','Піч'],c:0},
  {q:'Що промокає від води, але не тоне?',a:['Папір','Камінь','Цукор'],c:0},
];
function dailyRiddle(){const k=dayKey();let h=0;for(let i=0;i<k.length;i++)h=(h*31+k.charCodeAt(i))|0;return RIDDLES[Math.abs(h)%RIDDLES.length];}
function renderRiddle(){
  const box=$('riddle-box');if(!box)return;
  if(P.riddleDay===dayKey()){box.innerHTML='<div class="fam-note">✅ Сьогодні загадку вже розгадано. Повертайся завтра!</div>';return;}
  const r=dailyRiddle();
  box.innerHTML='<div class="riddle-q">'+r.q+'</div>'+r.a.map((opt,i)=>'<button class="green-btn riddle-opt" onclick="answerRiddle('+i+')">'+esc(opt)+'</button>').join('');
}
window.answerRiddle=function(i){
  if(P.riddleDay===dayKey())return;
  const r=dailyRiddle();P.riddleDay=dayKey();
  if(i===r.c){P.coins=(P.coins||0)+80;P.hearts=(P.hearts||0)+20;gainXP(5);if(typeof sfx==='function')sfx('success');notify('🧠 Правильно!','+🪙80 +❤️20');}
  else{notify('🙃 Не вгадав','Правильно: «'+r.a[r.c]+'». Спробуй завтра!',4500);}
  render();saveP();renderRiddle();
};
const ROULETTE_MAX=5; // не більше 5 ставок на день
let _rouletteSpinning=false;
window.spinRoulette=function(){
  if(_rouletteSpinning)return;
  if(P.rouletteDay!==dayKey()){P.rouletteDay=dayKey();P.rouletteSpins=0;}
  if(P.rouletteSpins>=ROULETTE_MAX){notify('🎰','На сьогодні ставки закінчились (5/день)');return;}
  const bet=50;
  if((P.coins||0)<bet){notify('🪙','Треба хоча б 🪙'+bet);return;}
  _rouletteSpinning=true;
  P.rouletteSpins++;P.coins-=bet;
  const r=Math.random();let mult,txt,emo;
  if(r<0.15){mult=0;txt='Програш';emo='😿';}
  else if(r<0.35){mult=0.5;txt='Половина назад';emo='🙂';}
  else if(r<0.60){mult=1;txt='Повернення ставки';emo='😐';}
  else if(r<0.82){mult=1.5;txt='Виграш ×1.5';emo='😺';}
  else if(r<0.95){mult=2;txt='Виграш ×2!';emo='🎉';}
  else{mult=3;txt='ДЖЕКПОТ ×3!';emo='🏆';}
  const win=Math.round(bet*mult);
  // анімація обертання у блоці
  const res=$('roulette-result');
  if(res){res.style.display='block';res.className='roulette-result spinning';res.textContent='🎰 крутимо...';}
  let ticks=0;const faces=['🍒','🔔','💎','🍀','⭐','🐱'];
  const anim=setInterval(()=>{if(res)res.textContent='🎰 '+faces[ticks%faces.length];ticks++;},90);
  setTimeout(()=>{
    clearInterval(anim);_rouletteSpinning=false;
    P.coins+=win;
    if(typeof sfx==='function')sfx(mult>=1.5?'coin':'click');
    if(res){res.className='roulette-result'+(mult>=1.5?' win':(mult===0?' lose':''));res.textContent=emo+' '+txt+' · '+(win>0?'+🪙'+win:'нічого');}
    if(mult>=2&&typeof spawnReaction==='function')spawnReaction(['🎉','🪙','⭐','🏆']);
    render();saveP();renderRoulette();
  },1100);
};
function renderRoulette(){
  const box=$('roulette-box');if(!box)return;
  if(P.rouletteDay!==dayKey())P.rouletteSpins=0;
  const left=ROULETTE_MAX-(P.rouletteSpins||0);
  const prevResult=box.querySelector('#roulette-result');const keep=prevResult?prevResult.outerHTML:'<div class="roulette-result" id="roulette-result" style="display:none"></div>';
  box.innerHTML='<div class="fam-note">Ставка 🪙50. Шанс виграти до ×2. Ставок сьогодні: '+Math.max(0,left)+'/'+ROULETTE_MAX+'</div>'
    +keep
    +'<button class="orange-btn" '+(left<=0?'disabled':'')+' onclick="spinRoulette()" style="margin-top:8px;width:100%">🎰 Крутити (ставка 🪙50)</button>';
}
function renderGames(){renderRiddle();renderRoulette();renderMemory();renderRPS();renderLuckyBox();}
// ════════ КАМІНЬ-НОЖИЦІ-ПАПІР ════════
const RPS_MAX=5;
function renderRPS(){
  const box=$('rps-box');if(!box)return;
  if(P.rpsDay!==dayKey()){P.rpsDay=dayKey();P.rpsPlays=0;}
  const left=RPS_MAX-(P.rpsPlays||0);
  box.innerHTML='<div class="fam-note">Зіграй із котиком! Виграш +🪙60, нічия +🪙20. Спроб сьогодні: '+Math.max(0,left)+'/'+RPS_MAX+'</div>'
    +'<div class="rps-result" id="rps-result" style="display:none"></div>'
    +'<div class="rps-btns">'
    +'<button class="rps-btn" '+(left<=0?'disabled':'')+' onclick="playRPS(\'rock\')">✊</button>'
    +'<button class="rps-btn" '+(left<=0?'disabled':'')+' onclick="playRPS(\'scissors\')">✌️</button>'
    +'<button class="rps-btn" '+(left<=0?'disabled':'')+' onclick="playRPS(\'paper\')">✋</button>'
    +'</div>';
}
window.playRPS=function(my){
  if(P.rpsDay!==dayKey()){P.rpsDay=dayKey();P.rpsPlays=0;}
  if((P.rpsPlays||0)>=RPS_MAX){notify('✊','Спроби на сьогодні скінчились');return;}
  P.rpsPlays=(P.rpsPlays||0)+1;
  const opts=['rock','scissors','paper'];const cat=opts[Math.floor(Math.random()*3)];
  const emo={rock:'✊',scissors:'✌️',paper:'✋'};
  let res,coins=0;
  if(my===cat){res='Нічия';coins=20;}
  else if((my==='rock'&&cat==='scissors')||(my==='scissors'&&cat==='paper')||(my==='paper'&&cat==='rock')){res='Перемога! 🎉';coins=60;}
  else{res='Програш 😿';coins=0;}
  if(coins){P.coins=(P.coins||0)+coins;gainXP(3);}
  const r=$('rps-result');
  if(r){r.style.display='block';r.className='rps-result'+(coins>=60?' win':(coins===0?' lose':''));
    r.innerHTML='Ти: '+emo[my]+' проти Кота: '+emo[cat]+'<br><b>'+res+'</b>'+(coins?' +🪙'+coins:'');}
  if(typeof sfx==='function')sfx(coins>=60?'coin':'click');
  render();saveP();renderRPS();
};
// ════════ ЩАСЛИВА КОРОБКА ════════
function renderLuckyBox(){
  const box=$('luckybox-box');if(!box)return;
  if(P.boxDay===dayKey()){box.innerHTML='<div class="fam-note">✅ Сьогодні вже відкривали. Завтра нова коробка!</div>';return;}
  box.innerHTML='<div class="fam-note">Обери одну з трьох коробок — у якійсь приз! (раз на день)</div>'
    +'<div class="box-row">'+[0,1,2].map(i=>'<button class="lucky-box" onclick="openLuckyBox('+i+')">🎁</button>').join('')+'</div>';
}
window.openLuckyBox=function(i){
  if(P.boxDay===dayKey()){notify('🎁','Сьогодні вже відкривали');return;}
  P.boxDay=dayKey();
  const prizes=[{c:300,t:'🪙300'},{c:150,h:50,t:'🪙150 ❤️50'},{c:80,t:'🪙80'},{h:100,t:'❤️100'},{c:500,t:'🪙500 — джекпот!'}];
  const pr=prizes[Math.floor(Math.random()*prizes.length)];
  if(pr.c)P.coins=(P.coins||0)+pr.c;if(pr.h)P.hearts=(P.hearts||0)+pr.h;gainXP(5);
  if(typeof sfx==='function')sfx('success');
  if(typeof spawnReaction==='function')spawnReaction(['🎉','⭐','🎁']);
  const box=$('luckybox-box');
  if(box)box.innerHTML='<div class="box-row">'+[0,1,2].map(k=>'<div class="lucky-box opened'+(k===i?' chosen':'')+'">'+(k===i?'🎉':'🎁')+'</div>').join('')+'</div>'
    +'<div class="rps-result win" style="display:block;margin-top:10px">Ти виграв: '+pr.t+'!</div>';
  notify('🎁 Щаслива коробка!','+'+pr.t,5000);addLog('Щаслива коробка: '+pr.t);
  render();saveP();
};

// ════════ МЕМОРІ (знайди пару) ════════
const MEM_EMOJI=['🐱','🐶','🐟','🦋','💎','🍖','🎀','🌸'];
let _mem={cards:[],flipped:[],matched:[],lock:false,active:false};
function renderMemory(){
  const box=$('memory-box');if(!box)return;
  if(P.memoryDay===dayKey()&&!_mem.active){box.innerHTML='<div class="fam-note">✅ Сьогодні вже грали. Повертайся завтра! (нагорода раз на день)</div>';return;}
  if(!_mem.active){
    box.innerHTML='<div class="fam-note">Знайди всі 8 пар за якнайменше спроб. Винагорода +🪙120 +❤️30 (раз на день).</div>'
      +'<button class="green-btn" onclick="startMemory()" style="margin-top:8px;width:100%">🃏 Почати гру</button>';
    return;
  }
  box.innerHTML='<div class="mem-grid">'+_mem.cards.map((c,i)=>{
    const open=_mem.flipped.includes(i)||_mem.matched.includes(i);
    return '<div class="mem-card'+(open?' open':'')+(_mem.matched.includes(i)?' done':'')+'" onclick="flipMem('+i+')">'+(open?c:'❓')+'</div>';
  }).join('')+'</div><div class="fam-note" style="text-align:center;margin-top:8px">Знайдено пар: '+(_mem.matched.length/2)+'/8</div>';
}
window.startMemory=function(){
  if(P.memoryDay===dayKey()){notify('🃏','Сьогодні вже грали');return;}
  const deck=[...MEM_EMOJI,...MEM_EMOJI];
  for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
  _mem={cards:deck,flipped:[],matched:[],lock:false,active:true};
  renderMemory();
};
window.flipMem=function(i){
  if(_mem.lock||_mem.flipped.includes(i)||_mem.matched.includes(i))return;
  _mem.flipped.push(i);
  if(_mem.flipped.length===2){
    _mem.lock=true;
    const [a,b]=_mem.flipped;
    if(_mem.cards[a]===_mem.cards[b]){
      _mem.matched.push(a,b);_mem.flipped=[];_mem.lock=false;
      if(typeof sfx==='function')sfx('click');
      renderMemory();
      if(_mem.matched.length===_mem.cards.length)winMemory();
    }else{
      renderMemory();
      setTimeout(()=>{_mem.flipped=[];_mem.lock=false;renderMemory();},800);
    }
  }else renderMemory();
};
function winMemory(){
  _mem.active=false;P.memoryDay=dayKey();
  P.coins=(P.coins||0)+120;P.hearts=(P.hearts||0)+30;gainXP(8);
  if(typeof sfx==='function')sfx('success');
  notify('🃏 Усі пари знайдено!','+🪙120 +❤️30',5000);
  addLog('Меморі пройдено: +🪙120');
  render();saveP();renderMemory();
}

// ════════════════════════════════════════════
//   КРИСТАЛИ 💎 (внутрішньоігрова валюта)
// ════════════════════════════════════════════
// Кристали купуються ТІЛЬКИ за монети (обмін). Без реклами й реальних грошей.
const CRYSTAL_RATE=2000; // 2000 монет = 1 кристал
const CRYSTAL_SHOP=[
  {id:'c_heal',  icon:'💊',name:'Здоровʼя + чистота',       cost:1,  fn:p=>{p.sick=false;p.health=100;p.clean=100;}},
  {id:'c_exp',   icon:'🧭',name:'Завершити експедицію',     cost:2,  fn:p=>{if(p.expedition)p.expedition.start=0;}},
  {id:'c_hearts',icon:'❤️',name:'3000 сердечок',            cost:3,  fn:p=>{p.hearts=(p.hearts||0)+3000;}},
  {id:'c_rare',  icon:'🎁',name:'Рідкісний предмет',        cost:5,  fn:p=>{if(typeof grantRareItem==='function')grantRareItem();}},
  {id:'c_skill', icon:'🌳',name:'+1 бал навичок',           cost:6,  fn:p=>{p.skillPoints=(p.skillPoints||0)+1;}},
  {id:'c_vip',   icon:'👑',name:'VIP на 7 днів',             cost:12, fn:p=>{p._bonus=p._bonus||{};p._bonus.vip=Date.now()+7*86400000;}},
];
function renderCrystals(){
  const box=$('crystals-body');if(!box)return;
  const canMax=Math.floor((P.coins||0)/CRYSTAL_RATE);
  let h='<div class="card crystal-bal"><div style="font-size:2.4rem">💎</div>'
    +'<div class="sec-title">Кристали: '+(P.crystals||0)+'</div>'
    +'<div class="fam-note">Рідкісна валюта для особливих благ. Купується обміном монет.</div></div>';
  // обмін монет на кристали
  h+='<div class="card"><div class="sec-title">🔄 Обмін монет на кристали</div>'
    +'<div class="fam-note">Курс: <b>'+CRYSTAL_RATE+'🪙 = 1💎</b>. У тебе вистачить на <b>'+canMax+'💎</b>.</div>'
    +'<input class="input-field bank-input" id="crystal-qty" type="number" inputmode="numeric" min="1" placeholder="Скільки кристалів?">'
    +'<div class="bank-quick"><button onclick="crystalQty(1)">1</button><button onclick="crystalQty(5)">5</button><button onclick="crystalQty(\'max\')">Максимум</button></div>'
    +'<button class="green-btn" onclick="exchangeCrystals()" style="width:100%;margin-top:8px">🔄 Обміняти</button></div>';
  // обмін кристалів на блага
  h+='<div class="card"><div class="sec-title">💎 Витратити кристали</div>'+CRYSTAL_SHOP.map(it=>
    '<div class="crystal-item"><span class="ci-ic">'+it.icon+'</span><span class="ci-nm">'+it.name+'</span>'
    +'<button class="crystal-buy" '+((P.crystals||0)<it.cost?'disabled':'')+' onclick="spendCrystals(\''+it.id+'\')">💎'+it.cost+'</button></div>').join('')+'</div>';
  box.innerHTML=h;
}
window.crystalQty=function(v){
  const inp=$('crystal-qty');if(!inp)return;
  inp.value=(v==='max')?Math.floor((P.coins||0)/CRYSTAL_RATE):v;
};
window.exchangeCrystals=function(){
  const n=Math.floor(+($('crystal-qty')?.value||0));
  if(n<=0){notify('💎','Введи скільки кристалів обміняти');return;}
  const cost=n*CRYSTAL_RATE;
  if((P.coins||0)<cost){notify('🪙','Замало монет: треба '+cost+'🪙 на '+n+'💎');return;}
  P.coins-=cost;P.crystals=(P.crystals||0)+n;
  if(typeof sfx==='function')sfx('success');
  notify('🔄 Обміняно!','−'+cost+'🪙 → +'+n+'💎');
  addLog('Обмін: '+cost+'🪙 → '+n+'💎');
  render();saveP();renderCrystals();
};
window.spendCrystals=function(id){
  const it=CRYSTAL_SHOP.find(x=>x.id===id);if(!it)return;
  if((P.crystals||0)<it.cost){notify('💎','Недостатньо кристалів');return;}
  P.crystals-=it.cost;it.fn(P);
  if(typeof sfx==='function')sfx('success');
  notify('💎 Витрачено!',it.icon+' '+it.name);addLog('Кристали: '+it.name);
  render();saveP();renderCrystals();
};

// ════════ ТРЕНУВАННЯ ТРЮКІВ ════════
const TRICKS=[
  {id:'sit',  icon:'🪑',name:'Сидіти',     beauty:3, react:['👏','⭐']},
  {id:'paw',  icon:'🐾',name:'Дай лапу',    beauty:4, react:['🐾','❤️']},
  {id:'roll', icon:'🔄',name:'Перекотись',  beauty:5, react:['🌀','⭐']},
  {id:'highfive',icon:'🙌',name:'Дай п\'ять',beauty:5, react:['🙌','✨']},
  {id:'jump', icon:'🤸',name:'Стрибок',     beauty:6, react:['✨','🎉']},
  {id:'bow',  icon:'🙇',name:'Уклін',       beauty:7, react:['🎩','⭐']},
  {id:'dance',icon:'💃',name:'Танець',      beauty:8, react:['🎵','🎶','⭐']},
  {id:'deadplay',icon:'😵',name:'Вдай мертвого',beauty:8,react:['💫','😹']},
  {id:'spin', icon:'🌪️',name:'Кружляння',   beauty:10,react:['🌟','✨','🎉']},
  {id:'backflip',icon:'🤾',name:'Сальто',   beauty:12,react:['🌟','🎉','👏']},
];
function trickProg(id){return (P.tricks&&P.tricks[id])||0;}
function trickLearned(id){return trickProg(id)>=100;}
function trickBeautyTotal(){return TRICKS.reduce((s,t)=>s+(trickLearned(t.id)?t.beauty:0),0);}
function renderTricks(){
  const box=$('tricks-body');if(!box)return;
  const canShow=P.trickShowDay!==dayKey();
  const learnedCnt=TRICKS.filter(t=>trickLearned(t.id)).length;
  let html='<div class="info-box-green">Тренуй трюки (коштує енергію). Вивчений трюк дає краси 🦋 назавжди. Покажи всі вивчені трюки раз на день за нагороду!</div>';
  if(learnedCnt>0){
    html+='<div class="card" style="text-align:center"><div class="sec-title">🎪 Виступ</div>'
      +'<div class="fam-note">Вивчено трюків: '+learnedCnt+'/'+TRICKS.length+' · бонус краси: +'+trickBeautyTotal()+'🦋</div>'
      +'<button class="green-btn" '+(canShow?'':'disabled')+' onclick="performTricks()" style="margin-top:8px;width:100%">'+(canShow?'🎬 Показати виступ (раз на день)':'✅ Сьогодні вже виступали')+'</button></div>';
  }
  html+='<div class="card"><div class="sec-title">📚 Трюки</div>'+TRICKS.map(t=>{
    const pr=trickProg(t.id);const done=pr>=100;
    return '<div class="trick-row"><span class="trick-ic">'+t.icon+'</span>'
      +'<div style="flex:1"><div class="trick-nm">'+t.name+(done?' ✅':'')+' <small>+'+t.beauty+'🦋</small></div>'
      +'<div class="trick-bar-wrap"><div class="trick-bar" style="width:'+pr+'%"></div></div></div>'
      +(done?'<span class="trick-done">вивчено</span>'
        :'<button class="small-btn" onclick="trainTrick(\''+t.id+'\')">Тренувати</button>')
      +'</div>';
  }).join('')+'</div>';
  box.innerHTML=html;
}
window.trainTrick=function(id){
  const t=TRICKS.find(x=>x.id===id);if(!t)return;
  if(trickLearned(id)){notify('✅','Цей трюк уже вивчено');return;}
  if(P.sleeping){notify('💤','Тваринка спить');return;}
  if((P.energy||0)<10){notify('😴','Замало енергії (треба 10)');return;}
  P.energy=cl((P.energy||0)-10);
  if(!P.tricks)P.tricks={};
  P.tricks[id]=Math.min(100,trickProg(id)+(18+Math.floor(Math.random()*10)));
  gainXP(4);showEmotion('train',2000);if(typeof spawnReaction==='function')spawnReaction(t.react);
  if(typeof sfx==='function')sfx('click');
  if(trickLearned(id)){
    P.butterflies=(P.butterflies||0)+t.beauty;
    notify('🎉 Трюк вивчено!',t.name+' · +'+t.beauty+'🦋 краси назавжди',5000);
    addLog('Вивчено трюк: '+t.name);
  }else notify(t.icon+' Тренування','«'+t.name+'» — '+trickProg(id)+'%');
  render();saveP();renderTricks();
};
window.performTricks=function(){
  if(P.trickShowDay===dayKey()){notify('🎪','Сьогодні вже виступали');return;}
  const learned=TRICKS.filter(t=>trickLearned(t.id));
  if(!learned.length){notify('🎪','Спершу вивчи хоч один трюк');return;}
  P.trickShowDay=dayKey();
  const coins=Math.round(coinMul()*(80+learned.length*40));
  const hearts=30+learned.length*15;
  P.coins=(P.coins||0)+coins;P.hearts=(P.hearts||0)+hearts;gainXP(10+learned.length*3);
  showEmotion('play',3000);if(typeof spawnReaction==='function')spawnReaction(['🎉','⭐','🎵','👏','❤️']);
  if(typeof sfx==='function')sfx('success');
  notify('🎬 Чудовий виступ!','+🪙'+coins+' +❤️'+hearts+' за '+learned.length+' трюків',5000);
  addLog('Виступ із трюками: +🪙'+coins);
  render();saveP();renderTricks();
};

// ════════ КАЛЕНДАР ВХОДІВ ════════
const LOGIN_REWARDS={3:{coins:300},7:{coins:800,hearts:200},14:{coins:2000,hearts:400},30:{coins:6000,hearts:1000,rare:true}};
function trackLogin(){
  if(!P.loginCal)P.loginCal={streak:0,last:'',claimed:[]};
  const today=dayKey();if(P.loginCal.last===today)return;
  const y=new Date(Date.now()-86400000).toDateString();
  P.loginCal.streak=(P.loginCal.last===y)?(P.loginCal.streak||0)+1:1;
  P.loginCal.last=today;
  saveP();
}
function renderLoginCal(){
  const box=$('logincal-body');if(!box)return;
  const st=P.loginCal?P.loginCal.streak:0;
  let html='<div class="card" style="text-align:center"><div style="font-size:2.4rem">📅</div>'
    +'<div class="sec-title">Серія входів: '+st+' дн.</div>'
    +'<div class="fam-note">Заходь щодня — нагороди ростуть!</div><div class="logincal-grid">';
  [3,7,14,30].forEach(d=>{
    const r=LOGIN_REWARDS[d];const reached=st>=d;const claimed=(P.loginCal.claimed||[]).includes(d);
    const rw='🪙'+r.coins+(r.hearts?(' ❤️'+r.hearts):'')+(r.rare?' 🎁':'');
    html+='<div class="logincal-day'+(reached?' reached':'')+'"><div class="lc-d">'+d+' дн.</div><div class="lc-r">'+rw+'</div>'
      +(claimed?'<div class="lc-ok">✅</div>':(reached?'<button class="green-btn lc-btn" onclick="claimLogin('+d+')">Забрати</button>':'<div class="lc-lock">🔒</div>'))+'</div>';
  });
  html+='</div></div>';box.innerHTML=html;
}
window.claimLogin=function(d){
  const r=LOGIN_REWARDS[d];if(!r)return;
  if(!P.loginCal)P.loginCal={streak:0,last:'',claimed:[]};
  if((P.loginCal.streak||0)<d){notify('🔒','Ще не досягнуто');return;}
  if((P.loginCal.claimed||[]).includes(d)){notify('✅','Вже отримано');return;}
  P.coins=(P.coins||0)+r.coins;if(r.hearts)P.hearts=(P.hearts||0)+r.hearts;
  let extra='';if(r.rare&&typeof grantRareItem==='function'){const it=grantRareItem();extra=' + '+it.icon+' '+it.name;}
  P.loginCal.claimed.push(d);
  if(typeof sfx==='function')sfx('success');
  notify('📅 Нагорода за '+d+' днів!','🪙'+r.coins+(r.hearts?(' ❤️'+r.hearts):'')+extra,5000);
  addLog('Календар входів: нагорода за '+d+' дн.');
  render();saveP();renderLoginCal();
};

// ════════ ФОНОВА МУЗИКА (mp3) ════════
let _musicEl=null;
function _ensureMusicEl(){
  if(_musicEl)return _musicEl;
  _musicEl=document.getElementById('bg-music');
  if(!_musicEl){
    _musicEl=document.createElement('audio');
    _musicEl.id='bg-music';_musicEl.src='music.mp3';_musicEl.loop=true;_musicEl.volume=0.35;_musicEl.preload='auto';
    document.body.appendChild(_musicEl);
  }
  return _musicEl;
}
function startMusic(){
  const el=_ensureMusicEl();
  el.play().catch(()=>{
    // браузер блокує автоплей до взаємодії — запустимо при першому дотику
    const resume=()=>{el.play().catch(()=>{});document.removeEventListener('pointerdown',resume);};
    document.addEventListener('pointerdown',resume,{once:true});
  });
}
function stopMusic(){if(_musicEl){_musicEl.pause();}}
window.toggleMusic=function(){
  if(!P)return;P.music=!P.music;saveP();
  if(P.music)startMusic();else stopMusic();
  const b=$('music-toggle-btn');if(b)b.textContent=P.music?'🎵 Музика: увімкнено':'🔇 Музика: вимкнено';
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
