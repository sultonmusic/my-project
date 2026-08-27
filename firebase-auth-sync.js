import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, setPersistence, browserLocalPersistence,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  GoogleAuthProvider, signInWithPopup, updateProfile, signOut,
  updateEmail, reauthenticateWithCredential, EmailAuthProvider,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp, onSnapshot
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const STORAGE_KEY = 'mening_oyligim_data_v7';
const DATA_VERSION = 1;
const LAST_UID_KEY = 'tyuzarplata_last_uid';
let auth;
let db;
let currentUser = null;
let lastSnapshot = '';
let currentSnapshot = '';
let loadingRemote = false;
let saveTimer = null;
let monitorTimer = null;
let unsubscribeRemote = null;
let writeChain = Promise.resolve();
const pendingLocalSnapshots = new Set();

const frame = () => document.getElementById('appFrame');
const frameWindow = () => frame()?.contentWindow;
const readLegacyLocal = () => frameWindow()?.localStorage.getItem(STORAGE_KEY) || '';
const sendSnapshotToApp = snapshot => {
  if (!snapshot || !frameWindow()) return;
  frameWindow().postMessage({ type: 'TYU_LOAD_DATA', snapshot }, location.origin);
};
const showApp = visible => {
  const appFrame = frame();
  if (appFrame) appFrame.style.visibility = visible ? 'visible' : 'hidden';
  document.getElementById('authGate').style.display = visible ? 'none' : 'flex';
  document.getElementById('accountButton').style.display = 'none';
};

function accountEmail(value) {
  const clean = value.trim().toLowerCase();
  if (clean.includes('@')) return clean;
  if (!/^[a-z0-9._-]{3,30}$/.test(clean)) {
    throw new Error('Имя пользователя: 3–30 символов. Допустимы буквы, цифры, точка, _ и -.');
  }
  return `${clean}@users.tyuzarplata.app`;
}

function normalizeUsername(value) {
  const clean = value.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(clean)) {
    throw new Error('Имя пользователя: 3–30 символов. Допустимы буквы, цифры, точка, _ и -.');
  }
  return clean;
}

async function resolveLoginEmail(identity) {
  const clean = identity.trim().toLowerCase();
  if (clean.includes('@')) return clean;
  const username = normalizeUsername(clean);
  const lookup = await getDoc(doc(db, 'usernames', username));
  return lookup.exists() && lookup.data().loginEmail
    ? lookup.data().loginEmail
    : accountEmail(username);
}

async function saveUserProfile(user, username = '') {
  const provider = user.providerData?.[0]?.providerId || 'password';
  const cleanUsername = username || user.displayName || (user.email || '').split('@')[0];
  const profileRef = doc(db, 'userProfiles', user.uid);
  const existing = await getDoc(profileRef);
  await setDoc(profileRef, {
    uid: user.uid,
    username: cleanUsername,
    email: user.email?.endsWith('@users.tyuzarplata.app') ? '' : (user.email || ''),
    provider,
    createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
    lastLoginAt: serverTimestamp()
  });
  if (cleanUsername && /^[a-z0-9._-]{3,30}$/i.test(cleanUsername)) {
    await setDoc(doc(db, 'usernames', cleanUsername.toLowerCase()), {
      uid: user.uid,
      loginEmail: user.email || accountEmail(cleanUsername),
      updatedAt: serverTimestamp()
    });
  }
}

function friendlyError(error) {
  const messages = {
    'auth/invalid-credential': 'Неверное имя пользователя, email или пароль.',
    'auth/weak-password': 'Пароль должен содержать не менее 6 символов.',
    'auth/invalid-email': 'Некорректное имя пользователя или email.',
    'auth/popup-closed-by-user': 'Окно входа через Google было закрыто.',
    'auth/too-many-requests': 'Слишком много попыток. Повторите позже.',
    'auth/requires-recent-login': 'Для изменения email выйдите и войдите снова.',
    'auth/email-already-in-use': 'Этот email уже используется другим аккаунтом.',
    'permission-denied': 'Доступ к Firestore запрещён. Опубликуйте Security Rules.'
  };
  return messages[error?.code] || error?.message || 'Произошла неизвестная ошибка.';
}

function setMessage(text, isError = false) {
  const el = document.getElementById('authMessage');
  el.textContent = text;
  el.style.color = isError ? '#dc2626' : '#047857';
}

function createUi() {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div id="authGate" style="position:fixed;inset:0;z-index:20000;display:flex;align-items:center;justify-content:center;padding:18px;background:linear-gradient(145deg,#eff6ff,#f8fafc 55%,#ecfdf5);font-family:system-ui,sans-serif">
      <div id="authLoading" style="display:flex;flex-direction:column;align-items:center;gap:14px;color:#475569;font-weight:700"><div style="width:42px;height:42px;border:4px solid #dbeafe;border-top-color:#2563eb;border-radius:50%;animation:tyuSpin .8s linear infinite"></div><span>Загрузка…</span></div>
      <div id="authCard" style="display:none;width:min(420px,100%);background:#fff;border:1px solid #e2e8f0;border-radius:26px;padding:24px;box-shadow:0 25px 70px #0f172a24">
        <div style="display:flex;align-items:center;gap:13px;margin-bottom:20px">
          <div style="width:50px;height:50px;border-radius:16px;display:grid;place-items:center;background:#2563eb;color:#fff;font-size:25px">▦</div>
          <div><div style="font-size:23px;font-weight:850;color:#0f172a">TyuZarplata</div><div style="font-size:13px;color:#64748b">Ваши данные безопасно синхронизируются</div></div>
        </div>
        <div style="display:flex;background:#f1f5f9;border-radius:13px;padding:4px;margin-bottom:18px">
          <button id="loginTab" type="button" style="flex:1;padding:10px;border:0;border-radius:10px;background:#fff;color:#0f172a;font-weight:750">Вход</button>
          <button id="registerTab" type="button" style="flex:1;padding:10px;border:0;border-radius:10px;background:transparent;color:#64748b;font-weight:750">Регистрация</button>
        </div>
        <form id="authForm">
          <label style="display:block;font-size:13px;font-weight:700;color:#334155;margin-bottom:6px">Имя пользователя или email</label>
          <input id="authIdentity" autocomplete="username" required placeholder="username" style="width:100%;padding:13px;border:1px solid #cbd5e1;border-radius:12px;font-size:16px;outline:none">
          <div id="registerEmailWrap" style="display:none"><label style="display:block;font-size:13px;font-weight:700;color:#334155;margin:14px 0 6px">Email <span style="font-weight:500;color:#94a3b8">(необязательно)</span></label><input id="registerEmail" type="email" autocomplete="email" placeholder="Для восстановления пароля" style="width:100%;padding:13px;border:1px solid #cbd5e1;border-radius:12px;font-size:16px;outline:none"></div>
          <label style="display:block;font-size:13px;font-weight:700;color:#334155;margin:14px 0 6px">Пароль</label>
          <div style="position:relative"><input id="authPassword" type="password" autocomplete="current-password" minlength="6" required placeholder="Не менее 6 символов" style="width:100%;padding:13px 52px 13px 13px;border:1px solid #cbd5e1;border-radius:12px;font-size:16px;outline:none"><button id="togglePassword" type="button" aria-label="Показать пароль" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);width:42px;height:42px;border:0;background:transparent;font-size:20px;cursor:pointer">👁</button></div>
          <div id="authMessage" style="min-height:20px;margin-top:10px;font-size:13px;line-height:1.4"></div>
          <button id="authSubmit" type="submit" style="width:100%;padding:13px;border:0;border-radius:13px;background:#2563eb;color:#fff;font-size:15px;font-weight:800">Вход</button>
          <button id="forgotPassword" type="button" style="width:100%;padding:11px;border:0;background:transparent;color:#2563eb;font-weight:700">Забыли пароль?</button>
        </form>
        <div style="display:flex;align-items:center;gap:10px;margin:17px 0;color:#94a3b8;font-size:12px"><span style="height:1px;background:#e2e8f0;flex:1"></span>или<span style="height:1px;background:#e2e8f0;flex:1"></span></div>
        <button id="googleLogin" type="button" style="width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:13px;background:#fff;color:#1e293b;font-size:15px;font-weight:750">G&nbsp;&nbsp;Войти через Google</button>
      </div>
    </div>
    <button id="accountButton" type="button" title="Аккаунт" style="display:none;position:fixed;left:16px;bottom:18px;z-index:9999;width:48px;height:48px;border:0;border-radius:16px;background:#0f172a;color:#fff;font-size:20px;box-shadow:0 10px 30px #0004">👤</button>
    <div id="accountModal" style="display:none;position:fixed;inset:0;z-index:15000;align-items:center;justify-content:center;padding:18px;background:#020617aa;font-family:system-ui,sans-serif">
      <div style="width:min(380px,100%);background:#fff;border-radius:20px;padding:20px">
        <div style="font-size:18px;font-weight:800;color:#0f172a">Аккаунт</div>
        <div id="accountName" style="margin:8px 0 18px;color:#64748b;font-size:13px;word-break:break-all"></div>
        <div id="emailSettings" style="margin-bottom:14px"><label style="display:block;font-size:13px;font-weight:700;color:#334155;margin-bottom:6px">Email для восстановления</label><input id="settingsEmail" type="email" placeholder="name@example.com" style="width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:12px;font-size:15px"><input id="settingsPassword" type="password" placeholder="Текущий пароль" style="width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:12px;font-size:15px;margin-top:8px"><div id="emailSettingsMessage" style="min-height:18px;margin:7px 0;font-size:12px"></div><button id="saveEmailButton" style="width:100%;padding:11px;border:0;border-radius:12px;background:#2563eb;color:#fff;font-weight:800">Добавить / изменить email</button></div>
        <button id="logoutButton" style="width:100%;padding:12px;border:0;border-radius:12px;background:#dc2626;color:#fff;font-weight:800">Выйти</button>
        <button id="accountClose" style="width:100%;padding:11px;border:0;background:transparent;color:#475569">Закрыть</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);

  let mode = 'login';
  const chooseMode = next => {
    mode = next;
    const login = next === 'login';
    document.getElementById('authSubmit').textContent = login ? 'Войти' : 'Зарегистрироваться';
    document.getElementById('loginTab').style.background = login ? '#fff' : 'transparent';
    document.getElementById('registerTab').style.background = login ? 'transparent' : '#fff';
    document.getElementById('loginTab').style.color = login ? '#0f172a' : '#64748b';
    document.getElementById('registerTab').style.color = login ? '#64748b' : '#0f172a';
    document.getElementById('authPassword').autocomplete = login ? 'current-password' : 'new-password';
    document.getElementById('registerEmailWrap').style.display = login ? 'none' : 'block';
    document.getElementById('forgotPassword').style.display = login ? 'block' : 'none';
    document.getElementById('googleLogin').innerHTML = login
      ? 'G&nbsp;&nbsp;Войти через Google'
      : 'G&nbsp;&nbsp;Зарегистрироваться через Google';
    setMessage('');
  };

  document.getElementById('togglePassword').onclick = () => {
    const input = document.getElementById('authPassword');
    const visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    document.getElementById('togglePassword').textContent = visible ? '👁' : '🙈';
  };
  document.getElementById('loginTab').onclick = () => chooseMode('login');
  document.getElementById('registerTab').onclick = () => chooseMode('register');
  document.getElementById('authForm').onsubmit = async event => {
    event.preventDefault();
    const identity = document.getElementById('authIdentity').value;
    const password = document.getElementById('authPassword').value;
    const button = document.getElementById('authSubmit');
    button.disabled = true;
    setMessage('Пожалуйста, подождите…');
    try {
      if (mode === 'register') {
        const username = normalizeUsername(identity);
        const optionalEmail = document.getElementById('registerEmail').value.trim().toLowerCase();
        const usernameRef = doc(db, 'usernames', username);
        if ((await getDoc(usernameRef)).exists()) throw new Error('Это имя пользователя уже занято.');
        const email = optionalEmail || accountEmail(username);
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName: username });
        await saveUserProfile(result.user, username);
      } else {
        const email = await resolveLoginEmail(identity);
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      setMessage(friendlyError(error), true);
    } finally {
      button.disabled = false;
    }
  };
  document.getElementById('forgotPassword').onclick = async () => {
    try {
      const email = await resolveLoginEmail(document.getElementById('authIdentity').value);
      if (email.endsWith('@users.tyuzarplata.app')) throw new Error('Сначала добавьте настоящий email в настройках аккаунта.');
      await sendPasswordResetEmail(auth, email);
      setMessage('Письмо для восстановления пароля отправлено.');
    } catch (error) { setMessage(friendlyError(error), true); }
  };

  document.getElementById('googleLogin').onclick = async () => {
    setMessage('Открываем Google…');
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      setMessage(friendlyError(error), true);
    }
  };
  window.openAccountModal = () => {
    document.getElementById('accountName').textContent = currentUser?.displayName || currentUser?.email || '';
    document.getElementById('accountModal').style.display = 'flex';
    document.getElementById('settingsEmail').value = currentUser?.email?.endsWith('@users.tyuzarplata.app') ? '' : (currentUser?.email || '');
    document.getElementById('emailSettings').style.display = currentUser?.providerData?.some(item => item.providerId === 'password') ? 'block' : 'none';
  };
  document.getElementById('accountButton').onclick = window.openAccountModal;
  document.getElementById('accountClose').onclick = () => document.getElementById('accountModal').style.display = 'none';
  document.getElementById('saveEmailButton').onclick = async () => {
    const message = document.getElementById('emailSettingsMessage');
    const newEmail = document.getElementById('settingsEmail').value.trim().toLowerCase();
    const password = document.getElementById('settingsPassword').value;
    message.style.color = '#475569'; message.textContent = 'Сохраняем…';
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, password);
      await reauthenticateWithCredential(currentUser, credential);
      await updateEmail(currentUser, newEmail);
      await saveUserProfile(currentUser);
      message.style.color = '#047857'; message.textContent = 'Email сохранён. Теперь восстановление пароля доступно.';
      document.getElementById('settingsPassword').value = '';
    } catch (error) { message.style.color = '#dc2626'; message.textContent = friendlyError(error); }
  };
  document.getElementById('logoutButton').onclick = async () => {
    document.getElementById('accountModal').style.display = 'none';
    await signOut(auth);
  };
}

async function loadAndSync(user) {
  loadingRemote = true;
  const ref = doc(db, 'userData', user.uid);
  try {
    const remote = await getDoc(ref);
    if (remote.exists() && typeof remote.data().snapshot === 'string' && remote.data().snapshot) {
      currentSnapshot = remote.data().snapshot;
      lastSnapshot = currentSnapshot;
      sendSnapshotToApp(currentSnapshot);
      return;
    }

    // One-time migration of data created by older localStorage versions.
    const legacy = readLegacyLocal();
    if (legacy) {
      await saveSnapshot(legacy, true);
      currentSnapshot = legacy;
      sendSnapshotToApp(legacy);
      frameWindow().localStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    console.error(error);
    alert(friendlyError(error));
  } finally {
    loadingRemote = false;
  }
}
async function saveSnapshot(snapshot, force = false) {
  if (!currentUser || (!force && loadingRemote) || !snapshot || (!force && snapshot === currentSnapshot)) return;
  if (new Blob([snapshot]).size > 850000) {
    console.error('Размер данных превышает лимит 850 КБ.');
    return;
  }
  pendingLocalSnapshots.add(snapshot);
  try {
    await setDoc(doc(db, 'userData', currentUser.uid), {
      snapshot,
    version: DATA_VERSION,
      updatedAt: serverTimestamp()
    });
    currentSnapshot = snapshot;
    lastSnapshot = snapshot;
  } catch (error) {
    pendingLocalSnapshots.delete(snapshot);
    throw error;
  }
}

function startRealtimeListener(user) {
  if (unsubscribeRemote) unsubscribeRemote();
  unsubscribeRemote = onSnapshot(doc(db, 'userData', user.uid), snapshot => {
    if (!snapshot.exists() || loadingRemote) return;
    const remote = snapshot.data().snapshot;
    if (typeof remote !== 'string' || !remote) return;
    if (pendingLocalSnapshots.has(remote)) {
      pendingLocalSnapshots.delete(remote);
      currentSnapshot = remote;
      lastSnapshot = remote;
      return;
    }
    if (remote === currentSnapshot) return;
    currentSnapshot = remote;
    lastSnapshot = remote;
    sendSnapshotToApp(remote);
  }, error => console.error(friendlyError(error)));
}
function queueImmediateSave(snapshot) {
  writeChain = writeChain
    .then(() => saveSnapshot(snapshot))
    .catch(error => console.error(friendlyError(error)));
}

function startMonitor() {}
async function main() {
  createUi();
  showApp(false);
  try {
    const config = await fetch('/__/firebase/init.json').then(response => {
      if (!response.ok) throw new Error('Конфигурация Firebase не найдена.');
      return response.json();
    });
    const app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
    await setPersistence(auth, browserLocalPersistence);
    window.addEventListener('message', event => {
      if (event.origin !== location.origin || event.source !== frameWindow()) return;
      if (event.data?.type !== 'TYU_DATA_CHANGED' || typeof event.data.snapshot !== 'string') return;
      if (!currentUser || loadingRemote) return;
      queueImmediateSave(event.data.snapshot);
    });
    onAuthStateChanged(auth, async user => {
      currentUser = user;
      if (!user) {
        clearInterval(monitorTimer);
        if (unsubscribeRemote) unsubscribeRemote();
        unsubscribeRemote = null;
        showApp(false);
        document.getElementById('authLoading').style.display = 'none';
        document.getElementById('authCard').style.display = 'block';
        return;
      }
      const previousUid = localStorage.getItem(LAST_UID_KEY);
      if (previousUid && previousUid !== user.uid) {
        frameWindow()?.localStorage.removeItem(STORAGE_KEY);
        currentSnapshot = '';
        lastSnapshot = '';
      }
      localStorage.setItem(LAST_UID_KEY, user.uid);
      saveUserProfile(user).catch(error => console.error(friendlyError(error)));
      const appFrame = frame();
      const sync = async () => {
        showApp(true);
        startRealtimeListener(user);
        await loadAndSync(user);
      };
      if (appFrame.contentWindow?.document?.readyState === 'complete') await sync();
      else appFrame.addEventListener('load', sync, { once: true });
    });
  } catch (error) {
    document.getElementById('authLoading').style.display = 'none';
    document.getElementById('authCard').style.display = 'block';
    setMessage(friendlyError(error), true);
  }
}

const authStyle = document.createElement('style');
authStyle.textContent = '@keyframes tyuSpin{to{transform:rotate(360deg)}}';
document.head.appendChild(authStyle);
window.addEventListener('DOMContentLoaded', main);
