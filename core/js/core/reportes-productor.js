import { filterCurrentMonthServices, summarizeProducerBilling, formatMoney, formatDate, toMillis, calculateOperationalBreakdown } from './rentabilidad-servicios.js';

function safeText(value, fallback = '—') {
  const txt = String(value ?? '').trim();
  return txt || fallback;
}

function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function monthLabel(baseDate = new Date()) {
  return baseDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}

export function buildExecutiveMonthlyReport(services = [], baseDate = new Date()) {
  const monthServices = filterCurrentMonthServices(services, baseDate)
    .filter((service) => service?.estado === 'finalizada')
    .map((service) => {
      const calc = calculateOperationalBreakdown(service);
      return {
        ...service,
        ...calc,
        cierreMs: toMillis(service?.finalizadaEn || service?.finMs || service?.creadoEn)
      };
    })
    .sort((a, b) => b.cierreMs - a.cierreMs);

  const { summary } = summarizeProducerBilling(monthServices);

  const urgentes = monthServices.filter((row) => String(row?.prioridad || '').toLowerCase() === 'urgente').length;
  const cobradas = monthServices.filter((row) => row.facturacionEstado === 'cobrada').length;
  const pendientesCobro = monthServices.filter((row) => row.facturacionEstado !== 'cobrada').length;
  const liquidadas = monthServices.filter((row) => row.liquidacionEstado === 'liquidada').length;

  const byEmployeeMap = new Map();
  const byFieldMap = new Map();
  const byReasonMap = new Map();

  monthServices.forEach((row) => {
    const empKey = safeText(row?.patrulleroDni, 'Sin asignar');
    const emp = byEmployeeMap.get(empKey) || { key: empKey, totalServicios: 0, totalFacturado: 0, totalMargen: 0, totalKm: 0, totalMin: 0, cobradas: 0 };
    emp.totalServicios += 1;
    emp.totalFacturado += row.total;
    emp.totalMargen += row.margenBruto;
    emp.totalKm += row.distanciaKm;
    emp.totalMin += row.duracionMin;
    if (row.facturacionEstado === 'cobrada') emp.cobradas += 1;
    byEmployeeMap.set(empKey, emp);

    const fieldKey = safeText(row?.nombreCampo, 'Sin campo');
    const fld = byFieldMap.get(fieldKey) || { key: fieldKey, totalServicios: 0, totalFacturado: 0, urgentes: 0, promedioMin: 0, totalMin: 0 };
    fld.totalServicios += 1;
    fld.totalFacturado += row.total;
    fld.totalMin += row.duracionMin;
    if (String(row?.prioridad || '').toLowerCase() === 'urgente') fld.urgentes += 1;
    byFieldMap.set(fieldKey, fld);

    const reasonKey = safeText(String(row?.motivo || 'Patrulla').replaceAll('_', ' '), 'Patrulla');
    const rsn = byReasonMap.get(reasonKey) || { key: reasonKey, totalServicios: 0, totalFacturado: 0 };
    rsn.totalServicios += 1;
    rsn.totalFacturado += row.total;
    byReasonMap.set(reasonKey, rsn);
  });

  const employeeRanking = [...byEmployeeMap.values()]
    .map((row) => ({
      ...row,
      ticketPromedio: row.totalServicios ? Math.round(row.totalFacturado / row.totalServicios) : 0,
      promedioMin: row.totalServicios ? Math.round(row.totalMin / row.totalServicios) : 0,
      tasaCobro: pct(row.cobradas, row.totalServicios)
    }))
    .sort((a, b) => b.totalServicios - a.totalServicios || b.totalFacturado - a.totalFacturado);

  const fieldRanking = [...byFieldMap.values()]
    .map((row) => ({
      ...row,
      promedioMin: row.totalServicios ? Math.round(row.totalMin / row.totalServicios) : 0
    }))
    .sort((a, b) => b.totalServicios - a.totalServicios || b.totalFacturado - a.totalFacturado);

  const reasonRanking = [...byReasonMap.values()]
    .sort((a, b) => b.totalServicios - a.totalServicios || b.totalFacturado - a.totalFacturado);

  const topEmployee = employeeRanking[0] || null;
  const topField = fieldRanking[0] || null;
  const topReason = reasonRanking[0] || null;

  return {
    generatedAt: new Date().toISOString(),
    label: monthLabel(baseDate),
    services: monthServices,
    summary,
    kpis: {
      urgentes,
      cobradas,
      pendientesCobro,
      liquidadas,
      tasaCobro: pct(cobradas, monthServices.length),
      tasaLiquidacion: pct(liquidadas, monthServices.length)
    },
    topEmployee,
    topField,
    topReason,
    employeeRanking,
    fieldRanking,
    reasonRanking
  };
}

export function buildExecutiveWhatsAppText(report = {}) {
  const s = report?.summary || {};
  const k = report?.kpis || {};
  const topEmp = report?.topEmployee;
  const topField = report?.topField;
  return [
    `📊 Reporte ejecutivo RED RURAL • ${report?.label || ''}`,
    `Servicios finalizados: ${s.totalServicios || 0}`,
    `Facturado: ${formatMoney(s.facturado || 0)}`,
    `Cobrado: ${formatMoney(s.cobrado || 0)} (${k.tasaCobro || 0}%)`,
    `Pendiente de facturar: ${formatMoney(s.pendienteFacturar || 0)}`,
    `Margen bruto: ${formatMoney(s.margenBruto || 0)} (${s.margenPct || 0}%)`,
    `Km recorridos: ${Math.round(s.totalKm || 0)} km`,
    `Urgentes: ${k.urgentes || 0}`,
    topEmp ? `Patrullero destacado: ${topEmp.key} (${topEmp.totalServicios} servicios)` : 'Patrullero destacado: —',
    topField ? `Campo más demandante: ${topField.key} (${topField.totalServicios} servicios)` : 'Campo más demandante: —'
  ].join('\n');
}

export function buildExecutiveReportText(report = {}) {
  const s = report?.summary || {};
  const k = report?.kpis || {};
  const lines = [];
  lines.push(`REPORTE EJECUTIVO RED RURAL - ${String(report?.label || '').toUpperCase()}`);
  lines.push(`Generado: ${formatDate(report?.generatedAt)}`);
  lines.push('');
  lines.push(`Servicios finalizados: ${s.totalServicios || 0}`);
  lines.push(`Facturado: ${formatMoney(s.facturado || 0)}`);
  lines.push(`Cobrado: ${formatMoney(s.cobrado || 0)}`);
  lines.push(`Pendiente facturar: ${formatMoney(s.pendienteFacturar || 0)}`);
  lines.push(`Facturado pendiente de cobro: ${formatMoney(s.facturadoPendienteCobro || 0)}`);
  lines.push(`Costo operativo: ${formatMoney(s.costoOperativo || 0)}`);
  lines.push(`Margen bruto: ${formatMoney(s.margenBruto || 0)} (${s.margenPct || 0}%)`);
  lines.push(`Ticket promedio: ${formatMoney(s.ticketPromedio || 0)}`);
  lines.push(`Km recorridos: ${Math.round(s.totalKm || 0)} km`);
  lines.push(`Minutos operativos: ${Math.round(s.totalMin || 0)} min`);
  lines.push(`Urgentes: ${k.urgentes || 0}`);
  lines.push(`Tasa de cobro: ${k.tasaCobro || 0}%`);
  lines.push(`Tasa de liquidación: ${k.tasaLiquidacion || 0}%`);
  lines.push('');
  lines.push('RANKING DE PATRULLEROS');
  (report?.employeeRanking || []).slice(0, 5).forEach((row, idx) => {
    lines.push(`${idx + 1}. ${row.key} - ${row.totalServicios} servicios - ${formatMoney(row.totalFacturado)} - ${Math.round(row.totalKm)} km`);
  });
  lines.push('');
  lines.push('CAMPOS CON MAYOR DEMANDA');
  (report?.fieldRanking || []).slice(0, 5).forEach((row, idx) => {
    lines.push(`${idx + 1}. ${row.key} - ${row.totalServicios} servicios - ${formatMoney(row.totalFacturado)}`);
  });
  lines.push('');
  lines.push('MOTIVOS MÁS FRECUENTES');
  (report?.reasonRanking || []).slice(0, 5).forEach((row, idx) => {
    lines.push(`${idx + 1}. ${row.key} - ${row.totalServicios} servicios - ${formatMoney(row.totalFacturado)}`);
  });
  lines.push('');
  lines.push('DETALLE DE SERVICIOS');
  (report?.services || []).forEach((row) => {
    lines.push(`- ${formatDate(row.finalizadaEn || row.finMs || row.creadoEn)} | ${safeText(row.nombreCampo)} | ${safeText(row.motivo).replaceAll('_', ' ')} | ${safeText(row.patrulleroDni)} | ${formatMoney(row.total)} | ${row.distanciaKm} km | ${row.duracionMin} min | ${safeText(row.facturacionEstado)}`);
  });
  return lines.join('\n');
}

export function buildExecutiveCsv(report = {}) {
  const headers = ['fecha_cierre', 'campo', 'motivo', 'patrullero_dni', 'estado', 'prioridad', 'importe_total', 'costo_operativo', 'margen_bruto', 'distancia_km', 'duracion_min', 'facturacion_estado', 'liquidacion_estado'];
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const rows = (report?.services || []).map((row) => [
    formatDate(row.finalizadaEn || row.finMs || row.creadoEn),
    safeText(row.nombreCampo),
    safeText(row.motivo).replaceAll('_', ' '),
    safeText(row.patrulleroDni),
    safeText(row.estado),
    safeText(row.prioridad),
    row.total,
    row.costoOperativo,
    row.margenBruto,
    row.distanciaKm,
    row.duracionMin,
    safeText(row.facturacionEstado),
    safeText(row.liquidacionEstado)
  ]);
  return [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
}
