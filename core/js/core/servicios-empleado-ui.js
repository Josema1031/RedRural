import { escucharServiciosAsignadosEmpleado } from "./asignacion-servicio-firebase.js";
import { renderAccionesServicio } from "./estado-servicio-ui.js";

// Variable para saber cuántos servicios había antes de la actualización
let conteoServiciosPrevio = undefined;

export function montarServiciosEmpleado({ db, empleadoId, containerId = "contenedorServiciosEmpleado" }) {
  const cont = document.getElementById(containerId);
  if (!cont) return () => {};

  cont.innerHTML = '<div class="card-servicios-empleado"><h3>📦 Servicios asignados</h3><p>Conectando con base de datos...</p></div>';

  return escucharServiciosAsignadosEmpleado({
    db,
    empleadoId,
    onData: (items) => {
      // --- LÓGICA DE NOTIFICACIÓN ---
      // Si ya teníamos un conteo y el nuevo es mayor, disparamos la alerta
      if (conteoServiciosPrevio !== undefined && items.length > conteoServiciosPrevio) {
        ejecutarNotificacionSintetica();
      }
      // Actualizamos el conteo para la próxima vez
      conteoServiciosPrevio = items.length;

      if (!items.length) {
        cont.innerHTML = '<div class="card-servicios-empleado"><h3>📦 Servicios asignados</h3><p>No tenés servicios asignados en este momento.</p></div>';
        return;
      }

      // Dibujar la tabla
      let html = '<div class="card-servicios-empleado"><h3>📦 Servicios asignados</h3><div class="tabla-servicios-empleado">';
      items.forEach(s => {
        html += `
          <div class="fila-servicio-empleado">
            <div><strong>${s.tipo || "servicio"}</strong></div>
            <div>${s.titulo || "Sin título"}</div>
            <div><span class="badge-${s.estado}">${s.estado || "pendiente"}</span></div>
            <div>${s.prioridad || "normal"}</div>
            ${renderAccionesServicio(s)}
          </div>
        `;
      });
      html += '</div></div>';
      cont.innerHTML = html;
    },
    onError: (err) => {
      console.error("Error en tiempo real:", err);
      cont.innerHTML = '<div class="card-servicios-empleado"><p>Error de conexión. Reintentando...</p></div>';
    }
  });
}

/**
 * Genera un sonido de alerta y muestra un mensaje visual
 * No requiere archivos externos (.mp3)
 */
// servicios-empleado-ui.js

function ejecutarNotificacionSintetica() {
  try {
    // 1. Iniciamos el motor de audio del navegador
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // 2. Creamos el oscilador (el que genera la onda de sonido)
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine'; // Un tono puro
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // Frecuencia aguda
    
    // 3. Controlamos el volumen (empieza fuerte y baja rápido)
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // 4. ¡Suena!
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.5);

    // 5. El aviso visual
    alert("🚨 SISG RURAL: Se te ha asignado un nuevo servicio.");
    
  } catch (e) {
    console.log("Audio bloqueado temporalmente por el navegador.");
  }
}

function sonarAlerta() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  osc.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.3); // Suena un beep corto
}