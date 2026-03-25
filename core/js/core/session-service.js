// Servicio base para futura unificación de sesión.
export const sessionKeys = Object.freeze({
  productorId: "productorId",
  productorEmail: "productorEmail",
  empleadoDni: "empleadoDni"
});

export function getSessionValue(key) {
  return localStorage.getItem(key) || sessionStorage.getItem(key) || "";
}
