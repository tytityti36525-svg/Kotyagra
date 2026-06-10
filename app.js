// КотяГра v9
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection,
  query, limit, onSnapshot, addDoc, getDocs,
  serverTimestamp, where, increment, deleteDoc, updateDoc, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const FB={
  apiKey:"AIza"+"SyB0XJ50di5qf45qBC23QKMuZJQorS593S0",
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
  if(id==='pet'){renderPetPage();renderHouseCard();}
  if(id==='train')renderTrain();
  if(id==='tasks'){initTasks();renderTasks();}
  if(id==='shop')buildShop(shopFilter);
  if(id==='show')window.renderShow&&window.renderShow();
  if(id==='gems')renderGems&&renderGems();
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
const SHOP={
  food:[
    {id:'fish',   icon:'🐟',name:'Рибка',       desc:'+30🍖',         cost:8,  fn:()=>{P.hunger=cl((P.hunger||0)+30);}},
    {id:'milk',   icon:'🥛',name:'Молоко',       desc:'+20💧',         cost:5,  fn:()=>{P.thirst=cl((P.thirst||0)+20);}},
    {id:'meat',   icon:'🥩',name:'М'ясо',       desc:'+50🍖',         cost:14, fn:()=>{P.hunger=cl((P.hunger||0)+50);}},
    {id:'juice',  icon:'🧃',name:'Сік',          desc:'+35💧',         cost:9,  fn:()=>{P.thirst=cl((P.thirst||0)+35);}},
    {id:'cake',   icon:'🎂',name:'Тортик',       desc:'+40🍖 +20😊',   cost:15, fn:()=>{P.hunger=cl((P.hunger||0)+40);P.fun=cl((P.fun||0)+20);}},
    {id:'sushi',  icon:'🍣',name:'Суші',         desc:'+35🍖 +15💧',   cost:18, fn:()=>{P.hunger=cl((P.hunger||0)+35);P.thirst=cl((P.thirst||0)+15);}},
    {id:'energy', icon:'⚡',name:'Енергетик',    desc:'+40⚡',         cost:20, fn:()=>{P.energy=cl((P.energy||0)+40);}},
    {id:'honey',  icon:'🍯',name:'Мед',          desc:'+20🍖 +30😊',   cost:12, fn:()=>{P.hunger=cl((P.hunger||0)+20);P.fun=cl((P.fun||0)+30);}},
    {id:'feast',  icon:'🍱',name:'Бенкет',       desc:'+70🍖 +40💧',   cost:35, fn:()=>{P.hunger=cl((P.hunger||0)+70);P.thirst=cl((P.thirst||0)+40);}},
  ],
  clothes:[
    {id:'bow',    icon:'🎀',name:'Бантик',       desc:'+2🦋 шафа',     cost:40, fn:()=>{addWardrobe({id:'bow',icon:'🎀',name:'Бантик',type:'shirt',beauty:2});}},
    {id:'ribbon', icon:'🎗️',name:'Стрічка',      desc:'+3🦋 шафа',     cost:60, fn:()=>{addWardrobe({id:'ribbon',icon:'🎗️',name:'Стрічка',type:'shirt',beauty:3});}},
    {id:'vest',   icon:'🧥',name:'Жилетка',      desc:'+4🦋 шафа',     cost:80, fn:()=>{addWardrobe({id:'vest',icon:'🧥',name:'Жилетка',type:'shirt',beauty:4});}},
    {id:'cape',   icon:'🦸',name:'Плащ',         desc:'+5🦋 шафа',     cost:110,fn:()=>{addWardrobe({id:'cape',icon:'🦸',name:'Плащ',type:'shirt',beauty:5});}},
    {id:'crown_c',icon:'👸',name:'Коронна сукня',desc:'+8🦋 шафа',     cost:180,fn:()=>{addWardrobe({id:'crown_c',icon:'👸',name:'Коронна сукня',type:'shirt',beauty:8});}},
  ],
  accessories:[
    {id:'hat_basic',  icon:'🎩',name:'Капелюх',  desc:'+2🦋 шафа',     cost:45, fn:()=>{addWardrobe({id:'hat_basic',icon:'🎩',name:'Капелюх',type:'hat',beauty:2});}},
    {id:'glasses',    icon:'🕶️',name:'Окуляри',  desc:'+3🦋 шафа',     cost:55, fn:()=>{addWardrobe({id:'glasses',icon:'🕶️',name:'Окуляри',type:'hat',beauty:3});}},
    {id:'collar_g',   icon:'📿',name:'Намисто',   desc:'+4🦋 шафа',     cost:70, fn:()=>{addWardrobe({id:'collar_g',icon:'📿',name:'Намисто',type:'collar',beauty:4});}},
    {id:'ring_basic', icon:'💍',name:'Каблучка',  desc:'+3🦋 шафа',     cost:65, fn:()=>{addWardrobe({id:'ring_basic',icon:'💍',name:'Каблучка',type:'ring',beauty:3});}},
    {id:'crown_a',    icon:'👑',name:'Корона',    desc:'+7🦋 шафа',     cost:150,fn:()=>{addWardrobe({id:'crown_a',icon:'👑',name:'Корона',type:'hat',beauty:7});}},
  ],
  gems:[
    {id:'gem_frag_r', icon:'🔴',name:'Рубін (ч.)', desc:'+1 рубін',     cost:30, fn:()=>{addGemFrag('ruby');}},
    {id:'gem_frag_b', icon:'🔵',name:'Сапфір (ч.)',desc:'+1 сапфір',    cost:30, fn:()=>{addGemFrag('sapphire');}},
    {id:'gem_frag_g', icon:'🟢',name:'Смарагд (ч.)',desc:'+1 смарагд',  cost:30, fn:()=>{addGemFrag('emerald');}},
    {id:'gem_frag_y', icon:'🟡',name:'Цитрин (ч.)', desc:'+1 цитрин',   cost:25, fn:()=>{addGemFrag('citrine');}},
  ],
  bonuses:[
    {id:'coin2x',  icon:'🪙',name:'Подвійні монети',desc:'x2 монети 10хв',cost:50, fn:()=>{activateBonus('coin2x',10*60*1000);}},
    {id:'xp2x',   icon:'⭐',name:'Подвійний досвід',desc:'x2 XP 10хв',  cost:50, fn:()=>{activateBonus('xp2x',10*60*1000);}},
    {id:'happy',  icon:'😻',name:'Щастя',           desc:'+50 до всього',cost:40, fn:()=>{P.hunger=cl((P.hunger||0)+50);P.thirst=cl((P.thirst||0)+50);P.fun=cl((P.fun||0)+50);P.energy=cl((P.energy||0)+50);}},
    {id:'beauty_boost',icon:'🦋',name:'Краса-буст',desc:'+10🦋 одразу', cost:100,fn:()=>{P.butterflies=(P.butterflies||0)+10;P.glamour=(P.glamour||0)+10;}},
  ],
};
function addWardrobe(item){
  if(!P.wardrobe)P.wardrobe=[];
  if(P.wardrobe.length>=20){notify('👗','Шафа повна! Max 20 речей');return;}
  P.wardrobe.push({...item,acquired:new Date().toISOString()});
  P.butterflies=(P.butterflies||0)+item.beauty;
  notify('👗 Куплено!',item.icon+' '+item.name+' +'+item.beauty+'🦋');
}
function addGemFrag(type){
  if(!P.gems)P.gems={ruby:0,sapphire:0,emerald:0,citrine:0,diamond:0};
  P.gems[type]=(P.gems[type]||0)+1;
  notify('💎 Фрагмент!',type);
}
function activateBonus(id,dur){
  if(!P.bonuses)P.bonuses={};
  P.bonuses[id]={expires:Date.now()+dur};
  notify('🎁 Бонус!',id+' активовано');
}
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

// ══ GEMS (LARETZ) ══
const GEM_DEFS={
  ruby:    {icon:'🔴',name:'Рубін',   reward:{coins:80, hearts:200,beauty:5}, color:'#e74c3c'},
  sapphire:{icon:'🔵',name:'Сапфір', reward:{coins:100,xp:50,    beauty:6}, color:'#3498db'},
  emerald: {icon:'🟢',name:'Смарагд',reward:{coins:120,hearts:300,beauty:7}, color:'#2ecc71'},
  citrine: {icon:'🟡',name:'Цитрин', reward:{coins:60, xp:30,    beauty:3}, color:'#f39c12'},
  diamond: {icon:'⬜',name:'Діамант',reward:{coins:300,hearts:500,beauty:15},color:'#95a5a6'},
};
function renderGems(){
  if(!P)return;
  if(!P.gems)P.gems={ruby:0,sapphire:0,emerald:0,citrine:0,diamond:0};
  const list=$('gem-list');
  if(list){
    list.innerHTML=Object.entries(GEM_DEFS).map(([key,g])=>{
      const count=P.gems[key]||0;
      const pct=Math.min(100,Math.round(count/5*100));
      return '<div class="gem-row">'
        +'<span style="font-size:1.6rem">'+g.icon+'</span>'
        +'<div style="flex:1;margin:0 10px">'
          +'<div style="font-size:.8rem;font-weight:900;color:var(--gdk)">'+g.name
            +' <span style="color:var(--tl);font-size:.65rem;font-weight:700">'+count+'/5</span></div>'
          +'<div class="gem-mini-bar-wrap"><div class="gem-mini-bar" style="width:'+pct+'%;background:'+g.color+'"></div></div>'
        +'</div>'
        +'<span style="font-size:.72rem;font-weight:800;color:var(--tl)">×'+count+'</span>'
        +'</div>';
    }).join('');
  }
  const asm=$('gem-assemble');
  if(asm){
    asm.innerHTML=Object.entries(GEM_DEFS).map(([key,g])=>{
      const count=P.gems[key]||0;
      const can=count>=5;
      return '<button class="act-btn" style="opacity:'+(can?1:.4)+'" '+(can?'onclick="assembleGem(\''+key+'\')"':'disabled')+'>'
        +'<span class="bi">'+g.icon+'</span>'
        +'<span class="bl">'+g.name+'</span>'
        +'<span class="bc">'+(can?'✅ Зібрати!':'×'+count+'/5')+'</span>'
        +'</button>';
    }).join('');
  }
  const sum=$('gem-sum');
  if(sum)sum.textContent=Object.entries(P.gems||{}).map(([k,v])=>(GEM_DEFS[k]?.icon||'?')+'×'+v).join('  ');
}
window.assembleGem=function(key){
  if(!P.gems)P.gems={ruby:0,sapphire:0,emerald:0,citrine:0,diamond:0};
  if((P.gems[key]||0)<5){notify('💎','Потрібно 5 фрагментів!');return;}
  const g=GEM_DEFS[key];if(!g)return;
  P.gems[key]-=5;
  const r=g.reward;
  if(r.coins)P.coins=(P.coins||0)+r.coins;
  if(r.hearts)P.hearts=(P.hearts||0)+r.hearts;
  if(r.xp)gainXP(r.xp);
  if(r.beauty){P.butterflies=(P.butterflies||0)+r.beauty;P.glamour=(P.glamour||0)+r.beauty;}
  const rStr=(r.coins?'🪙'+r.coins+' ':'')+(r.hearts?'❤️'+r.hearts+' ':'')+(r.xp?'⭐'+r.xp+' ':'')+(r.beauty?'🦋'+r.beauty:'');
  notify('💎 '+g.name+' зібрано!',rStr,4000);
  addLog(g.name+' зібрано! '+rStr);
  renderGems();render();saveP();
};
function dropGemOnWalk(){
  if(!P.gems)P.gems={ruby:0,sapphire:0,emerald:0,citrine:0,diamond:0};
  const roll=Math.random();
  let dropped=null;
  if(roll<0.04)dropped='diamond';
  else if(roll<0.12)dropped='emerald';
  else if(roll<0.22)dropped='sapphire';
  else if(roll<0.38)dropped='ruby';
  else if(roll<0.55)dropped='citrine';
  if(dropped){
    P.gems[dropped]=(P.gems[dropped]||0)+1;
    notify('💎 Знахідка!',GEM_DEFS[dropped].icon+' '+GEM_DEFS[dropped].name+' +1',3500);
  }
}

// ══ HOUSE ══
const HOUSE_COMPS=[
  {key:'foundation',icon:'🧱',name:'Фундамент',maxLv:5,costBase:80},
  {key:'roof',      icon:'🏗️',name:'Дах',       maxLv:5,costBase:100},
  {key:'walls',     icon:'🪵',name:'Стіни',     maxLv:5,costBase:90},
  {key:'interior',  icon:'🛋️',name:'Інтер\'єр', maxLv:5,costBase:120},
];
const HOUSE_STAGES=[
  {minStar:0, emoji:'🏚️',name:'Розвалюха', beauty:0},
  {minStar:4, emoji:'🏠',name:'Хатинка',  beauty:5},
  {minStar:8, emoji:'🏡',name:'Будинок',  beauty:12},
  {minStar:12,emoji:'🏘️',name:'Садиба',   beauty:20},
  {minStar:16,emoji:'🏰',name:'Маєток',   beauty:35},
  {minStar:20,emoji:'🏯',name:'Замок',    beauty:60},
];
function getHouseStars(){
  if(!P.houseComponents)P.houseComponents={foundation:0,roof:0,walls:0,interior:0};
  return Object.values(P.houseComponents).reduce((s,v)=>s+(v||0),0);
}
function getHouseStage(){
  const stars=getHouseStars();
  let stage=HOUSE_STAGES[0];
  for(const s of HOUSE_STAGES)if(stars>=s.minStar)stage=s;
  return stage;
}
function renderHouseCard(){
  if(!P)return;
  const stage=getHouseStage();
  const stars=getHouseStars();
  const set=(id,v)=>{const el=$(id);if(el)el.textContent=v;};
  set('house-emoji',stage.emoji);
  set('house-name',stage.name);
  set('house-beauty',stage.beauty);
  const filled=Math.min(5,Math.floor(stars/4));
  if($('house-stars-display'))$('house-stars-display').textContent='★'.repeat(filled)+'☆'.repeat(5-filled);
  // Update butterfly bonus
  if((P.houseBeauty||0)!==stage.beauty){
    P.butterflies=Math.max(0,(P.butterflies||0)-(P.houseBeauty||0)+stage.beauty);
    P.houseBeauty=stage.beauty;
  }
}
window.openHouseModal=function(){
  const m=$('house-modal');if(!m)return;
  m.style.display='flex';renderHouseModal();
};
window.closeHouseModal=function(){const m=$('house-modal');if(m)m.style.display='none';};
function renderHouseModal(){
  if(!P.houseComponents)P.houseComponents={foundation:0,roof:0,walls:0,interior:0};
  const stage=getHouseStage();
  const stars=getHouseStars();
  const set=(id,v)=>{const el=$(id);if(el)el.textContent=v;};
  set('hm-visual',stage.emoji);
  set('hm-name',stage.name);
  set('hm-beauty','+'+stage.beauty+' 🦋');
  const filled=Math.min(5,Math.floor(stars/4));
  if($('hm-stars'))$('hm-stars').textContent='★'.repeat(filled)+'☆'.repeat(5-filled);
  const comp=$('hm-components');
  if(comp){
    comp.innerHTML=HOUSE_COMPS.map(c=>{
      const lv=P.houseComponents[c.key]||0;
      const cost=Math.round(c.costBase*(1+lv*0.6));
      const isMax=lv>=c.maxLv;
      return '<div class="hm-comp-row">'
        +'<span class="hm-comp-icon">'+c.icon+'</span>'
        +'<div style="flex:1">'
          +'<div class="hm-comp-name">'+c.name+'</div>'
          +'<div class="hm-comp-stars">'+'★'.repeat(lv)+'☆'.repeat(c.maxLv-lv)+' рів.'+lv+'/'+c.maxLv+'</div>'
        +'</div>'
        +(isMax?'<span class="hm-comp-max">✅ MAX</span>'
          :'<button class="hm-comp-btn" onclick="upgradeHouseComp(\''+c.key+'\','+cost+')">🔨 🪙'+cost+'</button>')
        +'</div>';
    }).join('');
  }
  const nextStage=HOUSE_STAGES.find(s=>stars<s.minStar);
  const prog=$('hm-star-progress');
  if(prog)prog.innerHTML='<div class="hm-progress-info">⭐ '+stars+'/20 зір · '+(nextStage?'До '+nextStage.name+': '+(nextStage.minStar-stars)+' ⭐':'🏆 Максимум!')+'</div>';
}
window.upgradeHouseComp=function(key,cost){
  if(!P.houseComponents)P.houseComponents={foundation:0,roof:0,walls:0,interior:0};
  const c=HOUSE_COMPS.find(x=>x.key===key);if(!c)return;
  if((P.houseComponents[key]||0)>=c.maxLv){notify('✅','Вже максимум!');return;}
  if((P.coins||0)<cost){notify('🪙','Потрібно '+cost+' монет!');return;}
  P.coins-=cost;
  P.houseComponents[key]=(P.houseComponents[key]||0)+1;
  notify('🏗️ Покращено!',c.name+' рів.'+P.houseComponents[key]);
  addLog(c.name+' → рів.'+P.houseComponents[key]);
  renderHouseModal();renderHouseCard();render();saveP();
};

// ══ SHOW / LEAGUES ══
const LEAGUES=[
  {id:'bronze', icon:'🥉',name:'Бронза',  minBeauty:0,   prize:{coins:50, hearts:100}},
  {id:'silver', icon:'🥈',name:'Срібло',  minBeauty:20,  prize:{coins:150,hearts:300}},
  {id:'gold',   icon:'🥇',name:'Золото',  minBeauty:50,  prize:{coins:400,hearts:600}},
  {id:'diamond',icon:'💎',name:'Діамант', minBeauty:100, prize:{coins:800,hearts:1000}},
  {id:'master', icon:'👑',name:'Майстер', minBeauty:200, prize:{coins:2000,hearts:2000}},
];
function getLeague(beauty){
  let lg=LEAGUES[0];
  for(const l of LEAGUES)if(beauty>=l.minBeauty)lg=l;
  return lg;
}
window.renderShow=function(){
  if(!P)return;
  const beauty=P.butterflies||0;
  const lg=getLeague(beauty);
  const next=LEAGUES.find(l=>beauty<l.minBeauty);
  // My pet
  const se=$('show-cat-emoji');if(se)se.textContent=P.petType==='dog'?'🐶':'🐱';
  const sn=$('show-cat-name');if(sn)sn.textContent=P.catname||'Тваринка';
  const sb=$('show-beauty');if(sb)sb.textContent=beauty;
  const sl=$('show-level');if(sl)sl.textContent=P.level||1;
  // League card
  const lb=$('show-league');
  if(lb){
    lb.innerHTML='<div class="league-card">'
      +'<span class="league-icon">'+lg.icon+'</span>'
      +'<div style="flex:1">'
        +'<div class="league-name">Ліга: '+lg.name+'</div>'
        +'<div class="league-prizes">Тижневий приз: 🪙'+lg.prize.coins+' ❤️'+lg.prize.hearts+'</div>'
        +(next?'<div style="font-size:.65rem;color:var(--tl);font-weight:700;margin-top:2px">До '+next.name+': ще '+(next.minBeauty-beauty)+'🦋</div>':'<div style="font-size:.65rem;color:var(--gold);font-weight:800;margin-top:2px">🏆 Максимальна ліга!</div>')
      +'</div>'
      +'<button class="orange-btn" style="padding:8px 12px;font-size:.72rem" onclick="claimShowPrize()">🎁 Приз</button>'
      +'</div>';
  }
  // Categories
  const cats=$('show-categories');
  if(cats){
    const catDefs=[
      {icon:'🦋',name:'Найкрасивіша',   desc:'За 🦋 красу',            act:'enterShow("beauty")'},
      {icon:'⬆️',name:'Найдосвідченіша', desc:'За рівень',              act:'enterShow("level")'},
      {icon:'🏠',name:'Найкращий дім',  desc:'За зірки будинку',        act:'enterShow("house")'},
      {icon:'💎',name:'Найбагатша',     desc:'За кількість каменів',    act:'enterShow("gems")'},
    ];
    cats.innerHTML='<div class="card"><div class="sec-title">🎯 Категорії змагань</div>'
      +catDefs.map(c=>'<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1.5px dashed var(--br)">'
        +'<span style="font-size:1.5rem">'+c.icon+'</span>'
        +'<div style="flex:1"><div style="font-size:.82rem;font-weight:900;color:var(--gdk)">'+c.name+'</div>'
        +'<div style="font-size:.68rem;color:var(--tl);font-weight:700">'+c.desc+'</div></div>'
        +'<button class="orange-btn" style="padding:7px 12px;font-size:.72rem" onclick="'+c.act+'">Взяти участь</button>'
        +'</div>').join('')
      +'</div>';
  }
  loadShowLeaderboard();
};
window.enterShow=async function(type){
  const beauty=P.butterflies||0;
  const lg=getLeague(beauty);
  try{
    await setDoc(doc(db,'show',uid),{
      uid,nickname:P.nickname||'?',catname:P.catname||'Тваринка',
      beauty,level:P.level||1,
      houseStars:getHouseStars(),
      gemTotal:P.gems?Object.values(P.gems).reduce((s,v)=>s+v,0):0,
      league:lg.id,week:getMondayKey(),ts:serverTimestamp(),
    },{merge:true});
    notify('🏆 Заявку подано!','Ліга '+lg.name,3500);
    addLog('Виставка: участь у '+type);
    loadShowLeaderboard();
  }catch(e){notify('❌',e.message);}
  saveP();
};
async function loadShowLeaderboard(){
  const lb=$('show-leaderboard');if(!lb)return;
  lb.innerHTML='<div class="loading-inline">Завантаження...</div>';
  try{
    const snap=await getDocs(query(collection(db,'show'),orderBy('beauty','desc'),limit(20)));
    if(snap.empty){lb.innerHTML='<div class="loading-inline">Ще ніхто не брав участі!</div>';return;}
    const medals=['🥇','🥈','🥉'];
    lb.innerHTML='<div class="tournament-header">🏅 Топ виставки (за красою)</div>'
      +snap.docs.map((d,i)=>{const p=d.data();const isMe=d.id===uid;
        return '<div class="rating-row'+(isMe?' show-contestant-me':'')+'">'
          +'<span class="show-rank">'+(medals[i]||i+1)+'</span>'
          +'<span style="font-size:1.2rem">'+getLeague(p.beauty||0).icon+'</span>'
          +'<div style="flex:1;margin:0 8px"><div style="font-size:.8rem;font-weight:900;color:var(--gdk)">'+esc(p.catname||'?')+(isMe?' 🌟':'')+'</div>'
          +'<div style="font-size:.65rem;color:var(--tl);font-weight:700">@'+esc(p.nickname||'?')+' · 🦋'+p.beauty+'</div></div>'
          +'<span style="font-size:.78rem;font-weight:900;color:var(--gold)">🦋'+p.beauty+'</span>'
          +'</div>';
      }).join('');
  }catch(e){lb.innerHTML='<div class="loading-inline">Помилка: '+esc(e.message)+'</div>';}
}
window.claimShowPrize=function(){
  const lg=getLeague(P.butterflies||0);
  const key='showPrize_'+getMondayKey();
  if(P.bonuses&&P.bonuses[key]){notify('✅','Приз вже отримано цього тижня!');return;}
  P.coins=(P.coins||0)+lg.prize.coins;
  P.hearts=(P.hearts||0)+lg.prize.hearts;
  if(!P.bonuses)P.bonuses={};
  P.bonuses[key]=true;
  notify('🎁 Приз ліги '+lg.name+'!','🪙'+lg.prize.coins+' ❤️'+lg.prize.hearts,5000);
  addLog('Приз ліги '+lg.name);
  render();saveP();
};

// ══ CLUB FIXES ══
window.levelUpClub=async function(){
  if(!P.clubId)return;
  try{
    const snap=await getDoc(doc(db,'clubs',P.clubId));
    if(!snap.exists())return;
    const c=snap.data();
    if(c.directorUid!==uid){notify('❌','Тільки директор може підвищити рівень!');return;}
    const lv=c.level||1;
    const needed=lv*500;
    if((c.piggyCoins||0)<needed){notify('🪙','Потрібно '+needed+' монет у копилці!');return;}
    await updateDoc(doc(db,'clubs',P.clubId),{level:increment(1),stars:increment(1),piggyCoins:increment(-needed)});
    notify('🎉 Клуб рівень '+(lv+1)+'!','Вітаємо!');
    addLog('Клуб → рів.'+(lv+1));
    loadClubData();
  }catch(e){notify('❌',e.message);}
};
window.saveClubSettings=async function(){
  if(!P.clubId)return;
  const icon=$('club-settings-icon')?.value||'🐱';
  const desc=($('club-settings-desc')?.value||'').trim();
  try{
    await updateDoc(doc(db,'clubs',P.clubId),{icon,description:desc||'Наш клуб!'});
    notify('✅','Налаштування клубу збережено');
    closeClubSettings();loadClubData();
  }catch(e){notify('❌',e.message);}
};
window.openClubSettings=function(){const m=$('club-settings-modal');if(m)m.style.display='flex';};
window.closeClubSettings=function(){const m=$('club-settings-modal');if(m)m.style.display='none';};
window.openCollectionExchange=function(){notify('🔄','Незабаром!');};
window.showClubHistory=function(){notify('📜','Незабаром!');};

// ══ HOOK: patch finishWalk to drop gems ══
const _fwOrig=finishWalk;
finishWalk=function(){
  _fwOrig();
  dropGemOnWalk&&dropGemOnWalk();
};

