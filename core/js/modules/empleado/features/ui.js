
import { createDiagnosticsBucket } from '../../../core/app-config.js';

export const empleadoFeature = {
  key: "ui",
  title: "UI",
  description: "Mensajes, estados y helpers visuales del panel.",
  selectors: {"toasts": "#toast, .toast", "badges": ".badge, .chip"},
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
