// КотяГра — app.js (Firebase Edition — Fixed v2)
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

const firebaseConfig = {
  apiKey: "AIzaSyCCVlCIXLQ_GMBPMR8A5-8myzkuolm-BCs",
  authDomain: "kotyagra-d737c.firebaseapp.com",
  projectId: "kotyagra-d737c",
  storageBucket: "kotyagra-d737c.firebasestorage.app",
  messagingSenderId: "674427128723",
  appId: "1:674427128723:web:a4ee00e479a0b284fb3666"
};
const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);

const GEMS_CFG = [
  {key:'sapphire',icon:'💎',name:'Сапфір',bonus:'+🦋1',cost:3},
  {key:'amethyst',icon:'💜',name:'Аметист',bonus:'+⭐10 XP',cost:3},
  {key:'emerald',icon:'💚',name:'Смарагд',bonus:'+❤️15',cost:3},
  {key:'topaz',icon:'🟡',name:'Топаз',bonus:'+🪙5',cost:3},
  {key:'opal',icon:'🔵',name:'Опал',bonus:'+⚡10',cost:3},
  {key:'ruby',icon:'❤️‍🔥',name:'Рубін',bonus:'+🦋2',cost:4},
];
const TRAIN_CFG = [
  {key:'clothes',icon:'👗',name:'Одяг',desc:'Весь одяг дає +🦋1 більше краси'},
  {key:'access',icon:'👑',name:'Аксесуари',desc:'Аксесуари дають +🦋1 більше краси'},
  {key:'jewel',icon:'💍',name:'Прикраси',desc:'Прикраси дають +🦋1 більше краси'},
];
const CATS  = ['🐱','😺','😸','😻','😹'];
const MOODS = [[80,'😻 в захваті!'],[60,'😊 щасливий'],[40,'😐 нормально'],[20,'😿 сумний'],[0,'😤 незадоволений']];

let P=null, uid=null, chatUnsub=null, onlineInt=null, decayInt=null, walkTicker=null;
let mailTab='inbox', currentMailId=null, ratingTab='players', saveTimeout=null;
let authMode='login';

const cl=(v,mn=0,mx=100)=>Math.max(mn,Math.min(mx,v));
const $=id=>document.getElementById(id);
const nowTime=()=>new Date().toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'});
const esc=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// Safe Firestore save
function sanitize(obj){
  return JSON.parse(JSON.stringify(obj,(k,v)=>v===undefined?null:v));
}

function saveP(){
  if(!uid||!P)return;
  // always save locally first
  try{ localStorage.setItem('kg_local_'+uid, JSON.stringify(P)); }catch(e){}
  clearTimeout(saveTimeout);
  saveTimeout=setTimeout(async()=>{
    try{ await setDoc(doc(db,'players',uid), sanitize(P), {merge:true}); }
    catch(e){ console.warn('Firestore save error:',e.code); }
  },2000);
}

function showLoading(on){ $('loading-screen').style.display=on?'flex':'none'; }
function setErr(msg){ $('auth-err').textContent=msg; }
function resetBtn(){
  const b=$('auth-btn'); b.disabled=false;
  b.textContent=authMode==='reg'?'Зареєструватися 🐾':'Увійти 🐾';
}

function mkPlayer(nickname,catname){
  return {
    nickname,catname,
    coins:50,hearts:500,butterflies:0,xp:0,level:1,
    hunger:70,thirst:60,fun:50,energy:80,sleeping:false,
    skills:{clothes:0,access:0,jewel:0},glamour:0,
    gems:{sapphire:0,amethyst:0,emerald:0,topaz:0,opal:0,ruby:0},
    walk:null,walkCoins:0,showWins:0,
    items:{ball:false,fish:false,milk:false,bow:false},
    clubId:null,
    inbox:[
      {id:1,from:'КотяГра 🐱',subj:'Ласкаво просимо!',
       body:'Привіт, '+nickname+'! Виховуй котика, тренуй навики, вступай у клуби. Удачі!',
       time:nowTime(),read:false,type:'system'},
      {id:2,from:'КотяГра 🐱',subj:'Підказка: прогулянки 🌳',
       body:'Відправляй котика на прогулянку щодня — він знаходить монети і дорогоцінності!',
       time:nowTime(),read:false,type:'system'},
    ],
    sent:[],
    createdAt:new Date().toISOString(),
    lastSeen:new Date().toISOString(),
  };
}

// ── AUTH ──────────────────────────────────────────────
window.switchTab=function(m){
  authMode=m;
  document.querySelectorAll('.auth-tab').forEach((t,i)=>
    t.classList.toggle('active',(i===0&&m==='login')||(i===1&&m==='reg')));
  $('a-name').style.display=m==='reg'?'block':'none';
  $('a-cat').style.display=m==='reg'?'block':'none';
  $('auth-btn').textContent=m==='reg'?'Зареєструватися 🐾':'Увійти 🐾';
  setErr('');
};

window.doAuth=async function(){
  const email=$('a-email').value.trim();
  const pass=$('a-pass').value;
  const nick=$('a-name').value.trim();
  const cat=$('a-cat').value.trim();
  setErr('');
  if(!email||!pass){setErr('Заповни всі поля!');return;}
  if(authMode==='reg'&&(!nick||!cat)){setErr("Вкажи нікнейм та ім'я котика!");return;}
  $('auth-btn').disabled=true;
  $('auth-btn').textContent='⏳ Зачекайте...';
  try{
    if(authMode==='reg'){
      // Check nickname
      try{
        const nq=await getDocs(query(collection(db,'players'),where('nickname','==',nick),limit(1)));
        if(!nq.empty){setErr('Такий нікнейм вже зайнятий!');resetBtn();return;}
      }catch(e){console.warn('nick check:',e.message);}
      const cred=await createUserWithEmailAndPassword(auth,email,pass);
      const np=mkPlayer(nick,cat);
      // Try Firestore, fallback to localStorage
      try{ await setDoc(doc(db,'players',cred.user.uid),sanitize(np)); }
      catch(e){
        console.warn('Initial Firestore save failed:',e.message);
        localStorage.setItem('kg_pending_'+cred.user.uid,JSON.stringify(np));
      }
      // onAuthStateChanged will fire next
    }else{
      await signInWithEmailAndPassword(auth,email,pass);
    }
  }catch(e){
    resetBtn();
    const msgs={
      'auth/email-already-in-use':'Цей email вже використовується!',
      'auth/invalid-email':'Невірний формат email!',
      'auth/weak-password':'Пароль мінімум 6 символів!',
      'auth/user-not-found':'Гравця не знайдено!',
      'auth/wrong-password':'Невірний пароль!',
      'auth/invalid-credential':'Невірний логін або пароль!',
      'auth/too-many-requests':'Забагато спроб. Спробуй пізніше.',
      'auth/network-request-failed':'Немає з\'єднання з інтернетом.',
    };
    setErr(msgs[e.code]||'Помилка: '+e.message);
  }
};

window.doGoogleAuth=async function(){
  try{
    const provider=new GoogleAuthProvider();
    const result=await signInWithPopup(auth,provider);
    const u=result.user;
    try{
      const snap=await getDoc(doc(db,'players',u.uid));
      if(!snap.exists()){
        const nick=(u.displayName||'Гравець').replace(/\s+/g,'_').slice(0,20);
        await setDoc(doc(db,'players',u.uid),sanitize(mkPlayer(nick,'Котик')));
      }
    }catch(e){console.warn('Google profile:',e.message);}
  }catch(e){
    if(e.code!=='auth/popup-closed-by-user')setErr(e.message);
  }
};

window.logout=async function(){
  stopAll(); P=null; uid=null; await signOut(auth);
};

// ── Auth Observer — ГОЛОВНИЙ ФІКС ─────────────────────
onAuthStateChanged(auth,async user=>{
  if(!user){
    stopAll(); P=null; uid=null;
    showLoading(false);
    $('game-wrap').style.display='none';
    $('bottom-nav').style.display='none';
    $('auth-screen').style.display='flex';
    resetBtn();
    return;
  }
  // User signed in
  showLoading(true);
  $('auth-screen').style.display='none';
  uid=user.uid;

  // STEP 1: Try localStorage first (instant, no network needed)
  const localData=localStorage.getItem('kg_local_'+uid);
  const pendingData=localStorage.getItem('kg_pending_'+uid);

  if(pendingData){
    // New registration with saved pending data
    P=JSON.parse(pendingData);
    localStorage.removeItem('kg_pending_'+uid);
    // Try to push to Firestore async (don't block game start)
    setDoc(doc(db,'players',uid),sanitize(P)).catch(e=>console.warn('push pending:',e.message));
  }else if(localData){
    // We have local data — start game immediately
    P=JSON.parse(localData);
    startGame();
    // Then sync from Firestore in background
    getDoc(doc(db,'players',uid)).then(snap=>{
      if(snap.exists()){
        const remote=snap.data();
        // Merge: take higher values to avoid data loss
        if((remote.level||1)>=(P.level||1)){
          P={...remote};
          render();
          if(uid)localStorage.setItem('kg_local_'+uid,JSON.stringify(P));
        }
      }
    }).catch(e=>console.warn('background sync:',e.message));
    return; // Already started
  }else{
    // No local data — must load from Firestore
    try{
      const snap=await getDoc(doc(db,'players',uid));
      if(snap.exists()){
        P=snap.data();
      }else{
        const nick=(user.displayName||'Гравець').replace(/\s+/g,'_').slice(0,20);
        P=mkPlayer(nick,'Котик');
        setDoc(doc(db,'players',uid),sanitize(P)).catch(e=>console.warn('new user save:',e.message));
      }
    }catch(e){
      console.warn('Firestore load error:',e.code,e.message);
      // Firestore unavailable — create new local player
      const nick=(user.displayName||'Гравець').replace(/\s+/g,'_').slice(0,20);
      P=mkPlayer(nick,'Котик');
      notify('⚠️ Офлайн режим','Прогрес збережеться коли з\'явиться інтернет');
    }
  }
  startGame();
});

function startGame(){
  $('game-wrap').style.display='flex';
  $('bottom-nav').style.display='flex';
  showLoading(false);
  $('s-pn').textContent=(P.nickname||'Гравець')+' ▾';
  $('cat-dn').textContent=P.catname||'Котик';
  buildGems(); buildTrain();
  render(); renderProfile();
  startDecay(); startOnline();
  if(P.walk&&Date.now()-P.walk.start<P.walk.dur)resumeWalk();
  else if(P.walk)finishWalk(true);
  updateMailBadge();
  console.log('✅ Game started:',P.nickname);
}

function stopAll(){
  clearInterval(decayInt); clearInterval(onlineInt);
  clearInterval(walkTicker); clearTimeout(saveTimeout);
  if(chatUnsub){chatUnsub();chatUnsub=null;}
}

function startOnline(){
  const upd=async()=>{
    try{
      await setDoc(doc(db,'online',uid),{uid,nickname:P?.nickname||'?',t:Date.now()},{merge:true});
      const snap=await getDocs(collection(db,'online'));
      const cnt=snap.docs.filter(d=>(d.data().t||0)>Date.now()-3*60*1000).length;
      if($('s-on'))$('s-on').textContent=cnt;
      if($('chat-on'))$('chat-on').textContent=cnt;
    }catch(e){}
  };
  upd(); onlineInt=setInterval(upd,45000);
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
  if(id==='profile')renderProfile();
};

// ── Render ────────────────────────────────────────────
function render(){
  $('s-b').textContent=P.butterflies||0;
  $('s-c').textContent=P.coins||0;
  $('s-h').textContent=P.hearts||0;
  $('s-lv').textContent=P.level||1;
  const cap=(P.level||1)*100;
  $('s-xp').textContent=(P.xp||0)+'/'+cap+' XP';
  $('s-lf').style.width=((P.xp||0)/cap*100)+'%';
  [['hunger','h'],['thirst','t'],['fun','f'],['energy','e']].forEach(([k,id])=>{
    const v=cl(P[k]||0);
    $('b-'+id).style.width=v+'%';
    $('v-'+id).textContent=v+'%';
  });
  const avg=((P.hunger||0)+(P.thirst||0)+(P.fun||0)+(P.energy||0))/4;
  let mood=MOODS[MOODS.length-1][1];
  for(const[t,m]of MOODS)if(avg>=t){mood=m;break;}
  $('cat-mood').textContent='Настрій: '+mood;
  if(!P.sleeping)$('cat-emoji').textContent=CATS[Math.min(4,Math.floor(avg/100*5))];
  $('sl-ov').classList.toggle('on',!!P.sleeping);
  updateMailBadge();
  try{localStorage.setItem('kg_local_'+uid,JSON.stringify(P));}catch(e){}
}

function updateMailBadge(){
  const cnt=(P.inbox||[]).filter(m=>!m.read).length;
  const b=$('mail-badge');if(b){b.style.display=cnt>0?'block':'none';b.textContent=cnt;}
  const uc=$('unread-cnt');if(uc)uc.textContent=cnt>0?cnt:'';
}

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
function wiggle(){
  const el=$('cat-emoji');el.classList.remove('wiggle');void el.offsetWidth;el.classList.add('wiggle');
  setTimeout(()=>el.classList.remove('wiggle'),500);
}
function gainXP(n){
  P.xp=(P.xp||0)+n;
  const cap=(P.level||1)*100;
  if(P.xp>=cap){
    P.xp-=cap;P.level=(P.level||1)+1;
    const r=P.level*5;P.coins=(P.coins||0)+r;
    notify('🎉 Новий рівень!','Рівень '+P.level+'! Нагорода: 🪙 '+r+' монет');
    addLog('Досягнуто рівня '+P.level+'! Отримано '+r+' монет!');wiggle();
  }
  render();saveP();
}

window.petCat=function(){
  if(P.sleeping){addLog('Тихіше! Котик спить...');return;}
  P.hearts=cl((P.hearts||0)+1,0,999999);P.fun=cl((P.fun||0)+5);gainXP(2);wiggle();
  const msgs=['Мур-р-р! 😻','Котик муркоче від задоволення!','Пррр-пррр! ❤️','Котик дуже радіє!'];
  addLog(msgs[Math.floor(Math.random()*msgs.length)]);
};

// ── Actions ───────────────────────────────────────────
window.act=function(type){
  if(P.sleeping&&type!=='sleep'){notify('💤 Сон','Котик спить! Зачекайте...');return;}
  switch(type){
    case 'feed':
      if((P.hunger||0)>=100){notify('😋 Ситий!','Котик не хоче їсти.');return;}
      P.hunger=cl((P.hunger||0)+25);gainXP(3);
      addLog(P.catname+' з апетитом поїв 🍖');notify('🍖 Смачно!','+25 їжа');break;
    case 'water':
      if((P.thirst||0)>=100){notify('💧 Напоєний!','Котик не хоче пити.');return;}
      P.thirst=cl((P.thirst||0)+30);gainXP(2);
      addLog(P.catname+' попив водички 💧');notify('💧 Освіжився!','+30 вода');break;
    case 'play':
      if((P.energy||0)<15){notify('😴 Втомлений','Котик занадто втомлений!');return;}
      P.fun=cl((P.fun||0)+20);P.energy=cl((P.energy||0)-15);
      P.hearts=cl((P.hearts||0)+2,0,999999);gainXP(5);
      addLog(P.items?.ball?P.catname+' пограв з м\'ячиком! 🎾':P.catname+' побігав по кімнаті! 🎉');
      notify('🎾 Весело!','+20 розваги');break;
    case 'sleep':
      if(P.sleeping){
        P.sleeping=false;P.energy=cl((P.energy||0)+30);gainXP(4);
        $('cat-emoji').textContent='😺';
        addLog(P.catname+' прокинувся відпочилим! ⚡');notify('☀️ Прокинувся!','+30 енергія');
      }else{
        P.sleeping=true;$('cat-emoji').textContent='😴';
        addLog(P.catname+' ліг спати... 💤');notify('💤 Спить','Натисніть знову щоб прокинутись');
      }
      render();saveP();break;
    case 'show':
      if((P.coins||0)<5){notify('🪙 Мало монет','Потрібно 5 монет!');return;}
      if((P.energy||0)<25){notify('😴 Втомлений','Котик не готовий до виставки!');return;}
      P.coins-=5;
      const avg2=((P.hunger||0)+(P.thirst||0)+(P.fun||0)+(P.energy||0))/4;
      if(avg2>55&&Math.random()>.38){
        P.showWins=(P.showWins||0)+1;const pr=15+P.showWins*3;P.coins=(P.coins||0)+pr;
        gainXP(20);P.hearts=cl((P.hearts||0)+5,0,999999);wiggle();
        addLog(P.catname+' виграв виставку! 🏆 +'+pr+' монет!');notify('🏆 Перемога!','+'+pr+' монет, +20 XP');
      }else{gainXP(8);addLog(P.catname+' взяв участь у виставці, але не виграв. 💪');notify('😿 Не цього разу','+8 XP за участь');}
      saveP();break;
  }
};

window.buy=function(item){
  const map={ball:{name:"М'ячик",cost:10},fish:{name:'Рибку',cost:8},milk:{name:'Молочко',cost:5},bow:{name:'Бантик',cost:15}};
  const it=map[item];
  if(P.items?.[item]){notify('✅ Вже є!','У '+P.catname+' вже є '+it.name);return;}
  if((P.coins||0)<it.cost){notify('🪙 Мало монет','Потрібно '+it.cost+' монет!');return;}
  P.coins-=it.cost;P.items=P.items||{};P.items[item]=true;P.fun=cl((P.fun||0)+10);gainXP(5);wiggle();
  addLog('Куплено: '+it.name+'!');notify('✨ Куплено!',it.name+' у '+P.catname+'!');
  renderProfile();saveP();
};

// ── Decay ─────────────────────────────────────────────
function startDecay(){
  clearInterval(decayInt);
  decayInt=setInterval(()=>{
    if(!P)return;
    if(!P.sleeping){
      P.hunger=cl((P.hunger||0)-2);P.thirst=cl((P.thirst||0)-3);
      P.fun=cl((P.fun||0)-1);P.energy=cl((P.energy||0)-1);
    }else{
      P.energy=cl((P.energy||0)+2);
      P.hunger=cl((P.hunger||0)-1);P.thirst=cl((P.thirst||0)-1);
    }
    if(Math.random()>.75)P.coins=(P.coins||0)+1;
    render();
    if(Math.random()>.95){
      const evts=[P.catname+' знайшов пір\'їнку! 🪶',P.catname+' дивиться у вікно... 🐦',
        P.catname+' перекинув склянку! 💦',P.catname+' ховається під ковдру 🛏️',P.catname+' принюхується до квітів 🌸'];
      addLog(evts[Math.floor(Math.random()*evts.length)]);
    }
  },3500);
}

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
  TRAIN_CFG.forEach(({key})=>{
    const lv=(P.skills?.[key])||0;
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

// ── Gems ──────────────────────────────────────────────
const GEM_FX={
  sapphire:()=>{P.butterflies=(P.butterflies||0)+1;addLog('Сапфір дав +🦋1!');},
  amethyst:()=>{gainXP(10);addLog('Аметист дав +⭐10 XP!');},
  emerald:()=>{P.hearts=cl((P.hearts||0)+15,0,999999);addLog('Смарагд дав +❤️15!');},
  topaz:()=>{P.coins=(P.coins||0)+5;addLog('Топаз дав +🪙5!');},
  opal:()=>{P.energy=cl((P.energy||0)+10);addLog('Опал дав +⚡10!');},
  ruby:()=>{P.butterflies=(P.butterflies||0)+2;addLog('Рубін дав +🦋2!');},
};
function buildGems(){
  const gl=$('gem-list');if(!gl)return;const ga=$('gem-assemble');if(!ga)return;
  gl.innerHTML=GEMS_CFG.map(({key,icon,name,bonus,cost})=>
    `<div class="gem-row"><div class="gem-left"><span class="gem-icon">${icon}</span>
      <div><div class="gem-name">${name}</div><div class="gem-bonus">${bonus}</div></div></div>
      <div style="display:flex;align-items:center;gap:7px">
      <span style="font-size:.85rem;font-weight:900;color:var(--tx)" id="gc-${key}">0</span>
      <button class="gem-add" onclick="collectGem('${key}',${cost})">+</button></div></div>`
  ).join('');
  ga.innerHTML=GEMS_CFG.map(({key,icon,name})=>
    `<button class="act-btn" onclick="assembleGem('${key}','${icon}')" style="padding:9px 5px">
      <span class="bi">${icon}</span><span class="bl">${name}</span><span class="bc">5 частин</span></button>`
  ).join('');
}
function renderGems(){
  GEMS_CFG.forEach(({key})=>{const el=$('gc-'+key);if(el)el.textContent=(P.gems?.[key])||0;});
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

// ── Walks ─────────────────────────────────────────────
window.startWalk=function(type,secs,minC,maxC,xp){
  if(P.walk){notify('🌳 Вже на прогулянці!','Зачекайте поки котик повернеться.');return;}
  if((P.energy||0)<20){notify('😴 Мало енергії','Котику потрібно відпочити!');return;}
  P.walk={type,start:Date.now(),dur:secs*1000,minC,maxC,xp};P.energy=cl((P.energy||0)-15);
  addLog(P.catname+' пішов на прогулянку ({yard:"у двір",park:"у парк",forest:"у ліс"}[type])!');
  notify('🌳 Прогулянка!','Котик пішов гуляти! ~'+secs+' сек.');
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
    const gems=['sapphire','amethyst','emerald','topaz','opal','ruby'];
    if(Math.random()>.55){
      const g=gems[Math.floor(Math.random()*gems.length)];P.gems=P.gems||{};P.gems[g]=(P.gems[g]||0)+1;
      const cfg=GEMS_CFG.find(x=>x.key===g);addLog('Знайдено '+cfg.icon+' '+cfg.name+' під час прогулянки!');
    }
    addLog(P.catname+' повернувся! Знайдено 🪙 '+coins+' монет!');
    notify('🏠 Повернувся!',P.catname+' приніс 🪙 '+coins+' + '+P.walk.xp+' XP!');
  }
  P.walk=null;$('walk-active-div').style.display='none';$('walk-opts').style.display='block';
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
  }catch(e){lb.innerHTML='<div class="loading-inline">Помилка завантаження</div>';}
}

// ── Clubs ─────────────────────────────────────────────
async function loadClubs(){
  const cb=$('club-browser');if(!cb)return;cb.innerHTML='<div class="loading-inline">Завантаження...</div>';
  try{
    const snap=await getDocs(query(collection(db,'clubs'),orderBy('level','desc'),limit(10)));
    if(snap.empty){cb.innerHTML='<div class="loading-inline">Клубів поки немає. Створи перший!</div>';return;}
    cb.innerHTML=snap.docs.map(d=>{const c=d.data();
      return `<div class="club-list-item" onclick="joinClub('${d.id}')">
        <span class="cli-icon">${c.icon||'🎈'}</span>
        <div><div class="cli-name">${esc(c.name||'?')}</div>
        <div class="cli-info">${c.memberCount||1} учасників · Рівень ${c.level||1}</div></div>
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
  if((P.level||1)<3){notify('⬆️ Низький рівень','Потрібно 3 рівень для вступу!');return;}
  try{
    const snap=await getDoc(doc(db,'clubs',clubId));
    if(!snap.exists()){notify('❌ Помилка','Клуб не знайдено!');return;}
    await setDoc(doc(db,'clubs',clubId,'members',uid),{uid,nickname:P.nickname,role:'member',points:0,joinedAt:new Date().toISOString()});
    await updateDoc(doc(db,'clubs',clubId),{memberCount:increment(1)});
    P.clubId=clubId;await saveP();
    $('club-join-banner').style.display='block';
    notify('🎈 Ласкаво просимо!','Ти вступив до клубу!');
    addLog('Вступив до клубу "'+snap.data().name+'"! 🎈');
    renderClubs();loadClubData();
  }catch(e){notify('❌ Помилка',e.message);}
};
window.createClub=async function(){
  const name=$('new-club-name').value.trim();const desc=$('new-club-desc').value.trim();
  if(!name){notify('📝 Введи назву','Назва клубу обов\'язкова!');return;}
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
    addLog('Пожертвував 🪙10 до копилки клубу!');notify('🐷 Копилка!','🪙10 передано до клубу!');
    loadClubData();render();saveP();
  }catch(e){console.error(e);}
};
window.leaveClub=async function(){
  if(!P.clubId)return;if(!confirm('Вийти з клубу?'))return;
  try{
    await deleteDoc(doc(db,'clubs',P.clubId,'members',uid));
    await updateDoc(doc(db,'clubs',P.clubId),{memberCount:increment(-1)});
    addLog('Вийшов з клубу');P.clubId=null;await saveP();renderClubs();
  }catch(e){notify('❌ Помилка',e.message);}
};
window.showClubHistory=function(){notify('📜 Незабаром','Ця функція буде додана!');};

// ── Ratings ───────────────────────────────────────────
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
      const snap=await getDocs(query(collection(db,'players'),orderBy('level','desc'),limit(20)));
      rl.innerHTML=snap.docs.map((d,i)=>{const p=d.data();
        return `<div class="rating-row"><span class="rrank ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">${medals[i]||i+1}</span>
          <span class="rav">🐱</span><div><div class="rname">${esc(p.nickname||'?')}${d.id===uid?' 🌟':''}</div>
          <div class="rsub">Рів.${p.level||1} · 🌳${p.walkCoins||0}🪙</div></div>
          <span class="rscore">⭐${((p.level||1)*1000)+(p.butterflies||0)}</span></div>`;
      }).join('')||'<div class="loading-inline">Поки немає гравців</div>';
    }else if(type==='clubs'){
      const snap=await getDocs(query(collection(db,'clubs'),orderBy('level','desc'),limit(20)));
      rl.innerHTML=snap.docs.map((d,i)=>{const c=d.data();
        return `<div class="rating-row"><span class="rrank ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">${medals[i]||i+1}</span>
          <span class="rav">${c.icon||'🎈'}</span><div><div class="rname">${esc(c.name||'?')}</div>
          <div class="rsub">Рів.${c.level||1} · ${c.memberCount||1} учасників</div></div>
          <span class="rscore">⭐${((c.level||1)*100)+(c.memberCount||1)}</span></div>`;
      }).join('')||'<div class="loading-inline">Поки немає клубів</div>';
    }else{
      const snap=await getDocs(query(collection(db,'players'),orderBy('butterflies','desc'),limit(20)));
      rl.innerHTML=snap.docs.map((d,i)=>{const p=d.data();
        return `<div class="rating-row"><span class="rrank ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">${medals[i]||i+1}</span>
          <span class="rav">🦋</span><div><div class="rname">${esc(p.nickname||'?')}${d.id===uid?' 🌟':''}</div>
          <div class="rsub">Рів.${p.level||1} · Гламур ${p.glamour||0}</div></div>
          <span class="rscore">🦋${p.butterflies||0}</span></div>`;
      }).join('')||'<div class="loading-inline">Поки немає даних</div>';
    }
  }catch(e){rl.innerHTML='<div class="loading-inline">Помилка: '+esc(e.message)+'</div>';}
}

// ── Mail ──────────────────────────────────────────────
window.switchMail=function(tab){
  mailTab=tab;['inbox','sent','system'].forEach(t=>$('mt-'+t)?.classList.toggle('active',t===tab));renderMail();
};
function renderMail(){
  const mi=$('mail-items');if(!mi)return;
  let items=[];
  if(mailTab==='inbox')items=(P.inbox||[]).filter(m=>m.type!=='system');
  else if(mailTab==='sent')items=P.sent||[];
  else items=(P.inbox||[]).filter(m=>m.type==='system');
  items=[...items].reverse();
  if(!items.length){mi.innerHTML='<div class="loading-inline">Немає повідомлень</div>';return;}
  mi.innerHTML=items.map(m=>
    `<div class="mail-item ${m.read?'':'unread'}" onclick="openMail(${m.id},'${mailTab}')">
      <div style="display:flex;align-items:flex-start;gap:8px">
        ${!m.read?'<div class="mail-unread-dot"></div>':'<div style="width:8px"></div>'}
        <div style="flex:1"><div class="mail-from">${esc(mailTab==='sent'?'→ '+(m.to||'?'):(m.from||'?'))}</div>
        <div class="mail-subj">${esc(m.subj||'')}</div>
        <div class="mail-preview">${esc((m.body||'').slice(0,55))}${(m.body||'').length>55?'...':''}</div></div>
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
  const to=$('cm-to').value.trim();const subj=$('cm-subj').value.trim();const body=$('cm-body').value.trim();
  if(!to||!subj||!body){notify('📬 Помилка','Заповни всі поля!');return;}
  const msgObj={id:Date.now(),to,subj,body,time:nowTime(),read:true};
  P.sent=P.sent||[];P.sent.push(msgObj);
  try{
    const snap=await getDocs(query(collection(db,'players'),where('nickname','==',to),limit(1)));
    if(!snap.empty){
      const rId=snap.docs[0].id;const rData=snap.docs[0].data();
      const rInbox=[...(rData.inbox||[]),{id:Date.now()+1,from:P.nickname,subj,body,time:nowTime(),read:false,type:'player'}];
      await updateDoc(doc(db,'players',rId),{inbox:rInbox});
      notify('📤 Надіслано!','Повідомлення для '+to+' відправлено!');
    }else{notify('📤 Збережено','Гравець '+to+' не знайдений');}
  }catch(e){console.error(e);}
  $('cm-to').value='';$('cm-subj').value='';$('cm-body').value='';
  addLog('Надіслано повідомлення гравцю '+to);
  closeCompose();saveP();renderMail();
};

// ── Chat ──────────────────────────────────────────────
function startChat(){
  const box=$('chat-msgs');if(!box)return;if(chatUnsub)return;
  box.innerHTML='';
  try{
    const q=query(collection(db,'chat'),orderBy('ts','asc'),limit(80));
    chatUnsub=onSnapshot(q,snap=>{
      snap.docChanges().forEach(change=>{
        if(change.type==='added'){const d=change.doc.data();addChatMsg(d.nickname||'?',d.text||'',d.uid===uid,d.ts);}
      });
    },e=>console.warn('chat:',e));
  }catch(e){$('chat-msgs').innerHTML='<div class="loading-inline">Помилка чату</div>';}
}
function addChatMsg(nickname,text,isMine,ts){
  const box=$('chat-msgs');if(!box)return;
  const div=document.createElement('div');div.className='msg '+(isMine?'mine':'theirs');
  const t=ts?.toDate?ts.toDate().toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'}):nowTime();
  div.innerHTML=`${!isMine?`<div class="msg-sender">${esc(nickname)}</div>`:''}
    <div class="msg-bubble">${esc(text)}</div><div class="msg-meta">${t}</div>`;
  box.appendChild(div);box.scrollTop=box.scrollHeight;
}
window.sendChat=async function(){
  const inp=$('chat-in');const text=inp.value.trim();if(!text)return;inp.value='';
  try{await addDoc(collection(db,'chat'),{uid,nickname:P.nickname,text,ts:serverTimestamp()});}
  catch(e){console.error('sendChat:',e);}
};

// ── Profile ───────────────────────────────────────────
function renderProfile(){
  const avg=((P.hunger||0)+(P.thirst||0)+(P.fun||0)+(P.energy||0))/4;
  $('prof-emoji').textContent=CATS[Math.min(4,Math.floor(avg/100*5))];
  $('prof-catname').textContent=P.catname||'Котик';
  $('prof-name').textContent='@'+(P.nickname||'гравець');
  $('prof-lv').textContent=P.level||1;$('prof-b').textContent=P.butterflies||0;
  $('prof-gl').textContent=P.glamour||0;$('prof-wc').textContent=P.walkCoins||0;
  $('prof-skills').innerHTML=TRAIN_CFG.map(({key,icon,name})=>{const lv=(P.skills?.[key])||0;
    return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px dashed var(--br)">
      <span style="font-size:1.3rem">${icon}</span>
      <div style="flex:1"><div style="font-size:.78rem;font-weight:800;color:var(--gdk)">${name}</div>
      <div class="lvl-mini-track"><div class="lvl-mini-fill" style="width:${Math.round(lv/80*100)}%"></div></div></div>
      <div style="font-size:.75rem;font-weight:900;color:var(--tl)">${lv}/80</div></div>`;
  }).join('');
  const itemMap={ball:'🎾',fish:'🐟',milk:'🥛',bow:'🎀'};
  const owned=Object.entries(P.items||{}).filter(([,v])=>v).map(([k])=>k);
  $('prof-items').innerHTML=owned.length?owned.map(k=>`<span style="font-size:2rem">${itemMap[k]||'❓'}</span>`).join('')
    :'<span style="font-size:.75rem;color:var(--tl);font-weight:700">Немає предметів</span>';
}
