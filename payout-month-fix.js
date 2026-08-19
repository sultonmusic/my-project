(function(){
  const frame = document.getElementById('appFrame');
  if (!frame) return;
  const VERSION = 'v0.0.6';

  function getTotals(win){
    try { return win.eval('calculatedTotals'); } catch(e) { return null; }
  }
  function monthKey(win){
    const t = getTotals(win);
    if (!t || !t.currentYear || !t.currentMonth) return null;
    return String(t.currentYear) + '-' + String(t.currentMonth).padStart(2,'0');
  }
  function storageKey(key){ return 'mz_payout_reconcile_' + key; }
  function readMonth(win,key){
    if(!key) return {};
    try { return JSON.parse(win.localStorage.getItem(storageKey(key)) || '{}'); }
    catch(e){ return {}; }
  }
  function applyMonth(win,doc,key){
    const section = doc.getElementById('payoutReconcileSection');
    if(!section || !key) return;
    const data = readMonth(win,key);
    const adv = section.querySelector('#advReceivedInput');
    const sal = section.querySelector('#salReceivedInput');
    const note = section.querySelector('#payoutNoteInput');
    const notice = section.querySelector('#payoutSaveNotice');
    if(adv) adv.value = data.advReceived ?? '';
    if(sal) sal.value = data.salReceived ?? '';
    if(note) note.value = data.note || '';
    if(notice) notice.style.display='none';
    if(adv) adv.dispatchEvent(new win.Event('input',{bubbles:true}));
  }
  function install(){
    const win = frame.contentWindow, doc = frame.contentDocument;
    if(!win || !doc) return;
    const footer = doc.getElementById('appVersionFooter');
    if(footer) footer.textContent = VERSION;

    let lastKey = null;
    const tick = ()=>{
      const key = monthKey(win);
      if(key && key !== lastKey){
        lastKey = key;
        applyMonth(win,doc,key);
      }
    };
    tick();
    const timer = win.setInterval(tick,250);
    win.addEventListener('beforeunload',()=>win.clearInterval(timer),{once:true});

    // Existing save handler already writes to the currently selected month.
    // This capture listener prevents stale values from a previous month from being reused.
    doc.addEventListener('click',(e)=>{
      const btn = e.target && e.target.closest ? e.target.closest('#savePayoutBtn') : null;
      if(!btn) return;
      const key = monthKey(win);
      if(key) lastKey = key;
    },true);
  }

  frame.addEventListener('load',()=>setTimeout(install,80));
})();