import { registerRuntime } from '../../../core/runtime-store.js';
import { countMatches, textOf } from '../../../core/dom-helpers.js';

export function mountPatrullasRuntime() {
  const payload = {
    scope: 'productor',
    key: 'patrullas',
    selectors: {
      historial: countMatches('#historialPatrullas, #tablaPatrullas'),
      mapa: countMatches('#map, #mapaPatrullas, #mapaPatrullaVivo'),
      filtros: countMatches('#filtroEstadoPatrulla, #filtroFechaPatrulla, #filtroEmpleadoPatrulla')
    },
    state: {
      totalSolicitudesTexto: textOf('#listaSolicitudes', ''),
      totalHistorialTexto: textOf('#historialPatrullas', ''),
      productorId: localStorage.getItem('productorId') || null,
    }
  };
  return registerRuntime('productor', 'patrullas', payload);
}
