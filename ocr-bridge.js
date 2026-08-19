(function(){
  const frame = document.getElementById('appFrame');
  if (!frame) return;

  const APP_VERSION = 'v0.0.4';

  function addVersionFooter(doc){
    if (doc.getElementById('appVersionFooter')) return;
    const footer = doc.createElement('div');
    footer.id = 'appVersionFooter';
    footer.textContent = APP_VERSION;
    footer.style.cssText = 'text-align:center;padding:18px 12px 105px;color:#64748b;font:600 12px system-ui;letter-spacing:.04em;';
    doc.body.appendChild(footer);
  }

  function money(v, currency='₽'){
    const n = Math.round(Number(v)||0);
    return n.toLocaleString('ru-RU') + ' ' + currency;
  }

  function getTotals(win){
    try { return win.eval('calculatedTotals'); } catch(e) { return null; }
  }

  function getMonthKey(t){
    if(!t) return 'unknown';
    return String(t.currentYear) + '-' + String(t.currentMonth).padStart(2,'0');
  }

  function loadPayoutData(win){
    const t=getTotals(win), key='mz_payout_reconcile_'+getMonthKey(t);
    try { return JSON.parse(win.localStorage.getItem(key)||'{}'); } catch(e) { return {}; }
  }

  function savePayoutData(win,data){
    const t=getTotals(win), key='mz_payout_reconcile_'+getMonthKey(t);
    win.localStorage.setItem(key,JSON.stringify(data));
    return key;
  }

  function calcReconcile(win,data){
    const t=getTotals(win)||{};
    const advExpected=Number(t.advNet)||0, salExpected=Number(t.salNet)||0;
    const advReceived=Number(data.advReceived)||0, salReceived=Number(data.salReceived)||0;
    const advDiff=advExpected-advReceived, salDiff=salExpected-salReceived;
    return {advExpected,salExpected,advReceived,salReceived,advDiff,salDiff,totalExpected:advExpected+salExpected,totalReceived:advReceived+salReceived,totalDiff:advDiff+salDiff,currency:t.currency||'₽',monthName:t.monthNameYear||''};
  }

  function reconcileStatus(diff){ return diff>0?'Недоплата':diff<0?'Переплата':'Совпадает'; }

  function addPayoutSection(win,doc){
    if(doc.getElementById('payoutReconcileSection')) return;
    const main=doc.querySelector('main'); if(!main) return;
    const section=doc.createElement('section');
    section.id='payoutReconcileSection';
    section.className='bg-white dark:bg-slate-900/80 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4';
    section.innerHTML=`
      <div class="flex items-center gap-2"><span class="text-emerald-500 text-lg">💳</span><div><h3 class="font-bold text-slate-900 dark:text-white">Фактически полученные выплаты</h3><p class="text-xs text-slate-500 dark:text-slate-400">Введите сколько реально получили — приложение покажет недоплату или переплату.</p></div></div>
      <div class="grid grid-cols-2 gap-3"><div><label class="text-xs text-slate-500 dark:text-slate-400 block mb-1">Получено аванса</label><input id="advReceivedInput" type="number" min="0" step="1" placeholder="0" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-3 font-bold focus:outline-none focus:border-emerald-500"></div><div><label class="text-xs text-slate-500 dark:text-slate-400 block mb-1">Получено зарплаты</label><input id="salReceivedInput" type="number" min="0" step="1" placeholder="0" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-3 font-bold focus:outline-none focus:border-emerald-500"></div></div>
      <textarea id="payoutNoteInput" rows="2" placeholder="Комментарий, например: выдали наличными 25 числа" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-emerald-500"></textarea>
      <button id="savePayoutBtn" type="button" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl">Сохранить и проверить выплату</button>
      <div id="payoutSaveNotice" style="display:none" class="rounded-xl px-3 py-3 text-sm font-bold"></div>
      <div id="payoutResult" class="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm"></div>
      <p class="text-[11px] text-slate-500 dark:text-slate-400">Эта сверка автоматически попадёт в PDF-отчёт для бухгалтерии.</p>`;
    main.appendChild(section);
    const data=loadPayoutData(win);
    section.querySelector('#advReceivedInput').value=data.advReceived??''; section.querySelector('#salReceivedInput').value=data.salReceived??''; section.querySelector('#payoutNoteInput').value=data.note||'';

    function currentData(){ return {advReceived:Number(section.querySelector('#advReceivedInput').value)||0,salReceived:Number(section.querySelector('#salReceivedInput').value)||0,note:section.querySelector('#payoutNoteInput').value.trim()}; }
    function render(){
      const r=calcReconcile(win,currentData()), el=section.querySelector('#payoutResult');
      const cls=r.totalDiff>0?'text-rose-500':r.totalDiff<0?'text-amber-500':'text-emerald-500';
      el.innerHTML=`<div class="grid grid-cols-2 gap-2 text-xs"><div>Должны аванс: <b>${money(r.advExpected,r.currency)}</b></div><div>Получено: <b>${money(r.advReceived,r.currency)}</b></div><div>Должны ЗП: <b>${money(r.salExpected,r.currency)}</b></div><div>Получено: <b>${money(r.salReceived,r.currency)}</b></div></div><div class="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 font-bold ${cls}">${reconcileStatus(r.totalDiff)}: ${money(Math.abs(r.totalDiff),r.currency)}</div>`;
    }
    function showNotice(ok,text){ const n=section.querySelector('#payoutSaveNotice'); n.style.display='block'; n.textContent=text; n.className='rounded-xl px-3 py-3 text-sm font-bold '+(ok?'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30':'bg-rose-500/15 text-rose-500 border border-rose-500/30'); }
    section.querySelector('#savePayoutBtn').onclick=function(){
      const btn=this, d={...currentData(),savedAt:new Date().toISOString()};
      try{
        savePayoutData(win,d); render();
        const r=calcReconcile(win,d); const label=r.totalDiff>0?`Недоплата ${money(r.totalDiff,r.currency)}`:r.totalDiff<0?`Переплата ${money(Math.abs(r.totalDiff),r.currency)}`:'Расхождений нет';
        showNotice(true,'✅ Сохранено. '+label+'. Данные добавлены в отчёт для PDF.');
        btn.textContent='✓ Сохранено'; btn.disabled=true; setTimeout(()=>{btn.textContent='Сохранить и проверить выплату';btn.disabled=false;},1400);
      }catch(e){ console.error(e); showNotice(false,'❌ Не удалось сохранить. Попробуйте ещё раз.'); }
    };
    section.querySelectorAll('input,textarea').forEach(el=>el.addEventListener('input',()=>{render(); const n=section.querySelector('#payoutSaveNotice'); if(n)n.style.display='none';}));
    render();
  }

  function injectPdfReconcile(win,doc){
    const tpl=doc.getElementById('pdfReportTemplate'); if(!tpl) return;
    let box=doc.getElementById('pdfPayoutReconcile'); if(!box){box=doc.createElement('div');box.id='pdfPayoutReconcile';box.style.cssText='margin:14px 20px 20px;border:1px solid #cbd5e1;border-radius:8px;padding:12px;font-family:Segoe UI,Arial,sans-serif;';tpl.appendChild(box);}
    const data=loadPayoutData(win),r=calcReconcile(win,data),conclusion=r.totalDiff>0?`Недоплата ${money(r.totalDiff,r.currency)}`:r.totalDiff<0?`Переплата ${money(Math.abs(r.totalDiff),r.currency)}`:'Расхождений нет';
    box.innerHTML=`<div style="font-size:15px;font-weight:800;margin-bottom:8px;color:#0f172a;">Сверка фактически полученных выплат</div><table style="width:100%;border-collapse:collapse;font-size:11px;"><tr><th style="border:1px solid #cbd5e1;padding:6px;text-align:left;">Выплата</th><th style="border:1px solid #cbd5e1;padding:6px;">Начислено к выплате</th><th style="border:1px solid #cbd5e1;padding:6px;">Получено фактически</th><th style="border:1px solid #cbd5e1;padding:6px;">Разница</th></tr><tr><td style="border:1px solid #cbd5e1;padding:6px;">Аванс</td><td style="border:1px solid #cbd5e1;padding:6px;">${money(r.advExpected,r.currency)}</td><td style="border:1px solid #cbd5e1;padding:6px;">${money(r.advReceived,r.currency)}</td><td style="border:1px solid #cbd5e1;padding:6px;">${reconcileStatus(r.advDiff)} ${money(Math.abs(r.advDiff),r.currency)}</td></tr><tr><td style="border:1px solid #cbd5e1;padding:6px;">Зарплата</td><td style="border:1px solid #cbd5e1;padding:6px;">${money(r.salExpected,r.currency)}</td><td style="border:1px solid #cbd5e1;padding:6px;">${money(r.salReceived,r.currency)}</td><td style="border:1px solid #cbd5e1;padding:6px;">${reconcileStatus(r.salDiff)} ${money(Math.abs(r.salDiff),r.currency)}</td></tr><tr><td style="border:1px solid #cbd5e1;padding:6px;font-weight:700;">Итого</td><td style="border:1px solid #cbd5e1;padding:6px;font-weight:700;">${money(r.totalExpected,r.currency)}</td><td style="border:1px solid #cbd5e1;padding:6px;font-weight:700;">${money(r.totalReceived,r.currency)}</td><td style="border:1px solid #cbd5e1;padding:6px;font-weight:700;">${conclusion}</td></tr></table>${data.note?`<div style="margin-top:8px;font-size:10px;color:#475569;"><b>Комментарий сотрудника:</b> ${String(data.note).replace(/[<>]/g,'')}</div>`:''}<div style="margin-top:8px;font-size:10px;color:#64748b;">Отчёт сформирован приложением «Моя Зарплата», версия ${APP_VERSION}. Данные о фактически полученных суммах введены пользователем.</div>`;
  }
  function patchPdf(win,doc){const originalPdf=win.generatePdfReport;if(typeof originalPdf!=='function'||originalPdf.__reconcilePatched)return;const wrapped=function(){injectPdfReconcile(win,doc);return originalPdf.apply(this,arguments);};wrapped.__reconcilePatched=true;win.generatePdfReport=wrapped;}

  function nums(s){return(s.match(/\d{1,2}/g)||[]).map(Number);}
  function parseScheduleText(text){const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),found=new Map();for(let i=0;i<lines.length-1;i++){const days=nums(lines[i]).filter(n=>n>=1&&n<=31),hrs=nums(lines[i+1]).filter(n=>n>=1&&n<=24);if(days.length>=2&&days.length===hrs.length){const good=hrs.filter(h=>[4,6,8,10,11,12,13,14,15,16,18,20,22,24].includes(h)).length;if(good>=Math.ceil(hrs.length*.7))days.forEach((d,j)=>found.set(d,hrs[j]));}}return[...found.entries()].sort((a,b)=>a[0]-b[0]);}
  function isFoodImage(text){return/(расход|питани|покуп|купил|цена|итого|руб|₽|шт|скидк|товар|чек|ранчо|шампин|халоп|food|price|total)/i.test(text.toLowerCase());}
  function cleanProductName(s){return s.replace(/\b(?:итого|скидка|вычет|полная цена|цена|кол-во|количество|шт|руб|рублей|р)\b/gi,' ').replace(/\d+[.,]\d+/g,' ').replace(/\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?/g,' ').replace(/\d+\s*(?:шт|x|х)/gi,' ').replace(/\d{2,7}\s*(?:₽|р\.?|руб(?:лей)?)/gi,' ').replace(/[=:_|]+/g,' ').replace(/\s+/g,' ').replace(/^[^A-Za-zА-Яа-яЁё]+|[^A-Za-zА-Яа-яЁё)]+$/g,'').trim();}
  function goodName(s){const t=s.trim();return t.length>=3&&/[A-Za-zА-Яа-яЁё]{3}/.test(t)&&!/^(x|х|r|р|руб|шт|итого|скидка|total|price)$/i.test(t)&&!/50\s*%|\d{3,}/.test(t);}
  function parseFoodText(text){const rawLines=text.split(/\r?\n/).map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean),items=[];for(let i=0;i<rawLines.length;i++){const line=rawLines[i];if(/(итог|вычет|чистая|заработ|дата|кол-во|полная цена|расход|питани|наименование|что купили)/i.test(line))continue;const vals=[...line.matchAll(/(\d{2,7})\s*(?:₽|р\.?|руб(?:лей)?)/gi)].map(m=>Number(m[1]));let name=cleanProductName(line);if(vals.length){const candidates=[];for(let j=Math.max(0,i-2);j<=Math.min(rawLines.length-1,i+1);j++){if(j===i)continue;const c=cleanProductName(rawLines[j]);if(goodName(c))candidates.push(c);}if(!goodName(name)&&candidates.length)name=candidates.sort((a,b)=>b.length-a.length)[0];if(goodName(name))items.push({name:name.slice(0,80),price:Math.max(...vals)});}else if(goodName(name)&&i+1<rawLines.length){const nm=[...rawLines[i+1].matchAll(/(\d{2,7})\s*(?:₽|р\.?|руб(?:лей)?)/gi)].map(m=>Number(m[1]));if(nm.length)items.push({name:name.slice(0,80),price:Math.max(...nm)});}}const unique=[],seen=new Set();for(const x of items){const normalized=x.name.toLowerCase().replace(/[^a-zа-яё0-9]+/gi,' ').trim(),k=normalized+'|'+x.price;if(normalized.length>=3&&!seen.has(k)){seen.add(k);unique.push(x);}}return unique.slice(0,12);}
  async function prepareImage(win,dataUrl){return await new Promise(resolve=>{const img=new win.Image();img.onload=()=>{try{const maxW=2200,scale=Math.max(2,Math.min(3,maxW/img.width)),c=win.document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);const ctx=c.getContext('2d');ctx.filter='grayscale(1) contrast(1.45)';ctx.drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.95));}catch(e){resolve(dataUrl);}};img.onerror=()=>resolve(dataUrl);img.src=dataUrl;});}
  async function ensureTesseract(win){if(win.Tesseract)return;await new Promise((resolve,reject)=>{const s=win.document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';s.onload=resolve;s.onerror=()=>reject(new Error('Tesseract.js yuklanmadi'));win.document.head.appendChild(s);});}

  frame.addEventListener('load',async()=>{const win=frame.contentWindow,doc=frame.contentDocument;addVersionFooter(doc);addPayoutSection(win,doc);patchPdf(win,doc);try{win.history.scrollRestoration='manual';}catch(e){}try{win.scrollTo(0,0);}catch(e){}try{await ensureTesseract(win);}catch(e){console.error(e);return;}const original=win.callGeminiAssistant;win.callGeminiAssistant=async function(userQuery,imageObj){if(!imageObj||!imageObj.dataUrl)return typeof original==='function'?original.call(win,userQuery,imageObj):'Rasm yuboring.';try{const prepared=await prepareImage(win,imageObj.dataUrl),worker=await win.Tesseract.createWorker('eng+rus',1,{logger:m=>console.log('OCR',m.status,m.progress||'')}),result=await worker.recognize(prepared,{rotateAuto:true});await worker.terminate();const text=(result.data.text||'').trim();if(isFoodImage(text)){const items=parseFoodText(text);if(items.length){const today=new Date().toISOString().split('T')[0],tags=items.map(x=>`[[ACTION:${JSON.stringify({type:'ADD_FOOD',date:today,name:x.name,count:1,price:x.price})}]]`).join('\n'),summary=items.map(x=>`${x.name} — ${x.price} ₽`).join(', ');return `🧾 Rasm xarid/ovqat rasmi sifatida aniqlandi. ${items.length} ta pozitsiya topildi: ${summary}.\n${tags}`;}return `🧾 Xarid rasmi aniqlandi, lekin mahsulot nomi yoki narxini ishonchli ajrata olmadim. OCR matni: **${text.slice(0,700)||'matn topilmadi'}**`;}const pairs=parseScheduleText(text);if(pairs.length>=2){const tags=pairs.map(([day,hours])=>`[[ACTION:${JSON.stringify({type:'SET_SHIFT',day,hours,hasTaxi:true})}]]`).join('\n');return `📷 Grafik aniqlandi. ${pairs.length} ta smena topildi: ${pairs.map(([d,h])=>`${d} — ${h} soat`).join(', ')}.\n${tags}`;}return `📷 Rasm o‘qildi, lekin uni ishonchli grafik deb aniqlamadim, shuning uchun kalendarga hech narsa qo‘shmadim. OCR: **${text.slice(0,700)||'matn topilmadi'}**`;}catch(e){console.error('Browser OCR error',e);return'📷 Brauzer OCR xato berdi. Internetni tekshiring va rasmni qayta yuboring.';}};});
})();