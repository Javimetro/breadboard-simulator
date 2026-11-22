// Breadboard geometry: holes, the metal strips that join them, and the power rails.
// Units: 1 = one hole pitch (2.54 mm). No DOM.
(function () {
  'use strict';
  var BB = (globalThis.BB = globalThis.BB || {});

  var ROWS_TOP = ['a', 'b', 'c', 'd', 'e'];
  var ROWS_BOT = ['f', 'g', 'h', 'i', 'j'];
  // y position of every row. The middle gap (e to f) is 3 pitches wide, like a real board,
  // so a chip fits across it.
  var ROW_Y = { 'T+': 0, 'T-': 1, a: 3, b: 4, c: 5, d: 6, e: 7, f: 10, g: 11, h: 12, i: 13, j: 14, 'B+': 16, 'B-': 17 };
  var RAILS = ['T+', 'T-', 'B+', 'B-'];

  // cols: 30 (half size, 400 points) or 63 (full size, 830 points).
  // split: on long boards some makers cut each rail in the middle.
  function makeBoard(opts) {
    opts = opts || {};
    var cols = opts.cols === 63 ? 63 : 30;
    var split = !!opts.split && cols === 63;
    var holes = [], byId = {}, byXY = {}, strips = {};
    function strip(key, info) { if (!strips[key]) { strips[key] = Object.assign({ key: key, holes: [] }, info); } return strips[key]; }
    function add(h) {
      holes.push(h); byId[h.id] = h; byXY[h.x + ',' + h.y] = h;
      strips[h.strip].holes.push(h.id);
    }
    for (var c = 1; c <= cols; c++) {
      strip('S' + c + 't', { dir: 'v', kind: 'term', label: 'Column ' + c + ', top half (a–e)' });
      strip('S' + c + 'b', { dir: 'v', kind: 'term', label: 'Column ' + c + ', bottom half (f–j)' });
      ROWS_TOP.forEach(function (r) { add({ id: r + c, x: c, y: ROW_Y[r], row: r, col: c, kind: 'term', strip: 'S' + c + 't' }); });
      ROWS_BOT.forEach(function (r) { add({ id: r + c, x: c, y: ROW_Y[r], row: r, col: c, kind: 'term', strip: 'S' + c + 'b' }); });
    }
    // Rails: groups of 5 holes, one empty space between groups.
    var railCols = [];
    for (var g = 2; g + 4 <= cols; g += 6) for (var k = 0; k < 5; k++) railCols.push(g + k);
    var mid = (cols + 1) / 2;
    RAILS.forEach(function (r) {
      var sign = r[1] === '+' ? '+' : '−';
      var side = r[0] === 'T' ? 'top' : 'bottom';
      railCols.forEach(function (c) {
        var half = split ? (c < mid ? 'L' : 'R') : '';
        var key = 'R' + r + half;
        strip(key, { dir: 'h', kind: 'rail', rail: r, label: (sign === '+' ? 'Red + rail' : 'Blue − rail') + ' (' + side + (half ? (half === 'L' ? ', left half' : ', right half') : '') + ')' });
        add({ id: r + c, x: c, y: ROW_Y[r], row: r, col: c, kind: 'rail', strip: key });
      });
    });
    var board = {
      cols: cols, split: split, holes: holes, byId: byId, strips: strips,
      railCols: railCols, splitX: split ? mid : null,
      // board body outline (pitch units)
      x0: -0.4, x1: cols + 1.4, y0: -1.3, y1: 18.3,
      holeAt: function (x, y) { return byXY[Math.round(x) + ',' + Math.round(y)] || null; },
      // nearest hole to a point within maxDist (pitch units)
      nearest: function (x, y, maxDist, filter) {
        var best = null, bd = maxDist * maxDist;
        var cx = Math.round(x), cy = Math.round(y);
        for (var dx = -2; dx <= 2; dx++) for (var dy = -2; dy <= 2; dy++) {
          var h = byXY[(cx + dx) + ',' + (cy + dy)];
          if (!h || (filter && !filter(h))) continue;
          var d = (h.x - x) * (h.x - x) + (h.y - y) * (h.y - y);
          if (d <= bd) { bd = d; best = h; }
        }
        return best;
      },
      label: function (id) {
        var h = byId[id]; if (!h) return id;
        if (h.kind === 'rail') return (h.row[1] === '+' ? '+' : '−') + ' rail ' + (h.row[0] === 'T' ? 'top' : 'bottom') + ', ' + h.col;
        return id;
      }
    };
    return board;
  }

  BB.board = { makeBoard: makeBoard, ROW_Y: ROW_Y, ROWS_TOP: ROWS_TOP, ROWS_BOT: ROWS_BOT, RAILS: RAILS };
  if (typeof module !== 'undefined' && module.exports) module.exports = BB.board;
})();
