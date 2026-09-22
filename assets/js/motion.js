// Scroll reveals (once, on entry). The hero cooler's motion lives in hero.js.
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
})();
