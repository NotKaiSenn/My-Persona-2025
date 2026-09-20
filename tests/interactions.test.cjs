const test = require("node:test");
const assert = require("node:assert/strict");
const { createBrowser } = require("./helpers/browser.cjs");

function click(browser, times = 1) {
  for (let i = 0; i < times; i += 1) browser.emit(browser.elements.plot, "click");
}

test("crop cycles through watering, harvest, and replanting without deleting the drop", () => {
  const browser = createBrowser();
  browser.run("sandbox-lab.js");
  const { plot, crop, hint } = browser.elements;
  assert.equal(crop.textContent, "🌱");
  click(browser);
  assert.equal(crop.textContent, "🌿");
  click(browser);
  assert.equal(crop.textContent, "🌾");
  assert.equal(plot.attributes.get("aria-label"), "收割麦子");
  click(browser);
  assert.equal(crop.textContent, "🌱");
  assert.equal(hint.textContent, "收割成功，新种子已播下。");
  assert.equal(plot.attributes.get("aria-label"), "给作物浇水");
  assert.equal(plot.children.length, 1);
  browser.emit(plot.children[0], "animationend");
  assert.equal(plot.children.length, 0);
  assert.equal(browser.timers.size, 0);
});

test("rapid harvests clean up independently, including missing animation events", () => {
  const browser = createBrowser();
  browser.run("sandbox-lab.js");
  click(browser, 6);
  assert.equal(browser.elements.plot.children.length, 2);
  browser.emit(browser.elements.plot.children[0], "animationend");
  assert.equal(browser.elements.plot.children.length, 1);
  browser.finishTimers();
  assert.equal(browser.elements.plot.children.length, 0);
});

test("harvesting respects current reduced-motion preference without changing the game", () => {
  const browser = createBrowser();
  browser.run("sandbox-lab.js");
  browser.setReducedMotion(true);
  click(browser, 3);
  assert.equal(browser.elements.crop.textContent, "🌱");
  assert.equal(browser.elements.plot.children.length, 0);
  assert.equal(browser.timers.size, 0);
});

test("sandbox initialization safely skips incomplete markup", () => {
  const browser = createBrowser({ ids: ["plot"] });
  assert.doesNotThrow(() => browser.run("sandbox-lab.js"));
});

test("scroll updates coalesce, clamp to the page range, and stop when settled", () => {
  const browser = createBrowser();
  browser.run("living-archive.js");
  browser.window.scrollY = 10000;
  for (let i = 0; i < 100; i += 1) browser.emit(browser.window, "scroll");
  assert.ok(browser.frames.size <= 2, "only intro and scroll frames may be scheduled");
  browser.finishFrames();
  assert.equal(browser.root.style.get("--p"), "1.000");
  assert.equal(browser.root.style.get("--intro"), "1.000");
  browser.window.scrollY = -20;
  browser.emit(browser.window, "scroll");
  browser.finishFrames();
  assert.equal(browser.root.style.get("--p"), "0.000");
});

test("resizing recomputes progress and initial scroll position is restored", () => {
  const browser = createBrowser();
  browser.window.scrollY = 370;
  browser.run("living-archive.js");
  assert.equal(browser.root.style.get("--p"), "0.500");
  browser.window.innerHeight = 500;
  browser.emit(browser.window, "resize");
  browser.finishFrames();
  assert.equal(browser.root.style.get("--p"), "1.000");
});

test("motion preference changes cancel frames and reset card offsets immediately", () => {
  const browser = createBrowser();
  browser.run("living-archive.js");
  browser.emit(browser.card, "pointermove", { pointerType: "mouse", clientX: 180, clientY: 75 });
  assert.ok(browser.card.style.has("--float-x"));
  browser.setReducedMotion(true);
  assert.equal(browser.frames.size, 0);
  assert.equal(browser.root.classList.has("has-motion"), false);
  assert.equal(browser.card.style.has("--float-x"), false);
  assert.equal(browser.root.style.get("--intro"), "1");
  browser.emit(browser.window, "scroll");
  browser.emit(browser.card, "pointermove", { clientX: 180, clientY: 75 });
  assert.equal(browser.frames.size, 0);
  assert.equal(browser.card.style.has("--float-x"), false);
  browser.setReducedMotion(false);
  assert.equal(browser.root.classList.has("has-motion"), true);
  assert.equal(browser.frames.size, 0, "changing preference should not replay the intro");
  browser.emit(browser.card, "pointermove", { pointerType: "touch", clientX: 180, clientY: 75 });
  assert.equal(browser.card.style.has("--float-x"), false);
  browser.emit(browser.card, "pointermove", { pointerType: "mouse", clientX: 180, clientY: 75 });
  browser.emit(browser.card, "pointercancel");
  assert.equal(browser.card.style.has("--float-x"), false);
});

test("reduced-motion startup schedules no animation work", () => {
  const browser = createBrowser({ reducedMotion: true });
  browser.run("living-archive.js");
  assert.equal(browser.frames.size, 0);
  assert.equal(browser.root.classList.has("has-motion"), false);
  browser.emit(browser.window, "scroll");
  assert.equal(browser.frames.size, 0);
});
