
export function calcularMetricasServicios(servicios = []) {
  const total = servicios.length;
  const finalizados = servicios.filter(s => s.estado === 'finalizado').length;
  const enCamino = servicios.filter(s => s.estado === 'en_camino').length;
  const enProceso = servicios.filter(s => s.estado === 'en_proceso').length;
  const pendientes = servicios.filter(s => ['pendiente','asignado'].includes(s.estado)).length;

  let facturacion = 0;
  let comision = 0;
  servicios.forEach(s => {
    facturacion += Number(s.precio || 0);
    comision += Number(s.comision || 0);
  });

  return {
    total,
    finalizados,
    enCamino,
    enProceso,
    pendientes,
    facturacion,
    comision,
    ticketPromedio: total ? Math.round(facturacion / total) : 0
  };
}
