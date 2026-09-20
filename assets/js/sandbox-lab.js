(() => {
  const plot = document.getElementById("plot");
  const crop = document.getElementById("crop");
  const hint = document.getElementById("hint");
  if (!plot || !crop || !hint) return;

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
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
    const timeout = window.setTimeout(() => drop.remove(), 1200);
    drop.addEventListener("animationend", () => {
      window.clearTimeout(timeout);
      drop.remove();
    }, { once: true });
  }

  plot.addEventListener("click", () => {
    const harvested = stage === stages.length - 1;
    if (harvested) showHarvest();
    stage = harvested ? 0 : stage + 1;
    render(harvested ? "收割成功，新种子已播下。" : undefined);
  });

  render();
})();
