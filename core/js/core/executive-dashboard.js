import { summarizeServices } from './monetization-service.js';

function countByStatus(requests = []) {
  return requests.reduce((acc, item) => {
    const key = item?.estado || 'sin_estado';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function topTypes(summary = {}) {
  const pairs = Object.entries(summary.porTipo || {});
  return pairs
    .sort((a, b) => b[1] - a[1])
    .map(([tipo, cantidad]) => ({ tipo, cantidad }));
}

export function buildExecutiveDashboardSnapshot({ services = [], producers = 1, employees = 1 } = {}) {
  const resumen = summarizeServices(services);
  const porEstado = countByStatus(services);
  const ingresoPromedio = resumen.cantidad ? Number((resumen.total / resumen.cantidad).toFixed(2)) : 0;
  const comisionPromedio = resumen.cantidad ? Number((resumen.comisiones / resumen.cantidad).toFixed(2)) : 0;

  return {
    fechaCorte: new Date().toISOString(),
    metricas: {
      solicitudes: resumen.cantidad,
      ingresoBrutoEstimado: Number(resumen.total.toFixed(2)),
      comisionEstimada: Number(resumen.comisiones.toFixed(2)),
      ticketPromedio: ingresoPromedio,
      comisionPromedio,
      productoresActivos: producers,
      prestadoresActivos: employees
    },
    operacion: {
      porEstado,
      topServicios: topTypes(resumen)
    }
  };
}

export function bootstrapExecutiveDashboard({ producers = 1, employees = 1 } = {}) {
  if (!window.__RED_RURAL__) window.__RED_RURAL__ = {};
  const services = Array.isArray(window.__RED_RURAL__.serviceRequests)
    ? window.__RED_RURAL__.serviceRequests
    : [];
  const snapshot = buildExecutiveDashboardSnapshot({ services, producers, employees });
  window.__RED_RURAL__.executiveDashboard = snapshot;

  if (!window.__RED_RURAL__.business) window.__RED_RURAL__.business = {};
  window.__RED_RURAL__.business.executive = snapshot.metricas;

  return snapshot;
}
