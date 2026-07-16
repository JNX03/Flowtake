import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function createNode({ attributes = {}, value = "" } = {}) {
  const listeners = new Map();
  const state = new Map(Object.entries(attributes));
  return {
    dataset: {},
    hidden: false,
    open: false,
    textContent: "",
    value,
    focusCount: 0,
    selectCount: 0,
    addEventListener(name, listener) {
      listeners.set(name, listener);
    },
    emit(name, event = {}) {
      return listeners.get(name)?.(event);
    },
    focus() {
      this.focusCount += 1;
    },
    getAttribute(name) {
      return state.get(name) ?? null;
    },
    select() {
      this.selectCount += 1;
    },
    setAttribute(name, valueToSet) {
      state.set(name, String(valueToSet));
    },
  };
}

function replaceGlobal(name, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  return () => {
    if (previous) Object.defineProperty(globalThis, name, previous);
    else delete globalThis[name];
  };
}

async function flushAsyncWork() {
  await new Promise((resolve) => globalThis.setImmediate(resolve));
}

test("storyboard copying, blocked fallback, and Escape focus work as promised", async () => {
  const page = await readFile(new URL("../developer-tool-demo-storyboard/index.html", import.meta.url), "utf8");
  const templateMatch = page.match(/<textarea id="six-beat-template"[^>]*>([\s\S]*?)<\/textarea>/u);
  assert.ok(templateMatch, "missing serialized storyboard fixture");

  const menuButton = createNode({ attributes: { "aria-expanded": "false" } });
  const menuLabel = createNode();
  const mobileNav = createNode();
  mobileNav.hidden = true;
  const templateCopyButton = createNode();
  const templateCopyStatus = createNode();
  const templateDetails = createNode();
  const templateText = createNode({ value: templateMatch[1] });
  const briefCopyButton = createNode();
  const briefCopyStatus = createNode();
  const brief = createNode({ value: "Public project URL:\nAudience:" });
  const documentListeners = new Map();
  const windowListeners = new Map();
  const eventNames = [];
  const clipboardWrites = [];
  let blockClipboard = false;

  const nodes = new Map([
    ["[data-menu-button]", menuButton],
    ["[data-menu-label]", menuLabel],
    ["[data-mobile-nav]", mobileNav],
    ["[data-copy-template]", templateCopyButton],
    ["[data-template-copy-status]", templateCopyStatus],
    ["[data-template-details]", templateDetails],
    ["#six-beat-template", templateText],
    ["[data-copy-brief]", briefCopyButton],
    ["[data-brief-copy-status]", briefCopyStatus],
    ["#maintainer-brief", brief],
  ]);

  const restores = [
    replaceGlobal("document", {
      addEventListener(name, listener) {
        documentListeners.set(name, listener);
      },
      execCommand() {
        throw new Error("legacy copy unavailable");
      },
      querySelector(selector) {
        return nodes.get(selector) ?? null;
      },
    }),
    replaceGlobal("window", {
      addEventListener(name, listener) {
        windowListeners.set(name, listener);
      },
      setTimeout() {},
    }),
    replaceGlobal("navigator", {
      clipboard: {
        async writeText(value) {
          if (blockClipboard) throw new Error("clipboard permission denied");
          clipboardWrites.push(value);
        },
      },
    }),
    replaceGlobal("fetch", async (_url, options) => {
      eventNames.push(JSON.parse(options.body).name);
      return { ok: true };
    }),
  ];

  try {
    const moduleUrl = new URL(`./developerToolDemoStoryboard.main.js?test=${Date.now()}`, import.meta.url);
    await import(moduleUrl);
    await flushAsyncWork();

    templateCopyButton.emit("click");
    await flushAsyncWork();
    assert.equal(clipboardWrites[0], templateMatch[1]);
    assert.equal(templateCopyStatus.textContent, "Six-beat template copied. Replace every bracketed field before using it.");
    assert.equal(eventNames.filter((name) => name === "brief_copied").length, 1);

    blockClipboard = true;
    briefCopyButton.emit("click");
    await flushAsyncWork();
    assert.equal(brief.focusCount, 1);
    assert.equal(brief.selectCount, 1);
    assert.equal(briefCopyStatus.textContent, "Copy was blocked. The brief is selected; use your device's copy command.");
    assert.equal(eventNames.filter((name) => name === "brief_copied").length, 1, "blocked copies must not be counted");

    menuButton.emit("click");
    assert.equal(menuButton.getAttribute("aria-expanded"), "true");
    assert.equal(mobileNav.hidden, false);
    windowListeners.get("keydown")({ key: "Escape" });
    assert.equal(menuButton.getAttribute("aria-expanded"), "false");
    assert.equal(mobileNav.hidden, true);
    assert.equal(menuButton.focusCount, 1);

    windowListeners.get("keydown")({ key: "Escape" });
    assert.equal(menuButton.focusCount, 1, "Escape must do nothing while the menu is collapsed");
  } finally {
    for (const restore of restores.reverse()) restore();
  }
});
