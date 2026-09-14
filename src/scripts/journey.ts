const chapters = [...document.querySelectorAll<HTMLElement>('[data-chapter]')];
const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-chapter-link]')];
let queued = false;
function updateChapter() {
  queued = false;
  const readingLine = innerHeight * 0.38;
  let active = chapters[0];
  for (const chapter of chapters) {
    if (chapter.getBoundingClientRect().top <= readingLine) active = chapter;
  }
  for (const link of links) {
    if (link.dataset.chapterLink === active?.id) link.setAttribute('aria-current', 'step');
    else link.removeAttribute('aria-current');
  }
}
function queueUpdate() {
  if (!queued) { queued = true; requestAnimationFrame(updateChapter); }
}
if (chapters.length) {
  addEventListener('scroll', queueUpdate, { passive: true });
  addEventListener('resize', queueUpdate);
  addEventListener('pageshow', queueUpdate);
  updateChapter();
}
