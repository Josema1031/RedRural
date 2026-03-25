import { app, auth, db } from "../../../firebase-init.js";
import { 
  getStorage, ref, uploadBytes, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { 
  doc, setDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { 
  createUserWithEmailAndPassword, signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const storage = getStorage(app);
const $ = (id) => document.getElementById(id);

const form = $("formRegistroPatrullero");
const estadoMsg = $("estadoMsg");
const btnEnviar = $("btnEnviar");

function setEstado(msg, tipo = "") {
  estadoMsg.textContent = msg;
  estadoMsg.className = "estado-msg";
  if (tipo === "ok") estadoMsg.style.color = "#27ae60";
  if (tipo === "error") estadoMsg.style.color = "#e74c3c";
  if (!tipo) estadoMsg.style.color = "#666";
}

// Función mágica para subir a Storage
async function subirArchivo(file, path) {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setEstado("Iniciando registro y subida de documentos...", "");

  const email = $("email").value.trim();
  const password = $("password").value;
  const dni = $("dni").value.trim();
  // ... (captura el resto de los campos como nombre, apellido, etc.)

  // Capturamos los archivos de los inputs
  const fDniFrente = $("dniFrente").files[0];
  const fDniDorso = $("dniDorso").files[0];
  const fAntecedentes = $("antecedentes").files[0];
  const fLicencia = $("licencia").files[0];
  const fFotoVehiculo = $("fotoVehiculo").files[0];

  if (!fDniFrente || !fDniDorso) {
    setEstado("Faltan documentos obligatorios.", "error");
    return;
  }

  try {
    btnEnviar.disabled = true;
    btnEnviar.textContent = "Subiendo archivos...";

    // 1. Crear el usuario en Auth
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;

    // 2. Subir archivos a carpetas organizadas por UID
    setEstado("Subiendo DNI y certificados...");
    const pathBase = `patrulleros_externos/${uid}`;
    
    const dniFrenteUrl = await subirArchivo(fDniFrente, `${pathBase}/dni_frente`);
    const dniDorsoUrl = await subirArchivo(fDniDorso, `${pathBase}/dni_dorso`);
    const antecedentesUrl = await subirArchivo(fAntecedentes, `${pathBase}/antecedentes`);
    const licenciaUrl = await subirArchivo(fLicencia, `${pathBase}/licencia`);
    const fotoVehiculoUrl = await subirArchivo(fFotoVehiculo, `${pathBase}/vehiculo`);

    // 3. Guardar en Firestore con las URLs reales
    setEstado("Finalizando registro...");
    await setDoc(doc(db, "patrulleros_externos", uid), {
      authUid: uid,
      dni,
      email,
      nombre: $("nombre").value,
      apellido: $("apellido").value,
      // ... (agrega aquí todos los campos que tenías antes)
      documentos: {
        dniFrenteUrl,
        dniDorsoUrl,
        antecedentesUrl,
        licenciaUrl,
        fotoVehiculoUrl
      },
      estado: "pendiente",
      activo: false,
      createdAt: serverTimestamp()
    });

    await signOut(auth);
    form.reset();
    setEstado("¡Registro completo! Documentos subidos con éxito.", "ok");
    alert("Solicitud enviada correctamente.");

  } catch (error) {
    console.error(error);
    setEstado("Error: " + error.message, "error");
  } finally {
    btnEnviar.disabled = false;
    btnEnviar.textContent = "Enviar solicitud";
  }
});