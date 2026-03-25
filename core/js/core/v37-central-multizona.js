// V37 FULL - Administración central multi-zona
console.log("V37 administración central multi-zona cargada");

const V37_ESTADO = {
  zonas: [],
  localidades: [],
  operacion: [],
  clientes: []
};

function resumirZona(zona = {}) {
  return {
    nombre: zona.nombre || "Sin nombre",
    localidad: zona.localidad || "Sin localidad",
    clientes: Number(zona.clientes || 0),
    patrulleros: Number(zona.patrulleros || 0),
    alertas: Number(zona.alertas || 0),
    prioridad: Number(zona.alertas || 0) >= 2 ? "critica" : (Number(zona.alertas || 0) >= 1 ? "alta" : "media")
  };
}

function consolidarZonas(zonas = []) {
  return zonas.map(resumirZona).sort((a, b) => b.alertas - a.alertas);
}

function obtenerCoberturaGeneral(zonas = []) {
  const base = consolidarZonas(zonas);
  return {
    totalZonas: base.length,
    totalClientes: base.reduce((acc, z) => acc + z.clientes, 0),
    totalPatrulleros: base.reduce((acc, z) => acc + z.patrulleros, 0),
    totalAlertas: base.reduce((acc, z) => acc + z.alertas, 0)
  };
}

window.V37_ESTADO = V37_ESTADO;
window.resumirZona = resumirZona;
window.consolidarZonas = consolidarZonas;
window.obtenerCoberturaGeneral = obtenerCoberturaGeneral;
