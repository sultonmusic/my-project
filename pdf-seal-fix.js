(function(){
  const frame=document.getElementById('appFrame');
  if(!frame) return;
  const NEW_SEAL='https://allwebs.ru/images/2026/08/19/530ae3ef3cf17f71eae6a4ca4930b270.md.png';

  function applyFix(){
    const doc=frame.contentDocument;
    if(!doc) return false;
    const img=doc.getElementById('pdfSealImg');
    const tpl=doc.getElementById('pdfReportTemplate');
    if(!img||!tpl) return false;

    tpl.style.width='740px';
    tpl.style.maxWidth='740px';
    tpl.style.margin='0 auto';
    tpl.style.overflow='visible';
    tpl.style.boxSizing='border-box';

    img.src=NEW_SEAL;
    img.crossOrigin='anonymous';
    img.style.width='170px';
    img.style.height='170px';
    img.style.maxWidth='100%';
    img.style.objectFit='contain';

    const sealWrap=img.parentElement;
    if(sealWrap){
      sealWrap.className='pointer-events-none z-20';
      sealWrap.style.cssText='position:relative;left:auto;right:auto;bottom:auto;transform:rotate(-4deg);opacity:.96;display:flex;justify-content:center;align-items:center;width:100%;max-width:100%;height:185px;margin:16px auto 0;box-sizing:border-box;break-inside:avoid;page-break-inside:avoid;';
    }

    const finalBlock=sealWrap&&sealWrap.parentElement;
    if(finalBlock){
      finalBlock.id='pdfFinalSummaryBlock';
      finalBlock.classList.remove('mb-44');
      finalBlock.style.breakInside='avoid-page';
      finalBlock.style.pageBreakInside='avoid';
      finalBlock.style.overflow='visible';
      finalBlock.style.width='calc(100% - 24px)';
      finalBlock.style.maxWidth='calc(100% - 24px)';
      finalBlock.style.marginLeft='auto';
      finalBlock.style.marginRight='auto';
      finalBlock.style.marginBottom='12px';
      finalBlock.style.boxSizing='border-box';
    }

    // Keep section 3 and the final payslip together. If they do not fit
    // in the remaining space, html2pdf moves the complete group to page 2.
    const headings=Array.from(doc.querySelectorAll('#pdfReportTemplate h2'));
    const bonusHeading=headings.find(h=>/3\.\s*ПРЕМИИ/i.test((h.textContent||'').trim()));
    const bonusBlock=bonusHeading&&bonusHeading.closest('.mb-5');
    if(bonusBlock && finalBlock){
      let group=doc.getElementById('pdfBonusFinalGroup');
      if(!group){
        group=doc.createElement('div');
        group.id='pdfBonusFinalGroup';
        group.className='pdf-bonus-final-group';
        group.style.boxSizing='border-box';
        group.style.width='100%';
        group.style.breakInside='avoid-page';
        group.style.pageBreakInside='avoid';
        group.style.overflow='visible';
        bonusBlock.parentNode.insertBefore(group,bonusBlock);
        group.appendChild(bonusBlock);
        group.appendChild(finalBlock);
      }
      bonusBlock.style.breakInside='avoid-page';
      bonusBlock.style.pageBreakInside='avoid';
      bonusBlock.style.overflow='visible';
      finalBlock.style.breakInside='avoid-page';
      finalBlock.style.pageBreakInside='avoid';
    }

    const reconcile=doc.getElementById('pdfPayoutReconcile');
    if(reconcile){
      reconcile.style.width='calc(100% - 40px)';
      reconcile.style.maxWidth='calc(100% - 40px)';
      reconcile.style.margin='14px auto 20px';
      reconcile.style.boxSizing='border-box';
      reconcile.style.overflow='hidden';
      reconcile.style.breakInside='avoid-page';
      reconcile.style.pageBreakInside='avoid';
    }

    // Make every PDF table row/card use the same thin 1px border.
    let style=doc.getElementById('pdfSealPageFixStyle');
    if(!style){
      style=doc.createElement('style');
      style.id='pdfSealPageFixStyle';
      doc.head.appendChild(style);
    }
    style.textContent=`
      #pdfReportTemplate, #pdfReportTemplate * { box-sizing:border-box !important; }
      #pdfReportTemplate table { width:100% !important; max-width:100% !important; table-layout:fixed; border-collapse:collapse !important; border-spacing:0 !important; }
      #pdfReportTemplate th, #pdfReportTemplate td, #pdfReportTemplate tr { border-width:1px !important; border-style:solid !important; border-color:#cbd5e1 !important; }
      #pdfReportTemplate th, #pdfReportTemplate td { overflow-wrap:anywhere; word-break:break-word; }
      #pdfFoodTableBody tr, #pdfFoodTableBody td { border-width:1px !important; border-style:solid !important; border-color:#cbd5e1 !important; }
      #pdfBonusFinalGroup { break-inside:avoid-page !important; page-break-inside:avoid !important; overflow:visible !important; }
      #pdfBonusFinalGroup > * { break-inside:avoid-page !important; page-break-inside:avoid !important; }
      #pdfFinalSummaryBlock { break-inside:avoid-page !important; page-break-inside:avoid !important; }
      #pdfSealImg { break-inside:avoid !important; page-break-inside:avoid !important; }
      #pdfPayoutReconcile { break-inside:avoid-page !important; page-break-inside:avoid !important; }
    `;
    const footer=doc.getElementById('appVersionFooter'); if(footer) footer.textContent='v0.0.9';
    return true;
  }

  frame.addEventListener('load',()=>{
    let tries=0;
    const timer=setInterval(()=>{tries++; if(applyFix()||tries>40) clearInterval(timer);},150);
  });
})();
