import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut,setPersistence,browserLocalPersistence} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {getFirestore,doc,getDoc,collection,onSnapshot,query,orderBy} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

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
    const admin=await getDoc(doc(db,'admins',user.uid));
    if(!admin.exists()||admin.data().enabled!==true){await signOut(auth);$('loginError').textContent='У этого аккаунта нет прав администратора.';show('login');return;}
    show('dashboard');
    onSnapshot(query(collection(db,'userProfiles'),orderBy('createdAt','desc')),snap=>{profiles=snap.docs.map(item=>item.data());render();},error=>{$('empty').textContent=error.message;$('empty').classList.remove('hidden');});
  });
  $('loginForm').onsubmit=async e=>{e.preventDefault();$('loginError').textContent='';try{await signInWithEmailAndPassword(auth,$('email').value.trim(),$('password').value);}catch(error){$('loginError').textContent='Неверный email, пароль или нет доступа.';}};
  $('logout').onclick=()=>signOut(auth);$('search').oninput=()=>render();
}
main().catch(error=>{$('loading').innerHTML=`<div class="error">${escapeHtml(error.message)}</div>`;});
