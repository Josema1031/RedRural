# REORGANIZACION V7

## Objetivo
Comenzar la extracción funcional real sin romper el comportamiento validado en V6.

## Cambios principales
- Se extrajeron helpers reales de empleado para tracking y tareas.
- Se extrajeron helpers reales de productor para dashboard y patrullas.
- `panel.module.js` de empleado ahora delega:
  - estado de conexión
  - colores/textos de estado de patrulla
  - render y cierre de tareas
- `panel.module.js` de productor ahora delega:
  - mensajes del dashboard diario
  - render de mini tarjetas de dashboard
  - clase/texto/resumen de estados de patrulla
- Se actualizó el service worker para incluir los nuevos archivos.

## Enfoque
Todavía no se removió toda la lógica de negocio pesada.
La estrategia sigue siendo: extraer piezas pequeñas, validarlas y luego avanzar.
