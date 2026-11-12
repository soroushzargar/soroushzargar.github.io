/* ==========================================================================
   Animated plots for paper TL;DRs.

   A post embeds one with
     <figure class="plot">
       <canvas data-plot="name" data-scene="file" role="img" aria-label="…"></canvas>
       <figcaption>…</figcaption>
     </figure>
   site.js loads this file and then assets/plots/<file>.js, which registers its
   plots with sitePlots.define(function (kit) { … return { name: spec, … }; }).

   A spec is { size: [width, height], duration: seconds, draw: function (t) }.
   draw paints the whole plot at time t (0 … duration) in a width × height
   drawing space, using the kit. It must be a pure function of t: the first
   frame (t = 0) is what waits on the page in grayscale, the last one is what
   stays. A plot starts when it reaches the middle of the screen and runs once;
   the repeat icon runs it again. Reduced-motion readers get the last frame.
   ========================================================================== */
(function () {
  "use strict";
  if (window.sitePlots) return;

  var FONT_DIR = "assets/asd-plots/fonts/";
  var SERIF = "InterV", SANS = "SourceSans";
  var ctx = document.createElement("canvas").getContext("2d");

  /* ── kit: what a scene draws with ────────────────────────────────────── */

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function smooth(u) { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); }
  function lerp(a, b, u) { return a + (b - a) * u; }

  var kit = {
    // palette (page ground is BG; never fill the whole canvas)
    BG: "#faf8f4", FG: "#1C2128", MUTED: "#6B7280", LINE: "#E2DDD3", SOFT: "rgba(127,127,127,.12)",
    BLUE: "#2F55C8", ORANGE: "#D9822B", GREEN: "#1F8A5B", RED: "#C23B3B", GOLD: "#C99712",
    NAVY: "#2a3f5c", MAROON: "#7b2d3a",
    SERIF: SERIF, SANS: SANS,

    clamp: clamp, lerp: lerp, smooth: smooth,
    // 0 before a, 1 after b, smooth in between — the way to stage things on the timeline
    ease: function (t, a, b) { return smooth((t - a) / (b - a)); },
    // same, but fast start and soft landing (bars growing, things arriving)
    easeOut: function (t, a, b) { var u = clamp((t - a) / (b - a), 0, 1); return 1 - Math.pow(1 - u, 3); },

    // seeded random numbers, so a plot is the same on every run
    rng: function (seed) {
      return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    },
    gauss: function (r) {
      var u = 0, v = 0;
      while (!u) u = r();
      while (!v) v = r();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },

    // the 2D context of the plot being drawn, for anything the helpers do not cover
    ctx: function () { return ctx; },

    // mix two #rrggbb colours
    mix: function (a, b, u) {
      var pa = [1, 3, 5].map(function (i) { return parseInt(a.substr(i, 2), 16); });
      var pb = [1, 3, 5].map(function (i) { return parseInt(b.substr(i, 2), 16); });
      return "rgb(" + pa.map(function (v, i) { return Math.round(v + (pb[i] - v) * u); }).join(",") + ")";
    },

    font: function (size, family, weight, italic) {
      ctx.font = (italic ? "italic " : "") + (weight || 400) + " " + size + "px " + (family || SANS);
    },
    // o: { size, fam, weight, italic, color, alpha, align, base }
    text: function (s, x, y, o) {
      o = o || {};
      ctx.save();
      kit.font(o.size || 22, o.fam || SANS, o.weight, o.italic);
      ctx.fillStyle = o.color || kit.FG;
      ctx.globalAlpha *= (o.alpha === undefined ? 1 : o.alpha);
      ctx.textAlign = o.align || "left";
      ctx.textBaseline = o.base || "alphabetic";
      ctx.fillText(s, x, y);
      ctx.restore();
    },
    measure: function (s, o) {
      o = o || {};
      kit.font(o.size || 22, o.fam || SANS, o.weight, o.italic);
      return ctx.measureText(s).width;
    },
    // Mixed runs on one line, for small formulas: segments are strings or
    // [string, { it, sub, sup, fam, color }]. Italic serif by default, like maths.
    rich: function (segments, x, y, o) {
      o = o || {};
      var size = o.size || 24, width = 0;
      var parts = segments.map(function (seg) {
        var str = typeof seg === "string" ? seg : seg[0];
        var f = typeof seg === "string" ? {} : seg[1] || {};
        var small = f.sub || f.sup;
        var italic = f.it !== undefined ? f.it : (o.italic !== undefined ? o.italic : true);
        kit.font(small ? size * 0.62 : size, f.fam || o.fam || SERIF, o.weight || 500, italic);
        var w = ctx.measureText(str).width;
        width += w;
        return { str: str, f: f, w: w, small: small, italic: italic };
      });
      var xx = o.align === "center" ? x - width / 2 : (o.align === "right" ? x - width : x);
      parts.forEach(function (p) {
        kit.text(p.str, xx, y + (p.f.sub ? size * 0.22 : p.f.sup ? -size * 0.38 : 0), {
          size: p.small ? size * 0.62 : size, fam: p.f.fam || o.fam || SERIF, weight: o.weight || 500,
          italic: p.italic, color: p.f.color || o.color, alpha: o.alpha
        });
        xx += p.w;
      });
      return width;
    },
    // Polyline through pts [[x, y], …]. progress in 0…1 draws only the first part.
    line: function (pts, color, width, o) {
      o = o || {};
      if (pts.length < 2) return;
      ctx.save();
      ctx.globalAlpha *= (o.alpha === undefined ? 1 : o.alpha);
      ctx.strokeStyle = color; ctx.lineWidth = width || 2;
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      if (o.dash) ctx.setLineDash(o.dash);
      var n = o.progress === undefined ? pts.length : Math.max(2, Math.round(pts.length * clamp(o.progress, 0, 1)));
      ctx.beginPath();
      for (var i = 0; i < n; i++) { if (i) ctx.lineTo(pts[i][0], pts[i][1]); else ctx.moveTo(pts[i][0], pts[i][1]); }
      ctx.stroke();
      ctx.restore();
    },
    // Filled rounded rectangle. o: { alpha, stroke, lineWidth, dash }
    rect: function (x, y, w, h, radius, fill, o) {
      o = o || {};
      ctx.save();
      ctx.globalAlpha *= (o.alpha === undefined ? 1 : o.alpha);
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius || 0);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (o.stroke) {
        ctx.strokeStyle = o.stroke; ctx.lineWidth = o.lineWidth || 2;
        if (o.dash) ctx.setLineDash(o.dash);
        ctx.stroke();
      }
      ctx.restore();
    },
    // Circle. o: { alpha, stroke, lineWidth, dash }
    dot: function (x, y, r, fill, o) {
      o = o || {};
      ctx.save();
      ctx.globalAlpha *= (o.alpha === undefined ? 1 : o.alpha);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (o.stroke) {
        ctx.strokeStyle = o.stroke; ctx.lineWidth = o.lineWidth || 2;
        if (o.dash) ctx.setLineDash(o.dash);
        ctx.stroke();
      }
      ctx.restore();
    },
    // L-shaped axes with the origin at (x0, y0), reaching right to x1 and up to y1.
    axes: function (x0, y0, x1, y1, alpha) {
      kit.line([[x0, y1], [x0, y0], [x1, y0]], kit.LINE, 2, { alpha: alpha });
    }
  };

  /* ── playback ────────────────────────────────────────────────────────── */

  var BACKING_WIDTH = 1400; // sharp at the column width on a 2x screen
  var REPEAT_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>' +
    '<path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>';
  var reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var specs = {}, plots = [], pending = [], fontsReady = false;

  function draw(plot) {
    var s = plot.scale;
    ctx = plot.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, plot.canvas.width, plot.canvas.height);
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.save();
    try { plot.spec.draw(plot.time); }
    catch (err) { console.error("[plots] " + plot.name, err); plot.playing = false; }
    ctx.restore();
  }

  function run(plot) {
    if (plot.playing) return;
    plot.playing = true;
    var id = ++plot.run; // a paused loop still has a frame pending; it must not resume too
    var last = performance.now();
    requestAnimationFrame(function tick(now) {
      if (!plot.playing || id !== plot.run) return;
      plot.time = Math.min(plot.spec.duration, plot.time + Math.min(now - last, 100) / 1000);
      last = now;
      draw(plot);
      if (plot.time >= plot.spec.duration) plot.playing = false;
      else requestAnimationFrame(tick);
    });
  }

  function setUp(canvas) {
    var name = canvas.getAttribute("data-plot"), spec = specs[name];
    if (!spec || canvas.hasAttribute("data-plot-ready")) return;
    canvas.setAttribute("data-plot-ready", "");
    var plot = {
      name: name, canvas: canvas, figure: canvas.parentNode, spec: spec,
      ctx: canvas.getContext("2d"),
      scale: BACKING_WIDTH / spec.size[0],
      time: reducedMotion ? spec.duration : 0,
      playing: false, started: reducedMotion, run: 0
    };
    canvas.width = BACKING_WIDTH;
    canvas.height = Math.round(spec.size[1] * plot.scale);
    if (!reducedMotion) plot.figure.classList.add("is-waiting");

    var button = document.createElement("button");
    button.type = "button";
    button.className = "plot-repeat";
    button.title = "Repeat";
    button.setAttribute("aria-label", "Repeat this animation");
    button.innerHTML = REPEAT_ICON;
    button.addEventListener("click", function () { plot.time = 0; run(plot); });
    plot.figure.appendChild(button);

    draw(plot);
    plots.push(plot);
  }

  // A plot starts once its centre is at or above the middle of the screen (which
  // also catches a jump past it), or at the page end for one too low to get there.
  function check() {
    var middle = innerHeight / 2;
    var atPageEnd = scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
    plots.forEach(function (plot) {
      var box = plot.canvas.getBoundingClientRect();
      if (box.bottom < 0 || box.top > innerHeight) plot.playing = false;
      else if (plot.started) { if (plot.time < plot.spec.duration) run(plot); }
      else if (box.top + box.height / 2 <= middle || atPageEnd) {
        plot.started = true;
        plot.figure.classList.remove("is-waiting");
        run(plot);
      }
    });
  }

  function mount() {
    if (!fontsReady) return;
    pending.splice(0).forEach(function (make) {
      var made;
      try { made = make(kit) || {}; }
      catch (err) { console.error("[plots] scene failed to load", err); return; }
      Object.keys(made).forEach(function (name) { specs[name] = made[name]; });
    });
    Array.prototype.forEach.call(document.querySelectorAll("canvas[data-plot][data-scene]"), setUp);
    check();
  }

  window.sitePlots = {
    define: function (make) { pending.push(make); mount(); },
    // for tests: draw every plot on the page at a fraction (0 … 1) of its own duration
    seek: function (fraction) {
      plots.forEach(function (plot) {
        plot.playing = false; plot.started = true;
        plot.figure.classList.remove("is-waiting");
        plot.time = plot.spec.duration * Math.max(0, Math.min(1, fraction));
        draw(plot);
      });
    }
  };

  // Scenes measure text while loading, so the faces have to be ready first.
  var faces = [
    new FontFace("InterV", "url(" + FONT_DIR + "Inter-wght.woff2)", { weight: "100 900" }),
    new FontFace("InterV", "url(" + FONT_DIR + "Inter-wght-italic.woff2)", { weight: "100 900", style: "italic" }),
    new FontFace("SourceSans", "url(" + FONT_DIR + "SourceSans3.ttf)", { weight: "200 900" })
  ];
  function start() { fontsReady = true; mount(); }
  Promise.all(faces.map(function (face) {
    return face.load().then(function () { document.fonts.add(face); });
  })).then(start, start);

  addEventListener("scroll", check, { passive: true });
  addEventListener("resize", check);
})();
