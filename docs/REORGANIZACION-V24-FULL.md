# RED RURAL – V24 FULL

## Nombre de versión
V24 FULL – Alertas inteligentes y automatización operativa inicial

## Objetivo
Agregar una capa de lectura automática del negocio y de la operación para detectar en tiempo real:

- patrullas pendientes sin tomar
- servicios demorados
- cobros atrasados
- liquidaciones pendientes
- campos críticos
- prioridades del turno del patrullero

## Módulo nuevo
- `js/core/alertas-inteligentes.js`

## Productor
Se agregó en `productor/panel.html` un nuevo bloque:

- Centro de alertas V24
- Resumen de alertas
- Lista de prioridades automáticas

La lógica se integra en:
- `js/modules/productor/panel.module.js`

### Alertas del productor
- patrullas pendientes hace 15 min o más
- servicios activos hace 90 min o más
- cobros demorados por más de 3 días
- liquidaciones al patrullero pendientes por más de 2 días
- campo crítico con 2 o más urgentes activas

## Empleado
Se agregó en `empleado/panel.html`:

- Alertas V24
- Prioridades del turno

La lógica se integra en:
- `js/modules/empleado/panel.module.js`

### Alertas del empleado
- asignaciones esperando aceptación
- servicios activos hace 120 min o más
- liquidación pendiente a su favor
- urgencias activas en su bandeja

## Resultado estratégico
Con la V24 el sistema deja de ser solamente operativo y empieza a comportarse como una plataforma que interpreta lo que está pasando.

Esto deja la base lista para una V25 enfocada en:

- tablero comercial
- alertas por cliente
- scoring de campos
- priorización automática por zona
- reportes predictivos
