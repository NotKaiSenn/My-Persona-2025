const root = document.documentElement;
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

let current = 0;
let target = 0;
let running = false;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function measure() {
  const range = Math.max(window.innerHeight * 0.74, 1);
  target = clamp(window.scrollY / range, 0, 1);
}

function frame() {
  current += (target - current) * 0.1;

  if (Math.abs(target - current) < 0.001) {
    current = target;
  }

  root.style.setProperty("--p", current.toFixed(3));

  if (current !== target) {
    window.requestAnimationFrame(frame);
    return;
  }

  running = false;
}

function schedule() {
  measure();
  if (running) return;
  running = true;
  window.requestAnimationFrame(frame);
}

measure();
current = target;
root.style.setProperty("--p", current.toFixed(3));

if (motionQuery.matches) {
  root.style.setProperty("--intro", "1");
} else {
  const introDuration = 4200;
  const introStart = performance.now();
  const easeIntro = (value) => 1 - Math.pow(1 - value, 3);

  function introFrame(now) {
    const progress = clamp((now - introStart) / introDuration, 0, 1);
    root.style.setProperty("--intro", easeIntro(progress).toFixed(3));

    if (progress < 1) {
      window.requestAnimationFrame(introFrame);
    }
  }

  window.requestAnimationFrame(introFrame);
}

window.addEventListener("scroll", schedule, { passive: true });
window.addEventListener("resize", schedule);

if (!motionQuery.matches) {
  document.querySelectorAll(".archive-card").forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;

      card.style.setProperty("--float-x", `${(x * 7).toFixed(2)}px`);
      card.style.setProperty("--float-y", `${(y * 5).toFixed(2)}px`);
      card.style.setProperty("--turn", `${(x * 0.55).toFixed(2)}deg`);
    });

    card.addEventListener("pointerleave", () => {
      card.style.setProperty("--float-x", "0px");
      card.style.setProperty("--float-y", "0px");
      card.style.setProperty("--turn", "0deg");
    });
  });
}
