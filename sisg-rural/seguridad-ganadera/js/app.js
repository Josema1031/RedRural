document.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname;

  document.querySelectorAll(".nav a, .landing-nav a, .sisg-nav a").forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#")) return;
    const cleanHref = href.replace(/^\.\.\//, "/");
    if (path.endsWith(href) || path.includes(cleanHref.replace(/^\//, ""))) {
      link.classList.add("active");
    }
  });

  const counters = document.querySelectorAll(".counter");
  counters.forEach((counter) => {
    const target = Number(counter.dataset.target || 0);
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 20));
    const tick = () => {
      current += step;
      if (current >= target) {
        counter.textContent = target;
        return;
      }
      counter.textContent = current;
      requestAnimationFrame(tick);
    };
    tick();
  });

  const filterButtons = document.querySelectorAll(".module-filter");
  const moduleCards = document.querySelectorAll(".module-card");

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;
      filterButtons.forEach((btn) => btn.classList.remove("is-active"));
      button.classList.add("is-active");

      moduleCards.forEach((card) => {
        const category = card.dataset.category;
        const show = filter === "todos" || category === filter;
        card.style.display = show ? "grid" : "none";
      });
    });
  });

  const btnDemo = document.getElementById("btnDemo");
  const mensajeDemo = document.getElementById("mensajeDemo");

  if (btnDemo && mensajeDemo) {
    btnDemo.addEventListener("click", () => {
      mensajeDemo.textContent =
        "SISG Rural está pensado como módulo profesional para integrarse a Red Rural y ofrecer control de incidencias, análisis de potreros, seguimiento de guardias e integración futura con Firebase.";
    });
  }
});
