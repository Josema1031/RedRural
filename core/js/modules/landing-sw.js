if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./core/service-worker.js")
      .then(() => console.log("✅ SW registrado"))
      .catch((e) => console.warn("❌ SW error:", e));
  });
}
