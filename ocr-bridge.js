(function(){
  const frame = document.getElementById('appFrame');
  if (!frame) return;

  function numbers(line){
    return (line.match(/\d{1,2}/g) || []).map(Number).filter(n => n >= 1 && n <= 31);
  }

  function parseScheduleText(text){
    const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const found = new Map();

    // Common calendar OCR pattern: one line has day numbers, the next line has hours.
    for (let i = 0; i < lines.length - 1; i++) {
      const days = numbers(lines[i]).filter(n => n <= 31);
      const hrs = numbers(lines[i + 1]).filter(n => n >= 1 && n <= 24);
      if (days.length >= 1 && days.length === hrs.length) {
        const likelyHours = hrs.filter(h => [4,6,8,10,11,12,13,14,15,16,18,20,22,24].includes(h)).length;
        if (likelyHours >= Math.ceil(hrs.length / 2)) {
          days.forEach((d, idx) => {
            const h = hrs[idx];
            if (d >= 1 && d <= 31 && h >= 1 && h <= 24) found.set(d, h);
          });
        }
      }
    }

    // Fallback for OCR that returns day/hour pairs in reading order.
    if (found.size < 2) {
      const all = (text.match(/\d{1,2}/g) || []).map(Number);
      for (let i = 0; i < all.length - 1; i += 2) {
        const d = all[i], h = all[i + 1];
        if (d >= 1 && d <= 31 && h >= 4 && h <= 24) found.set(d, h);
      }
    }

    return [...found.entries()].sort((a,b)=>a[0]-b[0]);
  }

  async function ensureTesseract(win){
    if (win.Tesseract) return;
    await new Promise((resolve, reject) => {
      const s = win.document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Tesseract.js yuklanmadi'));
      win.document.head.appendChild(s);
    });
  }

  frame.addEventListener('load', async () => {
    const win = frame.contentWindow;
    try {
      await ensureTesseract(win);
    } catch (e) {
      console.error(e);
      return;
    }

    const original = win.callGeminiAssistant;
    win.callGeminiAssistant = async function(userQuery, imageObj){
      if (!imageObj || !imageObj.dataUrl) {
        return typeof original === 'function'
          ? original.call(win, userQuery, imageObj)
          : 'Rasm yuboring.';
      }

      try {
        const worker = await win.Tesseract.createWorker('eng', 1, {
          logger: m => console.log('OCR', m.status, m.progress || '')
        });
        await worker.setParameters({
          tessedit_char_whitelist: '0123456789- ',
          preserve_interword_spaces: '1'
        });
        const result = await worker.recognize(imageObj.dataUrl, { rotateAuto: true });
        await worker.terminate();

        const pairs = parseScheduleText(result.data.text || '');
        if (!pairs.length) {
          return '📷 Rasm o‘qildi, lekin smena kunlari va soatlarini ishonchli ajrata olmadim. Rasmni faqat grafik qismi ko‘rinadigan qilib kesib, aniqroq yuboring.';
        }

        const tags = pairs.map(([day,hours]) =>
          `[[ACTION:${JSON.stringify({type:'SET_SHIFT',day,hours,hasTaxi:true})}]]`
        ).join('\n');

        const summary = pairs.map(([d,h]) => `${d} — ${h} soat`).join(', ');
        return `📷 Brauzer OCR orqali ${pairs.length} ta smena topildi: ${summary}.\n${tags}`;
      } catch (e) {
        console.error('Browser OCR error', e);
        return '📷 Brauzer OCR xato berdi. Internetni tekshiring va rasmni qayta yuboring.';
      }
    };

    console.log('Free browser OCR bridge enabled');
  });
})();
