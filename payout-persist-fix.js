(function(){
  const frame=document.getElementById('appFrame');
  if(!frame) return;
  const STORAGE_KEY='mz_payout_reconcile_persistent_v1';
  function safeParse(v){try{return JSON.parse(v||'{}')}catch(e){return {}}}
  function save(win,section){
    const data={
      advReceived:Number(section.querySelector('#advReceivedInput')?.value)||0,
      salReceived:Number(section.querySelector('#salReceivedInput')?.value)||0,
      note:(section.querySelector('#payoutNoteInput')?.value||'').trim(),
      savedAt:new Date().toISOString()
    };
    try{win.localStorage.setItem(STORAGE_KEY,JSON.stringify(data));}catch(e){}
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data));}catch(e){}
  }
  function restore(win,doc){
    const section=doc.getElementById('payoutReconcileSection');
    if(!section) return false;
    let data={};
    try{data=safeParse(win.localStorage.getItem(STORAGE_KEY));}catch(e){}
    if(!data.savedAt){try{data=safeParse(localStorage.getItem(STORAGE_KEY));}catch(e){}}
    if(data.savedAt){
      const a=section.querySelector('#advReceivedInput'), s=section.querySelector('#salReceivedInput'), n=section.querySelector('#payoutNoteInput');
      if(a) a.value=data.advReceived??'';
      if(s) s.value=data.salReceived??'';
      if(n) n.value=data.note||'';
      [a,s,n].filter(Boolean).forEach(el=>el.dispatchEvent(new Event('input',{bubbles:true})));
    }
    const btn=section.querySelector('#savePayoutBtn');
    if(btn&&!btn.dataset.persistFixed){
      btn.dataset.persistFixed='1';
      btn.addEventListener('click',()=>save(win,section));
    }
    section.querySelectorAll('input,textarea').forEach(el=>{
      if(!el.dataset.persistFixed){el.dataset.persistFixed='1';el.addEventListener('change',()=>save(win,section));}
    });
    const footer=doc.getElementById('appVersionFooter'); if(footer) footer.textContent='v0.0.5';
    return true;
  }
  frame.addEventListener('load',()=>{
    const win=frame.contentWindow,doc=frame.contentDocument;
    let tries=0;
    const timer=setInterval(()=>{tries++; if(restore(win,doc)||tries>40) clearInterval(timer);},150);
  });
})();