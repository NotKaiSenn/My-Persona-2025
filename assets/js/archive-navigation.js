(() => {
  const root = document.documentElement;

  function archiveTarget(hash) {
    try {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      return target?.matches(".archive-card") ? target : null;
    } catch {
      return null;
    }
  }

  function prepareTarget(hash) {
    const target = archiveTarget(hash);
    const wasRevealed = root.classList.contains("has-archive-target");
    if (!target) {
      root.classList.remove("has-archive-target");
      return null;
    }
    if (wasRevealed) return null;

    // Finish the reveal before native fragment navigation measures its target.
    root.classList.add("has-archive-target", "is-positioning-archive");
    target.getBoundingClientRect();
    root.classList.remove("is-positioning-archive");
    return target;
  }

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.("a[href]");
    if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
    const destination = new URL(link.href, window.location.href);
    const current = window.location;
    if (destination.origin !== current.origin || destination.pathname !== current.pathname || destination.search !== current.search) return;
    if (archiveTarget(destination.hash)) prepareTarget(destination.hash);
    // Keep the browser's hash, history, focus, and scroll-margin behavior.
  });

  function restoreTarget() {
    const target = prepareTarget(window.location.hash);
    // Direct links and history can be restored before our layout has settled.
    // "auto" follows CSS scroll-behavior, including reduced-motion preferences.
    target?.scrollIntoView({ block: "start", behavior: "auto" });
  }

  window.addEventListener("hashchange", restoreTarget);
  restoreTarget();
})();
