function money(value = 0) {
  return Number(value || 0);
}

function contarPorTipo(servicios = []) {
  return servicios.reduce((acc, item) => {
    const tipo = item?.tipoServicio || item?.tipo || 'servicio';
    acc[tipo] = (acc[tipo] || 0) + 1;
    return acc;
  }, {});
}

export function construirResumenProductor({ productorId = 'demo-productor' } = {}) {
  // 1. Aseguramos que solicitudes sea siempre un array para que no falle el .filter
  const solicitudes = Array.isArray(window.__RED_RURAL__?.serviceRequests)
    ? window.__RED_RURAL__.serviceRequests
    : [];

  const propias = solicitudes.filter((item) => {
    const pid = item?.productorId || item?.clienteId || 'demo-productor';
    return pid === productorId || productorId === 'demo-productor';
  });

  // Calculamos valores asegurando que sean números
  const total = propias.reduce((sum, item) => sum + (Number(item?.precioFinal || item?.precio) || 0), 0);
  const comision = propias.reduce((sum, item) => sum + (Number(item?.comision) || 0), 0);
  
  // RETORNO SIEMPRE VÁLIDO (Incluso si propias.length es 0)
  return {
    productorId,
    fechaCorte: new Date().toISOString(),
    metricas: {
      solicitudes: propias.length,
      gastoEstimado: Number(total.toFixed(2)) || 0,
      comisionPlataforma: Number(comision.toFixed(2)) || 0,
      netoPrestadores: Number((total - comision).toFixed(2)) || 0,
      serviciosActivos: propias.filter((item) => ['pendiente', 'asignado', 'en_camino', 'en_proceso'].includes(item?.estado)).length,
    },
    operacion: {
      porTipo: contarPorTipo(propias),
      ultimoServicio: propias.length > 0 ? {
        tipo: propias[0]?.tipoServicio || 'servicio',
        estado: propias[0]?.estado || 'pendiente',
        precio: Number(propias[0]?.precioFinal || propias[0]?.precio) || 0
      } : null
    }
  };
}

// En resumen-productor.js
export function inicializarResumenProductor({ productorId = 'demo-productor' } = {}) {
  if (!window.__RED_RURAL__) window.__RED_RURAL__ = {};
  
  // Forzamos la creación del resumen inmediatamente
  window.__RED_RURAL__.resumenProductor = construirResumenProductor({ productorId });

  // Si usamos un sistema de eventos (opcional pero recomendado)
  document.dispatchEvent(new CustomEvent('resumenListo'));
  
  console.log("Resumen inicializado para:", productorId);
}
