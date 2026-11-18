const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = __dirname;
const DATA = process.env.WEDDING_DATA || path.join(ROOT, 'data', 'gifts.json');
fs.mkdirSync(path.dirname(DATA), {recursive:true});
if (!fs.existsSync(DATA)) fs.writeFileSync(DATA, '[]');
function normalize(g) { const {amount,currency,method,...rest}=g; return {...rest,nameSuffix:g.nameSuffix||'',payments:Array.isArray(g.payments)?g.payments:(amount===undefined?[]:[{amount,currency,method}])}; }
let gifts = JSON.parse(fs.readFileSync(DATA, 'utf8')).map(normalize);
function save(next) { const temp = DATA + '.tmp'; fs.writeFileSync(temp, JSON.stringify(next,null,2)); fs.renameSync(temp, DATA); gifts=next; }
function reply(res,status,data) { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}); res.end(JSON.stringify(data)); }
function valid(b) {
 if(!b||typeof b!=='object'||Array.isArray(b))throw Error('Invalid request');
 const name=String(b.name||'').trim(),note=String(b.note||'').trim(),nameSuffix=String(b.nameSuffix||'').trim();
 const payments=b.payments===undefined?(b.amount===undefined?[]:[{amount:b.amount,currency:b.currency,method:b.method}]):b.payments;
 if(!name||name.length>120||nameSuffix.length>100||note.length>1000||!['groom','bride'].includes(b.side)||!Array.isArray(payments)||payments.length>20) throw Error('សូមពិនិត្យឈ្មោះ ខាង និងប្រាក់ចងដៃ។');
 const clean=payments.map(p=>{
  if(!p||typeof p.amount!=='number')throw Error('សូមបញ្ចូលចំនួនប្រាក់ត្រឹមត្រូវ។');
  const amount=p.amount;
  if(!['USD','KHR'].includes(p.currency)||!['cash','aba'].includes(p.method)||!Number.isFinite(amount)||amount<=0||amount>1000000000||(p.currency==='KHR'?!Number.isInteger(amount):Math.abs(amount*100-Math.round(amount*100))>0.00001))throw Error('ប្រាក់ត្រូវធំជាងសូន្យ។ រៀលជាចំនួនគត់ និងដុល្លារមិនលើសពីរ​ខ្ទង់ទសភាគ។');
  return {amount,currency:p.currency,method:p.method};
 });
 return {name,nameSuffix,note,side:b.side,payments:clean};
}
const auth=require('./auth')({dataPath:DATA,reply});
const server=http.createServer(async(req,res)=>{
 try {
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api/')) {
  if(req.headers.origin && req.headers.origin !== 'http://'+req.headers.host) return reply(res,403,{error:'Origin rejected'});
  if(await auth.route(req,res,url))return;
  const active=auth.current(req);if(!active)return reply(res,401,{error:'សូមចូលគណនីជាមុន។'});
  if(active.user.role==='owner'&&['POST','PUT','DELETE'].includes(req.method))return reply(res,403,{error:'គណនីម្ចាស់អាចមើលសរុបបានប៉ុណ្ណោះ។'});
  if(req.method==='DELETE'&&active.user.role!=='admin')return reply(res,403,{error:'មានតែ Admin អាចលុបកំណត់ត្រាបាន។'});
  if(req.method==='GET' && url.pathname==='/api/gifts') return reply(res,200,active.user.role==='owner'?gifts.map(g=>({id:g.id,side:g.side,payments:g.payments})):gifts);
  const match=url.pathname.match(/^\/api\/gifts\/([a-f0-9-]+)$/);
  if(['POST','PUT'].includes(req.method)) {
   if(!String(req.headers['content-type']).startsWith('application/json')) return reply(res,415,{error:'JSON required'});
   let raw=''; for await(const chunk of req) {raw+=chunk; if(raw.length>16384) return reply(res,413,{error:'Too large'});}
   let body; try {body=JSON.parse(raw);} catch {return reply(res,400,{error:'Invalid JSON'});}
   if(!auth.current(req))return reply(res,401,{error:'សូមចូលគណនីម្ដងទៀត។'});
   let clean; try {clean=valid(body);} catch(e){return reply(res,400,{error:e.message});}
   if(req.method==='POST' && url.pathname==='/api/gifts') {
    const gift={...clean,id:crypto.randomUUID(),createdAt:new Date().toISOString(),createdBy:active.user.id}; save([...gifts,gift]); return reply(res,201,gift);
   }
   if(req.method==='PUT' && match) {
    const old=gifts.find(g=>g.id===match[1]); if(!old)return reply(res,404,{error:'Not found'});
    const gift={...old,...clean,updatedAt:new Date().toISOString(),updatedBy:active.user.id};save(gifts.map(g=>g.id===gift.id?gift:g));return reply(res,200,gift);
   }
  }
  if(req.method==='DELETE' && match) {if(!gifts.some(g=>g.id===match[1]))return reply(res,404,{error:'Not found'});save(gifts.filter(g=>g.id!==match[1]));return reply(res,200,{ok:true});}
  return reply(res,404,{error:'Not found'});
 }
 if(req.method!=='GET')return reply(res,405,{error:'Method not allowed'});
 const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/auth-ui.js':'auth-ui.js','/owner-3d-bg.png':'owner-3d-bg.png','/owner-3d-mobile-bg.png':'owner-3d-mobile-bg.png'};
 const file=files[url.pathname]; if(!file)return reply(res,404,{error:'Not found'});
 res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.png')?'image/png':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});
 fs.createReadStream(path.join(ROOT,'public',file)).pipe(res);
 } catch(e) { const inputError=e instanceof SyntaxError || /JSON required|Invalid request|Request too large|លេខសម្ងាត់ត្រូវ|សូមបញ្ចូលឈ្មោះ/.test(e.message); if(!inputError)console.error(e); if(!res.headersSent)reply(res,inputError?400:500,{error:inputError?(e instanceof SyntaxError?'Invalid JSON':e.message):'មិនអាចរក្សាទុកបាន។ សូមព្យាយាមម្ដងទៀត។'});else res.end(); }
});
server.listen(Number(process.env.PORT||3000),'127.0.0.1',()=>console.log('Wedding app ready: http://localhost:'+(process.env.PORT||3000)));
