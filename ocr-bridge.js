(function(){
  const frame = document.getElementById('appFrame');
  if (!frame) return;

  const APP_VERSION = 'v0.0.0';

  function addVersionFooter(doc){
    if (doc.getElementById('appVersionFooter')) return;
    const footer = doc.createElement('div');
    footer.id = 'appVersionFooter';
    footer.textContent = APP_VERSION;
    footer.style.cssText = 'text-align:center;padding:18px 12px 105px;color:#64748b;font:600 12px system-ui;letter-spacing:.04em;';
    doc.body.appendChild(footer);
  }

  function nums(s){ return (s.match(/\d{1,2}/g)||[]).map(Number); }

  function parseScheduleText(text){
    const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean), found=new Map();
    for(let i=0;i<lines.length-1;i++){
      const days=nums(lines[i]).filter(n=>n>=1&&n<=31);
      const hrs=nums(lines[i+1]).filter(n=>n>=1&&n<=24);
      if(days.length>=2 && days.length===hrs.length){
        const good=hrs.filter(h=>[4,6,8,10,11,12,13,14,15,16,18,20,22,24].includes(h)).length;
        if(good>=Math.ceil(hrs.length*.7)) days.forEach((d,j)=>found.set(d,hrs[j]));
      }
    }
    return [...found.entries()].sort((a,b)=>a[0]-b[0]);
  }

  function isFoodImage(text){
    const t=text.toLowerCase();
    return /(расход|питани|покуп|купил|цена|итого|руб|₽|шт|скидк|товар|чек|ранчо|шампин|халоп|food|price|total)/i.test(t);
  }

  function parseFoodText(text){
    const lines=text.split(/\r?\n/).map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean);
    const items=[];
    for(const line of lines){
      if(/(итог|вычет|чистая|заработ|дата|кол-во|полная цена|расход|питани)/i.test(line)) continue;
      const money=[...line.matchAll(/(\d{2,6})\s*(?:₽|р\.?|руб)/gi)].map(m=>Number(m[1]));
      if(!money.length) continue;
      let name=line.replace(/\d+[.,]\d+[.,]\d+/g,'').replace(/\d+\s*(?:шт|x|х)/gi,'').replace(/\d{2,6}\s*(?:₽|р\.?|руб)/gi,'').replace(/[-=]/g,' ').trim();
      name=name.replace(/^\d{1,2}[.\/]\d{1,2}\s*/,'').trim();
      if(name.length<2) continue;
      const price=Math.max(...money);
      if(price>0) items.push({name:name.slice(0,60),price});
    }
    const unique=[]; const seen=new Set();
    for(const x of items){ const k=x.name.toLowerCase()+'|'+x.price; if(!seen.has(k)){seen.add(k);unique.push(x);} }
    return unique.slice(0,12);
  }

  async function ensureTesseract(win){
    if(win.Tesseract) return;
    await new Promise((resolve,reject)=>{
      const s=win.document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      s.onload=resolve; s.onerror=()=>reject(new Error('Tesseract.js yuklanmadi'));
      win.document.head.appendChild(s);
    });
  }

  frame.addEventListener('load', async ()=>{
    const win=frame.contentWindow, doc=frame.contentDocument;
    addVersionFooter(doc);
    try { win.history.scrollRestoration='manual'; } catch(e){}
    try { win.scrollTo(0,0); } catch(e){}

    try{ await ensureTesseract(win); }catch(e){ console.error(e); return; }
    const original=win.callGeminiAssistant;

    win.callGeminiAssistant=async function(userQuery,imageObj){
      if(!imageObj||!imageObj.dataUrl){
        return typeof original==='function' ? original.call(win,userQuery,imageObj) : 'Rasm yuboring.';
      }
      try{
        const worker=await win.Tesseract.createWorker('eng+rus',1,{logger:m=>console.log('OCR',m.status,m.progress||'')});
        const result=await worker.recognize(imageObj.dataUrl,{rotateAuto:true});
        await worker.terminate();
        const text=(result.data.text||'').trim();

        // MUHIM: xarid/ovqat rasmini hech qachon smena sifatida kalendarga qo‘shmaymiz.
        if(isFoodImage(text)){
          const items=parseFoodText(text);
          if(items.length){
            const today=new Date().toISOString().split('T')[0];
            const tags=items.map(x=>`[[ACTION:${JSON.stringify({type:'ADD_FOOD',date:today,name:x.name,count:1,price:x.price})}]]`).join('\n');
            const summary=items.map(x=>`${x.name} — ${x.price} ₽`).join(', ');
            return `🧾 Rasm xarid/ovqat cheki sifatida aniqlandi. ${items.length} ta pozitsiya topildi: ${summary}.\n${tags}`;
          }
          return `🧾 Bu rasm grafik emas, xarid/ovqat rasmi sifatida aniqlandi. OCR matni: **${text.slice(0,700)||'matn topilmadi'}**. Narx va mahsulot nomi aniq ko‘rinadigan rasm yuboring.`;
        }

        const pairs=parseScheduleText(text);
        if(pairs.length>=2){
          const tags=pairs.map(([day,hours])=>`[[ACTION:${JSON.stringify({type:'SET_SHIFT',day,hours,hasTaxi:true})}]]`).join('\n');
          return `📷 Grafik aniqlandi. ${pairs.length} ta smena topildi: ${pairs.map(([d,h])=>`${d} — ${h} soat`).join(', ')}.\n${tags}`;
        }

        return `📷 Rasm o‘qildi, lekin uni ishonchli grafik deb aniqlamadim, shuning uchun kalendarga hech narsa qo‘shmadim. OCR: **${text.slice(0,700)||'matn topilmadi'}**`;
      }catch(e){
        console.error('Browser OCR error',e);
        return '📷 Brauzer OCR xato berdi. Internetni tekshiring va rasmni qayta yuboring.';
      }
    };
  });
})();