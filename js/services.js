/* ============================================================
   SERVICES PAGE — the DOM layer of main.js without the engine
   No particles or Lenis here: the page should be quick to load
   for someone who just wants to know what I do and how to ask.
   ============================================================ */

(function () {
  window.__svcBooted = true;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- custom cursor ---------- */

  const cursor = document.getElementById('cursor');
  const ring = document.getElementById('cursorRing');
  const ringPos = { x: innerWidth / 2, y: innerHeight / 2 };
  let cursorRaf = null;

  window.addEventListener('pointermove', (e) => {
    cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%,-50%)`;
    ringPos.tx = e.clientX;
    ringPos.ty = e.clientY;
    if (!cursorRaf) cursorRaf = requestAnimationFrame(ringTick);
  });

  function ringTick() {
    ringPos.x += ((ringPos.tx ?? ringPos.x) - ringPos.x) * 0.18;
    ringPos.y += ((ringPos.ty ?? ringPos.y) - ringPos.y) * 0.18;
    ring.style.transform = `translate(${ringPos.x}px, ${ringPos.y}px) translate(-50%,-50%)`;
    cursorRaf = requestAnimationFrame(ringTick);
  }

  document.querySelectorAll('a, button, .project').forEach((el) => {
    el.addEventListener('pointerenter', () => ring.classList.add('hovering'));
    el.addEventListener('pointerleave', () => ring.classList.remove('hovering'));
  });

  /* ---------- card glow follows mouse ---------- */

  document.querySelectorAll('.project').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      card.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    });
  });

  /* ---------- scroll reveals ---------- */

  const reveals = document.querySelectorAll('.reveal');
  if (reducedMotion || !('IntersectionObserver' in window)) {
    reveals.forEach((el) => el.classList.add('visible'));
    return;
  }
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  reveals.forEach((el) => revealObserver.observe(el));
})();
