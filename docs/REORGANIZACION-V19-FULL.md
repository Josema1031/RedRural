
# V19 FULL integrada

## Qué corrige
- Mantiene el formato de ZIP completo con carpeta raíz `RED RURAL`
- Integra V19 sin pedir cambios manuales
- Corrige `js/modules/empleado/index.js`
- Corrige la escucha de servicios asignados con `productorId`
- Agrega botones de cambio de estado en vivo para el empleado

## Recordatorio importante
Para que los servicios asignados funcionen en el panel empleado:
- `asignadoA` debe guardar el DNI del empleado
- las reglas de Firestore deben incluir `solicitudes_servicio`
- `employees/{dni}` debe tener `authUid` y `productorId`
