function formatMoney(value = 0) {
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value || 0));
  } catch {
    return `$${Number(value || 0).toFixed(0)}`;
  }
}

function tarjeta(label, value, subtle = '') {
  const item = document.createElement('div');
  item.className = 'resumen-productor__card';
  item.innerHTML = `
    <div class="resumen-productor__label">${label}</div>
    <div class="resumen-productor__value">${value}</div>
    ${subtle ? `<div class="resumen-productor__subtle">${subtle}</div>` : ''}
  `;
  return item;
}

export function renderResumenProductorUI() {
  // Protección total: si no hay nada, no hace nada y no da error
  const res = window.__RED_RURAL__?.resumenProductor;
  if (!res || !res.metricas) {
    console.log("Render cancelado: faltan métricas");
    return null;
  }

  const mount = document.getElementById('contenedorResumenProductor');
  if (!mount) return null;

  // Limpiamos lo que haya antes para que no se duplique al reintentar
  mount.innerHTML = ''; 

  const shell = document.createElement('section');
  shell.id = 'resumenProductorShell';
  shell.className = 'resumen-productor-shell';

  const top = Object.entries(snapshot.operacion?.porTipo || {}).sort((a,b) => b[1]-a[1])[0];
  const ultimo = snapshot.operacion?.ultimoServicio;

  shell.innerHTML = `
    <div class="resumen-productor">
      <div class="resumen-productor__header">
        <div>
          <h2 class="resumen-productor__title">Resumen del productor</h2>
          <p class="resumen-productor__subtitle">Vista rápida de servicios, costos y actividad de tu campo</p>
        </div>
        <span class="resumen-productor__pill">Enfoque negocio + operación</span>
      </div>
      <div class="resumen-productor__grid"></div>
      <div class="resumen-productor__footer"></div>
    </div>
  `;

  const grid = shell.querySelector('.resumen-productor__grid');
  grid.append(
    tarjeta('Solicitudes propias', String(snapshot.metricas.solicitudes || 0)),
    tarjeta('Gasto estimado', formatMoney(snapshot.metricas.gastoEstimado || 0)),
    tarjeta('Comisión plataforma', formatMoney(snapshot.metricas.comisionPlataforma || 0)),
    tarjeta('Neto para prestadores', formatMoney(snapshot.metricas.netoPrestadores || 0), `${snapshot.metricas.serviciosActivos || 0} servicios activos`)
  );

  const footer = shell.querySelector('.resumen-productor__footer');
  const chips = [];
  if (top) chips.push(`Servicio principal: ${top[0]} (${top[1]})`);
  if (ultimo) chips.push(`Último servicio: ${ultimo.tipo} · ${ultimo.estado}`);
  if (!chips.length) chips.push('Listo para conectar datos reales por productor');
  footer.innerHTML = chips.map((txt) => `<span class="resumen-productor__chip">${txt}</span>`).join('');

  mount.insertAdjacentElement('afterend', shell);
  return shell;
}
