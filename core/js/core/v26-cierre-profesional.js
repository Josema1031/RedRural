import { db } from '../../firebase-init.js';
import { collection, onSnapshot, query, where } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function money(v) {
  return `$${Math.round(num(v)).toLocaleString('es-AR')}`;
}

function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function tsToMs(tsLike) {
  if (!tsLike) return 0;
  if (typeof tsLike === 'number') return tsLike;
  if (typeof tsLike?.seconds === 'number') return tsLike.seconds * 1000;
  return 0;
}

function monthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function monthLabel(date = new Date()) {
  return date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}

function serviceDateMs(s) {
  return (
    num(s.finalizadoEnMs) ||
    num(s.finMs) ||
    num(s.inicioMs) ||
    num(s.enCaminoMs) ||
    tsToMs(s.createdAt) ||
    tsToMs(s.timestamp) ||
    0
  );
}

function inCurrentMonth(s, now = new Date()) {
  const ms = serviceDateMs(s);
  if (!ms) return false;
  const d = new Date(ms);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function calcCosto(s) {
  if (Number.isFinite(Number(s.costoTotalOperativo))) return num(s.costoTotalOperativo);
  const tarifaBase = num(s.tarifaBase);
  const costoDistancia = num(s.costoDistancia, num(s.distanciaKm) * 950);
  const costoTiempo = num(s.costoTiempo, num(s.duracionMin) * 140);
  const fallback = tarifaBase * 0.22 + costoDistancia * 0.35 + costoTiempo * 0.35;
  return Math.max(0, Math.round(fallback));
}

function calcPagoPatrullero(s) {
  if (Number.isFinite(Number(s.pagoPatrullero))) return num(s.pagoPatrullero);
  return Math.round(num(s.importeTotal) * 0.35);
}

function calcImporte(s) {
  return num(s.importeTotal, num(s.totalCobrado, 0));
}

function progressMonth(now = new Date()) {
  const day = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const progress = Math.max(0.05, Math.min(1, day / daysInMonth));
  return { day, daysInMonth, progress };
}

function csvEscape(v) {
  const text = String(v ?? '');
  if (/[",\n;]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function downloadBlob(filename, content, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function printHtmlReport(title, bodyHtml) {
  const win = window.open('', '_blank', 'noopener,noreferrer,width=1000,height=800');
  if (!win) return;
  win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
    h1 { margin: 0 0 6px; }
    .muted { color: #6b7280; margin-bottom: 18px; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; margin: 18px 0; }
    .card { border: 1px solid #e5e7eb; border-radius: 14px; padding: 14px; }
    .label { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
    .value { font-size: 24px; font-weight: 700; margin-top: 6px; }
    table { width: 100%; border-collapse: collapse; margin-top: 18px; }
    th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; font-size: 13px; }
    th { background: #f3f4f6; }
    .section-title { margin-top: 24px; font-size: 18px; }
    @media print { .no-print { display:none; } }
  </style>
</head>
<body>
  <button class="no-print" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
  ${bodyHtml}
</body>
</html>`);
  win.document.close();
}

function producerSummary(items) {
  const now = new Date();
  const monthly = items.filter((s) => inCurrentMonth(s, now));
  const progress = progressMonth(now);
  const campos = new Map();
  let total = 0;
  let finalizadas = 0;
  let canceladas = 0;
  let activas = 0;
  let urgentes = 0;
  let facturacion = 0;
  let cobradas = 0;
  let pendientesCobro = 0;
  let costo = 0;
  let pagoPatrulleros = 0;
  let km = 0;
  let minutos = 0;
  let pendientesLiquidacion = 0;

  for (const s of monthly) {
    total += 1;
    const estado = String(s.estado || '').toLowerCase();
    const prioridad = String(s.prioridad || '').toLowerCase();
    const importe = calcImporte(s);
    const costoServicio = calcCosto(s);
    const pagoPatrullero = calcPagoPatrullero(s);
    const nombreCampo = String(s.nombreCampo || 'Sin campo').trim() || 'Sin campo';
    const kmServicio = num(s.distanciaKm, num(s.distanciaM) / 1000);
    const duracionServicio = num(s.duracionMin, (num(s.finMs) - num(s.inicioMs)) / 60000);
    const margen = importe - costoServicio;
    const cobroEstado = String(s.estadoCobro || 'pendiente').toLowerCase();
    const liqEstado = String(s.estadoLiquidacion || 'pendiente').toLowerCase();

    if (estado === 'finalizada') finalizadas += 1;
    else if (estado === 'cancelada') canceladas += 1;
    else activas += 1;
    if (prioridad === 'alta') urgentes += 1;

    facturacion += importe;
    costo += costoServicio;
    pagoPatrulleros += pagoPatrullero;
    km += kmServicio;
    minutos += Math.max(0, duracionServicio || 0);
    if (cobroEstado === 'cobrada') cobradas += importe;
    else pendientesCobro += importe;
    if (liqEstado !== 'liquidada' && estado === 'finalizada') pendientesLiquidacion += pagoPatrullero;

    if (!campos.has(nombreCampo)) campos.set(nombreCampo, { campo: nombreCampo, facturacion: 0, margen: 0, servicios: 0, urgentes: 0 });
    const c = campos.get(nombreCampo);
    c.facturacion += importe;
    c.margen += margen;
    c.servicios += 1;
    if (prioridad === 'alta') c.urgentes += 1;
  }

  const rentables = Array.from(campos.values()).sort((a, b) => b.margen - a.margen || b.facturacion - a.facturacion).slice(0, 5);
  const margen = facturacion - costo;
  const proyFact = Math.round(facturacion / progress.progress);
  const proyMargen = Math.round(margen / progress.progress);

  return {
    month: monthKey(now),
    monthLabel: monthLabel(now),
    total,
    finalizadas,
    canceladas,
    activas,
    urgentes,
    facturacion,
    cobradas,
    pendientesCobro,
    costo,
    margen,
    pagoPatrulleros,
    pendientesLiquidacion,
    km,
    minutos,
    rentables,
    proyFact,
    proyMargen,
    progress,
    items: monthly
  };
}

function employeeSummary(items, empleadoDni) {
  const now = new Date();
  const monthly = items.filter((s) => inCurrentMonth(s, now)).filter((s) => {
    const pat = String(s.patrulleroDni || s.asignadoPatrulleroDni || '');
    return pat === empleadoDni;
  });

  const progress = progressMonth(now);
  let total = 0;
  let finalizadas = 0;
  let activas = 0;
  let urgentes = 0;
  let km = 0;
  let minutos = 0;
  let facturacion = 0;
  let pago = 0;
  let pendientesLiquidacion = 0;
  let incidencias = 0;

  for (const s of monthly) {
    total += 1;
    const estado = String(s.estado || '').toLowerCase();
    const prioridad = String(s.prioridad || '').toLowerCase();
    const liqEstado = String(s.estadoLiquidacion || 'pendiente').toLowerCase();
    const servicioPago = calcPagoPatrullero(s);

    if (estado === 'finalizada') finalizadas += 1;
    else activas += 1;
    if (prioridad === 'alta') urgentes += 1;
    if (String(s.tipoNovedadFinal || '') === 'incidencia_grave' || Boolean(s.huboNovedad)) incidencias += 1;
    km += num(s.distanciaKm, num(s.distanciaM) / 1000);
    minutos += num(s.duracionMin, (num(s.finMs) - num(s.inicioMs)) / 60000);
    facturacion += calcImporte(s);
    pago += servicioPago;
    if (liqEstado !== 'liquidada' && estado === 'finalizada') pendientesLiquidacion += servicioPago;
  }

  return {
    month: monthKey(now),
    monthLabel: monthLabel(now),
    total,
    finalizadas,
    activas,
    urgentes,
    incidencias,
    km,
    minutos,
    facturacion,
    pago,
    pendientesLiquidacion,
    promedioMin: finalizadas ? Math.round(minutos / finalizadas) : 0,
    proyPago: Math.round(pago / progress.progress),
    progress,
    items: monthly
  };
}

function producerTxt(summary) {
  return [
    `RED RURAL · V26 CIERRE PROFESIONAL`,
    `Mes: ${summary.monthLabel}`,
    `Servicios: ${summary.total}`,
    `Finalizadas: ${summary.finalizadas}`,
    `Activas: ${summary.activas}`,
    `Urgentes: ${summary.urgentes}`,
    `Facturación estimada: ${money(summary.facturacion)}`,
    `Cobrado: ${money(summary.cobradas)}`,
    `Pendiente de cobro: ${money(summary.pendientesCobro)}`,
    `Costo operativo estimado: ${money(summary.costo)}`,
    `Margen estimado: ${money(summary.margen)}`,
    `Liquidación patrulleros pendiente: ${money(summary.pendientesLiquidacion)}`,
    `Kilómetros: ${Math.round(summary.km)}`,
    `Proyección de facturación: ${money(summary.proyFact)}`,
    `Proyección de margen: ${money(summary.proyMargen)}`
  ].join('\n');
}

function producerCsv(summary) {
  const rows = [
    ['id', 'campo', 'estado', 'prioridad', 'importeTotal', 'costoEstimado', 'margenEstimado', 'estadoCobro', 'estadoLiquidacion', 'patrullero', 'distanciaKm', 'duracionMin']
  ];
  for (const s of summary.items) {
    const importe = calcImporte(s);
    const costo = calcCosto(s);
    rows.push([
      s.id || '',
      s.nombreCampo || '',
      s.estado || '',
      s.prioridad || '',
      importe,
      costo,
      importe - costo,
      s.estadoCobro || 'pendiente',
      s.estadoLiquidacion || 'pendiente',
      s.patrulleroDni || s.asignadoPatrulleroDni || '',
      num(s.distanciaKm, num(s.distanciaM) / 1000).toFixed(2),
      num(s.duracionMin, (num(s.finMs) - num(s.inicioMs)) / 60000).toFixed(0)
    ]);
  }
  return rows.map((row) => row.map(csvEscape).join(';')).join('\n');
}

function employeeTxt(summary, empleadoDni) {
  return [
    `RED RURAL · V26 CIERRE PERSONAL`,
    `Patrullero: ${empleadoDni}`,
    `Mes: ${summary.monthLabel}`,
    `Servicios tomados: ${summary.total}`,
    `Finalizadas: ${summary.finalizadas}`,
    `Activas: ${summary.activas}`,
    `Urgentes: ${summary.urgentes}`,
    `Incidencias: ${summary.incidencias}`,
    `Kilómetros: ${Math.round(summary.km)}`,
    `Minutos operativos: ${Math.round(summary.minutos)}`,
    `Liquidación estimada: ${money(summary.pago)}`,
    `Pendiente de liquidar: ${money(summary.pendientesLiquidacion)}`,
    `Proyección mensual: ${money(summary.proyPago)}`
  ].join('\n');
}

function employeeCsv(summary, empleadoDni) {
  const rows = [
    ['empleadoDni', 'id', 'campo', 'estado', 'prioridad', 'liquidacionEstimada', 'estadoLiquidacion', 'distanciaKm', 'duracionMin']
  ];
  for (const s of summary.items) {
    rows.push([
      empleadoDni,
      s.id || '',
      s.nombreCampo || '',
      s.estado || '',
      s.prioridad || '',
      calcPagoPatrullero(s),
      s.estadoLiquidacion || 'pendiente',
      num(s.distanciaKm, num(s.distanciaM) / 1000).toFixed(2),
      num(s.duracionMin, (num(s.finMs) - num(s.inicioMs)) / 60000).toFixed(0)
    ]);
  }
  return rows.map((row) => row.map(csvEscape).join(';')).join('\n');
}

function renderProducer(root, summary) {
  root.innerHTML = `
    <div class="card v26-card" style="margin-top:14px;">
      <div class="v26-header">
        <div>
          <strong>🧾 V26 · Cierre profesional del sistema</strong>
          <div class="muted">Cierre mensual, proyección y salida de reportes para productor.</div>
        </div>
        <span class="v26-badge">${escapeHtml(summary.monthLabel)}</span>
      </div>

      <div class="v26-kpis">
        <div class="v26-kpi"><small>Servicios del mes</small><strong>${summary.total}</strong></div>
        <div class="v26-kpi"><small>Finalizadas</small><strong>${summary.finalizadas}</strong></div>
        <div class="v26-kpi"><small>Facturación</small><strong>${money(summary.facturacion)}</strong></div>
        <div class="v26-kpi"><small>Margen</small><strong>${money(summary.margen)}</strong></div>
        <div class="v26-kpi"><small>Pendiente cobro</small><strong>${money(summary.pendientesCobro)}</strong></div>
        <div class="v26-kpi"><small>Proyección mes</small><strong>${money(summary.proyFact)}</strong></div>
      </div>

      <div class="v26-grid-two" style="margin-top:14px;">
        <div class="v26-box">
          <div class="v26-box-title">📊 Cierre del mes</div>
          <div class="v26-metric-row"><span>Cobrado</span><strong>${money(summary.cobradas)}</strong></div>
          <div class="v26-metric-row"><span>Costo operativo</span><strong>${money(summary.costo)}</strong></div>
          <div class="v26-metric-row"><span>Liquidación pendiente</span><strong>${money(summary.pendientesLiquidacion)}</strong></div>
          <div class="v26-metric-row"><span>Kilómetros recorridos</span><strong>${Math.round(summary.km)} km</strong></div>
        </div>

        <div class="v26-box">
          <div class="v26-box-title">🎯 Ritmo y proyección</div>
          <div class="v26-metric-row"><span>Avance del mes</span><strong>${summary.progress.day}/${summary.progress.daysInMonth}</strong></div>
          <div class="v26-metric-row"><span>Proyección margen</span><strong>${money(summary.proyMargen)}</strong></div>
          <div class="v26-metric-row"><span>Activas</span><strong>${summary.activas}</strong></div>
          <div class="v26-metric-row"><span>Urgentes</span><strong>${summary.urgentes}</strong></div>
        </div>
      </div>

      <div class="v26-box" style="margin-top:14px;">
        <div class="v26-box-title">🌾 Campos más rentables del mes</div>
        ${summary.rentables.length ? `
          <div class="v26-list">
            ${summary.rentables.map((x, idx) => `
              <div class="v26-row">
                <div><strong>#${idx + 1} · ${escapeHtml(x.campo)}</strong><div class="muted">${x.servicios} servicios · ${x.urgentes} urgentes</div></div>
                <div style="text-align:right;"><strong>${money(x.margen)}</strong><div class="muted">${money(x.facturacion)}</div></div>
              </div>
            `).join('')}
          </div>
        ` : '<div class="muted">Todavía no hay servicios del mes para calcular rentabilidad.</div>'}
      </div>

      <div class="v26-actions">
        <button type="button" class="btn-primario" data-v26-action="producer-txt">⬇️ TXT cierre</button>
        <button type="button" class="btn-secundario" data-v26-action="producer-csv">⬇️ CSV detalle</button>
        <button type="button" class="btn-secundario" data-v26-action="producer-json">⬇️ JSON técnico</button>
        <button type="button" class="btn-ok" data-v26-action="producer-print">🖨️ Reporte PDF / imprimir</button>
      </div>
    </div>
  `;

  root.onclick = (event) => {
    const btn = event.target.closest('[data-v26-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-v26-action');
    if (action === 'producer-txt') {
      downloadBlob(`red-rural-cierre-${summary.month}.txt`, producerTxt(summary));
    } else if (action === 'producer-csv') {
      downloadBlob(`red-rural-cierre-${summary.month}.csv`, producerCsv(summary), 'text/csv;charset=utf-8');
    } else if (action === 'producer-json') {
      downloadBlob(`red-rural-cierre-${summary.month}.json`, JSON.stringify(summary, null, 2), 'application/json;charset=utf-8');
    } else if (action === 'producer-print') {
      printHtmlReport(`RED RURAL · Cierre ${summary.monthLabel}`, `
        <h1>RED RURAL · Cierre mensual</h1>
        <div class="muted">Mes analizado: ${escapeHtml(summary.monthLabel)}</div>
        <div class="grid">
          <div class="card"><div class="label">Servicios</div><div class="value">${summary.total}</div></div>
          <div class="card"><div class="label">Facturación</div><div class="value">${money(summary.facturacion)}</div></div>
          <div class="card"><div class="label">Margen</div><div class="value">${money(summary.margen)}</div></div>
          <div class="card"><div class="label">Pendiente cobro</div><div class="value">${money(summary.pendientesCobro)}</div></div>
          <div class="card"><div class="label">Liquidación pendiente</div><div class="value">${money(summary.pendientesLiquidacion)}</div></div>
          <div class="card"><div class="label">Proyección</div><div class="value">${money(summary.proyFact)}</div></div>
        </div>
        <div class="section-title">Campos más rentables</div>
        <table>
          <thead><tr><th>Campo</th><th>Servicios</th><th>Urgentes</th><th>Facturación</th><th>Margen</th></tr></thead>
          <tbody>
            ${summary.rentables.map((x) => `<tr><td>${escapeHtml(x.campo)}</td><td>${x.servicios}</td><td>${x.urgentes}</td><td>${money(x.facturacion)}</td><td>${money(x.margen)}</td></tr>`).join('') || '<tr><td colspan="5">Sin datos</td></tr>'}
          </tbody>
        </table>
      `);
    }
  };
}

function renderEmployee(root, summary, empleadoDni) {
  root.innerHTML = `
    <div class="card v26-card" style="margin-top:14px;">
      <div class="v26-header">
        <div>
          <strong>💼 V26 · Cierre personal del patrullero</strong>
          <div class="muted">Seguimiento mensual de actividad, liquidación y proyección.</div>
        </div>
        <span class="v26-badge">${escapeHtml(summary.monthLabel)}</span>
      </div>

      <div class="v26-kpis">
        <div class="v26-kpi"><small>Servicios tomados</small><strong>${summary.total}</strong></div>
        <div class="v26-kpi"><small>Finalizadas</small><strong>${summary.finalizadas}</strong></div>
        <div class="v26-kpi"><small>Kilómetros</small><strong>${Math.round(summary.km)}</strong></div>
        <div class="v26-kpi"><small>Liquidación estimada</small><strong>${money(summary.pago)}</strong></div>
        <div class="v26-kpi"><small>Pendiente liquidar</small><strong>${money(summary.pendientesLiquidacion)}</strong></div>
        <div class="v26-kpi"><small>Proyección mes</small><strong>${money(summary.proyPago)}</strong></div>
      </div>

      <div class="v26-grid-two" style="margin-top:14px;">
        <div class="v26-box">
          <div class="v26-box-title">⏱️ Rendimiento operativo</div>
          <div class="v26-metric-row"><span>Promedio por servicio</span><strong>${summary.promedioMin ? `${summary.promedioMin} min` : '—'}</strong></div>
          <div class="v26-metric-row"><span>Urgencias</span><strong>${summary.urgentes}</strong></div>
          <div class="v26-metric-row"><span>Activas</span><strong>${summary.activas}</strong></div>
          <div class="v26-metric-row"><span>Incidencias</span><strong>${summary.incidencias}</strong></div>
        </div>

        <div class="v26-box">
          <div class="v26-box-title">🧾 Cierre de liquidación</div>
          <div class="v26-metric-row"><span>Facturación asociada</span><strong>${money(summary.facturacion)}</strong></div>
          <div class="v26-metric-row"><span>Liquidación del mes</span><strong>${money(summary.pago)}</strong></div>
          <div class="v26-metric-row"><span>Pendiente</span><strong>${money(summary.pendientesLiquidacion)}</strong></div>
          <div class="v26-metric-row"><span>Avance del mes</span><strong>${summary.progress.day}/${summary.progress.daysInMonth}</strong></div>
        </div>
      </div>

      <div class="v26-actions">
        <button type="button" class="btn-primario" data-v26-action="employee-txt">⬇️ TXT cierre</button>
        <button type="button" class="btn-secundario" data-v26-action="employee-csv">⬇️ CSV detalle</button>
        <button type="button" class="btn-secundario" data-v26-action="employee-json">⬇️ JSON técnico</button>
        <button type="button" class="btn-ok" data-v26-action="employee-print">🖨️ Reporte PDF / imprimir</button>
      </div>
    </div>
  `;

  root.onclick = (event) => {
    const btn = event.target.closest('[data-v26-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-v26-action');
    if (action === 'employee-txt') {
      downloadBlob(`red-rural-liquidacion-${empleadoDni}-${summary.month}.txt`, employeeTxt(summary, empleadoDni));
    } else if (action === 'employee-csv') {
      downloadBlob(`red-rural-liquidacion-${empleadoDni}-${summary.month}.csv`, employeeCsv(summary, empleadoDni), 'text/csv;charset=utf-8');
    } else if (action === 'employee-json') {
      downloadBlob(`red-rural-liquidacion-${empleadoDni}-${summary.month}.json`, JSON.stringify(summary, null, 2), 'application/json;charset=utf-8');
    } else if (action === 'employee-print') {
      printHtmlReport(`RED RURAL · Liquidación ${empleadoDni} · ${summary.monthLabel}`, `
        <h1>RED RURAL · Cierre personal</h1>
        <div class="muted">Patrullero: ${escapeHtml(empleadoDni)} · Mes: ${escapeHtml(summary.monthLabel)}</div>
        <div class="grid">
          <div class="card"><div class="label">Servicios</div><div class="value">${summary.total}</div></div>
          <div class="card"><div class="label">Finalizadas</div><div class="value">${summary.finalizadas}</div></div>
          <div class="card"><div class="label">Kilómetros</div><div class="value">${Math.round(summary.km)}</div></div>
          <div class="card"><div class="label">Liquidación</div><div class="value">${money(summary.pago)}</div></div>
          <div class="card"><div class="label">Pendiente</div><div class="value">${money(summary.pendientesLiquidacion)}</div></div>
          <div class="card"><div class="label">Proyección</div><div class="value">${money(summary.proyPago)}</div></div>
        </div>
        <div class="section-title">Detalle mensual</div>
        <table>
          <thead><tr><th>ID</th><th>Campo</th><th>Estado</th><th>Prioridad</th><th>Liquidación estimada</th><th>Km</th></tr></thead>
          <tbody>
            ${summary.items.map((s) => `<tr><td>${escapeHtml(s.id || '')}</td><td>${escapeHtml(s.nombreCampo || '')}</td><td>${escapeHtml(s.estado || '')}</td><td>${escapeHtml(s.prioridad || '')}</td><td>${money(calcPagoPatrullero(s))}</td><td>${num(s.distanciaKm, num(s.distanciaM) / 1000).toFixed(2)}</td></tr>`).join('') || '<tr><td colspan="6">Sin datos</td></tr>'}
          </tbody>
        </table>
      `);
    }
  };
}

function ensureProducerContainer() {
  // Cambiamos 'sec-uber-rural' por el ID real en panel.html
  return document.getElementById('contenedorV26'); 
}

function ensureEmployeeContainer() {
  const sec = document.getElementById('mod-operativo');
  if (!sec) return null;
  let node = document.getElementById('v26EmployeeCenter');
  if (node) return node;
  node = document.createElement('div');
  node.id = 'v26EmployeeCenter';
  const ref = document.getElementById('v25EmployeeDashboard');
  if (ref?.nextSibling) ref.parentNode.insertBefore(node, ref.nextSibling);
  else if (ref?.parentNode) ref.parentNode.appendChild(node);
  else sec.appendChild(node);
  return node;
}

export function initV26ProducerCenter({ productorId }) {
  const root = ensureProducerContainer();
  if (!root || !productorId) return;
  root.innerHTML = '<div class="card v26-card" style="margin-top:14px;"><small class="muted">Cargando cierre V26...</small></div>';
  const q = query(collection(db, 'solicitudesPatrulla'), where('productorId', '==', productorId));
  onSnapshot(q, (snap) => {
    const items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    renderProducer(root, producerSummary(items));
  }, (error) => {
    console.error('V26 productor:', error);
    root.innerHTML = '<div class="card v26-card" style="margin-top:14px;"><small style="color:#b91c1c;">No se pudo cargar el cierre V26.</small></div>';
  });
}

export function initV26EmployeeCenter({ productorId, empleadoDni }) {
  const root = ensureEmployeeContainer();
  if (!root || !productorId || !empleadoDni) return;
  root.innerHTML = '<div class="card v26-card" style="margin-top:14px;"><small class="muted">Cargando cierre personal V26...</small></div>';
  const q = query(collection(db, 'solicitudesPatrulla'), where('productorId', '==', productorId));
  onSnapshot(q, (snap) => {
    const items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    renderEmployee(root, employeeSummary(items, empleadoDni), empleadoDni);
  }, (error) => {
    console.error('V26 empleado:', error);
    root.innerHTML = '<div class="card v26-card" style="margin-top:14px;"><small style="color:#b91c1c;">No se pudo cargar el cierre personal V26.</small></div>';
  });
}
