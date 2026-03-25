# Reorganización V2

## Objetivo
Profesionalizar la estructura sin romper el funcionamiento validado en V1.

## Cambios aplicados
- `js/modules/productor-panel.module.js` pasó a `js/modules/productor/panel.module.js`
- `js/modules/empleado-panel.module.js` pasó a `js/modules/empleado/panel.module.js`
- Se agregaron `js/modules/productor/index.js` y `js/modules/empleado/index.js` como puntos de entrada limpios
- Se creó una base visual común en `css/app-base.css` y `css/app-components.css`
- Se extrajeron estilos inline de:
  - `productor/login.html`
  - `empleado/login.html`
  - `empleado/panel.html`
  - `admin.html`
- Se agregaron archivos base en `js/core/` para futura centralización

## Beneficio
Esta versión deja una arquitectura más limpia para seguir separando módulos de negocio:
- productor
- empleado
- patrullaje
- incidencias
- logística futura

## Próxima V3 sugerida
1. Subdividir `productor/panel.module.js` por dominios
2. Subdividir `empleado/panel.module.js` por dominios
3. Unificar componentes visuales de cards, botones y badges
4. Preparar colección de servicios y tarifas
