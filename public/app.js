'use strict';
let gifts=[],side='all',editing=null,deleting=null,busy=false,loaded=false;
const $=s=>document.querySelector(s),form=$('#gift-form'),dialog=$('#editor'),guestPicker=$('#guest-picker');
const sideNames={groom:'កូនកំលោះ',bride:'កូនក្រមុំ'},methodNames={cash:'សាច់ប្រាក់',aba:'ABA'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=(n,c)=>c==='USD'?'$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'៛'+n.toLocaleString('en-US',{maximumFractionDigits:0});
const fullName=g=>[g.name,g.nameSuffix].filter(Boolean).join(' ');
const entries=rows=>rows.flatMap(g=>g.payments);
const sum=(rows,c,m)=>entries(rows).filter(p=>p.currency===c&&(!m||p.method===m)).reduce((n,p)=>n+Math.round(p.amount*(c==='USD'?100:1)),0)/(c==='USD'?100:1);
function renderOwner3d(rows){const groom=rows.filter(g=>g.side==='groom'),bride=rows.filter(g=>g.side==='bride'),count=rs=>'ចំនួន '+rs.length+' · បានទួទាត់ '+rs.filter(g=>g.payments.length).length+' · មិនទួទាត់ '+rs.filter(g=>!g.payments.length).length;$('#owner-usd').textContent=money(sum(rows,'USD'),'USD');$('#owner-khr').textContent=money(sum(rows,'KHR'),'KHR');$('#owner-groom-usd').textContent=money(sum(groom,'USD'),'USD');$('#owner-groom-khr').textContent=money(sum(groom,'KHR'),'KHR');$('#owner-bride-usd').textContent=money(sum(bride,'USD'),'USD');$('#owner-bride-khr').textContent=money(sum(bride,'KHR'),'KHR');$('#owner-groom-count').textContent=count(groom);$('#owner-bride-count').textContent=count(bride);}
async function api(url,options={}){const r=await fetch(url,{...options,headers:{'Content-Type':'application/json',...options.headers}});const data=await r.json();if(!r.ok){if(r.status===401)window.WeddingAuth?.expired();throw Error(data.error||'មិនអាចភ្ជាប់បាន');}return data;}
function filtered(){
 const q=$('#search').value.trim().toLocaleLowerCase(),m=$('#methodFilter').value,c=$('#currencyFilter').value,state=$('#paymentStatus').value;
 return gifts.filter(g=>(side==='all'||g.side===side)&&(fullName(g)+' '+g.note).toLocaleLowerCase().includes(q)&&(state==='all'||(state==='received'?g.payments.length>0:g.payments.length===0)))
 .map(g=>({...g,payments:g.payments.filter(p=>(m==='all'||p.method===m)&&(c==='all'||p.currency===c))})).filter(g=>g.payments.length||(m==='all'&&c==='all')).reverse();
}
function applyStatusLabels(){
 const rename=s=>s.replaceAll('កំណត់ត្រា','ចំនួន').replaceAll('បានកត់ប្រាក់','បានទួទាត់').replaceAll('មិនទាន់កត់ប្រាក់','មិនទួទាត់');
 ['#count','#summaries','#results','#gift-list','#print-report'].forEach(selector=>{
  const root=$(selector);if(!root)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(node=>{node.nodeValue=rename(node.nodeValue);});
 });
}
function colorStatusLabels(){
 const decorate=element=>{if(!element)return;const text=element.textContent;element.innerHTML=text.replaceAll('ចំនួន','<span class="status-count">ចំនួន</span>').replaceAll('បានទួទាត់','<span class="status-paid">បានទួទាត់</span>').replaceAll('មិនទួទាត់','<span class="status-pending">មិនទួទាត់</span>');};
 decorate($('#count'));document.querySelectorAll('.side-heading>span').forEach(element=>{const numbers=element.textContent.match(/\d+/g)||[];element.className='status-summary';element.innerHTML='<span class="status-chip status-count">ចំនួន '+(numbers[0]||0)+'</span><span class="status-chip status-paid">បានទួទាត់ '+(numbers[1]||0)+'</span><span class="status-chip status-pending">មិនទួទាត់ '+(numbers[2]||0)+'</span>';});document.querySelectorAll('#print-report .print-count').forEach(decorate);
}
function render(){
 const receivedCount=gifts.filter(g=>g.payments.length).length,pendingCount=gifts.length-receivedCount;
 renderOwner3d(gifts);
 $('#count').textContent='ភ្ញៀវ '+gifts.length+' កំណត់ត្រា · បានកត់ប្រាក់ '+receivedCount+' · មិនទាន់កត់ប្រាក់ '+pendingCount;$('#usd').textContent=money(sum(gifts,'USD'),'USD');$('#khr').textContent=money(sum(gifts,'KHR'),'KHR');
 $('#summaries').innerHTML=['groom','bride'].map(s=>{const rows=gifts.filter(g=>g.side===s),received=rows.filter(g=>g.payments.length).length;return '<article class="side-card '+s+'"><div class="side-heading"><h3>'+sideNames[s]+'</h3><span>'+rows.length+' កំណត់ត្រា · បានកត់ប្រាក់ '+received+' · មិនទាន់កត់ប្រាក់ '+(rows.length-received)+'</span></div><div class="amounts"><span>'+money(sum(rows,'USD'),'USD')+'</span><span>'+money(sum(rows,'KHR'),'KHR')+'</span></div><div class="breakdown">'+['cash','aba'].map(m=>'<div><span>'+methodNames[m]+'</span><b>'+money(sum(rows,'USD',m),'USD')+' · '+money(sum(rows,'KHR',m),'KHR')+'</b></div>').join('')+'</div></article>';}).join('');
 const rows=filtered();$('#results').textContent=rows.length+' កំណត់ត្រា';
 $('#gift-list').innerHTML=rows.length?rows.map(g=>'<article class="gift-row"><div class="person"><span class="avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg></span><div><strong>'+esc(fullName(g))+'</strong><small>'+esc(g.note||new Date(g.createdAt).toLocaleDateString('en-GB'))+'</small></div></div><span class="badge '+g.side+'">'+sideNames[g.side]+'</span><span class="method">'+(g.payments.length?[...new Set(g.payments.map(p=>methodNames[p.method]))].join(' + '):'<span class="pending-label">មិនទាន់កត់ប្រាក់</span>')+'</span><span class="gift-amount">'+['USD','KHR'].filter(c=>g.payments.some(p=>p.currency===c)).map(c=>'<span>'+money(sum([g],c),c)+'</span>').join('')+(g.payments.length?'':'<span class="pending-label">—</span>')+'</span><div class="row-actions"><button data-edit="'+g.id+'" aria-label="កែប្រែ '+esc(fullName(g))+'">'+(g.payments.length?'កែ':'កែ / កត់ប្រាក់')+'</button><button data-delete="'+g.id+'" aria-label="លុប '+esc(fullName(g))+'">លុប</button></div></article>').join(''):'<div class="empty"><div class="empty-icon">♡</div><h3>'+(gifts.length?'រកមិនឃើញកំណត់ត្រា':'ចាប់ផ្តើមបញ្ចូលឈ្មោះភ្ញៀវ')+'</h3><p>'+(gifts.length?'សាកល្បងប្ដូរពាក្យស្វែងរក ឬជម្រើសតម្រង។':'ចុច «បន្ថែមភ្ញៀវ» ដើម្បីកត់ឈ្មោះជាមុន ហើយកត់ប្រាក់ចងដៃនៅពេលក្រោយ។')+'</p></div>';
 $('#export').disabled=!rows.length;$('#print').disabled=!rows.length;$('#backup').disabled=!loaded;
 renderPrint();applyStatusLabels();colorStatusLabels();window.WeddingAuth?.applyRole();
}
function paymentRow(p={amount:'',currency:'USD',method:'aba'}){
 const div=document.createElement('div');div.className='payment-row';
 div.innerHTML='<label>ចំនួនប្រាក់ *<input class="payment-amount" type="number" required min="0.01" max="1000000000" step="0.01" inputmode="decimal" placeholder="0.00" value="'+esc(p.amount)+'"></label><label>រូបិយប័ណ្ណ<div class="payment-choice currency-choice" role="group" aria-label="រូបិយប័ណ្ណ"><button type="button" data-value="USD">USD</button><button type="button" data-value="KHR">រៀល</button></div><span class="payment-currency" data-value="'+esc(p.currency)+'" hidden></span></label><label>ទទួលប្រាក់<div class="payment-choice method-choice" role="group" aria-label="ទទួលប្រាក់"><button type="button" data-value="aba">ABA</button><button type="button" data-value="cash">សាច់ប្រាក់</button></div><span class="payment-method" data-value="'+esc(p.method)+'" hidden></span></label><button type="button" class="remove-payment" aria-label="លុបជួរប្រាក់">×</button>';
 const currency=div.querySelector('.payment-currency'),method=div.querySelector('.payment-method');
 function select(group,input,value){input.dataset.value=value;group.querySelectorAll('button').forEach(b=>{const active=b.dataset.value===value;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});}
 const currencyChoice=div.querySelector('.currency-choice'),methodChoice=div.querySelector('.method-choice');
 currencyChoice.onclick=e=>{const b=e.target.closest('button');if(b)select(currencyChoice,currency,b.dataset.value);};
 methodChoice.onclick=e=>{const b=e.target.closest('button');if(b)select(methodChoice,method,b.dataset.value);};
 select(currencyChoice,currency,p.currency);select(methodChoice,method,p.method);
 function step(){const k=currency.dataset.value==='KHR',a=div.querySelector('.payment-amount');a.step=k?'1':'0.01';a.min=k?'1':'0.01';}
 currencyChoice.addEventListener('click',step);step();$('#payments').append(div);
 div.querySelector('.remove-payment').onclick=()=>{div.remove();paymentButtons();};paymentButtons();
}
function paymentButtons(){const rows=document.querySelectorAll('.payment-row');rows.forEach(r=>r.querySelector('button').disabled=false);$('#add-payment').disabled=rows.length>=20;$('#pending-payment-hint').hidden=rows.length>0;}

let paymentToastTimer;
function dismissPaymentNotification(){clearTimeout(paymentToastTimer);document.getElementById('payment-notification')?.remove();}
window.dismissPaymentNotification=dismissPaymentNotification;
function notifyPaymentSaved(gift,isEdit){
 dismissPaymentNotification();
 const toast=document.createElement('aside');toast.id='payment-notification';toast.className='payment-notification '+gift.side;
 toast.setAttribute('aria-label','Payment notification');
 const content=document.createElement('div');content.setAttribute('role','status');content.setAttribute('aria-live','polite');content.setAttribute('aria-atomic','true');
 const heading=document.createElement('strong');heading.textContent=gift.payments.length?(isEdit?'បានកែប្រែចងដៃ':'បានកត់ត្រាប្រាក់ចងដៃ'):(isEdit?'បានកែប្រែព័ត៌មានភ្ញៀវ':'បានបន្ថែមភ្ញៀវ');
 const name=document.createElement('p');name.textContent=fullName(gift)+' · '+sideNames[gift.side];
 const amounts=document.createElement('p');amounts.className='notification-amounts';amounts.textContent=gift.payments.length?gift.payments.map(p=>methodNames[p.method]+' '+money(p.amount,p.currency)).join(' + '):'មិនទាន់កត់ប្រាក់ចងដៃ';
 const caption=document.createElement('small');caption.textContent='បានរក្សាទុកលើកុំព្យូទ័រ ✓';
 const close=document.createElement('button');close.type='button';close.className='notification-close';close.setAttribute('aria-label','បិទ Notification');close.textContent='×';close.onclick=dismissPaymentNotification;
 content.append(heading,name,amounts,caption);toast.append(content,close);document.body.append(toast);
 const schedule=()=>{clearTimeout(paymentToastTimer);paymentToastTimer=setTimeout(dismissPaymentNotification,8000);};
 toast.addEventListener('mouseenter',()=>clearTimeout(paymentToastTimer));toast.addEventListener('mouseleave',()=>{if(!toast.contains(document.activeElement))schedule();});
 toast.addEventListener('focusin',()=>clearTimeout(paymentToastTimer));toast.addEventListener('focusout',schedule);schedule();
}

function updateNamePreview(){ $('#guest-name-preview').textContent=[form.elements.name.value.trim(),form.elements.nameSuffix.value.trim()].filter(Boolean).join(' '); }
form.elements.name.addEventListener('input',updateNamePreview);form.elements.nameSuffix.addEventListener('input',updateNamePreview);
function openEditor(g,guestOnly=false,paymentOnly=false){
 dismissPaymentNotification();
 editing=g?.id||null;form.reset();$('#form-error').textContent='';$('#form-title').textContent=g?'កែប្រែព័ត៌មានភ្ញៀវ':guestOnly?'បន្ថែមភ្ញៀវ':'កត់ប្រាក់ចងដៃ';
 if(g)for(const k of ['name','nameSuffix','side','note'])form.elements[k].value=g[k]||'';else if(side!=='all')form.elements.side.value=side;
 $('#payments').replaceChildren();(g?.payments?.length?g.payments:(guestOnly||!paymentOnly?[]:[{amount:'',currency:'USD',method:'aba'}])).forEach(paymentRow);paymentButtons();updateNamePreview();dialog.showModal();form.elements.name.focus();
}
$('#add-payment').onclick=()=>paymentRow();
$('#note-f2f').onclick=()=>{const n=form.elements.note;n.value=n.value.trim()?n.value.trim()+' · F2F':'F2F';n.focus();};
$('#add-guest').onclick=()=>openEditor(null,true);
function renderGuestPicker(){
 const query=$('#guest-picker-search').value.trim().toLocaleLowerCase();
 const rows=gifts.filter(g=>(fullName(g)+' '+(g.note||'')).toLocaleLowerCase().includes(query)).slice().reverse();
 $('#guest-picker-list').innerHTML=rows.length?rows.map(g=>'<button type="button" class="guest-picker-row" data-picker-id="'+esc(g.id)+'"><span><strong>'+esc(fullName(g))+'</strong><small>'+esc(g.note||sideNames[g.side])+'</small></span><b>'+sideNames[g.side]+'</b></button>').join(''):'<p class="empty picker-empty">រកមិនឃើញភ្ញៀវ។ សូមប្រើ «＋ បន្ថែមភ្ញៀវ» ប្រសិនបើជាភ្ញៀវថ្មី។</p>';
}
function openGuestPicker(){$('#guest-picker-search').value='';renderGuestPicker();guestPicker.showModal();$('#guest-picker-search').focus();}
$('#add').onclick=openGuestPicker;
$('#guest-picker-search').addEventListener('input',renderGuestPicker);
$('#guest-picker-list').onclick=e=>{const button=e.target.closest('[data-picker-id]');if(!button)return;const guest=gifts.find(g=>g.id===button.dataset.pickerId);if(guest){guestPicker.close();openEditor(guest,false,true);}};
$('#close').onclick=()=>{if(!busy)dialog.close();};
dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
form.onsubmit=async e=>{
 e.preventDefault();if(busy||!form.reportValidity())return;
 const body={name:form.elements.name.value,nameSuffix:form.elements.nameSuffix.value,side:form.elements.side.value,note:form.elements.note.value,payments:[...document.querySelectorAll('.payment-row')].map(r=>({amount:Number(r.querySelector('input').value),currency:r.querySelector('.payment-currency').dataset.value,method:r.querySelector('.payment-method').dataset.value}))};
 busy=true;const button=form.querySelector('[type=submit]');button.textContent='កំពុងរក្សាទុក...';$('#form-error').textContent='';
 const controls=[...form.elements];controls.forEach(c=>c.disabled=true);
 try{const saved=await api('/api/gifts'+(editing?'/'+editing:''),{method:editing?'PUT':'POST',body:JSON.stringify(body)});if(editing)gifts=gifts.map(g=>g.id===editing?saved:g);else gifts.push(saved);render();dialog.close();$('#status').textContent='បានរក្សាទុកព័ត៌មានភ្ញៀវលើកុំព្យូទ័ររួចរាល់។';notifyPaymentSaved(saved,!!editing);}
 catch(e){$('#form-error').textContent=e.message;}
 finally{busy=false;controls.forEach(c=>c.disabled=false);paymentButtons();button.textContent='រក្សាទុក';}
};
document.querySelectorAll('[data-side]').forEach(b=>b.onclick=()=>{side=b.dataset.side;document.querySelectorAll('[data-side]').forEach(t=>{t.classList.toggle('active',t===b);t.setAttribute('aria-pressed',String(t===b));});render();});
$('#paymentStatus option[value="pending"]').textContent='មិនទួទាត់';
$('#paymentStatus option[value="received"]').textContent='បានទួទាត់';
for(const id of ['search','methodFilter','currencyFilter','paymentStatus'])$('#'+id).addEventListener(id==='search'?'input':'change',render);
$('#gift-list').onclick=e=>{const edit=e.target.closest('[data-edit]'),del=e.target.closest('[data-delete]');if(edit)openEditor(gifts.find(g=>g.id===edit.dataset.edit));if(del){deleting=del.dataset.delete;$('#delete-name').textContent=fullName(gifts.find(g=>g.id===deleting));$('#delete-dialog').showModal();}};
$('#cancel-delete').onclick=()=>$('#delete-dialog').close();
$('#confirm-delete').onclick=async()=>{const button=$('#confirm-delete');button.disabled=true;try{await api('/api/gifts/'+deleting,{method:'DELETE'});gifts=gifts.filter(g=>g.id!==deleting);render();$('#delete-dialog').close();$('#status').textContent='បានលុបកំណត់ត្រា។';}catch(e){$('#status').textContent=e.message;}finally{button.disabled=false;}};
function download(content,type,name){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const dateTag=()=>new Date().toLocaleDateString('en-CA');
$('#export').onclick=()=>{
 const cell=v=>'"'+String(v??'').replace(/^[=+@\t\r-]/,"'$&").replace(/"/g,'""')+'"';
 const rows=[['លេខកំណត់ត្រា','ឈ្មោះភ្ញៀវ','ខាង','ចំនួនប្រាក់','រូបិយប័ណ្ណ','វិធីទទួលប្រាក់','កំណត់សម្គាល់','កាលបរិច្ឆេទ'],...filtered().flatMap(g=>(g.payments.length?g.payments:[null]).map(p=>[g.id,fullName(g),sideNames[g.side],p?p.amount:'',p?p.currency:'',p?methodNames[p.method]:'មិនទាន់កត់ប្រាក់',g.note,g.createdAt]))];
 download('\ufeff'+rows.map(r=>r.map(cell).join(',')).join('\r\n'),'text/csv;charset=utf-8;','wedding-gifts-'+dateTag()+'.csv');
};
$('#backup').onclick=()=>download(JSON.stringify({version:3,exportedAt:new Date().toISOString(),gifts},null,2),'application/json','wedding-backup-'+dateTag()+'.json');
function renderPrint(){
 const rows=filtered(),stateLabel={all:'ភ្ញៀវទាំងអស់',pending:'មិនទាន់កត់ប្រាក់',received:'បានកត់ប្រាក់'}[$('#paymentStatus').value],label=stateLabel+' · '+(side==='all'?'ទាំងពីរខាង':sideNames[side])+' · '+($('#methodFilter').value==='all'?'គ្រប់វិធីទទួលប្រាក់':methodNames[$('#methodFilter').value])+' · '+($('#currencyFilter').value==='all'?'USD និង KHR':$('#currencyFilter').value);
 const amounts=g=>['cash','aba'].flatMap(m=>['USD','KHR'].map(c=>'<td class="number">'+(g.payments.length?money(sum([g],c,m),c):'—')+'</td>')).join('');
 const totals=rs=>['cash','aba'].flatMap(m=>['USD','KHR'].map(c=>'<td class="number">'+money(sum(rs,c,m),c)+'</td>')).join('');
 const reportCounts=rs=>{const received=rs.filter(g=>g.payments.length).length;return 'កំណត់ត្រា '+rs.length+' · បានកត់ប្រាក់ '+received+' · មិនទាន់កត់ប្រាក់ '+(rs.length-received);};
 $('#print-report').innerHTML='<h1>បញ្ជីចងដៃមង្គលការ</h1><p>'+esc(label)+'<br>កាលបរិច្ឆេទ៖ '+esc(new Date().toLocaleString('en-GB'))+' · '+rows.length+' កំណត់ត្រា'+($('#search').value?' · ស្វែងរក៖ '+esc($('#search').value):'')+'</p><p>ប្រាក់សរុប៖ <b>'+money(sum(rows,'USD'),'USD')+' · '+money(sum(rows,'KHR'),'KHR')+'</b><br>ចំនួនភ្ញៀវ៖ <b>'+esc(reportCounts(rows))+'</b></p><table><colgroup><col style="width:5%"><col style="width:23%"><col style="width:13%"><col style="width:13%"><col style="width:13%"><col style="width:13%"><col style="width:20%"></colgroup><thead><tr><th rowspan="2">ល.រ</th><th rowspan="2">ឈ្មោះភ្ញៀវ / ខាង</th><th colspan="2">សាច់ប្រាក់</th><th colspan="2">ABA</th><th rowspan="2">កំណត់សម្គាល់</th></tr><tr><th>USD</th><th>KHR</th><th>USD</th><th>KHR</th></tr></thead><tbody>'+rows.map((g,i)=>'<tr><td>'+(i+1)+'</td><td><b>'+esc(fullName(g))+'</b><br><span class="'+g.side+'">'+sideNames[g.side]+'</span></td>'+amounts(g)+'<td class="print-note">'+esc(g.note)+(g.payments.length?'':'<br>មិនទាន់កត់ប្រាក់')+'</td></tr>').join('')+'</tbody></table><table class="print-totals"><colgroup><col style="width:5%"><col style="width:23%"><col style="width:13%"><col style="width:13%"><col style="width:13%"><col style="width:13%"><col style="width:20%"></colgroup><tbody>'+['groom','bride'].map(s=>'<tr><th colspan="2">'+sideNames[s]+'<br><span class="print-count">'+reportCounts(rows.filter(g=>g.side===s))+'</span></th>'+totals(rows.filter(g=>g.side===s))+'<td></td></tr>').join('')+'<tr><th colspan="2">សរុបទាំងអស់<br><span class="print-count">'+reportCounts(rows)+'</span></th>'+totals(rows)+'<td></td></tr></tbody></table><p class="print-foot">បោះពុម្ពតាមបញ្ជីដែលបានជ្រើសរើស។ USD និង KHR គិតដាច់ដោយឡែក។</p>';
}
window.addEventListener('beforeprint',()=>{renderPrint();applyStatusLabels();colorStatusLabels();});
$('#print').onclick=async()=>{renderPrint();applyStatusLabels();colorStatusLabels();if(document.fonts)await document.fonts.ready;window.print();};
async function init(){try{gifts=await api('/api/gifts');loaded=true;render();}catch(e){$('#status').textContent='មិនអាចផ្ទុកទិន្នន័យបាន។ សូមពិនិត្យ Server ហើយ Refresh ម្ដងទៀត។';for(const id of ['add','add-guest','export','print','backup'])$('#'+id).disabled=true;}}
window.weddingLoad=init;

$('#sidebar-add').onclick=()=>$('#add-guest').click();
document.querySelectorAll('.sidebar-nav a').forEach(a=>a.onclick=()=>{document.querySelectorAll('.sidebar-nav a').forEach(b=>b.classList.toggle('active',a===b));});
