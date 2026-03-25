
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { renderMetricasServicios } from './metricas-servicios-ui.js';

export function montarHistorialServiciosProductor({ db, auth, containerId = 'contenedorHistorialServiciosProductor', metricasId = 'contenedorMetricasServiciosProductor' }) {
  const cont = document.getElementById(containerId);
  if (!cont || !db || !auth?.currentUser) return () => {};

  const q = query(
    collection(db, 'solicitudes_servicio'),
    where('productorId', '==', auth.currentUser.uid),
    orderBy('actualizadoEnServer', 'desc')
  );

  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderMetricasServicios(metricasId, items);

    if (!items.length) {
      cont.innerHTML = '<div class="card-historial-servicios"><h3>🧾 Historial de servicios</h3><p>No hay servicios todavía.</p></div>';
      return;
    }

    let html = '<div class="card-historial-servicios"><h3>🧾 Historial de servicios</h3><div class="tabla-historial-servicios">';
    items.forEach(s => {
      html += `
        <div class="fila-historial-servicio">
          <div><strong>${s.tipo || 'servicio'}</strong></div>
          <div>${s.titulo || 'Sin título'}</div>
          <div>${s.estado || 'pendiente'}</div>
          <div>$${s.precio || 0}</div>
          <div>${s.asignadoA || '-'}</div>
        </div>
      `;
    });
    html += '</div></div>';
    cont.innerHTML = html;
  }, (error) => {
    console.error('Error historial servicios productor', error);
    cont.innerHTML = '<div class="card-historial-servicios"><h3>🧾 Historial de servicios</h3><p>Error al cargar historial.</p></div>';
  });
}
