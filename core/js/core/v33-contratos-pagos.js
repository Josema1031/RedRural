// V33 FULL - Contratos y pagos
console.log("V33 contratos y pagos cargado");

const V33_CONFIG = {
  estadosContrato: ["Activo", "Pendiente", "Vencido", "Suspendido"],
  estadosPago: ["Pendiente", "Facturado", "Cobrado"]
};

function calcularEstadoVencimiento(fechaVencimiento){
  if(!fechaVencimiento) return "Sin fecha";
  const hoy = new Date();
  const venc = new Date(fechaVencimiento + "T00:00:00");
  const diff = Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "Vencido";
  if (diff <= 7) return "Por vencer";
  return "Activo";
}

window.V33_CONFIG = V33_CONFIG;
window.calcularEstadoVencimiento = calcularEstadoVencimiento;
