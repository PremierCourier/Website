// Hero sequence: the cooler opens into its layers and closes again as the page scrolls.
//
// Frame index is a pure function of scroll offset: scrolling through the hero plays the
// frames open (0 → last) and back closed (last → 0). While it plays, the cooler drifts down
// through the space reserved under it in CSS at 75% of scroll speed, so it stays in view.
// Scroll is never pinned, snapped, or slowed.
//
// Desktop (≥1024 px wide) scrubs 72 frames; smaller screens scrub 24. Frames load after
// the page has loaded and only once the hero is in view, every fourth frame first so
// scrubbing works at once, and are decoded off the main thread. AVIF, falling back to
// WebP. The inlined poster (frame 0) shows until then, and stays alone under reduced
// motion or Save-Data.
(function () {
  var el = document.querySelector('[data-sequence]');
  if (!el) return;
  var stage = el.parentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = navigator.connection && navigator.connection.saveData;
  if (reduce || saveData || !window.HTMLCanvasElement) {
    stage.style.paddingBottom = '0px';
    return;
  }

  var DRIFT = 0.75;   // share of scroll the cooler drifts down while the sequence plays
  var canvas = el.querySelector('canvas');
  var ctx = canvas.getContext('2d');
  var set = window.innerWidth >= 1024 ? 'desktop' : 'mobile';
  var N = Number(el.dataset[set + 'Frames']);
  var dir = el.dataset.path + '/' + set + '/';
  var ext = '.avif';
  var frames = new Array(N);
  var drawn = null;
  var raf = 0;
  var geometry = null;

  function measure() {
    var travel = parseFloat(getComputedStyle(stage).paddingBottom) || 0;
    var rect = el.getBoundingClientRect();
    var top = rect.top + window.scrollY - (parseFloat(getComputedStyle(el).getPropertyValue('--drift')) || 0);
    var vh = window.innerHeight;
    geometry = {
      // Start when the cooler's top reaches 60% of the viewport (at load on desktop).
      start: Math.max(0, top - vh * 0.6),
      span: travel / DRIFT,
      travel: travel,
    };
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    drawn = null;
  }

  function nearest(i) {
    for (var d = 0; d < N; d++) {
      if (frames[i + d]) return frames[i + d];
      if (frames[i - d]) return frames[i - d];
    }
    return null;
  }

  function render() {
    raf = 0;
    if (!geometry) return;
    var scrolled = Math.min(Math.max(window.scrollY - geometry.start, 0), geometry.span);
    var t = geometry.span ? scrolled / geometry.span : 0;          // 0 → 1 through the hero
    var open = Math.sin(Math.PI * t);                              // closed → open → closed
    el.style.setProperty('--drift', (scrolled * DRIFT).toFixed(1) + 'px');
    var img = nearest(Math.round(open * (N - 1)));
    if (img && img !== drawn) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      drawn = img;
    }
  }

  function schedule() { if (!raf) raf = requestAnimationFrame(render); }

  // Frames are decoded off the main thread with createImageBitmap, already scaled to the
  // canvas's pixel size, so drawing one is a cheap copy. (Decoding <img> frames and drawing
  // them lets the browser discard and re-decode on every draw — that froze the page.)
  // Browsers without createImageBitmap resize options get a full-size bitmap instead.
  var bitmapOptions = null;

  function toBitmap(blob) {
    if (!window.createImageBitmap) return decodeWithImage(blob);
    if (bitmapOptions === false) return createImageBitmap(blob);
    return createImageBitmap(blob, bitmapOptions).catch(function (e) {
      if (bitmapOptions && e && e.name === 'TypeError') {
        bitmapOptions = false;
        return createImageBitmap(blob);
      }
      throw e;
    });
  }

  function decodeWithImage(blob) {
    var img = new Image();
    var url = URL.createObjectURL(blob);
    img.src = url;
    return img.decode().then(function () { URL.revokeObjectURL(url); return img; });
  }

  function load(i) {
    return fetch(dir + String(i).padStart(3, '0') + ext)
      .then(function (res) {
        if (!res.ok) throw new Error(res.status);
        return res.blob();
      })
      .then(toBitmap)
      .then(function (bitmap) { frames[i] = bitmap; });
  }

  function loadAll() {
    bitmapOptions = { resizeWidth: canvas.width, resizeHeight: canvas.height, resizeQuality: 'high' };
    // Frame 0 decides the format: AVIF if it decodes, otherwise WebP.
    load(0)
      .catch(function () { ext = '.webp'; return load(0); })
      .then(function () {
        el.classList.add('is-live');
        drawn = null;
        schedule();
        var order = [];
        for (var i = 4; i < N; i += 4) order.push(i);
        order.push(N - 1);
        for (var j = 1; j < N; j++) if (order.indexOf(j) < 0) order.push(j);
        // Four requests in flight at a time.
        var next = 0;
        function worker() {
          if (next >= order.length) return Promise.resolve();
          var k = order[next++];
          return load(k).catch(function () {}).then(function () { schedule(); return worker(); });
        }
        return Promise.all([worker(), worker(), worker(), worker()]);
      })
      .catch(function () { /* neither format decodes: the poster stays */ });
  }

  measure();
  render();
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', function () { measure(); schedule(); });

  function whenInView() {
    if (!('IntersectionObserver' in window)) return loadAll();
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        io.disconnect();
        loadAll();
      }
    }, { rootMargin: '200px 0px' });
    io.observe(el);
  }
  function afterLoad() {
    if ('requestIdleCallback' in window) requestIdleCallback(whenInView, { timeout: 1500 });
    else setTimeout(whenInView, 200);
  }
  if (document.readyState === 'complete') afterLoad();
  else window.addEventListener('load', afterLoad, { once: true });
})();
