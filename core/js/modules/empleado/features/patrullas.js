
import { createDiagnosticsBucket } from '../../../core/app-config.js';

export const empleadoFeature = {
  key: "patrullas",
  title: "Patrullas",
  description: "Aceptación, salida al lugar e inicio de patrullaje.",
  selectors: {"lista": "#listaSolicitudes, #listaPatrullas", "acciones": ".actions"},
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
