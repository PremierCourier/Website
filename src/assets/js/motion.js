// Scroll reveals (once, on entry) and the hero object's idle turn + pointer parallax.
// prefers-reduced-motion: everything renders in its final state and nothing moves.
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var reveals = document.querySelectorAll('.reveal');

  if (!reduce && 'IntersectionObserver' in window) {
    // Reveal: fade/translate in once, on entry.
    var show = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          show.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });

    // Arm: dim an element while it is still just below the fold. Nothing is armed until the
    // visitor first scrolls, so a page that is only loaded (audits, crawlers, print) never dims,
    // and elements already on screen are never dimmed.
    var arm = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        arm.unobserve(entry.target);
        if (entry.boundingClientRect.top < window.innerHeight) return;
        entry.target.classList.add('is-armed');
        show.observe(entry.target);
      });
    }, { rootMargin: '0px 0px 50% 0px' });
    window.addEventListener('scroll', function () {
      reveals.forEach(function (el) { arm.observe(el); });
    }, { once: true, passive: true });
  }

  var stage = document.querySelector('[data-parallax]');
  if (!stage || reduce) return;

  var desktop = window.matchMedia('(min-width: 1024px) and (pointer: fine)');
  var MAX = 3;          // degrees of pointer tilt (a still reads as flat past ~4°)
  var IDLE = 2.5;       // degrees of idle sway; the real turn arrives with WebGL
  var PERIOD = 14000;   // ms per idle cycle
  var target = { x: 0, y: 0 };
  var visible = true;
  var raf = 0;

  function frame(t) {
    raf = 0;
    if (!visible || document.hidden) return;
    var idle = Math.sin((t / PERIOD) * Math.PI * 2) * IDLE;
    stage.style.setProperty('--rx', (target.y * -MAX).toFixed(2) + 'deg');
    stage.style.setProperty('--ry', (idle + target.x * MAX).toFixed(2) + 'deg');
    raf = requestAnimationFrame(frame);
  }
  function start() { if (!raf) raf = requestAnimationFrame(frame); }

  window.addEventListener('pointermove', function (e) {
    if (!desktop.matches) return;
    target.x = (e.clientX / window.innerWidth) * 2 - 1;
    target.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) start();
    }).observe(stage);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) start(); });
  start();
})();
