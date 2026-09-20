(() => {
  const root = document.documentElement;
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const cards = document.querySelectorAll(".archive-card");
  const settings = {
    scrollRange: 0.74,
    scrollSmoothing: 0.1,
    scrollPrecision: 0.001,
    introDuration: 4200,
    floatX: 7,
    floatY: 5,
    turn: 0.55,
  };
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  function createScrollProgress() {
    let current = 0;
    let target = 0;
    let frameId = null;

    function measure() {
      const range = Math.max(window.innerHeight * settings.scrollRange, 1);
      target = clamp(window.scrollY / range, 0, 1);
    }

    function render() {
      root.style.setProperty("--p", current.toFixed(3));
    }

    function frame() {
      frameId = null;
      current += (target - current) * settings.scrollSmoothing;
      if (Math.abs(target - current) < settings.scrollPrecision) current = target;
      render();
      if (current !== target) frameId = window.requestAnimationFrame(frame);
    }

    function schedule() {
      measure();
      if (frameId === null && current !== target) {
        frameId = window.requestAnimationFrame(frame);
      }
    }

    return {
      start() {
        measure();
        current = target;
        render();
        window.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("resize", schedule);
      },
      stop() {
        window.removeEventListener("scroll", schedule);
        window.removeEventListener("resize", schedule);
        if (frameId !== null) window.cancelAnimationFrame(frameId);
        frameId = null;
        root.style.removeProperty("--p");
      },
    };
  }

  function createIntro() {
    let frameId = null;
    let startedAt = 0;

    function frame(now) {
      const progress = clamp((now - startedAt) / settings.introDuration, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      root.style.setProperty("--intro", eased.toFixed(3));
      frameId = progress < 1 ? window.requestAnimationFrame(frame) : null;
    }

    return {
      start() {
        root.style.setProperty("--intro", "0");
        startedAt = performance.now();
        frameId = window.requestAnimationFrame(frame);
      },
      stop() {
        if (frameId !== null) window.cancelAnimationFrame(frameId);
        frameId = null;
        root.style.setProperty("--intro", "1");
      },
    };
  }

  function createCardMotion() {
    function move(event) {
      if (event.pointerType === "touch") return;
      const card = event.currentTarget;
      const rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = clamp((event.clientX - rect.left) / rect.width - 0.5, -0.5, 0.5);
      const y = clamp((event.clientY - rect.top) / rect.height - 0.5, -0.5, 0.5);
      card.style.setProperty("--float-x", `${(x * settings.floatX).toFixed(2)}px`);
      card.style.setProperty("--float-y", `${(y * settings.floatY).toFixed(2)}px`);
      card.style.setProperty("--turn", `${(x * settings.turn).toFixed(2)}deg`);
    }

    function reset(card) {
      ["--float-x", "--float-y", "--turn"].forEach((name) => card.style.removeProperty(name));
    }

    function leave(event) {
      reset(event.currentTarget);
    }

    return {
      start() {
        cards.forEach((card) => {
          card.addEventListener("pointermove", move);
          card.addEventListener("pointerleave", leave);
          card.addEventListener("pointercancel", leave);
        });
      },
      stop() {
        cards.forEach((card) => {
          card.removeEventListener("pointermove", move);
          card.removeEventListener("pointerleave", leave);
          card.removeEventListener("pointercancel", leave);
          reset(card);
        });
      },
    };
  }

  const scrollProgress = createScrollProgress();
  const intro = createIntro();
  const cardMotion = createCardMotion();

  function updateMotion(playIntro = false) {
    scrollProgress.stop();
    intro.stop();
    cardMotion.stop();
    root.classList.toggle("has-motion", !motionQuery.matches);
    if (motionQuery.matches) return;

    scrollProgress.start();
    cardMotion.start();
    if (playIntro) intro.start();
  }

  updateMotion(true);
  motionQuery.addEventListener("change", () => updateMotion());
})();
