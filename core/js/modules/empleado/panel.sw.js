    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("../service-worker.js")
          .then(() => console.log("✅ SW registrado (empleado)"))
          .catch((e) => console.warn("❌ SW error (empleado):", e));
      });
    }


  
