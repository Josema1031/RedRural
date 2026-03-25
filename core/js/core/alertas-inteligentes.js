import { calculateOperationalBreakdown, toMillis, formatMoney, formatDate } from './rentabilidad-servicios.js';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function lower(value) {
  return String(value || '').toLowerCase();
}

function sameDni(a, b) {
  return String(a || '').trim() === String(b || '').trim();
}

function ageMinutesFrom(value, nowMs = Date.now()) {
  const ms = toMillis(value);
  if (!ms) return 0;
  return Math.max(0, Math.round((nowMs - ms) / 60000));
}

export function analyzeProducerAlerts(services = [], nowMs = Date.now()) {
  const rows = asArray(services);
  const alerts = [];
  const active = rows.filter((s) => ['pendiente', 'asignada', 'aceptada', 'en_camino', 'en_curso'].includes(lower(s?.estado)));
  const finalized = rows.filter((s) => lower(s?.estado) === 'finalizada');

  const pendingOverdue = active
    .filter((s) => lower(s?.estado) === 'pendiente' && ageMinutesFrom(s?.creadoEn, nowMs) >= 15)
    .sort((a, b) => ageMinutesFrom(b?.creadoEn, nowMs) - ageMinutesFrom(a?.creadoEn, nowMs));
  if (pendingOverdue.length) {
    const top = pendingOverdue[0];
    alerts.push({
      level: 'alta',
      icon: '🚨',
      title: 'Patrullas pendientes sin tomar',
      text: `${pendingOverdue.length} servicio(s) siguen pendientes. La más antigua lleva ${ageMinutesFrom(top?.creadoEn, nowMs)} min esperando en ${top?.nombreCampo || 'campo sin nombre'}.`,
      action: 'Revisá sugerencia de patrullero o reasigná.',
      metric: `${pendingOverdue.length} pendientes`
    });
  }

  const longActive = active
    .filter((s) => ['aceptada', 'en_camino', 'en_curso'].includes(lower(s?.estado)) && ageMinutesFrom(s?.aceptadaEn || s?.enCaminoEn || s?.iniciadaEn || s?.creadoEn, nowMs) >= 90)
    .sort((a, b) => ageMinutesFrom(b?.aceptadaEn || b?.enCaminoEn || b?.iniciadaEn || b?.creadoEn, nowMs) - ageMinutesFrom(a?.aceptadaEn || a?.enCaminoEn || a?.iniciadaEn || a?.creadoEn, nowMs));
  if (longActive.length) {
    const top = longActive[0];
    alerts.push({
      level: 'media',
      icon: '⏱️',
      title: 'Servicios activos con demora',
      text: `${longActive.length} servicio(s) llevan más de 90 min activos. El caso más largo es ${top?.nombreCampo || 'sin campo'} con ${ageMinutesFrom(top?.aceptadaEn || top?.enCaminoEn || top?.iniciadaEn || top?.creadoEn, nowMs)} min.`,
      action: 'Contactá al patrullero y validá el cierre.',
      metric: `${longActive.length} demorados`
    });
  }

  const unpaid = finalized
    .map((s) => ({ ...s, calc: calculateOperationalBreakdown(s), closeMs: toMillis(s?.finalizadaEn || s?.finMs || s?.creadoEn) }))
    .filter((s) => ['pendiente', 'facturada'].includes(lower(s?.calc?.facturacionEstado)) && s.closeMs && ((nowMs - s.closeMs) / 86400000) >= 3);
  const unpaidTotal = unpaid.reduce((sum, row) => sum + Number(row?.calc?.total || 0), 0);
  if (unpaid.length) {
    alerts.push({
      level: 'media',
      icon: '💸',
      title: 'Cobros demorados',
      text: `${unpaid.length} cierre(s) siguen sin cobrarse hace 3 días o más. Tenés ${formatMoney(unpaidTotal)} inmovilizados.`,
      action: 'Usá el centro de facturación V22 para marcar cobradas.',
      metric: formatMoney(unpaidTotal)
    });
  }

  const unsettled = finalized
    .map((s) => ({ ...s, calc: calculateOperationalBreakdown(s), closeMs: toMillis(s?.finalizadaEn || s?.finMs || s?.creadoEn) }))
    .filter((s) => lower(s?.calc?.liquidacionEstado) === 'pendiente' && s.closeMs && ((nowMs - s.closeMs) / 86400000) >= 2);
  const unsettledTotal = unsettled.reduce((sum, row) => sum + Number(row?.calc?.pagoPatrullero || 0), 0);
  if (unsettled.length) {
    alerts.push({
      level: 'media',
      icon: '👷',
      title: 'Liquidaciones pendientes',
      text: `${unsettled.length} liquidación(es) al patrullero todavía están pendientes. Monto estimado a liberar: ${formatMoney(unsettledTotal)}.`,
      action: 'Marcá como liquidadas las patrullas ya abonadas.',
      metric: formatMoney(unsettledTotal)
    });
  }

  const urgentByField = {};
  active.forEach((s) => {
    if (lower(s?.prioridad) !== 'alta') return;
    const key = String(s?.nombreCampo || 'Sin campo');
    urgentByField[key] = (urgentByField[key] || 0) + 1;
  });
  const criticalField = Object.entries(urgentByField).sort((a, b) => b[1] - a[1])[0];
  if (criticalField && criticalField[1] >= 2) {
    alerts.push({
      level: 'alta',
      icon: '🌾',
      title: 'Campo crítico en este momento',
      text: `${criticalField[0]} acumula ${criticalField[1]} servicio(s) urgentes activos.`,
      action: 'Priorizá cobertura y revisá si necesita patrulla dedicada.',
      metric: `${criticalField[1]} urgentes`
    });
  }

  if (!alerts.length) {
    alerts.push({
      level: 'ok',
      icon: '✅',
      title: 'Operación estable',
      text: 'No detectamos alertas críticas en este momento. La operación está controlada.',
      action: 'Seguimiento normal.',
      metric: 'Sin alertas'
    });
  }

  const summary = {
    total: alerts.length,
    altas: alerts.filter((a) => a.level === 'alta').length,
    medias: alerts.filter((a) => a.level === 'media').length,
    ok: alerts.filter((a) => a.level === 'ok').length,
    updatedAt: formatDate(nowMs)
  };

  return { summary, alerts };
}

export function analyzeEmployeeAlerts(services = [], empleadoDni = '', nowMs = Date.now()) {
  const rows = asArray(services);
  const mine = rows.filter((s) => sameDni(s?.patrulleroDni || s?.asignadoPatrulleroDni, empleadoDni));
  const alerts = [];

  const assigned = mine.filter((s) => lower(s?.estado) === 'asignada');
  if (assigned.length) {
    alerts.push({
      level: 'alta',
      icon: '📢',
      title: 'Tenés servicios por aceptar',
      text: `Hay ${assigned.length} asignación(es) esperando tu confirmación.`,
      action: 'Revisalas para no frenar la operación.',
      metric: `${assigned.length} asignadas`
    });
  }

  const active = mine.filter((s) => ['aceptada', 'en_camino', 'en_curso'].includes(lower(s?.estado)));
  const stalled = active.filter((s) => ageMinutesFrom(s?.aceptadaEn || s?.enCaminoEn || s?.iniciadaEn || s?.creadoEn, nowMs) >= 120);
  if (stalled.length) {
    const top = stalled.sort((a, b) => ageMinutesFrom(b?.aceptadaEn || b?.enCaminoEn || b?.iniciadaEn || b?.creadoEn, nowMs) - ageMinutesFrom(a?.aceptadaEn || a?.enCaminoEn || a?.iniciadaEn || a?.creadoEn, nowMs))[0];
    alerts.push({
      level: 'media',
      icon: '⏱️',
      title: 'Servicio largo sin cierre',
      text: `Tenés ${stalled.length} servicio(s) activos hace más de 120 min. El más largo está en ${top?.nombreCampo || 'sin campo'}.`,
      action: 'Actualizá estado o cerrá la patrulla si ya terminó.',
      metric: `${stalled.length} activos`
    });
  }

  const monthFinalized = mine.filter((s) => lower(s?.estado) === 'finalizada');
  const pendingSettlement = monthFinalized
    .map((s) => ({ ...s, calc: calculateOperationalBreakdown(s) }))
    .filter((s) => lower(s?.calc?.liquidacionEstado) === 'pendiente');
  const pendingTotal = pendingSettlement.reduce((sum, row) => sum + Number(row?.calc?.pagoPatrullero || 0), 0);
  if (pendingSettlement.length) {
    alerts.push({
      level: 'media',
      icon: '💵',
      title: 'Liquidación pendiente a tu favor',
      text: `Tenés ${pendingSettlement.length} cierre(s) todavía sin liquidar. Estimado acumulado: ${formatMoney(pendingTotal)}.`,
      action: 'Usalo para seguir tu cobro mensual.',
      metric: formatMoney(pendingTotal)
    });
  }

  const urgentMine = mine.filter((s) => lower(s?.prioridad) === 'alta' && ['asignada', 'aceptada', 'en_camino', 'en_curso'].includes(lower(s?.estado)));
  if (urgentMine.length) {
    alerts.push({
      level: 'alta',
      icon: '🚨',
      title: 'Prioridades altas en tu bandeja',
      text: `Tenés ${urgentMine.length} servicio(s) urgentes entre asignados y activos.`,
      action: 'Priorizalos en tu recorrido.',
      metric: `${urgentMine.length} urgentes`
    });
  }

  if (!alerts.length) {
    alerts.push({
      level: 'ok',
      icon: '✅',
      title: 'Panel al día',
      text: 'No tenés alertas críticas personales en este momento.',
      action: 'Seguimiento normal.',
      metric: 'Sin alertas'
    });
  }

  const summary = {
    total: alerts.length,
    altas: alerts.filter((a) => a.level === 'alta').length,
    medias: alerts.filter((a) => a.level === 'media').length,
    ok: alerts.filter((a) => a.level === 'ok').length,
    updatedAt: formatDate(nowMs)
  };

  return { summary, alerts };
}

export function renderAlertsSummaryHtml(summary = {}) {
  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;">
      <div style="padding:10px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;"><strong>Total</strong><div style="margin-top:4px;font-size:20px;font-weight:900;">${summary.total || 0}</div></div>
      <div style="padding:10px;border:1px solid #fecaca;border-radius:12px;background:#fff7f7;"><strong>Altas</strong><div style="margin-top:4px;font-size:20px;font-weight:900;color:#b91c1c;">${summary.altas || 0}</div></div>
      <div style="padding:10px;border:1px solid #fde68a;border-radius:12px;background:#fffbea;"><strong>Medias</strong><div style="margin-top:4px;font-size:20px;font-weight:900;color:#92400e;">${summary.medias || 0}</div></div>
      <div style="padding:10px;border:1px solid #bbf7d0;border-radius:12px;background:#f0fdf4;"><strong>Actualizado</strong><div style="margin-top:4px;font-size:14px;font-weight:700;">${summary.updatedAt || '—'}</div></div>
    </div>
  `;
}

export function renderAlertsListHtml(alerts = []) {
  const list = asArray(alerts);
  if (!list.length) return '<small class="muted">Sin alertas para mostrar.</small>';
  return list.map((alerta) => {
    const border = alerta.level === 'alta' ? '#fecaca' : alerta.level === 'media' ? '#fde68a' : '#bbf7d0';
    const bg = alerta.level === 'alta' ? '#fff7f7' : alerta.level === 'media' ? '#fffbea' : '#f0fdf4';
    const color = alerta.level === 'alta' ? '#991b1b' : alerta.level === 'media' ? '#92400e' : '#166534';
    return `
      <div class="item" style="margin-bottom:10px;border:1px solid ${border};background:${bg};border-radius:12px;padding:12px;">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start;">
          <strong style="color:${color};">${alerta.icon || '🔔'} ${alerta.title || 'Alerta'}</strong>
          <span style="font-size:12px;font-weight:800;color:${color};">${alerta.metric || ''}</span>
        </div>
        <div style="margin-top:6px;color:#374151;">${alerta.text || ''}</div>
        <div style="margin-top:6px;font-size:13px;color:#6b7280;"><strong>Acción sugerida:</strong> ${alerta.action || 'Revisar.'}</div>
      </div>
    `;
  }).join('');
}
