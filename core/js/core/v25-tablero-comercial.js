import { db } from '../../firebase-init.js';
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function money(v) {
  return `$${Math.round(num(v)).toLocaleString('es-AR')}`;
}

function formatMin(min) {
  if (!Number.isFinite(min) || min <= 0) return '—';
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m}m`;
}

function tsToMs(tsLike) {
  if (!tsLike) return 0;
  if (typeof tsLike === 'number') return tsLike;
  if (typeof tsLike?.seconds === 'number') return tsLike.seconds * 1000;
  return 0;
}

function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function badgeClass(score) {
  if (score >= 85) return 'v25-badge ok';
  if (score >= 60) return 'v25-badge warn';
  return 'v25-badge danger';
}

function semaforo(score) {
  if (score >= 85) return '🟢 Sólido';
  if (score >= 60) return '🟡 Atención';
  return '🔴 Crítico';
}

function scoreCampo(item) {
  const base = 100;
  const pendientes = num(item.pendientes);
  const urgentes = num(item.urgentes);
  const canceladas = num(item.canceladas);
  const finalizadas = num(item.finalizadas);
  const margen = num(item.margen);
  let score = base;
  score -= pendientes * 12;
  score -= urgentes * 8;
  score -= canceladas * 6;
  score += Math.min(18, finalizadas * 2);
  score += margen > 0 ? 8 : margen < 0 ? -12 : 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scorePatrullero(item) {
  const finalizadas = num(item.finalizadas);
  const urgentes = num(item.urgentes);
  const canceladas = num(item.canceladas);
  const margen = num(item.margen);
  const minutos = num(item.minutos);
  const avgMin = finalizadas ? minutos / finalizadas : 0;
  let score = 40;
  score += Math.min(35, finalizadas * 6);
  score += Math.min(15, urgentes * 3);
  score -= canceladas * 8;
  score += margen > 0 ? Math.min(10, Math.round(margen / 15000)) : -8;
  if (avgMin > 0) {
    if (avgMin <= 90) score += 8;
    else if (avgMin <= 150) score += 4;
    else score -= 6;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

function calculateProducerSummary(items) {
  const campos = new Map();
  const patrulleros = new Map();
  let total = 0;
  let activas = 0;
  let urgentes = 0;
  let margenTotal = 0;
  let facturacionTotal = 0;

  for (const s of items) {
    total += 1;
    const estado = String(s.estado || 'pendiente');
    const prioridad = String(s.prioridad || 'media').toLowerCase();
    const campo = String(s.nombreCampo || 'Sin campo').trim() || 'Sin campo';
    const patrullero = String(s.patrulleroDni || s.asignadoPatrulleroDni || 'Sin asignar');
    const importe = num(s.importeTotal);
    const distanciaKm = num(s.distanciaKm, num(s.distanciaM) / 1000);
    const duracionMin = num(s.duracionMin, (num(s.finMs) - num(s.inicioMs)) / 60000);
    const costo = Math.round(num(s.tarifaBase) * 0.22 + num(s.costoDistancia) * 0.35 + num(s.costoTiempo) * 0.35);
    const margen = importe - costo;
    const tuvoNovedad = Boolean(s.huboNovedad) || String(s.tipoNovedadFinal || '') === 'incidencia_grave';

    if (!['finalizada', 'cancelada'].includes(estado)) activas += 1;
    if (prioridad === 'alta') urgentes += 1;

    if (!campos.has(campo)) {
      campos.set(campo, {
        campo,
        total: 0,
        finalizadas: 0,
        pendientes: 0,
        urgentes: 0,
        canceladas: 0,
        facturacion: 0,
        margen: 0,
        incidencias: 0
      });
    }
    const c = campos.get(campo);
    c.total += 1;
    c.facturacion += importe;
    c.margen += margen;
    if (estado === 'finalizada') c.finalizadas += 1;
    if (!['finalizada', 'cancelada'].includes(estado)) c.pendientes += 1;
    if (estado === 'cancelada') c.canceladas += 1;
    if (prioridad === 'alta') c.urgentes += 1;
    if (tuvoNovedad) c.incidencias += 1;

    if (patrullero && patrullero !== 'Sin asignar') {
      if (!patrulleros.has(patrullero)) {
        patrulleros.set(patrullero, {
          patrullero,
          total: 0,
          finalizadas: 0,
          canceladas: 0,
          urgentes: 0,
          minutos: 0,
          km: 0,
          facturacion: 0,
          margen: 0,
          incidencias: 0
        });
      }
      const p = patrulleros.get(patrullero);
      p.total += 1;
      p.facturacion += importe;
      p.margen += margen;
      p.km += distanciaKm;
      if (estado === 'finalizada') {
        p.finalizadas += 1;
        p.minutos += Math.max(0, duracionMin || 0);
      }
      if (estado === 'cancelada') p.canceladas += 1;
      if (prioridad === 'alta') p.urgentes += 1;
      if (tuvoNovedad) p.incidencias += 1;
    }

    facturacionTotal += importe;
    margenTotal += margen;
  }

  const camposArr = Array.from(campos.values()).map((x) => ({ ...x, score: scoreCampo(x) }))
    .sort((a, b) => b.score - a.score || b.total - a.total);
  const patrullerosArr = Array.from(patrulleros.values()).map((x) => ({ ...x, score: scorePatrullero(x) }))
    .sort((a, b) => b.score - a.score || b.finalizadas - a.finalizadas);

  const scoreGlobal = camposArr.length
    ? Math.round(camposArr.reduce((acc, x) => acc + x.score, 0) / camposArr.length)
    : 0;

  return {
    total,
    activas,
    urgentes,
    facturacionTotal,
    margenTotal,
    scoreGlobal,
    campos: camposArr,
    patrulleros: patrullerosArr
  };
}

function renderProducerDashboard(root, summary) {
  const topPat = summary.patrulleros[0];
  const topCampo = summary.campos[0];
  root.innerHTML = `
    <div class="card v25-card" style="margin-top:14px;">
      <div class="v25-header">
        <div>
          <strong>📈 V25 · Tablero comercial y scoring operativo</strong>
          <div class="muted">Lectura comercial de patrullas, campos y patrulleros.</div>
        </div>
        <span class="${badgeClass(summary.scoreGlobal)}">${semaforo(summary.scoreGlobal)} · Score ${summary.scoreGlobal}/100</span>
      </div>

      <div class="v25-kpis">
        <div class="v25-kpi"><small>Servicios analizados</small><strong>${summary.total}</strong></div>
        <div class="v25-kpi"><small>Activos hoy</small><strong>${summary.activas}</strong></div>
        <div class="v25-kpi"><small>Urgencias</small><strong>${summary.urgentes}</strong></div>
        <div class="v25-kpi"><small>Facturación estimada</small><strong>${money(summary.facturacionTotal)}</strong></div>
        <div class="v25-kpi"><small>Margen estimado</small><strong>${money(summary.margenTotal)}</strong></div>
      </div>

      <div class="v25-grid-two" style="margin-top:14px;">
        <div class="v25-box">
          <div class="v25-box-title">🏆 Patrullero destacado</div>
          <div class="v25-highlight">${topPat ? escapeHtml(topPat.patrullero) : 'Sin datos'}</div>
          <div class="muted">${topPat ? `${topPat.finalizadas} finalizadas · ${Math.round(topPat.km)} km · ${money(topPat.margen)} margen` : 'Todavía no hay patrullas finalizadas suficientes.'}</div>
        </div>
        <div class="v25-box">
          <div class="v25-box-title">🌾 Campo prioritario</div>
          <div class="v25-highlight">${topCampo ? escapeHtml(topCampo.campo) : 'Sin datos'}</div>
          <div class="muted">${topCampo ? `${topCampo.total} servicios · ${topCampo.urgentes} urgencias · ${semaforo(topCampo.score)}` : 'Todavía no hay campos con historial.'}</div>
        </div>
      </div>

      <div class="v25-grid-two" style="margin-top:14px;">
        <div class="v25-box">
          <div class="v25-box-title">👮 Ranking de patrulleros</div>
          ${summary.patrulleros.length ? `
            <div class="v25-list">
              ${summary.patrulleros.slice(0, 5).map((p, i) => `
                <div class="v25-row">
                  <div><b>#${i + 1} ${escapeHtml(p.patrullero)}</b><br><small>${p.finalizadas} finalizadas · ${formatMin(p.finalizadas ? p.minutos / p.finalizadas : 0)} promedio</small></div>
                  <div style="text-align:right;"><span class="${badgeClass(p.score)}">${p.score}/100</span><br><small>${money(p.margen)}</small></div>
                </div>
              `).join('')}
            </div>` : '<small class="muted">Sin patrulleros evaluables todavía.</small>'}
        </div>

        <div class="v25-box">
          <div class="v25-box-title">🏡 Semáforo por campo</div>
          ${summary.campos.length ? `
            <div class="v25-list">
              ${summary.campos.slice(0, 5).map((c) => `
                <div class="v25-row">
                  <div><b>${escapeHtml(c.campo)}</b><br><small>${c.total} servicios · ${c.incidencias} novedades · ${c.pendientes} abiertas</small></div>
                  <div style="text-align:right;"><span class="${badgeClass(c.score)}">${semaforo(c.score)}</span><br><small>${money(c.facturacion)}</small></div>
                </div>
              `).join('')}
            </div>` : '<small class="muted">Sin campos evaluables todavía.</small>'}
        </div>
      </div>
    </div>
  `;
}

function calculateEmployeeSummary(items, empleadoDni) {
  const mine = items.filter((x) => String(x.patrulleroDni || x.asignadoPatrulleroDni || '') === String(empleadoDni || ''));
  let finalizadas = 0;
  let urgentes = 0;
  let canceladas = 0;
  let km = 0;
  let facturacion = 0;
  let margen = 0;
  let minutos = 0;
  let incidencias = 0;

  for (const s of mine) {
    const estado = String(s.estado || '');
    if (estado === 'finalizada') finalizadas += 1;
    if (estado === 'cancelada') canceladas += 1;
    if (String(s.prioridad || '').toLowerCase() === 'alta') urgentes += 1;
    km += num(s.distanciaKm, num(s.distanciaM) / 1000);
    facturacion += num(s.importeTotal);
    margen += num(s.importeTotal) - Math.round(num(s.tarifaBase) * 0.22 + num(s.costoDistancia) * 0.35 + num(s.costoTiempo) * 0.35);
    minutos += num(s.duracionMin, (num(s.finMs) - num(s.inicioMs)) / 60000);
    if (Boolean(s.huboNovedad) || String(s.tipoNovedadFinal || '') === 'incidencia_grave') incidencias += 1;
  }

  const avg = finalizadas ? minutos / finalizadas : 0;
  const score = scorePatrullero({ finalizadas, urgentes, canceladas, margen, minutos });

  return {
    total: mine.length,
    finalizadas,
    urgentes,
    canceladas,
    km,
    facturacion,
    margen,
    minutos,
    promedioMin: avg,
    incidencias,
    score
  };
}

function renderEmployeeDashboard(root, summary) {
  root.innerHTML = `
    <div class="card v25-card" style="margin-top:14px;">
      <div class="v25-header">
        <div>
          <strong>🎯 V25 · Score personal del patrullero</strong>
          <div class="muted">Tu lectura operativa y económica dentro del sistema.</div>
        </div>
        <span class="${badgeClass(summary.score)}">${semaforo(summary.score)} · ${summary.score}/100</span>
      </div>

      <div class="v25-kpis">
        <div class="v25-kpi"><small>Servicios tomados</small><strong>${summary.total}</strong></div>
        <div class="v25-kpi"><small>Finalizadas</small><strong>${summary.finalizadas}</strong></div>
        <div class="v25-kpi"><small>Urgentes</small><strong>${summary.urgentes}</strong></div>
        <div class="v25-kpi"><small>Kilómetros</small><strong>${Math.round(summary.km)}</strong></div>
        <div class="v25-kpi"><small>Facturación</small><strong>${money(summary.facturacion)}</strong></div>
        <div class="v25-kpi"><small>Margen estimado</small><strong>${money(summary.margen)}</strong></div>
      </div>

      <div class="v25-grid-two" style="margin-top:14px;">
        <div class="v25-box">
          <div class="v25-box-title">⏱️ Ritmo operativo</div>
          <div class="v25-highlight">${formatMin(summary.promedioMin)}</div>
          <div class="muted">Promedio estimado por patrulla finalizada.</div>
        </div>
        <div class="v25-box">
          <div class="v25-box-title">🚨 Cierres con novedad</div>
          <div class="v25-highlight">${summary.incidencias}</div>
          <div class="muted">Servicios con novedad menor o incidencia grave.</div>
        </div>
      </div>
    </div>
  `;
}

// En v25-tablero-comercial.js
function ensureProducerContainer() {
  // Buscamos directamente el contenedor que pusiste en panel.html
  const node = document.getElementById('contenedorV25'); 
  return node; // Si existe, lo devuelve y listo
}

function ensureEmployeeContainer() {
  const sec = document.getElementById('mod-operativo');
  if (!sec) return null;
  let node = document.getElementById('v25EmployeeDashboard');
  if (node) return node;
  node = document.createElement('div');
  node.id = 'v25EmployeeDashboard';
  const grid = sec.querySelector('.grid-operativo');
  if (grid) grid.parentNode.insertBefore(node, grid.nextSibling);
  else sec.appendChild(node);
  return node;
}

export function initV25ProducerDashboard({ productorId }) {
  const root = ensureProducerContainer();
  if (!root || !productorId) return;
  root.innerHTML = '<div class="card v25-card" style="margin-top:14px;"><small class="muted">Cargando tablero V25...</small></div>';

  const q = query(collection(db, 'solicitudesPatrulla'), where('productorId', '==', productorId));
  onSnapshot(q, (snap) => {
    const items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    const summary = calculateProducerSummary(items);
    renderProducerDashboard(root, summary);
  }, (error) => {
    console.error('V25 productor:', error);
    root.innerHTML = '<div class="card v25-card" style="margin-top:14px;"><small style="color:#b91c1c;">No se pudo cargar el tablero V25.</small></div>';
  });
}

export function initV25EmployeeDashboard({ productorId, empleadoDni }) {
  const root = ensureEmployeeContainer();
  if (!root || !productorId || !empleadoDni) return;
  root.innerHTML = '<div class="card v25-card" style="margin-top:14px;"><small class="muted">Cargando score V25...</small></div>';

  const q = query(collection(db, 'solicitudesPatrulla'), where('productorId', '==', productorId));
  onSnapshot(q, (snap) => {
    const items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    const summary = calculateEmployeeSummary(items, empleadoDni);
    renderEmployeeDashboard(root, summary);
  }, (error) => {
    console.error('V25 empleado:', error);
    root.innerHTML = '<div class="card v25-card" style="margin-top:14px;"><small style="color:#b91c1c;">No se pudo cargar el score V25.</small></div>';
  });
}
