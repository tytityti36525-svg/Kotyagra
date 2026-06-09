// КотяГра v9
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection,
  query, limit, onSnapshot, addDoc, getDocs,
  serverTimestamp, where, increment, deleteDoc, updateDoc, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const _k=["AIzaSyB0","XJ50di5q","f45qBC23","QKMuZJQo","rS593S0"].join("");
const FB={
  apiKey:_k,
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
  const cnt=(P?.inbox||[]).filter(m=>!m.read).length;
  const b=$('mail-badge');if(b){b.style.display=cnt>0?'block':'none';b.textContent=cnt;}
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

function gainXP(n){
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
  const coins=P.walk.minC+Math.floor(Math.random()*(P.walk.maxC-P.walk.minC));
  P.coins=(P.coins||0)+coins;P.walkCoins=(P.walkCoins||0)+coins;
  gainXP(P.walk.xp);notify('🏠 Повернувся!','🪙'+coins);
  addLog(P.catname+' приніс 🪙'+coins+'!');
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
    return '<div class="task-card'+(done&&!claimed?' task-done':'')+(claimed?' task-claimed':'\')+'">'
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
  try{
    const snap=await getDocs(collection(db,'players'));
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
window.openProfile=async function(pid){
  try{
    const snap=await getDoc(doc(db,'players',pid));
    if(!snap.exists())return;
    const p=snap.data();
    alert('🐱 '+esc(p.catname||'Тваринка')+'\n@'+esc(p.nickname||'?')+'\nРівень: '+(p.level||1)+'\n🦋 Краса: '+(p.butterflies||0));
  }catch(e){}
};

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
  alert((msg.from||'?')+'\n\n'+(msg.subj||'')+'\n\n'+(msg.body||''));
  saveP();updateMailBadge();renderMail();
};

// ── SHOP ──
const SHOP={
  food:[
    {id:'fish',icon:'🐟',name:'Рибка',desc:'+30🍖',cost:8,fn:()=>{P.hunger=cl((P.hunger||0)+30);}},
    {id:'milk',icon:'🥛',name:'Молоко',desc:'+20💧',cost:5,fn:()=>{P.thirst=cl((P.thirst||0)+20);}},
    {id:'cake',icon:'🎂',name:'Тортик',desc:'+40🍖+20😊',cost:15,fn:()=>{P.hunger=cl((P.hunger||0)+40);P.fun=cl((P.fun||0)+20);}},
    {id:'energy',icon:'⚡',name:'Енергетик',desc:'+40⚡',cost:20,fn:()=>{P.energy=cl((P.energy||0)+40);}},
  ]
};
window.filterShop=function(cat){
  shopFilter=cat;
  document.querySelectorAll('.shop-cat-btn').forEach(b=>b.classList.toggle('active',b.dataset.cat===cat));
  buildShop(cat);
};
function buildShop(cat){
  const c=$('shop-items');if(!c)return;
  c.innerHTML=(SHOP[cat]||[]).map(item=>
    '<div class="shop-item-card">'
      +'<span class="si-icon">'+item.icon+'</span>'
      +'<div class="si-info"><div class="si-name">'+item.name+'</div><div class="si-desc">'+item.desc+'</div></div>'
      +'<button class="si-buy" '+((P?.coins||0)<item.cost?'disabled':'')+' onclick="buyItem(\''+item.id+'\',\''+cat+'\')">🪙'+item.cost+'</button>'
    +'</div>'
  ).join('');
}
window.buyItem=function(id,cat){
  const item=(SHOP[cat]||[]).find(i=>i.id===id);if(!item)return;
  if((P.coins||0)<item.cost){notify('🪙','Мало монет!');return;}
  P.coins-=item.cost;item.fn();gainXP(3);
  notify('✅ Куплено!',item.name);render();saveP();buildShop(cat);
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
