(function () {
  'use strict';

  const OWNER = 'sultonmusic';
  const REPO = 'my-project';
  const BRANCH = 'main';
  const DATA_PATH = 'data/cloud-data.json';
  const STORAGE_KEY = 'mening_oyligim_data_v7';
  const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
  const SAVED_TOKEN_KEY = 'salaryCloudSavedToken';
  const SAVED_PASSWORD_KEY = 'salaryCloudSavedPassword';

  let token = '';
  let password = '';
  let remoteSha = null;
  let connected = false;
  let loadingRemote = false;
  let lastSnapshot = '';
  let saveTimer = null;

  const utf8 = new TextEncoder();
  const utf8Decoder = new TextDecoder();
  const toBase64 = bytes => btoa(String.fromCharCode(...bytes));
  const fromBase64 = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));
  const contentToBase64 = value => toBase64(utf8.encode(value));
  const contentFromBase64 = value => utf8Decoder.decode(fromBase64(value.replace(/\n/g, '')));

  function frameWindow() {
    const frame = document.getElementById('appFrame');
    return frame && frame.contentWindow;
  }

  function readLocalData() {
    const win = frameWindow();
    return win ? (win.localStorage.getItem(STORAGE_KEY) || '') : '';
  }

  function writeLocalData(value) {
    const frame = document.getElementById('appFrame');
    if (!frame || !frame.contentWindow) return;
    frame.contentWindow.localStorage.setItem(STORAGE_KEY, value);
    frame.contentWindow.location.reload();
  }

  async function deriveKey(secret, salt) {
    const baseKey = await crypto.subtle.importKey('raw', utf8.encode(secret), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encryptData(plainText) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, utf8.encode(plainText));
    return {
      version: 1,
      algorithm: 'AES-GCM',
      kdf: 'PBKDF2-SHA256',
      iterations: 250000,
      updatedAt: new Date().toISOString(),
      salt: toBase64(salt),
      iv: toBase64(iv),
      ciphertext: toBase64(new Uint8Array(cipher))
    };
  }

  async function decryptData(payload) {
    const salt = fromBase64(payload.salt);
    const iv = fromBase64(payload.iv);
    const cipher = fromBase64(payload.ciphertext);
    const key = await deriveKey(password, salt);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    return utf8Decoder.decode(plain);
  }

  async function github(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.headers || {})
      }
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      let detail = '';
      try { detail = (await response.json()).message || ''; } catch (_) {}
      throw new Error(detail || `GitHub HTTP ${response.status}`);
    }
    return response.status === 204 ? {} : response.json();
  }

  function setStatus(text, type = 'normal') {
    const status = document.getElementById('cloudSyncStatus');
    const button = document.getElementById('cloudSyncButton');
    if (status) {
      status.textContent = text;
      status.style.color = type === 'error' ? '#f87171' : type === 'ok' ? '#34d399' : '#cbd5e1';
    }
    if (button) {
      button.title = text;
      button.style.background = type === 'error' ? '#dc2626' : type === 'ok' ? '#059669' : '#2563eb';
    }
  }

  async function fetchRemote() {
    const file = await github(`/contents/${DATA_PATH}?ref=${encodeURIComponent(BRANCH)}`);
    if (!file) {
      remoteSha = null;
      return null;
    }
    remoteSha = file.sha;
    const payload = JSON.parse(contentFromBase64(file.content));
    if (!payload.ciphertext) return null;
    return decryptData(payload);
  }

  async function uploadSnapshot(snapshot, retry = true) {
    if (!connected || loadingRemote || !snapshot) return;
    setStatus('GitHub’ga saqlanmoqda…');
    const encrypted = await encryptData(snapshot);
    const body = {
      message: `Ma’lumotlarni sinxronlash ${new Date().toISOString()}`,
      content: contentToBase64(JSON.stringify(encrypted, null, 2)),
      branch: BRANCH
    };
    if (remoteSha) body.sha = remoteSha;
    try {
      const result = await github(`/contents/${DATA_PATH}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      remoteSha = result.content.sha;
      lastSnapshot = snapshot;
      setStatus('GitHub’da saqlandi', 'ok');
    } catch (error) {
      if (retry && /sha|conflict|does not match/i.test(error.message)) {
        await fetchRemote();
        return uploadSnapshot(snapshot, false);
      }
      setStatus(`Saqlash xatosi: ${error.message}`, 'error');
      throw error;
    }
  }

  function scheduleUpload(snapshot) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => uploadSnapshot(snapshot).catch(console.error), 1800);
  }

  async function connect() {
    const tokenInput = document.getElementById('cloudToken');
    const passwordInput = document.getElementById('cloudPassword');
    token = tokenInput.value.trim();
    password = passwordInput.value;
    if (!token || password.length < 8) {
      setStatus('Token va kamida 8 belgili parol kiriting', 'error');
      return;
    }
    setStatus('GitHub bilan ulanmoqda…');
    loadingRemote = true;
    try {
      await github('');
      const remote = await fetchRemote();
      const local = readLocalData();
      connected = true;
      sessionStorage.setItem('salaryCloudToken', token);
      const remember = document.getElementById('cloudRemember').checked;
      if (remember) {
        localStorage.setItem(SAVED_TOKEN_KEY, token);
        localStorage.setItem(SAVED_PASSWORD_KEY, password);
      } else {
        localStorage.removeItem(SAVED_TOKEN_KEY);
        localStorage.removeItem(SAVED_PASSWORD_KEY);
      }
      if (remote) {
        JSON.parse(remote);
        lastSnapshot = remote;
        writeLocalData(remote);
        setStatus('GitHub’dan yuklandi', 'ok');
      } else if (local) {
        loadingRemote = false;
        await uploadSnapshot(local);
        setStatus('Birinchi nusxa GitHub’da yaratildi', 'ok');
      } else {
        setStatus('Ulandi — ma’lumot kiritishni boshlang', 'ok');
      }
      document.getElementById('cloudConnect').textContent = 'Ulangan';
      setTimeout(closeModal, 900);
    } catch (error) {
      connected = false;
      if (error.name === 'OperationError') {
        setStatus('Shifrlash paroli noto‘g‘ri', 'error');
      } else {
        setStatus(`Ulanmadi: ${error.message}`, 'error');
      }
    } finally {
      loadingRemote = false;
    }
  }

  function openModal() { document.getElementById('cloudSyncModal').style.display = 'flex'; }
  function closeModal() { document.getElementById('cloudSyncModal').style.display = 'none'; }

  function createUi() {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <button id="cloudSyncButton" aria-label="GitHub sinxronlash" title="GitHub sinxronlash"
        style="position:fixed;right:16px;bottom:18px;z-index:9999;width:48px;height:48px;border:0;border-radius:16px;background:#2563eb;color:#fff;font-size:21px;box-shadow:0 10px 30px #0005;cursor:pointer">☁</button>
      <div id="cloudSyncModal" style="display:none;position:fixed;inset:0;z-index:10000;background:#020617cc;align-items:center;justify-content:center;padding:18px;font-family:system-ui,sans-serif">
        <div style="width:min(420px,100%);background:#0f172a;color:#fff;border:1px solid #334155;border-radius:22px;padding:20px;box-shadow:0 24px 70px #0009">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
            <div><div style="font-size:18px;font-weight:800">GitHub Cloud Sync</div><div style="font-size:12px;color:#94a3b8;margin-top:3px">Ma’lumotlar shifrlangan holda saqlanadi</div></div>
            <button id="cloudClose" style="border:0;background:#1e293b;color:#fff;border-radius:10px;width:34px;height:34px;cursor:pointer">✕</button>
          </div>
          <label style="display:block;font-size:12px;color:#cbd5e1;margin-top:18px;margin-bottom:6px">GitHub fine-grained token (Contents: Read and write)</label>
          <input id="cloudToken" type="password" autocomplete="off" placeholder="github_pat_…" style="width:100%;padding:12px;border-radius:12px;border:1px solid #475569;background:#020617;color:#fff;outline:none">
          <label style="display:block;font-size:12px;color:#cbd5e1;margin-top:13px;margin-bottom:6px">Shifrlash paroli (kamida 8 belgi)</label>
          <input id="cloudPassword" type="password" autocomplete="off" placeholder="Faqat siz biladigan parol" style="width:100%;padding:12px;border-radius:12px;border:1px solid #475569;background:#020617;color:#fff;outline:none">
          <label style="display:flex;align-items:center;gap:9px;margin-top:12px;font-size:12px;color:#e2e8f0;cursor:pointer">
            <input id="cloudRemember" type="checkbox" style="width:17px;height:17px" checked>
            <span>Shu qurilmada eslab qolish va avtomatik ulanish</span>
          </label>
          <div style="font-size:11px;color:#94a3b8;line-height:1.5;margin-top:10px">Parol GitHub’ga yuborilmaydi. “Eslab qolish” yoqilsa token va parol faqat shu qurilma brauzerida saqlanadi. Begona qurilmada bu tanlovni o‘chiring.</div>
          <div id="cloudSyncStatus" style="min-height:20px;font-size:12px;margin-top:12px;color:#cbd5e1"></div>
          <button id="cloudConnect" style="width:100%;margin-top:6px;padding:12px;border:0;border-radius:12px;background:#2563eb;color:#fff;font-weight:800;cursor:pointer">Ulash va sinxronlash</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    document.getElementById('cloudSyncButton').addEventListener('click', openModal);
    document.getElementById('cloudClose').addEventListener('click', closeModal);
    document.getElementById('cloudConnect').addEventListener('click', connect);
    document.getElementById('cloudSyncModal').addEventListener('click', event => {
      if (event.target.id === 'cloudSyncModal') closeModal();
    });
    const savedToken = localStorage.getItem(SAVED_TOKEN_KEY) || sessionStorage.getItem('salaryCloudToken');
    const savedPassword = localStorage.getItem(SAVED_PASSWORD_KEY);
    if (savedToken) document.getElementById('cloudToken').value = savedToken;
    if (savedPassword) document.getElementById('cloudPassword').value = savedPassword;
    if (savedToken && savedPassword) setTimeout(connect, 400);
  }

  function monitorChanges() {
    setInterval(() => {
      if (!connected || loadingRemote) return;
      const snapshot = readLocalData();
      if (snapshot && snapshot !== lastSnapshot) scheduleUpload(snapshot);
    }, 1000);
  }

  window.addEventListener('DOMContentLoaded', () => {
    createUi();
    monitorChanges();
  });
})();
