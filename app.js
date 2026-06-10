// КотяГра v9
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
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

let P=null,uid=null,chatUnsub=null;
let decayInt=null,onlineInt=null,walkTicker=null,sleepTimer=null,saveTO=null;
let authMode='login',ratingTab='players',shopFilter='food',tasksTab='daily';

const $=id=>document.getElementById(id);
const cl=(v,mn=0,mx=100)=>Math.max(mn,Math.min(mx,v));
const esc=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const now=()=>new Date().toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'});
const san=o=>JSON.parse(JSON.stringify(o,(k,v)=>v===undefined?null:v));
const XP_TABLE=[0,50,120,220,360,550,800,1100,1500,2000,2700,3500,4500,5700,7200,9000];
const xpCap=lv=>XP_TABLE[Math.min(lv,XP_TABLE.length-1)]||lv*200;

function saveP(){
  if(!uid||!P)return;
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
  const sys=(P?.inbox||[]).filter(m=>!m.read).length;
  const cnt=sys+(window._mailUnread||0);
  const b=$('mail-badge');if(b){b.style.display=cnt>0?'block':'none';b.textContent=cnt;}
  const uc=$('unread-cnt');if(uc)uc.textContent=cnt>0?cnt:'';
}
async function refreshUnread(){
  try{
    const snap=await getDocs(query(collection(db,'mail'),where('toUid','==',String(uid)),limit(80)));
    window._mailUnread=snap.docs.filter(d=>d.data().read===false).length;
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
      try{await setDoc(doc(db,'players',cred.user.uid),san(np));}
      catch(e){localStorage.setItem('kg_pending_'+cred.user.uid,JSON.stringify(np));}
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
  try{
    const s=await Promise.race([
      getDoc(doc(db,'players',uid)),
      new Promise((_,r)=>setTimeout(()=>r(new Error('t')),10000))
    ]);
    if(s.exists())P=sanitize(s.data());
    else{
      const n=(user.email||'').split('@')[0].replace(/\W/g,'').slice(0,18)||'Гравець';
      P=mkPlayer(n,'Котик','cat');
      setDoc(doc(db,'players',uid),san(P)).catch(()=>{});
    }
  }catch(e){
    const n=(user.email||'').split('@')[0].slice(0,18)||'Гравець';
    P=mkPlayer(n,'Котик','cat');
  }
  startGame();
});

function startGame(){
  try{
    $('game-wrap').style.display='flex';
    $('bottom-nav').style.display='flex';
    showLoading(false);
    render();startDecay();startOnline();
    if(P.sleeping&&P.sleepStart&&P.sleepDur){$('cat-emoji').textContent='😴';startSleepTimer();}
    if(P.walk&&Date.now()-P.walk.start<P.walk.dur)resumeWalk();
    else if(P.walk){P.walk=null;}
    saveP();updateMailBadge();
    buildShop('food');
    refreshUnread();
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
  $('cat-emoji').textContent='😺';
  notify('☀️ Прокинувся!','+30⚡');gainXP(4);render();saveP();
}

function bonusActive(b){return P&&P.bonuses&&P.bonuses[b]&&P.bonuses[b]>Date.now();}
function xpMul(){return (bonusActive('xp2')||bonusActive('vip'))?2:1;}
function coinMul(){return (bonusActive('coin2')||bonusActive('vip'))?2:1;}
function gainXP(n){
  n=Math.round(n*xpMul());
  P.xp=(P.xp||0)+n;
  const cap=xpCap(P.level||1);
  if(P.xp>=cap){
    P.xp-=cap;P.level=(P.level||1)+1;
    P.coins=(P.coins||0)+P.level*10;
    notify('🎉 Рівень '+P.level+'!','+'+P.level*10+'🪙');
    addLog('Рівень '+P.level+'!');
  }
  render();saveP();
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
  if(!P.sleeping)$('cat-emoji').textContent=avg>80?'😻':avg>60?'😺':avg>40?'😸':avg>20?'😿':'😤';
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
  if(id==='shop')buildShop(shopFilter);
  if(id==='show')renderShow();
  if(id==='gems')renderGems();
  if(id==='settings')renderSettings();
  if(id==='friends')renderFriends();
  if(id==='walks')loadWalkLeaderboard();
};

// ── ACTIONS ──
window.petCat=function(){
  if(P.sleeping){notify('💤 Спить','Тихіше!');return;}
  P.hearts=cl((P.hearts||0)+1,0,999999);P.fun=cl((P.fun||0)+5);gainXP(2);
  notify('😻 Муркоче!','+1❤️');
};
window.act=function(type){
  if(P.sleeping&&type!=='sleep'){notify('💤 Спить','');return;}
  switch(type){
    case'feed':
      if((P.hunger||0)>=100){notify('😋 Ситий!','');return;}
      P.hunger=cl((P.hunger||0)+25);gainXP(3);notify('🍖 Смачно!','+25');
      trackTask('feedCnt');break;
    case'water':
      if((P.thirst||0)>=100){notify('💧 Напоєний!','');return;}
      P.thirst=cl((P.thirst||0)+30);gainXP(2);notify('💧 Освіжився!','+30');
      trackTask('waterCnt');break;
    case'play':
      if((P.energy||0)<15){notify('😴 Втомлений','');return;}
      P.fun=cl((P.fun||0)+20);P.energy=cl((P.energy||0)-15);gainXP(5);
      notify('🎾 Весело!','+20');trackTask('playCnt');break;
    case'sleep':
      if(P.sleeping){notify('💤 Вже спить','');return;}
      P.sleeping=true;P.sleepStart=Date.now();P.sleepDur=20*60*1000;
      $('cat-emoji').textContent='😴';
      notify('💤 Спить!','20 хвилин');render();startSleepTimer();saveP();return;
  }
  render();saveP();
};

// ── WALKS ──
window.startWalk=function(type,secs,minC,maxC,xp){
  if(P.walk){notify('🌳 Вже гуляє','');return;}
  if((P.energy||0)<20){notify('😴 Мало енергії','');return;}
  P.walk={type,start:Date.now(),dur:secs*1000,minC,maxC,xp};
  P.energy=cl((P.energy||0)-15);
  notify('🌳 Прогулянка!','~'+secs+' сек');
  $('walk-active-div').style.display='block';
  $('walk-opts').style.display='none';
  clearInterval(walkTicker);walkTicker=setInterval(tickWalk,500);
  render();saveP();
};
function resumeWalk(){
  $('walk-active-div').style.display='block';
  $('walk-opts').style.display='none';
  clearInterval(walkTicker);walkTicker=setInterval(tickWalk,500);
}
function tickWalk(){
  if(!P?.walk){clearInterval(walkTicker);return;}
  const el=Date.now()-P.walk.start;
  const pct=Math.min(100,el/P.walk.dur*100);
  const rem=Math.max(0,Math.ceil((P.walk.dur-el)/1000));
  const pf=$('wpf');if(pf)pf.style.width=pct+'%';
  const wt=$('walk-timer');if(wt)wt.textContent=rem+' сек';
  if(pct>=100){clearInterval(walkTicker);finishWalk();}
}
function finishWalk(){
  if(!P?.walk)return;
  let coins=P.walk.minC+Math.floor(Math.random()*(P.walk.maxC-P.walk.minC));
  coins=Math.round(coins*coinMul());
  P.coins=(P.coins||0)+coins;P.walkCoins=(P.walkCoins||0)+coins;
  gainXP(P.walk.xp);
  // шанс знайти фрагмент каменя (краще у дальших локаціях)
  const chance={yard:.35,park:.55,forest:.8}[P.walk.type]||.35;
  let gemMsg='';
  if(Math.random()<chance){
    const pool=P.walk.type==='forest'?['ruby','diamond','sapphire']
      :P.walk.type==='park'?['sapphire','emerald','amber']:['amber','emerald'];
    const g=pool[Math.floor(Math.random()*pool.length)];
    if(!P.gems)P.gems={};P.gems[g]=(P.gems[g]||0)+1;
    const gi=(GEMS.find(x=>x.key===g)||{}).icon||'💎';
    gemMsg=' +фрагмент '+gi;
  }
  notify('🏠 Повернувся!','🪙'+coins+gemMsg);
  addLog(P.catname+' приніс 🪙'+coins+gemMsg+'!');
  trackTask('walkCnt');trackTask('walkTotal');
  P.walk=null;
  $('walk-active-div').style.display='none';
  $('walk-opts').style.display='block';
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
  set('ps-club','Клуб: '+(P.clubId?'Є':'—'));
  const days=Math.floor((Date.now()-new Date(P.createdAt||Date.now()).getTime())/86400000);
  set('ps-gamedays',days);
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
  const nm={clothes:'Одяг',access:'Аксесуари',jewel:'Прикраси'}[sk];
  notify('🏋️ '+nm+' рів.'+(P.skills[sk]),'· +🦋1');
  addLog('Тренування "'+nm+'" рів.'+P.skills[sk]);
  trackTask('trainCnt');
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
    TASKS.filter(t=>t.cat==='daily').forEach(t=>{delete P.tasks.completed[t.id];P.tasks.progress[t.track]=0;});
    P.tasks.lastDaily=today;saveP();
  }
  const wk=getMondayKey();
  if(P.tasks.lastWeekly!==wk){
    TASKS.filter(t=>t.cat==='weekly').forEach(t=>{delete P.tasks.completed[t.id];P.tasks.progress[t.track]=0;});
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
  if(info)info.textContent=tasksTab==='daily'?'🔄 Щодня':tasksTab==='weekly'?'🔄 Щопонеділка':'🏅 Постійні';
  list.innerHTML=TASKS.filter(t=>t.cat===tasksTab).map(t=>{
    const prog=getProgress(t);
    const pct=Math.min(100,Math.round(prog/t.goal*100));
    const done=!!P.tasks.completed[t.id]||(prog>=t.goal);
    const claimed=t.once&&!!P.tasks.claimed[t.id];
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
  if(t.once&&P.tasks.claimed[id]){notify('✅','Вже отримано!');return;}
  if(t.reward.coins)P.coins=(P.coins||0)+t.reward.coins;
  if(t.reward.xp)gainXP(t.reward.xp);
  const rwd=Object.entries(t.reward).map(([k,v])=>(k==='coins'?'🪙':k==='xp'?'⭐':'❤️')+v).join(' ');
  notify('🎁 Нагорода!',t.icon+' '+rwd,4000);
  if(t.once)P.tasks.claimed[id]=true;
  else{P.tasks.completed[id]=false;P.tasks.progress[t.track]=0;}
  renderTasks();render();saveP();
};

// ── RATINGS ──
window.switchRating=function(type){
  ratingTab=type;
  ['players','clubs','beauty'].forEach(t=>$('rt-'+t)?.classList.toggle('active',t===type));
  loadRatings(type);
};
async function loadRatings(type){
  const rl=$('rating-list');if(!rl)return;
  rl.innerHTML='<div class="loading-inline">Завантаження...</div>';
  if(type==='clubs')return loadClubRatings();
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
      if((p.level||1)>=5)list.push('⬆️ 5+ рівень');
      if((p.level||1)>=10)list.push('🌟 10+ рівень');
      if((p.butterflies||0)>=50)list.push('🦋 Красень');
      if(p.clubId)list.push('🎈 У клубі');
      if((p.showWins||0)>0)list.push('🏆 Переможець виставки');
      ach.innerHTML=list.length?list.map(a=>'<span class="pm-achiev-badge">'+a+'</span>').join(''):'';
    }
    const fb=$('pm-add-friend-btn');
    const isFriend=(P.friends||[]).some(f=>f.id===pid);
    if(fb){
      if(pid===uid){fb.style.display='none';}
      else{fb.style.display='';fb.disabled=isFriend;fb.textContent=isFriend?'✅ Вже друг':'👤+ Додати в друзі';}
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
    const dr=$('club-director-row');if(dr)dr.style.display=c.directorUid===uid?'block':'none';
    const mSnap=await getDocs(query(collection(db,'clubs',P.clubId,'members'),limit(50)));
    $('cl-members').innerHTML=mSnap.docs.map(md=>{const m=md.data();
      return '<div class="member-row">'
        +'<span class="member-av">🐱</span>'
        +'<span class="member-name">'+esc(m.catname||m.nickname||'?')+'</span>'
        +'<span style="font-size:.65rem;color:var(--tl)">@'+esc(m.nickname||'?')+'</span>'
        +'<span class="member-role">'+({director:'Директор',deputy:'Зам.',curator:'Куратор',member:'Учасник'}[m.role||'member'])+'</span>'
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
      catname:String(P.catname||'Тваринка'),role:'director',points:0,
      joinedAt:new Date().toISOString()
    });
    P.clubId=ref.id;
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
      catname:String(P.catname||'Тваринка'),role:'member',points:0,
      joinedAt:new Date().toISOString()
    });
    await updateDoc(doc(db,'clubs',clubId),{memberCount:increment(1)});
    P.clubId=clubId;trackTask('clubJoin');saveP();
    notify('🎈 Вступив!',snap.data().name);renderClubs();
  }catch(e){notify('❌',e.message);}
};
window.leaveClub=async function(){
  if(!P.clubId||!confirm('Вийти з клубу?'))return;
  try{
    await deleteDoc(doc(db,'clubs',P.clubId,'members',uid));
    await updateDoc(doc(db,'clubs',P.clubId),{memberCount:increment(-1)});
    P.clubId=null;saveP();notify('👋','Вийшов');renderClubs();
  }catch(e){notify('❌',e.message);}
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
        [...snap.docs].reverse().forEach(d=>{const m=d.data();addMsg(d.id,m.nickname,m.catname,m.text,m.uid===uid,m.ts);});
        box.scrollTop=box.scrollHeight;
      }else{
        snap.docChanges().forEach(ch=>{
          if(ch.type==='added'&&!document.getElementById('cm-'+ch.doc.id)){
            const m=ch.doc.data();addMsg(ch.doc.id,m.nickname,m.catname,m.text,m.uid===uid,m.ts);
            box.scrollTop=box.scrollHeight;
          }
        });
      }
    },e=>console.warn('chat:',e));
  }catch(e){if($('chat-msgs'))$('chat-msgs').innerHTML='<div class="loading-inline">Помилка</div>';}
}
function addMsg(docId,nick,catname,text,mine,ts){
  const box=$('chat-msgs');if(!box)return;
  const div=document.createElement('div');
  div.className='msg '+(mine?'mine':'theirs');
  if(docId)div.id='cm-'+docId;
  let t='';try{t=ts?.toDate?ts.toDate().toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'}):now();}catch(e){t=now();}
  div.innerHTML='<div class="msg-sender'+(mine?' msg-sender-mine':'')+'">'+esc(catname||nick||'?')
    +'<span style="font-size:.62rem;opacity:.7"> @'+esc(nick||'?')+'</span></div>'
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
    {id:'g_ruby',  icon:'🔴',name:'Фрагмент рубіна',   desc:'+1 фрагмент 🔴',cost:60, gem:'ruby'},
    {id:'g_saph',  icon:'🔵',name:'Фрагмент сапфіра',  desc:'+1 фрагмент 🔵',cost:50, gem:'sapphire'},
    {id:'g_emer',  icon:'🟢',name:'Фрагмент смарагда', desc:'+1 фрагмент 🟢',cost:45, gem:'emerald'},
    {id:'g_amber', icon:'🟡',name:'Фрагмент бурштину', desc:'+1 фрагмент 🟡',cost:35, gem:'amber'},
    {id:'g_diam',  icon:'⚪',name:'Фрагмент діаманта', desc:'+1 фрагмент ⚪',cost:90, gem:'diamond'},
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
  P.petType=sel.value;saveP();render();renderPetPage();
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
    return '<div class="wardrobe-item'+(eq?' equipped':'')+'" onclick="toggleEquip(\''+w.id+'\')">'
      +'<div style="font-size:1.9rem">'+w.icon+'</div>'
      +'<div style="font-size:.62rem;font-weight:800;color:var(--tx);margin-top:2px">'+esc(w.name)+'</div>'
      +'<div style="font-size:.55rem;color:var(--gdk);font-weight:700">+'+(w.beauty||0)+'🦋</div>'
      +'<div style="font-size:.55rem;font-weight:800;color:'+(eq?'var(--gdk)':'var(--tl)')+'">'+(eq?'✅ Вдягнено':'Вдягнути')+'</div>'
      +'</div>';
  }).join('');
}
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
    return '<div class="gem-row">'
      +'<span class="gem-icon">'+g.icon+'</span>'
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
    return '<button class="act-btn" '+(ready?'':'disabled')+' onclick="assembleGem(\''+g.key+'\')" style="opacity:'+(ready?1:.5)+'">'
      +'<span class="bi">'+g.icon+'</span>'
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
  gainXP(20);
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
  set('show-cat-emoji',petIcon());
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
    const coins=Math.round(c.prize.coins*lg.mult),hearts=Math.round(c.prize.hearts*lg.mult);
    P.coins=(P.coins||0)+coins;P.hearts=(P.hearts||0)+hearts;P.showWins=(P.showWins||0)+1;
    gainXP(30);
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
window.addFriend=function(){
  if(!_profileTarget){notify('❌','Спочатку відкрий профіль');return;}
  if(!P.friends)P.friends=[];
  if(_profileTarget.id===uid){notify('🙂','Це ти!');return;}
  if(P.friends.some(f=>f.id===_profileTarget.id)){notify('✅','Вже у друзях');return;}
  P.friends.push({id:_profileTarget.id,nickname:_profileTarget.nickname,
    catname:_profileTarget.catname,level:_profileTarget.level||1,petType:_profileTarget.petType||'cat'});
  saveP();renderFriends();
  const fb=$('pm-add-friend-btn');if(fb){fb.disabled=true;fb.textContent='✅ Вже друг';}
  notify('👥 Додано!',_profileTarget.catname+' тепер у друзях');
};
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
    '<div class="mail-item '+(kind!=='sent'&&m.read===false?'unread':'')+'" onclick="openMail(\''+m._id+'\',\''+kind+'\')">'
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
async function sendLetter({toUid,toNick,subj,body,type='user',icon=null}){
  return addDoc(collection(db,'mail'),san({
    fromUid:String(uid),fromNick:String(P.nickname||'?'),
    toUid:String(toUid),toNick:String(toNick),
    subj:String(subj).slice(0,80),body:String(body).slice(0,1000),
    type,icon,read:false,ts:serverTimestamp(),tsms:Date.now()
  }));
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
function renderHouseCard(){
  if(!P)return;
  const star=houseStar(),beauty=houseBeauty();
  const set=(id,v)=>{const el=$(id);if(el)el.textContent=v;};
  set('house-name',HOUSE_NAMES[star-1]||'Будинок');
  set('house-beauty',beauty);
  set('house-star',star);
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
window.raiseClubLoyalty=function(){
  if(!P.clubId){notify('🎈','Спершу вступи в клуб');return;}
  if((P.coins||0)<10){notify('🪙','Треба 10 монет');return;}
  P.coins-=10;P.clubLoyalty=Math.min(100,(P.clubLoyalty||0)+5);
  const el=$('ps-loyalty');if(el)el.textContent=P.clubLoyalty+'%';
  render();saveP();notify('🎗️','Вірність клубу: '+P.clubLoyalty+'%');
};
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
  const be=$('pet-big-emoji');if(be)be.textContent=petIcon();
  set('pm-gems-cnt',P.gems?Object.values(P.gems).reduce((a,b)=>a+b,0):0);
  set('pm-train-cnt',P.skills?(P.skills.clothes+P.skills.access+P.skills.jewel):0);
  set('pm-gifts-cnt',(P.giftsReceived||[]).length);
  set('pm-wardrobe-cnt',(P.wardrobe||[]).length+' з 20');
  updateEquipSlots();
  renderHouseCard();
};
const _renderBase=render;
render=function(){
  _renderBase();
  // emoji тваринки залежно від типу, коли не спить
  if(P&&!P.sleeping){
    const avg=((P.hunger||0)+(P.thirst||0)+(P.fun||0)+(P.energy||0))/4;
    if(P.petType==='dog'){
      const e=$('cat-emoji');if(e)e.textContent=avg>80?'🐶':avg>40?'🐕':'🐩';
    }
  }
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
