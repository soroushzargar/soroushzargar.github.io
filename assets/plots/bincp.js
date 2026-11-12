/* ==========================================================================
   Animated plots for the BinCP post (blogs/single-binary-certificate.md).

   One toy model feeds all three plots. Inputs live in the plane, six classes
   sit on a circle, and the conformal score of a label is its softmax
   probability. Smoothing adds Gaussian noise with standard deviation SIG.
   BinCP looks at the event "the score of the label clears TAU" under that
   noise, so each (input, label) pair is summarised by one probability.

   binarize  noisy copies of one input, their scores, and the yes/no count
   certify   the curve p -> Phi(Phi^-1(p) - r/sigma), read off once, and the
             prediction set of an attacked input at the level it gives
   samples   confidence intervals as Monte Carlo samples arrive: mean of a
             bounded score with Hoeffding, versus a Bernoulli proportion
             with the exact Clopper-Pearson interval
   ========================================================================== */
sitePlots.define(function (kit) {
  "use strict";

  /* ── colours, used the same way in every plot ─────────────────────────── */
  var YES = kit.BLUE;          // clears tau, in the set, the binary estimate
  var CONT = kit.ORANGE;       // the continuous score and its Hoeffding interval
  var WORST = kit.RED;         // the worst-case level p'
  var NO = "#B9B4AA";          // does not clear tau, not in the set
  var INK = kit.FG, MUTED = kit.MUTED;

  /* ── numerics ─────────────────────────────────────────────────────────── */
  function erf(x) { // Abramowitz-Stegun 7.1.26
    var s = x < 0 ? -1 : 1; x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  function Phi(z) { return 0.5 * (1 + erf(z / Math.SQRT2)); }
  function PhiInv(p) { // Acklam's rational approximation
    var a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.3577518672690, -30.66479806614716, 2.506628277459239];
    var b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    var c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    var d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    var q, r;
    if (p < 0.02425) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p > 1 - 0.02425) return -PhiInv(1 - p);
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  function lgamma(x) { // Lanczos
    var g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    var y = x, tmp = x + 5.5, ser = 1.000000000190015;
    tmp -= (x + 0.5) * Math.log(tmp);
    for (var j = 0; j < 6; j++) ser += g[j] / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  }
  function betacf(a, b, x) { // continued fraction for the incomplete beta function
    var qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    d = 1 / d;
    var h = d;
    for (var m = 1; m <= 300; m++) {
      var m2 = 2 * m, aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30;
      c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30;
      c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1 / d;
      var del = d * c; h *= del;
      if (Math.abs(del - 1) < 3e-12) break;
    }
    return h;
  }
  function ibeta(a, b, x) { // regularized incomplete beta I_x(a, b)
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    var bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
  }
  function betaInv(q, a, b) { // bisection is plenty here
    var lo = 0, hi = 1;
    for (var i = 0; i < 50; i++) { var mid = (lo + hi) / 2; if (ibeta(a, b, mid) < q) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  // exact two-sided Clopper-Pearson interval for k successes in n trials
  function clopper(k, n, delta) {
    return [k === 0 ? 0 : betaInv(delta / 2, k, n - k + 1), k === n ? 1 : betaInv(1 - delta / 2, k + 1, n - k)];
  }

  /* ── the toy model ────────────────────────────────────────────────────── */
  var K = 6, BETA = 2, SIG = 0.3, TAU = 0.45;
  var NAMES = ["cat", "dog", "fox", "owl", "elk", "bee"];
  var MU = [];
  for (var k = 0; k < K; k++) MU.push([Math.cos(k * Math.PI / 3), Math.sin(k * Math.PI / 3)]);
  function softmax(x0, x1) {
    var l = [], mx = -1e9, s = 0, i;
    for (i = 0; i < K; i++) { var dx = x0 - MU[i][0], dy = x1 - MU[i][1]; l.push(-BETA * (dx * dx + dy * dy)); mx = Math.max(mx, l[i]); }
    for (i = 0; i < K; i++) { l[i] = Math.exp(l[i] - mx); s += l[i]; }
    for (i = 0; i < K; i++) l[i] /= s;
    return l;
  }
  var X = [1.05, 0];    // a clean input whose true label is cat (class 0)

  // Pr over the noise that each label's score clears tau, by Monte Carlo with many draws
  function smoothed(x, draws) {
    var cnt = [0, 0, 0, 0, 0, 0];
    for (var i = 0; i < draws.length; i++) {
      var s = softmax(x[0] + SIG * draws[i][0], x[1] + SIG * draws[i][1]);
      for (var j = 0; j < K; j++) if (s[j] >= TAU) cnt[j]++;
    }
    return cnt.map(function (c) { return c / draws.length; });
  }
  var rBig = kit.rng(20250311), BIG = [];
  for (var i0 = 0; i0 < 20000; i0++) BIG.push([kit.gauss(rBig), kit.gauss(rBig)]);

  /* ===== plot 1: binarize ================================================ */
  var binarize = (function () {
    var N = 60, rr = kit.rng(4), copies = [];
    for (var i = 0; i < N; i++) {
      var z0 = kit.gauss(rr), z1 = kit.gauss(rr);
      var s = softmax(X[0] + SIG * z0, X[1] + SIG * z1)[0];
      copies.push({ z0: z0, z1: z1, s: s, yes: s >= TAU });
    }
    var yesCount = copies.filter(function (c) { return c.yes; }).length;

    // layout
    var CX = 200, CY = 262, S = 240, PAD = 165;          // input-space panel
    var AX0 = 440, AX1 = 840, BASE = 420, NB = 25;       // score axis
    var BW = (AX1 - AX0) / NB, STEP = 13.5, R = 5.8;
    var bins = [];
    for (var b = 0; b < NB; b++) bins.push(0);
    copies.forEach(function (c) {
      c.px = CX + Math.max(-PAD + 8, Math.min(PAD - 8, S * SIG * c.z0));
      c.py = CY - Math.max(-PAD + 8, Math.min(PAD - 8, S * SIG * c.z1));
      var bin = Math.min(NB - 1, Math.floor(c.s * NB));
      c.hx = AX0 + (bin + 0.5) * BW;
      c.hy = BASE - 10 - bins[bin] * STEP;
      bins[bin]++;
    });
    // region of the plane where the cat score clears tau (cells of the left panel)
    var CELL = 6, cells = [];
    for (var gx = -PAD; gx < PAD; gx += CELL) for (var gy = -PAD; gy < PAD; gy += CELL) {
      var u = X[0] + (gx + CELL / 2) / S, v = X[1] - (gy + CELL / 2) / S;
      if (softmax(u, v)[0] >= TAU) cells.push([CX + gx, CY + gy]);
    }
    var tauX = AX0 + TAU * (AX1 - AX0);

    function draw(t) {
      var ctx = kit.ctx();
      // titles
      kit.text("60 noisy copies of x", CX, 58, { size: 23, weight: 600, align: "center" });
      kit.text("score of the true label, one dot per copy", (AX0 + AX1) / 2, 58, { size: 23, weight: 600, align: "center" });

      // left panel frame and the tau region
      var reg = kit.ease(t, 5.6, 6.8);
      ctx.save();
      ctx.beginPath(); ctx.roundRect(CX - PAD, CY - PAD, 2 * PAD, 2 * PAD, 10); ctx.clip();
      if (reg > 0) {
        ctx.fillStyle = YES; ctx.globalAlpha = 0.09 * reg;
        ctx.beginPath();
        cells.forEach(function (c) { ctx.rect(c[0], c[1], CELL, CELL); });
        ctx.fill();
      }
      ctx.restore();
      kit.rect(CX - PAD, CY - PAD, 2 * PAD, 2 * PAD, 10, null, { stroke: kit.LINE, lineWidth: 2 });
      if (reg > 0) {
        kit.rect(CX + PAD - 112, CY + PAD - 40, 104, 32, 6, kit.BG, { alpha: 0.85 * reg });
        kit.text("score ≥ τ", CX + PAD - 14, CY + PAD - 17, { size: 21, weight: 600, color: YES, alpha: reg, align: "right" });
      }
      // radius sigma around x
      kit.dot(CX, CY, S * SIG, null, { stroke: MUTED, lineWidth: 1.5, dash: [5, 6], alpha: 0.6 });

      // score axis
      kit.line([[AX0, BASE], [AX1, BASE]], kit.LINE, 2);
      [0, 0.5, 1].forEach(function (v) {
        var x = AX0 + v * (AX1 - AX0);
        kit.line([[x, BASE], [x, BASE + 7]], kit.LINE, 2);
        kit.text(String(v), x, BASE + 32, { size: 20, color: MUTED, align: "center" });
      });

      // tau line
      var tl = kit.ease(t, 5.4, 6.4);
      if (tl > 0) {
        var top = BASE - tl * (BASE - 196);
        kit.line([[tauX, BASE], [tauX, top]], INK, 2.5, { dash: [7, 6] });
        kit.rich([["τ"], [" = " + TAU, { it: false, fam: kit.SANS }]], tauX, 184, { size: 24, align: "center", alpha: tl });
      }

      // copies: appear on the left, then fly to their score
      var colour = kit.ease(t, 6.2, 7.0);
      copies.forEach(function (c, i) {
        var col = kit.mix("#6B7280", c.yes ? YES : NO, colour);
        var appear = kit.easeOut(t, 0.25 + i * 0.03, 0.55 + i * 0.03);
        kit.dot(c.px, c.py, R * (0.4 + 0.6 * appear), col, { alpha: appear });
        var t0 = 2.4 + i * 0.045, f = kit.ease(t, t0, t0 + 0.7);
        if (f > 0) {
          var x = kit.lerp(c.px, c.hx, f), y = kit.lerp(c.py, c.hy, f) - Math.sin(Math.PI * f) * 60;
          kit.dot(x, y, R, col);
        }
      });
      // the input itself
      kit.dot(CX, CY, 8, INK, { stroke: kit.BG, lineWidth: 3 });
      kit.rect(CX + S * SIG * 0.72 - 2, CY - S * SIG * 0.72 - 26, 22, 26, 5, kit.BG, { alpha: 0.9 });
      kit.text("σ", CX + S * SIG * 0.72 + 9, CY - S * SIG * 0.72 - 7, { size: 22, fam: kit.SERIF, italic: true, color: MUTED, align: "center" });
      kit.text("x", CX + 10, CY + 26, { size: 24, fam: kit.SERIF, italic: true, weight: 600 });

      // the count
      var cnt = kit.ease(t, 7.2, 8.6);
      if (cnt > 0) {
        var shown = Math.round(cnt * yesCount);
        var al = Math.min(1, cnt * 4);
        kit.text("clear τ: " + shown + " of " + N, AX0, 108, { size: 22, color: YES, weight: 600, alpha: al });
        kit.text("do not: " + (Math.round(cnt * (N - yesCount))), AX0, 140, { size: 22, color: MUTED, alpha: al });
        kit.text("Pr[score ≥ τ] ≈", AX1 - 92, 136, { size: 22, color: INK, align: "right", alpha: al });
        kit.text((shown / N).toFixed(2), AX1, 138, { size: 38, weight: 700, color: YES, align: "right", fam: kit.SERIF, alpha: al });
      }
    }
    return { size: [880, 460], duration: 9.5, draw: draw, yesCount: yesCount };
  })();

  /* ===== plot 2: certify ================================================= */
  var certify = (function () {
    var P = 0.9, RMAX = 0.5;
    // the attacked input: moved toward dog by 0.5 sigma
    var dx = MU[1][0] - X[0], dy = MU[1][1] - X[1], dn = Math.hypot(dx, dy);
    var XT = [X[0] + RMAX * SIG * dx / dn, X[1] + RMAX * SIG * dy / dn];
    var clean = smoothed(X, BIG), att = smoothed(XT, BIG);
    function worst(p, r) { return Phi(PhiInv(p) - r); }

    var OX = 110, OY = 410, SZ = 280;                    // left: the curve, unit square
    var BX0 = 490, BX1 = 860, SLOT = (BX1 - BX0) / K, BWID = 34;
    function yv(v) { return OY - v * SZ; }
    function xv(v) { return OX + v * SZ; }
    var ORDER = [0, 1, 5, 2, 4, 3];                      // cat, dog, bee, then the rest

    function draw(t) {
      var r = RMAX * kit.ease(t, 1.4, 6.4);
      var lev = worst(P, r);

      // left axes
      kit.axes(OX, OY, OX + SZ, OY - SZ);
      [0, 0.5, 1].forEach(function (v) {
        kit.text(String(v), xv(v), OY + 30, { size: 20, color: MUTED, align: "center" });
        kit.text(String(v), OX - 12, yv(v) + 7, { size: 20, color: MUTED, align: "right" });
      });
      kit.text("probability at clean x", OX + SZ / 2, OY + 62, { size: 21, color: MUTED, align: "center" });
      kit.text("worst case at x̃", OX + 8, yv(1) - 16, { size: 21, color: MUTED });
      // diagonal, r = 0
      kit.line([[xv(0), yv(0)], [xv(1), yv(1)]], kit.LINE, 2, { dash: [6, 6] });
      // the curve for the current radius
      var pts = [];
      for (var i = 1; i < 200; i++) { var u = i / 200; pts.push([xv(u), yv(worst(u, r))]); }
      pts.unshift([xv(0), yv(0)]); pts.push([xv(1), yv(1)]);
      kit.line(pts, WORST, 3);
      // read off at p
      kit.line([[xv(P), yv(0)], [xv(P), yv(lev)]], MUTED, 1.5, { dash: [4, 5] });
      kit.text("p", xv(P), OY - 10, { size: 22, fam: kit.SERIF, italic: true, color: MUTED, align: "center" });
      // level line across to the bars
      kit.line([[xv(P), yv(lev)], [BX1, yv(lev)]], WORST, 2.5, { dash: [8, 6] });
      kit.dot(xv(P), yv(lev), 7, WORST);
      // its readout, between the panels, above the line
      kit.text(lev.toFixed(2), 452, yv(lev) - 12, { size: 22, weight: 700, color: WORST, align: "center" });

      // bars for the attacked input
      kit.line([[BX0, OY], [BX1, OY]], kit.LINE, 2);
      var members = [];
      ORDER.forEach(function (c, j) {
        var x = BX0 + (j + 0.5) * SLOT, v = att[c], inSet = v >= lev;
        if (inSet) members.push(NAMES[c]);
        var h = Math.max(2, v * SZ);
        kit.rect(x - BWID / 2, OY - h, BWID, h, 4, inSet ? YES : NO);
        kit.text(NAMES[c], x, OY + 30, { size: 21, align: "center", weight: c === 0 ? 700 : 400, color: c === 0 ? INK : MUTED });
        if (h > 60) kit.text(v.toFixed(2), x, OY - h / 2 + 7, { size: 20, align: "center", color: inSet ? "#FFFFFF" : INK, weight: 700 });
        else kit.text(v.toFixed(2), x, OY - h - 10, { size: 20, align: "center", color: MUTED });
      });
      kit.text("true label, " + clean[0].toFixed(2) + " at clean x", BX0 + 0.5 * SLOT - BWID / 2, OY + 56, { size: 20, color: MUTED });

      // header readouts, updated in place
      kit.rich([["r", {}], ["/", { it: false }], ["σ", {}], [" = " + r.toFixed(2), { it: false, fam: kit.SANS }]], OX, 48, { size: 24 });
      kit.text("level " + P.toFixed(2) + " becomes " + lev.toFixed(2), OX, 82, { size: 22, color: WORST, weight: 600 });
      kit.text("labels of attacked x̃ in the set:", BX0, 48, { size: 22, color: MUTED });
      var setStr = members.length ? "{ " + members.join(", ") + " }" : "{ } misses cat";
      kit.text(setStr, BX0, 82, { size: 24, weight: 700, color: members.length ? YES : INK });

      var fin = kit.ease(t, 7.0, 8.0);
      if (fin > 0) kit.text("one lookup, the same for every input and label", (OX + BX1) / 2, OY + 98, { size: 22, weight: 600, align: "center", alpha: fin });
    }
    return { size: [880, 520], duration: 9, draw: draw, att: att, clean: clean, worst: worst(P, RMAX) };
  })();

  /* ===== plot 3: samples ================================================= */
  var samples = (function () {
    var NMAX = 3000, DELTA = 0.05, TARGET = 0.05, rr = kit.rng(99);
    var sSum = 0, kSum = 0, run = [];
    for (var i = 1; i <= NMAX; i++) {
      var s = softmax(X[0] + SIG * kit.gauss(rr), X[1] + SIG * kit.gauss(rr))[0];
      sSum += s; if (s >= TAU) kSum++;
      run.push({ mean: sSum / i, k: kSum });
    }
    function hoeff(n) { return Math.sqrt(Math.log(2 / DELTA) / (2 * n)); }
    // grid of n on a log scale, plus every integer up to 400 to find the crossing exactly
    var grid = [], n;
    for (var g = 0; g <= 160; g++) {
      n = Math.round(Math.pow(10, 1 + g * (Math.log10(NMAX) - 1) / 160));
      if (!grid.length || grid[grid.length - 1].n !== n) grid.push({ n: n });
    }
    grid.forEach(function (p) {
      var r = run[p.n - 1];
      p.mean = r.mean; p.h = hoeff(p.n);
      p.prop = r.k / p.n; p.ci = clopper(r.k, p.n, DELTA);
      p.m = Math.max(p.prop - p.ci[0], p.ci[1] - p.prop);
    });
    var nH = Math.ceil(Math.log(2 / DELTA) / (2 * TARGET * TARGET));
    var nB = null;
    for (n = 10; n <= NMAX && nB === null; n++) {
      var ci = clopper(run[n - 1].k, n, DELTA), pr = run[n - 1].k / n;
      if (Math.max(pr - ci[0], ci[1] - pr) <= TARGET) nB = n;
    }

    var X0 = 120, X1 = 830, LMIN = 1, LMAX = Math.log10(NMAX);
    var PANELS = [
      { top: 92, bot: 252, col: CONT, title: "mean score, Hoeffding interval", key: "mean", m: "h", nStar: nH },
      { top: 336, bot: 496, col: YES, title: "share with score ≥ τ, Clopper–Pearson", key: "prop", m: "m", nStar: nB }
    ];
    var YLO = 0.4, YHI = 1.0;
    function xn(n) { return X0 + (Math.log10(n) - LMIN) / (LMAX - LMIN) * (X1 - X0); }
    function fmt(n) { return n >= 1000 ? Math.floor(n / 1000) + "," + String(n % 1000).padStart(3, "0") : String(n); }

    function draw(t) {
      var ctx = kit.ctx();
      var sweep = kit.ease(t, 0.6, 6.6);
      var nNow = Math.round(Math.pow(10, LMIN + sweep * (LMAX - LMIN)));
      var last = 0;
      for (var j = 0; j < grid.length; j++) if (grid[j].n <= nNow) last = j;
      var gNow = grid[last];
      var marks = kit.ease(t, 7.0, 8.2);

      PANELS.forEach(function (P) {
        function yv(v) { return P.bot - (Math.max(YLO, Math.min(YHI, v)) - YLO) / (YHI - YLO) * (P.bot - P.top); }
        kit.axes(X0, P.bot, X1, P.top);
        [0.5, 1].forEach(function (v) { kit.text(v.toFixed(1), X0 - 12, yv(v) + 7, { size: 20, color: MUTED, align: "right" }); });
        kit.text(P.title, X0, P.top - 18, { size: 22, weight: 600, color: P.col });

        if (sweep > 0) {
          // band
          var up = [], lo = [], est = [];
          for (var j2 = 0; j2 <= last; j2++) {
            var p = grid[j2], x = xn(p.n), c = p[P.key];
            var a = P.key === "mean" ? c + p.h : p.ci[1], b = P.key === "mean" ? c - p.h : p.ci[0];
            up.push([x, yv(a)]); lo.push([x, yv(b)]); est.push([x, yv(c)]);
          }
          if (up.length > 1) {
            ctx.save();
            ctx.beginPath();
            up.forEach(function (q, i) { if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
            for (var i = lo.length - 1; i >= 0; i--) ctx.lineTo(lo[i][0], lo[i][1]);
            ctx.closePath(); ctx.fillStyle = P.col; ctx.globalAlpha = 0.18; ctx.fill();
            ctx.restore();
            kit.line(est, P.col, 2.5);
          }
          // readout, in place
          var mNow = P.key === "mean" ? gNow.h : gNow.m;
          kit.text("n = " + fmt(gNow.n) + "   ±" + mNow.toFixed(3), X1, P.top - 18, { size: 22, align: "right", color: INK });
        }
        // where the margin first reaches the target
        if (marks > 0) {
          var xs = xn(P.nStar);
          kit.line([[xs, P.bot], [xs, kit.lerp(P.bot, P.top, marks)]], INK, 2, { dash: [6, 6] });
          kit.text("±" + TARGET.toFixed(2) + " from n = " + fmt(P.nStar), xs + 12, P.bot - 22, { size: 22, weight: 700, color: INK, alpha: marks });
        }
      });

      // shared n axis
      [10, 100, 1000].forEach(function (v) {
        kit.line([[xn(v), 496], [xn(v), 503]], kit.LINE, 2);
        kit.text(fmt(v), xn(v), 528, { size: 20, color: MUTED, align: "center" });
      });
      kit.text("Monte Carlo samples (log scale)", (X0 + X1) / 2, 560, { size: 21, color: MUTED, align: "center" });
    }
    return { size: [880, 580], duration: 9.5, draw: draw, nH: nH, nB: nB };
  })();

  return { binarize: binarize, certify: certify, samples: samples };
});
