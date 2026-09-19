// Hero sequence: the cooler opens into its layers and closes again as the page scrolls.
//
// The browser holds the cooler in place with CSS `position: sticky` (native, so it never
// lags or jitters behind the scroll, in either direction). This script only sets what
// doesn't fight the scroll: which frame shows, how far the cooler has slid toward the
// middle, and how large it is — all functions of scroll offset. The shown frame is eased
// toward its target, so a mouse-wheel notch plays through the frames between instead of
// jumping. Scrolling itself is never pinned, snapped, or slowed.
//
//   Laptops (≥1024 px): held from the first scroll; once the headline has gone, the cooler
//   slides to the middle — with a shake on the way, like a box being carried — and grows
//   to fill the height below the header as it opens, pauses
//   fully open, then is released — it closes and zooms back out as it scrolls away.
//   Phones: held in the middle of the screen while it opens and closes, then scrolls away.
//
// The hold's length is a spacer under the cooler (.hero__travel), so nothing below is ever
// overlapped. Desktop scrubs 72 frames; phones 24. Frames load after the page has loaded
// and only once the hero is in view, every fourth frame first, decoded off the main thread;
// AVIF, falling back to WebP. The inlined poster (frame 0) shows until then, and stays
// alone under reduced motion or Save-Data.
(function () {
  var el = document.querySelector('[data-sequence]');
  if (!el) return;
  var travel = document.querySelector('.hero__travel');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = navigator.connection && navigator.connection.saveData;
  if (reduce || saveData || !window.HTMLCanvasElement) {
    if (travel) travel.style.height = '0px';
    return;
  }

  var CENTRE_MARGIN = 24;   // px kept clear above and below the centred cooler
  var MAX_SCALE = 1.8;      // laptops: never grow past this, however tall the screen
  var CLOSE_KEEP = 0.25;    // laptops: share of the growth kept once closed (zooms back out)
  var FRAME_EASE_MS = 70;   // how quickly the shown frame catches up with the scroll
  var SHAKE_DEG = 3.5;      // laptops: peak wobble while sliding to the middle
  var SHAKE_PX = 5;         // laptops: peak jostle while sliding to the middle
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
  var shown = 0;            // eased frame position, 0 … N-1
  var lastT = 0;

  function smooth(x) {
    x = Math.min(1, Math.max(0, x));
    return x * x * (3 - 2 * x);
  }

  function place(tx, ty, scale, rot) {
    el.style.setProperty('--tx', tx.toFixed(1) + 'px');
    el.style.setProperty('--ty', ty.toFixed(1) + 'px');
    el.style.setProperty('--s', scale.toFixed(4));
    el.style.setProperty('--rot', (rot || 0).toFixed(2) + 'deg');
  }

  function measure() {
    // Measure where the layout puts the cooler, with the hold switched off.
    el.style.setProperty('--stick-top', '-100000px');
    place(0, 0, 1);
    var rect = el.getBoundingClientRect();
    var vh = window.innerHeight;
    var docTop = rect.top + window.scrollY;
    var header = document.querySelector('.site-header');
    var headerH = header ? header.offsetHeight : 0;
    var bar = document.querySelector('.call-cue--bar');
    var barH = bar && bar.offsetParent ? bar.offsetHeight : 0;

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

    var centreTop = headerH + (vh - headerH - barH - rect.height) / 2;   // top edge when centred

    if (set === 'mobile') {
      // Phones: stick in the middle; play while held for most of a screen of scrolling.
      var stickTop = Math.max(headerH + 8, centreTop);
      var span = vh * 0.9;
      geometry = { mode: 'hold', start: docTop - stickTop, span: span };
      el.style.setProperty('--stick-top', stickTop.toFixed(1) + 'px');
      if (travel) travel.style.height = Math.ceil(span) + 'px';
      return;
    }

    // Laptops: held from the first scroll at its place beside the headline. Once the text
    // has gone, it slides to the middle and grows as it opens, then zooms back out as it
    // closes, and the hold ends.
    var copy = document.querySelector('.hero__copy');
    var copyBottom = copy ? copy.getBoundingClientRect().bottom + window.scrollY : docTop + rect.height;
    var moveEnd = Math.max(copyBottom - headerH - 16, vh * 0.3);    // text is gone by here
    var moveStart = Math.max(0, moveEnd - vh * 0.25);
    var peak = moveEnd + vh * 0.05;                                 // fully open, centred
    var holdEnd = peak + vh * 0.1;                                  // brief pause, then release
    var endAt = holdEnd + vh * 0.5;                                 // closed, on its way out
    var stickAt = Math.max(headerH, docTop);                        // viewport top while held
    geometry = {
      mode: 'centre',
      start: docTop - stickAt,
      span: endAt,
      peak: peak,
      holdEnd: holdEnd,
      moveStart: moveStart,
      moveEnd: moveEnd,
      dx: window.innerWidth / 2 - (rect.left + rect.width / 2),
      dy: centreTop - stickAt,
      grow: grow,
    };
    el.style.setProperty('--stick-top', stickAt.toFixed(1) + 'px');
    // The spacer is the length of the hold. The content below is off screen, so nothing
    // visibly shifts when it is sized.
    if (travel) travel.style.height = Math.ceil(holdEnd) + 'px';
  }

  function nearest(i) {
    for (var d = 0; d < N; d++) {
      if (frames[i + d]) return frames[i + d];
      if (frames[i - d]) return frames[i - d];
    }
    return null;
  }

  // Target frame position (0 … N-1) for the current scroll, and the cooler's placement.
  function target() {
    var g = geometry;
    var s = Math.min(Math.max(window.scrollY - g.start, 0), g.span);
    if (g.mode === 'hold') {
      place(0, 0, 1);
      return Math.sin(Math.PI * (s / g.span)) * (N - 1);             // closed → open → closed
    }
    var m = smooth((s - g.moveStart) / (g.moveEnd - g.moveStart));  // 0 → 1: to the middle
    var scale = 1 + (g.grow - 1) * m;
    var open;
    if (s <= g.holdEnd) {
      open = smooth(s / g.peak);                                    // opens; stays open to the release
    } else {
      // Released: the page carries it up while it closes and zooms back out.
      var c = smooth((s - g.holdEnd) / (g.span - g.holdEnd));
      open = 1 - c;
      scale = 1 + (g.grow - 1) * (1 - (1 - CLOSE_KEEP) * c);
    }
    // Shake while it travels: zero as it sets off, strongest mid-way, settled on arrival —
    // a box being carried and set down. A function of scroll, so it replays in reverse.
    var e = Math.sin(Math.PI * m);
    var rot = SHAKE_DEG * e * Math.sin(s * 0.11);
    var jx = SHAKE_PX * e * Math.sin(s * 0.137 + 1.3);
    var jy = SHAKE_PX * 0.8 * e * Math.sin(s * 0.173 + 0.4);
    place(g.dx * m + jx, g.dy * m + jy, scale, rot);
    return open * (N - 1);
  }

  function render(t) {
    raf = 0;
    if (!geometry) return;
    var goal = target();
    // Ease the shown frame toward the goal, frame-rate independent.
    var dt = lastT ? Math.min(t - lastT, 100) : 16;
    lastT = t;
    shown += (goal - shown) * (1 - Math.exp(-dt / FRAME_EASE_MS));
    if (Math.abs(goal - shown) < 0.05) shown = goal;
    var img = nearest(Math.round(shown));
    if (img && img !== drawn) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      drawn = img;
    }
    if (shown !== goal) schedule();
    else lastT = 0;
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
  shown = target();   // start on the right frame, not eased in from 0
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
