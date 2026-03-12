import {
    auth,
    db,
    collection,
    getDocs,
    onAuthStateChanged,
    orderBy,
    query,
    where
} from "./firebase-sisg.js";

const kpiTotal = document.getElementById("kpiTotal");
const kpiUltimo = document.getElementById("kpiUltimo");
const kpiPotrero = document.getElementById("kpiPotrero");
const kpiRiesgo = document.getElementById("kpiRiesgo");
const tablaPanelBody = document.getElementById("tablaPanelBody");

function obtenerMasFrecuente(lista = [], campo = "") {
    const contador = {};

    lista.forEach(item => {
        const valor = item?.[campo]?.toString().trim() || "Sin dato";
        contador[valor] = (contador[valor] || 0) + 1;
    });

    let maxValor = "Sin datos";
    let maxCantidad = 0;

    for (const key in contador) {
        if (contador[key] > maxCantidad) {
            maxCantidad = contador[key];
            maxValor = key;
        }
    }

    return maxValor;
}

function calcularNivelRiesgo(total) {
    if (total >= 20) return "Crítico";
    if (total >= 10) return "Alto";
    if (total >= 5) return "Medio";
    return "Bajo";
}

function formatearFecha(valor) {
    if (!valor) return "Sin fecha";

    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return valor;

    return fecha.toLocaleDateString("es-AR");
}

function renderTabla(registros) {
    if (!tablaPanelBody) return;

    if (!registros.length) {
        tablaPanelBody.innerHTML = `
      <tr>
        <td colspan="5">No hay incidencias registradas todavía.</td>
      </tr>
    `;
        return;
    }

    const ultimos = registros.slice(0, 5);

    tablaPanelBody.innerHTML = ultimos.map(item => `
    <tr>
      <td>${formatearFecha(item.fecha)}</td>
      <td>${item.potrero || "Sin dato"}</td>
      <td>${item.tipo || "Sin dato"}</td>
      <td>${item.guardia || "Sin dato"}</td>
      <td>${item.cantidad || 0}</td>
    </tr>
  `).join("");
}

async function cargarPanel(user) {
    try {
        const ref = collection(db, "seguridad_ganadera_incidencias");
        const q = query(
            ref,
            where("productorId", "==", user.uid),
            orderBy("fecha", "desc")
        );

        const snapshot = await getDocs(q);

        const registros = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        kpiTotal.textContent = registros.length;

        const ultimo = registros[0];
        kpiUltimo.textContent = ultimo
            ? `${ultimo.tipo || "Evento"} - ${formatearFecha(ultimo.fecha)}`
            : "Sin datos";

        kpiPotrero.textContent = obtenerMasFrecuente(registros, "potrero");
        kpiRiesgo.textContent = calcularNivelRiesgo(registros.length);

        renderTabla(registros);
    } catch (error) {
        console.error("Error al cargar panel:", error);

        if (tablaPanelBody) {
            tablaPanelBody.innerHTML = `
        <tr>
          <td colspan="5">Error al cargar los datos del panel.</td>
        </tr>
      `;
        }
    }
}

onAuthStateChanged(auth, user => {
    if (!user) {
        if (tablaPanelBody) {
            tablaPanelBody.innerHTML = `
        <tr>
          <td colspan="5">Debés iniciar sesión para ver el panel.</td>
        </tr>
      `;
        }
        return;
    }

    cargarPanel(user);
});