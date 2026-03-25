import { registerRuntime } from '../../../core/runtime-store.js';
import { countMatches, textOf } from '../../../core/dom-helpers.js';

export function mountDashboardRuntime() {
  const payload = {
    scope: 'productor',
    key: 'dashboard',
    selectors: {
      cards: countMatches('.card'),
      acciones: countMatches('.actions'),
      resumenes: countMatches('#resumenHoy, #boxAdmin, #bannerPlan')
    },
    state: {
      saludo: textOf('#sub', ''),
      productorId: localStorage.getItem('productorId') || null,
      planActual: textOf('#bannerPlan', '')
    }
  };
  return registerRuntime('productor', 'dashboard', payload);
}
