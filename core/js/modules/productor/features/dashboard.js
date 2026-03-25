import { createDiagnosticsBucket } from '../../../core/app-config.js';
import { mountDashboardRuntime } from './dashboard.runtime.js';

export const productorFeature = {
  key: "dashboard",
  title: "Dashboard",
  description: "Resumen ejecutivo y métricas del productor.",
  selectors: {"cards": ".card", "acciones": ".actions"},
  init() {
    const bucket = createDiagnosticsBucket("productor");
    const dom = {};
    for (const [name, selector] of Object.entries(this.selectors)) {
      dom[name] = Array.from(document.querySelectorAll(selector)).length;
    }
    bucket.dom[this.key] = dom;
    bucket.runtime = bucket.runtime || {};
    bucket.runtime[this.key] = mountDashboardRuntime();
    if (!bucket.initialized.includes(this.key)) bucket.initialized.push(this.key);
    return dom;
  }
};
