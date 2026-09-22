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

test("repeated page-load events preserve the current crop and bind only one action", () => {
  const browser = createBrowser();
  browser.run("sandbox-lab.js");
  click(browser);
  browser.emit(browser.document, "astro:page-load");
  browser.emit(browser.document, "astro:page-load");
  assert.equal(browser.elements.crop.textContent, "🌿");
  click(browser);
  assert.equal(browser.elements.crop.textContent, "🌾");
  assert.equal(browser.timers.size, 0);
});

test("leaving the lab cleans pending harvests and returning binds the new page", () => {
  const browser = createBrowser();
  browser.run("sandbox-lab.js");
  click(browser, 7);
  const oldPlot = browser.elements.plot;
  const oldCrop = browser.elements.crop;
  assert.equal(oldPlot.children.length, 2);
  assert.equal(browser.timers.size, 2);

  browser.emit(browser.document, "astro:before-swap");
  assert.equal(oldPlot.children.length, 0);
  assert.equal(browser.timers.size, 0);
  browser.emit(oldPlot, "click");
  assert.equal(oldCrop.textContent, "🌿");

  browser.replacePage([]);
  browser.emit(browser.document, "astro:page-load");
  browser.emit(browser.document, "astro:before-swap");
  browser.replacePage();
  browser.emit(browser.document, "astro:page-load");
  assert.equal(browser.elements.crop.textContent, "🌱");
  click(browser, 3);
  assert.equal(browser.elements.crop.textContent, "🌱");
  assert.equal(browser.elements.plot.children.length, 1);
  browser.finishTimers();
  assert.equal(browser.elements.plot.children.length, 0);
});

test("a script loaded without lab markup initializes on a later page-load", () => {
  const browser = createBrowser({ ids: [] });
  browser.run("sandbox-lab.js");
  browser.replacePage();
  browser.emit(browser.document, "astro:page-load");
  browser.setReducedMotion(true);
  click(browser, 3);
  assert.equal(browser.elements.hint.textContent, "收割成功，新种子已播下。");
  assert.equal(browser.elements.plot.children.length, 0);
  assert.equal(browser.timers.size, 0);
});
