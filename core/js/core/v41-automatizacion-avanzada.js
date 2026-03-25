// V41 FULL - Automatización avanzada
console.log("V41 automatización avanzada cargada");

const V41_RULES = {
  coberturaMinima: 70,
  moraCriticaDias: 30,
  umbralUrgencia: 80,
  maxCargaPatrullero: 85
};

function evaluarReglasAutomaticas({
  cobertura = 100,
  diasMora = 0,
  urgencia = 0,
  cargaPatrullero = 0,
  contratoVencido = false
} = {}) {
  const acciones = [];

  if (cobertura < V41_RULES.coberturaMinima) {
    acciones.push({ modulo: "zona", accion: "refuerzo_preventivo", prioridad: "alta" });
  }

  if (contratoVencido && diasMora >= V41_RULES.moraCriticaDias) {
    acciones.push({ modulo: "comercial", accion: "bloqueo_sugerido", prioridad: "critica" });
  }

  if (urgencia >= V41_RULES.umbralUrgencia) {
    acciones.push({ modulo: "despacho", accion: "despacho_inmediato", prioridad: "critica" });
  }

  if (cargaPatrullero >= V41_RULES.maxCargaPatrullero) {
    acciones.push({ modulo: "operacion", accion: "reasignar_carga", prioridad: "media" });
  }

  return acciones;
}

function obtenerPrioridadGlobal(acciones = []) {
  if (acciones.some(a => a.prioridad === "critica")) return "critica";
  if (acciones.some(a => a.prioridad === "alta")) return "alta";
  if (acciones.some(a => a.prioridad === "media")) return "media";
  return "normal";
}

window.V41_RULES = V41_RULES;
window.evaluarReglasAutomaticas = evaluarReglasAutomaticas;
window.obtenerPrioridadGlobal = obtenerPrioridadGlobal;
