import { PRODUCTOR_SERVICE_SEEDS } from './producer-service-seeds.js';
import { summarizeServices } from '../../core/monetization-service.js';

function mergeUniqueRequests(existing = [], incoming = []) {
  const map = new Map();
  [...existing, ...incoming].forEach((item) => {
    if (!item?.id) return;
    map.set(item.id, item);
  });
  return Array.from(map.values());
}

export function bootstrapProducerServiceBridge() {
  if (!window.__RED_RURAL__) window.__RED_RURAL__ = {};

  const current = Array.isArray(window.__RED_RURAL__.serviceRequests)
    ? window.__RED_RURAL__.serviceRequests
    : [];

  const merged = mergeUniqueRequests(current, PRODUCTOR_SERVICE_SEEDS);
  const resumen = summarizeServices(merged);
  const monetizables = merged.filter((request) => Number(request?.precioEstimado || 0) > 0);

  window.__RED_RURAL__.serviceRequests = merged;
  window.__RED_RURAL__.producerBridge = {
    source: 'productor-panel',
    totalSolicitudes: merged.length,
    monetizables: monetizables.length,
    pendientes: merged.filter((request) => request?.estado === 'pendiente').length,
    tiposActivos: [...new Set(merged.map((request) => request.type))]
  };

  if (!window.__RED_RURAL__.business) window.__RED_RURAL__.business = {};
  window.__RED_RURAL__.business.resumenServicios = resumen;
  window.__RED_RURAL__.business.resumenProductor = {
    solicitudesTotales: merged.length,
    monetizables: monetizables.length,
    ingresoBrutoEstimado: Number(resumen.total.toFixed(2)),
    comisionPlataformaEstimada: Number(resumen.comisiones.toFixed(2))
  };

  return merged;
}
