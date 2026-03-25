// V47 FULL - Costos operativos
console.log("V47 costos operativos cargado");

function calcularCostoServicio(data = {}) {
  const km = Number(data.km || 0);
  const minutos = Number(data.minutos || 0);
  const costoKm = Number(data.costoKm || 0);
  const costoMinuto = Number(data.costoMinuto || 0);
  const desgaste = Number(data.desgaste || 0);
  const coordinacion = Number(data.coordinacion || 0);

  const combustible = km * costoKm;
  const tiempo = minutos * costoMinuto;
  const total = combustible + tiempo + desgaste + coordinacion;

  let estado = "controlado";
  if (total >= 40000) estado = "alto";
  else if (total >= 25000) estado = "medio";

  return {
    km,
    minutos,
    combustible,
    tiempo,
    desgaste,
    coordinacion,
    total,
    estado
  };
}

function resumirCostos(servicios = []) {
  const normalizados = servicios.map(calcularCostoServicio);
  return {
    costoTotal: normalizados.reduce((acc, s) => acc + s.total, 0),
    combustibleTotal: normalizados.reduce((acc, s) => acc + s.combustible, 0),
    desgasteTotal: normalizados.reduce((acc, s) => acc + s.desgaste, 0),
    tiempoOperativo: normalizados.reduce((acc, s) => acc + s.minutos, 0),
    detalle: normalizados
  };
}

window.calcularCostoServicio = calcularCostoServicio;
window.resumirCostos = resumirCostos;
