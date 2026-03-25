// V38 FULL - Asignación inteligente por zona
console.log("V38 asignación inteligente cargada");

const V38_CONFIG = {
  pesos: {
    urgencia: 40,
    distancia: 25,
    disponibilidad: 20,
    carga: 10,
    zonaCritica: 5
  }
};

function normalizarNumero(valor, maximo = 100) {
  const n = Number(valor || 0);
  if (n < 0) return 0;
  if (n > maximo) return maximo;
  return n;
}

function calcularScoreAsignacion({
  urgencia = 0,
  distancia = 100,
  disponible = true,
  carga = 0,
  zonaCritica = false
} = {}) {
  const scoreUrgencia = normalizarNumero(urgencia) * (V38_CONFIG.pesos.urgencia / 100);
  const scoreDistancia = (100 - normalizarNumero(distancia)) * (V38_CONFIG.pesos.distancia / 100);
  const scoreDisponibilidad = (disponible ? 100 : 0) * (V38_CONFIG.pesos.disponibilidad / 100);
  const scoreCarga = (100 - normalizarNumero(carga)) * (V38_CONFIG.pesos.carga / 100);
  const scoreZona = (zonaCritica ? 100 : 0) * (V38_CONFIG.pesos.zonaCritica / 100);

  return Math.round(scoreUrgencia + scoreDistancia + scoreDisponibilidad + scoreCarga + scoreZona);
}

function sugerirPatrullero(servicio = {}, patrulleros = []) {
  if (!Array.isArray(patrulleros) || patrulleros.length === 0) return null;

  const evaluados = patrulleros.map((p) => ({
    ...p,
    score: calcularScoreAsignacion({
      urgencia: servicio.urgencia || 0,
      distancia: p.distancia || 100,
      disponible: p.disponible !== false,
      carga: p.carga || 0,
      zonaCritica: !!servicio.zonaCritica
    })
  }));

  evaluados.sort((a, b) => b.score - a.score);
  return evaluados[0];
}

window.V38_CONFIG = V38_CONFIG;
window.calcularScoreAsignacion = calcularScoreAsignacion;
window.sugerirPatrullero = sugerirPatrullero;
