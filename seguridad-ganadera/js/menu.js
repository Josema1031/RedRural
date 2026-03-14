document.addEventListener("DOMContentLoaded", () => {
  const esperarMenu = setInterval(() => {
    const menuToggle = document.getElementById("menuToggle");
    const mobileMenu = document.getElementById("mobileMenu");
    const menuClose = document.getElementById("menuClose");
    const menuOverlay = document.getElementById("menuOverlay");
    const menuLinks = document.querySelectorAll(".mobile-menu-nav a");

    if (menuToggle && mobileMenu && menuClose && menuOverlay) {
      clearInterval(esperarMenu);

      function abrirMenu() {
        mobileMenu.classList.add("active");
        menuOverlay.classList.add("active");
        document.body.style.overflow = "hidden";
      }

      function cerrarMenu() {
        mobileMenu.classList.remove("active");
        menuOverlay.classList.remove("active");
        document.body.style.overflow = "";
      }

      menuToggle.addEventListener("click", abrirMenu);
      menuClose.addEventListener("click", cerrarMenu);
      menuOverlay.addEventListener("click", cerrarMenu);

      menuLinks.forEach(link => {
        link.addEventListener("click", cerrarMenu);
      });
    }
  }, 100);
});
