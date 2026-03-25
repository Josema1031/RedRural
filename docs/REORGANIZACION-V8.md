# REORGANIZACION V8

## Objetivo
Empezar a unificar reglas transversales del ecosistema sin tocar todavía los flujos sensibles del panel.

## Qué se hizo
- Se creó `js/core/status-utils.js` para centralizar:
  - colores de estado
  - textos de estado
  - clases visuales
  - resumen de patrullas finalizadas
- `empleado/features/tracking.helpers.js` ahora usa esa base común.
- `productor/features/patrullas.helpers.js` ahora usa esa base común.
- Se creó `js/core/tarifas-service.js` para preparar la monetización:
  - cálculo estimado por servicio
  - normalización de tipos de servicio
- Se creó `js/modules/services/services-registry.js` con un catálogo base del ecosistema.
- Se agregó `js/modules/services/mandados.base.js` como semilla de Mandados Rurales.
- Se agregó `data/tarifas-base.json`.

## Resultado
La plataforma queda mejor preparada para:
- patrullaje
- incidencias
- futuros mandados
- tarifas y comisiones
- reportes consistentes por estado

## Próximo paso sugerido
V9:
- extraer callbacks reales de tracking del empleado
- extraer creación/actualización de solicitudes de patrulla del productor
- empezar base de servicios monetizables por productor
