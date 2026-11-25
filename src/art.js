// SVG drawings of the breadboard and every component. 1 hole pitch = 10 SVG units.
(function () {
  'use strict';
  var BB = (globalThis.BB = globalThis.BB || {});
  var U = 10;
  var f1 = function (v) { return Math.round(v * 100) / 100; };

  var BAND_RGB = { black: '#1b1b1b', brown: '#7a4a21', red: '#d1281f', orange: '#f07a12', yellow: '#f4d21f', green: '#2e9a3e', blue: '#2453c9', violet: '#7f3fbf', grey: '#8a8a8a', white: '#f4f4f4', gold: '#c9a227', silver: '#c0c0c0' };
  var WIRE_RGB = { red: '#e0322b', black: '#262626', blue: '#2f6fe0', green: '#2aa84a', yellow: '#f2c81e', orange: '#f28a1e', white: '#ececec', purple: '#9150d8' };
  BB.WIRE_RGB = WIRE_RGB;

  // ---------- shared defs ----------
  function defs() {
    return '<defs>' +
      '<linearGradient id="gBoard" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbfaf6"/><stop offset="1" stop-color="#e9e6dc"/></linearGradient>' +
      '<linearGradient id="gMetal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2f3f5"/><stop offset=".5" stop-color="#b9bdc4"/><stop offset="1" stop-color="#e5e7ea"/></linearGradient>' +
      '<linearGradient id="gGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe38a"/><stop offset=".55" stop-color="#d4a530"/><stop offset="1" stop-color="#f3cf6a"/></linearGradient>' +
      '<linearGradient id="gStrip" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9aa1aa"/><stop offset=".4" stop-color="#eef1f4"/><stop offset="1" stop-color="#a3a9b2"/></linearGradient>' +
      '<linearGradient id="gStripH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9aa1aa"/><stop offset=".4" stop-color="#eef1f4"/><stop offset="1" stop-color="#a3a9b2"/></linearGradient>' +
      '<radialGradient id="gGlow"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset=".25" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="gDome" cx=".35" cy=".35" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset=".35" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></radialGradient>' +
      '<radialGradient id="gHeat"><stop offset="0" stop-color="#ffb347" stop-opacity=".95"/><stop offset="1" stop-color="#ff5a1f" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="gSmoke"><stop offset="0" stop-color="#6b6b6b" stop-opacity=".75"/><stop offset="1" stop-color="#9a9a9a" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="gBatt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3a3a"/><stop offset=".5" stop-color="#151515"/><stop offset="1" stop-color="#2b2b2b"/></linearGradient>' +
      '<linearGradient id="gCopper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8a45a"/><stop offset=".5" stop-color="#b8692a"/><stop offset="1" stop-color="#d98d45"/></linearGradient>' +
      '<pattern id="pKnurl" width="2.2" height="2.2" patternUnits="userSpaceOnUse"><rect width="2.2" height="2.2" fill="#b8bcc2"/><path d="M0 0L2.2 2.2M2.2 0L0 2.2" stroke="#7d828a" stroke-width=".5"/></pattern>' +
      '<pattern id="pMesh" width="2" height="2" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="#c6c9ce"/><circle cx="1" cy="1" r=".55" fill="#6c7077"/></pattern>' +
      '<pattern id="pGrid" width="2.4" height="2.4" patternUnits="userSpaceOnUse"><rect width="2.4" height="2.4" fill="#4aa3df"/><rect x=".5" y=".5" width="1.4" height="1.4" fill="#1d5f93"/></pattern>' +
      '<filter id="fShadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="2.5" stdDeviation="2.2" flood-color="#000" flood-opacity=".35"/></filter>' +
      '</defs>';
  }

  // ---------- breadboard ----------
  function board(b, xray) {
    var s = '';
    var x0 = b.x0 * U, x1 = b.x1 * U, y0 = b.y0 * U, y1 = b.y1 * U;
    s += '<rect x="' + x0 + '" y="' + (y0 + 3) + '" width="' + (x1 - x0) + '" height="' + (y1 - y0) + '" rx="7" fill="#000" opacity=".28"/>';
    s += '<rect x="' + x0 + '" y="' + y0 + '" width="' + (x1 - x0) + '" height="' + (y1 - y0) + '" rx="6" fill="url(#gBoard)" stroke="#cfcabb" stroke-width=".8" ' + (xray ? 'opacity=".38"' : '') + '/>';
    // power rail lines and the middle channel
    var lineY = { 'T+': -0.62, 'T-': 1.62, 'B+': 15.38, 'B-': 17.62 };
    Object.keys(lineY).forEach(function (r) {
      var col = r[1] === '+' ? '#d8322b' : '#2d5fd0';
      var y = lineY[r] * U;
      if (b.split) {
        s += '<line x1="' + (1.4 * U) + '" y1="' + y + '" x2="' + ((b.splitX - 0.9) * U) + '" y2="' + y + '" stroke="' + col + '" stroke-width="1.1"/>';
        s += '<line x1="' + ((b.splitX + 0.9) * U) + '" y1="' + y + '" x2="' + ((b.cols - 0.4) * U) + '" y2="' + y + '" stroke="' + col + '" stroke-width="1.1"/>';
      } else s += '<line x1="' + (1.4 * U) + '" y1="' + y + '" x2="' + ((b.cols - 0.4) * U) + '" y2="' + y + '" stroke="' + col + '" stroke-width="1.1"/>';
    });
    [['T+', 0], ['T-', 1], ['B+', 16], ['B-', 17]].forEach(function (r) {
      var sign = r[0][1] === '+' ? '+' : '−', col = sign === '+' ? '#d8322b' : '#2d5fd0';
      s += '<text x="' + (0.25 * U) + '" y="' + (r[1] * U + 2.6) + '" class="bbsign" fill="' + col + '">' + sign + '</text>';
      s += '<text x="' + ((b.cols + 0.75) * U) + '" y="' + (r[1] * U + 2.6) + '" class="bbsign" fill="' + col + '">' + sign + '</text>';
    });
    s += '<rect x="' + (x0 + 2) + '" y="' + (7.85 * U) + '" width="' + (x1 - x0 - 4) + '" height="' + (1.3 * U) + '" rx="2" fill="#dcd7c8" ' + (xray ? 'opacity=".5"' : '') + '/>';
    s += '<rect x="' + (x0 + 2) + '" y="' + (8.35 * U) + '" width="' + (x1 - x0 - 4) + '" height="' + (0.3 * U) + '" fill="#c4bfae" ' + (xray ? 'opacity=".5"' : '') + '/>';
    // labels
    'abcdefghij'.split('').forEach(function (r) {
      var y = BB.board.ROW_Y[r] * U + 1.6;
      s += '<text x="' + (0.05 * U) + '" y="' + y + '" class="bblbl">' + r + '</text>';
      s += '<text x="' + ((b.cols + 0.65) * U) + '" y="' + y + '" class="bblbl">' + r + '</text>';
    });
    for (var c = 1; c <= b.cols; c++) {
      if (c === 1 || c % 5 === 0) {
        s += '<text x="' + (c * U) + '" y="' + (2.2 * U) + '" class="bbnum">' + c + '</text>';
        s += '<text x="' + (c * U) + '" y="' + (15.25 * U) + '" class="bbnum">' + c + '</text>';
      }
    }
    // metal strips (x-ray view)
    if (xray) {
      for (var cc = 1; cc <= b.cols; cc++) {
        s += '<rect x="' + (cc * U - 3) + '" y="' + (2.55 * U) + '" width="6" height="' + (4.9 * U) + '" rx="2" fill="url(#gStrip)" stroke="#7b828c" stroke-width=".4"/>';
        s += '<rect x="' + (cc * U - 3) + '" y="' + (9.55 * U) + '" width="6" height="' + (4.9 * U) + '" rx="2" fill="url(#gStrip)" stroke="#7b828c" stroke-width=".4"/>';
      }
      var segs = b.split ? [[b.railCols[0], b.splitX - 1], [b.splitX + 1, b.railCols[b.railCols.length - 1]]] : [[b.railCols[0], b.railCols[b.railCols.length - 1]]];
      [0, 1, 16, 17].forEach(function (y) {
        segs.forEach(function (sg) {
          var a = sg[0], z = sg[1];
          if (b.split) { a = b.railCols.filter(function (q) { return q >= sg[0] && q <= sg[1]; })[0]; var lst = b.railCols.filter(function (q) { return q >= sg[0] && q <= sg[1]; }); z = lst[lst.length - 1]; }
          s += '<rect x="' + (a * U - 4) + '" y="' + (y * U - 3) + '" width="' + ((z - a) * U + 8) + '" height="6" rx="2" fill="url(#gStripH)" stroke="#7b828c" stroke-width=".4"/>';
        });
      });
    }
    // holes: one path for speed
    var d = '';
    b.holes.forEach(function (h) { var x = h.x * U - 2.1, y = h.y * U - 2.1; d += 'M' + f1(x) + ' ' + f1(y) + 'h4.2v4.2h-4.2z'; });
    s += '<path d="' + d + '" fill="' + (xray ? '#2a2d33' : '#3b3a36') + '" stroke="#bdb7a6" stroke-width=".35"/>';
    return s;
  }

  // ---------- small helpers ----------
  function pt(e) { return { x: e.x * U, y: e.y * U }; }
  function leg(a, b, w, col) { return '<line x1="' + f1(a.x) + '" y1="' + f1(a.y) + '" x2="' + f1(b.x) + '" y2="' + f1(b.y) + '" stroke="' + (col || '#c7ccd3') + '" stroke-width="' + (w || 1.1) + '" stroke-linecap="round"/>'; }
  function tip(a, col) { return '<circle cx="' + f1(a.x) + '" cy="' + f1(a.y) + '" r="1.5" fill="' + (col || '#d9dde2') + '" stroke="#6b7078" stroke-width=".4"/>'; }
  function smoke(x, y, t, now) {
    if (t === undefined || now - t > 4) return '';
    var o = Math.max(0, 1 - (now - t) / 4);
    return '<g class="smoke" opacity="' + f1(o) + '"><circle cx="' + x + '" cy="' + (y - 8) + '" r="9" fill="url(#gSmoke)"/><circle cx="' + (x + 6) + '" cy="' + (y - 17) + '" r="11" fill="url(#gSmoke)"/><circle cx="' + (x - 4) + '" cy="' + (y - 27) + '" r="13" fill="url(#gSmoke)"/></g>';
  }
  function txt(x, y, s, cls, extra) { return '<text x="' + f1(x) + '" y="' + f1(y) + '" class="' + cls + '"' + (extra || '') + '>' + s + '</text>'; }
  function angle(a, b) { return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI; }
  function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
  function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }

  // ---------- parts ----------
  var DRAW = {};
  // Two-leg parts: body sits between the two leg ends.
  // LED seen from the front at an angle: the legs go down into the holes, the long leg (+)
  // has a kink, the rim has a flat side on the − leg, and the metal inside shows through.
  // LED seen from the front: the body stands up above the two holes, the legs bend down into
  // them. The long leg (+) has a kink; the rim has a flat side on the − leg; the metal inside
  // (thin post = +, wide anvil = −) shows through the plastic.
  BB.ledBodyCenter = function (a, k) { // pitch units → centre of the drawn body
    return { x: (a.x + k.x) / 2, y: Math.min(a.y, k.y) - 2.2 };
  };
  DRAW.led = function (p, pts, now) {
    var a = pt(pts[0]), k = pt(pts[1]);
    var col = BB.engine.LED_TYPES[p.props.color].rgb, v = p.vis || {};
    var cx = (a.x + k.x) / 2, base = Math.min(a.y, k.y) - 13;
    var flip = a.x > k.x + 0.01 || (Math.abs(a.x - k.x) < 0.01 && a.y > k.y); // anode on the right?
    var ax = cx + (flip ? 4 : -4), kx = cx + (flip ? -4 : 4);
    var b = v.b || 0, body = v.burnt ? '#3b2b22' : col;
    var s = '';
    // legs
    s += '<path d="M' + f1(a.x) + ' ' + f1(a.y) + ' L' + f1(a.x) + ' ' + f1(a.y - 3) + ' Q' + f1((a.x + ax) / 2) + ' ' + f1(base + 7) + ' ' + f1(ax + (flip ? 2.5 : -2.5)) + ' ' + f1(base + 6) + ' L' + f1(ax) + ' ' + f1(base + 3) + ' L' + f1(ax) + ' ' + f1(base) + '" fill="none" stroke="#c7ccd3" stroke-width="1.3" stroke-linejoin="round"/>';
    s += '<path d="M' + f1(k.x) + ' ' + f1(k.y) + ' L' + f1(k.x) + ' ' + f1(k.y - 3) + ' Q' + f1((k.x + kx) / 2) + ' ' + f1(base + 5) + ' ' + f1(kx) + ' ' + f1(base) + '" fill="none" stroke="#c7ccd3" stroke-width="1.3"/>';
    s += tip(a) + tip(k);
    s += '<g transform="translate(' + f1(cx) + ' ' + f1(base) + ')' + (flip ? ' scale(-1 1)' : '') + '">';
    if (b > 0.03 && !v.burnt) {
      s += '<circle cx="0" cy="-13" r="' + f1(10 + 8 * Math.min(1, b)) + '" fill="' + col + '" opacity="' + f1(Math.min(0.38, 0.12 + b * 0.25)) + '"/>';
      s += '<circle cx="0" cy="-13" r="' + f1(6 + 6 * Math.min(1, b)) + '" fill="url(#gGlow)" opacity="' + f1(Math.min(1, b)) + '"/>';
    }
    s += '<path d="M-10.5 0 L8.4 0 L8.4 -3.5 L-10.5 -3.5 Z" fill="' + body + '" opacity="' + (v.burnt ? 1 : 0.85) + '" stroke="#00000055" stroke-width=".5"/>';
    s += '<path d="M-9.4 -3.5 L-9.4 -16 A9.4 9.4 0 0 1 9.4 -16 L9.4 -3.5 Z" fill="' + body + '" opacity="' + (v.burnt ? 1 : 0.62 + 0.3 * Math.min(1, b)) + '" stroke="#00000040" stroke-width=".5"/>';
    if (!v.burnt) s += '<path d="M-4 -3.5 V-10 L-1.5 -11.5 M4 -3.5 V-8 L7 -8 L6 -12 L1 -12 Z" fill="#9aa0a8" fill-opacity=".55" stroke="#6b7078" stroke-opacity=".6" stroke-width=".6"/>';
    if (b > 0.03 && !v.burnt) s += '<circle cx="0" cy="-12" r="' + f1(2.2 + 2.8 * Math.min(1, b)) + '" fill="#fff" opacity="' + f1(Math.min(0.95, b)) + '"/>';
    s += '<path d="M-6.6 -5 L-6.6 -16 A6.6 6.6 0 0 1 -2.6 -21.6" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.5" stroke-linecap="round"/>';
    if (v.burnt) s += '<path d="M-5 -16 L0 -11 L-3 -6 M0 -11 L5 -14" stroke="#120c08" stroke-width="1" fill="none"/>';
    s += '</g>';
    s += '<text x="' + f1(ax + (flip ? 5 : -10)) + '" y="' + f1(base + 9) + '" class="pol">+</text>';
    s += '<text x="' + f1(kx + (flip ? -10 : 5)) + '" y="' + f1(base + 9) + '" class="pol">−</text>';
    s += smoke(cx, base - 12, p.st.smoke, now);
    return s;
  };
  DRAW.resistor = function (p, pts) {
    var a = pt(pts[0]), b = pt(pts[1]), m = mid(a, b), L = dist(a, b), v = p.vis || {};
    var len = Math.max(13, Math.min(26, L - 5)), h = 8.2;
    var bd = BB.resistorBands(p.props.r);
    var s = leg(a, m, 1.1) + leg(b, m, 1.1) + tip(a) + tip(b);
    s += '<g transform="translate(' + f1(m.x) + ' ' + f1(m.y) + ') rotate(' + f1(angle(a, b)) + ')">';
    if (v.hot > 0.15 && !v.burnt) s += '<ellipse rx="' + (len * 0.9) + '" ry="12" fill="url(#gHeat)" opacity="' + f1(v.hot) + '"/>';
    var bodyCol = v.burnt ? '#4a3626' : '#e3c79a';
    var hl = len / 2;
    s += '<path d="M' + (-hl) + ' 0 C' + (-hl) + ' -5.2 ' + (-hl + 4) + ' -' + (h / 2 + 0.6) + ' ' + (-hl + 5) + ' -' + (h / 2 - 0.6) + ' L' + (hl - 5) + ' -' + (h / 2 - 0.6) + ' C' + (hl - 4) + ' -' + (h / 2 + 0.6) + ' ' + hl + ' -5.2 ' + hl + ' 0 C' + hl + ' 5.2 ' + (hl - 4) + ' ' + (h / 2 + 0.6) + ' ' + (hl - 5) + ' ' + (h / 2 - 0.6) + ' L' + (-hl + 5) + ' ' + (h / 2 - 0.6) + ' C' + (-hl + 4) + ' ' + (h / 2 + 0.6) + ' ' + (-hl) + ' 5.2 ' + (-hl) + ' 0Z" fill="' + bodyCol + '" stroke="#9c8156" stroke-width=".5"/>';
    if (!v.burnt) {
      var xs = [-hl + 4.2, -hl + 7.6, -hl + 11.0, hl - 4.4];
      if (len < 18) xs = [-hl + 3, -hl + 5.4, -hl + 7.8, hl - 3];
      bd.forEach(function (c, i) { s += '<rect x="' + f1(xs[i] - 1.05) + '" y="' + (-h / 2 - 0.2) + '" width="2.1" height="' + (h + 0.4) + '" fill="' + BAND_RGB[c] + '"/>'; });
      s += '<rect x="' + (-hl + 2) + '" y="-3.3" width="' + (len - 4) + '" height="1.3" rx=".6" fill="#fff" opacity=".35"/>';
    }
    if (v.hot > 0.4 && !v.burnt) s += '<g class="shimmer"><path d="M-6 -9 q2 -3 0 -6 q-2 -3 0 -6 M0 -9 q2 -3 0 -6 q-2 -3 0 -6 M6 -9 q2 -3 0 -6 q-2 -3 0 -6" stroke="#ff8a3d" stroke-width=".8" fill="none" opacity=".7"/></g>';
    s += '</g>';
    return s + smoke(m.x, m.y, p.st.smoke, arguments[2]);
  };
  DRAW.wire = function (p, pts, now, sel) {
    var a = pt(pts[0]), b = pt(pts[1]);
    var col = WIRE_RGB[p.props.color] || WIRE_RGB.red;
    var d = wirePath(a, b);
    var hot = p.vis && p.vis.hot;
    return '<path d="' + d + '" fill="none" stroke="#00000055" stroke-width="5.2" stroke-linecap="round" transform="translate(0 1.4)"/>' +
      '<path d="' + d + '" fill="none" stroke="' + shade(col, -0.35) + '" stroke-width="4.6" stroke-linecap="round"/>' +
      '<path d="' + d + '" fill="none" stroke="' + (hot ? '#ff7a2a' : col) + '" stroke-width="3.4" stroke-linecap="round"' + (hot ? ' class="hotwire"' : '') + '/>' +
      '<path d="' + d + '" fill="none" stroke="#ffffff" stroke-opacity=".32" stroke-width="1" stroke-linecap="round" transform="translate(-.5 -.7)"/>' +
      tip(a, '#cfd3d8') + tip(b, '#cfd3d8');
  };
  function wirePath(a, b) {
    var L = dist(a, b);
    var lift = Math.min(L * 0.22, 26);
    var nx = 0, ny = -1;
    if (L > 0.1) { nx = (b.y - a.y) / L; ny = -(b.x - a.x) / L; if (ny > 0) { nx = -nx; ny = -ny; } }
    var cx = (a.x + b.x) / 2 + nx * lift, cy = (a.y + b.y) / 2 + ny * lift;
    return 'M' + f1(a.x) + ' ' + f1(a.y) + ' Q' + f1(cx) + ' ' + f1(cy) + ' ' + f1(b.x) + ' ' + f1(b.y);
  }
  BB.wirePath = wirePath;
  function shade(hex, k) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, bb = n & 255;
    var f = function (c) { return Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k))); };
    return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(bb)).toString(16).slice(1);
  }
  DRAW.capacitor = function (p, pts) {
    var a = pt(pts[0]), b = pt(pts[1]), m = mid(a, b), ang = angle(a, b);
    var s = leg(a, m) + leg(b, m) + tip(a) + tip(b);
    var r = p.props.c >= 470e-6 ? 13 : p.props.c >= 100e-6 ? 10.5 : 8.5;
    s += '<g transform="translate(' + f1(m.x) + ' ' + f1(m.y) + ') rotate(' + f1(ang) + ')">';
    s += '<circle r="' + r + '" fill="#1f2b63" stroke="#0e1433" stroke-width=".6"/>';
    // the light stripe on the − side
    s += '<path d="M' + f1(r * 0.42) + ' ' + f1(-r * 0.91) + ' A' + r + ' ' + r + ' 0 0 1 ' + f1(r * 0.42) + ' ' + f1(r * 0.91) + ' L' + f1(r * 0.75) + ' ' + f1(r * 0.66) + ' L' + f1(r * 0.75) + ' ' + f1(-r * 0.66) + 'Z" fill="#c9cfdb"/>';
    s += txt(r * 0.7, 1.4, '−', 'capm');
    s += '<circle r="' + f1(r * 0.62) + '" fill="url(#gMetal)" stroke="#8a9099" stroke-width=".4"/>';
    s += '<path d="M' + f1(-r * 0.35) + ' 0 H' + f1(r * 0.35) + ' M0 ' + f1(-r * 0.35) + ' V' + f1(r * 0.35) + '" stroke="#7d838c" stroke-width=".7"/>';
    if (p.vis && p.vis.burnt) s += '<circle r="' + f1(r * 0.62) + '" fill="#3a2a1e" opacity=".85"/><path d="M' + f1(-r * 0.4) + ' ' + f1(-r * 0.1) + ' L0 ' + f1(-r * 0.45) + ' L' + f1(r * 0.4) + ' ' + f1(-r * 0.1) + ' M0 ' + f1(-r * 0.45) + ' L0 ' + f1(r * 0.4) + '" stroke="#c9cfdb" stroke-width="1" fill="none"/>';
    s += '</g>';
    return s + smoke(m.x, m.y, p.st.smoke, arguments[2]);
  };
  DRAW.ldr = function (p, pts) {
    var a = pt(pts[0]), b = pt(pts[1]), m = mid(a, b), ang = angle(a, b);
    var s = leg(a, m) + leg(b, m) + tip(a) + tip(b);
    var lt = p.props.light;
    s += '<g transform="translate(' + f1(m.x) + ' ' + f1(m.y) + ') rotate(' + f1(ang) + ')">';
    s += '<circle r="' + (14 + lt * 10) + '" fill="#ffe680" opacity="' + f1(lt * 0.35) + '"/>';
    s += '<circle r="7.6" fill="#f1e2c8" stroke="#b9a37c" stroke-width=".5"/>';
    s += '<path d="M-5 -4 H4 V-2 H-4 V0 H4 V2 H-4 V4 H5" stroke="#c4512a" stroke-width="1.1" fill="none"/>';
    s += '<rect x="-6" y="-5.8" width="1.6" height="11.6" fill="#cfd3d8"/><rect x="4.4" y="-5.8" width="1.6" height="11.6" fill="#cfd3d8"/>';
    s += '<circle r="7.6" fill="url(#gDome)" opacity=".6"/>';
    s += '</g>';
    return s;
  };

  function group(p, inner) {
    return '<g transform="translate(' + f1(p.x * U) + ' ' + f1(p.y * U) + ') rotate(' + (p.rot || 0) + ')">' + inner + '</g>';
  }
  function pinDots(pos, col) {
    return pos.map(function (q) { return '<rect x="' + f1(q[0] * U - 2.2) + '" y="' + f1(q[1] * U - 2.2) + '" width="4.4" height="4.4" rx=".8" fill="#1a1a1a"/><circle cx="' + f1(q[0] * U) + '" cy="' + f1(q[1] * U) + '" r="1.35" fill="' + (col || 'url(#gGold)') + '"/>'; }).join('');
  }
  // pins: optional pin list; power pins get a coloured base (5V red, 3.3V orange, GND black) so they are easy to find
  var PIN_COL = { v5: '#c8302a', v33: '#e08a1c', gnd: '#050505' };
  function headerPinsSvg(pos, pins) {
    return pos.map(function (q, i) { var c = pins && PIN_COL[pins[i].kind]; return '<rect x="' + f1(q[0] * U - 3.6) + '" y="' + f1(q[1] * U - 3.6) + '" width="7.2" height="7.2" rx="1" fill="' + (c || '#1d1d1d') + '"' + (pins && pins[i].kind === 'gnd' ? ' stroke="#9aa0a8" stroke-width=".6"' : '') + '/><rect x="' + f1(q[0] * U - 1.3) + '" y="' + f1(q[1] * U - 1.3) + '" width="2.6" height="2.6" fill="url(#gGold)"/>'; }).join('');
  }

  DRAW.button = function (p) {
    var pr = p.vis && p.vis.pressed;
    var s = pinDots(BB.PARTS.button.pinPos, '#c9cdd3');
    s += '<rect x="-3.8" y="2.6" width="27.6" height="24.8" rx="2" fill="#1e1e1e" filter="url(#fShadow)"/>';
    s += '<rect x="-2.6" y="3.8" width="25.2" height="22.4" rx="1.6" fill="url(#gMetal)"/>';
    s += '<circle cx="2" cy="7.6" r="1.1" fill="#666"/><circle cx="18" cy="7.6" r="1.1" fill="#666"/><circle cx="2" cy="22.4" r="1.1" fill="#666"/><circle cx="18" cy="22.4" r="1.1" fill="#666"/>';
    s += '<circle cx="10" cy="15" r="' + (pr ? 6.4 : 7.2) + '" fill="' + (pr ? '#111' : '#242424') + '" stroke="#000" stroke-width=".6"/>';
    if (!pr) s += '<circle cx="8.4" cy="13.2" r="2.4" fill="#fff" opacity=".12"/>';
    // leg numbers (legs 1–3 and 2–4 are joined inside)
    s += txt(-5.5, -1.5, '1', 'pinlbl dark') + txt(23, -1.5, '2', 'pinlbl dark') + txt(-5.5, 33.5, '3', 'pinlbl dark') + txt(23, 33.5, '4', 'pinlbl dark');
    return group(p, s);
  };
  DRAW.pot = function (p) {
    var v = p.vis || {}, pos = v.pos !== undefined ? v.pos : p.props.pos;
    var s = pinDots(BB.PARTS.pot.pinPos, '#c9cdd3');
    var ang = -135 + 270 * pos;
    if (p.props.style === 'trimmer') {
      // blue square trimmer with a white cross knob
      s += '<path d="M0 0 V-4 M20 0 V-4 M40 0 V-4" stroke="#c9cdd3" stroke-width="1.6"/>';
      s += '<rect x="1" y="-41" width="38" height="38" rx="3" fill="#2a63c9" filter="url(#fShadow)"/><rect x="1" y="-41" width="38" height="38" rx="3" fill="none" stroke="#174394"/>';
      s += '<circle cx="20" cy="-22" r="13" fill="#e9edf2" stroke="#9aa3ad"/>';
      s += '<g transform="translate(20 -22) rotate(' + f1(ang) + ')"><rect x="-1.6" y="-11" width="3.2" height="22" rx="1" fill="#7d8792"/><rect x="-11" y="-1.6" width="22" height="3.2" rx="1" fill="#7d8792"/><path d="M0 -12 l-2.5 4 h5z" fill="#d8322b"/></g>';
    } else {
      // classic round potentiometer: metal body, knurled shaft with a flat, legs on a tab
      s += '<path d="M0 0 V-8 M20 0 V-8 M40 0 V-8" stroke="#c9cdd3" stroke-width="1.8"/>';
      s += '<rect x="-4" y="-14" width="48" height="10" rx="2" fill="#2b2b2b"/>';
      s += '<circle cx="20" cy="-40" r="31" fill="#8d939b" filter="url(#fShadow)"/><circle cx="20" cy="-40" r="28.5" fill="url(#gMetal)" stroke="#7d828a"/>';
      s += '<circle cx="20" cy="-40" r="16" fill="#5d636b"/><circle cx="20" cy="-40" r="12.5" fill="url(#pKnurl)" stroke="#55595f" stroke-width=".8"/>';
      s += '<g transform="translate(20 -40) rotate(' + f1(ang) + ')"><rect x="-1.6" y="-12" width="3.2" height="12" rx="1" fill="#f5f5f5" stroke="#333" stroke-width=".4"/></g>';
      s += txt(20, -14.5 - 3, 'B10K', 'tiny', ' text-anchor="middle"');
    }
    if (v.burnt) s += '<circle cx="20" cy="-30" r="26" fill="#000" opacity=".45"/>';
    s += txt(0, 7, '1', 'pinlbl dark', ' text-anchor="middle"') + txt(20, 7, 'W', 'pinlbl dark', ' text-anchor="middle"') + txt(40, 7, '3', 'pinlbl dark', ' text-anchor="middle"');
    return group(p, s) + smoke(p.x * U + 20, p.y * U - 30, p.st.smoke, arguments[2]);
  };
  DRAW.battery9 = function (p, pts) {
    var x = p.x * U, y = p.y * U, w = 195, h = 105;
    var s = '<g transform="translate(' + x + ' ' + y + ')" filter="url(#fShadow)">';
    s += '<rect x="22" y="0" width="' + (w - 22) + '" height="' + h + '" rx="7" fill="url(#gBatt)"/>';
    s += '<rect x="22" y="0" width="48" height="' + h + '" fill="url(#gCopper)"/>';
    s += '<rect x="8" y="6" width="16" height="' + (h - 12) + '" rx="3" fill="#2a2a2a"/>';
    s += '<rect x="0" y="20" width="10" height="64" rx="3" fill="#1a1a1a"/>';
    s += txt(98, 66, '9V', 'battxt');
    s += txt(96, 90, 'ALKALINE', 'battsm');
    s += txt(36, 22, '+', 'battsm2') + txt(36, 92, '−', 'battsm2');
    s += '</g>';
    return s + leads(p, pts, ['#d8322b', '#222']);
  };
  DRAW.aa = function (p, pts) {
    var x = p.x * U, y = p.y * U, n = p.props.cells, w = 225, h = 130;
    var s = '<g transform="translate(' + x + ' ' + y + ')" filter="url(#fShadow)">';
    s += '<rect x="0" y="0" width="' + w + '" height="' + h + '" rx="6" fill="#1c1c1c"/>';
    for (var i = 0; i < n; i++) {
      var cy = 10 + i * ((h - 20) / n), ch = (h - 20) / n - 4;
      s += '<rect x="25" y="' + f1(cy) + '" width="186" height="' + f1(ch) + '" rx="' + f1(ch / 2) + '" fill="#2f9b46"/>';
      // cells in series point opposite ways: the black (−) end alternates
      s += '<rect x="' + (i % 2 ? 141 : 25) + '" y="' + f1(cy) + '" width="70" height="' + f1(ch) + '" rx="' + f1(ch / 2) + '" fill="#1f1f1f"/>';
      s += '<text x="' + (i % 2 ? 30 : 204) + '" y="' + f1(cy + ch / 2 + 4) + '" class="aatxt">+</text>';
      s += '<rect x="' + (i % 2 ? 209 : 18) + '" y="' + f1(cy + ch * 0.3) + '" width="8" height="' + f1(ch * 0.4) + '" rx="2" fill="url(#gMetal)"/>';
      s += txt(120, cy + ch / 2 + 4, 'AA 1.5V', 'aatxt');
    }
    s += '</g>';
    return s + leads(p, pts, ['#d8322b', '#222']);
  };
  // flying leads from a module body to their ends
  function leads(p, pts, cols, probe) {
    var def = BB.PARTS[p.type], s = '';
    // draw the black (−) lead first, so the red (+) one is always on top and easy to see
    pts.map(function (q, k) { return [q, k]; }).reverse().forEach(function (qk) {
      var q = qk[0], k = qk[1];
      var a = { x: (p.x + def.leadFrom[k][0]) * U, y: (p.y + def.leadFrom[k][1]) * U }, b = pt(q);
      // the lead leaves the body in its own direction, and arrives at its end from the body's side
      var out = def.leadOut || [def.leadFrom[k][0] <= 0.5 ? -1 : 1, 0];
      var c1 = probe ? { x: a.x, y: a.y + 40 } : { x: a.x + out[0] * 30, y: a.y + out[1] * 30 };
      var c2 = probe ? { x: b.x + (k === 0 ? -18 : 18), y: b.y + 70 } : { x: b.x, y: b.y + (a.y < b.y ? -30 : 30) };
      var pe = { x: b.x + (k === 0 ? -12 : 12), y: b.y + 37 }; // bottom end of the (leaning) probe body
      var d = 'M' + f1(a.x) + ' ' + f1(a.y) + ' C' + f1(c1.x) + ' ' + f1(c1.y) + ' ' + f1(c2.x) + ' ' + f1(c2.y) + ' ' + f1(probe ? pe.x : b.x) + ' ' + f1(probe ? pe.y : b.y);
      if (probe) {
        // a probe above the meter: the cable goes down out of the jack and round the side, not over the display
        var bx1 = (p.x + def.size[0]) * U, bx0 = p.x * U, by1 = (p.y + def.size[1]) * U, pbot = b.y + 39;
        if (b.x < bx0 - 10 || b.x > bx1 + 10) {
          // probe off to the side: out of the jack to the right, under the meter, then up to the probe
          var qx = a.x + 30 + k * 6, qy = by1 + 18 + k * 8;
          d = 'M' + f1(a.x) + ' ' + f1(a.y) + ' C' + f1(a.x + 40) + ' ' + f1(a.y) + ' ' + f1(qx + 10) + ' ' + f1(qy - 30) + ' ' + f1(qx) + ' ' + f1(qy) +
            ' C' + f1(qx - 60) + ' ' + f1(qy + 30) + ' ' + f1(pe.x) + ' ' + f1(Math.max(pbot, qy) + 40) + ' ' + f1(pe.x) + ' ' + f1(pe.y);
        } else if (pbot < by1) {
          var side = b.x > (bx0 + bx1) / 2 ? bx1 + 18 + k * 8 : bx0 - 18 - k * 8, sy = (a.y + pbot) / 2;
          d = 'M' + f1(a.x) + ' ' + f1(a.y) + ' C' + f1(a.x) + ' ' + f1(a.y + 50) + ' ' + f1(side) + ' ' + f1(a.y + 40) + ' ' + f1(side) + ' ' + f1(sy) +
            ' C' + f1(side) + ' ' + f1(pbot + 10) + ' ' + f1(pe.x) + ' ' + f1(pbot + 30) + ' ' + f1(pe.x) + ' ' + f1(pe.y);
        }
      }
      s += '<path d="' + d + '" fill="none" stroke="#00000044" stroke-width="4.4" transform="translate(0 1.5)"/>';
      s += '<path d="' + d + '" fill="none" stroke="' + cols[k] + '" stroke-width="' + (probe ? 3.6 : 3) + '" stroke-linecap="round"/>';
      if (probe) {
        // the two probe bodies lean apart (red left, black right), so their tips never hide each other
        s += '<g transform="translate(' + f1(b.x) + ' ' + f1(b.y) + ') rotate(' + (k === 0 ? 18 : -18) + ')"><rect x="-3.4" y="5" width="6.8" height="34" rx="2.6" fill="' + cols[k] + '" stroke="#00000066" stroke-width=".5"/><rect x="-4.6" y="11" width="9.2" height="3" rx="1.4" fill="' + cols[k] + '"/><path d="M-1 5 L0 -0.5 L1 5Z" fill="#d9dde2" stroke="#777" stroke-width=".3"/></g>';
      } else s += tip(b, '#d9dde2');
    });
    return s;
  }
  DRAW.meter = function (p, pts) {
    var x = p.x * U, y = p.y * U, v = p.vis || {}, m = p.props.mode;
    var s = '<g transform="translate(' + x + ' ' + y + ') scale(0.7)">';
    s += '<rect x="0" y="0" width="220" height="380" rx="22" fill="#f2bf14" stroke="#b78d00" stroke-width="1.2" filter="url(#fShadow)"/>';
    s += '<rect x="12" y="12" width="196" height="356" rx="14" fill="#2b2d31"/>';
    s += '<rect x="26" y="26" width="168" height="78" rx="6" fill="#9fae94" stroke="#555" stroke-width="2"/>';
    // over range: a DT-830B shows just a "1" on the left
    if (m !== 'off' && v.text === 'OL') s += '<text x="40" y="86" class="lcd">1</text>';
    else {
      s += '<text x="178" y="86" class="lcd" text-anchor="end">' + (m === 'off' ? '' : (v.text || '0.00')) + '</text>';
      s += '<text x="184" y="98" class="lcdu" text-anchor="end">' + (m === 'off' ? '' : (v.unit || '')) + '</text>';
    }
    if (p.st.fuse && m === 'A') s += '<text x="34" y="44" class="lcdu">FUSE</text>';
    s += txt(110, 122, 'DT-830B', 'mtrb', ' text-anchor="middle"');
    // dial (left): the real range marks around it; the pointer snaps to one range per mode.
    // Jacks are stacked on the right (like a DT-830B).
    var DX = 95, DY = 228;
    var ang = { off: 0, V: -66, A: 66, ohm: 151, diode: -150 }[m];
    s += '<circle cx="' + DX + '" cy="' + DY + '" r="70" fill="#1d1e21" stroke="#444" stroke-width="1"/>';
    var RANGES = [['1000', -114], ['200', -98], ['20', -66], ['2', -50], ['200m', -34], ['200µ', 18], ['2m', 34], ['20m', 66], ['200m', 82], ['10A', 106],
      ['200', 123], ['2k', 137], ['20k', 151], ['200k', 165], ['2M', 179], ['hFE', -168], ['→|', -150], ['750', -132]];
    RANGES.forEach(function (rg) {
      var aa = (rg[1] - 90) * Math.PI / 180;
      s += '<line x1="' + f1(DX + Math.cos(aa) * 64) + '" y1="' + f1(DY + Math.sin(aa) * 64) + '" x2="' + f1(DX + Math.cos(aa) * 69) + '" y2="' + f1(DY + Math.sin(aa) * 69) + '" stroke="#e9e9e9" stroke-width="1.4"/>';
      s += '<text x="' + f1(DX + Math.cos(aa) * 55) + '" y="' + f1(DY + Math.sin(aa) * 55 + 2.5) + '" class="mtrr" text-anchor="middle">' + rg[0] + '</text>';
    });
    [['OFF', 0], ['DCV', -82], ['DCA', 50], ['Ω', 140]].forEach(function (lb) {
      var aa = (lb[1] - 90) * Math.PI / 180;
      s += '<text x="' + f1(DX + Math.cos(aa) * 40) + '" y="' + f1(DY + Math.sin(aa) * 40 + 3) + '" class="mtrl" text-anchor="middle">' + lb[0] + '</text>';
    });
    s += '<g transform="translate(' + DX + ' ' + DY + ') rotate(' + ang + ')"><circle r="28" fill="#111" stroke="#555" stroke-width="1.4"/><rect x="-6" y="-31" width="12" height="62" rx="5" fill="#2c2c2c" stroke="#666" stroke-width=".8"/><path d="M0 -30 L-4 -21 L4 -21Z" fill="#fff"/></g>';
    // jacks, top to bottom: 10A, VΩmA (red probe), COM (black probe)
    [['10ADC', 248, '#d8322b'], ['VΩmA', 288, '#d8322b'], ['COM', 328, '#1c1c1c']].forEach(function (j) {
      s += '<circle cx="186" cy="' + j[1] + '" r="9" fill="#111" stroke="' + j[2] + '" stroke-width="2.5"/>';
      s += txt(186, j[1] - 13, j[0], 'mtrs', ' text-anchor="middle"');
    });
    s += '</g>';
    return s + leads(p, pts, ['#d8322b', '#1e1e1e'], true);
  };

  DRAW.mb102 = function (p, pts) {
    var pcb = { black: '#1d1f22', green: '#1f6b3a', red: '#a3161b', blue: '#1b4f99' }[p.props.pcb] || '#1d1f22';
    var on = p.vis ? p.vis.on : p.props.on;
    var s = '';
    // pins into the rails
    s += pinDots(BB.PARTS.mb102.pinPos, '#c9cdd3');
    s += '<rect x="-92" y="-16" width="125" height="202" rx="5" fill="' + pcb + '" filter="url(#fShadow)"/>';
    s += '<rect x="-92" y="-16" width="125" height="202" rx="5" fill="none" stroke="#000" stroke-opacity=".4"/>';
    // USB-A socket and barrel jack on the outside end
    s += '<rect x="-104" y="14" width="44" height="40" rx="2" fill="url(#gMetal)" stroke="#777" stroke-width=".6"/><rect x="-100" y="27" width="34" height="12" fill="#1d1d1d"/>';
    s += '<rect x="-106" y="118" width="52" height="38" rx="3" fill="#121212"/><circle cx="-86" cy="137" r="8" fill="#000" stroke="#555"/><circle cx="-86" cy="137" r="2.4" fill="url(#gMetal)"/>';
    // power switch + LED
    s += '<rect x="-80" y="72" width="26" height="26" rx="2" fill="url(#gMetal)"/><circle cx="-67" cy="85" r="8" fill="' + (on ? '#f3f3f3' : '#dcdcdc') + '" stroke="#999"/>';
    s += '<rect x="-46" y="80" width="6" height="8" rx="1" fill="' + (on ? '#59ff6a' : '#245a2c') + '"/>' + (on ? '<circle cx="-43" cy="84" r="8" fill="#59ff6a" opacity=".35"/>' : '');
    s += txt(-36, 87, 'ON', 'mbs');
    // regulators (AMS1117)
    // AMS1117 regulators (SOT-223: black body, wide metal tab) and electrolytic capacitors (round tops)
    [42, 104].forEach(function (yy) {
      s += '<rect x="-58" y="' + yy + '" width="20" height="12" rx="1" fill="#1a1a1a" stroke="#444" stroke-width=".5"/><rect x="-56" y="' + (yy - 4) + '" width="16" height="4" fill="url(#gMetal)"/>';
      s += txt(-58, yy + 18, 'AMS1117', 'mbs');
    });
    [[-20, 62], [-20, 124]].forEach(function (c) { s += '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="7" fill="#1f2b63" stroke="#0e1433"/><circle cx="' + c[0] + '" cy="' + c[1] + '" r="4.3" fill="url(#gMetal)"/><path d="M' + (c[0] - 7) + ' ' + (c[1] - 2) + ' a7 7 0 0 1 4 -5" stroke="#c9cfdb" stroke-width="2" fill="none"/>'; });
    // jumpers
    [['top', 20], ['bottom', 138]].forEach(function (j) {
      var sel = p.props[j[0]], yc = j[1], x0 = -31;
      // three pins in a column: 3.3V (top), OUT (middle), 5V (bottom); the jumper joins OUT to one of them
      for (var k = 0; k < 3; k++) s += '<rect x="' + (x0 - 1.4) + '" y="' + (yc - 7 + k * 7 - 1.4) + '" width="2.8" height="2.8" fill="url(#gGold)"/>';
      if (sel === '3.3') s += '<rect x="' + (x0 - 4.5) + '" y="' + (yc - 10.5) + '" width="9" height="13" rx="1.6" fill="#f2cf1d" stroke="#a88b00" stroke-width=".6"/>';
      else if (sel === '5') s += '<rect x="' + (x0 - 4.5) + '" y="' + (yc - 2.5) + '" width="9" height="13" rx="1.6" fill="#f2cf1d" stroke="#a88b00" stroke-width=".6"/>';
      else s += '<rect x="' + (x0 - 4.5) + '" y="' + (yc - 3.5) + '" width="9" height="7" rx="1.4" fill="#f2cf1d" stroke="#a88b00" stroke-width=".6"/>'; // OFF: the jumper sits on the middle pin only
      s += txt(x0 - 7, yc - 5, '3.3V', 'mbs', ' text-anchor="end"') + txt(x0 - 7, yc + 2, 'OFF', 'mbs', ' text-anchor="end"') + txt(x0 - 7, yc + 9, '5V', 'mbs', ' text-anchor="end"');
    });
    s += txt(-84, 186 - 8, 'MB102', 'mbs') + txt(-60, -4, 'Breadboard power', 'mbs');
    s += txt(15, 3, '+', 'mbp') + txt(15, 13, '−', 'mbp') + txt(15, 163, '+', 'mbp') + txt(15, 173, '−', 'mbp');
    return group(p, s);
  };

  // ---------- microcontroller boards ----------
  DRAW.nano = function (p, pts, now) {
    var def = BB.PARTS.nano, st = p.st || {};
    var s = '';
    s += '<rect x="-20" y="-6" width="170" height="72" rx="4" fill="#0e5aa7" filter="url(#fShadow)"/>';
    s += '<rect x="-20" y="-6" width="170" height="72" rx="4" fill="none" stroke="#073b70" stroke-width=".8"/>';
    s += '<rect x="-28" y="18" width="24" height="24" rx="2" fill="url(#gMetal)" stroke="#7a7f87" stroke-width=".6"/><rect x="-28" y="24" width="6" height="12" fill="#444"/>';
    s += headerPinsSvg(def.pinPos);
    def.pins.forEach(function (pin, i) {
      var q = def.pinPos[i];
      s += '<text x="' + (q[0] * U) + '" y="' + (q[1] === 0 ? 9.8 : 52.6) + '" class="pinlbl" text-anchor="middle">' + pin.n + '</text>';
    });
    // reset button in the middle, chip toward the far end, crystal and LEDs near the USB plug
    s += '<rect x="56" y="22" width="15" height="15" rx="1" fill="#f1efe8"/><circle cx="63.5" cy="29.5" r="4.2" fill="#d9d4c6" stroke="#aaa" stroke-width=".4"/>' + txt(63.5, 43, 'RESET', 'tiny', ' text-anchor="middle"');
    s += '<g transform="translate(98 30) rotate(45)"><rect x="-12" y="-12" width="24" height="24" fill="#1a1a1a"/><circle cx="-8" cy="-8" r="1.5" fill="#333"/></g>';
    s += txt(98, 31, 'ATMEGA328P', 'chip', ' text-anchor="middle" transform="rotate(45 98 30)"');
    s += '<rect x="30" y="20" width="16" height="7" rx="3.5" fill="url(#gMetal)" stroke="#888" stroke-width=".4"/>' + txt(38, 25.3, '16.000', 'tiny dark', ' text-anchor="middle"');
    var led = function (x, y, on, col, lb) { return '<rect x="' + x + '" y="' + y + '" width="4" height="2.6" fill="' + (on ? col : '#d9d2c0') + '"/>' + (on ? '<circle cx="' + (x + 2) + '" cy="' + (y + 1.3) + '" r="5" fill="' + col + '" opacity=".45"/>' : '') + txt(x + 5.5, y + 2.4, lb, 'tiny'); };
    var pinL = st.io && st.io.D13 ? st.io.D13.level : 0;
    s += led(4, 30, st.powered, '#56ff6d', 'PWR') + led(4, 36, st.powered && pinL, '#ffb12a', 'L') + led(4, 42, false, '#ffd52a', 'TX') + led(20, 42, false, '#ffd52a', 'RX');
    s += txt(30, 49, 'Nano V3', 'brand');
    // ICSP header pads (2 × 3) at the far end
    for (var ix = 0; ix < 3; ix++) for (var iy = 0; iy < 2; iy++) s += '<circle cx="' + (126 + ix * 7) + '" cy="' + (24 + iy * 9) + '" r="2.4" fill="url(#gGold)" stroke="#7a5a10" stroke-width=".4"/>';
    s += txt(126, 43, 'ICSP', 'tiny');
    if (st.damaged && Object.keys(st.damaged).length) s += '<text x="98" y="16" class="dmg" text-anchor="middle">damaged</text>';
    return group(p, s) + smoke(p.x * U + 60, p.y * U + 20, st.smoke, now);
  };
  DRAW.esp32 = function (p, pts, now) {
    var def = BB.PARTS.esp32, st = p.st || {};
    var s = '';
    s += '<rect x="-26" y="-5.5" width="200" height="91" rx="9" fill="#17181c" filter="url(#fShadow)"/>';
    s += '<circle cx="-18" cy="3" r="3.4" fill="#2b2b30" stroke="#c9a227" stroke-width="1.2"/><circle cx="-18" cy="77" r="3.4" fill="#2b2b30" stroke="#c9a227" stroke-width="1.2"/><circle cx="166" cy="3" r="3.4" fill="#2b2b30" stroke="#c9a227" stroke-width="1.2"/><circle cx="166" cy="77" r="3.4" fill="#2b2b30" stroke="#c9a227" stroke-width="1.2"/>';
    s += '<rect x="-33" y="30" width="20" height="22" rx="2" fill="url(#gMetal)" stroke="#777" stroke-width=".5"/>';
    s += '<rect x="-8" y="56" width="20" height="14" rx="1" fill="#efe8d4"/>' + txt(-6, 76, 'BAT', 'pinlbl');
    // ESP32-WROOM-32 module: metal can + antenna
    s += '<rect x="78" y="12" width="96" height="62" rx="2" fill="#262a33"/>';
    s += '<rect x="82" y="16" width="66" height="54" rx="2" fill="url(#gMetal)" stroke="#8a9099" stroke-width=".5"/>';
    s += txt(115, 40, 'ESP32-WROOM-32', 'chip dark', ' text-anchor="middle"') + txt(115, 50, 'Wi-Fi + BT', 'tiny dark', ' text-anchor="middle"');
    s += '<path d="M154 20 h14 v6 h-12 v6 h12 v6 h-12 v6 h12 v6 h-12 v6 h12 v8" stroke="#c9a227" stroke-width="1.6" fill="none"/>';
    s += headerPinsSvg(def.pinPos);
    def.pins.forEach(function (pin, i) {
      var q = def.pinPos[i];
      s += '<text x="' + (q[0] * U) + '" y="' + (q[1] === 0 ? 10 : 72.6) + '" class="pinlbl" text-anchor="middle">' + pin.n + '</text>';
    });
    var on13 = st.io && st.io['13'] && st.io['13'].level;
    s += '<rect x="14" y="30" width="4" height="3" fill="' + (on13 ? '#ff3b2a' : '#d9d2c0') + '"/>' + (on13 ? '<circle cx="16" cy="31.5" r="6" fill="#ff3b2a" opacity=".5"/>' : '');
    s += '<rect x="14" y="40" width="4" height="3" fill="' + (st.powered ? '#ffb12a' : '#d9d2c0') + '"/>';
    s += txt(4, 52, 'HUZZAH32', 'brand2') + txt(4, 60, 'Feather', 'tiny');
    // reset button (next to the USB plug) and the orange CHG (charge) LED
    s += '<rect x="-6" y="10" width="12" height="12" rx="1" fill="url(#gMetal)" stroke="#777" stroke-width=".4"/><circle cx="0" cy="16" r="3.2" fill="#2b2b2b"/>' + txt(0, 28, 'RST', 'tiny', ' text-anchor="middle"');
    s += '<rect x="22" y="30" width="4" height="3" fill="' + (st.powered ? '#ffb12a' : '#d9d2c0') + '"/>' + txt(28, 33, 'CHG', 'tiny');
    if (st.damaged && Object.keys(st.damaged).length) s += '<text x="115" y="30" class="dmg" text-anchor="middle">damaged</text>';
    return group(p, s) + smoke(p.x * U + 100, p.y * U + 20, st.smoke, now);
  };
  DRAW.pi5 = function (p, pts, now) {
    var def = BB.PARTS.pi5, st = p.st || {};
    var x = p.x * U, y = p.y * U;
    var s = '<g transform="translate(' + x + ' ' + y + ')">';
    s += '<rect x="0" y="0" width="335" height="220" rx="12" fill="#2c8a43" filter="url(#fShadow)"/>';
    [[12, 12], [12, 208], [244, 12], [244, 208]].forEach(function (h) { s += '<circle cx="' + h[0] + '" cy="' + h[1] + '" r="7" fill="#e9e2c8"/><circle cx="' + h[0] + '" cy="' + h[1] + '" r="4" fill="#3b3b3b"/>'; });
    s += '<rect x="23" y="-0.5" width="202" height="24" fill="#111"/>';
    s += headerPinsSvg(def.pinPos.map(function (q) { return [q[0], q[1]]; }), def.pins);
    s += '<rect x="280" y="6" width="22" height="9" rx="1" fill="#f1efe8"/>' + txt(281, 24, 'FAN', 'tiny');
    s += '<rect x="96" y="66" width="64" height="64" rx="4" fill="url(#gMetal)" stroke="#888"/>' + txt(128, 100, 'RASPBERRY PI', 'chip dark', ' text-anchor="middle"') + txt(128, 110, 'BCM2712', 'tiny dark', ' text-anchor="middle"');
    s += '<rect x="182" y="74" width="30" height="30" rx="2" fill="#1c1c1c"/>' + txt(197, 92, 'RP1', 'tiny', ' text-anchor="middle"');
    s += '<rect x="40" y="58" width="44" height="48" rx="2" fill="#1c1c1c"/>' + txt(62, 85, 'RAM', 'tiny', ' text-anchor="middle"');
    // right edge: USB 2.0 (black), USB 3.0 (blue), Ethernet at the bottom
    s += '<rect x="274" y="18" width="68" height="54" rx="2" fill="url(#gMetal)" stroke="#777"/><rect x="282" y="26" width="52" height="13" fill="#1a1a1a"/><rect x="282" y="51" width="52" height="13" fill="#1a1a1a"/>';
    s += '<rect x="274" y="80" width="68" height="54" rx="2" fill="url(#gMetal)" stroke="#777"/><rect x="282" y="88" width="52" height="13" fill="#2b66d9"/><rect x="282" y="113" width="52" height="13" fill="#2b66d9"/>';
    s += '<rect x="270" y="144" width="72" height="62" rx="2" fill="url(#gMetal)" stroke="#777"/><rect x="282" y="156" width="48" height="38" rx="2" fill="#2a2a2a"/>' + txt(290, 202, 'ETH', 'tiny dark');
    // bottom edge: USB-C power, two micro HDMI, two camera/display connectors
    s += '<rect x="34" y="204" width="32" height="18" rx="5" fill="url(#gMetal)"/><rect x="92" y="207" width="24" height="14" rx="3" fill="url(#gMetal)"/><rect x="136" y="207" width="24" height="14" rx="3" fill="url(#gMetal)"/>';
    s += '<rect x="178" y="176" width="10" height="34" rx="1" fill="#f1efe8"/><rect x="200" y="176" width="10" height="34" rx="1" fill="#f1efe8"/>' + txt(176, 172, 'CAM/DISP', 'tiny');
    s += txt(30, 198, 'USB-C', 'tiny') + txt(94, 198, 'micro HDMI ×2', 'tiny');
    // left edge: PCIe connector and the power button
    s += '<rect x="-2" y="70" width="10" height="44" rx="1" fill="#f1efe8"/>' + txt(12, 96, 'PCIe', 'tiny');
    s += '<rect x="-3" y="166" width="8" height="12" rx="2" fill="#1c1c1c" stroke="#777" stroke-width=".6"/>' + txt(9, 175, 'power', 'tiny');
    s += '<circle cx="24" cy="150" r="4" fill="' + (st.powered ? '#ff3b2a' : '#5a1e1a') + '"/>' + (st.powered ? '<circle cx="24" cy="150" r="8" fill="#ff3b2a" opacity=".35"/>' : '');
    s += txt(20, 40, 'Raspberry Pi 5', 'brand');
    s += '</g>';
    s += '<text x="' + (x + 4) + '" y="' + (y + 236) + '" class="caption">Too big for the breadboard: connect its GPIO pins with jumper wires.</text>';
    def.pins.forEach(function (pin, i) {
      var q = def.pinPos[i];
      s += '<text x="' + f1(x + q[0] * U) + '" y="' + f1(y + q[1] * U + (q[1] < 1.5 ? -5 : 7.6)) + '" class="hdr" text-anchor="middle">' + pin.phys + '</text>';
    });
    return s + smoke(x + 160, y + 40, st.smoke, now);
  };
  DRAW.wio = function (p, pts, now) {
    var def = BB.PARTS.wio, st = p.st || {};
    var x = p.x * U, y = p.y * U;
    var shell = p.props.shell === 'white' ? '#eef0f2' : '#2f6fb7';
    var s = '<g transform="translate(' + x + ' ' + y + ')">';
    // back header strip (shown below the case)
    // the header is on the back of the case: drawn as a "pulled-out" view, joined by dashed guide lines
    s += '<path d="M40 224 L40 270 M238 224 L238 270" stroke="#7d8792" stroke-width="1" stroke-dasharray="3 3"/>';
    s += '<rect x="34" y="270" width="210" height="28" rx="4" fill="#1d1f22" stroke="#555" stroke-dasharray="3 2"/>' + txt(46, 250, '40-pin header (on the back)', 'tiny');
    s += '<rect x="0" y="0" width="285" height="224" rx="26" fill="' + shell + '" filter="url(#fShadow)"/>';
    [30, 76, 122].forEach(function (bx) { s += '<rect x="' + bx + '" y="-7" width="26" height="10" rx="3" fill="#20242a" stroke="#000" stroke-opacity=".4"/>'; });
    s += '<rect x="22" y="18" width="200" height="160" rx="8" fill="#0b0b0d"/>';
    s += '<rect x="30" y="26" width="184" height="138" fill="' + (st.powered ? '#0d1c2b' : '#060608') + '"/>';
    if (st.powered) {
      var lines = st.display || (st.serial && st.serial.length ? st.serial.slice(-4) : ['Wio Terminal', 'Pick a program']);
      lines.slice(0, 5).forEach(function (l, i) { s += '<text x="38" y="' + (50 + i * 24) + '" class="wioscr">' + esc(String(l).slice(0, 16)) + '</text>'; });
    }
    s += '<circle cx="252" cy="160" r="16" fill="#1d1d1d"/><circle cx="252" cy="160" r="6" fill="#444"/>';
    for (var k = 0; k < 4; k++) s += '<rect x="236" y="' + (40 + k * 10) + '" width="30" height="3" rx="1.5" fill="#00000055"/>';
    s += txt(26, 205, 'Wio Terminal', 'brand' + (p.props.shell === 'white' ? ' dark' : ''));
    // two Grove ports and the USB-C plug on the bottom edge
    s += '<rect x="40" y="218" width="34" height="12" rx="2" fill="#f1efe8" stroke="#999"/><rect x="211" y="218" width="34" height="12" rx="2" fill="#f1efe8" stroke="#999"/><rect x="128" y="219" width="28" height="9" rx="4" fill="url(#gMetal)"/>';
    s += txt(46, 240, 'Grove', 'tiny' + (p.props.shell === 'white' ? ' dark' : '')) + txt(217, 240, 'Grove', 'tiny' + (p.props.shell === 'white' ? ' dark' : ''));
    s += '</g>';
    s += headerPinsSvg(def.pinPos.map(function (q) { return [q[0] + p.x, q[1] + p.y]; }), def.pins);
    def.pins.forEach(function (pin, i) {
      var q = def.pinPos[i];
      s += '<text x="' + f1(x + q[0] * U) + '" y="' + f1(y + q[1] * U + (q[1] < 28.9 ? -4.6 : 7.8)) + '" class="hdr" text-anchor="middle">' + pin.phys + '</text>';
    });
    return s + smoke(x + 140, y + 60, st.smoke, now);
  };
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // ---------- modules ----------
  DRAW.oled = function (p) {
    var v = p.vis || {}, def = BB.PARTS.oled, x = p.x * U, y = p.y * U;
    var s = '<g transform="translate(' + x + ' ' + y + ')">';
    s += '<rect x="0" y="0" width="106" height="107" rx="4" fill="#0f4fa1" filter="url(#fShadow)"/>';
    [[6, 6], [100, 6], [6, 101], [100, 101]].forEach(function (h) { s += '<circle cx="' + h[0] + '" cy="' + h[1] + '" r="3.2" fill="#eee" stroke="#999" stroke-width=".4"/>'; });
    ['GND', 'VCC', 'SCL', 'SDA'].forEach(function (l, i) { s += txt(38 + i * U, 19, l, 'pinlbl', ' text-anchor="middle"'); });
    s += '<rect x="4" y="26" width="98" height="64" rx="2" fill="#050608"/>';
    if (v.lines) v.lines.slice(0, 4).forEach(function (l, i) { s += '<text x="10" y="' + (42 + i * 14) + '" class="oled' + (i === 0 ? ' oledh' : '') + '">' + esc(String(l).slice(0, 16)) + '</text>'; });
    s += txt(53, 100, '128×64 OLED', 'tiny', ' text-anchor="middle"');
    s += '</g>';
    s += headerPinsSvg(def.pinPos.map(function (q) { return [q[0] + p.x, q[1] + p.y]; }));
    return s;
  };
  DRAW.lcd = function (p) {
    var v = p.vis || {}, def = BB.PARTS.lcd;
    var x = p.x * U, y = p.y * U, blue = p.props.light === 'blue';
    var s = '<g transform="translate(' + x + ' ' + y + ')">';
    s += '<rect x="0" y="0" width="315" height="140" rx="4" fill="#1d7a3a" filter="url(#fShadow)"/>';
    [[10, 10], [305, 10], [10, 130], [305, 130]].forEach(function (h) { s += '<circle cx="' + h[0] + '" cy="' + h[1] + '" r="5" fill="#eee"/>'; });
    s += '<rect x="22" y="22" width="272" height="96" rx="3" fill="#1d1d1d"/>';
    var lit = v.on;
    var bg = lit ? (blue ? '#2f5bea' : '#9ccf3c') : (blue ? '#26346b' : '#61732e');
    s += '<rect x="32" y="34" width="252" height="72" fill="' + bg + '"/>';
    var ink = blue ? '#e8f0ff' : '#1d2a10';
    for (var r = 0; r < 2; r++) for (var c = 0; c < 16; c++) s += '<rect x="' + (38 + c * 15.4) + '" y="' + (42 + r * 30) + '" width="13" height="24" fill="' + (blue ? '#3b66f0' : '#a9d84a') + '" opacity="' + (lit ? 0.6 : 0.2) + '"/>';
    if (v.lines) v.lines.slice(0, 2).forEach(function (l, i) {
      var t = String(l).slice(0, 16);
      for (var c = 0; c < t.length; c++) s += '<text x="' + (44.5 + c * 15.4) + '" y="' + (61 + i * 30) + '" class="lcdch" fill="' + ink + '" opacity="' + (v.faint ? 0.25 : 1) + '" text-anchor="middle">' + esc(t[c]) + '</text>';
    });
    s += '<rect x="-12" y="34" width="14" height="52" rx="2" fill="#1b3f8a"/>';
    s += '</g>';
    s += headerPinsSvg(def.pinPos.map(function (q) { return [q[0] + p.x, q[1] + p.y]; }));
    def.pins.forEach(function (pin, i) { var q = def.pinPos[i]; s += txt((p.x + q[0]) * U - 6, (p.y + q[1]) * U + 2, pin.n, 'hdr', ' text-anchor="end"'); });
    return s;
  };
  DRAW.seg7 = function (p) {
    var v = p.vis || {}, seg = v.seg || {};
    var s = pinDots(BB.PARTS.seg7.pinPos, '#c9cdd3');
    s += '<rect x="-9" y="-5.5" width="58" height="71" rx="2" fill="#2b2b2e" filter="url(#fShadow)"/>';
    var on = function (k) { return (seg[k] || 0) > 0.05; };
    var col = function (k) { return on(k) ? '#ff2a1a' : '#3d3333'; };
    var S = { a: 'M14 6 L36 6 L33 10 L17 10Z', b: 'M37 7 L40 10 L38 30 L34 27 L35.5 11Z', c: 'M37.5 33 L39.6 35 L38 56 L34.5 53 L35 37Z', d: 'M12 55 L33 55 L36 59 L9 59Z', e: 'M10 34 L13.5 37 L12 52 L8 55 L9.5 35Z', f: 'M12 9 L15 12 L13.5 27 L10 30 L11 11Z', g: 'M14 30 L33 30 L35 32 L32 35 L14 35 L12 32Z' };
    Object.keys(S).forEach(function (k) {
      if (on(k)) s += '<path d="' + S[k] + '" fill="#ff2a1a" opacity=".5" transform="translate(0 0) scale(1)" stroke="#ff5a3a" stroke-width="3"/>';
      s += '<path d="' + S[k] + '" fill="' + col(k) + '"/>';
    });
    s += '<circle cx="42" cy="58" r="2.4" fill="' + col('dp') + '"/>';
    return group(p, s);
  };
  DRAW.dht11 = function (p) {
    var s = pinDots(BB.PARTS.dht11.pinPos, '#c9cdd3');
    s += '<rect x="-6" y="-62" width="42" height="60" rx="2" fill="#3e98d6" filter="url(#fShadow)"/>';
    s += '<rect x="-2" y="-58" width="34" height="40" fill="url(#pGrid)"/>';
    s += txt(15, -8, 'DHT11', 'tiny', ' text-anchor="middle"');
    ['+', 'D', 'nc', '−'].forEach(function (l, i) { s += txt(i * U, 9, l, 'pinlbl dark', ' text-anchor="middle"'); });
    return group(p, s);
  };
  DRAW.hcsr04 = function (p) {
    var v = p.vis || {};
    var s = pinDots(BB.PARTS.hcsr04.pinPos);
    // the module stands up on its pins: seen from above it looks short
    s += '<g transform="translate(0 -2) scale(1 .5)">';
    s += '<rect x="-73" y="-82" width="176" height="80" rx="3" fill="#1d5fbe" filter="url(#fShadow)"/>';
    [-40, 70].forEach(function (cx) { s += '<circle cx="' + cx + '" cy="-46" r="31" fill="url(#gMetal)" stroke="#888"/><circle cx="' + cx + '" cy="-46" r="24" fill="url(#pMesh)"/>'; });
    s += '<rect x="5" y="-62" width="20" height="9" rx="4.5" fill="url(#gMetal)" stroke="#888" stroke-width=".4"/>';
    s += '</g>';
    s += txt(-40, -4, 'T', 'pinlbl', ' text-anchor="middle"') + txt(70, -4, 'R', 'pinlbl', ' text-anchor="middle"') + txt(15, -36, 'HC-SR04', 'tiny', ' text-anchor="middle"');
    ['Vcc', 'Trig', 'Echo', 'Gnd'].forEach(function (l, i) { s += txt(i * U, -4, l, 'pinlbl', ' text-anchor="middle"'); });
    if (v.pinging) s += '<g class="ping"><path d="M-40 -46 q 15 -8 30 0" stroke="#7fe0ff" stroke-width="2" fill="none"/><path d="M-52 -54 q 27 -12 54 0" stroke="#7fe0ff" stroke-width="2" fill="none"/></g>';
    return group(p, s);
  };
  DRAW.pir = function (p) {
    var v = p.vis || {}, def = BB.PARTS.pir;
    var x = p.x * U, y = p.y * U;
    var s = '<g transform="translate(' + x + ' ' + y + ')">';
    s += '<rect x="0" y="0" width="128" height="128" rx="5" fill="#2b7d3f" filter="url(#fShadow)"/>';
    s += '<circle cx="64" cy="60" r="50" fill="#f4f4f0" stroke="#d6d6cf"/>';
    for (var i = 0; i < 5; i++) s += '<circle cx="64" cy="60" r="' + (12 + i * 8) + '" fill="none" stroke="#e1e1da" stroke-width="1.4"/>';
    if (v.motion) s += '<circle cx="64" cy="60" r="54" fill="none" stroke="#ff6d3a" stroke-width="3" class="pulse"/>';
    s += '<rect x="26" y="118" width="70" height="14" fill="#111"/>';
    s += '</g>' + headerPinsSvg(def.pinPos.map(function (q) { return [q[0] + p.x, q[1] + p.y]; }));
    ['VCC', 'OUT', 'GND'].forEach(function (l, i) { var q = def.pinPos[i]; s += txt((p.x + q[0]) * U, (p.y + q[1]) * U + 11, l, 'hdr', ' text-anchor="middle"'); });
    return s;
  };
  DRAW.mic = function (p) {
    var v = p.vis || {};
    var s = pinDots(BB.PARTS.mic.pinPos);
    s += '<rect x="-10" y="-132" width="50" height="130" rx="3" fill="#b8202a" filter="url(#fShadow)"/>';
    s += '<circle cx="15" cy="-112" r="15" fill="url(#gMetal)" stroke="#777"/><circle cx="15" cy="-112" r="11" fill="#2b2b2b"/>';
    s += '<rect x="2" y="-80" width="26" height="22" rx="2" fill="#2f63d8"/><circle cx="21" cy="-75" r="3" fill="#e9c46a"/>';
    s += '<rect x="5" y="-48" width="20" height="14" rx="1" fill="#1a1a1a"/>';
    s += headerPinsSvg(BB.PARTS.mic.pinPos);
    ['AO', 'G', '+', 'DO'].forEach(function (l, i) { s += txt(i * U, -6, l, 'pinlbl', ' text-anchor="middle"'); });
    if (v.level > 0.6) s += '<g class="ping"><path d="M-6 -128 q-8 16 0 32 M-14 -134 q-12 22 0 44" stroke="#7fe0ff" stroke-width="2" fill="none"/></g>';
    return group(p, s);
  };
  DRAW.buzzer = function (p) {
    var v = p.vis || {};
    var s = pinDots(BB.PARTS.buzzer.pinPos, '#c9cdd3');
    s += '<circle cx="15" cy="0" r="23" fill="#151515" filter="url(#fShadow)"/><circle cx="15" cy="0" r="20" fill="#202020" stroke="#333"/><circle cx="15" cy="0" r="3.4" fill="#000"/>';
    s += txt(-1, -12, '+', 'pol');
    if (v.on) s += '<g class="ping"><circle cx="15" cy="0" r="27" fill="none" stroke="#7fe0ff" stroke-width="2"/><circle cx="15" cy="0" r="33" fill="none" stroke="#7fe0ff" stroke-width="1.4"/></g>';
    return group(p, s);
  };
  DRAW.speaker = function (p, pts) {
    var v = p.vis || {}, x = p.x * U, y = p.y * U;
    var s = '<g transform="translate(' + (x + 57) + ' ' + (y + 57) + ')">';
    s += '<circle r="57" fill="#2b2b2e" filter="url(#fShadow)"/><circle r="50" fill="url(#gMetal)"/><circle r="44" fill="#1b1b1d"/>';
    for (var i = 1; i < 4; i++) s += '<circle r="' + (i * 11) + '" fill="none" stroke="#2f2f33" stroke-width="1.5"/>';
    s += '<circle r="10" fill="#3a3a3e"/>';
    if (v.vib > 0.05) s += '<g class="ping"><circle r="62" fill="none" stroke="#7fe0ff" stroke-width="2"/><circle r="70" fill="none" stroke="#7fe0ff" stroke-width="1.4"/></g>';
    s += txt(0, 34, '8Ω 0.5W', 'tiny', ' text-anchor="middle"');
    s += '</g>';
    return s + leads(p, pts, ['#d8322b', '#222']);
  };

  BB.art = { U: U, defs: defs, board: board, DRAW: DRAW, esc: esc, shade: shade, BAND_RGB: BAND_RGB };
})();
