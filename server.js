const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
let mailer=null;try{const nm=require('nodemailer');if(process.env.SMTP_HOST)mailer=nm.createTransport({host:process.env.SMTP_HOST,port:+(process.env.SMTP_PORT||587),auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}})}catch(e){}
const DB=path.join(__dirname,'data.json');
let db={users:[],games:[],plays:[],claims:[]};
try{db=JSON.parse(fs.readFileSync(DB))}catch(e){}
const save=()=>fs.writeFileSync(DB,JSON.stringify(db));
const pending={},sessions={};
const today=()=>new Date().toISOString().slice(0,10);
const hash=(p,s)=>crypto.scryptSync(p,s,32).toString('hex');
async function sendCode(email){
  const code=String(crypto.randomInt(100000,999999));
  pending[email]={code,exp:Date.now()+10*60000,tries:0};
  if(mailer){try{await mailer.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to:email,subject:'Your verification code',text:'Your code is '+code+'. It expires in 10 minutes.'})}catch(e){console.log('Mail error',e.message)}}
  else console.log(`\n[DEV] Verification code for ${email}: ${code}\n`);
}
const J=(res,c,o)=>{res.writeHead(c,{'Content-Type':'application/json'});res.end(JSON.stringify(o))};
const auth=req=>{const t=(req.headers.authorization||'').replace('Bearer ','');return db.users.find(u=>u.id===sessions[t])};
const pub=u=>({username:u.username,email:u.email,coins:u.coins});
function gen(prompt){
  const p=prompt.toLowerCase();
  const type=/catch|fall|collect|basket|apple|star|coin/.test(p)?'catcher':'clicker';
  const cols={red:'#e5484d',green:'#30a46c',blue:'#2f6df6',purple:'#8e4ec6',orange:'#f76b15',pink:'#d6409f',yellow:'#e5b800'};
  const color=Object.keys(cols).find(c=>p.includes(c));
  const title=prompt.trim().slice(0,40).replace(/^./,c=>c.toUpperCase())||'AI Game';
  return {title,type,color:cols[color]||'#2f6df6'};
}
async function aiGame(prompt){
  const key=process.env.ANTHROPIC_API_KEY;
  if(!key)return {title:gen(prompt).title,params:gen(prompt)};
  try{
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},
    body:JSON.stringify({model:process.env.AI_MODEL||'claude-sonnet-4-6',max_tokens:4000,messages:[{role:'user',content:'Create a small, fun, complete browser game as ONE self-contained HTML file (inline CSS+JS, no external resources, works on touch and mouse) for this idea: '+prompt+'\nReply with ONLY the HTML, no markdown fences.'}]})});
    const d=await r.json();let html=(d.content||[]).map(c=>c.text||'').join('').replace(/```html|```/g,'').trim();
    if(html.includes('<')) return {title:prompt.slice(0,40),html};
  }catch(e){console.log('AI error',e.message)}
  return {title:gen(prompt).title,params:gen(prompt)};
}
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://x');
  if(!url.pathname.startsWith('/api/')){
    let f=path.join(__dirname,'public',url.pathname==='/'?'index.html':url.pathname);
    if(!f.startsWith(path.join(__dirname,'public'))||!fs.existsSync(f)){res.writeHead(404);return res.end('Not found')}
    res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'text/plain'});return fs.createReadStream(f).pipe(res);
  }
  let body='';for await(const c of req){body+=c;if(body.length>2e6)return res.destroy()}
  let b={};try{b=JSON.parse(body||'{}')}catch(e){}
  const u=auth(req),P=url.pathname;
  try{
    if(P==='/api/register'){
      const email=String(b.email||'').trim().toLowerCase(),username=String(b.username||'').trim(),pw=String(b.password||'');
      if(!/^\S+@\S+\.\S+$/.test(email))return J(res,400,{error:'Enter a valid email address.'});
      if(!/^[\w.-]{3,20}$/.test(username))return J(res,400,{error:'Username must be 3–20 letters, numbers, _ . or -'});
      if(pw.length<6)return J(res,400,{error:'Password must be at least 6 characters.'});
      if(db.users.some(x=>x.email===email||x.username.toLowerCase()===username.toLowerCase()))return J(res,400,{error:'Email or username is already taken.'});
      const salt=crypto.randomBytes(16).toString('hex');
      db.users.push({id:crypto.randomUUID(),email,username,salt,hash:hash(pw,salt),verified:false,coins:0});save();
      await sendCode(email);return J(res,200,{ok:true,email});
    }
    if(P==='/api/login'){
      const id=String(b.identifier||'').trim().toLowerCase();
      const x=db.users.find(x=>x.email===id||x.username.toLowerCase()===id);
      if(!x||hash(String(b.password||''),x.salt)!==x.hash)return J(res,400,{error:'Wrong email/username or password.'});
      await sendCode(x.email);return J(res,200,{ok:true,email:x.email});
    }
    if(P==='/api/verify'){
      const email=String(b.email||'').toLowerCase(),p=pending[email];
      if(!p||p.exp<Date.now())return J(res,400,{error:'Code expired. Please start again.'});
      if(++p.tries>5){delete pending[email];return J(res,400,{error:'Too many attempts. Please start again.'})}
      if(String(b.code).trim()!==p.code)return J(res,400,{error:'Wrong code. Try again.'});
      delete pending[email];const x=db.users.find(x=>x.email===email);x.verified=true;save();
      const t=crypto.randomBytes(24).toString('hex');sessions[t]=x.id;return J(res,200,{token:t,user:pub(x)});
    }
    if(P==='/api/me')return u?J(res,200,{user:pub(u)}):J(res,401,{error:'Not signed in.'});
    if(P==='/api/games'&&req.method==='GET'){
      const q=(url.searchParams.get('q')||'').toLowerCase();
      return J(res,200,{games:db.games.filter(g=>!q||g.title.toLowerCase().includes(q)||g.author.toLowerCase().includes(q)).slice().reverse().map(({id,title,author,plays})=>({id,title,author,plays}))});
    }
    if(P==='/api/game'){const g=db.games.find(g=>g.id===url.searchParams.get('id'));return g?J(res,200,{game:g}):J(res,404,{error:'Game not found.'})}
    if(!u)return J(res,401,{error:'Please sign in first.'});
    if(P==='/api/publish'){
      const title=String(b.title||'').trim().slice(0,40),html=String(b.html||'');
      if(!title||!html)return J(res,400,{error:'Your game needs a title.'});
      db.games.push({id:crypto.randomUUID(),title,html,author:u.username,plays:0,created:Date.now()});save();return J(res,200,{ok:true});
    }
    if(P==='/api/ai')return J(res,200,await aiGame(String(b.prompt||'').slice(0,500)));
    if(P==='/api/play'){
      const g=db.games.find(g=>g.id===b.id);if(!g)return J(res,404,{error:'Game not found.'});
      g.plays++;if(!db.plays.some(p=>p.user===u.id&&p.game===g.id&&p.day===today()))db.plays.push({user:u.id,game:g.id,day:today()});save();return J(res,200,{ok:true});
    }
    if(P==='/api/today'){
      const ids=db.plays.filter(p=>p.user===u.id&&p.day===today()).map(p=>p.game);
      return J(res,200,{games:db.games.filter(g=>ids.includes(g.id)).map(({id,title,author})=>({id,title,author})),claimed:db.claims.some(c=>c.user===u.id&&c.day===today())});
    }
    if(P==='/api/claim'){
      if(db.claims.some(c=>c.user===u.id&&c.day===today()))return J(res,400,{error:'You already claimed today’s reward. Come back tomorrow!'});
      if(!db.plays.some(p=>p.user===u.id&&p.game===b.id&&p.day===today()))return J(res,400,{error:'Play this game today first.'});
      db.claims.push({user:u.id,game:b.id,day:today()});u.coins+=100;save();return J(res,200,{user:pub(u)});
    }
    J(res,404,{error:'Unknown request.'});
  }catch(e){console.log(e);J(res,500,{error:'Server error.'})}
}).listen(process.env.PORT||3000,()=>console.log('Open http://localhost:'+(process.env.PORT||3000)));
