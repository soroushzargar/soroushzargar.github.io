/* ==========================================================================
   Plots for the post "robust-yet-efficient-conformal" (CAS, ICML 2024).

   One toy model feeds every plot. Ten labels; each label's base score is
   sigmoid(3 z), where z is a logit that an l2 attacker of radius r can lower by
   at most r. Gaussian smoothing with sigma = 0.5 acts on z, so the smoothed
   score is S(z) = E[sigmoid(3 (z + sigma e))], e ~ N(0, 1).
   For a score in [0, 1] with smoothed mean p, the mean-only worst case is
   Phi(Phi^-1(p) - r / sigma). The CDF-aware bound applies the same rule to
   every level t of the noisy score, P(score > t), and integrates. In this toy
   the score depends on the input through one direction, so the CDF-aware
   bound equals the true worst case S(z - r).
   Conformity convention: higher score = label fits better; a set keeps every
   label whose score is at least the threshold.
   ========================================================================== */
sitePlots.define(function (kit) {
  "use strict";

  /* ── maths ─────────────────────────────────────────────────────────── */
  function erf(x) {
    var s = x < 0 ? -1 : 1; x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  function Phi(x) { return 0.5 * (1 + erf(x / Math.SQRT2)); }
  function PhiInv(p) { // Acklam's rational approximation
    p = Math.min(1 - 1e-12, Math.max(1e-12, p));
    var a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.3577518672690, -30.66479806614716, 2.506628277459239];
    var b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    var c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    var d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    var q, r;
    if (p < 0.02425) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p > 1 - 0.02425) {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  function sig(z) { return 1 / (1 + Math.exp(-z)); }

  /* ── toy model ─────────────────────────────────────────────────────── */
  var SIGMA = 0.5, SLOPE = 3, LABELS = 10, ALPHA = 0.1;
  var NODES = [];
  for (var i = 0; i < 200; i++) NODES.push(PhiInv((i + 0.5) / 200));
  // smoothed score on a fine grid of z, then linear interpolation
  var ZMIN = -5, ZMAX = 5, ZSTEP = 0.005, TABLE = [];
  for (var zz = ZMIN; zz <= ZMAX + 1e-9; zz += ZSTEP) {
    var acc = 0;
    for (var j = 0; j < NODES.length; j++) acc += sig(SLOPE * (zz + SIGMA * NODES[j]));
    TABLE.push(acc / NODES.length);
  }
  function S(z) {
    var u = (Math.min(ZMAX, Math.max(ZMIN, z)) - ZMIN) / ZSTEP, k = Math.min(TABLE.length - 2, Math.floor(u));
    return TABLE[k] + (TABLE[k + 1] - TABLE[k]) * (u - k);
  }
  // P(noisy score > t) for a point with logit z
  function level(z, t) { return Phi((z - Math.log(t / (1 - t)) / SLOPE) / SIGMA); }
  // worst case of one level under radius r
  function push(p, r) { return Phi(PhiInv(p) - r / SIGMA); }
  function meanBound(z, r) { return push(S(z), r); }
  var LEVELS = 200;
  function cdfBound(z, r) {
    var s = 0;
    for (var l = 0; l < LEVELS; l++) s += push(level(z, (l + 0.5) / LEVELS), r);
    return s / LEVELS;
  }

  var rnd = kit.rng(1);
  function point() {
    var z = [];
    for (var k = 0; k < LABELS; k++) z.push(k === 0 ? 0.8 + 0.6 * kit.gauss(rnd) : -0.6 + 0.6 * kit.gauss(rnd));
    return z; // label 0 is the true label
  }
  var CAL = [], TEST = [];
  for (i = 0; i < 400; i++) CAL.push(point());
  for (i = 0; i < 1000; i++) TEST.push(point());
  var KQ = Math.floor(ALPHA * (CAL.length + 1)); // k-th smallest calibration score is the threshold
  function quantile(arr) { var s = arr.slice().sort(function (a, b) { return a - b; }); return s[KQ - 1]; }

  var calS = CAL.map(function (z) { return S(z[0]); });
  var testS = TEST.map(function (z) { return z.map(S); });
  var Q0 = quantile(calS);
  function coverage(r, q) {
    var n = 0;
    for (var m = 0; m < TEST.length; m++) if (S(TEST[m][0] - r) >= q) n++;
    return n / TEST.length;
  }
  function setSize(q) {
    var n = 0;
    for (var m = 0; m < testS.length; m++) for (var k = 0; k < LABELS; k++) if (testS[m][k] >= q) n++;
    return n / testS.length;
  }
  function fmt(v, d) { return v.toFixed(d === undefined ? 2 : d); }
  function pct(v) { return (100 * v).toFixed(1) + "%"; }

  var C = {
    clean: kit.NAVY, cas: kit.BLUE, mean: kit.ORANGE, miss: kit.RED,
    cal: "#9AA0A8", ink: kit.FG, muted: kit.MUTED
  };
  function vline(x, y0, y1, color, width, dash, alpha) {
    kit.line([[x, y0], [x, y1]], color, width || 2, { dash: dash, alpha: alpha });
  }
  function scoreAxis(x0, x1, y, label) {
    kit.line([[x0, y], [x1, y]], kit.LINE, 2);
    [0, 0.25, 0.5, 0.75, 1].forEach(function (v) {
      var x = x0 + (x1 - x0) * v;
      kit.line([[x, y], [x, y + 6]], kit.LINE, 2);
      kit.text(v === 0 || v === 1 ? String(v) : fmt(v), x, y + 30, { size: 20, color: C.muted, align: "center" });
    });
    kit.text(label, (x0 + x1) / 2, y + 62, { size: 21, color: C.muted, align: "center" });
  }

  /* ── 1. attack: coverage falls as the attack grows ─────────────────── */
  var A = { x0: 70, x1: 850, calBase: 205, testBase: 245, hMax: 118, bins: 25, rMax: 0.5 };
  var calHist = new Array(A.bins).fill(0);
  calS.forEach(function (s) { calHist[Math.min(A.bins - 1, Math.floor(s * A.bins))] += 1 / calS.length; });
  var histScale = A.hMax / (Math.max.apply(null, calHist) * 1.05);
  var attackEnd = coverage(A.rMax, Q0);

  var attack = {
    size: [880, 470], duration: 9,
    draw: function (t) {
      var u = kit.ease(t, 1, 7.5), r = A.rMax * u;
      var bw = (A.x1 - A.x0) / A.bins, qx = A.x0 + (A.x1 - A.x0) * Q0;
      // calibration histogram (clean)
      calHist.forEach(function (f, b) {
        var h = f * histScale;
        kit.rect(A.x0 + b * bw + 1.5, A.calBase - h, bw - 3, h, 2, C.cal);
      });
      // test histogram under attack, hanging down
      var th = new Array(A.bins).fill(0), cov = 0;
      for (var m = 0; m < TEST.length; m++) {
        var s = S(TEST[m][0] - r);
        if (s >= Q0) cov++;
        th[Math.min(A.bins - 1, Math.floor(s * A.bins))] += 1 / TEST.length;
      }
      cov /= TEST.length;
      th.forEach(function (f, b) {
        var h = Math.min(A.hMax + 10, f * histScale);
        var below = (b + 1) * bw + A.x0 <= qx + 0.5;
        kit.rect(A.x0 + b * bw + 1.5, A.testBase, bw - 3, h, 2, below ? C.miss : C.clean);
      });
      kit.line([[A.x0, (A.calBase + A.testBase) / 2], [A.x1, (A.calBase + A.testBase) / 2]], kit.LINE, 2);
      kit.text("calibration, clean", A.x0, 82, { size: 21, color: C.muted, weight: 600 });
      kit.text("test, attacked", A.x0, A.testBase + A.hMax + 40, { size: 21, color: C.clean, weight: 600 });
      // threshold
      vline(qx, 70, A.testBase + A.hMax + 12, C.ink, 2.5);
      kit.text("threshold " + fmt(Q0), qx + 10, 70, { size: 21, color: C.ink, weight: 600 });
      scoreAxis(A.x0, A.x1, A.testBase + A.hMax + 52 + 8, "smoothed score of the true label");
      // readouts
      kit.rich(["attack radius ", ["r", {}], " / ", ["σ", {}], " = " + fmt(r / SIGMA)], A.x0, 34, { size: 23, italic: false, fam: kit.SANS, weight: 600 });
      var low = cov < 1 - ALPHA;
      kit.text("coverage " + pct(cov), A.x1, 34, { size: 24, weight: 700, color: low ? C.miss : C.ink, align: "right" });
      kit.text("target 90%", A.x1, 62, { size: 20, color: C.muted, align: "right" });
      kit.text("red: missed", qx - 14, A.testBase + 84, { size: 21, color: C.miss, weight: 600, align: "right", alpha: kit.ease(t, 2, 3) });
    }
  };

  /* ── 2. cdf: one point, mean-only bound vs CDF-aware bound ─────────── */
  var P = { x0: 80, x1: 510, y0: 410, y1: 110, z: 0.2, r: 0.25 };
  var cleanMean = S(P.z), casB = cdfBound(P.z, P.r), meanB = meanBound(P.z, P.r);
  var CURVE_N = 160;
  function curvePts(lambda) {
    var pts = [];
    for (var c = 0; c <= CURVE_N; c++) {
      var tt = Math.min(1 - 1e-6, Math.max(1e-6, c / CURVE_N));
      var p = push(level(P.z, tt), P.r * lambda);
      pts.push([P.x0 + (P.x1 - P.x0) * (c / CURVE_N), P.y0 - (P.y0 - P.y1) * p]);
    }
    return pts;
  }
  function areaUnder(pts, color, alpha) {
    var ctx = kit.ctx();
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(P.x0, P.y0);
    pts.forEach(function (q) { ctx.lineTo(q[0], q[1]); });
    ctx.lineTo(P.x1, P.y0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  var cleanPts = curvePts(0);

  var cdf = {
    size: [880, 490], duration: 10,
    draw: function (t) {
      var lam = kit.ease(t, 1, 4.5);
      var pts = curvePts(lam), area = cdfBound(P.z, P.r * lam);
      // axes and ticks
      kit.axes(P.x0, P.y0, P.x1, P.y1 - 10);
      [0, 0.5, 1].forEach(function (v) {
        var y = P.y0 - (P.y0 - P.y1) * v, x = P.x0 + (P.x1 - P.x0) * v;
        kit.text(String(v), P.x0 - 12, y + 7, { size: 20, color: C.muted, align: "right" });
        kit.text(String(v), x, P.y0 + 30, { size: 20, color: C.muted, align: "center" });
      });
      kit.text("score level t", (P.x0 + P.x1) / 2, P.y0 + 62, { size: 21, color: C.muted, align: "center" });
      kit.text("P(noisy score > t)", P.x0 - 40, 70, { size: 21, color: C.muted });
      // area and curves
      areaUnder(pts, lam > 0 ? C.cas : C.clean, 0.16);
      if (lam > 0) kit.line(cleanPts, C.clean, 2, { dash: [6, 6], alpha: 0.8 });
      kit.line(pts, lam > 0 ? C.cas : C.clean, 3.5);
      kit.text(lam > 0.5 ? "area = worst-case score" : "area = smoothed score", P.x0 + 14, P.y0 - 40, { size: 20, color: lam > 0 ? C.cas : C.clean, weight: 600 });
      // arrows showing the per-level push
      var ar = kit.ease(t, 1, 1.6) * (1 - kit.ease(t, 4.6, 5.4));
      [0.35, 0.55, 0.75].forEach(function (tt) {
        var x = P.x0 + (P.x1 - P.x0) * tt, p0 = level(P.z, tt), p1 = push(p0, P.r * lam);
        var ya = P.y0 - (P.y0 - P.y1) * p0, yb = P.y0 - (P.y0 - P.y1) * p1;
        if (yb - ya < 10) return;
        kit.line([[x, ya + 4], [x, yb - 6]], C.ink, 2, { alpha: ar });
        kit.line([[x - 6, yb - 12], [x, yb - 5], [x + 6, yb - 12]], C.ink, 2, { alpha: ar });
      });
      kit.rich(["each level: ", ["p", {}], " → Φ(Φ", ["−1", { sup: true, it: false }], "(", ["p", {}], ") − ", ["r", {}], "/", ["σ", {}], ")"],
        P.x1, P.y1 + 4, { size: 22, italic: false, align: "right" });
      kit.text("r/σ = " + fmt(P.r / SIGMA, 1), P.x1, P.y1 + 36, { size: 20, color: C.muted, align: "right" });
      kit.text("dashed: clean", P.x1, P.y1 + 64, { size: 20, color: C.clean, align: "right", alpha: kit.ease(t, 1.2, 2) });

      // bars on the right
      var bx = 600, bmax = 200;
      function row(y, label, value, color, alpha, bold) {
        kit.text(label, bx, y - 14, { size: 21, color: color, weight: bold ? 700 : 600, alpha: alpha });
        kit.rect(bx, y, Math.max(0, value) * bmax, 26, 4, color, { alpha: alpha * 0.9 });
        kit.text(fmt(value), bx + value * bmax + 10, y + 21, { size: 22, color: color, weight: 700, alpha: alpha });
      }
      kit.text("worst case under attack", bx, 70, { size: 21, color: C.muted });
      row(140, "clean score", cleanMean, C.clean, 1);
      row(240, "CDF-aware bound", area, C.cas, 1, true);
      var mIn = kit.easeOut(t, 5.6, 7.2);
      row(340, "mean-only bound", meanBound(P.z, P.r * mIn), C.mean, 0.3 + 0.7 * kit.ease(t, 5.2, 5.8));
      var gapA = kit.ease(t, 7.6, 8.4);
      kit.text("tighter by " + fmt(Math.round(100 * casB) / 100 - Math.round(100 * meanB) / 100), bx, 420, { size: 22, color: C.cas, weight: 700, alpha: gapA });
      kit.text("(higher is tighter)", bx, 450, { size: 20, color: C.muted, alpha: gapA });
    }
  };

  /* ── 3. calib: lower the threshold once, at calibration time ───────── */
  var B = { x0: 70, x1: 850, calY: 150, testY: 290, band: 52, r: 0.25 };
  var calB = CAL.map(function (z) { return cdfBound(z[0], B.r); });
  var testAtt = TEST.map(function (z) { return S(z[0] - B.r); });
  var jr = kit.rng(5);
  var calJ = CAL.map(function () { return jr() - 0.5; });
  var testJ = TEST.map(function () { return jr() - 0.5; });
  var QR = quantile(calB);
  var calibEndCov = coverage(B.r, QR);

  var calib = {
    size: [880, 470], duration: 9,
    draw: function (t) {
      var lam = kit.ease(t, 1.2, 6);
      var X = function (s) { return B.x0 + (B.x1 - B.x0) * s; };
      var cur = new Array(CAL.length);
      for (var m = 0; m < CAL.length; m++) cur[m] = calS[m] + (calB[m] - calS[m]) * lam;
      var q = quantile(cur), qx = X(q);
      // old threshold, ghost
      if (lam > 0.02) {
        vline(X(Q0), 48, B.testY + B.band / 2 + 14, C.muted, 2, [5, 6], 0.8);
        kit.text("before " + fmt(Q0), X(Q0) + 10, 60, { size: 20, color: C.muted, alpha: kit.ease(t, 1.4, 2) });
      }
      // calibration dots
      var dotC = kit.mix(C.cal, C.cas, lam);
      for (m = 0; m < CAL.length; m++) kit.dot(X(cur[m]), B.calY + calJ[m] * B.band, 3.6, dotC, { alpha: 0.75 });
      // test dots, attacked
      var cov = 0;
      for (m = 0; m < TEST.length; m++) {
        var ok = testAtt[m] >= q;
        if (ok) cov++;
        kit.dot(X(testAtt[m]), B.testY + testJ[m] * B.band, 3, ok ? C.clean : C.miss, { alpha: 0.6 });
      }
      cov /= TEST.length;
      kit.text(lam > 0.5 ? "calibration scores → worst-case bounds" : "calibration scores", B.x1, B.calY - B.band / 2 - 14,
        { size: 21, color: lam > 0.5 ? C.cas : C.muted, weight: 600, align: "right" });
      kit.text("test scores under attack, r/σ = " + fmt(B.r / SIGMA, 1), B.x1, B.testY - B.band / 2 - 14, { size: 21, color: C.clean, weight: 600, align: "right" });
      // threshold
      vline(qx, 60, B.testY + B.band / 2 + 14, C.ink, 2.5);
      kit.text("threshold " + fmt(q), qx - 10, 60, { size: 21, color: C.ink, weight: 600, align: "right" });
      scoreAxis(B.x0, B.x1, B.testY + B.band / 2 + 26, "smoothed score of the true label");
      var low = cov < 1 - ALPHA;
      kit.text("coverage " + pct(cov), B.x1, 34, { size: 24, weight: 700, color: low ? C.miss : C.ink, align: "right" });
      kit.text("target 90%", B.x1, 62, { size: 20, color: C.muted, align: "right" });
    }
  };

  /* ── 4. size: set size against radius for the two bounds ───────────── */
  var D = { x0: 90, x1: 570, y0: 370, y1: 80, rs: 1, yMax: 8, n: 40 };
  var curveMean = [], curveCas = [], covMin = { mean: 1, cas: 1 };
  for (i = 0; i <= D.n; i++) {
    var rr = SIGMA * D.rs * i / D.n;
    var qm = quantile(CAL.map(function (z) { return meanBound(z[0], rr); }));
    var qc = quantile(CAL.map(function (z) { return cdfBound(z[0], rr); }));
    curveMean.push(setSize(qm));
    curveCas.push(setSize(qc));
    covMin.mean = Math.min(covMin.mean, coverage(rr, qm));
    covMin.cas = Math.min(covMin.cas, coverage(rr, qc));
  }
  var std = setSize(Q0);
  function DX(i) { return D.x0 + (D.x1 - D.x0) * i / D.n; }
  function DY(v) { return D.y0 - (D.y0 - D.y1) * v / D.yMax; }

  var size = {
    size: [880, 450], duration: 9,
    draw: function (t) {
      var u = kit.ease(t, 1, 7.5), head = u * D.n;
      kit.axes(D.x0, D.y0, D.x1 + 10, D.y1 - 10);
      [0, 2, 4, 6, 8].forEach(function (v) {
        kit.text(String(v), D.x0 - 12, DY(v) + 7, { size: 20, color: C.muted, align: "right" });
        if (v) kit.line([[D.x0, DY(v)], [D.x1, DY(v)]], kit.LINE, 1, { alpha: 0.6 });
      });
      [0, 0.5, 1].forEach(function (v) {
        kit.text(String(v), D.x0 + (D.x1 - D.x0) * v / D.rs, D.y0 + 30, { size: 20, color: C.muted, align: "center" });
      });
      kit.rich(["attack radius ", ["r", {}], " / ", ["σ", {}]], (D.x0 + D.x1) / 2, D.y0 + 62, { size: 21, italic: false, fam: kit.SANS, color: C.muted, align: "center" });
      kit.text("average set size (of 10 labels)", D.x0 - 40, 46, { size: 21, color: C.muted });
      // standard CP: flat, not robust
      kit.line([[DX(0), DY(std)], [DX(D.n), DY(std)]], C.muted, 2.5, { dash: [8, 7] });
      // curves up to the head
      function upto(arr) {
        var pts = [], k = Math.floor(head);
        for (var c = 0; c <= k; c++) pts.push([DX(c), DY(arr[c])]);
        if (k < D.n) { var f = head - k; pts.push([DX(head), DY(arr[k] + (arr[k + 1] - arr[k]) * f)]); }
        return pts;
      }
      function at(arr) { var k = Math.min(D.n - 1, Math.floor(head)), f = head - k; return arr[k] + (arr[k + 1] - arr[k]) * f; }
      var pm = upto(curveMean), pc = upto(curveCas);
      kit.line(pm, C.mean, 3.5); kit.line(pc, C.cas, 3.5);
      var vm = at(curveMean), vc = at(curveCas);
      kit.dot(DX(head), DY(vm), 6, C.mean); kit.dot(DX(head), DY(vc), 6, C.cas);
      // labels in the right gutter, spread apart so they never overlap
      var labs = [
        { y: DY(vm), s: "mean-only bound " + fmt(vm, 1), c: C.mean },
        { y: DY(vc), s: "CDF-aware (CAS) " + fmt(vc, 1), c: C.cas },
        { y: DY(std), s: "standard (not robust) " + fmt(std, 1), c: C.muted }
      ].sort(function (a, b) { return a.y - b.y; });
      for (var k = 1; k < labs.length; k++) labs[k].y = Math.max(labs[k].y, labs[k - 1].y + 30);
      var over = labs[labs.length - 1].y - (D.y0 - 4);
      if (over > 0) labs.forEach(function (l) { l.y -= over; });
      labs.forEach(function (l) { kit.text(l.s, D.x1 + 26, l.y + 7, { size: 21, color: l.c, weight: 700 }); });
      kit.text("both robust sets: coverage ≥ " + Math.floor(100 * Math.min(covMin.mean, covMin.cas)) + "% under attack", D.x1, D.y1 - 2,
        { size: 20, color: C.ink, align: "right", alpha: kit.ease(t, 7.6, 8.4) });
    }
  };

  return { attack: attack, cdf: cdf, calib: calib, size: size };
});
