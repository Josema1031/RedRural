// V44 FULL - Reportes operativos y evidencia
console.log("V44 reportes operativos cargado");

function generarReporteServicio(servicio = {}) {
  return {
    fecha: new Date().toISOString(),
    campo: servicio.campo || "",
    tipoServicio: servicio.tipo || "",
    resultado: servicio.resultado || "correcto",
    evidencia: servicio.evidencia || []
  };
}

function validarEvidencia(evidencia = []) {
  return evidencia.length > 0;
}

window.generarReporteServicio = generarReporteServicio;
window.validarEvidencia = validarEvidencia;
