import { auth, db } from "../../../firebase-init.js";

import {
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const form = document.getElementById("formLogin");
const estado = document.getElementById("estado");
const btnLogin = document.getElementById("btnLogin");

function setEstado(msg, tipo = "") {
  estado.textContent = msg;
  estado.className = "estado";
  if (tipo) estado.classList.add(tipo);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    btnLogin.disabled = true;
    btnLogin.textContent = "Ingresando...";
    setEstado("Validando acceso...");

    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    const refDoc = doc(db, "patrulleros_externos", user.uid);
    const snap = await getDoc(refDoc);

    if (!snap.exists()) {
      setEstado("Tu cuenta aun no ha sido validada", "error");
      return;
    }

    const data = snap.data();

    if (data.estado !== "aprobado" || data.activo !== true) {
      setEstado("Tu cuenta aún no fue aprobada por el administrador.", "error");
      return;
    }

    setEstado("Ingreso correcto", "ok");
    window.location.href = "./panel.html";
  } catch (error) {
    console.error(error);

    let mensaje = "No se pudo iniciar sesión.";

    if (error.code === "auth/invalid-credential") {
      mensaje = "Email o contraseña incorrectos.";
    } else if (error.code === "auth/user-not-found") {
      mensaje = "Usuario no encontrado.";
    } else if (error.code === "auth/wrong-password") {
      mensaje = "Contraseña incorrecta.";
    }

    setEstado(mensaje, "error");
  } finally {
    btnLogin.disabled = false;
    btnLogin.textContent = "Ingresar";
  }
});