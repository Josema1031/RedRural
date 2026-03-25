import { auth, db } from '../../../firebase-init.js';
import { signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { bindNetworkStatus, registerAppServiceWorker } from '../../core/network-status.js';

const dniEl = document.getElementById('dni');
const passEl = document.getElementById('pass');
const errEl = document.getElementById('err');
const btn = document.getElementById('btnLogin');
const netEl = document.getElementById('net');
const LOGIN_CACHE_KEY = 'empleadoLoginCache';

bindNetworkStatus(
  netEl,
  '🟢 Con conexión',
  '🟠 Sin conexión. Solo podés entrar con un usuario que ya haya iniciado sesión antes en este dispositivo.'
);
registerAppServiceWorker('../service-worker.js', 'login-empleado');

function showErr(text) {
  errEl.style.display = 'block';
  errEl.textContent = text;
}

function clearErr() {
  errEl.style.display = 'none';
  errEl.textContent = '';
}

function guardarCacheLogin(data) {
  localStorage.setItem(LOGIN_CACHE_KEY, JSON.stringify(data));
}

function leerCacheLogin() {
  try {
    return JSON.parse(localStorage.getItem(LOGIN_CACHE_KEY) || 'null');
  } catch {
    return null;
  }
}

function entrarAlPanel(dni, productorId, offline = false) {
  localStorage.setItem('empleadoDni', dni);
  localStorage.setItem('empleadoDocId', dni);
  localStorage.setItem('productorId', productorId || '');
  localStorage.setItem('modoOffline', offline ? '1' : '0');
  location.href = './panel.html';
}

async function loginOnline(dni, clave) {
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }

  const refEmp = doc(db, 'employees', dni);
  const snap = await getDoc(refEmp);

  if (!snap.exists()) return showErr('Empleado no encontrado.');

  const data = snap.data();
  if (data.activo === false) return showErr('Empleado inactivo. Consultá al productor.');
  if ((data.clave || '') !== clave) return showErr('Contraseña incorrecta.');

  guardarCacheLogin({
    dni,
    clave,
    productorId: data.productorId || '',
    nombre: data.nombre || '',
    ts: Date.now()
  });

  entrarAlPanel(dni, data.productorId || '', false);
}

function loginOffline(dni, clave) {
  const cache = leerCacheLogin();
  if (!cache) return showErr('Este dispositivo todavía no tiene una sesión guardada para usar sin internet.');
  if (cache.dni !== dni) return showErr('Sin internet solo podés ingresar con el último empleado guardado en este dispositivo.');
  if (cache.clave !== clave) return showErr('Contraseña incorrecta.');

  entrarAlPanel(cache.dni, cache.productorId || '', true);
}

btn?.addEventListener('click', async () => {
  clearErr();

  const dni = (dniEl.value || '').trim().replace(/\D/g, '');
  const clave = (passEl.value || '').trim();

  if (!dni || !clave) return showErr('Completá DNI y contraseña.');

  btn.disabled = true;
  btn.textContent = navigator.onLine ? 'Ingresando...' : 'Entrando offline...';

  try {
    if (navigator.onLine) {
      await loginOnline(dni, clave);
    } else {
      loginOffline(dni, clave);
    }
  } catch (e) {
    console.error(e);
    if (!navigator.onLine || e?.code === 'unavailable') {
      loginOffline(dni, clave);
    } else {
      showErr('Error de login. Revisá conexión y permisos.');
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Ingresar';
  }
});
