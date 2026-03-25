// index.js - Ubicado en vigia-admin/
import { initV27ProducerVisual } from '../js/core/v27-visual-premium.js';
import { initV26ProducerCenter } from '../js/core/v26-cierre-profesional.js';
import { initV25ProducerDashboard } from '../js/core/v25-tablero-comercial.js';
import { bootstrapServicesRegistry } from '../js/modules/services/services-registry.js';
import { bootstrapServiceRequests } from '../js/modules/services/service-request-registry.js';
import { bootstrapProducerServiceBridge } from '../js/modules/services/producer-service-bridge.js';
import { renderAsignacionDemo } from '../js/core/asignacion-servicio-ui.js';

function ensureAdminContext() {
  let pId = localStorage.getItem("productorId") || "demo-productor";
  localStorage.setItem("productorId", pId);
  return pId;
}

// --- FUNCIONES GLOBALES ---
window.bootV25 = () => initV25ProducerDashboard({ productorId: ensureAdminContext() });
window.bootV26 = () => initV26ProducerCenter({ productorId: ensureAdminContext() });
window.bootV27 = () => initV27ProducerVisual({ productorId: ensureAdminContext() });

window.bootOperacion = function() {
  bootstrapServicesRegistry();
  bootstrapServiceRequests();
  bootstrapProducerServiceBridge();
  renderAsignacionDemo('contenedorAsignacionServicio');
};

// --- GESTIÓN DE PESTAÑAS ---
function initTabs() {
  const botones = document.querySelectorAll('.nav-btn[data-target]');
  const secciones = document.querySelectorAll('.container section');

  botones.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      botones.forEach((b) => b.classList.remove('activo'));
      btn.classList.add('activo');
      secciones.forEach((sec) => { sec.classList.remove('visible'); sec.classList.add('hidden'); });

      const destino = document.getElementById(target);
      if (destino) {
        destino.classList.remove('hidden');
        destino.classList.add('visible');
        
        // Disparar solo lo necesario
        if (target === 'sec-v25') window.bootV25();
        if (target === 'sec-v26') window.bootV26();
        if (target === 'sec-v27') window.bootV27();
        if (target === 'sec-operacion') window.bootOperacion();
      }
    });
  });
}

// --- ARRANQUE ---
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  window.bootV25(); // Arrancamos directo en V25
  window.bootOperacion(); // Cargamos servicios de fondo
});