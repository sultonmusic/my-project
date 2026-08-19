(function(){
  const frame = document.getElementById('appFrame');
  if (!frame) return;

  const APP_VERSION = 'v0.0.2';

  function addVersionFooter(doc){
    const old=doc.getElementById('appVersionFooter');
    if(old){ old.textContent=APP_VERSION; return; }
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
    return String(s||'')
      .replace(/\b(?:итого|скидка|вычет|полная цена|цена|кол-во|количество|шт|руб|рублей|р|50%|x|х)\b/gi,' ')
      .replace(/\d+[.,]\d+/g,' ')
      .replace(/\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?/g,' ')
      .replace(/\d+\s*(?:шт|x|х)/gi,' ')
      .replace(/\d{2,7}\s*(?:₽|р\.?|руб(?:лей)?|R)/gi,' ')
      .replace(/\b\d+\b/g,' ')
      .replace(/[=:_|%+*]+/g,' ')
      .replace(/\s+/g,' ')
      .replace(/^[^A-Za-zА-Яа-яЁё]+|[^A-Za-zА-Яа-яЁё]+$/g,'')
      .trim();
  }

  function nameScore(name){
    const letters=(name.match(/[A-Za-zА-Яа-яЁё]/g)||[]).length;
    const words=name.split(/\s+/).filter(Boolean).length;
    let score=letters + Math.min(words,4)*2;
    if(/ранчо/i.test(name)) score+=20;
    if(/шампин/i.test(name)) score+=15;
    if(/халоп|холод|хлеб/i.test(name)) score+=8;
    return score;
  }

  function plausibleName(name){
    if(!name) return false;
    const letters=(name.match(/[A-Za-zА-Яа-яЁё]/g)||[]).length;
    if(letters<3) return false;
    if(/^(?:x|х|r|р|руб|шт|итого|скидка|цена)$/i.test(name.trim())) return false;
    return true;
  }

  function moneyValues(line){
    const vals=[];
    for(const m of line.matchAll(/(\d{2,7})\s*(?:₽|р\.?|руб(?:лей)?|R)\b?/gi)) vals.push(Number(m[1]));
    if(!vals.length){
      for(const m of line.matchAll(/(?:^|\s)(\d{2,6})(?=\s|$)/g)){
        const n=Number(m[1]); if(n>=20) vals.push(n);
      }
    }
    return vals;
  }

  function parseFoodText(text){
    const rawLines=text.split(/\r?\n/).map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean);
    const items=[];

    for(let i=0;i<rawLines.length;i++){
      const line=rawLines[i];
      if(/(итог|вычет|чистая|заработ|дата|кол-во|полная цена|расход|питани|наименование|что купили)/i.test(line)) continue;

      const money=moneyValues(line);
      if(!money.length) continue;

      const nearby=[];
      const same=cleanProductName(line);
      if(plausibleName(same)) nearby.push(same);

      for(let d=1;d<=3;d++){
        if(i-d>=0){
          const c=cleanProductName(rawLines[i-d]);
          if(plausibleName(c) && !moneyValues(rawLines[i-d]).length) nearby.push(c);
        }
        if(i+d<rawLines.length){
          const c=cleanProductName(rawLines[i+d]);
          if(plausibleName(c) && !moneyValues(rawLines[i+d]).length) nearby.push(c);
        }
      }

      nearby.sort((a,b)=>nameScore(b)-nameScore(a));
      const name=nearby[0];
      if(!name) continue; // junk nom bilan xarid qo‘shmaymiz

      let price=Math.max(...money);
      // Cardlarda 2 x 640 = 1280 va -50%=640 bo‘lishi mumkin. Eng katta son ko‘pincha to‘liq narx.
      if(price>0) items.push({name:name.slice(0,80),price});
    }

    const unique=[]; const seen=new Set();
    for(const x of items){
      const normalized=x.name.toLowerCase().replace(/[^a-zа-яё0-9]+/gi,' ').trim();
      if(normalized.length<3) continue;
      const k=normalized+'|'+x.price;
      if(!seen.has(k)){seen.add(k);unique.push(x);}
    }
    return unique.slice(0,12);
  }

  async function preprocessImage(win,dataUrl){
    return await new Promise((resolve,reject)=>{
      const img=new win.Image();
      img.onload=()=>{
        try{
          const scale=Math.max(2, Math.min(3, 1800/img.width));
          const c=win.document.createElement('canvas');
          c.width=Math.round(img.width*scale); c.height=Math.round(img.height*scale);
          const ctx=c.getContext('2d');
          ctx.imageSmoothingEnabled=true;
          ctx.drawImage(img,0,0,c.width,c.height);
          const data=ctx.getImageData(0,0,c.width,c.height);
          const p=data.data;
          for(let i=0;i<p.length;i+=4){
            const g=0.299*p[i]+0.587*p[i+1]+0.114*p[i+2];
            const v=g>205?255:(g<70?0:Math.max(0,Math.min(255,(g-128)*1.7+128)));
            p[i]=p[i+1]=p[i+2]=v;
          }
          ctx.putImageData(data,0,0);
          resolve(c.toDataURL('image/png'));
        }catch(e){ resolve(dataUrl); }
      };
      img.onerror=()=>resolve(dataUrl);
      img.src=dataUrl;
    });
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

    try{ await ensureTesseract(win); }catch(e){ console.error(e); return; }
    const original=win.callGeminiAssistant;

    win.callGeminiAssistant=async function(userQuery,imageObj){
      if(!imageObj||!imageObj.dataUrl){
        return typeof original==='function' ? original.call(win,userQuery,imageObj) : 'Rasm yuboring.';
      }
      try{
        const prepared=await preprocessImage(win,imageObj.dataUrl);
        const worker=await win.Tesseract.createWorker('rus+eng',1,{logger:m=>console.log('OCR',m.status,m.progress||'')});
        await worker.setParameters({
          preserve_interword_spaces:'1',
          tessedit_pageseg_mode:'6'
        });
        const result=await worker.recognize(prepared,{rotateAuto:true});
        await worker.terminate();
        const text=(result.data.text||'').trim();

        if(isFoodImage(text)){
          const items=parseFoodText(text);
          if(items.length){
            const today=new Date().toISOString().split('T')[0];
            const tags=items.map(x=>`[[ACTION:${JSON.stringify({type:'ADD_FOOD',date:today,name:x.name,count:1,price:x.price})}]]`).join('\n');
            const summary=items.map(x=>`${x.name} — ${x.price} ₽`).join(', ');
            return `🧾 Xarid rasmi aniqlandi. ${items.length} ta mahsulot nomi va narxi topildi: ${summary}.\n${tags}`;
          }
          return `🧾 Xarid rasmi aniqlandi, lekin mahsulot nomini ishonchli o‘qiy olmadim. Noto‘g‘ri nom kiritmaslik uchun xarid avtomatik qo‘shilmadi. Rasmda mahsulot nomi va narx qismini kattaroq qilib yuboring. OCR: **${text.slice(0,700)||'matn topilmadi'}**`;
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