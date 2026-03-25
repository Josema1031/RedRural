
export const APP_STATUS = Object.freeze({
  PENDIENTE: 'pendiente',
  ASIGNADO: 'asignado',
  EN_CAMINO: 'en_camino',
  EN_PROCESO: 'en_proceso',
  FINALIZADO: 'finalizado',
  CANCELADO: 'cancelado'
});

export const SERVICE_TYPES = Object.freeze({
  PATRULLA: 'patrulla',
  INCIDENCIA: 'incidencia',
  TAREA: 'tarea',
  MANDADO: 'mandado',
  TRASLADO: 'traslado'
});

export const TARIFAS_BASE = Object.freeze({
  patrulla: { base: 0, nocturno: 0, urgencia: 0, porKm: 0 },
  mandado: { base: 0, urgencia: 0, porKm: 0 },
  traslado: { base: 0, urgencia: 0, porKm: 0 }
});

export function createDiagnosticsBucket(scope = 'global') {
  if (!window.__RED_RURAL__) window.__RED_RURAL__ = {};
  if (!window.__RED_RURAL__.diagnostics) window.__RED_RURAL__.diagnostics = {};
  if (!window.__RED_RURAL__.diagnostics[scope]) {
    window.__RED_RURAL__.diagnostics[scope] = { initialized: [], warnings: [], dom: {} };
  }
  return window.__RED_RURAL__.diagnostics[scope];
}
