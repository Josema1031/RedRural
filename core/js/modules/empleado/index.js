import { initV27EmployeeVisual } from '../../core/v27-visual-premium.js';
import { initV26EmployeeCenter } from '../../core/v26-cierre-profesional.js';
import { initV25EmployeeDashboard } from '../../core/v25-tablero-comercial.js';

import { auth, db } from '../../../firebase-init.js';
import { bootstrapServicesRegistry } from '../services/services-registry.js';
import { bootstrapServiceRequests } from '../services/service-request-registry.js';

import { renderTableroEjecutivoUI } from '../../core/tablero-ejecutivo-ui.js';

import './panel.module.js';
import { EMPLEADO_FEATURES } from './features/registry.js';
import { FEATURE_FLAGS } from '../../core/feature-flags.js';
import { createDiagnosticsBucket } from '../../core/app-config.js';
import { montarServiciosEmpleado } from '../../core/servicios-empleado-ui.js';
import { registrarAccionesGlobales } from '../../core/estado-servicio-ui.js';

window.EMPLEADO_FEATURES = EMPLEADO_FEATURES;

function bootstrapFeatures() {
  const bucket = createDiagnosticsBucket('empleado');
  if (!FEATURE_FLAGS.empleadoFeatureBootstrap) return;
  for (const feature of EMPLEADO_FEATURES) {
    try {
      if (typeof feature.init === 'function') feature.init();
    } catch (error) {
      bucket.warnings.push({ key: feature.key, message: error?.message || String(error) });
    }
  }
}

function bootstrapEmpleado() {
  bootstrapFeatures();
  bootstrapServicesRegistry();
  bootstrapServiceRequests();
  bootstrapExecutiveDashboard({ producers: 1, employees: 2 });
  renderTableroEjecutivoUI({ panelType: 'empleado' });
  registrarAccionesGlobales(db);

  const empleadoDni = localStorage.getItem('empleadoDni') || '';
  if (empleadoDni) {
    montarServiciosEmpleado({
      db,
      empleadoId: empleadoDni,
      containerId: 'contenedorServiciosEmpleado'
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapEmpleado, { once: true });
} else {
  bootstrapEmpleado();
}

function bootV25Empleado() {
  const productorId = localStorage.getItem('productorId') || '';
  const empleadoDni = localStorage.getItem('empleadoDni') || '';
  if (!productorId || !empleadoDni) return;
  initV25EmployeeDashboard({ productorId, empleadoDni });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootV25Empleado, { once: true });
} else {
  bootV25Empleado();
}

function bootV26Empleado() {
  const productorId = localStorage.getItem('productorId') || '';
  const empleadoDni = localStorage.getItem('empleadoDni') || '';
  if (!productorId || !empleadoDni) return;
  initV26EmployeeCenter({ productorId, empleadoDni });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootV26Empleado, { once: true });
} else {
  bootV26Empleado();
}

function bootV27Empleado() {
  const productorId = localStorage.getItem('productorId') || '';
  const empleadoDni = localStorage.getItem('empleadoDni') || '';
  if (!productorId || !empleadoDni) return;
  initV27EmployeeVisual({ productorId, empleadoDni });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootV27Empleado, { once: true });
} else {
  bootV27Empleado();
}
