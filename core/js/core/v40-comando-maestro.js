// V40 FULL - Comando maestro
console.log("V40 comando maestro cargado");

const V40_STORE = {
  zonas: [],
  clientes: [],
  servicios: [],
  patrulleros: [],
  comercial: []
};

function obtenerVistaMaestra({
  zonas = [],
  clientes = [],
  servicios = [],
  patrulleros = [],
  comercial = []
} = {}) {
  return servicios.map((servicio) => {
    const cliente = clientes.find(c => c.id === servicio.clienteId) || {};
    const zona = zonas.find(z => z.id === servicio.zonaId) || {};
    const patrullero = patrulleros.find(p => p.id === servicio.patrulleroId) || {};
    const datoComercial = comercial.find(c => c.clienteId === servicio.clienteId) || {};

    return {
      servicioId: servicio.id || "",
      zona: zona.nombre || "Sin zona",
      cliente: cliente.nombre || "Sin cliente",
      patrullero: patrullero.nombre || "Sin patrullero",
      despacho: servicio.despacho || "sin_dato",
      estadoComercial: datoComercial.estado || "sin_dato",
      prioridad: servicio.prioridad || "media"
    };
  });
}

function calcularSaludOperativa({
  cobertura = 100,
  alertas = 0,
  despachosCriticos = 0
} = {}) {
  let score = Number(cobertura || 0);
  score -= Number(alertas || 0) * 5;
  score -= Number(despachosCriticos || 0) * 7;
  if (score < 0) score = 0;
  if (score > 100) score = 100;
  return Math.round(score);
}

window.V40_STORE = V40_STORE;
window.obtenerVistaMaestra = obtenerVistaMaestra;
window.calcularSaludOperativa = calcularSaludOperativa;
