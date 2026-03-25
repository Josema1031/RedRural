# Red Rural - Organización empresarial y técnica

## Ecosistema propuesto
- Red Rural Platform: autenticación, roles, panel base, planes.
- Uber Rural Seguridad: patrullaje, seguimiento, historial.
- SISG Rural: incidencias, mapas de riesgo, análisis.
- Mandados Rurales: logística entre campos, insumos, herramientas.

## Reorganización aplicada en esta versión
- Se removió la carpeta `.git` del paquete entregable.
- Se extrajo la lógica inline principal de `productor/panel.html` a `js/modules/productor-panel.module.js`.
- Se extrajo el registro del service worker de productor a `js/modules/productor-panel.sw.js`.
- Se extrajo la lógica inline principal de `empleado/panel.html` a `js/modules/empleado-panel.module.js`.
- Se extrajo el registro del service worker de empleado a `js/modules/empleado-panel.sw.js`.
- Se movió el CSS inline de `index.html` a `css/landing.css`.
- Se movió el script inline de `index.html` a `js/modules/landing-sw.js`.
- Se corrigieron detalles visibles en `index.html` (Open Graph y nombre del sitio).
- Se mejoró `service-worker.js` para evitar cachear esquemas no soportados.

## Próximo paso sugerido
1. Dividir productor por submódulos: patrullaje, tareas, combustible, camiones, empleados.
2. Dividir empleado por submódulos: tracking, patrullas, incidencias, tareas.
3. Unificar Firebase en `js/core/`.
4. Crear una capa de servicios para planes, cobros y comisiones.
