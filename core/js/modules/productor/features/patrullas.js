import { createDiagnosticsBucket } from '../../../core/app-config.js';
import { mountPatrullasRuntime } from './patrullas.runtime.js';

export const productorFeature = {
  key: "patrullas",
  title: "Patrullas",
  description: "Solicitudes, historial y seguimiento de patrullas.",
  selectors: {"lista": "#listaSolicitudes, #historialPatrullas, #tablaPatrullas", "mapa": "#map, #mapaPatrullas"},
  init() {
    const bucket = createDiagnosticsBucket("productor");
    const dom = {};
    for (const [name, selector] of Object.entries(this.selectors)) {
      dom[name] = Array.from(document.querySelectorAll(selector)).length;
    }
    bucket.dom[this.key] = dom;
    bucket.runtime = bucket.runtime || {};
    bucket.runtime[this.key] = mountPatrullasRuntime();
    if (!bucket.initialized.includes(this.key)) bucket.initialized.push(this.key);
    return dom;
  }
};
