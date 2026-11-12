/* ==========================================================================
   Animated plots for the EvA post (blogs/evolutionary-attacks-on-graphs.md).

   One toy, shared by every plot:
   - a 60-node graph with three communities of 20 (a stochastic block model);
   - every node has its own noisy class probabilities P_v (a softmax of a
     one-hot signal plus Gaussian noise), standing in for a feature model;
   - the "GNN" predicts argmax of (1 - MIX) P_v + MIX * (weighted mean of the
     neighbours' P_u), one mixing step, so edges carry the signal;
   - the attacker flips BUDGET node pairs (adds or removes an edge) to lower
     accuracy.
   Three attacks with the same budget, all run here at load:
   - evolution: a genetic algorithm over sets of flips, scored by accuracy
     with forward passes only (keep the best, cross over, mutate);
   - random search: the best of as many random flip sets as evolution
     evaluates;
   - gradient: projected gradient ascent on a relaxed edge weight for every
     pair, against a cross-entropy surrogate, then rounding to the top flips.
   Every number on the plots comes from these runs.
   ========================================================================== */
sitePlots.define(function (kit) {
  "use strict";

  var FG = kit.FG, MUTED = kit.MUTED, LINE = kit.LINE, RED = kit.RED, ORANGE = kit.ORANGE;
  var NAVY = kit.NAVY, GOLD = kit.GOLD;
  var CLASS = [kit.BLUE, kit.GREEN, "#7A4FB3"];
  var CLASS_NAME = ["A", "B", "C"];
  var ease = kit.ease, easeOut = kit.easeOut, clamp = kit.clamp, lerp = kit.lerp;
  var text = kit.text;

  /* ── the toy model ────────────────────────────────────────────────────── */

  var N = 60, K = 3, PIN = 0.24, POUT = 0.02, SIG = 1.0, MIX = 0.7;
  var BUDGET = 8, POP = 24, ELITE = 6, GEN = 100, PMUT = 0.15, TEMP = 10;
  var r = kit.rng(1);

  var label = [];
  for (var v = 0; v < N; v++) label.push(Math.floor(v * K / N));
  var A = new Float64Array(N * N);
  var PAIRS = [];
  for (var a = 0; a < N; a++) for (var b = a + 1; b < N; b++) {
    if (r() < (label[a] === label[b] ? PIN : POUT)) A[a * N + b] = A[b * N + a] = 1;
  }
  for (a = 0; a < N; a++) for (b = a + 1; b < N; b++) PAIRS.push([a, b]);
  var P = [];
  for (v = 0; v < N; v++) {
    var z = [0, 1, 2].map(function (k) { return (k === label[v] ? 1 : 0) + SIG * kit.gauss(r); });
    var m = Math.max(z[0], z[1], z[2]);
    var e = z.map(function (x) { return Math.exp(x - m); });
    var s = e[0] + e[1] + e[2];
    P.push(e.map(function (x) { return x / s; }));
  }
  var deg0 = [], sum0 = [];
  for (v = 0; v < N; v++) {
    var d = 0, sm = [0, 0, 0];
    for (var u = 0; u < N; u++) if (A[v * N + u]) { d++; for (var k = 0; k < 3; k++) sm[k] += P[u][k]; }
    deg0.push(d); sum0.push(sm);
  }
  var EDGES = [];
  for (a = 0; a < N; a++) for (b = a + 1; b < N; b++) if (A[a * N + b]) EDGES.push([a, b]);

  function argmax(o) { var bi = 0; if (o[1] > o[bi]) bi = 1; if (o[2] > o[bi]) bi = 2; return bi; }

  // The model with the flips in `flips` applied at weight w (1 = flipped, 0 = clean).
  // Returns per-node correctness, accuracy and the cross-entropy surrogate.
  function model(flips, w) {
    var dd = {}, ds = {};
    flips.forEach(function (f) {
      var pa = PAIRS[f], sg = (A[pa[0] * N + pa[1]] ? -1 : 1) * w;
      [[pa[0], pa[1]], [pa[1], pa[0]]].forEach(function (q) {
        if (!(q[0] in dd)) { dd[q[0]] = 0; ds[q[0]] = [0, 0, 0]; }
        dd[q[0]] += sg;
        for (var k = 0; k < 3; k++) ds[q[0]][k] += sg * P[q[1]][k];
      });
    });
    var ok = [], nOk = 0, ce = 0;
    for (var v = 0; v < N; v++) {
      var d = deg0[v], s = sum0[v];
      if (v in dd) { d += dd[v]; s = [s[0] + ds[v][0], s[1] + ds[v][1], s[2] + ds[v][2]]; }
      var o = d > 1e-9 ? [0, 1, 2].map(function (k) { return (1 - MIX) * P[v][k] + MIX * s[k] / d; }) : P[v];
      var c = argmax(o) === label[v];
      ok.push(c); if (c) nOk++;
      var mx = Math.max(o[0], o[1], o[2]) * TEMP, se = 0;
      for (var k = 0; k < 3; k++) se += Math.exp(TEMP * o[k] - mx);
      ce += -(TEMP * o[label[v]] - mx - Math.log(se));
    }
    return { ok: ok, acc: nOk / N, nOk: nOk, ce: ce / N };
  }
  var evals = 0;
  function fitness(flips) { evals++; return model(flips, 1).acc; }
  var CLEAN = model([], 1);

  function randomSet(rr) {
    var f = [];
    while (f.length < BUDGET) { var c = Math.floor(rr() * PAIRS.length); if (f.indexOf(c) < 0) f.push(c); }
    return f;
  }

  // Evolution. Every generation is stored sorted (lowest accuracy first) with its lineage.
  var gr = kit.rng(32);
  var pop = [];
  for (var i = 0; i < POP; i++) { var f0 = randomSet(gr); pop.push({ f: f0, acc: fitness(f0) }); }
  pop.sort(function (x, y) { return x.acc - y.acc; });
  var GENS = [pop];
  for (var g = 0; g < GEN; g++) {
    var next = pop.slice(0, ELITE).map(function (x, j) { return { f: x.f.slice(), acc: x.acc, kept: j }; });
    while (next.length < POP) {
      // the fitter of two random members, twice
      var ia = Math.min(Math.floor(gr() * POP), Math.floor(gr() * POP));
      var ib = Math.min(Math.floor(gr() * POP), Math.floor(gr() * POP));
      var pool = pop[ia].f.map(function (x) { return [x, 0]; }).concat(pop[ib].f.map(function (x) { return [x, 1]; }));
      var child = [], from = [];
      while (child.length < BUDGET && pool.length) {
        var pick = pool.splice(Math.floor(gr() * pool.length), 1)[0];
        if (child.indexOf(pick[0]) < 0) { child.push(pick[0]); from.push(pick[1]); }
      }
      while (child.length < BUDGET) { var c = Math.floor(gr() * PAIRS.length); if (child.indexOf(c) < 0) { child.push(c); from.push(2); } }
      var before = child.slice(), mut = [];
      for (var k = 0; k < BUDGET; k++) if (gr() < PMUT) {
        var c2; do { c2 = Math.floor(gr() * PAIRS.length); } while (child.indexOf(c2) >= 0);
        child[k] = c2; mut.push(k);
      }
      next.push({ f: child, acc: fitness(child), pa: ia, pb: ib, from: from, before: before, mut: mut });
    }
    pop = next.sort(function (x, y) { return x.acc - y.acc; });
    GENS.push(pop);
  }
  var EVALS = evals; // forward passes spent by evolution
  var EVA_SET = GENS[GEN][0].f;
  var EVA_CURVE = GENS.map(function (gp, j) { return { n: POP * (j + 1), acc: gp[0].acc }; });

  // Random search with the same number of evaluations.
  var rr = kit.rng(54), bestR = 1, RAND_CURVE = [];
  for (i = 0; i < EVALS; i++) {
    var ar = fitness(randomSet(rr));
    if (ar < bestR) bestR = ar;
    if ((i + 1) % POP === 0) RAND_CURVE.push({ n: i + 1, acc: bestR });
  }

  // Gradient attack: PGD on relaxed pair weights p (sum p <= BUDGET), then keep the top BUDGET.
  var GRAD_SET = (function () {
    var NP = PAIRS.length, p = new Float64Array(NP), W = new Float64Array(N * N);
    var gW = new Float64Array(N * N), grad = new Float64Array(NP);
    for (var it = 0; it < 80; it++) {
      W.set(A);
      for (var q = 0; q < NP; q++) if (p[q]) {
        var a = PAIRS[q][0], b = PAIRS[q][1], w = A[a * N + b] + p[q] * (1 - 2 * A[a * N + b]);
        W[a * N + b] = W[b * N + a] = w;
      }
      for (var v = 0; v < N; v++) {
        var d = 0, mean = [0, 0, 0];
        for (var u = 0; u < N; u++) { var ww = W[v * N + u]; if (ww) { d += ww; for (var k = 0; k < 3; k++) mean[k] += ww * P[u][k]; } }
        if (d < 1e-9) { for (u = 0; u < N; u++) gW[v * N + u] = 0; continue; }
        var o = [0, 0, 0];
        for (k = 0; k < 3; k++) { mean[k] /= d; o[k] = TEMP * ((1 - MIX) * P[v][k] + MIX * mean[k]); }
        var mx = Math.max(o[0], o[1], o[2]), ex = o.map(function (x) { return Math.exp(x - mx); });
        var se = ex[0] + ex[1] + ex[2];
        var dS = [0, 1, 2].map(function (k) { return TEMP * (ex[k] / se - (k === label[v] ? 1 : 0)); });
        for (u = 0; u < N; u++) {
          gW[v * N + u] = u === v ? 0 : MIX / d * (dS[0] * (P[u][0] - mean[0]) + dS[1] * (P[u][1] - mean[1]) + dS[2] * (P[u][2] - mean[2]));
        }
      }
      for (q = 0; q < NP; q++) {
        a = PAIRS[q][0]; b = PAIRS[q][1];
        grad[q] = (gW[a * N + b] + gW[b * N + a]) * (1 - 2 * A[a * N + b]);
        p[q] += 2 * grad[q];
      }
      // project onto 0 <= p <= 1, sum p <= BUDGET
      var tot = 0, hi = 0;
      for (q = 0; q < NP; q++) { tot += clamp(p[q], 0, 1); hi = Math.max(hi, p[q]); }
      var mu = 0;
      if (tot > BUDGET) {
        var lo = 0;
        for (var bis = 0; bis < 40; bis++) {
          mu = (lo + hi) / 2; var t2 = 0;
          for (q = 0; q < NP; q++) t2 += clamp(p[q] - mu, 0, 1);
          if (t2 > BUDGET) lo = mu; else hi = mu;
        }
        mu = hi;
      }
      for (q = 0; q < NP; q++) p[q] = clamp(p[q] - mu, 0, 1);
    }
    var idx = [];
    for (var q2 = 0; q2 < NP; q2++) idx.push(q2);
    idx.sort(function (x, y) { return p[y] - p[x]; });
    return idx.slice(0, BUDGET);
  })();
  var GRAD = model(GRAD_SET, 1), EVA = model(EVA_SET, 1);

  function pct(x) { return Math.round(x * 100) + "%"; }
  function pairName(f) { return PAIRS[f][0] + "–" + PAIRS[f][1]; }

  /* ── plot 1: a few flips turn nodes wrong ─────────────────────────────── */

  // layout: a small force-directed embedding, seeded around three centres
  var POS = (function () {
    var lr = kit.rng(7), cx = [170, 440, 710], cy = [300, 150, 300];
    var x = [], y = [];
    for (var v = 0; v < N; v++) {
      var ang = lr() * 2 * Math.PI, rad = 30 + 70 * Math.sqrt(lr());
      x.push(cx[label[v]] + rad * Math.cos(ang)); y.push(cy[label[v]] + rad * Math.sin(ang));
    }
    for (var it = 0; it < 220; it++) {
      var fx = new Float64Array(N), fy = new Float64Array(N);
      for (var i = 0; i < N; i++) for (var j = i + 1; j < N; j++) {
        var dx = x[i] - x[j], dy = y[i] - y[j], dist2 = dx * dx + dy * dy + 1, dist = Math.sqrt(dist2);
        var rep = 900 / dist2;
        fx[i] += rep * dx / dist; fy[i] += rep * dy / dist; fx[j] -= rep * dx / dist; fy[j] -= rep * dy / dist;
        if (A[i * N + j] && label[i] === label[j]) {
          var att = (dist - 46) * 0.04;
          fx[i] -= att * dx / dist; fy[i] -= att * dy / dist; fx[j] += att * dx / dist; fy[j] += att * dy / dist;
        }
      }
      for (i = 0; i < N; i++) {
        fx[i] += (cx[label[i]] - x[i]) * 0.02; fy[i] += (cy[label[i]] - y[i]) * 0.02;
        x[i] += clamp(fx[i], -6, 6); y[i] += clamp(fy[i], -6, 6);
      }
    }
    // fit into the drawing box
    var x0 = Math.min.apply(null, x), x1 = Math.max.apply(null, x), y0 = Math.min.apply(null, y), y1 = Math.max.apply(null, y);
    return x.map(function (xx, i) {
      return [lerp(60, 820, (xx - x0) / (x1 - x0)), lerp(118, 470, (y[i] - y0) / (y1 - y0))];
    });
  })();

  // apply EvA's flips one at a time, greedily: at each step the flip that leaves the fewest correct nodes
  var ORDER = (function () {
    var left = EVA_SET.slice(), done = [], states = [CLEAN];
    while (left.length) {
      var best = -1, bestS = null;
      left.forEach(function (f, j) {
        var st = model(done.concat([f]), 1);
        if (!bestS || st.nOk < bestS.nOk) { best = j; bestS = st; }
      });
      done.push(left.splice(best, 1)[0]); states.push(bestS);
    }
    return { flips: done, states: states };
  })();

  function nodeMark(x, y, cls, correct, alpha, hit) {
    var ctx = kit.ctx();
    if (hit > 0) kit.dot(x, y, 15, null, { stroke: RED, lineWidth: 3, alpha: hit * alpha });
    if (correct > 0.5) {
      kit.dot(x, y, 9, CLASS[cls], { alpha: alpha });
    } else {
      kit.dot(x, y, 9, kit.BG, { stroke: CLASS[cls], lineWidth: 3, alpha: alpha });
      ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = FG; ctx.lineWidth = 2.2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4); ctx.moveTo(x + 4, y - 4); ctx.lineTo(x - 4, y + 4); ctx.stroke();
      ctx.restore();
    }
  }

  var F_T0 = 1.4, F_DT = 0.95;
  function flipsPlot(t) {
    var nShown = 0, u = 0;
    for (var i = 0; i < BUDGET; i++) { var ti = F_T0 + i * F_DT; if (t >= ti) { nShown = i + 1; u = ease(t, ti, ti + 0.45); } }
    var stPrev = ORDER.states[Math.max(0, nShown - 1)], st = ORDER.states[nShown];
    var settle = nShown ? ease(t, F_T0 + (nShown - 1) * F_DT + 0.45, F_T0 + (nShown - 1) * F_DT + 0.75) : 1;

    // existing edges
    var removed = {};
    ORDER.flips.slice(0, nShown).forEach(function (f) { if (A[PAIRS[f][0] * N + PAIRS[f][1]]) removed[f] = true; });
    EDGES.forEach(function (ed) {
      kit.line([POS[ed[0]], POS[ed[1]]], "#cfc8bb", 1.5);
    });
    // flipped pairs
    ORDER.flips.forEach(function (f, i) {
      if (i >= nShown) return;
      var prog = i < nShown - 1 ? 1 : u, pa = POS[PAIRS[f][0]], pb = POS[PAIRS[f][1]];
      var pts = [pa, [lerp(pa[0], pb[0], prog), lerp(pa[1], pb[1], prog)]];
      if (removed[f]) kit.line([pa, pb], RED, 3, { dash: [6, 6], alpha: prog });
      else kit.line(pts, RED, 3.2);
    });
    // nodes
    for (var v = 0; v < N; v++) {
      var was = stPrev.ok[v], now = st.ok[v];
      var corr = nShown ? (was === now ? (now ? 1 : 0) : (settle > 0.5 ? (now ? 1 : 0) : (was ? 1 : 0))) : (CLEAN.ok[v] ? 1 : 0);
      var hit = CLEAN.ok[v] && !st.ok[v] ? (was === now ? 1 : settle) : 0;
      nodeMark(POS[v][0], POS[v][1], label[v], corr, 1, hit);
    }
    // community labels
    for (var c = 0; c < K; c++) {
      var mx = 0, my = 1e9, cnt = 0, sx = 0;
      for (v = 0; v < N; v++) if (label[v] === c) { sx += POS[v][0]; cnt++; my = Math.min(my, POS[v][1]); }
      mx = sx / cnt;
      text("class " + CLASS_NAME[c], mx, my - 22, { size: 21, color: CLASS[c], weight: 600, align: "center" });
    }
    // read-out, top left; numbers change in place
    var shownOk = nShown && settle < 0.5 ? stPrev : st;
    text("accuracy", 24, 34, { size: 21, color: MUTED });
    text(pct(shownOk.acc), 24, 72, { size: 36, weight: 700, color: nShown ? RED : FG, fam: kit.SERIF });
    text("flips  " + nShown + " / " + BUDGET, 130, 72, { size: 22, color: MUTED });
    // legend, top right
    var lx = 600;
    kit.dot(lx, 28, 9, CLASS[0]); text("correct", lx + 16, 35, { size: 21, color: MUTED });
    nodeMark(lx + 110, 28, 0, 0, 1, 0); text("wrong", lx + 126, 35, { size: 21, color: MUTED });
    kit.line([[lx - 8, 64], [lx + 22, 64]], RED, 3.2); text("added", lx + 30, 71, { size: 21, color: MUTED });
    kit.line([[lx + 102, 64], [lx + 132, 64]], RED, 3, { dash: [6, 6] }); text("removed", lx + 140, 71, { size: 21, color: MUTED });
    // takeaway
    var tk = ease(t, F_T0 + BUDGET * F_DT + 0.2, F_T0 + BUDGET * F_DT + 0.9);
    text(BUDGET + " of " + PAIRS.length.toLocaleString("en-US") + " possible flips: " + pct(CLEAN.acc) + " → " + pct(EVA.acc),
      440, 506, { size: 22, weight: 600, color: FG, align: "center", alpha: tk });
  }

  /* ── plot 2: the surrogate and the real objective disagree ────────────── */

  var S_STEPS = 200;
  function sweep(set) {
    var out = [];
    for (var i = 0; i <= S_STEPS; i++) { var st = model(set, i / S_STEPS); out.push({ ce: st.ce, acc: st.acc }); }
    return out;
  }
  var SW_G = sweep(GRAD_SET), SW_E = sweep(EVA_SET);
  var CE_LO = Math.min(SW_G[0].ce, SW_E[0].ce), CE_HI = Math.max(SW_G[S_STEPS].ce, SW_E[S_STEPS].ce);
  CE_LO = Math.floor(CE_LO * 10) / 10; CE_HI = Math.ceil(CE_HI * 10) / 10;
  var ACC_LO = Math.floor(EVA.acc * 20) / 20, ACC_HI = Math.ceil(CLEAN.acc * 20) / 20;

  function surrogatePlot(t) {
    var X0 = 120, X1 = 650;
    var top = { y0: 66, y1: 236, lo: CE_LO, hi: CE_HI }, bot = { y0: 316, y1: 486, lo: ACC_LO, hi: ACC_HI };
    function X(i) { return X0 + (X1 - X0) * i / S_STEPS; }
    function Y(pn, val) { return pn.y1 - (pn.y1 - pn.y0) * (val - pn.lo) / (pn.hi - pn.lo); }
    // axes and labels (all present at t = 0)
    [top, bot].forEach(function (pn) { kit.axes(X0, pn.y1, X1, pn.y0); });
    text("surrogate loss (what the gradient follows)", X0, 40, { size: 21, color: MUTED });
    text("accuracy (what the attacker wants low)", X0, 290, { size: 21, color: MUTED });
    text(top.hi.toFixed(1), X0 - 12, top.y0 + 7, { size: 20, color: MUTED, align: "right" });
    text(top.lo.toFixed(1), X0 - 12, top.y1 + 7, { size: 20, color: MUTED, align: "right" });
    text(pct(bot.hi), X0 - 12, bot.y0 + 7, { size: 20, color: MUTED, align: "right" });
    text(pct(bot.lo), X0 - 12, bot.y1 + 7, { size: 20, color: MUTED, align: "right" });
    text("0 · clean", X0, bot.y1 + 30, { size: 20, color: MUTED, align: "left" });
    text("1 · flipped", X1, bot.y1 + 30, { size: 20, color: MUTED, align: "right" });
    text("weight on the " + BUDGET + " chosen flips", (X0 + X1) / 2, bot.y1 + 30, { size: 20, color: MUTED, align: "center" });

    var stages = [
      [SW_G, "ce", top, ORANGE, 0.9, 2.8], [SW_G, "acc", bot, ORANGE, 2.9, 4.6],
      [SW_E, "ce", top, RED, 5.0, 6.9], [SW_E, "acc", bot, RED, 7.0, 8.7]
    ];
    var ends = [];
    stages.forEach(function (sg) {
      var prog = ease(t, sg[4], sg[5]);
      var pts = sg[0].map(function (q, i) { return [X(i), Y(sg[2], q[sg[1]])]; });
      kit.line(pts, sg[3], 3.5, { progress: prog, alpha: prog > 0 ? 1 : 0 });
      if (prog > 0) {
        var n = Math.max(1, Math.round(S_STEPS * prog));
        var q = sg[0][n];
        kit.dot(X(n), Y(sg[2], q[sg[1]]), 5.5, sg[3]);
        ends.push({ y: Y(sg[2], q[sg[1]]), x: X(n), val: sg[1] === "ce" ? q.ce.toFixed(2) : pct(q.acc), col: sg[3], pn: sg[2], name: sg[3] === RED ? "evolution" : "gradient", done: prog >= 1 });
      }
    });
    // end labels at the right, separated per panel
    [top, bot].forEach(function (pn) {
      var es = ends.filter(function (e) { return e.pn === pn; }).sort(function (a, b) { return a.y - b.y; });
      for (var i = 1; i < es.length; i++) if (es[i].y - es[i - 1].y < 28) es[i].y = es[i - 1].y + 28;
      es.forEach(function (e) {
        var lbl = e.done ? e.name + "  " + e.val : e.val;
        text(lbl, e.done ? X1 + 16 : e.x + 12, e.y + 7, { size: 21, weight: 600, color: e.col });
      });
    });
    var tk = ease(t, 9.0, 9.8);
    text("More surrogate loss, less damage.", 870, 40, { size: 21, weight: 600, color: FG, align: "right", alpha: tk });
  }

  /* ── plot 3: one generation, then a hundred ───────────────────────────── */

  // a child of generation 1 with genes from both parents and exactly one mutation
  var DEMO = (function () {
    var g1 = GENS[1];
    for (var i = ELITE; i < POP; i++) {
      var ch = g1[i];
      if (ch.mut && ch.mut.length === 1 && ch.from.indexOf(0) >= 0 && ch.from.indexOf(1) >= 0 && ch.from.indexOf(2) < 0 && ch.pa !== ch.pb) {
        return { child: ch, rank: i };
      }
    }
    for (i = ELITE; i < POP; i++) if (g1[i].pa !== g1[i].pb) return { child: g1[i], rank: i };
    return { child: g1[POP - 1], rank: POP - 1 };
  })();

  function generationPlot(t) {
    // population bars, left: one row per member, sorted, lowest accuracy at the top
    var BX = 40, BW = 230, BY = 122, RH = 19;
    var LO = ACC_LO - 0.05, HI = CLEAN.acc;
    function barLen(acc) { return BW * clamp((acc - LO) / (HI - LO), 0.02, 1); }
    var FF0 = 8.0, FF1 = 10.8;
    var ffwd = ease(t, FF0, FF1), gen = Math.round(ffwd * GEN);
    var showGen = t < 6.6 ? 0 : (t < FF0 ? 1 : Math.max(1, gen));
    var gp = GENS[showGen];
    text("population, sorted", BX, 40, { size: 21, color: MUTED });
    text("generation " + showGen, BX, 74, { size: 24, weight: 700, color: FG });
    text("best " + pct(gp[0].acc), BX, 104, { size: 24, weight: 700, color: RED });
    var sel = ease(t, 0.8, 1.4) * (1 - ease(t, 6.4, 6.8));
    var c = DEMO.child;
    for (var i = 0; i < POP; i++) {
      var y = BY + i * RH, mem = gp[i];
      var col = "#b9b2a6";
      if (showGen === 0 && i < ELITE) col = kit.mix("#b9b2a6", FG, sel * 0.6);
      if (showGen === 0 && t > 1.6 && i === c.pa) col = NAVY;
      if (showGen === 0 && t > 1.6 && i === c.pb) col = GOLD;
      if (showGen === 1 && t < FF0 && i === DEMO.rank) col = RED;
      if (t >= FF0 && i === 0) col = RED;
      kit.rect(BX, y, barLen(mem.acc), RH - 5, 3, col);
    }
    if (sel > 0) {
      kit.line([[BX + BW + 8, BY], [BX + BW + 14, BY], [BX + BW + 14, BY + ELITE * RH - 5], [BX + BW + 8, BY + ELITE * RH - 5]], FG, 2, { alpha: sel });
      text("kept", BX + BW + 20, BY + ELITE * RH / 2 + 4, { size: 20, color: FG, alpha: sel });
    }
    var axY = BY + POP * RH + 26;
    text(pct(LO), BX, axY, { size: 20, color: MUTED });
    text("accuracy", BX + BW / 2, axY, { size: 20, color: MUTED, align: "center" });
    text(pct(HI), BX + BW, axY, { size: 20, color: MUTED, align: "right" });

    // the making of one child, right
    var GX = 352, CW = 58, GAP = 6;
    function cellX(k) { return GX + k * (CW + GAP); }
    var RIGHT = cellX(BUDGET) - GAP;
    var rowY = [130, 214, 340];
    var pIn = ease(t, 1.6, 2.4), mIn = ease(t, 5.0, 5.6), fIn = ease(t, 5.8, 6.4);
    var dim = 1 - ease(t, 7.3, 7.8);
    if (dim > 0) {
      text("making one new flip set", GX, 40, { size: 21, color: MUTED, alpha: dim * pIn });
      var parents = [GENS[0][c.pa].f, GENS[0][c.pb].f], pcol = [NAVY, GOLD], pname = ["parent 1", "parent 2"];
      for (var pi = 0; pi < 2; pi++) {
        text(pname[pi] + "  " + pct(GENS[0][pi ? c.pb : c.pa].acc), GX, rowY[pi] - 12, { size: 21, weight: 600, color: pcol[pi], alpha: pIn * dim });
        for (var k = 0; k < BUDGET; k++) {
          var at = c.before.indexOf(parents[pi][k]);
          var used = at >= 0 && c.from[at] === pi;
          var fade = used ? 1 : 1 - 0.6 * ease(t, 2.8, 3.3);
          kit.rect(cellX(k), rowY[pi], CW, 34, 4, null, { stroke: pcol[pi], lineWidth: 2, alpha: pIn * dim * fade });
          text(pairName(parents[pi][k]), cellX(k) + CW / 2, rowY[pi] + 24, { size: 20, color: FG, align: "center", alpha: pIn * dim * fade });
        }
      }
      text("child", GX, rowY[2] - 12, { size: 21, weight: 600, color: FG, alpha: ease(t, 2.8, 3.2) * dim });
      text("crossover", RIGHT, rowY[2] - 12, { size: 20, color: MUTED, align: "right", alpha: ease(t, 2.9, 3.3) * (1 - ease(t, 4.6, 5)) * dim });
      // crossover: genes drop one at a time from their parent's row into the child
      for (k = 0; k < BUDGET; k++) {
        var gene = c.before[k], src = c.from[k];
        var ti = 3.0 + k * 0.22, mv = easeOut(t, ti, ti + 0.45);
        if (mv <= 0) continue;
        var sk = parents[src].indexOf(gene);
        var x = lerp(cellX(sk), cellX(k), mv), y2 = lerp(rowY[src], rowY[2], mv);
        var isMut = c.mut.indexOf(k) >= 0, mutNow = isMut && mIn > 0.5;
        kit.rect(x, y2, CW, 34, 4, null, { stroke: mutNow ? RED : pcol[src], lineWidth: mutNow ? 3.5 : 2, alpha: dim });
        text(pairName(mutNow ? c.f[k] : gene), x + CW / 2, y2 + 24, { size: 20, color: mutNow ? RED : FG, weight: mutNow ? 700 : 400, align: "center", alpha: dim });
        if (isMut) text("mutation", cellX(k) + CW / 2, rowY[2] + 62, { size: 20, color: RED, weight: 600, align: "center", alpha: mIn * dim });
      }
      // evaluate the child: one forward pass
      text("child's accuracy " + pct(c.acc), GX, rowY[2] + 104, { size: 22, weight: 700, color: FG, alpha: fIn * dim });
      text("one forward pass, no gradient", GX, rowY[2] + 134, { size: 20, color: MUTED, alpha: fIn * dim });
    }
    // fast-forward: the best flip set of the current generation, updated in place
    var ff = ease(t, 7.8, 8.3);
    if (ff > 0) {
      var best = gp[0].f;
      text("best flip set, generation " + showGen, GX, rowY[1] - 12, { size: 21, weight: 600, color: RED, alpha: ff });
      for (k = 0; k < BUDGET; k++) {
        kit.rect(cellX(k), rowY[1], CW, 34, 4, null, { stroke: RED, lineWidth: 2, alpha: ff });
        text(pairName(best[k]), cellX(k) + CW / 2, rowY[1] + 24, { size: 20, color: FG, align: "center", alpha: ff });
      }
      text("accuracy " + pct(gp[0].acc), GX, rowY[1] + 80, { size: 24, weight: 700, color: RED, alpha: ff });
      text("from " + pct(GENS[0][0].acc) + " in generation 0", GX + 170, rowY[1] + 80, { size: 21, color: MUTED, alpha: ff });
      text("each generation: keep the best " + ELITE + ",", GX, rowY[2] + 60, { size: 21, color: FG, alpha: ff });
      text("breed and mutate " + (POP - ELITE) + " new sets, score them", GX, rowY[2] + 90, { size: 21, color: FG, alpha: ff });
    }
  }

  /* ── plot 4: same number of evaluations, much stronger flips ──────────── */

  function racePlot(t) {
    var X0 = 110, X1 = 640, Y0 = 60, Y1 = 380;
    var LO = ACC_LO - 0.05, HI = Math.ceil(CLEAN.acc * 20) / 20 + 0.0;
    function X(n) { return X0 + (X1 - X0) * n / EVALS; }
    function Y(a) { return Y1 - (Y1 - Y0) * (a - LO) / (HI - LO); }
    kit.axes(X0, Y1, X1, Y0);
    text("lowest accuracy found", X0, 34, { size: 21, color: MUTED });
    for (var a = LO; a <= HI + 1e-9; a += 0.05) {
      text(pct(a), X0 - 12, Y(a) + 7, { size: 20, color: MUTED, align: "right" });
      kit.line([[X0, Y(a)], [X1, Y(a)]], LINE, 1, { alpha: 0.6 });
    }
    text("0", X0, Y1 + 30, { size: 20, color: MUTED, align: "center" });
    text(EVALS.toLocaleString("en-US"), X1, Y1 + 30, { size: 20, color: MUTED, align: "center" });
    text("model evaluations", (X0 + X1) / 2, Y1 + 30, { size: 20, color: MUTED, align: "center" });
    // references
    kit.line([[X0, Y(CLEAN.acc)], [X1, Y(CLEAN.acc)]], MUTED, 2, { dash: [4, 6] });
    text("clean " + pct(CLEAN.acc), X1 + 14, Y(CLEAN.acc) + 7, { size: 21, color: MUTED });
    var ga = ease(t, 0.6, 1.2);
    kit.line([[X0, Y(GRAD.acc)], [X1, Y(GRAD.acc)]], ORANGE, 2.5, { dash: [10, 6], alpha: ga });
    // the two searches, drawn together
    var prog = ease(t, 1.4, 8.4);
    function steps(curve) {
      var pts = [[X(0), Y(curve[0].acc)]];
      curve.forEach(function (q, i) {
        if (i) pts.push([X(q.n), pts[pts.length - 1][1]]);
        pts.push([X(q.n), Y(q.acc)]);
      });
      return pts;
    }
    var nNow = prog * EVALS;
    function upTo(curve) {
      var last = curve[0];
      curve.forEach(function (q) { if (q.n <= nNow) last = q; });
      var sub = curve.filter(function (q) { return q.n <= nNow; });
      if (!sub.length) sub = [curve[0]];
      var pts = steps(sub);
      pts.push([X(Math.max(nNow, sub[0].n)), pts[pts.length - 1][1]]);
      return { pts: pts, acc: last.acc };
    }
    var R = upTo(RAND_CURVE), E = upTo(EVA_CURVE);
    if (prog > 0) {
      kit.line(R.pts, MUTED, 3.5);
      kit.line(E.pts, RED, 4);
    }
    // labels at the right, kept apart
    var labs = [
      { y: Y(GRAD.acc), s: "gradient " + pct(GRAD.acc), c: ORANGE, a: ga },
      { y: Y(prog > 0 ? R.acc : RAND_CURVE[0].acc), s: "random search " + pct(R.acc), c: MUTED, a: prog > 0 ? 1 : 0 },
      { y: Y(prog > 0 ? E.acc : EVA_CURVE[0].acc), s: "evolution " + pct(E.acc), c: RED, a: prog > 0 ? 1 : 0 }
    ].sort(function (p, q) { return p.y - q.y; });
    var cleanY = Y(CLEAN.acc) + 28;
    for (var i = 0; i < labs.length; i++) {
      var minY = i ? labs[i - 1].y + 28 : cleanY;
      if (labs[i].y < minY) labs[i].y = minY;
    }
    labs.forEach(function (l) { text(l.s, X1 + 14, l.y + 7, { size: 21, weight: 600, color: l.c, alpha: l.a }); });
    var tk = ease(t, 8.6, 9.3);
    text("Same budget of " + BUDGET + " flips and the same number of forward passes.", 440, 444, { size: 21, color: FG, align: "center", alpha: tk });
  }

  return {
    flips: { size: [880, 530], duration: 10.5, draw: flipsPlot },
    surrogate: { size: [880, 530], duration: 10.5, draw: surrogatePlot },
    generation: { size: [880, 630], duration: 11.5, draw: generationPlot },
    race: { size: [880, 460], duration: 10, draw: racePlot }
  };
});
