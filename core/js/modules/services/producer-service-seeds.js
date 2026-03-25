import { createMandadoDraft, createPatrullaDraft } from '../../core/service-request-factory.js';

export const PRODUCTOR_SERVICE_SEEDS = Object.freeze([
  createPatrullaDraft({
    id: 'pat_demo_noche_01',
    productorId: 'demo-productor',
    kilometros: 14,
    urgente: true,
    nocturno: true,
    prioridad: 'alta',
    origen: 'Acceso principal',
    destino: 'Potrero 4',
    titulo: 'Patrulla nocturna por movimiento sospechoso',
    metadata: {
      canal: 'panel-productor',
      categoria: 'seguridad',
      origenSistema: 'v10-seed'
    }
  }),
  createMandadoDraft({
    id: 'mand_demo_insumos_01',
    productorId: 'demo-productor',
    kilometros: 9,
    urgente: false,
    nocturno: false,
    prioridad: 'normal',
    origen: 'Casa principal',
    destino: 'Galpón de herramientas',
    titulo: 'Mandado de insumos y herramientas',
    metadata: {
      canal: 'panel-productor',
      categoria: 'logistica',
      origenSistema: 'v10-seed'
    }
  }),
  createMandadoDraft({
    id: 'mand_demo_repuesto_02',
    productorId: 'demo-productor',
    kilometros: 22,
    urgente: true,
    nocturno: false,
    prioridad: 'alta',
    origen: 'Taller rural',
    destino: 'Puesto San Jorge',
    titulo: 'Entrega urgente de repuesto',
    metadata: {
      canal: 'panel-productor',
      categoria: 'mantenimiento',
      origenSistema: 'v10-seed'
    }
  })
]);
