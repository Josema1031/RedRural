# Reorganización V3

Esta versión avanza un paso más en la profesionalización del proyecto sin tocar todavía la lógica pesada de patrullaje e incidencias.

## Cambios aplicados

### 1. Scripts inline extraídos a módulos externos
Se separó la lógica de:
- `productor/login.html` → `js/modules/auth/productor-login.js`
- `empleado/login.html` → `js/modules/auth/empleado-login.js`
- `admin.html` → `js/modules/admin/admin-page.js`

### 2. Base común de red / service worker
Se creó:
- `js/core/network-status.js`

Objetivo:
- unificar el texto de conexión
- centralizar el registro del service worker
- empezar a evitar lógica repetida en varias pantallas

### 3. Tema visual común
Se creó:
- `css/app-theme.css`

Objetivo:
- empezar a definir variables visuales compartidas
- dar una identidad más consistente al ecosistema
- preparar futura unificación total de colores, badges, cards y estados

## Qué queda para la V4
- separar `productor/panel.module.js` por dominios reales
- separar `empleado/panel.module.js` por dominios reales
- unificar helpers de Firestore
- preparar colección / estructura de servicios y monetización
