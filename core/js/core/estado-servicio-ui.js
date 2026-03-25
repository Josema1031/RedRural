
import { cambiarEstadoServicioFirestore } from './cambio-estado-servicio.js';

export function renderAccionesServicio(servicio){
  return `
    <div class="acciones-servicio">
      <button type="button" onclick="window.cambiarEstadoServicioUI('${servicio.id}','en_camino')">🚗 En camino</button>
      <button type="button" onclick="window.cambiarEstadoServicioUI('${servicio.id}','en_proceso')">🛠 En proceso</button>
      <button type="button" onclick="window.cambiarEstadoServicioUI('${servicio.id}','finalizado')">✅ Finalizado</button>
    </div>
  `;
}

export function registrarAccionesGlobales(db){
  window.cambiarEstadoServicioUI = async (id, estado)=>{
    try {
      const res = await cambiarEstadoServicioFirestore(db, id, estado);
      console.log('Estado actualizado', res);
    } catch (error) {
      console.error('Error actualizando estado del servicio', error);
    }
  };
}
