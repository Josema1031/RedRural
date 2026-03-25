export const STATUS_META = Object.freeze({
  pendiente: { key: 'pendiente', label: 'Pendiente', shortLabel: '🕒 Pendiente', color: '#92400e', className: 'st-pendiente', badgeClass: 'estado-patrulla estado-pendiente' },
  asignada: { key: 'asignada', label: 'Asignada', shortLabel: '📢 Asignada', color: '#1d4ed8', className: 'st-asignada', badgeClass: 'estado-patrulla estado-aceptada' },
  aceptada: { key: 'aceptada', label: 'Aceptada', shortLabel: '✅ Aceptada', color: '#1d4ed8', className: 'st-aceptada', badgeClass: 'estado-patrulla estado-aceptada' },
  en_camino: { key: 'en_camino', label: 'En camino', shortLabel: '🚚 En camino', color: '#2563eb', className: 'st-en-camino', badgeClass: 'estado-patrulla estado-aceptada' },
  en_curso: { key: 'en_curso', label: 'En curso', shortLabel: '🟢 En curso', color: '#0f766e', className: 'st-en-curso', badgeClass: 'estado-patrulla estado-en-curso' },
  en_proceso: { key: 'en_proceso', label: 'En proceso', shortLabel: '🟢 En proceso', color: '#0f766e', className: 'st-en-curso', badgeClass: 'estado-patrulla estado-en-curso' },
  finalizada: { key: 'finalizada', label: 'Finalizada', shortLabel: '🏁 Finalizada', color: '#166534', className: 'st-finalizada', badgeClass: 'estado-patrulla estado-finalizada' },
  cancelada: { key: 'cancelada', label: 'Cancelada', shortLabel: '⛔ Cancelada', color: '#6b7280', className: 'st-cancelada', badgeClass: 'estado-patrulla estado-cancelada' },
  cancelado: { key: 'cancelado', label: 'Cancelado', shortLabel: '⛔ Cancelado', color: '#6b7280', className: 'st-cancelada', badgeClass: 'estado-patrulla estado-cancelada' },
  default: { key: 'default', label: 'Sin estado', shortLabel: '—', color: '#6b7280', className: 'st-default', badgeClass: 'estado-patrulla estado-finalizada' }
});

export function normalizeStatus(status) {
  return String(status || '').trim().toLowerCase().replace(/\s+/g, '_');
}

export function getStatusMeta(status) {
  const key = normalizeStatus(status);
  return STATUS_META[key] || STATUS_META.default;
}

export function getStatusLabel(status) {
  return getStatusMeta(status).label;
}

export function getStatusShortLabel(status) {
  return getStatusMeta(status).shortLabel;
}

export function getStatusColor(status) {
  return getStatusMeta(status).color;
}

export function getStatusClass(status) {
  return getStatusMeta(status).className;
}

export function getStatusBadgeClass(status) {
  return getStatusMeta(status).badgeClass;
}

export function formatDistanceKm(valueInMeters) {
  const value = Number(valueInMeters);
  if (!Number.isFinite(value)) return '0.00';
  return (value / 1000).toFixed(2);
}

export function formatDurationMinutes(valueInMinutes) {
  const value = Number(valueInMinutes);
  if (!Number.isFinite(value)) return 0;
  return value;
}

export function buildPatrullaSummary(patrulla) {
  const km = formatDistanceKm(patrulla?.distanciaM);
  const minutos = formatDurationMinutes(patrulla?.duracionMin);
  const empleado = patrulla?.patrulleroNombre || patrulla?.patrulleroDni || 'Sin patrullero';
  return `${empleado} • ${km} km • ${minutos} min`;
}
