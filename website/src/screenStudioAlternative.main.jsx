const menuButton = document.querySelector("[data-menu-button]");
const menuLabel = document.querySelector("[data-menu-label]");
const mobileNav = document.querySelector("[data-mobile-nav]");

function setMenuOpen(open) {
  if (!menuButton || !mobileNav) return;
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  mobileNav.hidden = !open;
  if (menuLabel) menuLabel.textContent = open ? "Close" : "Menu";
}

menuButton?.addEventListener("click", () => {
  setMenuOpen(menuButton.getAttribute("aria-expanded") !== "true");
});

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-mobile-nav] a")) setMenuOpen(false);
});

window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || menuButton?.getAttribute("aria-expanded") !== "true") return;
  setMenuOpen(false);
  menuButton.focus();
});
