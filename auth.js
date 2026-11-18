'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{promisify}=require('node:util');
const scrypt=promisify(crypto.scrypt);
module.exports=function createAuth({dataPath,reply}){
 const file=process.env.WEDDING_AUTH||path.join(path.dirname(dataPath),'users.json');
 let users=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):[];
 const sessions=new Map(),attempts=new Map(),ttl=12*60*60*1000;
 const safe=u=>({id:u.id,username:u.username,name:u.name,role:u.role,disabled:!!u.disabled});
 function save(next){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(next,null,2),{mode:0o600});fs.renameSync(file+'.tmp',file);users=next;}
 function checkPassword(p){if(typeof p!=='string'||p.length<12||p.length>128)throw Error('លេខសម្ងាត់ត្រូវមានពី 12 ដល់ 128 តួអក្សរ។');}
 function normalizeUsername(value){let username=String(value||'').trim().toLowerCase();if(/^[+0-9][0-9+() .-]+$/.test(username))username=username.replace(/[() .-]/g,'');return username;}
 function validUsername(username){return /^(?:\+855|0)\d{8,9}$/.test(username)||/^[a-z0-9_.-]{3,40}$/.test(username);}
 function fields(b,{requirePassword=true}={}){const username=normalizeUsername(b.username),name=String(b.name||'').trim();if(!validUsername(username)||!name||name.length>100||!['admin','staff','owner'].includes(b.role))throw Error('សូមបញ្ចូលលេខទូរស័ព្ទត្រឹមត្រូវ (ឧ. 012345678) និងឈ្មោះ។');if(requirePassword)checkPassword(b.password);return {username,name,role:b.role};}
 async function hash(password){const salt=crypto.randomBytes(16).toString('hex');return {salt,hash:(await scrypt(password,salt,64)).toString('hex')};}
 async function verify(p,u){const digest=await scrypt(p,u.salt,64);const stored=Buffer.from(u.hash,'hex');return stored.length===digest.length&&crypto.timingSafeEqual(digest,stored);}
 const dummySalt=crypto.randomBytes(16).toString('hex');
 function revoke(id){for(const [token,s] of sessions)if(s.userId===id)sessions.delete(token);}
 function current(req){const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('wedding_session='))?.slice(16);for(const [k,s]of sessions)if(s.expires<=Date.now())sessions.delete(k);const session=sessions.get(token),user=session&&users.find(u=>u.id===session.userId&&!u.disabled);return user?{user,token}:null;}
 function cookie(res,token,clear=false){res.setHeader('Set-Cookie','wedding_session='+token+'; HttpOnly; SameSite=Strict; Path=/; Max-Age='+(clear?'0':String(ttl/1000)));}
 function signIn(res,user){const token=crypto.randomBytes(32).toString('hex');sessions.set(token,{userId:user.id,expires:Date.now()+ttl});cookie(res,token);return safe(user);}
 async function body(req){if(!String(req.headers['content-type']).startsWith('application/json'))throw Error('JSON required');let raw='';for await(const c of req){raw+=c;if(raw.length>16384)throw Error('Request too large');}const b=JSON.parse(raw);if(!b||Array.isArray(b)||typeof b!=='object')throw Error('Invalid request');return b;}
 function rateKey(req,username){return req.socket.remoteAddress+'|'+username;}
 function fail(key){if(attempts.size>1000)attempts.clear();const previous=attempts.get(key);attempts.set(key,{count:(previous&&previous.until>Date.now()?previous.count:0)+1,until:Date.now()+10*60*1000});}
 async function route(req,res,url){
  const route=url.pathname,method=req.method;
  if(route==='/api/auth/me'&&method==='GET'){const active=current(req);reply(res,200,{user:active?safe(active.user):null,setupRequired:users.length===0});return true;}
  if(route==='/api/auth/setup'&&method==='POST'){
   if(users.length){reply(res,403,{error:'គណនី Admin ត្រូវបានបង្កើតរួចហើយ។'});return true;}
   const b=await body(req),info=fields({...b,role:'admin'}),digest=await hash(b.password);
   if(users.length){reply(res,403,{error:'Setup already completed'});return true;}
   const user={...info,...digest,id:crypto.randomUUID(),disabled:false,createdAt:new Date().toISOString()};save([user]);reply(res,201,{user:signIn(res,user)});return true;
  }
  if(route==='/api/auth/login'&&method==='POST'){
   const b=await body(req),username=normalizeUsername(b.username),key=rateKey(req,username),ipKey=rateKey(req,'*'),previous=attempts.get(key),ip=attempts.get(ipKey);
   if((previous&&previous.until>Date.now()&&previous.count>=5)||(ip&&ip.until>Date.now()&&ip.count>=30)){reply(res,429,{error:'សាកល្បងច្រើនដងពេក។ សូមរង់ចាំ 10 នាទី។'});return true;}
   if(typeof b.password!=='string'||b.password.length>128){fail(key);fail(ipKey);reply(res,401,{error:'Username ឬលេខសម្ងាត់មិនត្រឹមត្រូវ។'});return true;}
   const u=users.find(x=>x.username===username);
   const ok=u?await verify(b.password,u):!!(await scrypt(b.password,dummySalt,64))&&false;
   const latest=u&&users.find(x=>x.id===u.id);
   if(!ok||!latest||latest.disabled||latest.hash!==u.hash){fail(key);fail(ipKey);reply(res,401,{error:'Username ឬលេខសម្ងាត់មិនត្រឹមត្រូវ។'});return true;}
   attempts.delete(key);reply(res,200,{user:signIn(res,latest)});return true;
  }
  if(!route.startsWith('/api/auth/')&&!route.startsWith('/api/users'))return false;
  const active=current(req);if(!active){reply(res,401,{error:'សូមចូលគណនីជាមុន។'});return true;}
  const user=active.user;
  if(route==='/api/auth/logout'&&method==='POST'){sessions.delete(active.token);cookie(res,'',true);reply(res,200,{ok:true});return true;}
  if(route==='/api/auth/password'&&method==='POST'){
   const b=await body(req);checkPassword(b.password);
   if(typeof b.currentPassword!=='string'||b.currentPassword.length>128||!await verify(b.currentPassword,user)){reply(res,400,{error:'លេខសម្ងាត់បច្ចុប្បន្នមិនត្រឹមត្រូវ។'});return true;}
   const digest=await hash(b.password),latest=current(req);
   if(!latest||latest.user.hash!==user.hash){reply(res,401,{error:'សូមចូលគណនីម្ដងទៀត។'});return true;}
   save(users.map(u=>u.id===user.id?{...u,...digest}:u));revoke(user.id);cookie(res,'',true);reply(res,200,{ok:true});return true;
  }
  if(route==='/api/auth/profile'&&method==='PATCH'){
   const b=await body(req),username=normalizeUsername(b.username),name=String(b.name||'').trim();
   if(!validUsername(username)||!name||name.length>100){reply(res,400,{error:'សូមបញ្ចូលលេខទូរស័ព្ទ និងឈ្មោះឲ្យបានត្រឹមត្រូវ។'});return true;}
   if(users.some(u=>u.username===username&&u.id!==user.id)){reply(res,409,{error:'លេខទូរស័ព្ទនេះមានគណនីប្រើរួចហើយ។'});return true;}
   if(typeof b.currentPassword!=='string'||!await verify(b.currentPassword,user)){reply(res,400,{error:'លេខសម្ងាត់បច្ចុប្បន្នមិនត្រឹមត្រូវ។'});return true;}
   let digest={};if(b.password!==undefined&&b.password!==''){checkPassword(b.password);digest=await hash(b.password);}
   const next={...user,username,name,...digest};save(users.map(u=>u.id===user.id?next:u));revoke(user.id);cookie(res,'',true);reply(res,200,{user:safe(next)});return true;
  }
  if(route.startsWith('/api/users')){
   if(user.role!=='admin'){reply(res,403,{error:'សម្រាប់ Admin ប៉ុណ្ណោះ។'});return true;}
   if(route==='/api/users'&&method==='GET'){reply(res,200,users.map(safe));return true;}
   if(route==='/api/users'&&method==='POST'){
    const b=await body(req),info=fields(b);if(users.some(u=>u.username===info.username)){reply(res,409,{error:'Username នេះមានរួចហើយ។'});return true;}
    const digest=await hash(b.password);if(current(req)?.user.role!=='admin'){reply(res,401,{error:'សូមចូលគណនីម្ដងទៀត។'});return true;}
    if(users.some(u=>u.username===info.username)){reply(res,409,{error:'Username នេះមានរួចហើយ។'});return true;}
    const next={...info,...digest,id:crypto.randomUUID(),disabled:false,createdAt:new Date().toISOString()};save([...users,next]);reply(res,201,safe(next));return true;
   }
   const match=route.match(/^\/api\/users\/([a-f0-9-]+)$/);
   if(match&&method==='PATCH'){
    const target=users.find(u=>u.id===match[1]);if(!target){reply(res,404,{error:'Not found'});return true;}
    if(target.id===user.id){reply(res,400,{error:'មិនអាចបិទគណនីខ្លួនឯង។ ប្រើប្ដូរលេខសម្ងាត់ផ្ទាល់ខ្លួន។'});return true;}
    const b=await body(req);let digest={};
    if(b.password!==undefined){checkPassword(b.password);digest=await hash(b.password);}
    else if(typeof b.disabled!=='boolean'){reply(res,400,{error:'Invalid update'});return true;}
    if(current(req)?.user.role!=='admin'){reply(res,401,{error:'សូមចូលគណនីម្ដងទៀត។'});return true;}
    const next={...users.find(u=>u.id===target.id),...digest,...(typeof b.disabled==='boolean'?{disabled:b.disabled}:{})};save(users.map(u=>u.id===target.id?next:u));revoke(target.id);reply(res,200,safe(next));return true;
   }
  }
  reply(res,404,{error:'Not found'});return true;
 }
 return {route,current,safe};
};
