// V39 FULL - Despacho en tiempo real
console.log("V39 despacho en tiempo real cargado");

const V39_CONFIG = {
  umbralDespachoAutomatico: 90,
  umbralConfirmacionManual: 75,
  pesos: {
    scoreAsignacion: 60,
    cobertura: 20,
    urgenciaAbierta: 20
  }
};

function calcularScoreDespacho({
  scoreAsignacion = 0,
  coberturaZona = 100,
  urgenciaAbierta = false
} = {}) {
  const scoreBase = Number(scoreAsignacion || 0) * (V39_CONFIG.pesos.scoreAsignacion / 100);
  const scoreCobertura = Number(coberturaZona || 0) * (V39_CONFIG.pesos.cobertura / 100);
  const scoreUrgencia = (urgenciaAbierta ? 100 : 0) * (V39_CONFIG.pesos.urgenciaAbierta / 100);
  return Math.round(scoreBase + scoreCobertura + scoreUrgencia);
}

function clasificarDespacho(score = 0) {
  if (score >= V39_CONFIG.umbralDespachoAutomatico) return "automatico_sugerido";
  if (score >= V39_CONFIG.umbralConfirmacionManual) return "manual_asistido";
  return "en_espera";
}

function decidirDespacho(servicio = {}, patrullero = {}) {
  const score = calcularScoreDespacho({
    scoreAsignacion: patrullero.scoreAsignacion || servicio.scoreAsignacion || 0,
    coberturaZona: servicio.coberturaZona || 100,
    urgenciaAbierta: !!servicio.urgente
  });

  return {
    score,
    clasificacion: clasificarDespacho(score)
  };
}

window.V39_CONFIG = V39_CONFIG;
window.calcularScoreDespacho = calcularScoreDespacho;
window.clasificarDespacho = clasificarDespacho;
window.decidirDespacho = decidirDespacho;
