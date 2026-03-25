
export function asignarServicio(solicitud, empleadoId){
  return {
    ...solicitud,
    asignadoA: empleadoId,
    estado: 'asignado',
    actualizadoEn: new Date().toISOString()
  };
}
