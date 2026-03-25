
function formatMoney(value = 0) {
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value || 0));
  } catch {
    return `$${Number(value || 0).toFixed(0)}`;
  }
}

function buildMetric(label, value) {
  const item = document.createElement('div');
  item.className = 'executive-metric';

  const l = document.createElement('div');
  l.className = 'executive-metric__label';
  l.textContent = label;

  const v = document.createElement('div');
  v.className = 'executive-metric__value';
  v.textContent = value;

  item.append(l, v);
  return item;
}

function buildTag(text) {
  const tag = document.createElement('span');
  tag.className = 'executive-tag';
  tag.textContent = text;
  return tag;
}

function resolveMount(panelType) {
  if (panelType === 'productor' || panelType === 'empleado') {
    return document.querySelector('.container') || document.querySelector('main') || document.body;
  }
  return document.body;
}

export function renderExecutiveDashboardUI({ panelType = 'productor' } = {}) {
  const snapshot = window.__RED_RURAL__?.executiveDashboard;
  if (!snapshot?.metricas) return null;
  const mountAfter = resolveMount(panelType);
  if (!mountAfter) return null;

  const existing = document.getElementById('executiveDashboardShell');
  if (existing) existing.remove();

  const shell = document.createElement('section');
  shell.id = 'executiveDashboardShell';
  shell.className = 'executive-dashboard-shell';

  const card = document.createElement('div');
  card.className = 'executive-dashboard';

  const header = document.createElement('div');
  header.className = 'executive-dashboard__header';
  header.innerHTML = `
    <div>
      <h2 class="executive-dashboard__title">Tablero ejecutivo</h2>
      <p class="executive-dashboard__subtitle">Resumen inicial del ecosistema de servicios rurales</p>
    </div>
    <span class="executive-dashboard__pill">${panelType === 'empleado' ? 'Vista operativa + negocio' : 'Vista negocio + operación'}</span>
  `;

  const metrics = document.createElement('div');
  metrics.className = 'executive-dashboard__metrics';
  metrics.append(
    buildMetric('Solicitudes', String(snapshot.metricas.solicitudes ?? 0)),
    buildMetric('Ingreso bruto', formatMoney(snapshot.metricas.ingresoBrutoEstimado)),
    buildMetric('Comisión', formatMoney(snapshot.metricas.comisionEstimada)),
    buildMetric('Ticket promedio', formatMoney(snapshot.metricas.ticketPromedio)),
    buildMetric('Productores activos', String(snapshot.metricas.productoresActivos ?? 0)),
    buildMetric('Prestadores activos', String(snapshot.metricas.prestadoresActivos ?? 0)),
  );

  const footer = document.createElement('div');
  footer.className = 'executive-dashboard__footer';
  const topServicios = Array.isArray(snapshot.operacion?.topServicios) ? snapshot.operacion.topServicios.slice(0,3) : [];
  if (topServicios.length) {
    topServicios.forEach(item => footer.append(buildTag(`${item.tipo}: ${item.cantidad}`)));
  } else {
    footer.append(buildTag('Base ejecutiva lista para conectar datos reales'));
  }
  const porEstado = snapshot.operacion?.porEstado || {};
  Object.entries(porEstado).slice(0,2).forEach(([estado,cantidad]) => footer.append(buildTag(`${estado}: ${cantidad}`)));

  card.append(header, metrics, footer);
  shell.append(card);
  mountAfter.insertAdjacentElement('afterbegin', shell);
  return shell;
}
