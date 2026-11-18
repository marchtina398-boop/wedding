const {chromium}=require('@playwright/test'),{spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const temp=fs.mkdtempSync(path.join(os.tmpdir(),'wedding-auth-'));let server,browser;
 const base='http://localhost:3099',password='Test-Admin-Only-2026!',staffPassword='Test-Staff-Only-2026!';
 async function req(route,method='GET',body,cookie=''){const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 try{
 server=spawn(process.execPath,[path.join(__dirname,'server.js')],{env:{...process.env,PORT:'3099',WEDDING_DATA:path.join(temp,'gifts.json')}});
 await new Promise((r,j)=>{const t=setTimeout(()=>j(Error('Server timeout')),7000);server.stdout.once('data',()=>{clearTimeout(t);r()});server.once('exit',c=>{clearTimeout(t);j(Error('Server exit '+c))});});
 assert.equal((await req('/api/gifts')).status,401);assert.equal((await req('/api/users')).status,401);
 assert.equal((await req('/api/auth/me')).data.setupRequired,true);
 browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.waitForFunction(()=>document.querySelector('#auth-title').textContent.includes('Admin'));
 await page.fill('#auth-name','ម្ចាស់កម្មវិធី');await page.fill('#auth-form [name=username]','owner');await page.fill('#auth-password',password);await page.click('#auth-submit');await page.waitForSelector('main:not([hidden]) .empty');
 assert.equal(await page.locator('#manage-users').isVisible(),true);
 const cookies=await context.cookies(),adminCookie=cookies.map(c=>c.name+'='+c.value).join(';');assert.equal(cookies[0].httpOnly,true);assert.equal(cookies[0].sameSite,'Strict');
 assert.equal((await req('/api/auth/setup','POST',{username:'hacker',name:'X',password})).status,403);
 await page.click('#manage-users');await page.fill('#user-form [name=displayName]','អ្នកកត់ចងដៃ');await page.fill('#user-form [name=username]','recorder');await page.fill('#user-form [name=password]',staffPassword);await page.click('#user-form [type=submit]');await page.waitForFunction(()=>document.querySelector('#user-list').textContent.includes('recorder'));
 const users=(await req('/api/users','GET',undefined,adminCookie)).data;assert.equal(users.length,2);assert.ok(!JSON.stringify(users).includes('salt'));assert.ok(!JSON.stringify(users).includes('hash'));
 const staff=users.find(u=>u.username==='recorder');const staffLogin=await req('/api/auth/login','POST',{username:'recorder',password:staffPassword}),staffCookie=staffLogin.cookie;assert.equal(staffLogin.status,200);
 const gift=await req('/api/gifts','POST',{name:'ភ្ញៀវសាកល្បង',side:'groom',note:'F2F',payments:[{amount:50,currency:'USD',method:'cash'},{amount:50,currency:'USD',method:'aba'}]},staffCookie);assert.equal(gift.status,201);assert.equal(gift.data.createdBy,staff.id);
 assert.equal((await req('/api/gifts/'+gift.data.id,'DELETE',undefined,staffCookie)).status,403);assert.equal((await req('/api/users','GET',undefined,staffCookie)).status,403);assert.equal((await req('/api/users','POST',{name:'No',username:'nope',role:'admin',password},staffCookie)).status,403);
 const updated=await req('/api/gifts/'+gift.data.id,'PUT',{...gift.data,note:'បានកែ'},staffCookie);assert.equal(updated.status,200);assert.equal(updated.data.updatedBy,staff.id);
 await page.click('[data-close-dialog=users-dialog]');await page.reload();await page.waitForSelector('.gift-row');assert.ok((await page.locator('.gift-row').innerText()).includes('បានកែ'));
 await page.click('#logout');await page.waitForSelector('#login-panel:not([hidden])');assert.equal((await req('/api/gifts','GET',undefined,adminCookie)).status,401);assert.equal(await page.locator('#print-report').textContent(),'');
 await page.fill('#auth-form [name=username]','recorder');await page.fill('#auth-password',staffPassword);await page.click('#auth-submit');await page.waitForSelector('.gift-row');assert.equal(await page.locator('#manage-users').isVisible(),false);assert.equal(await page.locator('[data-delete]').isVisible(),false);
 const a2=await req('/api/auth/login','POST',{username:'owner',password});const admin2=a2.cookie;
 const noSelf=await req('/api/users/'+users.find(u=>u.username==='owner').id,'PATCH',{disabled:true},admin2);assert.equal(noSelf.status,400);
 assert.equal((await req('/api/users/'+staff.id,'PATCH',{disabled:true},admin2)).status,200);assert.equal((await req('/api/gifts','GET',undefined,staffCookie)).status,401);assert.equal((await req('/api/auth/login','POST',{username:'recorder',password:staffPassword})).status,401);
 await page.reload();await page.waitForSelector('#login-panel:not([hidden])');assert.equal(await page.locator('main').isVisible(),false);
 await req('/api/users/'+staff.id,'PATCH',{disabled:false},admin2);await req('/api/users/'+staff.id,'PATCH',{password:'Reset-Staff-2026-Long!'},admin2);assert.equal((await req('/api/auth/login','POST',{username:'recorder',password:'Reset-Staff-2026-Long!'})).status,200);
 await page.fill('#auth-form [name=username]','owner');await page.fill('#auth-password',password);await page.click('#auth-submit');await page.waitForSelector('.gift-row');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.click('#change-password');await page.fill('#password-form [name=currentPassword]',password);await page.fill('#password-form [name=password]','Changed-Admin-2026-Long!');await page.fill('#password-form [name=confirm]','Changed-Admin-2026-Long!');await page.click('#password-form [type=submit]');await page.waitForSelector('#login-panel:not([hidden])');
 assert.equal((await req('/api/auth/login','POST',{username:'owner',password})).status,401);assert.equal((await req('/api/auth/login','POST',{username:'owner',password:'Changed-Admin-2026-Long!'})).status,200);
 for(let i=0;i<5;i++)assert.equal((await req('/api/auth/login','POST',{username:'missing',password:'wrong'})).status,401);assert.equal((await req('/api/auth/login','POST',{username:'missing',password:'wrong'})).status,429);
 const stored=fs.readFileSync(path.join(temp,'users.json'),'utf8');assert.ok(!stored.includes(password));assert.ok(!stored.includes(staffPassword));assert.ok(stored.includes('"hash"'));
 const csrf=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:'http://evil.test','Content-Type':'application/json'},body:JSON.stringify({username:'owner',password})});assert.equal(csrf.status,403);
 assert.deepEqual(errors,[]);console.log('PASS AUTH: initial admin setup, HTTP-only sessions, login/logout, staff permissions, shared records, user creation/disable/reset, own password change, session revocation, CSRF, rate limiting, hashed passwords, mobile login. Real records untouched.');
 }finally{if(browser)await browser.close();if(server){const done=new Promise(r=>server.once('exit',r));server.kill();await done;}fs.rmSync(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
