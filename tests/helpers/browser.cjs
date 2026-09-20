const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");

class Element extends EventTarget {
  style = new Map();
  attributes = new Map();
  children = [];
  classList = new Set();

  constructor() {
    super();
    this.style.setProperty = this.style.set.bind(this.style);
    this.style.removeProperty = this.style.delete.bind(this.style);
    this.classList.toggle = (name, enabled) => {
      if (enabled) this.classList.add(name);
      else this.classList.delete(name);
    };
  }

  set textContent(value) {
    this.text = value;
    this.children.forEach((child) => { child.parent = null; });
    this.children = [];
  }

  get textContent() { return this.text; }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 200, height: 100 }; }

  appendChild(child) {
    child.parent = this;
    this.children.push(child);
  }

  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = null;
  }
}

function createBrowser({ reducedMotion = false, ids = ["plot", "crop", "hint"] } = {}) {
  const root = new Element();
  const card = new Element();
  const elements = Object.fromEntries(ids.map((id) => [id, new Element()]));
  const frames = new Map();
  const timers = new Map();
  const motion = new EventTarget();
  motion.matches = reducedMotion;
  let now = 0;
  let id = 0;

  const window = Object.assign(new EventTarget(), {
    innerHeight: 1000,
    scrollY: 0,
    matchMedia: () => motion,
    requestAnimationFrame(callback) { frames.set(++id, callback); return id; },
    cancelAnimationFrame(frameId) { frames.delete(frameId); },
    setTimeout(callback) { timers.set(++id, callback); return id; },
    clearTimeout(timerId) { timers.delete(timerId); },
  });
  const document = {
    documentElement: root,
    querySelectorAll: () => [card],
    getElementById: (name) => elements[name] ?? null,
    createElement: () => new Element(),
  };

  return {
    root, card, elements, frames, timers, window,
    run(script) {
      runInNewContext(readFileSync(join(__dirname, "../../assets/js", script), "utf8"), {
        window, document, performance: { now: () => now },
      }, { filename: script });
    },
    emit(target, type, values = {}) {
      target.dispatchEvent(Object.assign(new Event(type), values));
    },
    setReducedMotion(value) {
      motion.matches = value;
      motion.dispatchEvent(new Event("change"));
    },
    tick() {
      now += 16;
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((callback) => callback(now));
    },
    finishFrames() {
      for (let i = 0; frames.size && i < 500; i += 1) this.tick();
      if (frames.size) throw new Error("Animation did not settle");
    },
    finishTimers() {
      const callbacks = [...timers.values()];
      timers.clear();
      callbacks.forEach((callback) => callback());
    },
  };
}

module.exports = { createBrowser };
