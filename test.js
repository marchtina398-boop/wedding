const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'wedding-test-')),data=path.join(folder,'gifts.json'),base='http://127.0.0.1:3097';
const legacy={id:'00000000-0000-4000-a000-000000000001',createdAt:new Date().toISOString(),name:'ភ្ញៀវចាស់',side:'groom',currency:'USD',method:'cash',amount:25,note:'original'};
fs.writeFileSync(data,JSON.stringify([legacy]));let child,cookie;
async function boot(){child=spawn(process.execPath,[path.join(__dirname,'server.js')],{env:{...process.env,PORT:'3097',WEDDING_DATA:data},stdio:['ignore','pipe','pipe']});await new Promise((r,j)=>{const t=setTimeout(()=>j(Error('timeout')),7000);child.stdout.once('data',()=>{clearTimeout(t);r()});child.once('exit',c=>{clearTimeout(t);j(Error('exit '+c))});});const state=await (await fetch(base+'/api/auth/me')).json();const login=await fetch(base+(state.setupRequired?'/api/auth/setup':'/api/auth/login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'testadmin',name:'Test Admin',password:'Test-Admin-Only-2026!'})});if(!login.ok)throw Error('Test login failed');cookie=login.headers.get('set-cookie').split(';')[0];}
async function stop(){if(child&&!child.killed){const done=new Promise(r=>child.once('exit',r));child.kill();await done;}}
async function call(route='',method='GET',body){const r=await fetch(base+'/api/gifts'+route,{method,headers:{'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined});return [r.status,await r.json()];}
(async()=>{try{
 await boot();let rows=(await call())[1];assert.deepEqual(rows[0].payments,[{amount:25,currency:'USD',method:'cash'}]);assert.equal(rows[0].note,'original');assert.equal((await fetch(base)).status,200);
 const input={name:'សុខ ដារ៉ា',side:'bride',note:'F2F',payments:[{amount:50,currency:'USD',method:'cash'},{amount:50,currency:'USD',method:'aba'},{amount:200000,currency:'KHR',method:'aba'}]};
 const [status,g]=await call('','POST',input);assert.equal(status,201);assert.equal(g.payments.length,3);
 for(const bad of [[{amount:0,currency:'USD',method:'cash'}],[{amount:1.5,currency:'KHR',method:'aba'}],[{amount:1.001,currency:'USD',method:'cash'}],[{amount:2,currency:'USD',method:'x'}],null])assert.equal((await call('','POST',{...input,payments:bad}))[0],400);
 const edited=(await call('/'+g.id,'PUT',{...input,name:'ឈ្មោះថ្មី',note:'កំណត់សម្គាល់ថ្មី F2F',payments:[{amount:75,currency:'USD',method:'cash'},{amount:50000,currency:'KHR',method:'aba'}]}))[1];
 assert.equal(edited.name,'ឈ្មោះថ្មី');assert.equal(edited.payments[0].amount,75);
 await stop();await boot();rows=(await call())[1];assert.equal(rows.length,2);assert.equal(rows[0].payments[0].amount,25);assert.equal(rows[1].note,'កំណត់សម្គាល់ថ្មី F2F');assert.equal(rows[1].payments[1].amount,50000);
 assert.equal((await call('/'+g.id,'DELETE'))[0],200);assert.equal((await call())[1].length,1);
 console.log('PASS API: legacy data preservation, split cash/ABA and mixed currencies, validation, edit name/note/amount, restart persistence, delete.');
 }finally{await stop();fs.rmSync(folder,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1});
