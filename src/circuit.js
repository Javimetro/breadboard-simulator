// Circuit layer: turns the workbench (board + parts + wires) into a netlist, solves it each
// step, and works out what every part does (light, heat, damage, readings). No DOM.
(function () {
  'use strict';
  var BB = (globalThis.BB = globalThis.BB || {});
  var E = BB.engine, PARTS = BB.PARTS;

  function rotate(dx, dy, rot) {
    switch (((rot || 0) % 360 + 360) % 360) {
      case 90: return [-dy, dx];
      case 180: return [-dx, -dy];
      case 270: return [dy, -dx];
      default: return [dx, dy];
    }
  }

  function Sim(state) {
    this.state = state;
    this.board = BB.board.makeBoard(state.board);
    this.t = 0;
    this.res = null;
    this._dirty = true;
    this.events = [];
  }
  var S = Sim.prototype;

  S.setBoard = function (cfg) { this.state.board = cfg; this.board = BB.board.makeBoard(cfg); this._dirty = true; };
  S.part = function (id) { var ps = this.state.parts; for (var i = 0; i < ps.length; i++) if (ps[i].id === id) return ps[i]; return null; };
  S.dirty = function () { this._dirty = true; };

  // ---------- geometry ----------
  // Position (pitch units) of every pin of a part, and the hole/pin it is plugged into.
  S.pinPoints = function (p) {
    var def = PARTS[p.type], self = this, out = [];
    if (def.kind === 'leads' || def.kind === 'module') {
      p.ends.forEach(function (e, k) {
        var pos = self.endPos(e);
        out.push({ x: pos.x, y: pos.y, at: e.at || null });
      });
    } else if (def.kind === 'rigid') {
      def.pinPos.forEach(function (q, k) {
        var d = rotate(q[0], q[1], p.rot);
        var x = p.x + d[0], y = p.y + d[1];
        var h = p.free ? null : self.board.holeAt(x, y);
        if (h && (Math.abs(h.x - x) > 0.01 || Math.abs(h.y - y) > 0.01)) h = null;
        out.push({ x: x, y: y, at: h ? h.id : null });
      });
    } else { // offboard: its pins are attach points for wires
      def.pinPos.forEach(function (q, k) { out.push({ x: p.x + q[0], y: p.y + q[1], at: null, own: 'P:' + p.id + ':' + k }); });
    }
    return out;
  };
  // Where a lead end is: a hole, an off-board pin, or a free point.
  S.endPos = function (e) {
    if (e.at) {
      if (e.at.slice(0, 2) === 'P:') {
        var bits = e.at.split(':'), q = this.part(bits[1]);
        if (q) { var pp = PARTS[q.type].pinPos[+bits[2]]; if (pp) return { x: q.x + pp[0], y: q.y + pp[1] }; }
      } else {
        var h = this.board.byId[e.at];
        if (h) return { x: h.x, y: h.y };
      }
    }
    return { x: e.x || 0, y: e.y || 0 };
  };
  // Key of the conductor a pin touches: a breadboard strip, an off-board pin, or nothing.
  S.keyOf = function (pt, p, k) {
    if (pt.own) return pt.own;
    if (pt.at) {
      if (pt.at.slice(0, 2) === 'P:') return pt.at;
      var h = this.board.byId[pt.at];
      if (h) return 'H:' + h.strip;
    }
    return 'F:' + p.id + ':' + k;
  };
  // Which pin uses each hole / off-board pin.
  S.occupancy = function () {
    var occ = {}, self = this;
    this.state.parts.forEach(function (p) {
      self.pinPoints(p).forEach(function (pt, k) { if (pt.at) occ[pt.at] = { id: p.id, k: k }; });
    });
    return occ;
  };
  // Holes hidden under a board's body (only its own pins come through).
  S.covered = function () {
    var cov = {}, self = this;
    this.state.parts.forEach(function (p) {
      var def = PARTS[p.type];
      if (def.kind !== 'rigid' || p.free || !def.covers) return;
      var b = self.bodyRect(p);
      self.board.holes.forEach(function (h) {
        if (h.x > b.x0 + 0.3 && h.x < b.x1 - 0.3 && h.y > b.y0 + 0.3 && h.y < b.y1 - 0.3) cov[h.id] = p.id;
      });
    });
    return cov;
  };
  S.bodyRect = function (p) {
    var def = PARTS[p.type];
    if (def.kind === 'rigid') {
      var b = def.body, a = rotate(b[0], b[1], p.rot), c = rotate(b[2], b[3], p.rot);
      return { x0: p.x + Math.min(a[0], c[0]), y0: p.y + Math.min(a[1], c[1]), x1: p.x + Math.max(a[0], c[0]), y1: p.y + Math.max(a[1], c[1]) };
    }
    if (def.kind === 'module' || def.kind === 'offboard') return { x0: p.x, y0: p.y, x1: p.x + def.size[0], y1: p.y + def.size[1] };
    var pts = this.pinPoints(p);
    var xs = pts.map(function (q) { return q.x; }), ys = pts.map(function (q) { return q.y; });
    return { x0: Math.min.apply(0, xs) - 0.6, y0: Math.min.apply(0, ys) - 0.6, x1: Math.max.apply(0, xs) + 0.6, y1: Math.max.apply(0, ys) + 0.6 };
  };

  // ---------- nets: groups of points joined by plain conductors (strips, wires, inner links) ----------
  S.nets = function () {
    var parent = {}, self = this;
    function find(x) { if (parent[x] === undefined) parent[x] = x; while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    function join(a, b) { a = find(a); b = find(b); if (a !== b) parent[a] = b; }
    var keys = {};
    this.state.parts.forEach(function (p) {
      var def = PARTS[p.type], pts = self.pinPoints(p);
      var ks = pts.map(function (pt, k) { var key = self.keyOf(pt, p, k); find(key); return key; });
      keys[p.id] = ks;
      if (def.links) def.links(p).forEach(function (l) { join(ks[l[0]], ks[l[1]]); });
    });
    return { find: find, keys: keys };
  };

  // ---------- one simulation step ----------
  S.step = function (dt) {
    var self = this, parts = this.state.parts;
    this.t += dt;
    var ctx0 = { t: this.t, dt: dt, sim: this };
    // 1. microcontroller programs decide their pin states from the last readings
    parts.forEach(function (p) { if (PARTS[p.type].mcu && BB.programs) BB.programs.run(p, self, ctx0); });
    var nets = this.nets();
    this._nets = nets;
    // 2. find PWM duty (two-phase solve for PWM/tone pins)
    var duty = null;
    parts.forEach(function (p) {
      var io = p.st && p.st.io; if (!io || !p.st.powered) return;
      Object.keys(io).forEach(function (k) { if (io[k].mode === 'out' && io[k].pwm !== undefined && io[k].pwm > 0 && io[k].pwm < 1 && duty === null) duty = io[k].pwm; });
    });
    var phases = duty === null ? [{ phase: 'hi', w: 1 }] : [{ phase: 'hi', w: duty }, { phase: 'lo', w: 1 - duty }];
    var built = null, accV = null, accI = null, capV = {};
    phases.forEach(function (ph) {
      var b = self.build(ph.phase, dt, nets);
      var r = E.solve(b.circuit, { dt: dt, init: self._init && self._init.length === b.circuit.n ? self._init : null });
      if (!accV) { accV = new Float64Array(r.v.length); accI = new Float64Array(r.i.length); built = b; built.r = r; }
      for (var i = 0; i < r.v.length; i++) accV[i] += ph.w * r.v[i];
      for (var j = 0; j < r.i.length; j++) accI[j] += ph.w * r.i[j];
      Object.keys(r.capV).forEach(function (k) { capV[k] = (capV[k] || 0) + ph.w * r.capV[k]; });
      if (ph.phase === 'hi') self._init = r.v;
    });
    var r = built.r;
    var res = { v: accV, i: accI, island: r.island, refOf: r.refOf, converged: r.converged, capV: capV };
    this.interpret(built, res, dt, nets);
    this._dirty = false;
    this.ver = (this.ver || 0) + 1;
    return this.res;
  };

  // Build the netlist. Returns {circuit, nodeOf(key), elements with part/pin tags}.
  S.build = function (phase, dt, nets) {
    var self = this, parts = this.state.parts;
    var nodeIdx = {}, n = 0, els = [], refHints = [];
    function nodeFor(key) { if (nodeIdx[key] === undefined) nodeIdx[key] = n++; return nodeIdx[key]; }
    var pinNodes = {};
    parts.forEach(function (p) {
      var pts = self.pinPoints(p);
      pinNodes[p.id] = pts.map(function (pt, k) { return nodeFor(self.keyOf(pt, p, k)); });
    });
    var cur = null;
    function res(x) { if (typeof x === 'string') return pinNodes[cur.id][+x.slice(1)]; return x; }
    function pinTag(x) { return typeof x === 'string' ? +x.slice(1) : -1; }
    var nb = {
      pin: function (k) { return pinNodes[cur.id][k]; },
      node: function () { return n++; },
      ref: function (node) { refHints.push(node); },
      R: function (a, b, r) { els.push({ t: 'R', a: res(a), b: res(b), r: r, part: cur.id, pa: pinTag(a), pb: pinTag(b) }); return els.length - 1; },
      V: function (pp, m, v) { els.push({ t: 'V', p: res(pp), n: res(m), v: v, part: cur.id, pa: pinTag(pp), pb: pinTag(m) }); return els.length - 1; },
      D: function (a, k, is, nvt) { els.push({ t: 'D', a: res(a), k: res(k), is: is, nvt: nvt, part: cur.id, pa: pinTag(a), pb: pinTag(k) }); return els.length - 1; },
      C: function (a, b, c, st) { els.push({ t: 'C', a: res(a), b: res(b), c: c, v0: st.v0 || 0, part: cur.id, pa: pinTag(a), pb: pinTag(b) }); return els.length - 1; },
      I: function (a, b, i) { els.push({ t: 'I', a: res(a), b: res(b), i: i, part: cur.id, pa: pinTag(a), pb: pinTag(b) }); return els.length - 1; }
    };
    var sctx = { phase: phase, dt: dt, t: this.t, sim: this };
    parts.forEach(function (p) {
      p.st = p.st || {};
      cur = p;
      PARTS[p.type].stamp(p, nb, sctx);
    });
    // Off-board pins that nothing touches still need a node; F: keys are dangling ends.
    return { circuit: { n: n, els: els, refHints: refHints }, nodeIdx: nodeIdx, pinNodes: pinNodes };
  };

  S.interpret = function (b, r, dt, nets) {
    var self = this, parts = this.state.parts, els = b.circuit.els;
    var issues = [], events = [];
    // islands that contain a powered source
    var islandSource = {};
    els.forEach(function (e) { if (e.t === 'V' && Math.abs(e.v) > 0.01) { var q = self.part(e.part); var def = q && PARTS[q.type]; if (def && def.name !== 'Multimeter') islandSource[r.island[e.n]] = (islandSource[r.island[e.n]] || []).concat([e.part]); } });
    var dirtyAgain = false;
    var ctx = {
      t: this.t, dt: dt, parts: parts, sim: this,
      issue: function (p, kind, level, title, text) { issues.push({ part: p.id, kind: kind, level: level, title: title, text: text }); },
      event: function (p, type, data) { events.push({ part: p.id, type: type, data: data, t: self.t }); },
      netOfPin: function (p, k) {
        var ks = nets.keys[p.id]; if (!ks) return null;
        var key = ks[k]; if (!key || key[0] === 'F') return null;
        return nets.find(key);
      },
      nodeSupplied: function (p, k) { var nd = b.pinNodes[p.id][k]; return !!islandSource[r.island[nd]]; },
      pinConnected: function (p, k) { var key = nets.keys[p.id][k]; return key && key[0] !== 'F'; },
      poweredBy: function (p, k) {
        var nd = b.pinNodes[p.id][k], src = islandSource[r.island[nd]] || [];
        return src.some(function (id) { return id !== p.id; });
      },
      dirty: function () { dirtyAgain = true; }
    };
    parts.forEach(function (p) {
      var pn = b.pinNodes[p.id];
      var rr = {
        i: function (el) { return el === null || el === undefined ? 0 : r.i[el]; },
        v: function (node) { return r.v[node]; },
        pinV: function (k) { return r.v[pn[k]]; },
        capV: function (el) { return r.capV[el] || 0; }
      };
      PARTS[p.type].after(p, rr, ctx);
    });
    // current into each pin from the hole it sits in
    var pinIn = {};
    parts.forEach(function (p) { pinIn[p.id] = b.pinNodes[p.id].map(function () { return 0; }); });
    els.forEach(function (e, j) {
      var I = r.i[j], ia, ib;
      if (e.t === 'V') { ia = -I; ib = I; } else { ia = I; ib = -I; }
      if (e.pa >= 0) pinIn[e.part][e.pa] += ia;
      if (e.pb >= 0) pinIn[e.part][e.pb] += ib;
    });
    // voltage of every conductor key, and whether it is powered
    var keyV = {}, keyPowered = {};
    Object.keys(b.nodeIdx).forEach(function (key) {
      var nd = b.nodeIdx[key];
      keyV[key] = r.v[nd];
      keyPowered[key] = !!islandSource[r.island[nd]];
    });
    // current along each breadboard strip, between the holes that are in use
    var flows = [];
    var byStrip = {};
    parts.forEach(function (p) {
      self.pinPoints(p).forEach(function (pt, k) {
        if (!pt.at || pt.at.slice(0, 2) === 'P:') return;
        var h = self.board.byId[pt.at]; if (!h) return;
        (byStrip[h.strip] = byStrip[h.strip] || []).push({ h: h, inj: -pinIn[p.id][k] });
      });
    });
    Object.keys(byStrip).forEach(function (sk) {
      var list = byStrip[sk];
      if (list.length < 2) return;
      var st = self.board.strips[sk];
      list.sort(function (a, c) { return st.dir === 'v' ? a.h.y - c.h.y : a.h.x - c.h.x; });
      var acc = 0;
      for (var q = 0; q < list.length - 1; q++) {
        acc += list[q].inj;
        flows.push({ x1: list[q].h.x, y1: list[q].h.y, x2: list[q + 1].h.x, y2: list[q + 1].h.y, i: acc });
      }
    });
    this.res = { r: r, b: b, pinIn: pinIn, keyV: keyV, keyPowered: keyPowered, flows: flows, issues: issues, nets: nets, islandSource: islandSource, converged: r.converged };
    if (events.length) this.events = this.events.concat(events);
    if (dirtyAgain) this._dirty = true;
  };

  // Is anything changing over time, so the simulation must keep stepping?
  S.isDynamic = function () {
    var dyn = this._dirty;
    this.state.parts.forEach(function (p) {
      var def = PARTS[p.type], st = p.st || {};
      if (def.mcu && st.powered && p.props.program && p.props.program !== 'none') dyn = true;
      if (def.mcu && (st.usbTripped || (st.pinHeat && Object.keys(st.pinHeat).length))) dyn = true;
      if (st.heat > 0 && st.heat < 1) dyn = true;
      if (st.tripped) dyn = true;
      if (def.dynamic && def.dynamic(p)) dyn = true;
      if (st.segHeat && Object.keys(st.segHeat).some(function (k) { return st.segHeat[k] > 0; })) dyn = true;
    });
    return dyn;
  };

  // Voltage at a hole (relative to the 0 V of its circuit), or null when it is not powered.
  S.holeVoltage = function (holeId) {
    if (!this.res) return null;
    var h = this.board.byId[holeId]; if (!h) return null;
    var key = 'H:' + h.strip;
    if (this.res.keyV[key] === undefined || !this.res.keyPowered[key]) return null;
    return this.res.keyV[key];
  };
  // All holes electrically joined to a hole by strips, wires and inner links.
  S.connectedHoles = function (holeId) {
    var h = this.board.byId[holeId]; if (!h) return [];
    var nets = this.nets(), root = nets.find('H:' + h.strip), out = [], self = this;
    Object.keys(this.board.strips).forEach(function (sk) {
      if (nets.find('H:' + sk) === root) out = out.concat(self.board.strips[sk].holes);
    });
    return out;
  };
  S.connectedPins = function (key) {
    var nets = this.nets(), root = nets.find(key), out = [], self = this;
    this.state.parts.forEach(function (p) {
      self.pinPoints(p).forEach(function (pt, k) { if (nets.find(self.keyOf(pt, p, k)) === root) out.push({ part: p, k: k, x: pt.x, y: pt.y }); });
    });
    return out;
  };

  // Make a new part with default properties. init may set ends / x, y, rot, props.
  var uid = 1;
  function newPart(type, init) {
    var def = PARTS[type];
    init = init || {};
    var p = { id: init.id || (type + '-' + (Date.now() % 100000).toString(36) + '-' + (uid++)), type: type, props: {}, st: {} };
    Object.keys(def.defaults || {}).forEach(function (k) { p.props[k] = def.defaults[k]; });
    Object.assign(p.props, init.props || {});
    if (def.kind === 'leads' || def.kind === 'module') {
      p.ends = (init.ends || [{}, {}]).map(function (e) { return typeof e === 'string' ? { at: e } : Object.assign({}, e); });
    }
    if (def.kind !== 'leads') { p.x = init.x || 0; p.y = init.y || 0; p.rot = init.rot || 0; p.free = !!init.free; }
    if (init.locked) p.locked = true;
    return p;
  }
  BB.newPart = newPart;
  BB.Sim = Sim;
  BB.rotate = rotate;
  if (typeof module !== 'undefined' && module.exports) module.exports = Sim;
})();
