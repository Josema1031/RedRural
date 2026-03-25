# Reorganización V3.1

## Correcciones aplicadas
- Corregidas las rutas de importación en los módulos de login de productor y empleado.
- Corregida la ruta al módulo `network-status.js`.
- Mejorado `service-worker.js` para no intentar cachear esquemas no soportados como `chrome-extension:`.
- Actualizado el APP_SHELL para reflejar la estructura real de archivos de la V3.
- Cacheo de archivos del shell convertido en tolerante a errores para que un archivo faltante no rompa toda la instalación del service worker.

## Pruebas recomendadas
1. Abrir `productor/login.html`.
2. Abrir `empleado/login.html`.
3. Hacer recarga forzada (`Ctrl + Shift + R`).
4. Si el navegador mantiene un service worker viejo, ir a Application > Service Workers y desregistrarlo una vez.
