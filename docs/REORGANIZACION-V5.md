
# REORGANIZACIÓN V5

Esta versión agrega una base más seria para escalar sin tocar todavía la lógica de negocio principal.

## Qué se incorporó

- `js/core/app-config.js`
  - estados unificados del ecosistema
  - tipos de servicio base
  - bucket de diagnósticos por panel

- `js/core/feature-flags.js`
  - flags para encender/apagar el bootstrap modular sin romper compatibilidad

- `js/modules/productor/features/*`
  - cada feature ahora tiene `init()` no invasivo
  - detecta nodos del DOM y deja diagnóstico en `window.__RED_RURAL__.diagnostics.productor`

- `js/modules/empleado/features/*`
  - mismo esquema para el panel empleado

- `data/servicios-base.json`
  - catálogo inicial para futura monetización y motor único de solicitudes

## Cómo inspeccionar la base modular

Desde la consola del navegador:

```js
window.__RED_RURAL__
```

## Resultado esperado

- no cambia el comportamiento operativo actual
- deja trazabilidad interna de qué módulos existen
- prepara el terreno para V6, donde ya conviene mover bloques reales de lógica

## Recomendación para la próxima iteración

1. extraer tracking del panel empleado
2. extraer tareas del panel empleado
3. extraer dashboard del productor
4. extraer patrullas del productor
