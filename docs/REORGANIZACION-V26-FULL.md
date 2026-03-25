# RED RURAL · V26 FULL

## Nombre de la versión
V26 FULL – Cierre profesional del sistema

## Objetivo
Consolidar una capa final de control mensual para productor y patrullero, transformando la operación en un cierre listo para revisar, descargar, imprimir o guardar como PDF.

## Incorporaciones principales

### Productor
- Centro de cierre V26 dentro del módulo Uber Rural.
- KPIs del mes actual.
- Facturación, margen y pendiente de cobro.
- Proyección del mes en curso.
- Ranking de campos más rentables.
- Descarga de cierre en TXT.
- Descarga de detalle en CSV.
- Exportación técnica en JSON.
- Reporte imprimible / guardable como PDF desde el navegador.

### Empleado
- Centro de cierre personal V26 dentro del módulo Operativo.
- Liquidación estimada del mes.
- Pendiente de liquidación.
- Proyección mensual.
- Promedio operativo por servicio.
- Descarga TXT / CSV / JSON.
- Reporte imprimible / guardable como PDF desde el navegador.

## Archivos nuevos
- `js/core/v26-cierre-profesional.js`
- `css/v26-cierre-profesional.css`
- `docs/REORGANIZACION-V26-FULL.md`

## Archivos actualizados
- `productor/panel.html`
- `empleado/panel.html`
- `js/modules/productor/index.js`
- `js/modules/empleado/index.js`

## Lógica usada
La V26 toma las patrullas del productor en `solicitudesPatrulla`, filtra automáticamente las del mes actual y calcula:
- servicios totales
- finalizadas / activas / urgentes
- facturación estimada
- costo operativo estimado
- margen estimado
- pendiente de cobro
- pendiente de liquidación
- kilómetros y duración
- proyección del mes según avance del calendario

## Resultado estratégico
La V26 deja a RED RURAL listo para pasar a la siguiente etapa: visualización premium (V27), con una base más profesional para presentar, vender y administrar.
