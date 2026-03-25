// V48 FULL - Margen por servicio
console.log("V48 margen por servicio cargado");

function calcularMargenServicio(data = {}) {
  const facturado = Number(data.facturado || 0);
  const costo = Number(data.costo || 0);
  const margen = facturado - costo;
  const porcentaje = facturado > 0 ? Math.round((margen / facturado) * 100) : 0;

  let estado = "rentable";
  if (margen < 0) estado = "perdida";
  else if (porcentaje < 15) estado = "bajo";

  return {
    servicio: data.servicio || "",
    cliente: data.cliente || "",
    facturado,
    costo,
    margen,
    porcentaje,
    estado
  };
}

function resumirMargenes(servicios = []) {
  const normalizados = servicios.map(calcularMargenServicio);
  return {
    margenTotal: normalizados.reduce((acc, s) => acc + s.margen, 0),
    margenPromedio: normalizados.length ? Math.round(normalizados.reduce((acc, s) => acc + s.margen, 0) / normalizados.length) : 0,
    serviciosRentables: normalizados.filter(s => s.estado === "rentable").length,
    serviciosARevisar: normalizados.filter(s => s.estado !== "rentable").length,
    ranking: normalizados.sort((a, b) => b.margen - a.margen)
  };
}

window.calcularMargenServicio = calcularMargenServicio;
window.resumirMargenes = resumirMargenes;
