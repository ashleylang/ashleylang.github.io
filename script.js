// Theme toggle
(function () {
  var root = document.documentElement;
  var btn = document.getElementById('theme-toggle');
  btn.addEventListener('click', function () {
    var dark = root.dataset.theme === 'dark' ||
      (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    var next = dark ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
  });
  document.getElementById('year').textContent = new Date().getFullYear();
})();

// Photos: hide the broken-image icon and keep the styled placeholder until a file exists
document.querySelectorAll('.photo img').forEach(function (img) {
  function ok() { img.parentElement.classList.add('has-img'); }
  function fail() {
    var card = img.closest('.card');
    if (card) img.parentElement.remove(); else img.style.display = 'none';
  }
  if (img.complete) { img.naturalWidth ? ok() : fail(); }
  else { img.addEventListener('load', ok); img.addEventListener('error', fail); }
});

// Reveal on scroll
(function () {
  var els = document.querySelectorAll('.card, .pubs li, .gallery .photo, .feature, .about .grid-2 > *');
  els.forEach(function (e) { e.classList.add('reveal'); });
  if (!('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('in'); }); return; }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { threshold: 0.12 });
  els.forEach(function (e) { io.observe(e); });
})();

// Hero: a fixed set of roots grows in once on load, branching around the text, then stays put
(function () {
  var canvas = document.getElementById('network');
  var ctx = canvas.getContext('2d');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var w, h, segs, tips, raf, avoid = [], rng;

  // Seeded generator: the same roots grow every time the page opens
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function R() { return rng(); }
  function rnd(a, b) { return a + R() * (b - a); }
  function css(n, d) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || d; }

  // Where the hero text sits, so roots can grow around it
  function measure() {
    var cr = canvas.getBoundingClientRect(), pad = w < 700 ? 6 : 24;
    avoid = [];
    var els = [];
    document.querySelectorAll('.hero-panel > *').forEach(function (el) {
      if (el.tagName === 'UL') el.querySelectorAll('li').forEach(function (li) { els.push(li); }); else els.push(el);
    });
    els.forEach(function (el) {
      var rg = document.createRange(); rg.selectNodeContents(el);
      var r = rg.getBoundingClientRect(), b = el.getBoundingClientRect();
      if (!r.width) return;
      avoid.push({ x1: r.left - cr.left - pad, y1: b.top - cr.top - Math.min(pad, 10), x2: r.right - cr.left + pad, y2: b.bottom - cr.top + pad });
    });
  }
  function clearOf(x, y) {
    for (var i = 0; i < avoid.length; i++) { var a = avoid[i]; if (x > a.x1 && x < a.x2 && y > a.y1 && y < a.y2) return false; }
    return true;
  }

  // Occupancy grid: keeps roots from piling up on top of each other
  var CELL = 12, gw, gh, grid;
  function gi(x, y) { var cx = Math.floor(x / CELL), cy = Math.floor(y / CELL); return (cx < 0 || cy < 0 || cx >= gw || cy >= gh) ? -1 : cy * gw + cx; }
  function density(x, y) { var i = gi(x, y); return i < 0 ? 0 : grid[i]; }

  function seed() {
    rng = mulberry(20241111);
    segs = []; tips = [];
    gw = Math.ceil(w / CELL) + 1; gh = Math.ceil(h / CELL) + 1; grid = new Uint8Array(gw * gh);
    var minX = Infinity, maxX = 0;
    avoid.forEach(function (a) { minX = Math.min(minX, a.x1); maxX = Math.max(maxX, a.x2); });
    if (!isFinite(minX)) { minX = 40; maxX = w * .7; }
    var leftX = Math.max(8, Math.min(minX * .5, minX - 14));
    var rightX = Math.min(w - 12, maxX + (w - maxX) * .4);
    var P = Math.PI;
    // 1: top left, runs left to right across the top of the page
    tips.push({ x: -4, y: 54, a: .05, tgt: 0, lane: 56, grav: .05, wob: .1, w: 3.6, v: 1.15, gen: 0, fine: false, life: 800, bp: .55 });
    // 2: small root from the middle top, which finds the text and slides around it
    tips.push({ x: w * .4, y: -4, a: P / 2, tgt: P / 2, grav: .03, w: 2.6, v: 1.1, gen: 0, fine: false, life: 120, bp: .8 });
    // 3 and 4: long roots down the right side, branching freely
    tips.push({ x: rightX, y: -4, a: P / 2, tgt: P / 2, grav: .03, w: 4.2, v: 1.3, gen: 0, fine: false, life: 580, bp: 1.4 });
    tips.push({ x: w - 46, y: -4, a: P / 2 + .1, tgt: P / 2, grav: .03, w: 3.8, v: 1.25, gen: 0, fine: false, life: 540, bp: 1.4 });
    // 5: enters from the right edge, leaning in toward the page
    tips.push({ x: w + 4, y: h * .12, a: P * .62, tgt: P / 2, grav: .03, w: 3.4, v: 1.25, gen: 0, fine: false, life: 480, bp: 1.4 });
    // 6: another from the right edge, about three quarters of the way down
    tips.push({ x: w + 4, y: h * .75, a: P * .9, tgt: P / 2, grav: .035, w: 3.2, v: 1.2, gen: 0, fine: false, life: 380, bp: 1.3, branchAt: 300 });
    tips.forEach(function (t, k) { t.r = mulberry(7001 + k * 131); });
  }

  // Roots may run sideways and curl up a little (about 35 degrees), but not climb steeply
  var UP = .6;
  function noUp(a) {
    a = Math.atan2(Math.sin(a), Math.cos(a));
    if (a < -UP && a > -(Math.PI - UP)) a = a > -Math.PI / 2 ? -UP : -(Math.PI - UP);
    return a;
  }
  function rn(t, lo, hi) { return lo + t.r() * (hi - lo); }
  function step() {
    var next = [];
    for (var i = 0; i < tips.length; i++) {
      var t = tips[i];
      for (var s = 0; s < 2 && t.life > 0; s++) {
        if (t.fine) {
          t.a += rn(t, -.5, .5);                                     // hyphae wander in any direction
        } else {
          var tg = t.lane ? Math.max(-.45, Math.min(.45, (t.lane - t.y) * .03)) : t.tgt;   // a lane keeps the top root hovering near the text
          var dg = Math.atan2(Math.sin(tg - t.a), Math.cos(tg - t.a));
          var wb = t.wob || .17;
          t.a = noUp(t.a + rn(t, -wb, wb) + dg * t.grav + Math.sin((t.life + t.x) * .06) * .035);
        }
        for (var q = 0; q < avoid.length; q++) {                  // steer around the text
          var A = avoid[q];
          var px = Math.max(A.x1, Math.min(t.x, A.x2)), py = Math.max(A.y1, Math.min(t.y, A.y2));
          var dx = t.x - px, dy = t.y - py, d = Math.hypot(dx, dy);
          if (d < 80) {
            var away = Math.atan2(d ? dy : t.y - (A.y1 + A.y2) / 2, d ? dx : t.x - (A.x1 + A.x2) / 2);
            var da = Math.atan2(Math.sin(away - t.a), Math.cos(away - t.a));
            t.a += da * (1 - d / 80) * .2;
            if (!t.fine) t.a = noUp(t.a);
          }
        }
        var nx = t.x + Math.cos(t.a) * t.v * 2.2, ny = t.y + Math.sin(t.a) * t.v * 2.2;
        if (!t.fine && ny < 6 && Math.sin(t.a) < 0) { t.a = -t.a; ny = t.y + Math.sin(t.a) * t.v * 2.2; }
        if (!clearOf(nx, ny)) { t.life = 0; break; }
        var dens = density(nx, ny);
        if (!t.fine && t.gen > 0 && !t.free && dens > 14) { t.life = 0; break; }   // starting roots never stop for crowding          // retire a root that runs into a crowded patch
        segs.push({ x1: t.x, y1: t.y, x2: nx, y2: ny, w: t.w, f: t.fine });
        var gix = gi(nx, ny); if (gix >= 0 && !t.fine && grid[gix] < 255) grid[gix]++;
        t.x = nx; t.y = ny; t.life--;
        // one planned branch: a small root that heads left and a little up, toward the buttons
        if (t.branchAt && t.life === t.branchAt) {
          t.branchAt = 0;
          next.push({ x: t.x, y: t.y, a: Math.PI + .3, tgt: Math.PI + .12, grav: .05, wob: .1, w: t.w * .75, v: 1.1,
                      gen: 1, fine: false, life: 200, bp: .8, free: true, r: mulberry(9091) });
        }
        t.w = Math.max(t.fine ? .45 : .7, t.w * (t.fine ? .995 : .9975));
        // side roots: only into open soil, and only where they have room to grow
        if (!t.fine && t.life > 40 && dens < 8 && t.r() < (t.gen < 2 ? .03 : .016) * t.bp) {
          var side = t.r() < .5 ? -1 : 1;
          var ba = noUp(t.a + side * rn(t, .5, 1.3));
          if (clearOf(t.x + Math.cos(ba) * 60, t.y + Math.sin(ba) * 60)) {
            next.push({ x: t.x, y: t.y, a: ba, tgt: Math.PI / 2, grav: .035, w: t.w * rn(t, .5, .7), v: t.v * rn(t, .85, 1),
                        gen: t.gen + 1, fine: false, life: t.life * rn(t, .4, .65), bp: Math.max(.9, t.bp * .8), r: mulberry((t.r() * 4294967296) | 0) });
          }
        }
        // hyphae: fine strands from thin tips, free to go in any direction
        if (!t.fine && t.w < 1.8 && dens < 8 && t.r() < .05) {
          next.push({ x: t.x, y: t.y, a: t.r() * 6.283, w: .7, v: .55, gen: 9, fine: true, life: rn(t, 14, 36), bp: 0, r: mulberry((t.r() * 4294967296) | 0) });
        }
      }
      if (t.life > 0 && t.x > -80 && t.x < w + 80 && t.y < h + 40) next.push(t);
    }
    tips = next.length > 420 ? next.slice(0, 420) : next;
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    var root = css('--root', '#cbb99f'), fine = css('--hypha', 'rgba(181,99,47,.6)');
    ctx.lineCap = 'round';
    for (var i = 0; i < segs.length; i++) {
      var g = segs[i];
      ctx.strokeStyle = g.f ? fine : root; ctx.lineWidth = g.w;
      ctx.beginPath(); ctx.moveTo(g.x1, g.y1); ctx.lineTo(g.x2, g.y2); ctx.stroke();
    }
    ctx.fillStyle = fine;
    for (var k = 0; k < tips.length; k++) {
      if (!tips[k].fine && tips[k].gen < 2) { ctx.beginPath(); ctx.arc(tips[k].x, tips[k].y, 1.8, 0, 6.283); ctx.fill(); }
    }
  }

  var tick = 0;
  function frame() {
    if (++tick % 2 === 0) { step(); draw(); }   // about 60 growth steps a second: unhurried, like real growth
    if (tips.length) raf = requestAnimationFrame(frame);
  }

  // animate = play the growth; otherwise jump straight to the finished roots
  function run(animate) {
    cancelAnimationFrame(raf);
    var r = canvas.getBoundingClientRect();
    w = r.width; h = r.height;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    measure(); seed();
    if (animate && !reduce) { raf = requestAnimationFrame(frame); return; }
    var guard = 0; while (tips.length && guard++ < 6000) step();
    draw();
  }

  window.replayRoots = function () { run(true); };

  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { run(false); }, 250); });
  // Repaint in the new colors when the theme changes
  new MutationObserver(function () { if (!tips.length) draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (!tips.length) draw(); });

  // Start once fonts have settled so the text position is measured correctly
  var started = false;
  function go() { if (started) return; started = true; run(true); }
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(go); setTimeout(go, 800); } else go();
})();
