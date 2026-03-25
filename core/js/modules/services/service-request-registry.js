import { createMandadoDraft, createPatrullaDraft } from '../../core/service-request-factory.js';
import { summarizeServices } from '../../core/monetization-service.js';

const SAMPLE_REQUESTS = Object.freeze([
  createPatrullaDraft({ kilometros: 12, urgente: true, nocturno: true, titulo: 'Patrulla nocturna ejemplo' }),
  createMandadoDraft({ kilometros: 8, urgente: false, nocturno: false, titulo: 'Mandado de insumos ejemplo', destino: 'Galpón principal' })
]);

export function bootstrapServiceRequests() {
  if (!window.__RED_RURAL__) window.__RED_RURAL__ = {};
  window.__RED_RURAL__.serviceRequests = SAMPLE_REQUESTS;
  window.__RED_RURAL__.business = {
    resumenServicios: summarizeServices(SAMPLE_REQUESTS)
  };
  return SAMPLE_REQUESTS;
}
