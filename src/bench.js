// The workbench view: draws the board and parts in an SVG, handles pan / pinch-zoom,
// dragging parts and legs, the wire tool, hole highlights and the current animation.
(function () {
  'use strict';
  var BB = (globalThis.BB = globalThis.BB || {});
  var PARTS = BB.PARTS, U = BB.art.U, DRAW = BB.art.DRAW;
  var NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(e);
    return e;
  }
  var LAYER = { offboard: 0, rigid: 1, leads: 2, module: 3, wire: 4 };

  function Bench(svg, app) {
    this.svg = svg; this.app = app;
    svg.innerHTML = BB.art.defs();
    this.world = el('g', { id: 'world' }, svg);
    this.content = el('g', { id: 'content' }, this.world);
    this.gBoard = el('g', {}, this.content);
    this.gHi = el('g', { class: 'hi' }, this.content);
    this.gParts = el('g', {}, this.content);
    this.gFlow = el('g', { class: 'flow' }, this.content);
    this.gLabels = el('g', { class: 'vlabels' }, this.content);
    this.gUi = el('g', {}, this.content);
    this.view = { s: 1, tx: 0, ty: 0 };
    this.tool = 'move';
    this.sel = null;
    this.xray = false;
    this.showFlow = false;
    this.hiHole = null;
    this.partEls = {};
    this.partKeys = {};
    this.pointers = {};
    this.drag = null;
    this.wireStart = null;
    this.flowKey = '';
    this.wireColorIdx = 0;
    this.loupe = document.getElementById('loupe');
    this.tip = document.getElementById('tip');
    this.bind();
  }
  var B = Bench.prototype;

  B.setSim = function (sim) { this.sim = sim; this.sel = null; this.hiHole = null; this.wireStart = null; this.renderBoard(); this.clearParts(); this.render(true); };
  B.clearParts = function () { this.gParts.innerHTML = ''; this.partEls = {}; this.partKeys = {}; this.flowKey = ''; this.gFlow.innerHTML = ''; this.gLabels.innerHTML = ''; };

  // ---------- view ----------
  B.applyView = function () {
    var v = this.view;
    this.world.setAttribute('transform', 'translate(' + v.tx.toFixed(2) + ' ' + v.ty.toFixed(2) + ') scale(' + v.s.toFixed(4) + ')');
  };
  B.size = function () { var r = this.svg.getBoundingClientRect(); return { w: r.width || 1, h: r.height || 1, left: r.left, top: r.top }; };
  // Fit a world rectangle into the view. insetTop keeps it below an overlay (the goal card).
  // alignTop: put spare height below the rect, not above (phones: the work sits right under the task card)
  // reserve: extra room wanted under insetTop (the problem chip), taken only from spare height, never by shrinking
  B.fitRect = function (x0, y0, x1, y1, pad, insetTop, insetRight, alignTop, reserve) {
    var sz = this.size(); pad = pad === undefined ? 16 : pad; insetTop = insetTop || 0; insetRight = insetRight || 0;
    var w = (x1 - x0) * U, h = (y1 - y0) * U;
    var aw = sz.w - insetRight, ah = sz.h - insetTop;
    var s = Math.min((aw - 2 * pad) / w, (ah - 2 * pad) / h);
    s = Math.max(0.25, Math.min(8, s));
    this.view.s = s;
    this.view.tx = (aw - w * s) / 2 - x0 * U * s;
    var spare = ah - h * s;
    this.view.ty = insetTop + (alignTop ? Math.min(pad + 16 + (reserve || 0), Math.max(spare / 2, spare - pad - 8)) : spare / 2) - y0 * U * s;
    this.applyView();
  };
  B.fitAll = function (insetTop) { // insetTop given (phones, under the task card): centred in the free area
    var b = this.sim.board, x0 = b.x0, y0 = b.y0, x1 = b.x1, y1 = b.y1, self = this;
    this.sim.state.parts.forEach(function (p) {
      var r = self.sim.bodyRect(p);
      x0 = Math.min(x0, r.x0); y0 = Math.min(y0, r.y0); x1 = Math.max(x1, r.x1); y1 = Math.max(y1, r.y1);
      if (p.ends) self.sim.pinPoints(p).forEach(function (q) { x0 = Math.min(x0, q.x - 1); x1 = Math.max(x1, q.x + 1); y0 = Math.min(y0, q.y - 1); y1 = Math.max(y1, q.y + 4); });
    });
    this.fitRect(x0 - 1, y0 - 1, x1 + 1, y1 + 1, insetTop ? 8 : 16, insetTop || 0, insetTop ? 0 : 56); // leave room for the zoom buttons on the right (phones: they sit at the bottom)
  };
  B.toWorld = function (cx, cy) {
    var sz = this.size(), v = this.view;
    return { x: (cx - sz.left - v.tx) / v.s / U, y: (cy - sz.top - v.ty) / v.s / U };
  };
  B.toScreen = function (x, y) { var v = this.view; return { x: x * U * v.s + v.tx, y: y * U * v.s + v.ty }; };
  B.zoomAt = function (cx, cy, k) {
    var sz = this.size(), v = this.view;
    var ns = Math.max(0.25, Math.min(8, v.s * k));
    var px = cx - sz.left, py = cy - sz.top;
    v.tx = px - (px - v.tx) * ns / v.s; v.ty = py - (py - v.ty) * ns / v.s; v.s = ns;
    this.applyView();
  };

  // ---------- drawing ----------
  B.renderBoard = function () { this.gBoard.innerHTML = BB.art.board(this.sim.board, this.xray); };
  B.layerOf = function (p) {
    var k = PARTS[p.type].kind;
    if (p.type === 'wire') return LAYER.wire;
    return LAYER[k] !== undefined ? LAYER[k] : 1;
  };
  B.render = function (force) {
    var sim = this.sim, self = this, now = sim.t;
    // one entry per drawn layer piece; the meter's probe leads (after <!--under-->) go under the
    // board's parts, so a cable never hides a resistor's bands
    var items = [];
    sim.state.parts.forEach(function (p) {
      var pts = sim.pinPoints(p);
      var svg = DRAW[p.type](p, pts, now, p.id === self.sel);
      if (p.free && PARTS[p.type].kind === 'rigid') svg = '<g opacity=".93" transform="translate(0 -3)">' + svg + '</g>';
      var cut = svg.indexOf('<!--under-->'), la = self.layerOf(p), on = p.id === self.sel ? 1 : 0;
      if (cut >= 0) { items.push({ key: p.id + ':under', p: p, svg: svg.slice(cut), layer: 0.5, on: 0 }); svg = svg.slice(0, cut); }
      items.push({ key: p.id, p: p, svg: svg, layer: la, on: on });
    });
    items.sort(function (a, b) { return a.layer - b.layer || a.on - b.on; });
    var seen = {};
    items.forEach(function (it, idx) {
      var p = it.p, svg = it.svg, key = it.key;
      seen[key] = true;
      var g = self.partEls[key];
      if (!g) { g = el('g', { 'data-id': p.id, 'data-type': p.type }); self.partEls[key] = g; }
      if (force || self.partKeys[key] !== svg) { g.innerHTML = svg; self.partKeys[key] = svg; }
      if (self.gParts.childNodes[idx] !== g) self.gParts.insertBefore(g, self.gParts.childNodes[idx] || null);
    });
    Object.keys(this.partEls).forEach(function (id) { if (!seen[id]) { self.partEls[id].remove(); delete self.partEls[id]; delete self.partKeys[id]; } });
    this.renderUi();
    this.renderFlow();
  };
  // selection outline, issue rings, wire rubber band, highlighted holes
  B.renderUi = function () {
    var s = '', sim = this.sim, self = this;
    if (this.sel) {
      var p = sim.part(this.sel);
      if (p) {
        var r = sim.bodyRect(p);
        s += '<rect x="' + (r.x0 * U - 3) + '" y="' + (r.y0 * U - 3) + '" width="' + ((r.x1 - r.x0) * U + 6) + '" height="' + ((r.y1 - r.y0) * U + 6) + '" rx="5" class="selbox"/>';
        if (p.ends && !p.locked) sim.pinPoints(p).forEach(function (q) { s += '<circle cx="' + q.x * U + '" cy="' + q.y * U + '" r="' + Math.max(3.4, 9 / self.view.s) + '" class="handle"/>'; });
      }
    }
    var issues = sim.res ? sim.res.issues : [];
    var marked = {}, lvl = this.app.mode === 'level';
    issues.forEach(function (is) {
      if (lvl && is.kind === 'floating') return;
      var key = is.part + ':' + (is.pin === undefined ? '' : is.pin);
      if (marked[key]) return; marked[key] = 1;
      var p = sim.part(is.part); if (!p) return;
      if (is.pin !== undefined && is.pin >= 0) { // mark just the pin
        var q = sim.pinPoints(p)[is.pin];
        if (q) { s += '<circle cx="' + q.x * U + '" cy="' + q.y * U + '" r="6" class="issue ' + is.level + '"/>'; return; }
      }
      var r = sim.bodyRect(p);
      if (r.x1 - r.x0 > 4 || r.y1 - r.y0 > 4) { // big parts: a thin outline, so pin labels stay readable
        s += '<rect x="' + (r.x0 * U - 4) + '" y="' + (r.y0 * U - 4) + '" width="' + ((r.x1 - r.x0) * U + 8) + '" height="' + ((r.y1 - r.y0) * U + 8) + '" rx="6" class="issue ' + is.level + '"/>';
        return;
      }
      var cx = (r.x0 + r.x1) / 2 * U, cy = (r.y0 + r.y1) / 2 * U, rad = Math.max(14, Math.max(r.x1 - r.x0, r.y1 - r.y0) * U / 2 + 6);
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rad + '" class="issue ' + is.level + '"/>';
    });
    if (this.wireStart) {
      var a = this.pointPos(this.wireStart);
      s += '<circle cx="' + a.x * U + '" cy="' + a.y * U + '" r="5" class="wirestart"/>';
      if (this.hover) s += '<path d="' + BB.wirePath({ x: a.x * U, y: a.y * U }, { x: this.hover.x * U, y: this.hover.y * U }) + '" class="rubber"/>';
    }
    if (this.drag && this.drag.kind === 'wire' && this.drag.moved && this.drag.cur) {
      var a2 = this.pointPos(this.drag.start), c = this.drag.cur;
      s += '<path d="' + BB.wirePath({ x: a2.x * U, y: a2.y * U }, { x: c.x * U, y: c.y * U }) + '" class="rubber"/>';
      if (this.drag.snap) { var sp = this.pointPos(this.drag.snap); s += '<circle cx="' + sp.x * U + '" cy="' + sp.y * U + '" r="4.5" class="snap"/>'; }
    }
    if (this.drag && this.drag.snapShow) { var q = this.drag.snapShow; s += '<circle cx="' + q.x * U + '" cy="' + q.y * U + '" r="4.5" class="snap"/>'; }
    this.gUi.innerHTML = s;
    // highlighted holes
    var h = '';
    if (this.hiHole) {
      var holes = sim.connectedHoles(this.hiHole);
      holes.forEach(function (id) { var o = sim.board.byId[id]; h += '<rect x="' + (o.x * U - 3.6) + '" y="' + (o.y * U - 3.6) + '" width="7.2" height="7.2" rx="2"/>'; });
      var me = sim.board.byId[this.hiHole];
      if (me) h += '<circle cx="' + me.x * U + '" cy="' + me.y * U + '" r="6.5" class="me"/>';
      sim.connectedPins('H:' + sim.board.byId[this.hiHole].strip).forEach(function (q) { if (!sim.board.holeAt(q.x, q.y)) h += '<circle cx="' + q.x * U + '" cy="' + q.y * U + '" r="4.5"/>'; });
    }
    this.gHi.innerHTML = h;
  };
  B.pointPos = function (at) { return this.sim.endPos({ at: at }); };

  // Current animation: dashes move along each path in the direction of conventional current.
  B.renderFlow = function () {
    var sim = this.sim, res = sim.res;
    if (!this.showFlow || !res) { if (this.flowKey) { this.gFlow.innerHTML = ''; this.gLabels.innerHTML = ''; this.flowKey = ''; } return; }
    var segs = [], self = this;
    function add(d, i) {
      var a = Math.abs(i); if (a < 2e-6) return;
      segs.push({ d: d, i: i, a: a });
    }
    function line(x1, y1, x2, y2, i) {
      if (i < 0) { var t = x1; x1 = x2; x2 = t; t = y1; y1 = y2; y2 = t; }
      add('M' + (x1 * U).toFixed(1) + ' ' + (y1 * U).toFixed(1) + 'L' + (x2 * U).toFixed(1) + ' ' + (y2 * U).toFixed(1), i);
    }
    sim.state.parts.forEach(function (p) {
      var def = PARTS[p.type], pts = sim.pinPoints(p), pin = res.pinIn[p.id];
      if (!pin) return;
      if (def.kind === 'leads') {
        var i = pin[0];
        if (p.type === 'wire') {
          var a = pts[0], b = pts[1];
          if (i < 0) { var t = a; a = b; b = t; }
          add(BB.wirePath({ x: a.x * U, y: a.y * U }, { x: b.x * U, y: b.y * U }), i);
        } else line(pts[0].x, pts[0].y, pts[1].x, pts[1].y, i);
      } else {
        var r = sim.bodyRect(p), cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
        pts.forEach(function (q, k) {
          var i2 = pin[k];
          if (def.kind === 'module') { var lf = def.leadFrom[k]; line(q.x, q.y, p.x + lf[0], p.y + lf[1], i2); return; }
          var dx = cx - q.x, dy = cy - q.y, L = Math.hypot(dx, dy) || 1, len = Math.min(1.6, L);
          line(q.x, q.y, q.x + dx / L * len, q.y + dy / L * len, i2);
        });
      }
    });
    res.flows.forEach(function (f) { line(f.x1, f.y1, f.x2, f.y2, f.i); });
    var key = segs.map(function (s) { return s.d + Math.round(Math.log10(s.a) * 4); }).join('|');
    if (key !== this.flowKey) {
      this.flowKey = key;
      this.gFlow.innerHTML = segs.map(function (s) {
        var lg = Math.log10(s.a); // 10 mA → -2
        var dur = Math.max(0.18, Math.min(4, 0.9 - 0.45 * (lg + 2)));
        var w = Math.max(1.2, Math.min(3.4, 2.2 + 0.5 * (lg + 2)));
        return '<path d="' + s.d + '" style="animation-duration:' + dur.toFixed(2) + 's;stroke-width:' + w.toFixed(2) + '"/>';
      }).join('');
    }
    // voltage tags: one per powered net, at its first used hole
    var tags = {}, out = '', boxes = [], used = {};
    // how many pins touch each net: header pins with no wire get no tag (a Pi has 40 of them)
    sim.state.parts.forEach(function (p) { sim.pinPoints(p).forEach(function (q, k) { var kk = sim.keyOf(q, p, k); if (kk[0] !== 'F') { var nn = res.nets.find(kk); used[nn] = (used[nn] || 0) + 1; } }); });
    sim.state.parts.forEach(function (p) {
      sim.pinPoints(p).forEach(function (q, k) {
        var key2 = sim.keyOf(q, p, k);
        if (key2[0] === 'F' || !res.keyPowered[key2]) return;
        var net = res.nets.find(key2);
        if ((key2.slice(0, 2) === 'P:' || PARTS[p.type].mcu) && used[net] < 2) return; // a board pin with nothing on it: no tag
        if (p.st && p.st.floating && PARTS[p.type].mcu && sim.pinPoints(p)[k] && p.st.floating[PARTS[p.type].pins[k] && PARTS[p.type].pins[k].n]) return;
        if (tags[net]) return;
        tags[net] = 1;
        var v = res.keyV[key2];
        // move the tag down until it does not cover another tag
        // never smaller than about 12 px on screen: grow the tag when zoomed out
        var ks = Math.max(1, 12 / (10 * self.view.s));
        var tx = q.x * U + 4, ty = q.y * U - 6, w = (v < 0 ? 30 : 26) * ks, txt = v.toFixed(2);
        // the same voltage already tagged close by (two pins of one supply): one tag is enough
        if (boxes.some(function (bx) { return bx.t === txt && Math.hypot(bx.x - tx, bx.y - ty) < 60 * ks; })) return;
        for (var tries = 0; tries < 6 && boxes.some(function (bx) { return tx < bx.x + bx.w && tx + w > bx.x && ty - 7 * ks < bx.y + 3 * ks && ty + 3 * ks > bx.y - 7 * ks; }); tries++) ty += 11 * ks;
        boxes.push({ x: tx, y: ty, w: w, t: txt });
        out += '<g transform="translate(' + tx + ' ' + ty + ') scale(' + ks.toFixed(2) + ')"><rect x="0" y="-7" width="' + w + '" height="10" rx="3"/><text x="2.5" y="0.5">' + v.toFixed(2) + 'V</text></g>';
      });
    });
    if (out !== this.lastLabels) { this.gLabels.innerHTML = out; this.lastLabels = out; }
  };

  // ---------- hit testing ----------
  B.tolPx = function (e) { return e && e.pointerType === 'mouse' ? 12 : 24; };
  // Nearest attach point (hole or off-board pin) to world point w, within r (pitch units).
  B.nearestPoint = function (w, r, opts) {
    opts = opts || {};
    var sim = this.sim, occ = opts.occ || sim.occupancy(), cov = opts.cov || sim.covered();
    var best = null, bd = r * r;
    var h = sim.board.nearest(w.x, w.y, r, function (o) {
      if (cov[o.id] && cov[o.id] !== opts.self) return false;
      if (opts.free && occ[o.id] && !(occ[o.id].id === opts.self && occ[o.id].k === opts.k)) return false;
      return true;
    });
    if (h) { best = h.id; bd = (h.x - w.x) * (h.x - w.x) + (h.y - w.y) * (h.y - w.y); }
    sim.state.parts.forEach(function (p) {
      if (PARTS[p.type].kind !== 'offboard') return;
      PARTS[p.type].pinPos.forEach(function (q, k) {
        var id = 'P:' + p.id + ':' + k;
        if (opts.free && occ[id] && !(occ[id].id === opts.self && occ[id].k === opts.k)) return;
        var d = (p.x + q[0] - w.x) * (p.x + q[0] - w.x) + (p.y + q[1] - w.y) * (p.y + q[1] - w.y);
        if (d < bd) { bd = d; best = id; }
      });
    });
    return best;
  };
  B.hitTest = function (w, e) {
    var sim = this.sim, self = this, tol = this.tolPx(e) / this.view.s / U;
    var parts = sim.state.parts;
    // 1. leg / lead ends (selected part first)
    var order = parts.slice().sort(function (a, b) { return (b.id === self.sel) - (a.id === self.sel) || self.layerOf(b) - self.layerOf(a); });
    var bestEnd = null, bd = Infinity;
    order.forEach(function (p) {
      if (!p.ends || p.locked) return;
      var lim = p.id === self.sel ? tol : Math.min(tol, 0.55);
      sim.pinPoints(p).forEach(function (q, k) {
        var d = Math.hypot(q.x - w.x, q.y - w.y);
        if (d <= lim && d < bd - (p.id === self.sel ? 0.2 : 0)) { bd = d; bestEnd = { kind: 'end', id: p.id, k: k }; }
      });
    });
    if (bestEnd) return bestEnd;
    // 2. hot spots (button, knob, jumpers, switch, dial)
    var hot = null;
    parts.slice().sort(function (a, b) { return self.layerOf(b) - self.layerOf(a); }).some(function (p) {
      var def = PARTS[p.type];
      if (!def.hot) return false;
      return def.hot.some(function (h) {
        var c = def.kind === 'rigid' ? BB.rotate(h.x, h.y, p.rot) : [h.x, h.y];
        var d = Math.hypot(p.x + c[0] - w.x, p.y + c[1] - w.y);
        if (d <= h.r + tol * 0.3) { hot = { kind: 'hot', id: p.id, hot: h }; return true; }
        return false;
      });
    });
    if (hot) return hot;
    // 3. bodies, top layer first; in a layer, the part drawn last (on top) first. An LED head wins over
    // leads that only pass under it.
    var body = null, idxOf = {};
    parts.forEach(function (p, i) { idxOf[p.id] = i; });
    var top = parts.slice().sort(function (a, b) { return self.layerOf(b) - self.layerOf(a) || (b.id === self.sel) - (a.id === self.sel) || idxOf[b.id] - idxOf[a.id]; });
    if (BB.ledBodyCenter) top.some(function (p) {
      if (p.type !== 'led' || !p.ends) return false;
      var pts = sim.pinPoints(p), c = BB.ledBodyCenter(pts[0], pts[1]);
      if (Math.hypot(w.x - c.x, w.y - c.y) < 0.75) { body = { kind: 'body', id: p.id }; return true; }
      return false;
    });
    if (body) return body;
    // leads parts of the top layer that is hit: the one whose leads pass nearest the finger wins
    // (an LED's legs may run right beside a resistor's body)
    var leadsBest = null, leadsLayer = null;
    top.forEach(function (p) {
      if (!p.ends || PARTS[p.type].kind !== 'leads') return;
      if (leadsLayer !== null && self.layerOf(p) !== leadsLayer) return;
      var pts = sim.pinPoints(p);
      var d = segDist(w, pts[0], pts[1]);
      var lim = p.type === 'wire' ? Math.max(0.35, tol * 0.6) : Math.max(0.8, tol * 0.7);
      if (p.type === 'led' && BB.ledBodyCenter) { var c = BB.ledBodyCenter(pts[0], pts[1]); d = Math.min(d, Math.max(0, Math.hypot(w.x - c.x, w.y - c.y) - 0.6)); }
      if (p.type === 'resistor' || p.type === 'capacitor') d -= 0.25; // a body, not a thin leg
      if (p.id === self.sel) d -= 0.15;
      if (d < lim && (!leadsBest || d < leadsBest.d)) { leadsBest = { d: d, id: p.id }; leadsLayer = self.layerOf(p); }
    });
    top.some(function (p) {
      if (p.ends && PARTS[p.type].kind === 'leads') {
        if (leadsBest && self.layerOf(p) === leadsLayer) { body = { kind: 'body', id: leadsBest.id }; return true; }
        return false;
      }
      var r = sim.bodyRect(p);
      if (w.x >= r.x0 && w.x <= r.x1 && w.y >= r.y0 && w.y <= r.y1) { body = { kind: 'body', id: p.id }; return true; }
      return false;
    });
    if (body) return body;
    var h2 = sim.board.nearest(w.x, w.y, Math.max(0.5, tol * 0.8));
    if (h2) return { kind: 'hole', hole: h2.id };
    return { kind: 'empty' };
  };
  function segDist(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy;
    var t = L ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L)) : 0;
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
  }

  // ---------- pointer handling ----------
  B.bind = function () {
    var self = this, svg = this.svg;
    svg.addEventListener('pointerdown', function (e) { self.down(e); });
    svg.addEventListener('pointermove', function (e) { self.move(e); });
    svg.addEventListener('pointerup', function (e) { self.up(e); });
    svg.addEventListener('pointercancel', function (e) { self.cancel(e); });
    svg.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { self.hover = null; if (!self.drag && !self.stickyHi) { self.hiHole = null; self.renderUi(); } self.hideTip(); } });
    svg.addEventListener('wheel', function (e) { e.preventDefault(); self.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015)); self.renderUi(); }, { passive: false });
    svg.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  };
  B.down = function (e) {
    this.svg.setPointerCapture && this.svg.setPointerCapture(e.pointerId);
    this.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(this.pointers);
    if (ids.length === 2) { // pinch
      if (this.drag && this.drag.undo && this.drag.moved) this.app.commit(this.drag.undo);
      this.releasePress();
      var a = this.pointers[ids[0]], b = this.pointers[ids[1]];
      this.drag = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, v0: Object.assign({}, this.view) };
      this.hideLoupe();
      return;
    }
    if (ids.length > 2) return;
    var w = this.toWorld(e.clientX, e.clientY);
    var hit = this.tool === 'wire' ? this.wireHit(w, e) : this.hitTest(w, e);
    this.drag = { kind: hit.kind, hit: hit, sx: e.clientX, sy: e.clientY, w0: w, t0: Date.now(), moved: false, v0: Object.assign({}, this.view), pid: e.pointerId, ptype: e.pointerType };
    var p = hit.id ? this.sim.part(hit.id) : null;
    if (hit.kind === 'hot' && hit.hot.kind === 'press') { p.st.pressed = true; this.sim.dirty(); this.app.onInteract('press', p); this.render(); }
    if (hit.kind === 'hot' && hit.hot.kind === 'knob') {
      this.drag.pos0 = p.props.pos; this.drag.undo = this.app.snapshot();
      // drag at once = turn the knob; hold still for a moment, then drag = move the whole part
      var dk = this.drag, self = this;
      if (!p.locked) dk.holdT = setTimeout(function () {
        if (self.drag !== dk || dk.moved) return;
        dk.grab = true;
        if (navigator.vibrate) try { navigator.vibrate(15); } catch (er) { /* not allowed: fine */ }
        if (self.partEls[p.id]) self.partEls[p.id].classList.add('grabbed');
      }, 400);
    }
    if (hit.kind === 'body' && p && !p.locked) {
      this.drag.undo = this.app.snapshot();
      this.drag.orig = JSON.parse(JSON.stringify({ x: p.x, y: p.y, ends: p.ends, free: p.free }));
    }
    if (hit.kind === 'end') this.drag.undo = this.app.snapshot();
    // a finger covers the hole it taps: show the loupe while the finger is down
    if (e.pointerType !== 'mouse' && (hit.kind === 'hole' || hit.kind === 'wire')) {
      var at = hit.kind === 'hole' ? hit.hole : hit.start;
      this.showLoupe(e.clientX, e.clientY, this.pointPos(at), at);
    }
  };
  B.wireHit = function (w, e) {
    var tol = Math.max(0.9, this.tolPx(e) / this.view.s / U);
    // aimed at a hole hidden under a part: say so, do not quietly use the next free hole
    var near = this.sim.board.nearest(w.x, w.y, 0.5), cov = this.sim.covered();
    if (near && cov[near.id]) return { kind: 'covered', by: cov[near.id] };
    if (near && this.sim.occupancy()[near.id]) return { kind: 'covered', full: true }; // one leg per hole, wires too
    var pnt = this.nearestPoint(w, tol);
    if (pnt) return { kind: 'wire', start: pnt };
    return { kind: 'empty' };
  };
  B.move = function (e) {
    var d = this.drag;
    if (this.pointers[e.pointerId]) this.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var w = this.toWorld(e.clientX, e.clientY);
    if (!d) { // mouse hover: highlight connected holes + tooltip
      if (e.pointerType === 'mouse') {
        this.hover = w;
        var h = this.sim.board.nearest(w.x, w.y, 0.55);
        var hit = h ? this.hitTest(w, e) : null;
        var hid = h && hit && (hit.kind === 'hole' || hit.kind === 'end' || (hit.kind === 'body' && this.sim.occupancy()[h.id])) ? h.id : null;
        if (!this.stickyHi && hid !== this.hiHole) { this.hiHole = hid; this.renderUi(); }
        else if (this.wireStart) this.renderUi();
        if (hid) this.showTip(hid, e.clientX, e.clientY);
        else {
          // header pins of off-board parts (Pi, Wio, screens): show the pin's name and voltage
          var pin = this.offPinAt(w, 0.6);
          if (pin) this.showPinTip(pin, e.clientX, e.clientY); else this.hideTip();
        }
        this.svg.style.cursor = hit && (hit.kind === 'body' || hit.kind === 'end' || hit.kind === 'hot') ? 'grab' : (this.tool === 'wire' ? 'crosshair' : 'default');
      }
      return;
    }
    if (d.kind === 'pinch') {
      var ids = Object.keys(this.pointers); if (ids.length < 2) return;
      var a = this.pointers[ids[0]], b = this.pointers[ids[1]];
      var dd = Math.hypot(a.x - b.x, a.y - b.y), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      var v0 = d.v0, ns = Math.max(0.25, Math.min(8, v0.s * dd / d.d0));
      var sz = this.size();
      var wx = (d.m0.x - sz.left - v0.tx) / v0.s, wy = (d.m0.y - sz.top - v0.ty) / v0.s;
      this.view = { s: ns, tx: m.x - sz.left - wx * ns, ty: m.y - sz.top - wy * ns };
      this.applyView();
      return;
    }
    if (e.pointerId !== d.pid) return;
    var dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < (d.ptype === 'mouse' ? 4 : 8)) return;
    if (!d.moved && d.ptype !== 'mouse' && (d.kind === 'hole' || d.kind === 'wire')) this.hideLoupe();
    if (!d.moved) {
      d.moved = true;
      if (d.hit.kind === 'hot' && d.hit.hot.kind === 'press') { // a press that turns into a drag
        var bp = this.sim.part(d.hit.id);
        this.releasePress();
        if (bp && !bp.locked) { d.kind = 'body'; d.hit = { kind: 'body', id: bp.id }; d.undo = this.app.snapshot(); d.orig = JSON.parse(JSON.stringify({ x: bp.x, y: bp.y, free: bp.free })); }
        else d.kind = 'pan';
      }
      if (d.grab) { // held still first: move the knob part, do not turn it
        var kp = this.sim.part(d.hit.id);
        d.kind = 'body'; d.hit = { kind: 'body', id: kp.id }; d.orig = JSON.parse(JSON.stringify({ x: kp.x, y: kp.y, ends: kp.ends, free: kp.free }));
      }
      if (d.kind === 'body') { var bpp = this.sim.part(d.hit.id); if (!bpp || bpp.locked) d.kind = 'pan'; else { this.select(bpp.id, true); } }
      if (d.kind === 'hole' || d.kind === 'empty' || d.kind === 'covered' || (d.kind === 'hot' && d.hit.hot.kind !== 'knob')) d.kind = 'pan';
      if (d.kind === 'end') this.select(d.hit.id, true);
      this.hideTip();
      // while placing a leg or wire, other parts turn see-through so the holes under them show
      if (d.kind === 'end' || d.kind === 'wire') {
        this.svg.classList.add('dragleg');
        if (d.kind === 'end') [d.hit.id, d.hit.id + ':under'].forEach(function (k) { if (this.partEls[k]) this.partEls[k].classList.add('active'); }, this);
      }
      this.hideLoupe();
    }
    // dragging something near the edge of the bench moves the view, so a far hole can be reached
    if (d.kind === 'end' || d.kind === 'body' || d.kind === 'wire') {
      var sz = this.size(), px = e.clientX - sz.left, py = e.clientY - sz.top, edge = 28, sx = 0, sy = 0;
      if (px < edge) sx = (edge - px) / 3; else if (px > sz.w - edge) sx = -(px - sz.w + edge) / 3;
      if (py < edge) sy = (edge - py) / 3; else if (py > sz.h - edge) sy = -(py - sz.h + edge) / 3;
      // only after the finger has rested in the edge band for a moment: aiming at a hole near the edge must not scroll
      if (sx || sy) { if (!d.edgeT) d.edgeT = Date.now(); if (Date.now() - d.edgeT < 600) sx = sy = 0; } else d.edgeT = 0;
      if (sx || sy) { this.view.tx += sx; this.view.ty += sy; this.applyView(); w = this.toWorld(e.clientX, e.clientY); }
    }
    if (d.kind === 'pan') {
      this.view.tx = d.v0.tx + dx; this.view.ty = d.v0.ty + dy; this.applyView();
    } else if (d.kind === 'hot') {
      var p = this.sim.part(d.hit.id), hk = d.hit.hot, hc = BB.rotate(hk.x, hk.y, p.rot || 0);
      // one way of turning for the whole drag, chosen where the finger went down (no jumps):
      // started on the rim → turn with the finger's angle (270° = full range, the mark stays under the finger);
      // started near the centre → a plain swipe (right / up = more)
      var cxw = p.x + hc[0], cyw = p.y + hc[1];
      if (d.knobMode === undefined) d.knobMode = Math.hypot(d.w0.x - cxw, d.w0.y - cyw) > 0.65 * hk.r ? 'angle' : 'swipe'; // most of the cap swipes; only the outer ring turns by angle
      if (d.knobMode === 'angle') {
        var ax = w.x - cxw, ay = w.y - cyw;
        if (Math.hypot(ax, ay) > 0.4) { // right on the centre the angle means nothing: wait
          var ang = Math.atan2(ax, -ay) * 180 / Math.PI;
          if (d.angPrev === undefined) d.angPrev = Math.atan2(d.w0.x - cxw, -(d.w0.y - cyw)) * 180 / Math.PI;
          var da = ang - d.angPrev; if (da > 180) da -= 360; if (da < -180) da += 360;
          d.turn = (d.turn || 0) + da; d.angPrev = ang;
        }
        p.props.pos = Math.max(0, Math.min(1, d.pos0 + (d.turn || 0) / 270));
      } else p.props.pos = Math.max(0, Math.min(1, d.pos0 + (dx - dy) / 160));
      this.sim.dirty(); this.app.onInteract('knob', p); this.app.refreshInspector();
    } else if (d.kind === 'end') {
      this.dragEnd(d, w, e);
    } else if (d.kind === 'body') {
      this.dragBody(d, w);
    } else if (d.kind === 'wire') {
      var tol = Math.max(0.9, this.tolPx(e) / this.view.s / U);
      d.cur = w; d.snap = this.nearestPoint(w, tol);
      // aimed at a hole hidden under a part (or one with a leg in it): no quiet jump to a neighbour hole
      var nh = this.sim.board.nearest(w.x, w.y, 0.5), cv = nh && this.sim.covered()[nh.id], oc = nh && !cv && this.sim.occupancy()[nh.id];
      d.blocked = cv ? { by: cv } : oc ? { full: true } : null;
      if (d.blocked) d.snap = null;
      this.renderUi();
      this.showLoupe(e.clientX, e.clientY, d.snap ? this.pointPos(d.snap) : w);
    }
  };
  B.dragEnd = function (d, w, e) {
    var p = this.sim.part(d.hit.id), def = PARTS[p.type], k = d.hit.k;
    var r = Math.max(0.75, 18 / this.view.s / U);
    var at = this.nearestPoint(w, r, { free: true, self: p.id, k: k });
    // keep short legs together: LED, capacitor and LDR legs cannot stretch far
    if (def.maxSpan && p.ends.length === 2) {
      if (d.otherEnd0 === undefined) d.otherEnd0 = JSON.stringify(p.ends[1 - k]); // to tell the player if it moves
      var other = this.sim.endPos(p.ends[1 - k]);
      var tgt = at ? this.pointPos(at) : w;
      var dist = Math.hypot(tgt.x - other.x, tgt.y - other.y);
      if (dist > def.maxSpan + 0.01) {
        // pull the other leg along
        var nx = tgt.x - (tgt.x - other.x) / dist * def.maxSpan, ny = tgt.y - (tgt.y - other.y) / dist * def.maxSpan;
        var at2 = this.nearestPoint({ x: nx, y: ny }, 0.75, { free: true, self: p.id, k: 1 - k });
        p.ends[1 - k] = at2 ? { at: at2 } : { x: nx, y: ny };
      }
    }
    p.ends[k] = at ? { at: at } : { x: w.x, y: w.y };
    d.snapShow = at ? this.pointPos(at) : null;
    this.sim.dirty();
    this.render();
    this.showLoupe(e.clientX, e.clientY, at ? this.pointPos(at) : w, at);
  };
  B.dragBody = function (d, w) {
    var p = this.sim.part(d.hit.id), def = PARTS[p.type], o = d.orig, sim = this.sim, self = this;
    var dx = w.x - d.w0.x, dy = w.y - d.w0.y;
    if (def.kind === 'leads') {
      var occ = sim.occupancy(), cov = sim.covered();
      var targets = o.ends.map(function (e, k) {
        var pos = sim.endPos(e);
        return { x: pos.x + dx, y: pos.y + dy, k: k };
      });
      // snap the whole part by one shared offset so it keeps its shape
      var first = targets[0];
      var h = sim.board.nearest(first.x, first.y, 0.75);
      var ox = h ? h.x - first.x : 0, oy = h ? h.y - first.y : 0;
      var ok = !!h;
      var ats = targets.map(function (t) {
        var hh = sim.board.holeAt(t.x + ox, t.y + oy);
        if (!hh || Math.abs(hh.x - t.x - ox) > 0.05 || Math.abs(hh.y - t.y - oy) > 0.05) { ok = false; return null; }
        var u = occ[hh.id]; if ((u && u.id !== p.id) || (cov[hh.id] && cov[hh.id] !== p.id)) { ok = false; return null; }
        return hh.id;
      });
      p.ends = targets.map(function (t, k) { return ok ? { at: ats[k] } : { x: t.x, y: t.y }; });
    } else if (def.kind === 'rigid') {
      var nx = o.x + dx, ny = o.y + dy;
      var best = null;
      var occ2 = sim.occupancy(), cov2 = sim.covered();
      var rx = Math.round(nx), ry = Math.round(ny);
      var cands = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
      for (var c = 0; c < cands.length && !best; c++) {
        var cx = rx + cands[c][0], cy = ry + cands[c][1];
        if (Math.hypot(cx - nx, cy - ny) > 1.2) continue;
        var good = def.pinPos.every(function (q) {
          var r = BB.rotate(q[0], q[1], p.rot), hh = sim.board.holeAt(cx + r[0], cy + r[1]);
          if (!hh || Math.abs(hh.x - cx - r[0]) > 0.01 || Math.abs(hh.y - cy - r[1]) > 0.01) return false;
          var u = occ2[hh.id]; if (u && u.id !== p.id) return false;
          if (cov2[hh.id] && cov2[hh.id] !== p.id) return false;
          return true;
        });
        if (good) best = [cx, cy];
      }
      if (best) { p.x = best[0]; p.y = best[1]; p.free = false; }
      else { p.x = nx; p.y = ny; p.free = true; }
    } else {
      p.x = Math.round((o.x + dx) * 2) / 2; p.y = Math.round((o.y + dy) * 2) / 2;
    }
    sim.dirty();
    this.render();
  };
  B.endDragLook = function () {
    this.svg.classList.remove('dragleg');
    this.svg.querySelectorAll('g.active, g.grabbed').forEach(function (a) { a.classList.remove('active'); a.classList.remove('grabbed'); });
    if (this.drag && this.drag.holdT) clearTimeout(this.drag.holdT);
  };
  B.up = function (e) {
    var d = this.drag;
    this.endDragLook();
    delete this.pointers[e.pointerId];
    this.hideLoupe();
    if (!d) return;
    if (d.kind === 'pinch') { if (Object.keys(this.pointers).length === 0) this.drag = null; return; }
    if (e.pointerId !== d.pid) return;
    this.drag = null;
    // something burned or broke while the finger was down: now rebuild its sheet (it may need “New LED”)
    var ps = this.app._pendingSel; this.app._pendingSel = null;
    if (ps && this.sel === ps) this.app.onSelect(ps, !document.body.classList.contains('hassel'));
    if (!d.moved) { this.releasePress(); this.tap(d, e); this.renderUi(); return; }
    if (d.kind === 'wire') {
      if (d.snap && d.snap !== d.hit.start) this.app.addWire(d.hit.start, d.snap);
      else if (d.blocked) this.app.toast(d.blocked.full ? 'That hole already has a leg in it. Use a free hole in the same strip (they are joined).' : 'The ' + PARTS[this.sim.part(d.blocked.by).type].name + ' covers that hole. Use a free hole in the same strip, above or below the part (they are joined).', 'info');
      this.renderUi(); return;
    }
    if (d.kind === 'body' || d.kind === 'end') {
      var p = this.sim.part(d.hit.id);
      if (p && p.type === 'wire' && p.ends[0].at && p.ends[0].at === p.ends[1].at) this.app.removePart(p.id);
      // the short other leg was pulled along: say so, and where it is now
      if (p && d.kind === 'end' && d.otherEnd0 !== undefined && JSON.stringify(p.ends[1 - d.hit.k]) !== d.otherEnd0) {
        var oe = p.ends[1 - d.hit.k];
        this.app.toast('The other leg moved too' + (oe.at ? ', to ' + oe.at : '') + '. These legs are short, so they cannot be far apart. Check both legs.', 'info');
      } else
      // a leg let go over the board but not in a hole: say why
      if (p && d.kind === 'end' && p.ends[d.hit.k] && !p.ends[d.hit.k].at) {
        var e = p.ends[d.hit.k], b = this.sim.board;
        if (e.x > b.x0 && e.x < b.x1 && e.y > b.y0 && e.y < b.y1) {
          var h = b.nearest(e.x, e.y, 1), cov = this.sim.covered(), occ = this.sim.occupancy();
          var why = h && cov[h.id] ? 'That hole is under the ' + PARTS[this.sim.part(cov[h.id]).type].name + ', so nothing can reach it.' : h && occ[h.id] ? 'That hole already has a leg in it.' : 'It is not in a hole.';
          this.app.toast('This leg is loose. ' + why + ' Drop it on a free hole.', 'info');
        }
      }
      this.app.commit(d.undo);
      if (p) this.app.onInteract('moved', p);
    }
    if (d.kind === 'hot' && d.undo) this.app.commit(d.undo);
    this.renderUi();
  };
  B.cancel = function (e) {
    this.endDragLook(); delete this.pointers[e.pointerId]; this.hideLoupe(); this.releasePress(); if (this.drag && this.drag.undo && this.drag.moved) this.app.commit(this.drag.undo); this.drag = null; };
  B.releasePress = function () {
    var self = this;
    this.sim.state.parts.forEach(function (p) { if (p.type === 'button' && p.st.pressed && !p.st.latched) { p.st.pressed = false; self.sim.dirty(); self.app.onInteract('release', p); } });
  };
  B.tap = function (d, e) {
    var hit = d.hit, sim = this.sim;
    if (this.tool === 'wire') {
      if (hit.kind === 'wire') {
        if (!this.wireStart) { this.wireStart = hit.start; this.app.say('wireStart'); }
        else if (this.wireStart === hit.start) this.wireStart = null;
        else { this.app.addWire(this.wireStart, hit.start); this.wireStart = null; }
      } else if (hit.kind === 'covered') this.app.toast(hit.full ? 'That hole already has a leg in it. Use a free hole in the same strip (they are joined).' : 'The ' + PARTS[sim.part(hit.by).type].name + ' covers that hole. Use a free hole in the same strip, above or below the part (they are joined).', 'info');
      else this.wireStart = null;
      this.renderUi();
      return;
    }
    if (hit.kind === 'hot') {
      var p = sim.part(hit.id), h = hit.hot;
      if (h.kind === 'jumper') { var u = this.app.snapshot(); var cyc = { '3.3': 'off', off: '5', '5': '3.3' }; p.props[h.side] = cyc[p.props[h.side]]; this.app.commit(u); this.app.onInteract('prop', p); }
      else if (h.kind === 'switch') { var u2 = this.app.snapshot(); p.props.on = !p.props.on; this.app.commit(u2); this.app.onInteract('prop', p); }
      else if (h.kind === 'dial') { var u3 = this.app.snapshot(); var order = ['off', 'V', 'A', 'ohm', 'diode']; p.props.mode = order[(order.indexOf(p.props.mode) + 1) % order.length]; this.app.commit(u3); this.app.onInteract('prop', p); }
      // pressing a button cap or turning a knob is just that: no sheet, no zoom
      // rebuild the panel (the dial / jumper buttons changed). Jumpers and the switch: on phones no sheet, it would cover the MB102
      var quietHot = (h.kind === 'jumper' || h.kind === 'switch' || h.kind === 'dial') && window.innerWidth < 1100; // the dial too: the sheet would cover it
      if (h.kind !== 'press' && h.kind !== 'knob') { if (this.sel === p.id) this.app.onSelect(p.id, quietHot || !document.body.classList.contains('hassel') && quietHot); else this.select(p.id, quietHot); }
      sim.dirty(); this.render();
      return;
    }
    if (hit.kind === 'end' || hit.kind === 'body') {
      this.select(hit.id);
      var pt = sim.pinPoints(sim.part(hit.id));
      if (hit.kind === 'end' && pt[hit.k].at && pt[hit.k].at.slice(0, 2) !== 'P:') this.app.onTapHole(pt[hit.k].at, true);
      var op = hit.kind === 'body' ? this.offPinAt(d.w0, 0.5) : null; // tapped a header pin: say its name
      if (op) this.showPinTip(op, e.clientX, e.clientY);
      return;
    }
    if (hit.kind === 'hole') {
      this.select(null);
      this.hiHole = hit.hole; this.stickyHi = true;
      this.app.onTapHole(hit.hole);
      this.renderUi();
      if (e.pointerType !== 'mouse') this.showTip(hit.hole, 0, 0, true); // docked in a corner, so it does not hide the lit holes
      return;
    }
    this.select(null);
    this.hiHole = null; this.stickyHi = false; this.hideTip();
  };
  // quiet: select without opening the phone's bottom sheet (used while dragging)
  B.select = function (id, quiet) {
    id = id || null;
    if (this.sel === id) { if (id && !quiet) this.app.showSheet(); return; }
    this.sel = id;
    if (id) { this.stickyHi = false; this.hiHole = null; this.hideTip(); }
    this.app.onSelect(id, quiet);
    this.render();
  };

  // ---------- tooltip & loupe ----------
  B.showTip = function (holeId, x, y, docked) {
    var sim = this.sim, h = sim.board.byId[holeId];
    var st = sim.board.strips[h.strip];
    var v = sim.holeVoltage(holeId);
    var occ = sim.occupancy()[holeId], what = '';
    if (occ) { var p = sim.part(occ.id), pin = PARTS[p.type].pins[occ.k]; what = '<br>' + PARTS[p.type].name + (pin && pin.n ? ' · ' + pin.n : ''); }
    else if (h.kind === 'term') { // a free hole: name the board pin in its strip (the labels are tiny on a phone)
      var allOcc = sim.occupancy(), self2 = this, names = [];
      sim.board.holes.forEach(function (o) {
        var oc = o.strip === h.strip && allOcc[o.id]; if (!oc) return;
        var op = sim.part(oc.id), od = PARTS[op.type], opin = od.pins && od.pins[oc.k];
        if (od.mcu && opin && opin.n) names.push(od.name + ' pin ' + opin.n);
      });
      if (names.length) what = '<br>Joined to ' + names[0];
    }
    this.tip.innerHTML = '<b>' + sim.board.label(holeId) + '</b> · ' + st.label + what + '<br>' + (v === null ? '<span class="mut">No power here</span>' : '<b class="vv">' + v.toFixed(2) + ' V</b>');
    var sz = this.size();
    if (docked) {
      // bottom-left corner of the bench, above the toolbar
      this.tip.style.left = (sz.left + 8) + 'px';
      this.tip.style.top = (sz.top + sz.h - 8 - (this.tip.offsetHeight || 60)) + 'px';
      this.tip.hidden = false;
      this.tip.style.top = (sz.top + sz.h - 8 - this.tip.offsetHeight) + 'px';
      return;
    }
    this.tip.style.left = Math.min(sz.left + sz.w - 190, Math.max(sz.left + 4, x + 14)) + 'px';
    this.tip.style.top = Math.max(sz.top + 4, y - 64) + 'px';
    this.tip.hidden = false;
  };
  B.hideTip = function () { this.tip.hidden = true; };
  // the off-board header pin under a world point, as 'P:<part>:<pin>'
  B.offPinAt = function (w, r) {
    var best = null, bd = r * r;
    this.sim.state.parts.forEach(function (p) {
      if (PARTS[p.type].kind !== 'offboard') return;
      PARTS[p.type].pinPos.forEach(function (q, k) {
        var d = (p.x + q[0] - w.x) * (p.x + q[0] - w.x) + (p.y + q[1] - w.y) * (p.y + q[1] - w.y);
        if (d < bd) { bd = d; best = 'P:' + p.id + ':' + k; }
      });
    });
    return best;
  };
  B.showPinTip = function (at, x, y) {
    var b = at.split(':'), p = this.sim.part(b[1]), pin = PARTS[p.type].pins[+b[2]], res = this.sim.res;
    var v = res && res.keyPowered[at] ? res.keyV[at] : null;
    this.tip.innerHTML = '<b>' + (pin.phys ? 'Pin ' + pin.phys + ': ' : '') + pin.n + '</b> · ' + PARTS[p.type].name + '<br>' + (v === null ? '<span class="mut">No power here</span>' : '<b class="vv">' + v.toFixed(2) + ' V</b>');
    var sz = this.size();
    this.tip.style.left = Math.min(sz.left + sz.w - 190, Math.max(sz.left + 4, x + 14)) + 'px';
    this.tip.style.top = Math.max(sz.top + 4, y - 64) + 'px';
    this.tip.hidden = false;
  };
  B.showLoupe = function (cx, cy, w, at) {
    if (!this.loupe || (this.drag && this.drag.ptype === 'mouse')) return;
    var R = 15; // world radius in pitch units shown in the loupe... adjusted for zoom
    R = Math.max(2.2, Math.min(5, 46 / this.view.s / U));
    var l = this.loupe;
    l.hidden = false;
    var sz = 112;
    l.style.left = (cx - sz / 2) + 'px';
    l.style.top = Math.max(4, cy - sz - 58) + 'px';
    var svg = l.firstElementChild;
    svg.setAttribute('viewBox', ((w.x - R) * U) + ' ' + ((w.y - R) * U) + ' ' + (2 * R * U) + ' ' + (2 * R * U));
    l.lastElementChild.textContent = at ? (at.slice(0, 2) === 'P:' ? this.pinLabel(at) : this.sim.board.label(at)) : 'not in a hole';
  };
  B.pinLabel = function (at) { var b = at.split(':'), p = this.sim.part(b[1]); var pin = PARTS[p.type].pins[+b[2]]; return 'pin ' + (pin.phys ? pin.phys + ' ' : '') + pin.n; };
  B.hideLoupe = function () { if (this.loupe) this.loupe.hidden = true; };

  BB.Bench = Bench;
})();
