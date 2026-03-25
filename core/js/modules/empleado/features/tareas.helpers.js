
import { updateDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export function createTareaItem({ tarea, id, db, onError }) {
  const div = document.createElement("div");
  div.className = "item";

  const estadoTxt = tarea.completada ? "✅ Completada" : "🕒 Pendiente";
  div.innerHTML = `
    <div><b>📌 ${tarea.texto ?? "(sin texto)"}</b></div>
    <div class="muted">
      ${tarea.categoria ?? "Sin categoría"} • ${tarea.prioridad ?? ""} • ${estadoTxt}
    </div>
    ${tarea.completada ? "" : `
      <div class="actions">
        <button class="btn-ok">✅ Marcar realizada</button>
      </div>
    `}
  `;

  const btn = div.querySelector('.btn-ok');
  if (btn) {
    btn.addEventListener('click', async () => {
      try {
        btn.disabled = true;
        btn.textContent = 'Guardando...';
        await updateDoc(doc(db, 'tareas', id), {
          completada: true,
          realizadaEn: serverTimestamp(),
          syncPendiente: !navigator.onLine
        });
        if (!navigator.onLine) btn.textContent = '🟠 Pendiente de sincronizar';
      } catch (error) {
        console.error('No se pudo completar:', error);
        btn.disabled = false;
        btn.textContent = '✅ Marcar realizada';
        if (typeof onError === 'function') onError(error);
      }
    });
  }

  return div;
}
