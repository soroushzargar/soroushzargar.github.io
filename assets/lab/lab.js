/* ==========================================================================
   Research lab — small interactive models that run in the page.
   Put one on a page (or in a post) with <figure class="lab" data-lab="name">.

     robust      split conformal prediction on a three-class toy problem, an
                 attacker of radius ε, and two ways to stay valid: enlarge the
                 sets at test time, or shift the threshold at calibration time
     graph       conformal sets on a toy graph, with neighbourhood diffusion
                 of the scores (the idea behind DAPS)
     evolution   an evolutionary search for the edge flips that hurt a toy
                 graph classifier most (the idea behind EvA)

   Everything shown is computed here from the toy model; nothing is a recording.
   ========================================================================== */
(function () {
  "use strict";

  var reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  var PAPER = [250, 248, 244];
  var INK = "#1c1c1a";
  var MUTED = "#74716a";
  var RULE = "#e0dace";
  var ACCENT = "#2a3f5c";
  var MAROON = "#7b2d3a";
  var CLASSES = [
    { name: "A", rgb: [47, 85, 200] },
    { name: "B", rgb: [217, 130, 43] },
    { name: "C", rgb: [31, 138, 91] }
  ];
  var K = CLASSES.length;

  /* ── helpers ─────────────────────────────────────────────────────────── */

  function rng(seed) { // mulberry32
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function gauss(r) {
    var u = 0, v = 0;
    while (!u) u = r();
    while (!v) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rgb(c, alpha) {
    return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (alpha == null ? 1 : alpha) + ")";
  }
  function mix(a, b, u) {
    return [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * u); });
  }
  function pct(v) { return (100 * v).toFixed(1) + "%"; }

  function el(tag, className, html) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (html != null) node.innerHTML = html;
    return node;
  }

  // Size a canvas to its CSS box at the screen's pixel ratio; draw in CSS pixels.
  function fit(canvas, aspect) {
    var w = canvas.clientWidth;
    if (!w) return null;
    var h = Math.round(w / aspect);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx: ctx, w: w, h: h };
  }

  // Class marker: A circle, B square, C triangle — shape as well as colour.
  function marker(ctx, k, x, y, r) {
    ctx.beginPath();
    if (k === 0) ctx.arc(x, y, r, 0, 2 * Math.PI);
    else if (k === 1) ctx.rect(x - r * 0.9, y - r * 0.9, r * 1.8, r * 1.8);
    else {
      ctx.moveTo(x, y - r * 1.15);
      ctx.lineTo(x + r * 1.1, y + r * 0.85);
      ctx.lineTo(x - r * 1.1, y + r * 0.85);
      ctx.closePath();
    }
  }

  // Split conformal threshold: the ceil((n+1)(1-alpha))-th smallest score.
  function quantile(sortedScores, coverage) {
    var n = sortedScores.length;
    var k = Math.ceil((n + 1) * coverage);
    return k > n ? 1 : sortedScores[k - 1];
  }

  function slider(labelHtml, min, max, step, value, format, onInput) {
    var wrap = el("label", "lab-control");
    var head = el("span", "lab-control-head", "<span>" + labelHtml + "</span>");
    var out = el("output", "lab-control-value", format(value));
    head.appendChild(out);
    var input = el("input");
    input.type = "range"; input.min = min; input.max = max; input.step = step; input.value = value;
    input.addEventListener("input", function () {
      out.textContent = format(+input.value);
      onInput(+input.value);
    });
    wrap.appendChild(head); wrap.appendChild(input);
    return wrap;
  }

  function bars(host) {
    var rows = CLASSES.map(function (c, k) {
      var row = el("div", "lab-bar");
      row.innerHTML =
        '<span class="lab-bar-name"><i class="lab-swatch lab-swatch--' + k + '"></i>' + c.name + "</span>" +
        '<span class="lab-bar-track"><span class="lab-bar-range"></span><span class="lab-bar-fill"></span>' +
        '<span class="lab-bar-mark"></span></span>' +
        '<span class="lab-bar-value"></span>';
      row.querySelector(".lab-bar-fill").style.background = rgb(c.rgb);
      row.querySelector(".lab-bar-range").style.background = rgb(c.rgb, 0.3);
      host.appendChild(row);
      return {
        row: row,
        fill: row.querySelector(".lab-bar-fill"),
        range: row.querySelector(".lab-bar-range"),
        mark: row.querySelector(".lab-bar-mark"),
        value: row.querySelector(".lab-bar-value")
      };
    });
    // p: solid bar; reach: how far the bar can get (shown lighter); tau: the mark.
    return function (p, reach, tau, inSet) {
      rows.forEach(function (r, k) {
        r.fill.style.width = (100 * p[k]) + "%";
        r.range.style.width = (100 * (reach ? reach[k] : p[k])) + "%";
        r.mark.style.left = (100 * tau) + "%";
        r.value.textContent = p[k].toFixed(2);
        r.row.classList.toggle("is-in", !!inSet[k]);
      });
    };
  }

  function setText(inSet) {
    var names = CLASSES.filter(function (c, k) { return inSet[k]; }).map(function (c) { return c.name; });
    return names.length ? "{ " + names.join(", ") + " }" : "{ } empty";
  }

  // Redraw on resize, and tell the lab whether it is on screen.
  function watch(figure, redraw, onVisible) {
    if ("ResizeObserver" in window) new ResizeObserver(redraw).observe(figure);
    else addEventListener("resize", redraw);
    if (onVisible && "IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        onVisible(entries[0].isIntersecting);
      }, { threshold: 0.2 }).observe(figure);
    }
  }

  /* ── lab: conformal prediction under attack ──────────────────────────────
     Three Gaussian classes in the plane; the classifier is their exact
     posterior (softmax of linear logits). Score s(x, y) = 1 - p(y | x).
     Standard set   C(x)   = { y : p(y | x) >= tau },  tau = 1 - q
     Attack         the worst x~ within distance eps of x for the true label
     Robust at test time     C_eps(x~) = { y : max over the eps-ball around x~ of p(y | .) >= tau }
        The clean x is inside that ball, so the set keeps the clean guarantee,
        at the price of a worst-case computation for every test point.
     Robust at calibration   tau_c from the worst-case score of every calibration
        point; the test set is the plain { y : p(y | x~) >= tau_c }, one model call.
        An attacked test score is at most its worst case, which is exchangeable
        with the calibration worst cases, so coverage holds under attack.
     Extremes over the ball are taken on DIRS boundary points; with linear logits
     log p is concave, so both the max and the min sit on the boundary.          */
  function conformalLab(figure) {
    var XR = 3, YR = 2.25;                    // the map shows [-XR, XR] x [-YR, YR]
    var MEANS = [[-1.15, -0.65], [1.15, -0.65], [0, 1.05]];
    var SIGMA = 0.85;
    var N_CAL = 200, N_TEST = 2000, DIRS = 32;
    var GW = 184, GH = 138;                   // map grid

    var state = { coverage: 0.9, eps: 0.3, mode: 0, x: -0.15, y: -0.2, calSeed: 1, touched: false };

    function probs(x, y, out) {
      var m = -Infinity, k, z = out || [0, 0, 0];
      for (k = 0; k < K; k++) {
        z[k] = (MEANS[k][0] * x + MEANS[k][1] * y -
          0.5 * (MEANS[k][0] * MEANS[k][0] + MEANS[k][1] * MEANS[k][1])) / (SIGMA * SIGMA);
        if (z[k] > m) m = z[k];
      }
      var s = 0;
      for (k = 0; k < K; k++) { z[k] = Math.exp(z[k] - m); s += z[k]; }
      for (k = 0; k < K; k++) z[k] /= s;
      return z;
    }

    var COS = [], SIN = [];
    for (var d = 0; d < DIRS; d++) {
      COS.push(Math.cos(2 * Math.PI * d / DIRS));
      SIN.push(Math.sin(2 * Math.PI * d / DIRS));
    }
    var tmp = [0, 0, 0];

    // Highest probability each class reaches within eps of (x, y).
    function reach(x, y, eps, out) {
      var p = probs(x, y, tmp), k, i;
      for (k = 0; k < K; k++) out[k] = p[k];
      if (!eps) return out;
      for (i = 0; i < DIRS; i++) {
        p = probs(x + eps * COS[i], y + eps * SIN[i], tmp);
        for (k = 0; k < K; k++) if (p[k] > out[k]) out[k] = p[k];
      }
      return out;
    }

    function sample(r, n) {
      var pts = [];
      for (var i = 0; i < n; i++) {
        var k = Math.floor(r() * K);
        pts.push({ k: k, x: MEANS[k][0] + SIGMA * gauss(r), y: MEANS[k][1] + SIGMA * gauss(r) });
      }
      return pts;
    }

    var test = sample(rng(4242), N_TEST);
    test.forEach(function (t) { t.p = probs(t.x, t.y).slice(); });
    var cal, calScores, calWorst, tau, tauCal, tauShown;

    function drawCalibration() {
      cal = sample(rng(1000 + state.calSeed), N_CAL);
      calScores = cal.map(function (c) { return 1 - probs(c.x, c.y)[c.k]; }).sort(function (a, b) { return a - b; });
    }

    // Lowest probability of class k within eps of (x, y): the attack on that label.
    function attack(x, y, k, eps) {
      var worst = probs(x, y, tmp)[k], ax = x, ay = y, p;
      for (var i = 0; i < DIRS && eps; i++) {
        p = probs(x + eps * COS[i], y + eps * SIN[i], tmp);
        if (p[k] < worst) { worst = p[k]; ax = x + eps * COS[i]; ay = y + eps * SIN[i]; }
      }
      return { p: worst, x: ax, y: ay };
    }

    // Everything that depends on eps but not on the threshold.
    var grid = { p: new Float32Array(GW * GH * K), reach: new Float32Array(GW * GH * K) };
    function recomputeEps() {
      var eps = state.eps, out = [0, 0, 0], i, j, k, p;
      for (j = 0; j < GH; j++) for (i = 0; i < GW; i++) {
        var x = -XR + 2 * XR * (i + 0.5) / GW, y = YR - 2 * YR * (j + 0.5) / GH, o = (j * GW + i) * K;
        p = probs(x, y, tmp);
        for (k = 0; k < K; k++) grid.p[o + k] = p[k];
        reach(x, y, eps, out);
        for (k = 0; k < K; k++) grid.reach[o + k] = out[k];
      }
      test.forEach(function (t) {
        t.reach = reach(t.x, t.y, eps, [0, 0, 0]);         // robust set on the clean point
        var hit = attack(t.x, t.y, t.k, eps);
        t.attacked = hit.p;                                       // p(true) at the attacked point
        t.attackedReach = reach(hit.x, hit.y, eps, [0, 0, 0])[t.k]; // what the test-time robust set sees there
      });
      calWorst = cal.map(function (c) { return 1 - attack(c.x, c.y, c.k, eps).p; }).sort(function (a, b) { return a - b; });
    }

    function stats() {
      var s = { cov: 0, covAtt: 0, size: 0, rCov: 0, rCovAtt: 0, rSize: 0, cCov: 0, cCovAtt: 0, cSize: 0 }, k;
      test.forEach(function (t) {
        if (t.p[t.k] >= tau) s.cov++;
        if (t.attacked >= tau) s.covAtt++;
        if (t.reach[t.k] >= tau) s.rCov++;
        if (t.attackedReach >= tau) s.rCovAtt++;
        if (t.p[t.k] >= tauCal) s.cCov++;
        if (t.attacked >= tauCal) s.cCovAtt++;
        for (k = 0; k < K; k++) {
          if (t.p[k] >= tau) s.size++;
          if (t.reach[k] >= tau) s.rSize++;
          if (t.p[k] >= tauCal) s.cSize++;
        }
      });
      Object.keys(s).forEach(function (key) { s[key] /= N_TEST; });
      return s;
    }

    /* build */
    var body = el("div", "lab-body");
    var main = el("div", "lab-main");
    var map = el("canvas", "lab-canvas lab-map");
    map.tabIndex = 0;
    map.setAttribute("role", "application");
    map.setAttribute("aria-label", "Input space of a three-class toy classifier. Move the pointer, tap, or use the arrow keys to move the test point.");
    main.appendChild(map);
    main.appendChild(el("div", "lab-legend",
      '<span><i class="lab-swatch lab-swatch--0"></i>only A</span>' +
      '<span><i class="lab-swatch lab-swatch--1"></i>only B</span>' +
      '<span><i class="lab-swatch lab-swatch--2"></i>only C</span>' +
      '<span><i class="lab-swatch lab-swatch--two"></i>two labels</span>' +
      '<span><i class="lab-swatch lab-swatch--three"></i>all three</span>' +
      '<span><i class="lab-swatch lab-swatch--none"></i>empty</span>'));

    var side = el("div", "lab-side");
    var setBlock = el("div", "lab-block");
    setBlock.appendChild(el("div", "lab-label", "Prediction set at the point"));
    var setOut = el("div", "lab-set");
    setOut.setAttribute("aria-live", "polite");
    setBlock.appendChild(setOut);
    var barHost = el("div", "lab-bars");
    setBlock.appendChild(barHost);
    var updateBars = bars(barHost);
    var barNote = el("p", "lab-note");
    setBlock.appendChild(barNote);

    var histBlock = el("div", "lab-block");
    var histLabel = el("div", "lab-label");
    var hist = el("canvas", "lab-canvas lab-hist");
    hist.setAttribute("role", "img");
    histBlock.appendChild(histLabel);
    histBlock.appendChild(hist);
    histBlock.appendChild(el("div", "lab-axis", "<span>0</span><span>score = 1 − p(true label)</span><span>1</span>"));

    var table = el("table", "lab-table");
    table.innerHTML =
      "<thead><tr><th></th><th>Coverage</th><th>Attacked</th><th>Set size</th><th>Model calls</th></tr></thead>" +
      "<tbody><tr><th>Standard</th><td></td><td></td><td></td><td>1</td></tr>" +
      "<tr><th>Robust at test time</th><td></td><td></td><td></td><td>" + (DIRS + 1) + "</td></tr>" +
      "<tr><th>Robust at calibration</th><td></td><td></td><td></td><td>1</td></tr></tbody>";
    var cells = table.querySelectorAll("td");

    side.appendChild(setBlock); side.appendChild(histBlock); side.appendChild(table);
    body.appendChild(main); body.appendChild(side);

    var controls = el("div", "lab-controls");
    controls.appendChild(slider("Target coverage", 0.7, 0.99, 0.01, state.coverage,
      function (v) { return Math.round(100 * v) + "%"; },
      function (v) { state.coverage = v; update(); }));
    controls.appendChild(slider("Attack radius ε", 0, 0.6, 0.02, state.eps,
      function (v) { return v.toFixed(2); },
      function (v) { state.eps = v; recomputeEps(); update(); }));
    var MODES = ["Standard", "Robust at test time", "Robust at calibration"];

    var seg = el("div", "lab-seg");
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", "Method shown on the map");
    var segButtons = MODES.map(function (label, i) {
      var b = el("button", "", label);
      b.type = "button";
      b.addEventListener("click", function () { state.mode = i; update(); });
      seg.appendChild(b);
      return b;
    });
    controls.appendChild(seg);

    var again = el("button", "lab-button", "New calibration draw");
    again.type = "button";
    again.addEventListener("click", function () { state.calSeed++; drawCalibration(); recomputeEps(); update(); });
    controls.appendChild(again);

    figure.insertBefore(controls, figure.firstChild);
    figure.insertBefore(body, controls);

    /* draw */
    var tile = document.createElement("canvas");
    tile.width = GW; tile.height = GH;
    var tileCtx = tile.getContext("2d");
    var image = tileCtx.createImageData(GW, GH);
    var TINT = CLASSES.map(function (c) { return mix(PAPER, c.rgb, 0.34); });
    var TWO = [217, 211, 198], THREE = [186, 179, 164], NONE = [255, 255, 255];

    function paintTile() {
      var src = state.mode === 1 ? grid.reach : grid.p;
      for (var c = 0; c < GW * GH; c++) {
        var n = 0, last = 0, k;
        for (k = 0; k < K; k++) if (src[c * K + k] >= tauShown) { n++; last = k; }
        var col = n === 0 ? NONE : n === 1 ? TINT[last] : n === 2 ? TWO : THREE;
        image.data[c * 4] = col[0]; image.data[c * 4 + 1] = col[1];
        image.data[c * 4 + 2] = col[2]; image.data[c * 4 + 3] = 255;
      }
      tileCtx.putImageData(image, 0, 0);
    }

    function drawMap() {
      var f = fit(map, XR / YR);
      if (!f) return;
      var ctx = f.ctx, w = f.w, h = f.h;
      var X = function (x) { return (x + XR) / (2 * XR) * w; };
      var Y = function (y) { return (YR - y) / (2 * YR) * h; };
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(tile, 0, 0, w, h);

      cal.forEach(function (c) {
        if (Math.abs(c.x) > XR || Math.abs(c.y) > YR) return;
        marker(ctx, c.k, X(c.x), Y(c.y), 2.6);
        ctx.fillStyle = rgb(CLASSES[c.k].rgb, 0.75);
        ctx.fill();
      });

      var px = X(state.x), py = Y(state.y);
      if (state.eps > 0) {
        ctx.beginPath();
        ctx.arc(px, py, state.eps / (2 * XR) * w, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(28,28,26,0.07)";
        ctx.fill();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.beginPath(); ctx.arc(px, py, 6.5, 0, 2 * Math.PI);
      ctx.fillStyle = rgb(PAPER); ctx.fill();
      ctx.beginPath(); ctx.arc(px, py, 4, 0, 2 * Math.PI);
      ctx.fillStyle = INK; ctx.fill();
    }

    function drawHist() {
      var f = fit(hist, 4.2);
      if (!f) return;
      var ctx = f.ctx, w = f.w, h = f.h, BINS = 28, counts = [], i, top = 0;
      for (i = 0; i < BINS; i++) counts.push(0);
      (state.mode === 2 ? calWorst : calScores).forEach(function (s) { counts[Math.min(BINS - 1, Math.floor(s * BINS))]++; });
      counts.forEach(function (c) { if (c > top) top = c; });
      var q = 1 - tauShown, bw = w / BINS;
      for (i = 0; i < BINS; i++) {
        var bh = (h - 4) * counts[i] / top;
        ctx.fillStyle = (i + 0.5) / BINS <= q ? ACCENT : "#c9c3b5";
        ctx.fillRect(i * bw + 1, h - bh, bw - 2, bh);
      }
      ctx.fillStyle = MAROON;
      ctx.fillRect(clamp(q * w - 1, 0, w - 2), 0, 2, h);
      ctx.fillStyle = RULE;
      ctx.fillRect(0, h - 1, w, 1);
      hist.setAttribute("aria-label", "Histogram of " + N_CAL + " calibration scores with the threshold at " + q.toFixed(2) + ".");
    }

    var pointReach = [0, 0, 0];
    function updatePoint() {
      var p = probs(state.x, state.y).slice();
      reach(state.x, state.y, state.eps, pointReach);
      var shown = state.mode === 1 ? pointReach : p;
      var inSet = shown.map(function (v) { return v >= tauShown; });
      setOut.textContent = setText(inSet);
      updateBars(p, state.mode === 1 ? pointReach : null, tauShown, inSet);
      barNote.textContent = [
        "A label is in the set when its bar reaches the mark.",
        "The bars stretch: a label is in when it can reach the mark anywhere within ε (lighter part).",
        "The mark moves instead: calibration already assumed the worst, so the bars stay as they are."
      ][state.mode];
    }

    function update() {
      tau = 1 - quantile(calScores, state.coverage);
      tauCal = 1 - quantile(calWorst, state.coverage);
      if (!state.eps) state.mode = 0;
      tauShown = state.mode === 2 ? tauCal : tau;
      segButtons.forEach(function (b, i) {
        b.setAttribute("aria-pressed", String(i === state.mode));
        b.disabled = i > 0 && !state.eps;
      });

      var s = stats();
      [pct(s.cov), pct(s.covAtt), s.size.toFixed(2), null,
       pct(s.rCov), pct(s.rCovAtt), s.rSize.toFixed(2), null,
       pct(s.cCov), pct(s.cCovAtt), s.cSize.toFixed(2), null]
        .forEach(function (text, i) { if (text != null) cells[i].textContent = text; });
      cells[1].classList.toggle("is-bad", s.covAtt < state.coverage - 0.02);
      for (var r = 1; r <= 3; r++) {
        table.rows[r].classList.toggle("is-idle", r > 1 && !state.eps);
        table.rows[r].classList.toggle("is-on", r - 1 === state.mode);
      }
      histLabel.innerHTML = N_CAL + (state.mode === 2 ? " worst-case" : "") + " calibration scores · threshold q̂ = " + (1 - tauShown).toFixed(2);

      paintTile(); drawMap(); drawHist(); updatePoint();
    }

    /* pointer + keyboard */
    function moveTo(event) {
      var box = map.getBoundingClientRect();
      state.x = clamp(-XR + 2 * XR * (event.clientX - box.left) / box.width, -XR, XR);
      state.y = clamp(YR - 2 * YR * (event.clientY - box.top) / box.height, -YR, YR);
      state.touched = true;
      drawMap(); updatePoint();
    }
    map.addEventListener("pointermove", function (e) {
      if (e.pointerType === "mouse" || e.buttons) moveTo(e);
    });
    map.addEventListener("pointerdown", moveTo);
    map.addEventListener("keydown", function (e) {
      var step = e.shiftKey ? 0.3 : 0.1;
      var dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      var dy = e.key === "ArrowDown" ? -step : e.key === "ArrowUp" ? step : 0;
      if (!dx && !dy) return;
      e.preventDefault();
      state.x = clamp(state.x + dx, -XR, XR);
      state.y = clamp(state.y + dy, -YR, YR);
      state.touched = true;
      drawMap(); updatePoint();
    });

    // Until someone takes over, the point wanders so the set visibly changes.
    var visible = false, wandering = false, t0 = 0;
    function wander(now) {
      if (!visible || state.touched) { wandering = false; return; }
      var t = (now - t0) / 1000;
      state.x = 1.5 * Math.sin(0.42 * t - 0.1);
      state.y = 0.15 + 0.85 * Math.sin(0.63 * t - 0.4);
      drawMap(); updatePoint();
      requestAnimationFrame(wander);
    }

    drawCalibration();
    recomputeEps();
    update();
    watch(figure, function () { drawMap(); drawHist(); }, function (isVisible) {
      visible = isVisible;
      if (visible && !wandering && !state.touched && !reducedMotion) {
        wandering = true;
        t0 = performance.now();
        requestAnimationFrame(wander);
      }
    });
  }

  /* ── the toy graph both graph labs use ───────────────────────────────────
     Three communities of 30 nodes, dense inside and sparse across. Every node
     has a noisy class probability vector: a model that reads only the node's
     own features. Layout is a short seeded force simulation, scaled to [0, 1]. */
  var toyGraphCache;
  function toyGraph() {
    if (toyGraphCache) return toyGraphCache;
    var N = 90, PER = 30, P_IN = 0.16, P_OUT = 0.012, SIGNAL = 1.6, NOISE = 1.3;
    var r = rng(3), i, j, k;

    var label = [], nb = [], P = [];
    for (i = 0; i < N; i++) { label.push(Math.floor(i / PER)); nb.push([]); }
    for (i = 0; i < N; i++) for (j = i + 1; j < N; j++) {
      if (r() < (label[i] === label[j] ? P_IN : P_OUT)) { nb[i].push(j); nb[j].push(i); }
    }
    for (i = 0; i < N; i++) if (!nb[i].length) {
      do { j = label[i] * PER + Math.floor(r() * PER); } while (j === i);
      nb[i].push(j); nb[j].push(i);
    }
    for (i = 0; i < N; i++) {
      var z = [], m = -Infinity, s = 0;
      for (k = 0; k < K; k++) { z.push((k === label[i] ? SIGNAL : 0) + NOISE * gauss(r)); m = Math.max(m, z[k]); }
      for (k = 0; k < K; k++) { z[k] = Math.exp(z[k] - m); s += z[k]; }
      P.push(z.map(function (v) { return v / s; }));
    }

    // Layout: a short force simulation from a seeded start. Coordinates end in [0, 1].
    var pos = [];
    (function () {
      var lr = rng(17), centers = [[-1, 0.7], [1, 0.7], [0, -0.9]], it, a, b, dx, dy, d2, d, f;
      for (i = 0; i < N; i++) pos.push([centers[label[i]][0] + 0.5 * gauss(lr), centers[label[i]][1] + 0.5 * gauss(lr)]);
      for (it = 0; it < 300; it++) {
        var force = pos.map(function (p) { return [-0.03 * p[0], -0.03 * p[1]]; });
        for (a = 0; a < N; a++) for (b = a + 1; b < N; b++) {
          dx = pos[a][0] - pos[b][0]; dy = pos[a][1] - pos[b][1]; d2 = dx * dx + dy * dy + 0.001;
          f = 0.012 / d2;
          force[a][0] += f * dx; force[a][1] += f * dy; force[b][0] -= f * dx; force[b][1] -= f * dy;
        }
        for (a = 0; a < N; a++) nb[a].forEach(function (c) {
          dx = pos[c][0] - pos[a][0]; dy = pos[c][1] - pos[a][1]; d = Math.sqrt(dx * dx + dy * dy);
          f = 0.06 * (d - 0.32);
          force[a][0] += f * dx / (d + 0.001); force[a][1] += f * dy / (d + 0.001);
        });
        var cool = 1 - it / 300;
        for (a = 0; a < N; a++) {
          pos[a][0] += clamp(force[a][0], -0.1, 0.1) * cool;
          pos[a][1] += clamp(force[a][1], -0.1, 0.1) * cool;
        }
      }
      var lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
      pos.forEach(function (p) { for (k = 0; k < 2; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); } });
      pos.forEach(function (p) { for (k = 0; k < 2; k++) p[k] = (p[k] - lo[k]) / (hi[k] - lo[k]); });
    })();

    toyGraphCache = { N: N, label: label, nb: nb, P: P, pos: pos };
    return toyGraphCache;
  }

  /* ── lab: conformal sets on a graph ──────────────────────────────────────
     Diffusion mixes a node's scores with the mean of its neighbours':
        s'(v, y) = (1 - lambda) s(v, y) + lambda * mean over neighbours u of s(u, y)
     with s = 1 - p. Half of the nodes calibrate, the other half are tested.
     The numbers in the table are averaged over SPLITS random halves.          */
  function graphLab(figure) {
    var G = toyGraph(), N = G.N, label = G.label, nb = G.nb, P = G.P, pos = G.pos, SPLITS = 300, i, j, k;

    var state = { coverage: 0.9, lambda: 0, splitSeed: 1, node: 0, touched: false };
    // Start on a node whose own prediction is wrong but whose neighbourhood is not.
    for (i = 0; i < N; i++) {
      var own = P[i].indexOf(Math.max.apply(null, P[i]));
      var agree = nb[i].filter(function (u) { return label[u] === label[i]; }).length;
      if (own !== label[i] && nb[i].length >= 4 && agree === nb[i].length) { state.node = i; break; }
    }

    function diffuse(lambda) {
      return P.map(function (p, v) {
        return p.map(function (pv, c) {
          var mean = 0;
          nb[v].forEach(function (u) { mean += P[u][c]; });
          return (1 - lambda) * pv + lambda * mean / nb[v].length;
        });
      });
    }

    var splits = [];
    (function () {
      var sr = rng(7);
      for (var s2 = 0; s2 < SPLITS; s2++) {
        var idx = [];
        for (i = 0; i < N; i++) idx.push(i);
        for (i = N - 1; i > 0; i--) { j = Math.floor(sr() * (i + 1)); k = idx[i]; idx[i] = idx[j]; idx[j] = k; }
        splits.push(idx);
      }
    })();

    function threshold(Q, calibration) {
      var scores = calibration.map(function (v) { return 1 - Q[v][label[v]]; }).sort(function (a, b) { return a - b; });
      return 1 - quantile(scores, state.coverage);
    }

    function average(Q) {
      var cov = 0, size = 0, count = 0, half = N / 2;
      splits.forEach(function (idx) {
        var tau = threshold(Q, idx.slice(0, half));
        for (var t = half; t < N; t++) {
          var v = idx[t];
          count++;
          if (Q[v][label[v]] >= tau) cov++;
          for (var c = 0; c < K; c++) if (Q[v][c] >= tau) size++;
        }
      });
      return { cov: cov / count, size: size / count };
    }

    /* build */
    var body = el("div", "lab-body");
    var main = el("div", "lab-main");
    var canvas = el("canvas", "lab-canvas lab-graph");
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "application");
    canvas.setAttribute("aria-label", "A graph of 90 nodes in three communities. Point at or tap a node to inspect it; arrow keys step through the nodes.");
    main.appendChild(canvas);
    main.appendChild(el("div", "lab-legend",
      '<span><i class="lab-swatch lab-size lab-size--1"></i>one label</span>' +
      '<span><i class="lab-swatch lab-size lab-size--2"></i>two</span>' +
      '<span><i class="lab-swatch lab-size lab-size--3"></i>three</span>' +
      '<span><i class="lab-swatch lab-size lab-size--cal"></i>calibration node</span>' +
      '<span><i class="lab-swatch lab-size lab-size--miss"></i>true label missed</span>' +
      "<span>shape: true class</span>"));

    var side = el("div", "lab-side");
    var block = el("div", "lab-block");
    var nodeLabel = el("div", "lab-label");
    var setOut = el("div", "lab-set");
    setOut.setAttribute("aria-live", "polite");
    var barHost = el("div", "lab-bars");
    block.appendChild(nodeLabel); block.appendChild(setOut); block.appendChild(barHost);
    var updateBars = bars(barHost);
    var note = el("p", "lab-note");
    block.appendChild(note);

    var table = el("table", "lab-table");
    table.innerHTML =
      "<thead><tr><th></th><th>Coverage</th><th>Set size</th></tr></thead>" +
      "<tbody><tr><th>Node alone</th><td></td><td></td></tr>" +
      "<tr><th>With neighbours</th><td></td><td></td></tr></tbody>";
    var cells = table.querySelectorAll("td");
    side.appendChild(block); side.appendChild(table);
    side.appendChild(el("p", "lab-note", "Averaged over " + SPLITS + " random calibration / test halves."));
    body.appendChild(main); body.appendChild(side);

    var controls = el("div", "lab-controls");
    controls.appendChild(slider("Neighbour weight λ", 0, 0.9, 0.05, state.lambda,
      function (v) { return v.toFixed(2); },
      function (v) { state.lambda = v; update(); }));
    controls.appendChild(slider("Target coverage", 0.7, 0.97, 0.01, state.coverage,
      function (v) { return Math.round(100 * v) + "%"; },
      function (v) { state.coverage = v; update(); }));
    var again = el("button", "lab-button", "New calibration split");
    again.type = "button";
    again.addEventListener("click", function () { state.splitSeed = (state.splitSeed + 1) % SPLITS; update(); });
    controls.appendChild(again);

    figure.insertBefore(controls, figure.firstChild);
    figure.insertBefore(body, controls);

    /* draw */
    var SIZE_FILL = ["#ffffff", "#2a3f5c", "#8194b0", "#cdd5e0"];
    var Q, tau, isCal;
    var ASPECT = 1.25, PAD = 18;

    function place(f) {
      return pos.map(function (p) { return [PAD + p[0] * (f.w - 2 * PAD), PAD + p[1] * (f.h - 2 * PAD)]; });
    }

    function draw() {
      var f = fit(canvas, ASPECT);
      if (!f) return;
      var ctx = f.ctx, xy = place(f), v;
      var near = {};
      nb[state.node].forEach(function (u) { near[u] = true; });

      ctx.lineWidth = 1;
      for (v = 0; v < N; v++) nb[v].forEach(function (u) {
        if (u < v) return;
        var hot = v === state.node || u === state.node;
        ctx.strokeStyle = hot ? INK : "rgba(116,113,106,0.28)";
        ctx.lineWidth = hot ? 1.6 : 1;
        ctx.beginPath(); ctx.moveTo(xy[v][0], xy[v][1]); ctx.lineTo(xy[u][0], xy[u][1]); ctx.stroke();
      });

      for (v = 0; v < N; v++) {
        var size = 0, c;
        for (c = 0; c < K; c++) if (Q[v][c] >= tau) size++;
        var missed = Q[v][label[v]] < tau;
        var radius = v === state.node ? 8 : 5.5;
        marker(ctx, label[v], xy[v][0], xy[v][1], radius);
        if (isCal[v]) {
          ctx.fillStyle = rgb(PAPER); ctx.fill();
          ctx.strokeStyle = MUTED; ctx.lineWidth = 1.3; ctx.stroke();
        } else {
          ctx.fillStyle = SIZE_FILL[size]; ctx.fill();
          ctx.strokeStyle = missed ? MAROON : (size === 0 ? MUTED : "rgba(28,28,26,0.35)");
          ctx.lineWidth = missed ? 2.4 : 1; ctx.stroke();
        }
        if (v === state.node) {
          marker(ctx, label[v], xy[v][0], xy[v][1], radius + 4);
          ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
        }
      }
    }

    function updateNode() {
      var v = state.node;
      var inSet = Q[v].map(function (p) { return p >= tau; });
      nodeLabel.innerHTML = "Node " + (v + 1) + " · true label " + CLASSES[label[v]].name + " · " +
        nb[v].length + " neighbour" + (nb[v].length === 1 ? "" : "s") + (isCal[v] ? " · calibration" : "");
      setOut.textContent = setText(inSet);
      updateBars(Q[v], null, tau, inSet);
      note.textContent = state.lambda
        ? "Bars: the node's probabilities mixed with its neighbours' mean."
        : "Bars: the node's own probabilities. Raise λ to mix in its neighbours.";
    }

    function update() {
      Q = diffuse(state.lambda);
      var idx = splits[state.splitSeed % SPLITS], half = N / 2;
      isCal = [];
      idx.slice(0, half).forEach(function (v) { isCal[v] = true; });
      tau = threshold(Q, idx.slice(0, half));

      var alone = average(P), mixed = average(Q);
      [pct(alone.cov), alone.size.toFixed(2), pct(mixed.cov), mixed.size.toFixed(2)]
        .forEach(function (text, c) { cells[c].textContent = text; });
      table.rows[2].classList.toggle("is-idle", !state.lambda);
      draw(); updateNode();
    }

    /* pointer + keyboard */
    function pick(event) {
      var box = canvas.getBoundingClientRect();
      var xy = place({ w: box.width, h: box.height });
      var best = -1, bestD = 26 * 26;
      xy.forEach(function (p, v) {
        var dx = p[0] - (event.clientX - box.left), dy = p[1] - (event.clientY - box.top);
        if (dx * dx + dy * dy < bestD) { bestD = dx * dx + dy * dy; best = v; }
      });
      if (best < 0 || best === state.node) return;
      state.node = best; state.touched = true;
      draw(); updateNode();
    }
    canvas.addEventListener("pointermove", function (e) { if (e.pointerType === "mouse") pick(e); });
    canvas.addEventListener("pointerdown", pick);
    canvas.addEventListener("keydown", function (e) {
      var step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      state.node = (state.node + step + N) % N; state.touched = true;
      draw(); updateNode();
    });

    update();
    watch(figure, draw);
  }

  /* ── lab: evolutionary attack on a graph ─────────────────────────────────
     The classifier: one round of message passing on the toy graph, each node
     predicts argmax of (1 - MIX) * own probabilities + MIX * neighbours' mean.
     The attacker may flip BUDGET edges (add or remove) and wants low accuracy.
     Accuracy is not differentiable in the edges, so search instead of descend:
     keep a population of candidate flip sets, score each by the accuracy it
     leaves, keep the best, and breed the next generation by crossover and
     mutation. The grey line is random search given the same number of model
     evaluations, as a reference.                                              */
  function evolutionLab(figure) {
    var G = toyGraph(), N = G.N, label = G.label, P = G.P, pos = G.pos;
    var MIX = 0.8, POP = 32, ELITE = 6, GENERATIONS = 150, MUTATION = 0.12;
    var PAIRS = N * (N - 1) / 2;
    var edgeCount = 0, i;
    var base = G.nb.map(function (list) {
      var set = {};
      list.forEach(function (u) { set[u] = true; });
      edgeCount += list.length;
      return set;
    });
    edgeCount /= 2;

    var state = { budget: 12, gen: 0, running: false, run: 0 };
    var r, population, best, randomBest, history, randomHistory;

    function pairOf(code) {            // code in [0, PAIRS) -> (a, b) with a < b
      var a = 0, left = code;
      while (left >= N - 1 - a) { left -= N - 1 - a; a++; }
      return [a, a + 1 + left];
    }

    // Accuracy of the classifier after toggling the given edges; also who is wrong.
    function evaluate(flips, wrongOut) {
      var touched = {}, v, c;
      flips.forEach(function (code) {
        var e = pairOf(code);
        (touched[e[0]] = touched[e[0]] || {})[e[1]] = true;
        (touched[e[1]] = touched[e[1]] || {})[e[0]] = true;
      });
      var correct = 0;
      for (v = 0; v < N; v++) {
        var sum = [0, 0, 0], deg = 0, u, t = touched[v];
        for (u in base[v]) if (!(t && t[u])) { deg++; for (c = 0; c < K; c++) sum[c] += P[u][c]; }
        if (t) for (u in t) if (!base[v][u]) { deg++; for (c = 0; c < K; c++) sum[c] += P[u][c]; }
        var bestC = 0, bestV = -1;
        for (c = 0; c < K; c++) {
          var val = deg ? (1 - MIX) * P[v][c] + MIX * sum[c] / deg : P[v][c];
          if (val > bestV) { bestV = val; bestC = c; }
        }
        if (bestC === label[v]) correct++;
        else if (wrongOut) wrongOut[v] = true;
      }
      return correct / N;
    }
    var cleanAccuracy = evaluate([]);

    function randomFlips() {
      var flips = [];
      while (flips.length < state.budget) {
        var code = Math.floor(r() * PAIRS);
        if (flips.indexOf(code) === -1) flips.push(code);
      }
      return flips;
    }
    function scored(flips) { return { flips: flips, acc: evaluate(flips) }; }
    function byAccuracy(a, b) { return a.acc - b.acc; }

    function reset() {
      r = rng(100 + state.budget);
      state.gen = 0; state.running = false; state.run++;
      population = [];
      for (i = 0; i < POP; i++) population.push(scored(randomFlips()));
      population.sort(byAccuracy);
      best = population[0];
      randomBest = best;                 // the first generation is random search for both
      history = [best.acc]; randomHistory = [best.acc];
    }

    function pickParent() {              // tournament among the better half
      var a = Math.floor(r() * POP / 2), b = Math.floor(r() * POP / 2);
      return population[Math.min(a, b)];
    }

    function generation() {
      var next = population.slice(0, ELITE), k2;
      while (next.length < POP) {
        var pool = pickParent().flips.concat(pickParent().flips), child = [];
        while (child.length < state.budget && pool.length) {       // crossover
          var code = pool.splice(Math.floor(r() * pool.length), 1)[0];
          if (child.indexOf(code) === -1) child.push(code);
        }
        for (k2 = 0; k2 < state.budget; k2++) {                    // mutation
          if (k2 >= child.length || r() < MUTATION) {
            var fresh;
            do { fresh = Math.floor(r() * PAIRS); } while (child.indexOf(fresh) !== -1);
            child[k2] = fresh;
          }
        }
        next.push(scored(child));
      }
      population = next.sort(byAccuracy);
      best = population[0];
      for (k2 = 0; k2 < POP - ELITE; k2++) {                       // random search, same evaluations
        var candidate = scored(randomFlips());
        if (candidate.acc < randomBest.acc) randomBest = candidate;
      }
      state.gen++;
      history.push(best.acc); randomHistory.push(randomBest.acc);
    }

    /* build */
    var body = el("div", "lab-body");
    var main = el("div", "lab-main");
    var canvas = el("canvas", "lab-canvas lab-graph");
    canvas.setAttribute("role", "img");
    main.appendChild(canvas);
    main.appendChild(el("div", "lab-legend",
      '<span><i class="lab-swatch lab-swatch--right"></i>classified correctly</span>' +
      '<span><i class="lab-swatch lab-swatch--wrong"></i>misclassified</span>' +
      '<span><i class="lab-swatch lab-swatch--added"></i>edge added</span>' +
      '<span><i class="lab-swatch lab-swatch--removed"></i>edge removed</span>' +
      "<span>shape: true class</span>"));

    var side = el("div", "lab-side");
    var block = el("div", "lab-block");
    block.appendChild(el("div", "lab-label", "Accuracy under attack"));
    var big = el("div", "lab-big");
    big.setAttribute("aria-live", "polite");
    block.appendChild(big);
    var chart = el("canvas", "lab-canvas lab-chart");
    chart.setAttribute("role", "img");
    block.appendChild(chart);
    var axis = el("div", "lab-axis");
    block.appendChild(axis);
    block.appendChild(el("div", "lab-legend",
      '<span><i class="lab-swatch lab-swatch--line"></i>evolution</span>' +
      '<span><i class="lab-swatch lab-swatch--line-quiet"></i>random search, same evaluations</span>'));

    var table = el("table", "lab-table");
    table.innerHTML =
      "<thead><tr><th></th><th>Accuracy</th></tr></thead>" +
      "<tbody><tr><th>No attack</th><td>" + pct(cleanAccuracy) + "</td></tr>" +
      "<tr><th>Random search</th><td></td></tr>" +
      "<tr><th>Evolution</th><td></td></tr></tbody>";
    var cells = table.querySelectorAll("td");
    side.appendChild(block); side.appendChild(table);
    body.appendChild(main); body.appendChild(side);

    var controls = el("div", "lab-controls");
    controls.appendChild(slider("Edge flips allowed", 2, 30, 1, state.budget,
      function (v) { return v + " (" + (100 * v / edgeCount).toFixed(1) + "% of edges)"; },
      function (v) { state.budget = v; reset(); started = true; play(); }));
    var go = el("button", "lab-button lab-button--primary", "Run the attack");
    go.type = "button";
    go.addEventListener("click", function () { reset(); started = true; play(); });
    controls.appendChild(go);

    figure.insertBefore(controls, figure.firstChild);
    figure.insertBefore(body, controls);

    /* draw */
    function drawGraph() {
      var f = fit(canvas, 1.25);
      if (!f) return;
      var ctx = f.ctx, PAD = 18, v;
      var xy = pos.map(function (p) { return [PAD + p[0] * (f.w - 2 * PAD), PAD + p[1] * (f.h - 2 * PAD)]; });
      var flipped = {}, wrong = {};
      best.flips.forEach(function (code) { flipped[code] = true; });
      evaluate(best.flips, wrong);

      function segment(a, b) { ctx.beginPath(); ctx.moveTo(xy[a][0], xy[a][1]); ctx.lineTo(xy[b][0], xy[b][1]); ctx.stroke(); }
      ctx.lineWidth = 1; ctx.strokeStyle = "rgba(116,113,106,0.26)";
      for (v = 0; v < N; v++) for (var u in base[v]) if (+u > v) segment(v, +u);
      best.flips.forEach(function (code) {
        var e = pairOf(code), removed = base[e[0]][e[1]];
        ctx.strokeStyle = removed ? "#c9a0a7" : MAROON;
        ctx.lineWidth = removed ? 2.2 : 1.8;
        ctx.setLineDash(removed ? [5, 4] : []);
        segment(e[0], e[1]);
      });
      ctx.setLineDash([]);

      for (v = 0; v < N; v++) {
        marker(ctx, label[v], xy[v][0], xy[v][1], 5.5);
        ctx.fillStyle = wrong[v] ? "#ffffff" : "#2a3f5c";
        ctx.fill();
        ctx.strokeStyle = wrong[v] ? MAROON : "rgba(28,28,26,0.35)";
        ctx.lineWidth = wrong[v] ? 2.2 : 1;
        ctx.stroke();
      }
      canvas.setAttribute("aria-label", "Toy graph after " + state.gen + " generations: " + best.flips.length +
        " edges flipped, accuracy " + pct(best.acc) + ".");
    }

    function drawChart() {
      var f = fit(chart, 2.6);
      if (!f) return;
      var ctx = f.ctx, w = f.w, h = f.h;
      var lo = Math.min(0.3, Math.floor(10 * Math.min(best.acc, randomBest.acc)) / 10);
      var hi = Math.ceil(10 * cleanAccuracy) / 10;
      var X = function (g) { return 2 + (w - 4) * g / GENERATIONS; };
      var Y = function (a) { return 4 + (h - 8) * (hi - a) / (hi - lo); };
      ctx.fillStyle = RULE; ctx.fillRect(0, h - 1, w, 1);
      ctx.setLineDash([3, 4]); ctx.strokeStyle = MUTED; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, Y(cleanAccuracy)); ctx.lineTo(w, Y(cleanAccuracy)); ctx.stroke();
      ctx.setLineDash([]);
      [[randomHistory, "#a9a394", 2], [history, MAROON, 2.4]].forEach(function (line) {
        ctx.strokeStyle = line[1]; ctx.lineWidth = line[2]; ctx.lineJoin = "round";
        ctx.beginPath();
        line[0].forEach(function (a, g) { if (g) ctx.lineTo(X(g), Y(a)); else ctx.moveTo(X(g), Y(a)); });
        ctx.stroke();
      });
      ctx.fillStyle = MAROON;
      ctx.beginPath(); ctx.arc(X(state.gen), Y(best.acc), 3.5, 0, 2 * Math.PI); ctx.fill();
      axis.innerHTML = "<span>generation 0</span><span>dashed: no attack</span><span>" + GENERATIONS + "</span>";
      chart.setAttribute("aria-label", "Accuracy by generation. Evolution reaches " + pct(best.acc) +
        ", random search " + pct(randomBest.acc) + ", from " + pct(cleanAccuracy) + " without attack.");
    }

    function render() {
      big.innerHTML = pct(cleanAccuracy) + " <span>→</span> " + pct(best.acc) +
        ' <span style="font-size:14px;font-family:var(--sans)">generation ' + state.gen + "</span>";
      cells[1].textContent = pct(randomBest.acc);
      cells[2].textContent = pct(best.acc);
      drawGraph(); drawChart();
    }

    var started = false;
    function play() {
      if (reducedMotion) { while (state.gen < GENERATIONS) generation(); render(); return; }
      state.running = true;
      var id = state.run;
      requestAnimationFrame(function tick() {
        if (id !== state.run || !state.running) return;
        generation();
        render();
        if (state.gen < GENERATIONS) requestAnimationFrame(tick);
        else state.running = false;
      });
    }

    reset();
    render();
    watch(figure, function () { drawGraph(); drawChart(); }, function (isVisible) {
      if (isVisible && !started) { started = true; play(); }
    });
  }

  /* ── boot ────────────────────────────────────────────────────────────── */

  var LABS = { robust: conformalLab, graph: graphLab, evolution: evolutionLab };

  function boot(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll("figure[data-lab]"), function (figure) {
      var make = LABS[figure.getAttribute("data-lab")];
      if (!make || figure.hasAttribute("data-lab-ready")) return;
      figure.setAttribute("data-lab-ready", "");
      try { make(figure); }
      catch (err) { console.error("[lab] " + figure.getAttribute("data-lab"), err); }
    });
  }

  window.siteLab = { boot: boot };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { boot(); });
  else boot();
})();
