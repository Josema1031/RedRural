
import { calcularMetricasServicios } from './metricas-servicios.js';

export function renderMetricasServicios(containerId, servicios = []) {
  const cont = document.getElementById(containerId);
  if (!cont) return;

  const m = calcularMetricasServicios(servicios);

  cont.innerHTML = `
    <div class="card-metricas-servicios">
      <h3>📊 Métricas de servicios</h3>
      <div class="grid-metricas-servicios">
        <div class="item-metrica"><span>Total</span><strong>${m.total}</strong></div>
        <div class="item-metrica"><span>Finalizados</span><strong>${m.finalizados}</strong></div>
        <div class="item-metrica"><span>En camino</span><strong>${m.enCamino}</strong></div>
        <div class="item-metrica"><span>En proceso</span><strong>${m.enProceso}</strong></div>
        <div class="item-metrica"><span>Pendientes</span><strong>${m.pendientes}</strong></div>
        <div class="item-metrica"><span>Facturación</span><strong>$${m.facturacion}</strong></div>
        <div class="item-metrica"><span>Comisión</span><strong>$${m.comision}</strong></div>
        <div class="item-metrica"><span>Ticket promedio</span><strong>$${m.ticketPromedio}</strong></div>
      </div>
    </div>
  `;
}
