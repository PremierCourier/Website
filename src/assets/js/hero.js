// Hero kit: Premier Courier's own objects floating in layered depth.
//
//   Scroll  — the kit spreads apart (each item along its drift vector), every item turns
//             (the cooler a full circle, ending P mark forward), and the cooler scales up.
//   Pointer — layers shift at their own depth (parallax) and turn toward the pointer.
//   Rest    — each item bobs and drifts gently.
//
// Turntable frames (Blender renders, design/kit.py) load only after the page has loaded;
// until then the stills move. Under reduced motion nothing moves and no frames load.
//
// data-flash on the kit adds the extras awaiting Alanna's approval: a fly-in assembly on
// load, a glint across the cooler, and the glow (CSS) that swells on scroll.
(function () {
  var kit = document.querySelector('[data-kit]');
  if (!kit) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var saveData = navigator.connection && navigator.connection.saveData;
  var FLASH = kit.hasAttribute('data-flash');

  var POINTER_TURN = 45;  // ± degrees at the viewport edge, scaled by depth
  var POINTER_SHIFT = 18; // ± px at the viewport edge, scaled by depth
  var IDLE_TURN = 10;     // ± degrees of drift at rest
  var BOB = 7;            // px of float, scaled by depth
  var LIFT = 40;          // px the whole kit rises as the hero scrolls away
  var EASE = 0.14;
  var INTRO_MS = 1300;
  var INTRO_STAGGER = 110;

  var fine = window.matchMedia('(pointer: fine)');
  var pointer = { x: 0, y: 0 };
  var eased = { x: 0, y: 0 };
  var visible = true;
  var raf = 0;
  var t0 = performance.now();

  var items = Array.prototype.map.call(kit.querySelectorAll('[data-kit-item]'), function (el, i) {
    var d = el.dataset;
    var canvas = el.querySelector('canvas');
    return {
      el: el,
      id: d.id,
      depth: Number(d.depth),
      driftX: Number(d.driftX),
      driftY: Number(d.driftY),
      turn: Number(d.turn),
      phase: Number(d.phase),
      frames: Number(d.frames || 0),
      widths: (d.widths || '').split(',').map(Number),
      path: d.path,
      canvas: canvas,
      ctx: canvas ? canvas.getContext('2d') : null,
      images: [],
      angle: 0,
      drawn: null,
      glint: FLASH && d.id === 'cooler',
      order: i,
    };
  });

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function easeOutBack(k) { var c = 1.4; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); }

  function progress() {
    var r = kit.getBoundingClientRect();
    var top = r.top + window.scrollY;
    return clamp(window.scrollY / (top + r.height), 0, 1);
  }

  function nearest(item, i) {
    var n = item.frames;
    for (var d = 0; d < n; d++) {
      var a = item.images[(i + d) % n];
      if (a) return a;
      var b = item.images[(i - d + n) % n];
      if (b) return b;
    }
    return null;
  }

  // Glint: a white band swept across the object's own pixels only (source-atop).
  function drawGlint(item, pos) {
    var c = item.ctx, w = item.canvas.width, h = item.canvas.height;
    var x = -0.4 * w + pos * 1.8 * w;
    var g = c.createLinearGradient(x - 0.18 * w, 0, x + 0.18 * w, h * 0.35);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.save();
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.restore();
  }

  function draw(item, glintPos) {
    if (!item.ctx || !item.el.classList.contains('is-live')) return;
    var step = 360 / item.frames;
    var i = ((Math.round(item.angle / step) % item.frames) + item.frames) % item.frames;
    var img = nearest(item, i);
    var glinting = item.glint && glintPos > -0.2 && glintPos < 1.2;
    if (!img || (img === item.drawn && !glinting && !item.wasGlinting)) return;
    item.ctx.clearRect(0, 0, item.canvas.width, item.canvas.height);
    item.ctx.drawImage(img, 0, 0, item.canvas.width, item.canvas.height);
    if (glinting) drawGlint(item, glintPos);
    item.drawn = img;
    item.wasGlinting = glinting;
  }

  function tick(t) {
    raf = 0;
    if (!visible || document.hidden) return;
    var p = progress();
    var w = kit.clientWidth;
    eased.x += ((fine.matches ? pointer.x : 0) - eased.x) * 0.08;
    eased.y += ((fine.matches ? pointer.y : 0) - eased.y) * 0.08;
    kit.style.setProperty('--p', p.toFixed(3));

    var introDone = true;
    items.forEach(function (item) {
      // Fly-in: 0 → 1 per item, staggered; items start pushed out along their drift.
      var k = 1;
      if (FLASH) {
        k = clamp((t - t0 - item.order * INTRO_STAGGER) / INTRO_MS, 0, 1);
        if (k < 1) introDone = false;
      }
      var assemble = FLASH ? 1 - easeOutBack(k) : 0;   // 1 → 0 (with a slight overshoot)
      var spread = p + assemble * 1.4;

      var bob = Math.sin(t / 2600 + item.phase) * BOB * item.depth;
      var tx = (item.driftX / 100) * w * spread + eased.x * POINTER_SHIFT * item.depth;
      var ty = (item.driftY / 100) * w * spread + eased.y * POINTER_SHIFT * 0.6 * item.depth + bob - p * LIFT;
      var s = 1 + p * (item.id === 'cooler' ? 0.14 : 0.06);
      item.el.style.setProperty('--tx', tx.toFixed(1) + 'px');
      item.el.style.setProperty('--ty', ty.toFixed(1) + 'px');
      item.el.style.setProperty('--s', s.toFixed(3));
      if (FLASH) item.el.style.opacity = clamp(k * 2.2, 0, 1).toFixed(2);

      var sign = item.order % 2 ? -1 : 1;
      var target = p * item.turn +
        eased.x * POINTER_TURN * Math.min(item.depth, 1.2) * sign +
        Math.sin(t / 7000 + item.phase) * IDLE_TURN +
        assemble * item.turn * 0.5;
      item.angle += (target - item.angle) * EASE;

      // Glint sweeps once as the intro lands, then rides the cooler's turn.
      var glintPos = -1;
      if (item.glint) {
        var sinceIntro = t - t0 - INTRO_MS;
        glintPos = sinceIntro > 0 && sinceIntro < 900 ? sinceIntro / 900 : (((item.angle % 90) + 90) % 90) / 90 * 1.4 - 0.2;
      }
      draw(item, glintPos);
    });
    if (FLASH && introDone && !kit.dataset.introDone) kit.dataset.introDone = '1';
    raf = requestAnimationFrame(tick);
  }

  function start() { if (!raf) raf = requestAnimationFrame(tick); }

  // ---- frames ----

  function sizeCanvas(item) {
    var r = item.canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    item.canvas.width = Math.round(r.width * dpr);
    item.canvas.height = Math.round(r.height * dpr);
    item.drawn = null;
  }

  function loadFrame(item, dir, i) {
    var img = new Image();
    img.decoding = 'async';
    img.src = dir + '/' + String(i).padStart(3, '0') + '.avif';
    return img.decode().then(function () { item.images[i] = img; });
  }

  function loadItem(item) {
    if (!item.frames || !item.canvas) return Promise.resolve();
    sizeCanvas(item);
    // Smallest published width that still covers the canvas.
    var width = item.widths.slice().sort(function (a, b) { return a - b; })
      .find(function (x) { return x >= item.canvas.width; }) || Math.max.apply(null, item.widths);
    var dir = item.path + '/' + width;
    return loadFrame(item, dir, 0).then(function () {
      item.el.classList.add('is-live');
      item.drawn = null;
      var order = [];
      for (var i = 6; i < item.frames; i += 6) order.push(i);
      for (var j = 1; j < item.frames; j++) if (j % 6) order.push(j);
      return order.reduce(function (chain, k) {
        return chain.then(function () { return loadFrame(item, dir, k).catch(function () {}); });
      }, Promise.resolve());
    });
  }

  function loadFrames() {
    if (saveData) return;
    // Cooler first, then the rest, one item at a time.
    var queue = items.slice().sort(function (a, b) { return (b.id === 'cooler') - (a.id === 'cooler'); });
    queue.reduce(function (chain, item) {
      return chain.then(function () { return loadItem(item).catch(function () { /* no AVIF: keep the still */ }); });
    }, Promise.resolve());
  }

  // ---- wiring ----

  if (FLASH) kit.classList.add('is-intro');
  t0 = performance.now();
  start();

  window.addEventListener('pointermove', function (e) {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });
  window.addEventListener('scroll', start, { passive: true });
  window.addEventListener('resize', function () {
    items.forEach(function (item) { if (item.canvas && item.el.classList.contains('is-live')) sizeCanvas(item); });
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) start();
    }).observe(kit);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) start(); });

  function whenIdle() {
    if ('requestIdleCallback' in window) requestIdleCallback(loadFrames, { timeout: 2000 });
    else setTimeout(loadFrames, 200);
  }
  if (document.readyState === 'complete') whenIdle();
  else window.addEventListener('load', whenIdle, { once: true });
})();
