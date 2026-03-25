
const DEFAULTS = Object.freeze({
  valorLitro: 1050,
  consumoLitrosKm: 0.14,
  desgastePorKm: 180,
  coordinacionMinima: 2500,
  coordinacionPct: 0.08,
  pagoPatrulleroPct: 0.32,
  pagoPatrulleroPorMin: 85
});

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value?.seconds) return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatMoney(value) {
  return `$${num(value).toLocaleString('es-AR')}`;
}

export function formatDate(value) {
  const ms = toMillis(value);
  return ms ? new Date(ms).toLocaleString('es-AR') : '—';
}

export function getServiceCloseDate(service = {}) {
  return service?.finalizadaEn || service?.finMs || service?.creadoEn || null;
}

export function isCurrentMonth(value, baseDate = new Date()) {
  const ms = toMillis(value);
  if (!ms) return false;
  const d = new Date(ms);
  return d.getMonth() === baseDate.getMonth() && d.getFullYear() === baseDate.getFullYear();
}

export function filterCurrentMonthServices(services = [], baseDate = new Date()) {
  return (Array.isArray(services) ? services : []).filter((service) => isCurrentMonth(getServiceCloseDate(service), baseDate));
}

export function calculateOperationalBreakdown(service = {}, overrides = {}) {
  const cfg = { ...DEFAULTS, ...(overrides || {}) };
  const total = num(service?.importeTotal);
  const distanciaKm = num(service?.distanciaKm, num(service?.distanciaM) / 1000);
  const duracionMin = num(service?.duracionMin, Math.round((num(service?.finMs) - num(service?.inicioMs)) / 60000));
  const combustibleLitros = num(service?.combustibleLitrosEstimados, distanciaKm * cfg.consumoLitrosKm);
  const costoCombustible = num(service?.costoCombustibleEstimado, combustibleLitros * cfg.valorLitro);
  const costoDesgaste = num(service?.costoDesgasteEstimado, distanciaKm * cfg.desgastePorKm);
  const costoCoordinacion = num(service?.costoCoordinacionEstimado, Math.max(cfg.coordinacionMinima, total * cfg.coordinacionPct));
  const pagoPatrullero = num(service?.pagoPatrulleroEstimado, Math.max(total * cfg.pagoPatrulleroPct, duracionMin * cfg.pagoPatrulleroPorMin));
  const costoOperativo = num(service?.costoOperativoEstimado, costoCombustible + costoDesgaste + costoCoordinacion + pagoPatrullero);
  const margenBruto = num(service?.gananciaBrutaEstimada, total - costoOperativo);
  const margenPct = total > 0 ? Math.round((margenBruto / total) * 100) : 0;

  return {
    total,
    distanciaKm: Number(distanciaKm.toFixed(2)),
    duracionMin: Math.max(0, Math.round(duracionMin)),
    combustibleLitros: Number(combustibleLitros.toFixed(2)),
    costoCombustible: Math.round(costoCombustible),
    costoDesgaste: Math.round(costoDesgaste),
    costoCoordinacion: Math.round(costoCoordinacion),
    pagoPatrullero: Math.round(pagoPatrullero),
    costoOperativo: Math.round(costoOperativo),
    margenBruto: Math.round(margenBruto),
    margenPct,
    facturacionEstado: service?.facturacionEstado || (service?.estado === 'finalizada' ? 'pendiente' : 'no_aplica'),
    liquidacionEstado: service?.liquidacionEstado || (service?.estado === 'finalizada' ? 'pendiente' : 'no_aplica')
  };
}

export function summarizeProducerBilling(services = []) {
  const rows = (Array.isArray(services) ? services : [])
    .filter((service) => service?.estado === 'finalizada')
    .map((service) => {
      const calc = calculateOperationalBreakdown(service);
      return {
        ...service,
        ...calc,
        fechaCierreMs: toMillis(getServiceCloseDate(service))
      };
    })
    .sort((a, b) => b.fechaCierreMs - a.fechaCierreMs);

  const summary = rows.reduce((acc, row) => {
    acc.totalServicios += 1;
    acc.facturado += row.total;
    acc.costoOperativo += row.costoOperativo;
    acc.margenBruto += row.margenBruto;
    acc.totalKm += row.distanciaKm;
    acc.totalMin += row.duracionMin;

    if (row.facturacionEstado === 'pendiente') acc.pendienteFacturar += row.total;
    if (row.facturacionEstado === 'facturada') acc.facturadoPendienteCobro += row.total;
    if (row.facturacionEstado === 'cobrada') acc.cobrado += row.total;
    if (row.liquidacionEstado === 'pendiente') acc.liquidacionPendiente += row.pagoPatrullero;
    if (row.liquidacionEstado === 'liquidada') acc.liquidado += row.pagoPatrullero;

    return acc;
  }, {
    totalServicios: 0,
    facturado: 0,
    pendienteFacturar: 0,
    facturadoPendienteCobro: 0,
    cobrado: 0,
    costoOperativo: 0,
    margenBruto: 0,
    liquidacionPendiente: 0,
    liquidado: 0,
    totalKm: 0,
    totalMin: 0
  });

  summary.ticketPromedio = summary.totalServicios ? Math.round(summary.facturado / summary.totalServicios) : 0;
  summary.margenPct = summary.facturado ? Math.round((summary.margenBruto / summary.facturado) * 100) : 0;

  return { summary, rows };
}

export function summarizeEmployeeSettlement(services = [], empleadoDni = '') {
  const rows = (Array.isArray(services) ? services : [])
    .filter((service) => service?.estado === 'finalizada' && String(service?.patrulleroDni || '') === String(empleadoDni || ''))
    .map((service) => {
      const calc = calculateOperationalBreakdown(service);
      return {
        ...service,
        ...calc,
        fechaCierreMs: toMillis(getServiceCloseDate(service))
      };
    })
    .sort((a, b) => b.fechaCierreMs - a.fechaCierreMs);

  const summary = rows.reduce((acc, row) => {
    acc.totalServicios += 1;
    acc.totalLiquidacion += row.pagoPatrullero;
    acc.totalKm += row.distanciaKm;
    acc.totalMin += row.duracionMin;
    if (row.liquidacionEstado === 'pendiente') acc.pendiente += row.pagoPatrullero;
    if (row.liquidacionEstado === 'liquidada') acc.liquidada += row.pagoPatrullero;
    return acc;
  }, {
    totalServicios: 0,
    totalLiquidacion: 0,
    pendiente: 0,
    liquidada: 0,
    totalKm: 0,
    totalMin: 0
  });

  summary.promedioServicio = summary.totalServicios ? Math.round(summary.totalLiquidacion / summary.totalServicios) : 0;

  return { summary, rows };
}
