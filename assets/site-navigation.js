"use strict";
(() => {
  const header = document.querySelector(".site-header");
  const nav = header?.querySelector(".main-nav");
  const toggle = header?.querySelector(".menu-toggle");
  if (!nav || !toggle) return;
  const setOpen = (open) => {
    nav.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "关闭菜单" : "打开菜单");
  };
  toggle.addEventListener("click", () =>
    setOpen(!nav.classList.contains("open")),
  );
  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && nav.classList.contains("open")) {
      setOpen(false);
      toggle.focus();
    }
  });
  document.addEventListener("click", (event) => {
    if (!header.contains(event.target)) setOpen(false);
  });
  const desktop = matchMedia("(min-width: 1101px)");
  desktop.addEventListener("change", () => setOpen(false));
  const scrolled = () => header.classList.toggle("scrolled", scrollY > 30);
  addEventListener("scroll", scrolled, { passive: true });
  scrolled();
})();
