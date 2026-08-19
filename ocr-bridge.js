(function(){
  const frame = document.getElementById('appFrame');
  if (!frame) return;

  const APP_VERSION = 'v0.0.1';

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

  function cleanProductName(s){
    return s
      .replace(/\b(?:итого|скидка|вычет|полная цена|цена|кол-во|количество|шт|руб|рублей|р)\b/gi,' ')
      .replace(/\d+[.,]\d+/g,' ')
      .replace(/\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?/g,' ')
      .replace(/\d+\s*(?:шт|x|х)/gi,' ')
      .replace(/\d{2,7}\s*(?:₽|р\.?|руб(?:лей)?)/gi,' ')
      .replace(/[=:_|]+/g,' ')
      .replace(/\s+/g,' ')
      .replace(/^[^A-Za-zА-Яа-яЁё]+|[^A-Za-zА-Яа-яЁё)]+$/g,'')
      .trim();
  }

  function parseFoodText(text){
    const rawLines=text.split(/\r?\n/).map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean);
    const items=[];

    for(let i=0;i<rawLines.length;i++){
      const line=rawLines[i];
      if(/(итог|вычет|чистая|заработ|дата|кол-во|полная цена|расход|питани|наименование|что купили)/i.test(line)) continue;

      const money=[...line.matchAll(/(\d{2,7})\s*(?:₽|р\.?|руб(?:лей)?)/gi)].map(m=>Number(m[1]));
      let name=cleanProductName(line);

      // If OCR split product name and price across neighboring lines, join them.
      if(!money.length && name.length>=2 && i+1<rawLines.length){
        const next=rawLines[i+1];
        const nextMoney=[...next.matchAll(/(\d{2,7})\s*(?:₽|р\.?|руб(?:лей)?)/gi)].map(m=>Number(m[1]));
        if(nextMoney.length){
          const extra=cleanProductName(next);
          const combined=[name,extra].filter(Boolean).join(' ').trim();
          items.push({name:combined.slice(0,80),price:Math.max(...nextMoney)});
          i++;
          continue;
        }
      }

      if(money.length){
        // Prefer alphabetic text before the first price; useful for cards like “С Ранчо Дона 2 шт x 640₽”.
        const firstPricePos=line.search(/\d{2,7}\s*(?:₽|р\.?|руб(?:лей)?)/i);
        if(firstPricePos>0){
          const before=cleanProductName(line.slice(0,firstPricePos));
          if(before.length>=2) name=before;
        }
        if(name.length>=2){
          items.push({name:name.slice(0,80),price:Math.max(...money)});
        }
      }
    }

    // Extra heuristic for known card/list style: date on one line, product name on the next, price after that.
    for(let i=0;i<rawLines.length-2;i++){
      if(/^\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?$/.test(rawLines[i])){
        const candidate=cleanProductName(rawLines[i+1]);
        const money=[...rawLines[i+2].matchAll(/(\d{2,7})\s*(?:₽|р\.?|руб(?:лей)?)/gi)].map(m=>Number(m[1]));
        if(candidate.length>=2 && money.length){
          items.push({name:candidate.slice(0,80),price:Math.max(...money)});
        }
      }
    }

    const unique=[]; const seen=new Set();
    for(const x of items){
      const normalized=x.name.toLowerCase().replace(/[^a-zа-яё0-9]+/gi,' ').trim();
      if(normalized.length<2) continue;
      const k=normalized+'|'+x.price;
      if(!seen.has(k)){seen.add(k);unique.push(x);}
    }
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

        if(isFoodImage(text)){
          const items=parseFoodText(text);
          if(items.length){
            const today=new Date().toISOString().split('T')[0];
            const tags=items.map(x=>`[[ACTION:${JSON.stringify({type:'ADD_FOOD',date:today,name:x.name,count:1,price:x.price})}]]`).join('\n');
            const summary=items.map(x=>`${x.name} — ${x.price} ₽`).join(', ');
            return `🧾 Rasm xarid/ovqat rasmi sifatida aniqlandi. ${items.length} ta pozitsiya topildi: ${summary}.\n${tags}`;
          }
          return `🧾 Xarid rasmi aniqlandi, lekin mahsulot nomi yoki narxini ishonchli ajrata olmadim. OCR matni: **${text.slice(0,700)||'matn topilmadi'}**`;
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