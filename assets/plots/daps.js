/* ==========================================================================
   Animated plots for the post "conformal-sets-on-graphs" (DAPS, ICML 2023).

   One toy model feeds every plot. A spatial graph of 2000 nodes in the unit
   square, each joined to its 5 nearest nodes, with labels from a patchwork of
   regions (3 classes, 8% of labels flipped at random), so neighbours mostly
   share a label. A weak "GNN" gives softmax probabilities with a noisy logit
   bump on the true class. The conformal score of class y at node v is its
   probability p(y | v); higher means the class fits better.

   DAPS mixes each node's scores with the mean of its neighbours' scores,
     s'(v, y) = (1 - lambda) s(v, y) + lambda * mean_{u ~ v} s(u, y),
   then runs ordinary split conformal prediction: the threshold is the
   alpha-quantile of the true-class scores of the calibration nodes, and the
   set keeps every class whose score reaches it.
   ========================================================================== */
sitePlots.define(function (kit) {
  "use strict";

  /* ── the toy model ────────────────────────────────────────────────────── */

  var BUMP = 0.9, K = 3, ALPHA = 0.1, N = 2000, KNN = 5, NCAL = 500;
  var CLS = ["A", "B", "C"];
  var COL = [kit.BLUE, kit.ORANGE, kit.GREEN];
  var DAPS = kit.NAVY, STD = kit.MUTED;

  var rnd = kit.rng(2023);
  var X = [], Y = [], LAB = [];
  var seeds = [];
  for (var s = 0; s < 12; s++) seeds.push([rnd(), rnd(), s % K]);
  for (var i = 0; i < N; i++) {
    X.push(rnd()); Y.push(rnd());
    var best = 0, bd = 9;
    for (s = 0; s < seeds.length; s++) {
      var dx = X[i] - seeds[s][0], dy = Y[i] - seeds[s][1], d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = s; }
    }
    LAB.push(rnd() < 0.08 ? Math.floor(rnd() * K) : seeds[best][2]);
  }

  function makeAdj(pick) {
    var sets = [];
    for (var i = 0; i < N; i++) sets.push({});
    for (i = 0; i < N; i++) pick(i).forEach(function (j) { sets[i][j] = 1; sets[j][i] = 1; });
    return sets.map(function (o) { return Object.keys(o).map(Number); });
  }
  // homophilous graph: k nearest neighbours in the plane
  var ADJ = makeAdj(function (i) {
    var near = []; // the KNN closest so far, nearest first
    for (var j = 0; j < N; j++) if (j !== i) {
      var dx = X[i] - X[j], dy = Y[i] - Y[j], d = dx * dx + dy * dy;
      if (near.length === KNN && d >= near[KNN - 1][0]) continue;
      var at = near.length;
      while (at > 0 && near[at - 1][0] > d) at--;
      near.splice(at, 0, [d, j]);
      if (near.length > KNN) near.pop();
    }
    return near.map(function (p) { return p[1]; });
  });
  // the same nodes and labels, with edges drawn at random: neighbours carry no label information
  var rndE = kit.rng(77);
  var ADJ_RAND = makeAdj(function (i) {
    var out = [];
    while (out.length < KNN) { var j = Math.floor(rndE() * N); if (j !== i) out.push(j); }
    return out;
  });

  var P = [];
  for (i = 0; i < N; i++) {
    var z = [], m = -1e9, tot = 0;
    for (var k = 0; k < K; k++) { z.push((k === LAB[i] ? BUMP : 0) + kit.gauss(rnd)); m = Math.max(m, z[k]); }
    z = z.map(function (v) { v = Math.exp(v - m); tot += v; return v; });
    P.push(z.map(function (v) { return v / tot; }));
  }

  function neighbourMean(S, adj, v) {
    var out = [0, 0, 0], nb = adj[v];
    nb.forEach(function (u) { for (var k = 0; k < K; k++) out[k] += S[u][k] / nb.length; });
    return out;
  }
  var NBMEAN = P.map(function (_, v) { return neighbourMean(P, ADJ, v); });
  var NBMEAN_RAND = P.map(function (_, v) { return neighbourMean(P, ADJ_RAND, v); });
  function diffuse(nbm, lam) {
    return P.map(function (p, v) { return p.map(function (x, k) { return (1 - lam) * x + lam * nbm[v][k]; }); });
  }

  function split(seed) {
    var r = kit.rng(seed), idx = [];
    for (var i = 0; i < N; i++) idx.push(i);
    for (i = N - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp; }
    return { cal: idx.slice(0, NCAL), test: idx.slice(NCAL) };
  }
  function threshold(S, cal) {
    var c = cal.map(function (v) { return S[v][LAB[v]]; }).sort(function (a, b) { return a - b; });
    return c[Math.floor(ALPHA * (cal.length + 1)) - 1]; // keeps at least 1 - alpha of exchangeable test nodes
  }
  function setOf(row, q) {
    var out = [];
    for (var k = 0; k < K; k++) if (row[k] >= q) out.push(k);
    return out;
  }
  function evaluate(S, sp) {
    var q = threshold(S, sp.cal), cov = 0, size = 0, hit = 0;
    sp.test.forEach(function (v) {
      var set = setOf(S[v], q), ok = set.indexOf(LAB[v]) >= 0;
      cov += ok; size += set.length; hit += ok && set.length === 1;
    });
    var n = sp.test.length;
    return { q: q, cov: cov / n, size: size / n, hit: hit / n };
  }

  // λ grid; S for each λ on both graphs
  var LGRID = [];
  for (i = 0; i <= 50; i++) LGRID.push(i / 50);
  var S_H = LGRID.map(function (l) { return diffuse(NBMEAN, l); });
  var S_R = LGRID.map(function (l) { return diffuse(NBMEAN_RAND, l); });

  // averaged curves over 20 random splits
  var SPLITS20 = [];
  for (i = 0; i < 20; i++) SPLITS20.push(split(1000 + i));
  function curveOf(SS) {
    return SS.map(function (S) {
      var a = { cov: 0, size: 0, hit: 0 };
      SPLITS20.forEach(function (sp) { var e = evaluate(S, sp); a.cov += e.cov / 20; a.size += e.size / 20; a.hit += e.hit / 20; });
      return a;
    });
  }
  var CURVE_H = curveOf(S_H), CURVE_R = curveOf(S_R);

  // λ* = the λ in [0.1, 0.9] with the smallest average set size on the homophilous graph
  var LSTAR_I = 5;
  for (i = 5; i <= 45; i++) if (CURVE_H[i].size < CURVE_H[LSTAR_I].size) LSTAR_I = i;
  var LSTAR = LGRID[LSTAR_I];

  // one fixed split, used by the node and graph plots
  var MAIN = split(7);
  var MAIN_EVAL = S_H.map(function (S) { return evaluate(S, MAIN); });
  var IS_CAL = {};
  MAIN.cal.forEach(function (v) { IS_CAL[v] = 1; });

  /* ── shared drawing helpers ───────────────────────────────────────────── */

  function fmt(x, d) { return x.toFixed(d); }
  function pct(x) { return (100 * x).toFixed(1) + "%"; }
  function gridIndex(lam) { return Math.round(kit.clamp(lam, 0, 1) * 50); }
  function qAt(lam) { // threshold for the main split, interpolated on the λ grid
    var u = kit.clamp(lam, 0, 1) * 50, a = Math.floor(u), b = Math.min(50, a + 1);
    return kit.lerp(MAIN_EVAL[a].q, MAIN_EVAL[b].q, u - a);
  }
  function setLabel(set) { return "{" + set.map(function (k) { return CLS[k]; }).join(", ") + "}"; }
  function pie(x, y, r, set, alpha) {
    var c = kit.ctx();
    if (!set.length) { kit.dot(x, y, r, null, { stroke: kit.MUTED, lineWidth: 1.5, alpha: alpha }); return; }
    var start = -Math.PI / 2, step = 2 * Math.PI / set.length;
    set.forEach(function (k, n) {
      c.save();
      c.globalAlpha *= alpha === undefined ? 1 : alpha;
      c.beginPath(); c.moveTo(x, y); c.arc(x, y, r, start + n * step, start + (n + 1) * step); c.closePath();
      c.fillStyle = COL[k]; c.fill();
      c.restore();
    });
    kit.dot(x, y, r, null, { stroke: kit.BG, lineWidth: 1.5, alpha: alpha });
  }

  /* ── plot 1: one node, pulled by its neighbours ───────────────────────── */

  // a calibration-free test node whose own top class is wrong, whose own set is
  // {wrong, true}, and whose set at λ* is {true}; neighbours mostly share its label
  var V = -1;
  MAIN.test.forEach(function (v) {
    if (V >= 0) return;
    var deg = ADJ[v].length, own = P[v], top = own.indexOf(Math.max.apply(null, own));
    if (deg < 4 || deg > 6 || top === LAB[v]) return;
    var s0 = setOf(own, MAIN_EVAL[0].q), s1 = setOf(S_H[LSTAR_I][v], MAIN_EVAL[LSTAR_I].q);
    if (s0.length === 2 && s0.indexOf(LAB[v]) >= 0 && s1.length === 1 && s1[0] === LAB[v]) V = v;
  });
  var V_NB = ADJ[V];
  var V_TOP = function (u) { return P[u].indexOf(Math.max.apply(null, P[u])); };

  function drawPull(t) {
    var lam = LSTAR * kit.ease(t, 1.8, 7.2);
    var mixOn = kit.ease(t, 0.6, 1.6);
    // formula, with λ updating in place
    kit.rich([["s", {}], "′(", ["v", {}], ") = (1 − λ) · ", ["s", {}], "(", ["v", {}], ") + λ · mean of neighbours"], 24, 40, { size: 26 });
    kit.text("λ = " + fmt(lam, 2), 856, 40, { size: 26, weight: 600, align: "right", color: DAPS });

    // ego graph
    var cx = 190, cy = 270, R = 140;
    var pos = V_NB.map(function (u, n) {
      var a = -Math.PI / 2 + 2 * Math.PI * n / V_NB.length + 0.35;
      return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
    });
    pos.forEach(function (p) {
      kit.line([[cx, cy], p], kit.mix("#E2DDD3", "#2a3f5c", lam / LSTAR * 0.8), 2 + 3 * lam / LSTAR);
    });
    V_NB.forEach(function (u, n) {
      var k = V_TOP(u);
      kit.dot(pos[n][0], pos[n][1], 24, COL[k]);
      kit.text(CLS[k], pos[n][0], pos[n][1] + 8, { size: 22, weight: 700, color: "#ffffff", align: "center" });
    });
    var vk = V_TOP(V);
    kit.dot(cx, cy, 36, kit.BG, { stroke: kit.FG, lineWidth: 3 });
    kit.text("v", cx, cy + 9, { size: 28, fam: kit.SERIF, italic: true, weight: 600, align: "center" });
    kit.text("letters: each node's own top class", cx, 470, { size: 20, color: kit.MUTED, align: "center" });
    kit.text("true label of v: " + CLS[LAB[V]], cx, 500, { size: 22, weight: 600, align: "center" });

    // bars: own, neighbour mean, mixed
    var base = 400, H = 260, bw = 26, gap = 6;
    var own = P[V], nb = NBMEAN[V], mixed = own.map(function (x, k) { return (1 - lam) * x + lam * nb[k]; });
    var q = qAt(lam), set = setOf(mixed, q);
    var groups = [
      { x: 390, vals: own, name: "own", sub: "s(v, ·)", alpha: 1 },
      { x: 515, vals: nb, name: "neighbours", sub: "mean", alpha: mixOn * 0.6 + 0.4 },
      { x: 640, vals: mixed, name: "mixed", sub: "s′(v, ·)", alpha: 1 }
    ];
    kit.line([[375, base], [760, base]], kit.LINE, 2);
    groups.forEach(function (g, gi) {
      g.vals.forEach(function (val, k) {
        var x = g.x + k * (bw + gap), h = H * val;
        var inSet = gi === 2 && set.indexOf(k) >= 0;
        if (gi === 2) {
          kit.rect(x, base - h, bw, h, 3, inSet ? COL[k] : null, { stroke: COL[k], lineWidth: 2.5 });
        } else {
          kit.rect(x, base - h, bw, h, 3, COL[k], { alpha: g.alpha * (gi === 0 ? 0.85 : 1) });
        }
        kit.text(CLS[k], x + bw / 2, base + 26, { size: 20, color: kit.MUTED, align: "center" });
      });
      var mid = g.x + (3 * bw + 2 * gap) / 2;
      kit.text(g.name, mid, base + 56, { size: 22, weight: 600, align: "center", alpha: g.alpha });
    });
    // the threshold on the mixed scores, recalibrated at every λ
    var qy = base - H * q, x0 = 630, x1 = 750;
    kit.line([[x0, qy], [x1, qy]], kit.FG, 2, { dash: [6, 5] });
    kit.text("threshold", x1 + 8, qy - 4, { size: 20, color: kit.FG });
    kit.text(fmt(q, 2), x1 + 8, qy + 20, { size: 20, color: kit.FG, weight: 600 });
    // readout
    var ok = set.indexOf(LAB[V]) >= 0;
    kit.text("set of v:", 390, 110, { size: 24, color: kit.MUTED });
    kit.text(setLabel(set), 490, 110, { size: 26, weight: 700 });
    kit.text("size " + set.length + (ok ? ", contains " + CLS[LAB[V]] : ""), 490, 142, { size: 22, color: kit.MUTED });
    kit.text("filled = in the set", 845, 142, { size: 20, color: kit.MUTED, align: "right" });
  }

  /* ── plot 2: coverage over many random splits ─────────────────────────── */

  var NSPLIT = 150, COV_STD = [], COV_DAPS = [];
  for (i = 0; i < NSPLIT; i++) {
    var sp = split(5000 + i);
    COV_STD.push(evaluate(S_H[0], sp).cov);
    COV_DAPS.push(evaluate(S_H[LSTAR_I], sp).cov);
  }
  function mean(a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; }
  var CMIN = 0.85, CMAX = 0.95, BIN = 0.004;
  function stackOf(covs) { // column and height of each dot, in arrival order
    var counts = {};
    return covs.map(function (c) {
      var b = Math.round((kit.clamp(c, CMIN, CMAX) - CMIN) / BIN);
      counts[b] = (counts[b] || 0) + 1;
      return [b, counts[b] - 1];
    });
  }
  var STACK_STD = stackOf(COV_STD), STACK_DAPS = stackOf(COV_DAPS);

  function drawSplits(t) {
    var ax0 = 190, ax1 = 840, rows = [
      { y: 205, name: "standard", sub: "λ = 0", col: STD, st: STACK_STD, cov: COV_STD, a: 0.6, b: 4.4 },
      { y: 415, name: "DAPS", sub: "λ = " + fmt(LSTAR, 2), col: DAPS, st: STACK_DAPS, cov: COV_DAPS, a: 5.0, b: 8.8 }
    ];
    function xOf(c) { return ax0 + (ax1 - ax0) * (c - CMIN) / (CMAX - CMIN); }
    var tx = xOf(1 - ALPHA);
    kit.line([[tx, 40], [tx, 430]], kit.FG, 2, { dash: [6, 5] });
    kit.text("target 90%", tx, 28, { size: 22, weight: 600, align: "center" });
    rows.forEach(function (r) {
      kit.line([[ax0, r.y], [ax1, r.y]], kit.LINE, 2);
      kit.text(r.name, 20, r.y - 40, { size: 24, weight: 700, color: r.col === STD ? kit.FG : DAPS });
      kit.text(r.sub, 20, r.y - 10, { size: 22, color: kit.MUTED });
      var shown = Math.floor(NSPLIT * kit.ease(t, r.a, r.b));
      for (var n = 0; n < shown; n++) {
        var x = xOf(CMIN + r.st[n][0] * BIN), y = r.y - 7 - r.st[n][1] * 9;
        kit.dot(x, y, 4.2, r.col);
      }
      var done = kit.ease(t, r.b, r.b + 0.5);
      kit.text("mean " + pct(mean(r.cov)), 20, r.y - 70, { size: 22, weight: 600, color: kit.FG, alpha: done });
    });
    [0.86, 0.88, 0.92, 0.94].forEach(function (c) {
      kit.text(Math.round(c * 100) + "%", xOf(c), 445, { size: 20, color: kit.MUTED, align: "center" });
    });
    kit.text("coverage on the test nodes, one dot per random calibration split", (ax0 + ax1) / 2, 478,
      { size: 20, color: kit.MUTED, align: "center" });
  }

  /* ── plot 3: sets across a patch of the graph as λ rises ──────────────── */

  // the window: a square patch of the toy graph that holds all three classes
  var WS = 0.2, WX = 0, WY = 0, bestScore = -1;
  for (var gx = 0; gx <= 8; gx++) for (var gy = 0; gy <= 8; gy++) {
    var x0 = gx * 0.1, y0 = gy * 0.1, cnt = [0, 0, 0];
    if (x0 + WS > 1 || y0 + WS > 1) continue;
    for (i = 0; i < N; i++) if (X[i] >= x0 && X[i] < x0 + WS && Y[i] >= y0 && Y[i] < y0 + WS) cnt[LAB[i]]++;
    var sc = Math.min.apply(null, cnt);
    if (sc > bestScore) { bestScore = sc; WX = x0; WY = y0; }
  }
  var WIN = [];
  for (i = 0; i < N; i++) if (X[i] >= WX && X[i] < WX + WS && Y[i] >= WY && Y[i] < WY + WS) WIN.push(i);
  var INWIN = {};
  WIN.forEach(function (v) { INWIN[v] = 1; });

  function drawShrink(t) {
    var lam = LSTAR * kit.ease(t, 1.5, 8.0), gi = gridIndex(lam), e = MAIN_EVAL[gi], S = S_H[gi];
    var gx0 = 24, gy0 = 24, side = 500;
    function px(v) { return [gx0 + side * (X[v] - WX) / WS, gy0 + side * (Y[v] - WY) / WS]; }
    WIN.forEach(function (v) {
      ADJ[v].forEach(function (u) {
        if (u > v && INWIN[u]) kit.line([px(v), px(u)], kit.LINE, 1.5);
      });
    });
    WIN.forEach(function (v) {
      var p = px(v);
      if (IS_CAL[v]) kit.dot(p[0], p[1], 5, kit.MUTED);
      else pie(p[0], p[1], 11, setOf(S[v], e.q));
    });

    // readouts
    var rx = 570;
    kit.text("λ = " + fmt(lam, 2), rx, 60, { size: 30, weight: 700, color: DAPS });
    function readout(y, label, value, frac, col) {
      kit.text(label, rx, y, { size: 22, color: kit.MUTED });
      kit.text(value, 856, y, { size: 26, weight: 700, align: "right" });
      kit.rect(rx, y + 12, 286, 8, 4, kit.SOFT);
      kit.rect(rx, y + 12, 286 * kit.clamp(frac, 0, 1), 8, 4, col);
    }
    readout(130, "average set size", fmt(e.size, 2), (e.size - 1) / 2, DAPS);
    readout(205, "correct singletons", pct(e.hit), e.hit, DAPS);
    readout(280, "coverage", pct(e.cov), e.cov, kit.MUTED);
    var tx = rx + 286 * (1 - ALPHA);
    kit.line([[tx, 286], [tx, 302]], kit.FG, 2);
    kit.text("target 90%", tx, 324, { size: 20, color: kit.MUTED, align: "center" });

    // legend
    var ly = 390;
    CLS.forEach(function (c, k) {
      kit.dot(rx + 12 + k * 62, ly, 11, COL[k]);
      kit.text(c, rx + 30 + k * 62, ly + 8, { size: 22, weight: 600 });
    });
    pie(rx + 12, ly + 46, 11, [0, 1]);
    kit.text("slices: classes in the set", rx + 32, ly + 54, { size: 20, color: kit.MUTED });
    kit.dot(rx + 12, ly + 90, 5, kit.MUTED);
    kit.text("labelled (calibration)", rx + 32, ly + 98, { size: 20, color: kit.MUTED });
    kit.text("readouts: all 1500 test nodes", rx, 520, { size: 20, color: kit.MUTED });
  }

  /* ── plot 4: set size against λ, with and without homophily ───────────── */

  function drawCurve(t) {
    var ax0 = 90, ay0 = 360, ax1 = 560, ay1 = 50, YMIN = 1.0, YMAX = 3.0;
    function pt(l, v) { return [ax0 + (ax1 - ax0) * l, ay0 - (ay0 - ay1) * (v - YMIN) / (YMAX - YMIN)]; }
    kit.axes(ax0, ay0, ax1 + 10, ay1 - 10);
    [1.0, 1.5, 2.0, 2.5, 3.0].forEach(function (v) {
      var p = pt(0, v);
      kit.text(fmt(v, 1), ax0 - 12, p[1] + 7, { size: 20, color: kit.MUTED, align: "right" });
    });
    [0, 0.5, 1].forEach(function (l) {
      var p = pt(l, YMIN);
      kit.text(fmt(l, 1), p[0], ay0 + 28, { size: 20, color: kit.MUTED, align: "center" });
    });
    kit.text("λ, weight on the neighbours", (ax0 + ax1) / 2, ay0 + 58, { size: 22, color: kit.MUTED, align: "center" });
    kit.text("average set size", ax0 - 70, ay1 - 22, { size: 22, color: kit.MUTED });

    var curves = [
      { c: CURVE_H, col: DAPS, name: "neighbours share labels", a: 0.8, b: 4.2 },
      { c: CURVE_R, col: kit.MAROON, name: "random neighbours", a: 4.8, b: 8.2 }
    ];
    var ends = curves.map(function (cv) { return pt(1, cv.c[50].size); });
    // keep the two end labels apart
    if (Math.abs(ends[0][1] - ends[1][1]) < 52) {
      var midY = (ends[0][1] + ends[1][1]) / 2, up = ends[0][1] < ends[1][1] ? 0 : 1;
      ends[up][1] = midY - 26; ends[1 - up][1] = midY + 26;
    }
    curves.forEach(function (cv, n) {
      var pts = cv.c.map(function (e, i) { return pt(LGRID[i], e.size); });
      var u = kit.ease(t, cv.a, cv.b);
      // start dot always visible so the first frame shows where both curves begin
      kit.dot(pts[0][0], pts[0][1], 6, cv.col);
      if (u > 0) kit.line(pts, cv.col, 4, { progress: u });
      var lab = kit.ease(t, cv.b - 0.2, cv.b + 0.4);
      kit.text(cv.name, ax1 + 18, ends[n][1] + 7, { size: 22, weight: 600, color: cv.col, alpha: lab });
      var cov = cv.c.map(function (e) { return e.cov; });
      kit.text("coverage " + pct(Math.min.apply(null, cov)) + " to " + pct(Math.max.apply(null, cov)),
        ax1 + 18, ends[n][1] + 33, { size: 20, color: kit.MUTED, alpha: lab });
    });
    kit.text("both start from the same sets", pt(0, 0)[0] + 16, pt(0, CURVE_H[0].size)[1] - 40,
      { size: 20, color: kit.MUTED });
  }

  if (kit.__debug) kit.__debug.toy = {
    V: V, deg: V_NB.length, LSTAR: LSTAR, MAIN0: MAIN_EVAL[0], MAINS: MAIN_EVAL[LSTAR_I],
    H: CURVE_H.map(function (e) { return e.size.toFixed(3); }).join(" "),
    R: CURVE_R.map(function (e) { return e.size.toFixed(3); }).join(" "),
    covStd: mean(COV_STD), covDaps: mean(COV_DAPS), win: WIN.length,
    acc: P.filter(function (p, v) { return p.indexOf(Math.max.apply(null, p)) === LAB[v]; }).length / N,
    homophily: (function () { var a = 0, b = 0; for (var v = 0; v < N; v++) ADJ[v].forEach(function (u) { b++; a += LAB[u] === LAB[v]; }); return a / b; })()
  };

  return {
    pull: { size: [880, 520], duration: 9, draw: drawPull },
    splits: { size: [880, 495], duration: 10, draw: drawSplits },
    shrink: { size: [880, 548], duration: 9.5, draw: drawShrink },
    homophily: { size: [880, 440], duration: 9.5, draw: drawCurve }
  };
});
