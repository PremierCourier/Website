// Hero turntable: the cooler turns as the page scrolls and as the pointer moves.
// Frames are Blender renders of the cooler at evenly spaced angles (design/cooler.py
// --turntable). They load only after the page has loaded; until then — and always under
// reduced motion or Save-Data — the still stays in place. Frame 0 matches the still, so
// the swap is invisible.
(function () {
  var stage = document.querySelector('[data-turntable]');
  if (!stage) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = navigator.connection && navigator.connection.saveData;
  if (reduce || saveData || !window.HTMLCanvasElement) return;

  var N = Number(stage.dataset.frames);
  var PATH = stage.dataset.path;
  var STEP = 360 / N;
  // Scrolling turns the cooler toward the viewer: the P mark (34° off-camera at rest)
  // passes square-on about a third of the way through, then the cooler shows its side.
  var SCROLL_TURN = -90;   // degrees turned while the hero scrolls out of view
  var POINTER_TURN = 30;   // ± degrees from pointer position (fine pointers only)
  var IDLE_TURN = 8;       // ± degrees of drift once the pointer rests
  var IDLE_PERIOD = 9000;  // ms per drift cycle
  var IDLE_AFTER = 2500;   // ms without pointer movement before drifting
  var LIFT = 48;           // px the cooler rises as the hero scrolls away
  var EASE = 0.09;

  var canvas = stage.querySelector('canvas');
  var ctx = canvas.getContext('2d');
  var frames = new Array(N);
  var fine = window.matchMedia('(pointer: fine)');
  var pointerX = 0;
  var lastPointer = -Infinity;
  var idleWeight = 0;
  var angle = 0;
  var drawn = -1;
  var visible = true;
  var raf = 0;

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function sizeCanvas() {
    var r = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    drawn = -1;
  }

  // Nearest loaded frame to the one wanted, so turning works while frames stream in.
  function nearest(i) {
    for (var d = 0; d < N; d++) {
      var a = frames[(i + d) % N];
      if (a) return a;
      var b = frames[(i - d + N) % N];
      if (b) return b;
    }
    return null;
  }

  function draw(i) {
    var img = nearest(i);
    if (!img || img === drawn) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    drawn = img;
  }

  function scrollProgress() {
    var r = stage.getBoundingClientRect();
    var top = r.top + window.scrollY;
    return clamp(window.scrollY / (top + r.height), 0, 1);
  }

  function tick(t) {
    raf = 0;
    if (!visible || document.hidden) return;
    var p = scrollProgress();
    var resting = !fine.matches || t - lastPointer > IDLE_AFTER;
    idleWeight += ((resting ? 1 : 0) - idleWeight) * 0.02;
    var target =
      p * SCROLL_TURN +
      (fine.matches ? pointerX * POINTER_TURN : 0) +
      Math.sin((t / IDLE_PERIOD) * Math.PI * 2) * IDLE_TURN * idleWeight;
    angle += (target - angle) * EASE;
    var i = ((Math.round(angle / STEP) % N) + N) % N;
    draw(i);
    stage.style.setProperty('--lift', (-p * LIFT).toFixed(1) + 'px');
    raf = requestAnimationFrame(tick);
  }

  function start() { if (!raf) raf = requestAnimationFrame(tick); }

  function load(i) {
    var img = new Image();
    img.decoding = 'async';
    img.src = PATH + '/' + String(i).padStart(3, '0') + '.avif';
    return img.decode().then(function () { frames[i] = img; });
  }

  function begin() {
    sizeCanvas();
    var width = canvas.width > 480 ? 720 : 480;
    PATH = PATH + '/' + width;
    // Frame 0 first (it matches the still), then every fifth, then the rest.
    load(0)
      .then(function () {
        draw(0);
        stage.classList.add('is-live');
        start();
        var order = [];
        for (var i = 5; i < N; i += 5) order.push(i);
        for (var j = 1; j < N; j++) if (j % 5) order.push(j);
        order.reduce(function (chain, k) {
          return chain.then(function () { return load(k).catch(function () {}); });
        }, Promise.resolve());
      })
      .catch(function () { /* no AVIF support: keep the still */ });

    window.addEventListener('pointermove', function (e) {
      pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      lastPointer = performance.now();
    }, { passive: true });
    window.addEventListener('scroll', start, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(sizeCanvas).observe(canvas);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start();
      }).observe(stage);
    }
    document.addEventListener('visibilitychange', function () { if (!document.hidden) start(); });
  }

  function whenIdle() {
    if ('requestIdleCallback' in window) requestIdleCallback(begin, { timeout: 2000 });
    else setTimeout(begin, 200);
  }
  if (document.readyState === 'complete') whenIdle();
  else window.addEventListener('load', whenIdle, { once: true });
})();
