// Mobile nav toggle.
(function () {
  var toggle = document.querySelector('.site-nav__toggle');
  var list = document.getElementById('site-nav-list');
  if (!toggle || !list) return;

  function set(open) {
    toggle.setAttribute('aria-expanded', String(open));
    list.classList.toggle('is-open', open);
  }

  toggle.addEventListener('click', function () {
    set(toggle.getAttribute('aria-expanded') !== 'true');
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      set(false);
      toggle.focus();
    }
  });
  list.addEventListener('click', function (e) {
    if (e.target.closest('a')) set(false);
  });
})();
