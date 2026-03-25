import { initV27ProducerVisual } from '../../core/v27-visual-premium.js';
import { initV26ProducerCenter } from '../../core/v26-cierre-profesional.js';
import { initV25ProducerDashboard } from '../../core/v25-tablero-comercial.js';
import { bootstrapServicesRegistry } from '../services/services-registry.js';
import { bootstrapServiceRequests } from '../services/service-request-registry.js';
import { bootstrapProducerServiceBridge } from '../services/producer-service-bridge.js';
import { bootstrapExecutiveDashboard } from '../../core/executive-dashboard.js';
import { renderTableroEjecutivoUI } from '../../core/tablero-ejecutivo-ui.js';
import { inicializarResumenProductor } from '../../core/resumen-productor.js';
import { renderResumenProductorUI } from '../../core/resumen-productor-ui.js';

import './panel.module.js';
import { PRODUCTOR_FEATURES } from './features/registry.js';
import { FEATURE_FLAGS } from '../../core/feature-flags.js';
import { createDiagnosticsBucket } from '../../core/app-config.js';

window.PRODUCTOR_FEATURES = PRODUCTOR_FEATURES;

function bootstrapFeatures() {
  const bucket = createDiagnosticsBucket('productor');
  if (!FEATURE_FLAGS.productorFeatureBootstrap) return;
  for (const feature of PRODUCTOR_FEATURES) {
    try {
      if (typeof feature.init === 'function') feature.init();
    } catch (error) {
      bucket.warnings.push({ key: feature.key, message: error?.message || String(error) });
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapFeatures, { once: true });
} else {
  bootstrapFeatures();
}

bootstrapServicesRegistry();

bootstrapServiceRequests();
bootstrapProducerServiceBridge();
// bootstrapExecutiveDashboard({ producers: 1, employees: 2 });
//inicializarResumenProductor({ productorId: 'demo-productor' });
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    renderTableroEjecutivoUI({ panelType: 'productor' });
    //renderResumenProductorUI();
  }, { once: true });
} else {
  //renderTableroEjecutivoUI({ panelType: 'productor' });
  //renderResumenProductorUI();
}
import { renderAsignacionDemo } from '../../core/asignacion-servicio-ui.js';

document.addEventListener('DOMContentLoaded', () => {
  renderAsignacionDemo('contenedorAsignacionServicio');
});
function bootV25ProducerWhenReady() {
  const tick = () => {
    const productorId = localStorage.getItem('productorId') || '';
    if (!productorId) return setTimeout(tick, 700);
    //initV25ProducerDashboard({ productorId });
  };
  tick();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootV25ProducerWhenReady, { once: true });
} else {
  bootV25ProducerWhenReady();
}

function bootV26Productor() {
  const productorId = localStorage.getItem('productorId') || '';
  if (!productorId) return;
  //initV26ProducerCenter({ productorId });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootV26Productor, { once: true });
} else {
  bootV26Productor();
}

function bootV27Productor() {
  const productorId = localStorage.getItem('productorId') || '';
  if (!productorId) return;
 // initV27ProducerVisual({ productorId });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootV27Productor, { once: true });
} else {
  bootV27Productor();
}
