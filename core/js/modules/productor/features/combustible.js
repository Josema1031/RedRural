
import { createDiagnosticsBucket } from '../../../core/app-config.js';

export const productorFeature = {
  key: "combustible",
  title: "Combustible",
  description: "Cargas, consumos y reportes de combustible.",
  selectors: {"tabla": "#tablaCombustible, #listaCombustible", "form": "#formCombustible"},
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
