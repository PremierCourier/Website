// Hero sequence: the cooler opens into its layers and closes again as the page scrolls.
//
// Frame index and position are pure functions of scroll offset; scrolling itself is never
// pinned, snapped, or slowed.
//   Laptops (≥1024 px): once the headline has scrolled away, the cooler slides to the middle
//   of the screen and grows to fill its height as it opens, then zooms back out and rises
//   as it closes, and scrolls away.
//   Phones: it opens and closes while drifting down at 75% of scroll speed.
// The room it moves through is reserved under the hero, so nothing below is overlapped.
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

  var DRIFT = 0.75;   // phones: share of scroll the cooler drifts down while it plays
  var CENTRE_MARGIN = 24;   // laptops: px kept clear above and below the centred cooler
  var MAX_SCALE = 1.8;      // laptops: never grow past this, however tall the screen
  var CLOSE_RISE = 0.6;     // laptops: while closing, the cooler rises at this share of scroll
  var CLOSE_KEEP = 0.25;    // laptops: share of the growth kept once closed (zooms back out)
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

  function smooth(x) {
    x = Math.min(1, Math.max(0, x));
    return x * x * (3 - 2 * x);
  }

  function place(tx, ty, scale) {
    el.style.setProperty('--tx', tx.toFixed(1) + 'px');
    el.style.setProperty('--drift', ty.toFixed(1) + 'px');
    el.style.setProperty('--s', scale.toFixed(4));
  }

  function measure() {
    place(0, 0, 1);   // measure the cooler where the layout puts it
    var rect = el.getBoundingClientRect();
    var vh = window.innerHeight;
    var docTop = rect.top + window.scrollY;
    var header = document.querySelector('.site-header');
    var headerH = header ? header.offsetHeight : 0;

    // Laptops: once centred, the cooler grows to fill the height below the header.
    var grow = 1;
    if (set === 'desktop') {
      grow = Math.min(MAX_SCALE, (vh - headerH - 2 * CENTRE_MARGIN) / rect.height, (window.innerWidth * 0.7) / rect.width);
      grow = Math.max(1, grow);
    }
    // Draw at the grown size so it stays sharp, but never above the frames' own resolution.
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var frameW = Number(el.dataset[set + 'Width']) || Infinity;
    canvas.width = Math.round(Math.min(rect.width * dpr * grow, frameW));
    canvas.height = Math.round(canvas.width * (rect.height / rect.width));
    drawn = null;

    if (set === 'mobile') {
      // Phones: open and close while drifting down through the reserved space.
      var travel = parseFloat(getComputedStyle(stage).paddingBottom) || 0;
      geometry = { mode: 'drift', start: Math.max(0, docTop - vh * 0.6), span: travel / DRIFT };
      return;
    }

    // Laptops: once the headline has scrolled away, the cooler slides to the middle of the
    // screen and grows as it opens, stays centred while it closes, then scrolls away.
    var copy = document.querySelector('.hero__copy');
    var copyBottom = copy ? copy.getBoundingClientRect().bottom + window.scrollY : docTop + rect.height;
    var centreY = headerH + (vh - headerH) / 2;                   // viewport y of the middle
    var moveEnd = Math.max(copyBottom - headerH - 16, vh * 0.3);  // text is gone by here
    var moveStart = Math.max(0, moveEnd - vh * 0.25);
    var peak = moveEnd + vh * 0.05;                               // fully open, centred
    var span = peak + vh * 0.3;                                   // closed again
    var cx0 = rect.left + rect.width / 2;
    var cy0 = docTop + rect.height / 2;                           // page y of its centre
    geometry = {
      mode: 'centre',
      span: span,
      peak: peak,
      moveStart: moveStart,
      moveEnd: moveEnd,
      dx: window.innerWidth / 2 - cx0,
      centreY: centreY,
      cy0: cy0,
      grow: grow,
    };
    // Reserve exactly the room the cooler travels through, so it never overlaps the next
    // section. The content below is off screen at this point, so nothing visibly shifts.
    var endY = centreY - CLOSE_RISE * (span - peak);
    var endDrift = endY - (cy0 - span);
    var endScale = 1 + (grow - 1) * CLOSE_KEEP;
    stage.style.paddingBottom = Math.ceil(endDrift + rect.height * (endScale - 1) / 2 + 32) + 'px';
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
    var g = geometry;
    var open;
    if (g.mode === 'drift') {
      var scrolled = Math.min(Math.max(window.scrollY - g.start, 0), g.span);
      var t = g.span ? scrolled / g.span : 0;
      open = Math.sin(Math.PI * t);                               // closed → open → closed
      place(0, scrolled * DRIFT, 1);
    } else {
      var s = Math.min(Math.max(window.scrollY, 0), g.span);
      var m = smooth((s - g.moveStart) / (g.moveEnd - g.moveStart));   // 0 → 1: to the middle
      open = s <= g.peak ? smooth(s / g.peak) : smooth(1 - (s - g.peak) / (g.span - g.peak));
      var natural = g.cy0 - s;                                    // where the layout puts it
      var drifting = natural + s * DRIFT;                         // phones' drift, before moving
      var y = drifting + (g.centreY - drifting) * m;              // …blending to the middle
      var scale = 1 + (g.grow - 1) * m;                           // grows as it arrives
      if (s > g.peak) {
        // Closing: zoom back out and start rising, so it is already leaving when it shuts.
        var c = smooth((s - g.peak) / (g.span - g.peak));
        y = g.centreY - CLOSE_RISE * (s - g.peak);
        scale = 1 + (g.grow - 1) * (1 - (1 - CLOSE_KEEP) * c);
      }
      place(g.dx * m, y - natural, scale);
    }
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
