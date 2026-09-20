(() => {
  const shell = document.querySelector(".nav-shell");
  if (!shell) return;

  const topThreshold = 96;
  const directionThreshold = 12;
  let lastY = Math.max(0, window.scrollY);
  let distance = 0;
  let shouldHide = lastY > topThreshold;
  let pointerInside = false;
  let hasFocus = shell.contains(document.activeElement);
  let zone = shell.getBoundingClientRect();

  function render() {
    shell.classList.toggle("is-hidden", shouldHide && !pointerInside && !hasFocus);
  }

  window.addEventListener("scroll", () => {
    const y = Math.max(0, window.scrollY);
    const delta = y - lastY;
    lastY = y;

    if (y <= topThreshold) {
      shouldHide = false;
      distance = 0;
    } else if (delta !== 0) {
      // Accumulate intentional movement so tiny scroll reversals do not flicker.
      distance = Math.sign(delta) === Math.sign(distance) ? distance + delta : delta;
      if (Math.abs(distance) >= directionThreshold) {
        shouldHide = distance > 0;
        distance = 0;
      }
    }
    render();
  }, { passive: true });

  // Observe the original header area without an invisible layer blocking links.
  document.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    const inside = event.clientX >= zone.left && event.clientX <= zone.right
      && event.clientY >= zone.top && event.clientY <= zone.bottom;
    if (inside === pointerInside) return;
    pointerInside = inside;
    render();
  }, { passive: true });

  function clearPointer() {
    pointerInside = false;
    render();
  }

  document.addEventListener("pointerleave", clearPointer);
  window.addEventListener("blur", clearPointer);
  window.addEventListener("resize", () => {
    zone = shell.getBoundingClientRect();
    clearPointer();
  });

  shell.addEventListener("focusin", () => {
    hasFocus = true;
    render();
  });
  shell.addEventListener("focusout", (event) => {
    hasFocus = shell.contains(event.relatedTarget);
    render();
  });

  window.addEventListener("pageshow", () => {
    lastY = Math.max(0, window.scrollY);
    distance = 0;
    shouldHide = lastY > topThreshold;
    zone = shell.getBoundingClientRect();
    render();
  });

  render();
})();
