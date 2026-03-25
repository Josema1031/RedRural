import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCRpSuQ3nSVvThu246TT0ai-G4OB9_yn_g',
  authDomain: 'red-rural.firebaseapp.com',
  projectId: 'red-rural',
  storageBucket: 'red-rural.firebasestorage.app',
  messagingSenderId: '30695077122',
  appId: '1:30695077122:web:2c700973abeac5914dbe1b'
};

const ADMIN_UID = 'mfCEucZxwne4vGJcMIvfm3hOe173';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);
const log = (m) => { $('log').textContent = m; };

function setUIAuthed(isAuthed) {
  $('btnLogin').classList.toggle('hide', isAuthed);
  $('btnLogout').classList.toggle('hide', !isAuthed);
  $('btnAplicar').classList.toggle('hide', !isAuthed);
  $('btnBajar').classList.toggle('hide', !isAuthed);
}

async function leerPlan(uid) {
  const ref = doc(db, 'productores', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { plan: 'free', exists: false };
  return { plan: snap.data().plan || 'free', exists: true, data: snap.data() };
}

async function setPlan(uid, plan) {
  const ref = doc(db, 'productores', uid);
  await setDoc(ref, {
    plan,
    actualizadoEn: serverTimestamp()
  }, { merge: true });
}

$('btnLogin')?.addEventListener('click', async () => {
  try {
    const email = $('email').value.trim();
    const pass = $('pass').value;
    if (!email || !pass) return log('⚠️ Completá email y password.');

    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    console.error(e);
    log('❌ Error login: ' + (e?.message || e));
  }
});

$('btnLogout')?.addEventListener('click', async () => {
  try { await signOut(auth); } catch (e) { console.error(e); }
});

$('btnAplicar')?.addEventListener('click', async () => {
  try {
    const user = auth.currentUser;
    if (!user) return log('⚠️ Logueate primero.');

    if (user.uid !== ADMIN_UID) {
      return log('❌ Este usuario no es admin (UID no coincide).');
    }

    const uid = $('uid').value.trim();
    const plan = $('plan').value;
    if (!uid) return log('⚠️ Pegá el UID del productor.');

    await setPlan(uid, plan);
    const info = await leerPlan(uid);

    log(`✅ Listo.\nUID: ${uid}\nPlan actual: ${info.plan.toUpperCase()}\nDoc existe: ${info.exists}\n\nSi te da PERMISSION_DENIED, revisá las rules.`);
  } catch (e) {
    console.error(e);
    log('❌ No se pudo aplicar. Error: ' + (e?.message || e));
  }
});

$('btnBajar')?.addEventListener('click', async () => {
  $('plan').value = 'free';
  $('btnAplicar').click();
});

onAuthStateChanged(auth, (user) => {
  if (!user) {
    $('estado').textContent = 'Estado: no logueado';
    setUIAuthed(false);
    log('Listo. Iniciá sesión para gestionar planes.');
    return;
  }

  $('estado').textContent = 'Estado: logueado (' + user.email + ')';
  setUIAuthed(true);

  if (user.uid === ADMIN_UID) {
    log('✅ Admin OK. Pegá el UID del productor y aplicá el plan.');
  } else {
    log('⚠️ Logueado, pero NO sos admin. Cerrá sesión e ingresá con la cuenta admin.');
  }
});
