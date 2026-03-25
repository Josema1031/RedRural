# REORGANIZACIÓN V9

## Objetivo
Dar el salto desde una reorganización técnica hacia una base más empresarial y monetizable, sin romper la operación actual.

## Cambios incorporados
- Nueva fábrica de solicitudes de servicio:
  - `js/core/service-request-factory.js`
- Nuevo servicio de monetización:
  - `js/core/monetization-service.js`
- Registro base de solicitudes demo del ecosistema:
  - `js/modules/services/service-request-registry.js`
- Nuevo archivo base de planes:
  - `data/planes-base.json`

## Qué habilita esta versión
- Un único formato base para patrullas y mandados.
- Estimación homogénea de precio/comisión.
- Base para futuro panel de negocio.
- Base para planes y suscripciones.

## Qué NO se tocó todavía
- Flujo principal de login.
- Lógica pesada de patrullaje e incidencias.
- Persistencia real de estos datos en Firestore.

## Siguiente paso recomendado
V10:
- conectar solicitudes reales del productor con esta fábrica de servicios
- preparar tablero ejecutivo del negocio
- empezar a dejar trazabilidad monetizable por productor
