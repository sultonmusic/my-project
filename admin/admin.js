import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {getAuth,onAuthStateChanged,GoogleAuthProvider,signInWithPopup,signOut,setPersistence,browserLocalPersistence} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {getFirestore,collection,onSnapshot,query,orderBy} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const $=id=>document.getElementById(id);let auth,db,profiles=[];
const show=id=>{['loading','login','dashboard'].forEach(name=>$(name).classList.toggle('hidden',name!==id));};
const date=value=>value?.toDate?new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'short'}).format(value.toDate()):'—';
function render(items=profiles){
  const term=$('search').value.trim().toLowerCase();
  const filtered=items.filter(p=>`${p.username||''} ${p.email||''}`.toLowerCase().includes(term));
  $('users').innerHTML=filtered.map(p=>`<tr><td>${escapeHtml(p.username||'Без имени')}</td><td>${escapeHtml(p.email||'Не указан')}</td><td><span class="badge">${p.provider==='google.com'?'Google':'Пароль'}</span></td><td>${date(p.createdAt)}</td><td>${date(p.lastLoginAt)}</td></tr>`).join('');
  $('empty').classList.toggle('hidden',filtered.length!==0);
  $('totalUsers').textContent=profiles.length;
  $('emailUsers').textContent=profiles.filter(p=>p.email).length;
  $('googleUsers').textContent=profiles.filter(p=>p.provider==='google.com').length;
  const week=Date.now()-7*864e5;$('weekUsers').textContent=profiles.filter(p=>p.createdAt?.toMillis?.()>=week).length;
  $('updatedAt').textContent=`Обновлено: ${new Intl.DateTimeFormat('ru-RU',{timeStyle:'short'}).format(new Date())}`;
}
const escapeHtml=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
async function main(){
  const config=await fetch('/__/firebase/init.json').then(r=>r.json());
  const app=initializeApp(config);auth=getAuth(app);db=getFirestore(app);await setPersistence(auth,browserLocalPersistence);
  onAuthStateChanged(auth,async user=>{
    if(!user){show('login');return;}
    const isAllowed=user.email?.toLowerCase()==='sales.infarmatik.tj@gmail.com'&&user.providerData.some(item=>item.providerId==='google.com');
    if(!isAllowed){await signOut(auth);$('loginError').textContent='Доступ разрешён только аккаунту sales.infarmatik.tj@gmail.com.';show('login');return;}
    show('dashboard');
    onSnapshot(query(collection(db,'userProfiles'),orderBy('createdAt','desc')),snap=>{profiles=snap.docs.map(item=>item.data());render();},error=>{$('empty').textContent=error.message;$('empty').classList.remove('hidden');});
  });
  $('googleLogin').onclick=async()=>{$('loginError').textContent='';try{const provider=new GoogleAuthProvider();provider.setCustomParameters({login_hint:'sales.infarmatik.tj@gmail.com',prompt:'select_account'});await signInWithPopup(auth,provider);}catch(error){$('loginError').textContent=error.code==='auth/popup-closed-by-user'?'Окно Google было закрыто.':'Не удалось войти через Google.';}};
  $('logout').onclick=()=>signOut(auth);$('search').oninput=()=>render();
}
main().catch(error=>{$('loading').innerHTML=`<div class="error">${escapeHtml(error.message)}</div>`;});
