import { createDiagnosticsBucket } from '../../../core/app-config.js';
import { mountTrackingRuntime } from './tracking.runtime.js';

export const empleadoFeature = {
  key: "tracking",
  title: "Tracking",
  description: "GPS, ruta, cronómetro y estados en vivo.",
  selectors: {"mapa": "#map, #employeeMap, #mapa", "cronometro": "#cronometro, #timer"},
  init() {
    const bucket = createDiagnosticsBucket("empleado");
    const dom = {};
    for (const [name, selector] of Object.entries(this.selectors)) {
      dom[name] = Array.from(document.querySelectorAll(selector)).length;
    }
    bucket.dom[this.key] = dom;
    bucket.runtime = bucket.runtime || {};
    bucket.runtime[this.key] = mountTrackingRuntime();
    if (!bucket.initialized.includes(this.key)) bucket.initialized.push(this.key);
    return dom;
  }
};
