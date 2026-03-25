
import { createDiagnosticsBucket } from '../../../core/app-config.js';

export const empleadoFeature = {
  key: "incidencias",
  title: "Incidencias",
  description: "Carga de incidencias operativas del empleado.",
  selectors: {"form": "#incidenciaForm, #formIncidencia", "lista": "#listaIncidencias"},
  init() {
    const bucket = createDiagnosticsBucket("empleado");
    const dom = {};
    for (const [name, selector] of Object.entries(this.selectors)) {
      dom[name] = Array.from(document.querySelectorAll(selector)).length;
    }
    bucket.dom[this.key] = dom;
    if (!bucket.initialized.includes(this.key)) bucket.initialized.push(this.key);
    return dom;
  }
};
