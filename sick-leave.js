(function(){
  const frame=document.getElementById('appFrame');
  if(!frame)return;
  frame.addEventListener('load',()=>{
    const w=frame.contentWindow,d=frame.contentDocument;
    const main=d.querySelector('main'); if(!main||d.getElementById('sickLeaveSection'))return;
    const sec=d.createElement('section');
    sec.id='sickLeaveSection';
    sec.className='bg-white dark:bg-slate-900/80 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4';
    sec.innerHTML=`<div><h3 class="font-bold text-slate-900 dark:text-white">🏥 Больничный и декрет</h3><p class="text-xs text-slate-500 dark:text-slate-400">Россия / Тюменская область. Расчёт ориентировочный, по правилам СФР.</p></div>
    <div class="grid grid-cols-2 gap-3"><div><label class="text-xs text-slate-500">Причина</label><select id="slReason" class="w-full rounded-xl p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"><option value="illness">Обычная болезнь/травма</option><option value="pregnancy">Беременность и роды</option><option value="care">Уход за больным членом семьи</option></select></div><div><label class="text-xs text-slate-500">Официально</label><select id="slOfficial" class="w-full rounded-xl p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"><option value="yes">Да, есть ЭЛН</option><option value="no">Нет</option></select></div></div>
    <div class="grid grid-cols-2 gap-3"><div><label class="text-xs text-slate-500">С</label><input id="slStart" type="date" class="w-full rounded-xl p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"></div><div><label class="text-xs text-slate-500">По</label><input id="slEnd" type="date" class="w-full rounded-xl p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"></div></div>
    <div class="grid grid-cols-2 gap-3"><div><label class="text-xs text-slate-500">Страховой стаж, лет</label><input id="slYears" type="number" min="0" step="0.1" value="8" class="w-full rounded-xl p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"></div><div><label class="text-xs text-slate-500">Средний заработок за 2 года (₽)</label><input id="slTwoYearIncome" type="number" min="0" placeholder="Напр. 1200000" class="w-full rounded-xl p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"></div></div>
    <div id="slPregnancyPreset" class="hidden"><label class="text-xs text-slate-500">Декретный период</label><select id="slPregDays" class="w-full rounded-xl p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"><option value="140">140 дней — стандарт</option><option value="156">156 дней — осложнённые роды</option><option value="194">194 дня — многоплодная беременность</option><option value="manual">Вручную по датам</option></select></div>
    <button id="slCalc" class="w-full bg-blue-600 text-white font-bold py-3 rounded-xl">Рассчитать и сохранить</button><div id="slResult" class="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm"></div>`;
    main.appendChild(sec);
    const reason=sec.querySelector('#slReason'), preset=sec.querySelector('#slPregnancyPreset');
    reason.onchange=()=>preset.classList.toggle('hidden',reason.value!=='pregnancy');
    const key=()=>{try{const t=w.eval('calculatedTotals');return 'mz_sick_'+t.currentYear+'-'+String(t.currentMonth).padStart(2,'0')}catch(e){return 'mz_sick_unknown'}};
    function daysBetween(a,b){if(!a||!b)return 0;const x=new Date(a+'T00:00:00'),y=new Date(b+'T00:00:00');return Math.floor((y-x)/86400000)+1}
    function pct(years){return years>=8?1:years>=5?.8:.6}
    function render(data){
      const official=data.official==='yes'; let days=daysBetween(data.start,data.end); let gross=0; let note='';
      if(data.reason==='pregnancy'&&data.pregDays!=='manual')days=Number(data.pregDays)||140;
      if(!official){gross=0;note='Без официального ЭЛН пособие по больничному/декрету приложением не начисляется.';}
      else if(data.reason==='pregnancy'){
        const avg=(Number(data.twoYearIncome)||0)/730; gross=avg*days; note='Беременность и роды: 100% среднего заработка, стаж не уменьшает процент.';
      }else{
        const avg=(Number(data.twoYearIncome)||0)/730; gross=avg*pct(Number(data.years)||0)*days; note='Обычный больничный: первые 3 дня обычно оплачивает работодатель, далее СФР; при уходе за членом семьи СФР платит с 1-го дня.';
      }
      const net=data.reason==='pregnancy'?gross:gross*.87;
      sec.querySelector('#slResult').innerHTML=`<div><b>Дней:</b> ${days}</div><div><b>Ориентировочно начислено:</b> ${Math.round(gross).toLocaleString('ru-RU')} ₽</div><div><b>Ориентировочно на руки:</b> ${Math.round(net).toLocaleString('ru-RU')} ₽</div><div class="mt-2 text-xs text-slate-500">${note} Тюменский районный коэффициент и минимум по МРОТ могут влиять на точную сумму.</div>`;
    }
    sec.querySelector('#slCalc').onclick=()=>{
      const data={reason:reason.value,official:sec.querySelector('#slOfficial').value,start:sec.querySelector('#slStart').value,end:sec.querySelector('#slEnd').value,years:Number(sec.querySelector('#slYears').value)||0,twoYearIncome:Number(sec.querySelector('#slTwoYearIncome').value)||0,pregDays:sec.querySelector('#slPregDays').value};
      localStorage.setItem(key(),JSON.stringify(data));render(data);
    };
    try{const saved=JSON.parse(localStorage.getItem(key())||'null');if(saved){reason.value=saved.reason;sec.querySelector('#slOfficial').value=saved.official;sec.querySelector('#slStart').value=saved.start||'';sec.querySelector('#slEnd').value=saved.end||'';sec.querySelector('#slYears').value=saved.years??8;sec.querySelector('#slTwoYearIncome').value=saved.twoYearIncome||'';sec.querySelector('#slPregDays').value=saved.pregDays||'140';preset.classList.toggle('hidden',saved.reason!=='pregnancy');render(saved);}}catch(e){}
  });
})();