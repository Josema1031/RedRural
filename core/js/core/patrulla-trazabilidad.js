export function toTimestampMs(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toMillis === "function") {
    try { return value.toMillis(); } catch (_) {}
  }
  if (typeof value === "object" && Number.isFinite(value.seconds)) {
    return Number(value.seconds) * 1000 + Math.round(Number(value.nanoseconds || 0) / 1e6);
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatTimestampEsAr(value) {
  const ms = toTimestampMs(value);
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleString('es-AR');
}

export function formatMinutesHuman(totalMinutes) {
  const n = Number(totalMinutes);
  if (!Number.isFinite(n) || n <= 0) return '—';
  const horas = Math.floor(n / 60);
  const minutos = Math.round(n % 60);
  if (!horas) return `${minutos} min`;
  if (!minutos) return `${horas} h`;
  return `${horas} h ${minutos} min`;
}

export function formatDurationFromMs(startMs, endMs) {
  const start = toTimestampMs(startMs);
  const end = toTimestampMs(endMs);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return '—';
  return formatMinutesHuman((end - start) / 60000);
}

export function formatDistanceHuman(valueMeters) {
  const value = Number(valueMeters);
  if (!Number.isFinite(value) || value <= 0) return '0 m';
  if (value < 1000) return `${Math.round(value)} m`;
  return `${(value / 1000).toFixed(2)} km`;
}

export function buildPatrullaTimeline(data = {}) {
  const rows = [
    { key: 'creado', label: 'Solicitud creada', when: data.creadoEn },
    { key: 'asignado', label: 'Asignación sugerida', when: data.asignadoEn, detail: data.asignadoPatrulleroDni ? `Patrullero: ${data.asignadoPatrulleroDni}` : '' },
    { key: 'aceptado', label: 'Servicio aceptado', when: data.aceptadaEn, detail: data.patrulleroDni ? `Patrullero: ${data.patrulleroDni}` : '' },
    { key: 'rechazado', label: 'Asignación rechazada', when: data.rechazadaEn, detail: data.motivoRechazo ? `Motivo: ${data.motivoRechazo}` : '' },
    { key: 'en_camino', label: 'Salida al lugar', when: data.enCaminoEn, detail: Number(data.etaMin) > 0 ? `ETA: ${data.etaMin} min` : '' },
    { key: 'inicio', label: 'Inicio de patrulla', when: data.iniciadaEn || data.inicioMs },
    { key: 'fin', label: 'Finalización', when: data.finalizadaEn || data.finMs, detail: data.tipoNovedadFinal ? `Cierre: ${String(data.tipoNovedadFinal).replaceAll('_', ' ')}` : '' },
    { key: 'cancelado', label: 'Cancelación', when: data.canceladaEn }
  ];
  return rows
    .map((row) => ({ ...row, ms: toTimestampMs(row.when) }))
    .filter((row) => Number.isFinite(row.ms))
    .sort((a, b) => a.ms - b.ms)
    .map((row) => ({ ...row, text: formatTimestampEsAr(row.ms) }));
}

export function buildPatrullaResumen(data = {}) {
  const creadaMs = toTimestampMs(data.creadoEn);
  const aceptadaMs = toTimestampMs(data.aceptadaEn);
  const enCaminoMs = toTimestampMs(data.enCaminoEn);
  const inicioMs = toTimestampMs(data.iniciadaEn || data.inicioMs);
  const finMs = toTimestampMs(data.finalizadaEn || data.finMs || Date.now());
  const canceladaMs = toTimestampMs(data.canceladaEn);
  const estado = String(data.estado || 'pendiente');

  const duracionOperativa = Number.isFinite(data.duracionMin) && Number(data.duracionMin) > 0
    ? formatMinutesHuman(Number(data.duracionMin))
    : formatDurationFromMs(inicioMs, finMs);

  return {
    estado,
    creada: formatTimestampEsAr(creadaMs),
    aceptada: formatTimestampEsAr(aceptadaMs),
    enCamino: formatTimestampEsAr(enCaminoMs),
    inicio: formatTimestampEsAr(inicioMs),
    fin: formatTimestampEsAr(estado === 'cancelada' ? canceladaMs : finMs),
    tiempoRespuesta: formatDurationFromMs(creadaMs, aceptadaMs),
    tiempoArribo: formatDurationFromMs(aceptadaMs, enCaminoMs),
    duracionOperativa,
    distancia: formatDistanceHuman(data.distanciaM),
    importe: Number.isFinite(Number(data.importeTotal)) ? Number(data.importeTotal) : null,
    cierre: data.tipoNovedadFinal ? String(data.tipoNovedadFinal).replaceAll('_', ' ') : '—',
    observacion: data.observacionFinal || 'Sin observaciones finales'
  };
}

export function renderTimelineHtml(data = {}) {
  const timeline = buildPatrullaTimeline(data);
  if (!timeline.length) return '<div class="muted">Sin eventos registrados todavía.</div>';
  return timeline.map(item => `
    <div style="padding:10px 12px;border:1px solid #e5e7eb;border-radius:12px;margin-top:8px;background:#fff;">
      <div style="font-weight:800;color:#14532d;">${item.label}</div>
      <div style="font-size:13px;color:#374151;margin-top:4px;">${item.text}</div>
      ${item.detail ? `<div style="font-size:12px;color:#6b7280;margin-top:4px;">${item.detail}</div>` : ''}
    </div>
  `).join('');
}

export function renderResumenHtml(data = {}) {
  const r = buildPatrullaResumen(data);
  const importe = Number.isFinite(r.importe) ? `$${r.importe.toLocaleString('es-AR')}` : '—';
  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;">
      <div style="padding:10px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;"><strong>Estado</strong><div style="margin-top:4px;">${r.estado}</div></div>
      <div style="padding:10px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;"><strong>Respuesta</strong><div style="margin-top:4px;">${r.tiempoRespuesta}</div></div>
      <div style="padding:10px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;"><strong>Duración real</strong><div style="margin-top:4px;">${r.duracionOperativa}</div></div>
      <div style="padding:10px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;"><strong>Distancia</strong><div style="margin-top:4px;">${r.distancia}</div></div>
      <div style="padding:10px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;"><strong>Cierre</strong><div style="margin-top:4px;">${r.cierre}</div></div>
      <div style="padding:10px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;"><strong>Importe</strong><div style="margin-top:4px;">${importe}</div></div>
    </div>
    <div style="margin-top:10px;font-size:13px;color:#374151;">
      <div><strong>Creada:</strong> ${r.creada}</div>
      <div><strong>Aceptada:</strong> ${r.aceptada}</div>
      <div><strong>Inicio:</strong> ${r.inicio}</div>
      <div><strong>Fin:</strong> ${r.fin}</div>
      <div><strong>Observación:</strong> ${r.observacion}</div>
    </div>
  `;
}
