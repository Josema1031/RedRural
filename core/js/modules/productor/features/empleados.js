
import { createDiagnosticsBucket } from '../../../core/app-config.js';

export const productorFeature = {
  key: "empleados",
  title: "Empleados",
  description: "Alta, edición y gestión del personal.",
  selectors: {"lista": "#listaEmpleados, #empleadosLista", "form": "#employeeForm, #formEmpleado"},
  init() {
    const bucket = createDiagnosticsBucket("productor");
    const dom = {};
    for (const [name, selector] of Object.entries(this.selectors)) {
      dom[name] = Array.from(document.querySelectorAll(selector)).length;
    }
    bucket.dom[this.key] = dom;
    if (!bucket.initialized.includes(this.key)) bucket.initialized.push(this.key);
    return dom;
  }
};
