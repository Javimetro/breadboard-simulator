// Electrical engine: modified nodal analysis (MNA) with Newton-Raphson for diodes.
// Pure maths, no DOM. Works in the browser (globalThis.BB.engine) and in Node.
(function () {
  'use strict';
  var BB = (globalThis.BB = globalThis.BB || {});

  var VT = 0.025852; // thermal voltage at 300 K
  var GMIN = 1e-12; // tiny leak from every node to its reference, keeps the matrix solvable

  // Element types (all node numbers are 0..n-1):
  //  { t:'R', a, b, r }            resistor
  //  { t:'V', p, n, v }            ideal voltage source (+ at p)
  //  { t:'I', a, b, i }            current source: takes i from node a, pushes it into node b
  //  { t:'D', a, k, is, nvt }      diode / LED junction (anode a, cathode k)
  //  { t:'C', a, b, c, v0 }        capacitor; v0 = voltage a-b at the previous step
  // Results: element current `i` means: R/D/C/I -> from a to b (through the part);
  //          V -> current that leaves the + terminal into the circuit.

  function islands(n, els) {
    var parent = new Int32Array(n);
    for (var i = 0; i < n; i++) parent[i] = i;
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    function join(a, b) { a = find(a); b = find(b); if (a !== b) parent[a] = b; }
    els.forEach(function (e) {
      if (e.t === 'V') join(e.p, e.n);
      else if (e.t === 'D') join(e.a, e.k);
      else join(e.a, e.b);
    });
    var id = new Int32Array(n);
    for (var j = 0; j < n; j++) id[j] = find(j);
    return id;
  }

  // Gaussian elimination with partial pivoting. A is n*n row-major, b length n. Solves in place.
  function solveLinear(A, b, n) {
    for (var col = 0; col < n; col++) {
      var piv = col, best = Math.abs(A[col * n + col]);
      for (var r = col + 1; r < n; r++) {
        var v = Math.abs(A[r * n + col]);
        if (v > best) { best = v; piv = r; }
      }
      if (best < 1e-300) continue; // singular column: leave it, variable becomes 0
      if (piv !== col) {
        for (var c = col; c < n; c++) { var t = A[col * n + c]; A[col * n + c] = A[piv * n + c]; A[piv * n + c] = t; }
        var tb = b[col]; b[col] = b[piv]; b[piv] = tb;
      }
      var d = A[col * n + col];
      for (var r2 = col + 1; r2 < n; r2++) {
        var f = A[r2 * n + col] / d;
        if (f === 0) continue;
        for (var c2 = col; c2 < n; c2++) A[r2 * n + c2] -= f * A[col * n + c2];
        b[r2] -= f * b[col];
      }
    }
    var x = new Float64Array(n);
    for (var i = n - 1; i >= 0; i--) {
      var s = b[i];
      for (var k = i + 1; k < n; k++) s -= A[i * n + k] * x[k];
      var dd = A[i * n + i];
      x[i] = Math.abs(dd) < 1e-300 ? 0 : s / dd;
    }
    return x;
  }

  // SPICE-style junction voltage limiting, stops exp() from exploding between iterations.
  function pnjlim(vnew, vold, vt, vcrit) {
    if (vnew > vcrit && Math.abs(vnew - vold) > 2 * vt) {
      if (vold > 0) {
        var arg = 1 + (vnew - vold) / vt;
        vnew = arg > 0 ? vold + vt * Math.log(arg) : vcrit;
      } else {
        vnew = vt * Math.log(vnew / vt);
      }
    }
    return vnew;
  }

  // Diode current and conductance. Above vmax the curve continues as a straight line.
  function diodeIG(vd, is, nvt) {
    var vmax = nvt * 60;
    if (vd > vmax) {
      var em = Math.exp(60);
      var g = (is / nvt) * em;
      return { i: is * (em - 1) + g * (vd - vmax), g: g };
    }
    var e = Math.exp(vd / nvt);
    return { i: is * (e - 1), g: (is / nvt) * e };
  }

  // Solve one operating point.
  // circuit = { n, els, refHints:[node...] }  opts = { dt, init:Float64Array, maxIter }
  function solve(circuit, opts) {
    opts = opts || {};
    var n = circuit.n, els = circuit.els;
    var isl = islands(n, els);
    // Pick one reference (0 V) node for each island: a hint, else a source's minus, else the lowest node.
    var refOf = {};
    (circuit.refHints || []).forEach(function (h) { if (h < n && refOf[isl[h]] === undefined) refOf[isl[h]] = h; });
    els.forEach(function (e) { if (e.t === 'V' && refOf[isl[e.n]] === undefined) refOf[isl[e.n]] = e.n; });
    for (var q = 0; q < n; q++) if (refOf[isl[q]] === undefined) refOf[isl[q]] = q;
    var isRef = new Uint8Array(n);
    Object.keys(refOf).forEach(function (k) { isRef[refOf[k]] = 1; });

    var idx = new Int32Array(n), k = 0;
    for (var i = 0; i < n; i++) idx[i] = isRef[i] ? -1 : k++;
    var nv = k;
    var vsrc = [];
    els.forEach(function (e, j) { if (e.t === 'V') { e._j = nv + vsrc.length; vsrc.push(j); } });
    var size = nv + vsrc.length;

    var diodes = els.filter(function (e) { return e.t === 'D'; });
    var dt = opts.dt;
    var V = new Float64Array(n);
    if (opts.init && opts.init.length === n) V.set(opts.init);
    diodes.forEach(function (d) {
      d._vcrit = d.nvt * Math.log(d.nvt / (Math.SQRT2 * d.is));
      d._vd = V[d.a] - V[d.k];
    });

    function nodeV(x, node) { var j = idx[node]; return j < 0 ? 0 : x[j]; }

    var maxIter = opts.maxIter || 300;
    var x = new Float64Array(size), converged = false, iter = 0;
    for (iter = 1; iter <= maxIter; iter++) {
      var A = new Float64Array(size * size), b = new Float64Array(size);
      var addG = function (a, bb, g) {
        var ia = idx[a], ib = idx[bb];
        if (ia >= 0) A[ia * size + ia] += g;
        if (ib >= 0) A[ib * size + ib] += g;
        if (ia >= 0 && ib >= 0) { A[ia * size + ib] -= g; A[ib * size + ia] -= g; }
      };
      var addI = function (node, cur) { var j = idx[node]; if (j >= 0) b[j] += cur; }; // current pushed into node
      for (var m = 0; m < n; m++) if (idx[m] >= 0) A[idx[m] * size + idx[m]] += GMIN;
      for (var e = 0; e < els.length; e++) {
        var el = els[e];
        switch (el.t) {
          case 'R': addG(el.a, el.b, 1 / el.r); break;
          case 'I': addI(el.a, -el.i); addI(el.b, el.i); break;
          case 'V': {
            var r = el._j, ip = idx[el.p], ineg = idx[el.n];
            if (ip >= 0) { A[ip * size + r] += 1; A[r * size + ip] += 1; }
            if (ineg >= 0) { A[ineg * size + r] -= 1; A[r * size + ineg] -= 1; }
            b[r] += el.v;
            break;
          }
          case 'C': {
            if (!dt) break; // DC: a capacitor is an open circuit
            var gc = el.c / dt;
            addG(el.a, el.b, gc);
            addI(el.a, gc * (el.v0 || 0)); addI(el.b, -gc * (el.v0 || 0));
            break;
          }
          case 'D': {
            var ig = diodeIG(el._vd, el.is, el.nvt);
            var gd = ig.g + GMIN;
            var ieq = ig.i - ig.g * el._vd;
            addG(el.a, el.k, gd);
            addI(el.a, -ieq); addI(el.k, ieq);
            break;
          }
        }
      }
      var xn = solveLinear(A, b, size);
      // Convergence: node voltages stop moving and every junction voltage matches its limited value.
      var maxdv = 0;
      for (var s = 0; s < nv; s++) maxdv = Math.max(maxdv, Math.abs(xn[s] - x[s]) / (1 + Math.abs(xn[s])));
      var limited = false;
      for (var di = 0; di < diodes.length; di++) {
        var d = diodes[di];
        var vnew = nodeV(xn, d.a) - nodeV(xn, d.k);
        var vlim = pnjlim(vnew, d._vd, d.nvt, d._vcrit);
        if (Math.abs(vlim - vnew) > 1e-12) limited = true;
        maxdv = Math.max(maxdv, Math.abs(vlim - d._vd));
        d._vd = vlim;
      }
      x = xn;
      if (iter > 1 && !limited && maxdv < 1e-8) { converged = true; break; }
      if (diodes.length === 0) { converged = true; break; }
    }

    for (var z = 0; z < n; z++) V[z] = nodeV(x, z);
    var I = new Float64Array(els.length);
    var capV = {};
    els.forEach(function (el, j) {
      switch (el.t) {
        case 'R': I[j] = (V[el.a] - V[el.b]) / el.r; break;
        case 'I': I[j] = el.i; break;
        case 'V': I[j] = -x[el._j]; break;
        case 'D': I[j] = diodeIG(V[el.a] - V[el.k], el.is, el.nvt).i; break;
        case 'C': {
          var vc = V[el.a] - V[el.b];
          I[j] = dt ? (el.c / dt) * (vc - (el.v0 || 0)) : 0;
          capV[j] = vc;
          break;
        }
      }
    });
    return { v: V, i: I, converged: converged, iterations: iter, island: isl, refOf: refOf, capV: capV };
  }

  // LED / diode parameters. Each colour has a forward voltage at 20 mA (vf20) that includes
  // the drop across its internal series resistance rs.
  var LED_TYPES = {
    red:    { vf20: 2.0, rs: 10, nm: 630, rgb: '#ff2a1a', label: 'Red' },
    orange: { vf20: 2.05, rs: 10, nm: 605, rgb: '#ff8a1a', label: 'Orange' },
    yellow: { vf20: 2.1, rs: 10, nm: 590, rgb: '#ffd21a', label: 'Yellow' },
    green:  { vf20: 2.2, rs: 10, nm: 570, rgb: '#9bff3a', label: 'Yellow-green' },
    tgreen: { vf20: 3.0, rs: 12, nm: 525, rgb: '#19ff8a', label: 'Bright green' },
    blue:   { vf20: 3.0, rs: 12, nm: 470, rgb: '#2a7bff', label: 'Blue' },
    white:  { vf20: 3.1, rs: 12, nm: 0, rgb: '#f4f7ff', label: 'White' }
  };
  var LED_N = 2.0; // ideality factor typical for LEDs
  function ledParams(color) {
    var p = LED_TYPES[color] || LED_TYPES.red;
    var nvt = LED_N * VT;
    var vj = p.vf20 - 0.02 * p.rs; // junction voltage at 20 mA
    return { is: 0.02 / Math.exp(vj / nvt), nvt: nvt, rs: p.rs, vf20: p.vf20 };
  }
  // Forward voltage of an LED at a given current (used in explanations and tests).
  function ledVf(color, iA) {
    var p = ledParams(color);
    return p.nvt * Math.log(iA / p.is + 1) + iA * p.rs;
  }

  BB.engine = {
    solve: solve,
    solveLinear: solveLinear,
    ledParams: ledParams,
    ledVf: ledVf,
    LED_TYPES: LED_TYPES,
    VT: VT,
    GMIN: GMIN
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = BB.engine;
})();
