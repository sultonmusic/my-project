let deferredInstallPrompt = null;

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

function createInstallHelp() {
  const modal = document.createElement('div');
  modal.id = 'installHelpModal';
  modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:30000;align-items:center;justify-content:center;padding:18px;background:#020617bb;font-family:system-ui,sans-serif';
  modal.innerHTML = `
    <div style="width:min(390px,100%);background:#fff;border-radius:22px;padding:22px;color:#0f172a;box-shadow:0 24px 70px #0007">
      <div style="display:flex;align-items:center;gap:12px">
        <img src="/app-icon.svg" alt="" style="width:54px;height:54px;border-radius:14px">
        <div><div style="font-size:19px;font-weight:850">Установить TyuZarplata</div><div id="installHelpSubtitle" style="font-size:12px;color:#64748b;margin-top:3px"></div></div>
      </div>
      <div id="installHelpSteps" style="margin-top:18px;font-size:14px;line-height:1.65;color:#334155"></div>
      <button id="installHelpClose" type="button" style="width:100%;margin-top:18px;padding:12px;border:0;border-radius:12px;background:#2563eb;color:#fff;font-weight:800">Понятно</button>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('installHelpClose').onclick = () => modal.style.display = 'none';
  modal.onclick = event => { if (event.target === modal) modal.style.display = 'none'; };
}

function showInstallHelp() {
  const modal = document.getElementById('installHelpModal');
  const subtitle = document.getElementById('installHelpSubtitle');
  const steps = document.getElementById('installHelpSteps');

  if (isIos()) {
    subtitle.textContent = 'Для iPhone и iPad';
    steps.innerHTML = `
      <div><b>1.</b> Откройте сайт в Safari.</div>
      <div><b>2.</b> Нажмите кнопку <b>«Поделиться»</b> (квадрат со стрелкой вверх).</div>
      <div><b>3.</b> Выберите <b>«На экран Домой»</b>.</div>
      <div><b>4.</b> Нажмите <b>«Добавить»</b>.</div>`;
  } else {
    subtitle.textContent = 'Для Android';
    steps.innerHTML = `
      <div>Откройте меню браузера <b>⋮</b> и выберите <b>«Установить приложение»</b> или <b>«Добавить на главный экран»</b>.</div>`;
  }
  modal.style.display = 'flex';
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
});

window.openInstallPrompt = async () => {
  if (isStandalone()) {
    alert('TyuZarplata уже открыта как установленное приложение.');
    return;
  }
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    return;
  }
  showInstallHelp();
};

window.addEventListener('DOMContentLoaded', () => {
  createInstallHelp();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').catch(console.error);
  }
});
