import { SERVICE_TYPES } from '../../core/app-config.js';
import { MANDADOS_BASE } from './mandados.base.js';

export const SERVICES_REGISTRY = Object.freeze([
  { key: SERVICE_TYPES.PATRULLA, label: 'Patrullaje rural', monetizable: true },
  { key: SERVICE_TYPES.INCIDENCIA, label: 'Incidencias', monetizable: false },
  { key: SERVICE_TYPES.TAREA, label: 'Tareas operativas', monetizable: false },
  { key: SERVICE_TYPES.MANDADO, label: 'Mandados rurales', monetizable: true, ...MANDADOS_BASE },
  { key: SERVICE_TYPES.TRASLADO, label: 'Traslado rural', monetizable: true }
]);

export function bootstrapServicesRegistry() {
  if (!window.__RED_RURAL__) window.__RED_RURAL__ = {};
  window.__RED_RURAL__.services = SERVICES_REGISTRY;
  return SERVICES_REGISTRY;
}
