(function(){
  const frame=document.getElementById('appFrame');
  if(!frame) return;
  const NEW_SEAL='https://allwebs.ru/images/2026/08/19/530ae3ef3cf17f71eae6a4ca4930b270.md.png';

  function applyFix(){
    const doc=frame.contentDocument;
    if(!doc) return false;
    const img=doc.getElementById('pdfSealImg');
    if(!img) return false;

    img.src=NEW_SEAL;
    img.crossOrigin='anonymous';
    img.style.width='170px';
    img.style.height='170px';
    img.style.objectFit='contain';

    const sealWrap=img.parentElement;
    if(sealWrap){
      sealWrap.className='pointer-events-none z-20';
      sealWrap.style.cssText='position:relative;left:auto;bottom:auto;transform:rotate(-4deg);opacity:.96;display:flex;justify-content:center;align-items:center;width:100%;height:185px;margin-top:16px;break-inside:avoid;page-break-inside:avoid;';
    }

    const finalBlock=sealWrap && sealWrap.parentElement;
    if(finalBlock){
      finalBlock.id='pdfFinalSummaryBlock';
      finalBlock.classList.remove('mb-44');
      finalBlock.style.breakInside='avoid-page';
      finalBlock.style.pageBreakInside='avoid';
      finalBlock.style.overflow='visible';
      finalBlock.style.marginBottom='12px';
    }

    let style=doc.getElementById('pdfSealPageFixStyle');
    if(!style){
      style=doc.createElement('style');
      style.id='pdfSealPageFixStyle';
      style.textContent=`
        #pdfFinalSummaryBlock { break-inside: avoid-page !important; page-break-inside: avoid !important; }
        #pdfSealImg, #pdfSealImg * { break-inside: avoid !important; page-break-inside: avoid !important; }
        #pdfPayoutReconcile { break-inside: avoid-page !important; page-break-inside: avoid !important; }
      `;
      doc.head.appendChild(style);
    }
    return true;
  }

  frame.addEventListener('load',()=>{
    let tries=0;
    const timer=setInterval(()=>{tries++; if(applyFix()||tries>40) clearInterval(timer);},150);
  });
})();