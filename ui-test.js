const {chromium}=require('@playwright/test'),{spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'wedding-ui-'));let server,browser;
 try{
 server=spawn(process.execPath,[path.join(__dirname,'server.js')],{env:{...process.env,PORT:'3098',WEDDING_DATA:path.join(temp,'gifts.json')}});
 await new Promise((r,j)=>{const t=setTimeout(()=>j(Error('Server timeout')),7000);server.stdout.once('data',()=>{clearTimeout(t);r()});server.once('exit',c=>{clearTimeout(t);j(Error('Server exit '+c))});});
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3098');await page.waitForFunction(()=>document.querySelector('#auth-title').textContent.includes('Admin'));await page.fill('#auth-name','Test Admin');await page.fill('#auth-form [name=username]','testadmin');await page.fill('#auth-password','Test-Admin-Only-2026!');await page.click('#auth-submit');await page.waitForSelector('.empty');
 await page.click('#add-guest');await page.fill('[name=name]','សុខ ដារ៉ា');await page.fill('[name=note]','F2F');await page.click('#gift-form .save');await page.waitForSelector('.gift-row');
 await page.click('#add');await page.fill('#guest-picker-search','សុខ ដារ៉ា');await page.click('.guest-picker-row');await page.fill('.payment-amount','50');await page.click('#add-payment');
 await page.locator('.payment-row').nth(1).locator('input').fill('50');await page.locator('.payment-row').nth(1).locator('.method-choice button[data-value="aba"]').click();
 await page.click('#gift-form .save');await page.waitForSelector('.gift-row');
 await page.waitForSelector('#payment-notification');assert.ok((await page.locator('#payment-notification').innerText()).includes('សុខ ដារ៉ា'));assert.ok((await page.locator('#payment-notification').innerText()).includes('ABA $50.00'));await page.locator('#payment-notification button').click();assert.equal(await page.locator('#payment-notification').count(),0);
 assert.equal(await page.locator('#usd').innerText(),'$100.00');assert.ok((await page.locator('.gift-row .method').innerText()).includes('ABA'));assert.ok((await page.locator('.gift-row').innerText()).includes('F2F'));
 await page.click('[data-edit]');assert.equal(await page.locator('.payment-row').count(),2);await page.fill('[name=name]','សុខ ដារ៉ា កែថ្មី');await page.fill('[name=note]','F2F កែ Note');await page.locator('.payment-amount').first().fill('75');
 await page.click('#add-payment');const third=page.locator('.payment-row').nth(2);await third.locator('.currency-choice button[data-value="KHR"]').click();await third.locator('.method-choice button[data-value="aba"]').click();await third.locator('input').fill('200000');await page.click('#gift-form .save');
 await page.waitForFunction(()=>document.querySelector('#usd').textContent==='$125.00');assert.equal(await page.locator('#khr').innerText(),'៛200,000');
 await page.reload();await page.waitForSelector('.gift-row');assert.ok((await page.locator('.gift-row').innerText()).includes('F2F កែ Note'));
 await page.click('#add');await page.fill('#guest-picker-search','សុខ ដារ៉ា');assert.equal(await page.locator('.guest-picker-row').count(),1);await page.click('.guest-picker-row');assert.equal(await page.locator('#editor').isVisible(),true);await page.click('#close');
 await page.selectOption('#methodFilter','aba');assert.ok((await page.locator('.gift-amount').innerText()).includes('$125.00'));assert.equal(await page.locator('#print-report tbody').first().locator('tr').count(),1);
 assert.ok((await page.locator('#print-report').textContent()).includes('$125.00'));
 await page.selectOption('#methodFilter','all');await page.click('[data-side=bride]');assert.equal(await page.locator('.gift-row').count(),0);await page.click('[data-side=all]');
 await page.fill('#search','កែ Note');assert.equal(await page.locator('.gift-row').count(),1);await page.fill('#search','');
 await page.screenshot({path:path.join(__dirname,'updated-desktop-preview.png'),fullPage:true});
 await page.click('[data-edit]');await page.screenshot({path:path.join(__dirname,'updated-form-preview.png'),fullPage:true});await page.click('#close');
 const exported=page.waitForEvent('download');await page.click('#export');const csv=await exported;assert.ok(csv.suggestedFilename().endsWith('.csv'));
 const backupDownload=page.waitForEvent('download');await page.click('#backup');const backup=await backupDownload;const backupPath=await backup.path();const parsed=JSON.parse(fs.readFileSync(backupPath,'utf8'));assert.equal(parsed.gifts[0].payments.length,3);
 await page.emulateMedia({media:'print'});assert.equal(await page.locator('main').isVisible(),false);assert.equal(await page.locator('#print-report').isVisible(),true);
 await page.pdf({path:path.join(__dirname,'print-test-sample.pdf'),preferCSSPageSize:true,printBackground:true});
 await page.screenshot({path:path.join(__dirname,'print-layout-preview.png'),fullPage:true});assert.ok(fs.statSync(path.join(__dirname,'print-test-sample.pdf')).size>10000);
 await page.emulateMedia({media:'screen'});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.click('[data-edit]');assert.equal(await page.evaluate(()=>document.querySelector('dialog').scrollWidth>document.querySelector('dialog').clientWidth),false);await page.click('#close');
 await page.click('[data-delete]');await page.click('#confirm-delete');await page.waitForSelector('.empty');assert.deepEqual(errors,[]);
 console.log('PASS UI: split cash/ABA, mixed currencies, edit and persisted note/name/amount, payment/side/note filters, CSV, JSON backup, large-print PDF, mobile form overflow, delete. Real data unchanged.');
 }finally{if(browser)await browser.close();if(server){const p=new Promise(r=>server.once('exit',r));server.kill();await p;}fs.rmSync(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
