const $=s=>document.querySelector(s),modal=$('#modal'),content=$('#content');
let token=localStorage.getItem('token'),user=null,draft=null,pendingEmail='';
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function api(p,body){
  const r=await fetch('/api/'+p,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(token||'')},body:body?JSON.stringify(body):undefined});
  const d=await r.json();if(!r.ok)throw new Error(d.error||'Something went wrong.');return d;
}
const open=h=>{content.innerHTML=h;modal.hidden=false};
const closeM=()=>{modal.hidden=true;content.innerHTML=''};
$('#close').onclick=closeM;modal.onclick=e=>{if(e.target===modal)closeM()};
document.onkeydown=e=>{if(e.key==='Escape')closeM()};
function setUser(u){user=u;$('#coins').hidden=$('#giftBtn').hidden=!u;if(u)$('#coins').textContent='🪙 '+u.coins+' · '+u.username}
async function init(){if(token){try{setUser((await api('me')).user)}catch(e){token=null;localStorage.removeItem('token')}}loadGames()}
async function loadGames(q=''){
  const {games}=await api('games?q='+encodeURIComponent(q));
  $('#grid').innerHTML=games.length?games.map(g=>`<button class="tile" data-id="${g.id}"><b>${esc(g.title)}</b><small>by ${esc(g.author)}</small><small>${g.plays} plays</small></button>`).join(''):'<p class="empty">No games found yet. Press + to make the first one!</p>';
  document.querySelectorAll('.tile').forEach(t=>t.onclick=()=>play(t.dataset.id));
}
/* ---------- Auth ---------- */
$('#plusBtn').onclick=()=>user?studio():authView('register');
function authView(mode){
  const reg=mode==='register';
  open(`<h2>${reg?'Create account':'Log in'}</h2><div class="tabs"><button class="${reg?'on':''}" data-m="register">Create account</button><button class="${reg?'':'on'}" data-m="login">Log in</button></div>
  ${reg?'<label>Email</label><input id="email" type="email" autocomplete="email"><label>Username</label><input id="username" autocomplete="username">':'<label>Email or username</label><input id="ident" autocomplete="username">'}
  <label>Password</label><input id="pw" type="password" autocomplete="${reg?'new-password':'current-password'}">
  <div class="err" id="err"></div><button class="btn" id="go">${reg?'Create account':'Log in'}</button>`);
  document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>authView(b.dataset.m));
  $('#go').onclick=async()=>{try{
    const d=reg?await api('register',{email:$('#email').value,username:$('#username').value,password:$('#pw').value}):await api('login',{identifier:$('#ident').value,password:$('#pw').value});
    pendingEmail=d.email;verifyView();}catch(e){$('#err').textContent=e.message}};
}
function verifyView(){
  open(`<h2>Check your email</h2><p class="note">We sent a 6-digit verification code to <b>${esc(pendingEmail)}</b>.</p><label>Verification code</label><input id="code" class="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code"><div class="err" id="err"></div><button class="btn" id="go">Verify</button>`);
  $('#go').onclick=async()=>{try{const d=await api('verify',{email:pendingEmail,code:$('#code').value});token=d.token;localStorage.setItem('token',token);setUser(d.user);studio()}catch(e){$('#err').textContent=e.message}};
}
/* ---------- Studio ---------- */
function studio(){
  open(`<h2>Studio</h2><p class="note">Welcome, ${esc(user.username)}! How do you want to make your game?</p><div class="two"><button class="choice" id="mk"><b>🛠️ Make it myself</b>Pick a game type, colors and rules.</button><button class="choice" id="ai"><b>✨ Make it with AI</b>Describe your idea and AI builds it.</button></div><button class="btn alt" id="out">Log out</button>`);
  $('#mk').onclick=manual;$('#ai').onclick=aiView;
  $('#out').onclick=()=>{token=null;localStorage.removeItem('token');setUser(null);closeM()};
}
function gameHtml(p){
  const c=p.color,t=esc(p.title),sp=+p.speed||5;
  const base=`<meta name=viewport content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:sans-serif;background:#0b1f4d;color:#fff;text-align:center;user-select:none;overflow:hidden}h3{margin:10px}#s{font-size:22px}canvas{background:#10296a;border-radius:10px;max-width:100%;touch-action:none}button{padding:12px 24px;font-size:18px;border:0;border-radius:10px;background:${c};color:#fff;cursor:pointer}</style>`;
  if(p.type==='catcher')return `<!doctype html>${base}<h3>${t}</h3><div id=s>Score: 0 · Lives: 3</div><canvas id=c width=360 height=420></canvas><script>
const c=document.getElementById('c'),x=c.getContext('2d');let px=160,sc=0,lv=3,items=[],over=false;
function mv(e){const r=c.getBoundingClientRect(),cx=(e.touches?e.touches[0].clientX:e.clientX);px=(cx-r.left)*(360/r.width)-30}
c.onmousemove=mv;c.ontouchmove=e=>{e.preventDefault();mv(e)};
setInterval(()=>{if(!over)items.push({x:Math.random()*330,y:0})},${Math.max(300,1100-sp*90)});
function loop(){x.clearRect(0,0,360,420);x.fillStyle='${c}';x.fillRect(px,390,60,14);
items.forEach(i=>{i.y+=${1+sp*.45};x.fillStyle='#ffd54a';x.beginPath();x.arc(i.x+15,i.y,12,0,7);x.fill()});
items=items.filter(i=>{if(i.y>380&&i.y<410&&i.x+15>px&&i.x+15<px+60){sc++;return false}if(i.y>420){lv--;return false}return true});
document.getElementById('s').textContent='Score: '+sc+' · Lives: '+Math.max(lv,0);
if(lv<=0){over=true;x.fillStyle='#fff';x.font='28px sans-serif';x.fillText('Game over! '+sc,100,200);setTimeout(()=>location.reload(),2500);return}requestAnimationFrame(loop)}loop();<\/script>`;
  return `<!doctype html>${base}<h3>${t}</h3><div id=s>Score: 0 · Time: 20</div><br><button id=b>Click me!</button><script>
let sc=0,tl=20,b=document.getElementById('b'),s=document.getElementById('s');
function mv(){b.style.position='absolute';b.style.left=Math.random()*(innerWidth-150)+'px';b.style.top=60+Math.random()*(innerHeight-140)+'px'}
b.onclick=()=>{sc++;mv();s.textContent='Score: '+sc+' · Time: '+tl};
const iv=setInterval(()=>{tl--;s.textContent='Score: '+sc+' · Time: '+tl;if(tl<=0){clearInterval(iv);document.body.innerHTML='<h2>Time is up!</h2><h1>'+sc+' points</h1><button onclick=location.reload()>Play again</button>'}},${Math.max(500,1400-sp*100)});<\/script>`;
}
function manual(){
  open(`<h2>Make a game</h2><label>Title</label><input id="t" maxlength="40" value="My game"><label>Game type</label><select id="ty"><option value="clicker">Click the button</option><option value="catcher">Catch the falling stars</option></select><label>Color</label><input id="co" type="color" value="#2f6df6"><label>Speed (1–10)</label><input id="sp" type="range" min="1" max="10" value="5"><div class="err" id="err"></div><button class="btn alt" id="pv">Preview</button><div id="pvbox"></div>`);
  const build=()=>({title:$('#t').value,html:gameHtml({title:$('#t').value,type:$('#ty').value,color:$('#co').value,speed:$('#sp').value})});
  $('#pv').onclick=()=>{draft=build();preview()};
}
function aiView(){
  open(`<h2>Make it with AI</h2><label>Describe your game</label><textarea id="pr" rows="3" placeholder="A fast game where you catch falling red apples"></textarea><div class="err" id="err"></div><button class="btn" id="go">Generate game</button><div id="pvbox"></div>`);
  $('#go').onclick=async()=>{$('#go').textContent='Generating…';try{
    const d=await api('ai',{prompt:$('#pr').value});draft={title:d.title,html:d.html||gameHtml(d.params)};preview()}catch(e){$('#err').textContent=e.message}$('#go').textContent='Generate again'};
}
function preview(){
  $('#pvbox').innerHTML=`<iframe sandbox="allow-scripts" id="fr"></iframe><label>Title</label><input id="pt" maxlength="40" value="${esc(draft.title)}"><button class="btn" id="pub">Publish game</button>`;
  $('#fr').srcdoc=draft.html;
  $('#pub').onclick=async()=>{try{await api('publish',{title:$('#pt').value,html:draft.html});closeM();loadGames()}catch(e){$('#err').textContent=e.message}};
}
/* ---------- Play ---------- */
async function play(id){
  if(!user){authView('login');return}
  const {game}=(await api('game?id='+id));await api('play',{id});
  open(`<h2>${esc(game.title)}</h2><p class="note">by ${esc(game.author)}</p><iframe sandbox="allow-scripts" id="fr"></iframe>`);$('#fr').srcdoc=game.html;loadGames($('#q')?.value||'');
}
/* ---------- Search ---------- */
$('#searchBtn').onclick=()=>{
  open(`<h2>Search games</h2><input id="q" placeholder="Game title or creator" autofocus><div id="res" class="grid" style="margin-top:14px"></div>`);
  const run=async()=>{const {games}=await api('games?q='+encodeURIComponent($('#q').value));
    $('#res').innerHTML=games.length?games.map(g=>`<button class="tile" data-id="${g.id}"><b>${esc(g.title)}</b><small>by ${esc(g.author)}</small></button>`).join(''):'<p class="note">No games found.</p>';
    document.querySelectorAll('#res .tile').forEach(t=>t.onclick=()=>play(t.dataset.id))};
  $('#q').oninput=run;run();
};
/* ---------- Daily reward ---------- */
$('#giftBtn').onclick=async()=>{
  const d=await api('today');
  if(d.claimed)return open('<h2>Daily reward</h2><p>You already claimed today’s reward. Come back tomorrow! 🎁</p>');
  if(!d.games.length)return open('<h2>Daily reward</h2><p>Play at least one game today, then pick one to get your reward.</p>');
  open(`<h2>Daily reward</h2><p class="note">You played ${d.games.length} game${d.games.length>1?'s':''} today. Choose one to get <b>100 coins</b> in:</p><div class="grid">${d.games.map(g=>`<button class="tile" data-id="${g.id}"><b>${esc(g.title)}</b><small>by ${esc(g.author)}</small></button>`).join('')}</div><div class="err" id="err"></div>`);
  document.querySelectorAll('.tile').forEach(t=>t.onclick=async()=>{try{const r=await api('claim',{id:t.dataset.id});setUser(r.user);open('<h2>🎉 Reward claimed!</h2><p>+100 coins added to your account.</p>')}catch(e){$('#err').textContent=e.message}});
};
init();
