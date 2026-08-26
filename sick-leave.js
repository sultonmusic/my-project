(function () {
  const frame = document.getElementById('appFrame');
  if (!frame) return;

  frame.addEventListener('load', () => {
    const w = frame.contentWindow;
    const d = frame.contentDocument;
    if (!d || d.getElementById('sickLeavePage')) return;

    try {
      w.eval(`
        window.__sickGetAppData = () => JSON.parse(JSON.stringify(appData));
        window.__sickSaveLeaves = leaves => {
          appData.sickLeaves = leaves;
          saveToLocalStorage();
        };
        window.__sickGetReportContext = () => ({
          year: currentDate.getFullYear(),
          month: currentDate.getMonth(),
          title: calculatedTotals.monthNameYear || ''
        });
      `);
    } catch (error) {
      console.error('Sick leave bridge error', error);
      return;
    }

    const getData = () => w.__sickGetAppData?.() || {};
    const getLeaves = () => getData().sickLeaves || [];
    const saveLeaves = leaves => w.__sickSaveLeaves?.(leaves);

    function parseDate(value) {
      return value ? new Date(value + 'T00:00:00') : null;
    }
    function dateKey(date) {
      return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
    }
    function addDays(date, days) {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
    }
    function daysBetween(start, end) {
      const a = parseDate(start), b = parseDate(end);
      return a && b && b >= a ? Math.floor((b - a) / 86400000) + 1 : 0;
    }
    function insuranceRate(years, reason) {
      if (reason === 'pregnancy') return 1;
      return years >= 8 ? 1 : years >= 5 ? 0.8 : 0.6;
    }
    function reasonName(reason) {
      return reason === 'pregnancy' ? 'Беременность и роды' :
        reason === 'care' ? 'Уход за больным членом семьи' : 'Болезнь / травма';
    }
    function calculate(record) {
      const days = daysBetween(record.start, record.end);
      const dailyBase = (Number(record.twoYearIncome) || 0) / 730;
      const dailyGross = record.official === 'yes' ? dailyBase * insuranceRate(Number(record.years) || 0, record.reason) : 0;
      const gross = dailyGross * days;
      const net = record.reason === 'pregnancy' ? gross : gross * 0.87;
      return { days, dailyGross, gross, net };
    }
    function lastWorkedShift() {
      const shifts = getData().shifts || {};
      const dates = Object.keys(shifts)
        .filter(key => Number(shifts[key]?.hours) > 0)
        .sort();
      return dates.length ? dates[dates.length - 1] : '';
    }
    function suggestedStart() {
      const last = lastWorkedShift();
      return last ? dateKey(addDays(parseDate(last), 1)) : dateKey(new Date());
    }

    const menu = d.getElementById('mainMenuDropdown');
    if (!menu) return;

    const menuButton = d.createElement('button');
    menuButton.id = 'sickLeaveMenuButton';
    menuButton.className = 'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left hover:bg-rose-50 dark:hover:bg-rose-950/30';
    const resetButton = [...menu.querySelectorAll('button')].find(button => button.textContent.includes('Сбросить данные'));
    menu.insertBefore(menuButton, resetButton || null);

    const page = d.createElement('section');
    page.id = 'sickLeavePage';
    page.className = 'hidden fixed inset-0 z-[80] bg-slate-100 dark:bg-slate-950 overflow-y-auto p-4 pb-24';
    page.innerHTML = `
      <div class="max-w-md mx-auto bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
        <div class="flex items-start justify-between">
          <div><h2 class="text-lg font-extrabold text-slate-900 dark:text-white">🏥 Открыть больничный</h2><p class="text-xs text-slate-500 mt-1">Ориентировочный расчёт по данным пользователя</p></div>
          <button id="slPageClose" class="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div id="slAnalysis" class="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-xs text-blue-800 dark:text-blue-200"></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="text-xs text-slate-500">Причина</label><select id="slReason" class="w-full rounded-xl p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"><option value="illness">Болезнь / травма</option><option value="pregnancy">Беременность и роды</option><option value="care">Уход за членом семьи</option></select></div>
          <div><label class="text-xs text-slate-500">Электронный больничный</label><select id="slOfficial" class="w-full rounded-xl p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"><option value="yes">Да, есть ЭЛН</option><option value="no">Нет</option></select></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="text-xs text-slate-500">С</label><input id="slStart" type="date" class="w-full rounded-xl p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"></div>
          <div><label class="text-xs text-slate-500">По</label><input id="slEnd" type="date" class="w-full rounded-xl p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"></div>
        </div>
        <button id="slAutoStart" class="w-full py-2 rounded-xl border border-blue-300 text-blue-700 dark:text-blue-300 text-xs font-bold">Определить начало после последней смены</button>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="text-xs text-slate-500">Страховой стаж, лет</label><input id="slYears" type="number" min="0" step="0.1" value="8" class="w-full rounded-xl p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"></div>
          <div><label class="text-xs text-slate-500">Заработок за 2 года, ₽</label><input id="slIncome" type="number" min="0" placeholder="1200000" class="w-full rounded-xl p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"></div>
        </div>
        <div id="slPreview" class="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm"></div>
        <button id="slOpen" class="w-full bg-blue-600 text-white font-bold py-3 rounded-xl">Открыть больничный</button>
        <p class="text-[10px] text-slate-400 leading-relaxed">Расчёт ориентировочный. Точную сумму определяют работодатель и СФР с учётом МРОТ, предельной базы, районного коэффициента и исключаемых периодов.</p>
      </div>`;
    d.body.appendChild(page);

    const $ = selector => page.querySelector(selector);
    function preview() {
      const record = {
        reason: $('#slReason').value,
        official: $('#slOfficial').value,
        start: $('#slStart').value,
        end: $('#slEnd').value,
        years: Number($('#slYears').value) || 0,
        twoYearIncome: Number($('#slIncome').value) || 0
      };
      const calc = calculate(record);
      $('#slPreview').innerHTML = `<div><b>Календарных дней:</b> ${calc.days}</div><div><b>Ориентировочно начислено:</b> ${Math.round(calc.gross).toLocaleString('ru-RU')} ₽</div><div><b>Ориентировочно на руки:</b> ${Math.round(calc.net).toLocaleString('ru-RU')} ₽</div>`;
    }
    function fillAutoDates() {
      const last = lastWorkedShift();
      const start = suggestedStart();
      $('#slStart').value = start;
      if (!$('#slEnd').value || $('#slEnd').value < start) $('#slEnd').value = start;
      $('#slAnalysis').innerHTML = last
        ? `Последняя рабочая смена: <b>${last}</b>. Больничный автоматически начинается со следующего дня: <b>${start}</b>.`
        : `Рабочие смены не найдены. Предложена текущая дата: <b>${start}</b>.`;
      preview();
    }
    function openPage() {
      d.getElementById('mainMenuDropdown')?.classList.add('hidden');
      fillAutoDates();
      page.classList.remove('hidden');
      d.body.style.overflow = 'hidden';
    }
    function closePage() {
      page.classList.add('hidden');
      d.body.style.overflow = '';
    }
    function activeLeave() {
      return getLeaves().find(item => item.active);
    }
    function syncMenu() {
      const active = activeLeave();
      menuButton.innerHTML = active
        ? '<i class="fa-solid fa-calendar-xmark w-5 text-rose-500"></i><span class="text-sm font-semibold">Закрыть больничный</span>'
        : '<i class="fa-solid fa-briefcase-medical w-5 text-rose-500"></i><span class="text-sm font-semibold">Открыть больничный</span>';
    }
    function closeActiveLeave() {
      const leaves = getLeaves();
      const active = leaves.find(item => item.active);
      if (!active) return;
      if (!w.confirm(`Закрыть больничный с ${active.start} по ${active.end}?`)) return;
      active.active = false;
      active.closedAt = new Date().toISOString();
      saveLeaves(leaves);
      closePage();
      syncMenu();
    }

    menuButton.onclick = () => activeLeave() ? closeActiveLeave() : openPage();
    $('#slPageClose').onclick = closePage;
    $('#slAutoStart').onclick = fillAutoDates;
    page.querySelectorAll('input,select').forEach(input => input.addEventListener('change', preview));
    $('#slOpen').onclick = () => {
      const start = $('#slStart').value;
      const end = $('#slEnd').value;
      if (!start || !end || end < start) {
        w.alert('Проверьте даты больничного.');
        return;
      }
      const leaves = getLeaves();
      leaves.forEach(item => { if (item.active) item.active = false; });
      leaves.push({
        id: Date.now(),
        active: true,
        reason: $('#slReason').value,
        official: $('#slOfficial').value,
        start,
        end,
        years: Number($('#slYears').value) || 0,
        twoYearIncome: Number($('#slIncome').value) || 0,
        lastWorkedShift: lastWorkedShift(),
        createdAt: new Date().toISOString()
      });
      saveLeaves(leaves);
      closePage();
      syncMenu();
    };

    function injectPdfPages() {
      d.getElementById('pdfSickLeavePages')?.remove();
      const context = w.__sickGetReportContext?.();
      if (!context) return;
      const monthStart = new Date(context.year, context.month, 1);
      const monthEnd = new Date(context.year, context.month + 1, 0);
      const records = getLeaves().filter(record => {
        const start = parseDate(record.start), end = parseDate(record.end);
        return start && end && start <= monthEnd && end >= monthStart;
      });
      if (!records.length) return;

      const holder = d.createElement('div');
      holder.id = 'pdfSickLeavePages';
      const template = d.getElementById('pdfReportTemplate');
      template.appendChild(holder);

      records.forEach((record, recordIndex) => {
        const calc = calculate(record);
        const allDays = [];
        let cursor = parseDate(record.start);
        const end = parseDate(record.end);
        while (cursor <= end) {
          allDays.push(dateKey(cursor));
          cursor = addDays(cursor, 1);
        }

        const chunkSize = 28;
        for (let offset = 0; offset < allDays.length; offset += chunkSize) {
          const chunk = allDays.slice(offset, offset + chunkSize);
          const pageNumber = Math.floor(offset / chunkSize) + 1;
          const totalPages = Math.ceil(allDays.length / chunkSize);
          const page = d.createElement('section');
          page.style.cssText = 'page-break-before:always;break-before:page;padding:32px;width:794px;min-height:1120px;background:#fff;color:#0f172a;box-sizing:border-box';
          page.innerHTML = `
            <div style="border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:18px">
              <h2 style="font-size:18px;font-weight:900;margin:0">ЛИСТОК НЕТРУДОСПОСОБНОСТИ — ДЕТАЛИЗАЦИЯ</h2>
              <div style="font-size:11px;color:#475569;margin-top:6px">${reasonName(record.reason)} · ${record.start} — ${record.end} · страница ${pageNumber}/${totalPages}</div>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:11px">
              <thead><tr><th style="border:1px solid #cbd5e1;padding:7px">№</th><th style="border:1px solid #cbd5e1;padding:7px">Дата</th><th style="border:1px solid #cbd5e1;padding:7px">Статус</th><th style="border:1px solid #cbd5e1;padding:7px">Начислено за день</th><th style="border:1px solid #cbd5e1;padding:7px">На руки за день</th></tr></thead>
              <tbody>${chunk.map((day, index) => `<tr><td style="border:1px solid #cbd5e1;padding:7px">${offset + index + 1}</td><td style="border:1px solid #cbd5e1;padding:7px">${day}</td><td style="border:1px solid #cbd5e1;padding:7px">Больничный</td><td style="border:1px solid #cbd5e1;padding:7px">${Math.round(calc.dailyGross).toLocaleString('ru-RU')} ₽</td><td style="border:1px solid #cbd5e1;padding:7px">${Math.round(record.reason === 'pregnancy' ? calc.dailyGross : calc.dailyGross * .87).toLocaleString('ru-RU')} ₽</td></tr>`).join('')}</tbody>
            </table>
            ${offset + chunkSize >= allDays.length ? `<div style="margin-top:20px;border:2px solid #0f172a;border-radius:12px;padding:14px;font-size:12px"><b>Всего дней:</b> ${calc.days}<br><b>Ориентировочно начислено:</b> ${Math.round(calc.gross).toLocaleString('ru-RU')} ₽<br><b>Ориентировочно на руки:</b> ${Math.round(calc.net).toLocaleString('ru-RU')} ₽<div style="font-size:9px;color:#64748b;margin-top:8px">Расчёт справочный и не заменяет официальный расчёт СФР.</div></div>` : ''}
          `;
          holder.appendChild(page);
        }
      });
    }

    const originalPdf = w.generatePdfReport;
    if (typeof originalPdf === 'function' && !w.__sickPdfPatched) {
      w.__sickPdfPatched = true;
      w.generatePdfReport = function () {
        injectPdfPages();
        return originalPdf.apply(this, arguments);
      };
    }

    fillAutoDates();
    syncMenu();
    setInterval(syncMenu, 1000);
  });
})();