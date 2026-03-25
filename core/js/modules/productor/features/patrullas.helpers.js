import { getStatusBadgeClass, getStatusClass, getStatusLabel, buildPatrullaSummary } from '../../../core/status-utils.js';

export function getPatrullaEstadoClase(estado) {
  return getStatusClass(estado);
}

export function getPatrullaEstadoTexto(estado) {
  return getStatusLabel(estado);
}

export function getPatrullaBadgeClass(estado) {
  return getStatusBadgeClass(estado);
}

export function formatPatrullaResumenFinalizada(p) {
  return buildPatrullaSummary(p);
}
