import { SERVICE_TYPES } from './app-config.js';
import { estimateServicePrice } from './tarifas-service.js';

export const DEFAULT_COMMISSION_RATE = 0.15;

export function calculateCommission(total = 0, rate = DEFAULT_COMMISSION_RATE) {
  const amount = Number(total) || 0;
  return Number((amount * Number(rate || 0)).toFixed(2));
}

export function buildServiceFinancials({ type = SERVICE_TYPES.PATRULLA, kilometros = 0, urgente = false, nocturno = false, rate = DEFAULT_COMMISSION_RATE, overrides = {} } = {}) {
  const estimation = estimateServicePrice({ type, kilometros, urgente, nocturno, overrides });
  const comision = calculateCommission(estimation.total, rate);
  return {
    ...estimation,
    rate,
    comision,
    netoPrestador: Number((estimation.total - comision).toFixed(2))
  };
}

export function summarizeServices(services = []) {
  return services.reduce((acc, service) => {
    const total = Number(service?.precioEstimado || service?.total || 0) || 0;
    const commission = Number(service?.comisionEstimada || service?.comision || calculateCommission(total)) || 0;
    acc.cantidad += 1;
    acc.total += total;
    acc.comisiones += commission;
    const type = service?.type || 'otro';
    acc.porTipo[type] = (acc.porTipo[type] || 0) + 1;
    return acc;
  }, { cantidad: 0, total: 0, comisiones: 0, porTipo: {} });
}
