
# V18 FULL - Flujo productor → empleado en vivo

## Archivos nuevos
- js/core/asignacion-servicio-firebase.js
- js/core/servicios-empleado-ui.js
- js/core/cambio-estado-servicio.js
- css/servicios-empleado.css

## Qué agrega
- Asignación real del servicio en Firestore
- Listado en vivo para el empleado de servicios asignados
- Base para cambio de estado del servicio

## Integración sugerida

### Productor
En el flujo de asignación, llamar:
```js
import { asignarServicioFirestore } from '../../core/asignacion-servicio-firebase.js';
```

### Empleado
En `empleado/panel.html` agregar:
```html
<div id="contenedorServiciosEmpleado"></div>
<link rel="stylesheet" href="../css/servicios-empleado.css">
```

En `js/modules/empleado/index.js` agregar:
```js
import { montarServiciosEmpleado } from '../../core/servicios-empleado-ui.js';
```

Y cuando ya tengas `db` y el identificador del empleado:
```js
document.addEventListener('DOMContentLoaded', () => {
  montarServiciosEmpleado({
    db,
    empleadoId: empleadoDni || auth?.currentUser?.uid || '',
    containerId: 'contenedorServiciosEmpleado'
  });
});
```

## Próximo paso
V19: botones de cambio de estado en vivo para el empleado.
