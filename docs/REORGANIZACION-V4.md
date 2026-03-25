
# Reorganización V4

## Objetivo
Preparar la base para dividir el sistema por dominios reales sin romper la lógica actual.

## Cambios incluidos
- Nueva base visual compartida: `css/app-layout.css` y `css/app-utilities.css`.
- Carpetas por dominio para Productor y Empleado.
- Registro de features para dejar trazabilidad técnica del ecosistema.
- Sin cambios agresivos sobre la lógica de negocio actual.

## Dominios definidos
### Productor
- dashboard
- patrullas
- empleados
- tareas
- camiones
- combustible

### Empleado
- patrullas
- tracking
- incidencias
- tareas
- ui

## Próxima etapa sugerida
Extraer bloques reales del `panel.module.js` a cada feature en pequeños lotes, empezando por:
1. tracking del empleado
2. tareas del empleado
3. dashboard del productor
4. patrullas del productor
