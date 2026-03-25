
import { asignarServicio } from './asignacion-servicio.js';

export function renderAsignacionDemo(containerId){
  const el = document.getElementById(containerId);
  if(!el) return;
  el.innerHTML = `
    <div class="card-asignacion">
      <h3>👷 Asignar servicio (demo)</h3>
      <input id="empId" placeholder="ID empleado">
      <button id="btnAsignar">Asignar</button>
      <div id="msgAsignar"></div>
    </div>
  `;
  const btn = el.querySelector('#btnAsignar');
  const msg = el.querySelector('#msgAsignar');
  btn.onclick = ()=>{
    const empId = el.querySelector('#empId').value;
    const base = window.__RED_RURAL__?.ultimaSolicitudCreada?.solicitud || {};
    const res = asignarServicio(base, empId);
    window.__RED_RURAL__ = window.__RED_RURAL__ || {};
    window.__RED_RURAL__.ultimaAsignacion = res;
    msg.textContent = 'Asignado a: ' + empId;
    console.log('Asignación', res);
  }
}
