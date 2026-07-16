import { sendEvent } from "./intake.js";

function track(name) {
  void sendEvent(name);
}

const menuButton = document.querySelector("[data-menu-button]");
const menuLabel = document.querySelector("[data-menu-label]");
const mobileNav = document.querySelector("[data-mobile-nav]");
const templateCopyButton = document.querySelector("[data-copy-template]");
const templateCopyStatus = document.querySelector("[data-template-copy-status]");
const templateDetails = document.querySelector("[data-template-details]");
const templateText = document.querySelector("#six-beat-template");
const briefCopyButton = document.querySelector("[data-copy-brief]");
const briefCopyStatus = document.querySelector("[data-brief-copy-status]");
const brief = document.querySelector("#maintainer-brief");

function setMenuOpen(open) {
  if (!menuButton || !mobileNav) return;
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  mobileNav.hidden = !open;
  if (menuLabel) menuLabel.textContent = open ? "Close" : "Menu";
}

async function copyText({ button, status, source, successMessage, resetLabel, manualCopyMessage, reveal }) {
  if (!button || !status || !source) return;

  const text = source.value;
  let copied = false;
  try {
    await navigator.clipboard.writeText(text);
    copied = true;
  } catch {
    reveal?.();
    try {
      source.focus();
      source.select();
      copied = document.execCommand("copy") === true;
    } catch {
      copied = false;
    }
  }

  if (!copied) {
    status.textContent = manualCopyMessage;
    return;
  }

  track("brief_copied");
  button.focus();
  button.textContent = "Copied";
  status.textContent = successMessage;
  window.setTimeout(() => {
    button.textContent = resetLabel;
  }, 2400);
}

track("page_viewed");

menuButton?.addEventListener("click", () => {
  setMenuOpen(menuButton.getAttribute("aria-expanded") !== "true");
});

templateCopyButton?.addEventListener("click", () => {
  void copyText({
    button: templateCopyButton,
    status: templateCopyStatus,
    source: templateText,
    successMessage: "Six-beat template copied. Replace every bracketed field before using it.",
    resetLabel: "Copy the six-beat template",
    manualCopyMessage: "Copy was blocked. The plain-text template is selected; use your device's copy command.",
    reveal: () => {
      if (templateDetails) templateDetails.open = true;
    },
  });
});

briefCopyButton?.addEventListener("click", () => {
  void copyText({
    button: briefCopyButton,
    status: briefCopyStatus,
    source: brief,
    successMessage: "Brief copied. Review every field before sharing it.",
    resetLabel: "Copy the maintainer brief",
    manualCopyMessage: "Copy was blocked. The brief is selected; use your device's copy command.",
  });
});

document.addEventListener("click", (event) => {
  const trackedLink = event.target.closest("[data-track]");
  if (trackedLink) track(trackedLink.dataset.track);
  if (event.target.closest("[data-mobile-nav] a")) setMenuOpen(false);
});

window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || menuButton?.getAttribute("aria-expanded") !== "true") return;
  setMenuOpen(false);
  menuButton.focus();
});
