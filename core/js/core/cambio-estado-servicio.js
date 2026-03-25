
import {
  doc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function cambiarEstadoServicioFirestore(db, servicioId, nuevoEstado) {
  if (!db || !servicioId || !nuevoEstado) {
    return { ok: false, motivo: "datos_incompletos" };
  }

  const ref = doc(db, "solicitudes_servicio", servicioId);
  await updateDoc(ref, {
    estado: nuevoEstado,
    actualizadoEnServer: serverTimestamp()
  });

  return { ok: true, servicioId, nuevoEstado };
}
