import { createDiagnosticsBucket } from '../../../core/app-config.js';
import { mountTareasRuntime } from './tareas.runtime.js';

export const empleadoFeature = {
  key: "tareas",
  title: "Tareas",
  description: "Lectura y seguimiento de tareas asignadas.",
  selectors: {"lista": "#listaTareas, #tareasList", "estado": "#estadoTareas"},
  init() {
    const bucket = createDiagnosticsBucket("empleado");
    const dom = {};
    for (const [name, selector] of Object.entries(this.selectors)) {
      dom[name] = Array.from(document.querySelectorAll(selector)).length;
    }
    bucket.dom[this.key] = dom;
    bucket.runtime = bucket.runtime || {};
    bucket.runtime[this.key] = mountTareasRuntime();
    if (!bucket.initialized.includes(this.key)) bucket.initialized.push(this.key);
    return dom;
  }
};
