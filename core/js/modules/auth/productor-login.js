import { auth } from '../../../firebase-init.js';
import { signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { bindNetworkStatus, registerAppServiceWorker } from '../../core/network-status.js';

const btn = document.getElementById('btnLogin');
const msg = document.getElementById('msg');
const net = document.getElementById('net');
const userEl = document.getElementById('user');
const passEl = document.getElementById('pass');
const LOGIN_CACHE_KEY = 'productorLoginCache';

bindNetworkStatus(
  net,
  '🟢 Con conexión',
  '🟠 Sin conexión. Solo podés entrar con la última sesión guardada en este dispositivo.'
);
registerAppServiceWorker('../service-worker.js', 'login-productor');

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

function traducirAuthError(code) {
  if (code === 'auth/invalid-credential') return 'Email o contraseña incorrectos (o usuario inexistente).';
  if (code === 'auth/user-disabled') return 'Usuario deshabilitado.';
  if (code === 'auth/too-many-requests') return 'Demasiados intentos. Probá más tarde.';
  if (code === 'auth/network-request-failed') return 'Sin conexión o bloqueado por red.';
  return code || 'Error desconocido.';
}

async function loginProductor() {
  const email = userEl.value.trim();
  const pass = passEl.value.trim();

  if (!email || !pass) {
    msg.textContent = 'Completa todos los campos.';
    return;
  }

  try {
    if (!navigator.onLine) {
      const cache = leerCacheLogin();
      if (!cache || cache.email !== email || cache.pass !== pass) {
        msg.textContent = 'Sin internet solo podés entrar con la última sesión guardada en este dispositivo.';
        return;
      }
      localStorage.setItem('productorId', cache.productorId);
      localStorage.setItem('modoOffline', '1');
      window.location.href = 'panel.html';
      return;
    }

    const cred = await signInWithEmailAndPassword(auth, email, pass);
    localStorage.setItem('productorId', cred.user.uid);
    localStorage.setItem('modoOffline', '0');

    guardarCacheLogin({
      email,
      pass,
      productorId: cred.user.uid,
      ts: Date.now()
    });

    window.location.href = 'panel.html';
  } catch (error) {
    console.error(error);
    msg.textContent = 'Error: ' + traducirAuthError(error.code);
  }
}

btn?.addEventListener('click', loginProductor);
