import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BriefDialog } from "./App.jsx";
import { sendEvent } from "./intake.js";

const BASE_URL = import.meta.env.BASE_URL;

function track(name) {
  void sendEvent(name);
}

export function ComparisonEnhancements() {
  const [briefOpen, setBriefOpen] = useState(false);
  const briefTriggerRef = useRef(null);

  useEffect(() => {
    track("page_viewed");
  }, []);

  useEffect(() => {
    const menuButton = document.querySelector("[data-menu-button]");
    const menuLabel = document.querySelector("[data-menu-label]");
    const mobileNav = document.querySelector("[data-mobile-nav]");

    const setMenuOpen = (open) => {
      if (!menuButton || !mobileNav) return;
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
      mobileNav.hidden = !open;
      if (menuLabel) menuLabel.textContent = open ? "Close" : "Menu";
    };
    const onMenuClick = () => setMenuOpen(menuButton?.getAttribute("aria-expanded") !== "true");
    const onDocumentClick = (event) => {
      const openBriefButton = event.target.closest("[data-open-brief]");
      if (openBriefButton) {
        event.preventDefault();
        briefTriggerRef.current = openBriefButton;
        track("brief_opened");
        setMenuOpen(false);
        setBriefOpen(true);
        return;
      }

      const trackedLink = event.target.closest("[data-track]");
      if (trackedLink) track(trackedLink.dataset.track);
      const mobileNavLink = event.target.closest("[data-mobile-nav] a");
      if (mobileNavLink) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key !== "Escape" || menuButton?.getAttribute("aria-expanded") !== "true") return;
      setMenuOpen(false);
      queueMicrotask(() => menuButton?.focus({ preventScroll: true }));
    };

    menuButton?.addEventListener("click", onMenuClick);
    document.addEventListener("click", onDocumentClick);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      menuButton?.removeEventListener("click", onMenuClick);
      document.removeEventListener("click", onDocumentClick);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    const regions = document.querySelectorAll("[data-modal-region]");
    regions.forEach((region) => {
      region.inert = briefOpen;
      if (briefOpen) region.setAttribute("aria-hidden", "true");
      else region.removeAttribute("aria-hidden");
    });
    return () => {
      regions.forEach((region) => {
        region.inert = false;
        region.removeAttribute("aria-hidden");
      });
    };
  }, [briefOpen]);

  if (!briefOpen) return null;
  return (
    <BriefDialog
      onClose={() => setBriefOpen(false)}
      restoreFocusTo={briefTriggerRef.current}
      privacyHref={`${BASE_URL}#privacy`}
    />
  );
}

createRoot(document.getElementById("comparison-enhancements")).render(
  <StrictMode>
    <ComparisonEnhancements />
  </StrictMode>,
);
