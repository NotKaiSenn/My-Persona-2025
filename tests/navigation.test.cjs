const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");

function navigation(initialHash = "") {
  const classes = new Set();
  const listeners = {};
  const scrolls = [];
  const measurements = [];
  const root = {
    classList: {
      contains: (name) => classes.has(name),
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
    },
  };
  const cards = Object.fromEntries(["notes", "music"].map((id) => [id, {
    matches: (selector) => selector === ".archive-card",
    getBoundingClientRect() {
      measurements.push({ id, stable: classes.has("has-archive-target") && classes.has("is-positioning-archive") });
      return { top: 104 };
    },
    scrollIntoView(options) { scrolls.push({ id, ...options }); },
  }]));
  const window = {
    location: new URL(`https://example.test/index.html${initialHash}`),
    addEventListener: (name, callback) => { listeners[name] = callback; },
  };
  const document = {
    documentElement: root,
    getElementById: (id) => cards[id] ?? null,
    addEventListener: (name, callback) => { listeners[name] = callback; },
  };
  runInNewContext(readFileSync(join(__dirname, "../assets/js/archive-navigation.js"), "utf8"), {
    window, document, URL,
  });

  return {
    classes, scrolls, measurements,
    click(href, overrides = {}, linkOverrides = {}) {
      const link = {
        href: new URL(href, window.location).href,
        target: "",
        hasAttribute: () => false,
        ...linkOverrides,
      };
      let prevented = false;
      const event = {
        button: 0,
        target: { closest: () => link },
        preventDefault: () => { prevented = true; },
        ...overrides,
      };
      listeners.click(event);
      return prevented;
    },
    hashchange(hash) {
      window.location.hash = hash;
      listeners.hashchange();
    },
  };
}

test("archive links settle before native navigation without replacing history or scrolling twice", () => {
  const browser = navigation();
  assert.equal(browser.click("#notes"), false);
  assert.deepEqual(browser.measurements, [{ id: "notes", stable: true }]);
  assert.equal(browser.classes.has("is-positioning-archive"), false);
  assert.equal(browser.classes.has("has-archive-target"), true);
  assert.equal(browser.scrolls.length, 0);
  browser.hashchange("#notes");
  assert.equal(browser.scrolls.length, 0, "the native click already knows the final target position");
});

test("direct encoded fragments settle and defer scrolling preferences to CSS", () => {
  const browser = navigation("#%6Eotes");
  assert.deepEqual(browser.measurements, [{ id: "notes", stable: true }]);
  assert.deepEqual(browser.scrolls, [{ id: "notes", block: "start", behavior: "auto" }]);
  assert.equal(browser.classes.has("is-positioning-archive"), false);
});

test("history preserves native restoration between archive targets and handles return from the hero", () => {
  const browser = navigation("#notes");
  browser.hashchange("#music");
  assert.equal(browser.scrolls.length, 1, "already stable archive history uses native restoration");
  browser.hashchange("");
  assert.equal(browser.classes.has("has-archive-target"), false);
  browser.hashchange("#music");
  assert.equal(browser.classes.has("has-archive-target"), true);
  assert.deepEqual(browser.scrolls[1], { id: "music", block: "start", behavior: "auto" });
});

test("unrelated, malformed, modified, and new-window links keep their existing behavior", () => {
  const browser = navigation("#%broken");
  for (const href of ["#", "#unknown", "pages/persona-2025.html#notes", "?mode=other#notes", "https://other.test/index.html#notes"]) {
    assert.equal(browser.click(href), false);
  }
  for (const overrides of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { defaultPrevented: true }]) {
    browser.click("#notes", overrides);
  }
  browser.click("#notes", {}, { target: "_blank" });
  browser.click("#notes", {}, { hasAttribute: (name) => name === "download" });
  assert.equal(browser.classes.size, 0);
  assert.equal(browser.measurements.length, 0);
  assert.equal(browser.scrolls.length, 0);
});
