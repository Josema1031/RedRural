import { registerRuntime } from '../../../core/runtime-store.js';
import { countMatches, textOf } from '../../../core/dom-helpers.js';

export function mountTareasRuntime() {
  const payload = {
    scope: 'empleado',
    key: 'tareas',
    selectors: {
      lista: countMatches('#listaTareas, #tareasList'),
      alertas: countMatches('#listaAlertas'),
      patrullas: countMatches('#listaPatrullas')
    },
    state: {
      tareasTexto: textOf('#listaTareas', ''),
      alertasTexto: textOf('#listaAlertas', ''),
      productorId: localStorage.getItem('productorId') || null,
      empleadoDni: localStorage.getItem('empleadoDni') || null,
    }
  };
  return registerRuntime('empleado', 'tareas', payload);
}
