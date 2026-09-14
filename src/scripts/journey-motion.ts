const visuals = [...document.querySelectorAll<HTMLElement>('[data-journey-visual]')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const visible = new Set<HTMLElement>();
const paused = new Set<HTMLElement>();

function syncMotion() {
  for (const visual of visuals) {
    visual.dataset.running = String(visible.has(visual) && !paused.has(visual) && !document.hidden && !reducedMotion.matches);
    const button = visual.querySelector<HTMLButtonElement>('[data-motion-toggle]')!;
    const label = visual.getAttribute('aria-label');
    button.disabled = reducedMotion.matches;
    button.textContent = reducedMotion.matches ? '静态展示' : paused.has(visual) ? '播放 ▶' : '暂停 Ⅱ';
    button.setAttribute('aria-pressed', String(paused.has(visual)));
    button.setAttribute('aria-label', reducedMotion.matches ? `${label}静态展示` : `${paused.has(visual) ? '播放' : '暂停'}${label}动画`);
  }
}
const observer = new IntersectionObserver(entries => {
  for (const entry of entries) {
    const visual = entry.target as HTMLElement;
    if (entry.isIntersecting) visible.add(visual); else visible.delete(visual);
  }
  syncMotion();
}, { threshold: 0 });
for (const visual of visuals) {
  const button = visual.querySelector<HTMLButtonElement>('[data-motion-toggle]')!;
  button.hidden = false;
  button.addEventListener('click', () => {
    if (paused.has(visual)) paused.delete(visual); else paused.add(visual);
    syncMotion();
  });
  observer.observe(visual);
}
reducedMotion.addEventListener('change', syncMotion);
document.addEventListener('visibilitychange', syncMotion);
syncMotion();
