import { registerRuntime } from '../../../core/runtime-store.js';
import { countMatches, textOf } from '../../../core/dom-helpers.js';

export function mountTrackingRuntime() {
  const payload = {
    scope: 'empleado',
    key: 'tracking',
    selectors: {
      mapa: countMatches('#map, #employeeMap, #mapa'),
      cronometro: countMatches('#cronometro, #timer'),
      accionesGps: countMatches('#btnIniciarPatrullaGps, #btnFinalizarPatrullaGps'),
    },
    state: {
      empleadoLabel: textOf('#sub', 'Sin sesión'),
      trackingActivo: localStorage.getItem('trackingActivo') === '1',
      patrullaActivaId: localStorage.getItem('patrullaActivaId') || null,
      watchPatrullaId: localStorage.getItem('watchPatrullaId') || null,
    }
  };
  return registerRuntime('empleado', 'tracking', payload);
}
