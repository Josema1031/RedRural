import { SERVICE_TYPES, TARIFAS_BASE } from './app-config.js';

export function normalizeServiceType(type) {
  const value = String(type || '').trim().toLowerCase();
  if (Object.values(SERVICE_TYPES).includes(value)) return value;
  return SERVICE_TYPES.PATRULLA;
}

export function getTarifaConfig(type, overrides = {}) {
  const key = normalizeServiceType(type);
  const base = TARIFAS_BASE[key] || { base: 0, urgencia: 0, porKm: 0, nocturno: 0 };
  return { ...base, ...(overrides || {}) };
}

export function estimateServicePrice({
  type = SERVICE_TYPES.PATRULLA,
  kilometros = 0,
  urgente = false,
  nocturno = false,
  overrides = {}
} = {}) {
  const tarifa = getTarifaConfig(type, overrides);
  const kms = Number(kilometros) || 0;
  const total = Number(tarifa.base || 0)
    + (kms * Number(tarifa.porKm || 0))
    + (urgente ? Number(tarifa.urgencia || 0) : 0)
    + (nocturno ? Number(tarifa.nocturno || 0) : 0);

  return {
    type: normalizeServiceType(type),
    kilometros: kms,
    urgente: Boolean(urgente),
    nocturno: Boolean(nocturno),
    total: Math.max(0, Number(total.toFixed(2)))
  };
}

export function estimatePatrullaPrice(args = {}) {
  return estimateServicePrice({ ...args, type: SERVICE_TYPES.PATRULLA });
}
