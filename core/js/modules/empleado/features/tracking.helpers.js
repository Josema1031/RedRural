import { getStatusColor, getStatusShortLabel } from '../../../core/status-utils.js';

export function paintConnectionState(element, { offline, modoOffline }) {
  if (!element) return;
  element.style.background = offline ? '#fff7ed' : '#ecfdf5';
  element.style.border = offline ? '1px solid #fdba74' : '1px solid #86efac';
  element.textContent = offline
    ? '🟠 Sin internet. Vas a ver datos guardados en caché y las acciones quedarán pendientes hasta reconectar.'
    : (modoOffline
      ? '🟢 Volvió la conexión. Las acciones pendientes se sincronizarán solas.'
      : '🟢 En línea. Sincronización activa.');
}

export function patrolStateColor(estado) {
  return getStatusColor(estado);
}

export function patrolStateText(estado) {
  return getStatusShortLabel(estado);
}
