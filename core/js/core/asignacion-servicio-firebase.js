
import {
  doc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function asignarServicioFirestore(db, servicioId, empleadoId) {
  if (!db || !servicioId) {
    return { ok: false, motivo: "datos_incompletos" };
  }

  const ref = doc(db, "solicitudes_servicio", servicioId);
  await updateDoc(ref, {
    asignadoA: empleadoId || "",
    estado: "asignado",
    actualizadoEnServer: serverTimestamp()
  });

  return { ok: true, servicioId, empleadoId };
}

export async function escucharServiciosAsignadosEmpleado({ db, empleadoId, onData, onError }) {
  if (!db || !empleadoId) return () => {};

  try {
    const empRef = doc(db, "employees", empleadoId);
    const empSnap = await getDoc(empRef);

    if (!empSnap.exists()) {
      if (typeof onError === "function") onError(new Error("Empleado no encontrado"));
      return () => {};
    }

    const empData = empSnap.data();
    const productorId = empData?.productorId || "";

    if (!productorId) {
      if (typeof onError === "function") onError(new Error("Empleado sin productorId"));
      return () => {};
    }

    const q = query(
      collection(db, "solicitudes_servicio"),
      where("asignadoA", "==", empleadoId),
      where("productorId", "==", productorId),
      orderBy("actualizadoEnServer", "desc")
    );

    return onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (typeof onData === "function") onData(items);
    }, (error) => {
      console.error("Error escuchando servicios asignados", error);
      if (typeof onError === "function") onError(error);
    });
  } catch (error) {
    console.error("Error preparando escucha de servicios", error);
    if (typeof onError === "function") onError(error);
    return () => {};
  }
}
