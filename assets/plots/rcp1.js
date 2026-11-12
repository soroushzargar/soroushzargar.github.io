/* ==========================================================================
   Plots for "One Sample is Enough to Make Conformal Prediction Robust" (RCP1).

   One toy model feeds all four plots. Three classes in the plane, Gaussian
   blobs around the corners of a triangle, and the Bayes softmax as the
   classifier. The conformity score of a label is its softmax probability at a
   noisy copy of the input, s(x + eps, y), with eps ~ N(0, SIGMA^2 I) and ONE
   noise draw per input. Conformal calibration takes the usual finite-sample
   quantile of these scores. The attack moves each test input by r against the
   gradient of its true-label log-probability. The certified bound is the
   Gaussian one: a probability p can fall at most to Phi(Phi^-1(p) - r / sigma).

   Colours across the post: BLUE single sample / RCP1, ORANGE many samples,
   GREEN covered and the target, RED the attack and misses, GOLD the bound.
   ========================================================================== */
sitePlots.define(function (kit) {
  "use strict";

  var T = kit.text, E = kit.ease, EO = kit.easeOut;

  /* ── toy model ─────────────────────────────────────────────────────────── */

  var SIGMA = 0.5;          // smoothing noise
  var SPREAD = 0.7;         // class spread
  var ALPHA = 0.1;          // target miscoverage
  var MU = [90, 210, 330].map(function (d) {
    var a = d * Math.PI / 180;
    return [Math.cos(a), Math.sin(a)];
  });

  function probs(x0, x1) {
    var z = MU.map(function (m) {
      var a = x0 - m[0], b = x1 - m[1];
      return -(a * a + b * b) / (2 * SPREAD * SPREAD);
    });
    var mx = Math.max(z[0], z[1], z[2]);
    var e = z.map(function (v) { return Math.exp(v - mx); });
    var s = e[0] + e[1] + e[2];
    return [e[0] / s, e[1] / s, e[2] / s];
  }

  // direction that lowers the true-label log-probability fastest (unit vector)
  function attackDir(x0, x1, y) {
    var p = probs(x0, x1), g0 = 0, g1 = 0, s2 = SPREAD * SPREAD;
    for (var k = 0; k < 3; k++) {
      var w = (k === y ? 1 : 0) - p[k];
      g0 += w * -(x0 - MU[k][0]) / s2;
      g1 += w * -(x1 - MU[k][1]) / s2;
    }
    var n = Math.hypot(g0, g1) || 1;
    return [-g0 / n, -g1 / n];
  }

  var rnd = kit.rng(20251215);
  function sample() {
    var y = Math.floor(rnd() * 3);
    return { x: [MU[y][0] + SPREAD * kit.gauss(rnd), MU[y][1] + SPREAD * kit.gauss(rnd)], y: y };
  }
  function noise() { return [SIGMA * kit.gauss(rnd), SIGMA * kit.gauss(rnd)]; }

  // calibration: one noisy copy per point
  var N_CAL = 2000, CAL = [];
  for (var i = 0; i < N_CAL; i++) {
    var c = sample(), e = noise();
    CAL.push(probs(c.x[0] + e[0], c.x[1] + e[1])[c.y]);
  }
  var CAL_SORTED = CAL.slice().sort(function (a, b) { return a - b; });
  function threshold(level) {        // conformal quantile for coverage >= level
    var k = Math.floor((1 - level) * (N_CAL + 1));
    return k < 1 ? -Infinity : CAL_SORTED[k - 1];
  }

  // test points, each with a few fixed noise draws (the procedure uses one at a time)
  var N_TEST = 2000, K = 4, TEST = [];
  for (i = 0; i < N_TEST; i++) {
    var s = sample(), eps = [];
    for (var j = 0; j < K; j++) eps.push(noise());
    TEST.push({ x: s.x, y: s.y, d: attackDir(s.x[0], s.x[1], s.y), eps: eps });
  }

  // coverage of the procedure at threshold q when each test input is moved by r (absolute units)
  function coverage(q, r) {
    var hit = 0;
    TEST.forEach(function (p) {
      var a0 = p.x[0] + r * p.d[0], a1 = p.x[1] + r * p.d[1];
      p.eps.forEach(function (e) { if (probs(a0 + e[0], a1 + e[1])[p.y] >= q) hit++; });
    });
    return hit / (N_TEST * K);
  }
  function setSize(q) {
    var n = 0;
    TEST.forEach(function (p) {
      p.eps.forEach(function (e) {
        probs(p.x[0] + e[0], p.x[1] + e[1]).forEach(function (v) { if (v >= q) n++; });
      });
    });
    return n / (N_TEST * K);
  }

  // standard normal cdf and its inverse
  function Phi(z) {
    var t = 1 / (1 + 0.2316419 * Math.abs(z));
    var d = 0.3989422804 * Math.exp(-z * z / 2);
    var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - p : p;
  }
  function PhiInv(p) {
    var lo = -10, hi = 10;
    for (var it = 0; it < 80; it++) { var m = (lo + hi) / 2; if (Phi(m) < p) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  function bound(level, rs) { return Phi(PhiInv(level) - rs); }        // rs = r / sigma
  function robustLevel(rs) { return Phi(PhiInv(1 - ALPHA) + rs); }     // calibrate here for radius rs

  function pct(v, d) { return (100 * v).toFixed(d === undefined ? 1 : d) + "%"; }

  /* ── plot 1: forward passes per input ──────────────────────────────────── */

  var X_IN = [0.32, 0.38], Y_IN = 0, N_MC = 100;
  var r1 = kit.rng(7);
  var MC = [];
  for (i = 0; i < N_MC; i++) MC.push([SIGMA * kit.gauss(r1), SIGMA * kit.gauss(r1)]);
  var MC_MEAN = [], acc = 0;
  MC.forEach(function (e, k) {
    acc += probs(X_IN[0] + e[0], X_IN[1] + e[1])[Y_IN];
    MC_MEAN.push(acc / (k + 1));
  });
  var ONE = [SIGMA * kit.gauss(r1), SIGMA * kit.gauss(r1)];
  var ONE_SCORE = probs(X_IN[0] + ONE[0], X_IN[1] + ONE[1])[Y_IN];

  function plane(cx, cy, half, scale) {
    kit.rect(cx - half, cy - half, 2 * half, 2 * half, 10, null, { stroke: kit.LINE, lineWidth: 2 });
    [30, 150, 270].forEach(function (d) {      // decision boundaries of the toy classifier
      var a = d * Math.PI / 180, L = half / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
      kit.line([[cx, cy], [cx + L * Math.cos(a), cy - L * Math.sin(a)]], kit.LINE, 2);
    });
    ["A", "B", "C"].forEach(function (s, k) {
      T("class " + s, cx + MU[k][0] * scale * 1.55, cy - MU[k][1] * scale * 1.55 + 7,
        { size: 20, color: kit.MUTED, align: "center" });
    });
  }

  function passes(t) {
    var half = 140, scale = 92, cy = 210;
    var panels = [
      { cx: 225, title: "Monte Carlo smoothing", col: kit.ORANGE },
      { cx: 655, title: "One sample (RCP1)", col: kit.BLUE }
    ];
    var nMC = Math.round(N_MC * Math.pow(kit.clamp((t - 2.2) / 5.6, 0, 1), 1.6));
    var one = E(t, 0.8, 1.4);
    var counts = [nMC, one > 0.5 ? 1 : 0];

    panels.forEach(function (P, k) {
      T(P.title, P.cx, 40, { size: 24, weight: 600, color: P.col, align: "center" });
      plane(P.cx, cy, half, scale);
      var px = function (v) { return [P.cx + v[0] * scale, cy - v[1] * scale]; };
      var x = px(X_IN);
      if (k === 0) {
        var c0 = kit.ctx();
        c0.save(); c0.beginPath(); c0.roundRect(P.cx - half, cy - half, 2 * half, 2 * half, 10); c0.clip();
        for (var m = 0; m < nMC; m++) {
          var q = px([X_IN[0] + MC[m][0], X_IN[1] + MC[m][1]]);
          kit.dot(q[0], q[1], 4.5, P.col, { alpha: m === nMC - 1 ? 1 : 0.55 });
        }
        c0.restore();
      } else if (one > 0) {
        var q1 = px([X_IN[0] + ONE[0], X_IN[1] + ONE[1]]);
        kit.line([x, [kit.lerp(x[0], q1[0], one), kit.lerp(x[1], q1[1], one)]], P.col, 2, { alpha: 0.6 });
        kit.dot(q1[0], q1[1], 7, P.col, { alpha: one });
      }
      kit.dot(x[0], x[1], 7, kit.FG);
      T("x", x[0] - 12, x[1] - 10, { size: 24, fam: kit.SERIF, italic: true, align: "right" });

      var n = counts[k];
      T(n + (n === 1 ? " forward pass" : " forward passes"), P.cx, 400,
        { size: 26, weight: 700, color: n ? P.col : kit.MUTED, align: "center" });
      var sc = k === 0 ? (nMC ? MC_MEAN[nMC - 1].toFixed(2) : "–") : (n ? ONE_SCORE.toFixed(2) : "–");
      T((k === 0 ? "averaged score " : "score ") + sc, P.cx, 432, { size: 22, color: kit.MUTED, align: "center" });
    });
  }

  /* ── plot 2: calibrate on single-noisy-sample scores ───────────────────── */

  var BINS = 25, HIST = new Array(BINS).fill(0);
  CAL.forEach(function (v) { HIST[Math.min(BINS - 1, Math.floor(v * BINS))]++; });
  var HMAX = Math.max.apply(null, HIST);
  var Q90 = threshold(1 - ALPHA);
  var TEST_ONE = TEST.map(function (p) {   // the first noise draw only: one forward pass per test input
    return probs(p.x[0] + p.eps[0][0], p.x[1] + p.eps[0][1])[p.y];
  });
  var COVER_RUN = [], hits = 0;
  TEST_ONE.forEach(function (v, k) { if (v >= Q90) hits++; COVER_RUN.push(hits / (k + 1)); });

  function calib(t) {
    var L = 70, R = 840, TOP = 100, BASE = 290;
    var X = function (v) { return L + (R - L) * v; };
    kit.axes(L, BASE, R, TOP);
    [0, 0.25, 0.5, 0.75, 1].forEach(function (v) {
      T(String(v), X(v), BASE + 28, { size: 20, color: kit.MUTED, align: "center" });
    });
    T("calibration scores, each from one noisy copy: s(x + ε, y)", L, 36, { size: 22, color: kit.MUTED });

    var g = EO(t, 0.5, 2.6), bw = (R - L) / BINS;
    HIST.forEach(function (h, b) {
      var hh = (BASE - TOP - 10) * h / HMAX * g;
      var below = (b + 1) / BINS <= Q90 + 1e-9;
      kit.rect(X(b / BINS) + 2, BASE - hh, bw - 4, hh, 3, kit.BLUE, { alpha: below && t > 3.6 ? 0.3 : 0.65 });
    });

    // the threshold slides in
    var qa = E(t, 2.8, 3.8), qx = X(Q90 * qa);
    if (qa > 0) {
      kit.line([[qx, TOP - 4], [qx, BASE]], kit.FG, 2.5, { dash: [7, 6], alpha: qa });
      T("q̂", qx + 10, TOP + 22, { size: 24, fam: kit.SERIF, italic: true, alpha: qa });
      T("10% of scores", qx + 10, TOP + 50, { size: 20, color: kit.MUTED, alpha: E(t, 3.6, 4.2) });
      T("fall below", qx + 10, TOP + 74, { size: 20, color: kit.MUTED, alpha: E(t, 3.6, 4.2) });
    }

    // fresh test inputs arrive, one noisy copy each
    var RY = 330, RH = 34;
    T("test", L - 10, RY + 25, { size: 20, color: kit.MUTED, align: "right" });
    kit.rect(L, RY, R - L, RH, 6, kit.SOFT);
    var nT = Math.round(N_TEST * Math.pow(kit.clamp((t - 4.6) / 5.0, 0, 1), 1.4));
    var c = kit.ctx();
    c.save(); c.globalAlpha *= 0.35; c.lineWidth = 1.5;
    for (var k = 0; k < nT; k++) {
      var v = TEST_ONE[k];
      c.strokeStyle = v >= Q90 ? kit.GREEN : kit.RED;
      var xx = X(v);
      c.beginPath(); c.moveTo(xx, RY + 4); c.lineTo(xx, RY + RH - 4); c.stroke();
    }
    c.restore();
    var la = E(t, 4.8, 5.4);
    T("missed", X(Q90) - 12, RY + RH + 28, { size: 20, color: kit.RED, weight: 600, align: "right", alpha: la });
    T("covered", X(Q90) + 12, RY + RH + 28, { size: 20, color: kit.GREEN, weight: 600, alpha: la });

    var cov = nT ? COVER_RUN[nT - 1] : 0;
    T("coverage " + (nT ? pct(cov) : "–"), R, 36, { size: 26, weight: 700, color: kit.GREEN, align: "right" });
    T(nT + " test inputs, target 90%", R, 66, { size: 20, color: kit.MUTED, align: "right" });
  }

  /* ── plot 3: certify the procedure, then calibrate higher ──────────────── */

  var RS_MAX = 0.8, RS_DESIGN = 0.5, NR = 33;
  var RGRID = [];
  for (i = 0; i < NR; i++) RGRID.push(RS_MAX * i / (NR - 1));
  var LEVEL_R = robustLevel(RS_DESIGN);
  var Q_PLAIN = threshold(1 - ALPHA), Q_ROB = threshold(LEVEL_R);
  var COV_PLAIN = RGRID.map(function (rs) { return coverage(Q_PLAIN, rs * SIGMA); });
  var COV_ROB = RGRID.map(function (rs) { return coverage(Q_ROB, rs * SIGMA); });
  var CLEAN_ROB = COV_ROB[0];

  function spread(items, gap) {      // push label y-positions apart, keeping order
    items.sort(function (a, b) { return a.y - b.y; });
    for (var k = 1; k < items.length; k++) if (items[k].y < items[k - 1].y + gap) items[k].y = items[k - 1].y + gap;
    return items;
  }

  function certify(t) {
    var L = 90, R = 640, TOP = 70, BASE = 420, YLO = 0.7, YHI = 1.0;
    var X = function (rs) { return L + (R - L) * rs / RS_MAX; };
    var Y = function (v) { return BASE - (BASE - TOP) * (v - YLO) / (YHI - YLO); };
    kit.axes(L, BASE, R, TOP);
    [0.7, 0.8, 0.9, 1.0].forEach(function (v) {
      T((v * 100).toFixed(0) + "%", L - 10, Y(v) + 7, { size: 20, color: kit.MUTED, align: "right" });
    });
    [0, 0.2, 0.4, 0.6, 0.8].forEach(function (v) {
      T(String(v), X(v), BASE + 28, { size: 20, color: kit.MUTED, align: "center" });
    });
    T("attack radius r / σ", (L + R) / 2, BASE + 58, { size: 22, color: kit.MUTED, align: "center" });
    T("coverage under attack", L, 36, { size: 22, color: kit.MUTED });
    kit.line([[L, Y(0.9)], [R, Y(0.9)]], kit.GREEN, 2, { dash: [8, 7] });

    // design radius
    var da = E(t, 5.2, 5.8);
    kit.line([[X(RS_DESIGN), TOP], [X(RS_DESIGN), BASE]], kit.MUTED, 1.5, { dash: [3, 6], alpha: da });
    T("design radius", X(RS_DESIGN) + 8, TOP + 18, { size: 20, color: kit.MUTED, alpha: da });

    // the calibration level rises from 1 - alpha to the robust level
    var lift = E(t, 6.0, 8.6);
    var level = kit.lerp(1 - ALPHA, LEVEL_R, lift);
    T("calibrate at", 870, 36, { size: 22, color: kit.MUTED, align: "right" });
    T(pct(level), 870, 68, { size: 28, weight: 700, color: lift > 0 ? kit.BLUE : kit.FG, align: "right" });

    var pts = function (arr, f) { return RGRID.map(function (rs, k) { return [X(rs), Y(arr ? arr[k] : f(rs))]; }); };
    var labels = [];

    // plain CP under attack
    var pa = E(t, 0.6, 2.8);
    if (pa > 0) {
      kit.line(pts(COV_PLAIN), kit.RED, 3.5, { progress: pa, alpha: lift > 0 ? 1 - 0.55 * lift : 1 });
      if (pa > 0.95) labels.push({ y: Y(COV_PLAIN[NR - 1]), s: "plain CP, attacked", c: kit.RED, a: E(t, 2.6, 3.0) });
    }
    // certified lower bound of the procedure at the current level
    var ba = E(t, 3.2, 5.0);
    if (ba > 0) {
      kit.line(pts(null, function (rs) { return bound(level, rs); }), kit.GOLD, 3.5, { progress: ba, dash: [10, 6] });
      if (ba > 0.95) labels.push({ y: Y(bound(level, RS_MAX)), s: "certified bound", c: kit.GOLD, a: E(t, 4.8, 5.2) });
    }
    // RCP1 calibrated at the robust level, under the same attack
    var ra = E(t, 9.0, 11.0);
    if (ra > 0) {
      kit.line(pts(COV_ROB), kit.BLUE, 4, { progress: ra });
      if (ra > 0.95) labels.push({ y: Y(COV_ROB[NR - 1]), s: "RCP1, attacked", c: kit.BLUE, a: E(t, 10.8, 11.2) });
    }
    spread(labels, 28).forEach(function (l) {
      T(l.s, R + 14, l.y + 7, { size: 21, weight: 600, color: l.c, alpha: l.a });
    });
    T("target 90%", L + 10, Y(0.9) - 10, { size: 20, color: kit.GREEN, weight: 600 });

    // where the bound meets the target
    var ma = E(t, 8.4, 9.0);
    if (ma > 0) {
      kit.dot(X(RS_DESIGN), Y(bound(LEVEL_R, RS_DESIGN)), 7, kit.GOLD, { alpha: ma });
      T("worst case = 90%", X(RS_DESIGN) - 12, Y(0.9) + 32, { size: 20, weight: 600, color: kit.GOLD, align: "right", alpha: ma });
    }
  }

  /* ── plot 4: the price in set size ─────────────────────────────────────── */

  var RS_BARS = [0, 0.25, 0.5, 0.75];
  var BARS = RS_BARS.map(function (rs) {
    var lv = robustLevel(rs);
    return { rs: rs, level: lv, size: setSize(threshold(lv)) };
  });

  function price(t) {
    var L = 90, R = 840, TOP = 60, BASE = 300, YMAX = 3;
    var Y = function (v) { return BASE - (BASE - TOP) * v / YMAX; };
    kit.axes(L, BASE, R, TOP);
    [0, 1, 2, 3].forEach(function (v) {
      T(String(v), L - 10, Y(v) + 7, { size: 20, color: kit.MUTED, align: "right" });
      if (v) kit.line([[L, Y(v)], [R, Y(v)]], kit.LINE, 1, { alpha: 0.6 });
    });
    T("average set size (3 classes)", L, 30, { size: 22, color: kit.MUTED });
    var slot = (R - L) / BARS.length, bw = 120;
    BARS.forEach(function (b, k) {
      var cx = L + slot * (k + 0.5);
      var g = EO(t, 0.8 + 1.6 * k, 2.0 + 1.6 * k);
      var col = k === 0 ? kit.MUTED : kit.BLUE;
      kit.rect(cx - bw / 2, BASE - 2, bw, 2, 0, kit.SOFT);
      if (g > 0) kit.rect(cx - bw / 2, Y(b.size * g), bw, (BASE - Y(b.size * g)), 4, col, { alpha: 0.8 });
      if (g > 0.6) T((b.size * g).toFixed(2), cx, Y(b.size * g) - 10, { size: 22, weight: 700, color: col, align: "center", alpha: E(g, 0.6, 1) });
      T(k === 0 ? "plain CP" : "r / σ = " + b.rs, cx, BASE + 30, { size: 21, color: kit.FG, align: "center" });
      T("calibrate at " + pct(b.level), cx, BASE + 58, { size: 20, color: kit.MUTED, align: "center" });
    });
  }

  return {
    passes: { size: [880, 450], duration: 9, draw: passes },
    calib: { size: [880, 400], duration: 10, draw: calib },
    certify: { size: [880, 500], duration: 12, draw: certify },
    price: { size: [880, 380], duration: 8, draw: price }
  };
});
