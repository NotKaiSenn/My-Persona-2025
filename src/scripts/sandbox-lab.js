(() => {
  let activePlot = null;
  let dispose = null;

  function reset() {
    dispose?.();
    dispose = null;
    activePlot = null;
  }

  function initialize() {
    const plot = document.getElementById("plot");
    const crop = document.getElementById("crop");
    const hint = document.getElementById("hint");
    if (plot && plot === activePlot) return;
    reset();
    if (!plot || !crop || !hint) return;
    activePlot = plot;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pendingHarvests = new Set();
    const stages = [
      { symbol: "🌱", hint: "点击耕地，给作物浇水催熟。", action: "给作物浇水" },
      { symbol: "🌿", hint: "再浇点水...", action: "给作物浇水" },
      { symbol: "🌾", hint: "麦子熟了，快收割它！", action: "收割麦子" },
    ];
    let stage = 0;

    function render(message = stages[stage].hint) {
      crop.textContent = stages[stage].symbol;
      hint.textContent = message;
      plot.setAttribute("aria-label", stages[stage].action);
    }

    function showHarvest() {
      if (motionQuery.matches) return;

      const drop = document.createElement("span");
      drop.className = "item-drop";
      drop.textContent = stages[stages.length - 1].symbol;
      drop.setAttribute("aria-hidden", "true");
      plot.appendChild(drop);

      // Resetting the crop must not remove the harvest animation.
      // Also clean up when CSS animations are unavailable or canceled.
      function finish() {
        window.clearTimeout(timeout);
        drop.removeEventListener("animationend", finish);
        drop.remove();
        pendingHarvests.delete(finish);
      }
      const timeout = window.setTimeout(finish, 1200);
      pendingHarvests.add(finish);
      drop.addEventListener("animationend", finish, { once: true });
    }

    function waterOrHarvest() {
      const harvested = stage === stages.length - 1;
      if (harvested) showHarvest();
      stage = harvested ? 0 : stage + 1;
      render(harvested ? "收割成功，新种子已播下。" : undefined);
    }

    plot.addEventListener("click", waterOrHarvest);
    dispose = () => {
      plot.removeEventListener("click", waterOrHarvest);
      for (const finish of pendingHarvests) finish();
    };
    render();
  }

  document.addEventListener("astro:before-swap", reset);
  document.addEventListener("astro:page-load", initialize);
  initialize();
})();
