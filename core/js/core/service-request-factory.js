import { APP_STATUS, SERVICE_TYPES } from './app-config.js';
import { estimateServicePrice, normalizeServiceType } from './tarifas-service.js';

function randomId(prefix = 'srv') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createServiceRequest(payload = {}) {
  const type = normalizeServiceType(payload.type || SERVICE_TYPES.PATRULLA);
  const urgente = Boolean(payload.urgente);
  const nocturno = Boolean(payload.nocturno);
  const kilometros = Number(payload.kilometrosEstimados || payload.kilometros || 0) || 0;
  const pricing = estimateServicePrice({
    type,
    kilometros,
    urgente,
    nocturno,
    overrides: payload.tarifas || {}
  });

  return {
    id: payload.id || randomId(type),
    type,
    estado: payload.estado || APP_STATUS.PENDIENTE,
    titulo: String(payload.titulo || payload.asunto || '').trim(),
    productorId: payload.productorId || null,
    empleadoId: payload.empleadoId || null,
    origen: payload.origen || null,
    destino: payload.destino || null,
    prioridad: payload.prioridad || (urgente ? 'alta' : 'normal'),
    urgente,
    nocturno,
    kilometrosEstimados: kilometros,
    precioEstimado: pricing.total,
    comisionEstimada: Number((pricing.total * 0.15).toFixed(2)),
    moneda: payload.moneda || 'ARS',
    createdAt: payload.createdAt || new Date().toISOString(),
    metadata: { ...(payload.metadata || {}) }
  };
}

export function createMandadoDraft(payload = {}) {
  return createServiceRequest({
    ...payload,
    type: SERVICE_TYPES.MANDADO,
    titulo: payload.titulo || 'Mandado rural'
  });
}

export function createPatrullaDraft(payload = {}) {
  return createServiceRequest({
    ...payload,
    type: SERVICE_TYPES.PATRULLA,
    titulo: payload.titulo || 'Patrullaje rural'
  });
}
