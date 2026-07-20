const plot = document.getElementById("plot");
const hint = document.getElementById("hint");

const stages = {
  0: "🌱",
  1: "🌿",
  2: "🌾",
};

plot.addEventListener("click", () => {
  let currentStage = Number.parseInt(plot.dataset.stage, 10);

  if (currentStage < 2) {
    currentStage += 1;
    plot.dataset.stage = currentStage;
    plot.textContent = stages[currentStage];
    hint.textContent = currentStage === 2 ? "麦子熟了，快收割它！" : "再浇点水...";
    return;
  }

  const drop = document.createElement("div");
  drop.className = "item-drop";
  drop.textContent = "🌾";
  plot.appendChild(drop);

  drop.addEventListener("animationend", () => {
    drop.remove();
  });

  plot.dataset.stage = "0";
  plot.textContent = stages[0];
  hint.textContent = "收割成功，新种子已播下。";
});
