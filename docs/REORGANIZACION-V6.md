# REORGANIZACIÓN V6

## Objetivo
Empezar la extracción real **sin tocar todavía la lógica pesada** de `panel.module.js`, pero dejando montados puentes de runtime para los dominios prioritarios:

- Empleado / Tracking
- Empleado / Tareas
- Productor / Dashboard
- Productor / Patrullas

## Qué cambia
- Se agregan helpers compartidos:
  - `js/core/dom-helpers.js`
  - `js/core/runtime-store.js`
- Se agregan runtime bridges:
  - `js/modules/empleado/features/tracking.runtime.js`
  - `js/modules/empleado/features/tareas.runtime.js`
  - `js/modules/productor/features/dashboard.runtime.js`
  - `js/modules/productor/features/patrullas.runtime.js`
- Las features existentes ya registran un snapshot de runtime en `window.__RED_RURAL__.runtime`
- El service worker sube de versión para tomar el nuevo shell

## Cómo inspeccionarlo
En consola:

```js
window.__RED_RURAL__.runtime
window.__RED_RURAL__.diagnostics
```

## Beneficio de V6
Todavía no se movió el corazón del negocio, pero ahora ya existe una **base observable y separable** para empezar la V7 con extracción real de funciones por dominio.
