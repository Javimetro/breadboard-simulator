// App shell: screens, level runner, tray, inspector, feedback, sound, saving.
(function () {
  'use strict';
  var BB = (globalThis.BB = globalThis.BB || {});
  var PARTS = BB.PARTS, LEVELS = BB.LEVELS, H = BB.levelHelpers;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var KEY = 'breadboard-lab.v1';

  // ---------- saved progress (never breaks the game) ----------
  var store = {
    data: null,
    load: function () { try { this.data = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { this.data = {}; } this.data.stars = this.data.stars || {}; return this.data; },
    save: function () { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* storage full or blocked: keep playing */ } }
  };

  // ---------- text helpers ----------
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  // {{term}} → a tappable word that shows its meaning
  function rich(s) {
    return esc(s).replace(/\{\{([^}|]+)(\|([^}]+))?\}\}/g, function (m, term, x, shown) {
      return '<button class="term" data-term="' + esc(term) + '">' + esc(shown || term) + '</button>';
    });
  }
  var ICON = {
    back: '<path d="M15 5l-7 7 7 7" />',
    move: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
    wire: '<path d="M5 19C5 9 19 15 19 5"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/>',
    parts: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><path d="M16.5 13.5v6M13.5 16.5h6"/>',
    undo: '<path d="M9 7H4V2"/><path d="M4 7a8 8 0 1 1-1 7"/>',
    bolt: '<path d="M13 2L5 14h6l-1 8 8-12h-6l1-8z"/>',
    xray: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/><path d="M9 9v4M13 9v4"/>',
    hint: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    sound: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
    mute: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    rotate: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    flip: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    board: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M6 14h.01M9 14h.01M12 14h.01M15 14h.01M18 14h.01"/>'
  };
  function icon(n, cls) { return '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + ICON[n] + '</svg>'; }
  BB.icon = icon;

  // ---------- sound (Web Audio) ----------
  var audio = {
    ctx: null, on: true, voices: {},
    init: function () { if (this.ctx || !this.on) return; try { var C = window.AudioContext || window.webkitAudioContext; if (C) this.ctx = new C(); } catch (e) { this.ctx = null; } },
    blip: function (f, dur, type, vol, slide) {
      if (!this.on || !this.ctx) return;
      try {
        var c = this.ctx, o = c.createOscillator(), g = c.createGain();
        o.type = type || 'sine'; o.frequency.value = f;
        if (slide) o.frequency.exponentialRampToValueAtTime(slide, c.currentTime + dur);
        g.gain.setValueAtTime(vol || 0.08, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
        o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + dur + 0.02);
      } catch (e) { /* audio is optional */ }
    },
    noise: function (dur, vol) {
      if (!this.on || !this.ctx) return;
      try {
        var c = this.ctx, n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
        for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
        var s = c.createBufferSource(), g = c.createGain(); g.gain.value = vol || 0.2;
        s.buffer = b; s.connect(g); g.connect(c.destination); s.start();
      } catch (e) { /* optional */ }
    },
    // continuous tones for buzzers and speakers: {id: {f, vol}}
    tones: function (want) {
      var self = this;
      Object.keys(this.voices).forEach(function (id) {
        if (!want[id] || !self.on) { try { self.voices[id].g.gain.setTargetAtTime(0, self.ctx.currentTime, 0.02); self.voices[id].o.stop(self.ctx.currentTime + 0.1); } catch (e) { /* ignore */ } delete self.voices[id]; }
      });
      if (!this.on || !this.ctx) return;
      Object.keys(want).forEach(function (id) {
        var w = want[id], v = self.voices[id];
        try {
          if (!v) {
            var o = self.ctx.createOscillator(), g = self.ctx.createGain();
            o.type = 'square'; o.frequency.value = w.f; g.gain.value = 0;
            o.connect(g); g.connect(self.ctx.destination); o.start();
            v = self.voices[id] = { o: o, g: g };
          }
          v.o.frequency.setTargetAtTime(w.f, self.ctx.currentTime, 0.01);
          v.g.gain.setTargetAtTime(0.03 * w.vol, self.ctx.currentTime, 0.02);
        } catch (e) { /* optional */ }
      });
    }
  };

  // ---------- the app ----------
  var app = {
    sim: null, bench: null, mode: null, level: null, undoStack: [],
    init: function () {
      store.load();
      audio.on = store.data.sound !== false;
      this.bench = new BB.Bench($('#bench'), this);
      this.buildChrome();
      this.showHome();
      var self = this, last = performance.now();
      var loop = function (now) {
        var dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000)); last = now;
        try { self.frame(dt); } catch (e) { if (window.console) console.error(e); }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      window.addEventListener('resize', function () { if (self.sim) self.bench.renderUi(); });
      document.addEventListener('pointerdown', function () { audio.init(); if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume(); }, true);
      document.addEventListener('keydown', function (e) {
        if (!self.sim || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
        if ((e.key === 'Delete' || e.key === 'Backspace') && self.bench.sel) { self.removePart(self.bench.sel, true); }
        if (e.key === 'z' && (e.ctrlKey || e.metaKey)) self.undo();
        if (e.key === 'Escape') { self.bench.wireStart = null; self.bench.select(null); self.setTool('move'); }
        if (e.key === 'w') self.setTool(self.bench.tool === 'wire' ? 'move' : 'wire');
      });
      document.body.addEventListener('click', function (e) {
        var t = e.target.closest('.term');
        if (t) { e.preventDefault(); e.stopPropagation(); self.showTerm(t); return; }
        if (!e.target.closest('#pop')) $('#pop').hidden = true;
      });
    },

    // ---------- chrome (static DOM) ----------
    buildChrome: function () {
      var self = this;
      $('#tb').innerHTML =
        '<button data-act="move" class="tool on" title="Move parts and the view">' + icon('move') + '<span>Move</span></button>' +
        '<button data-act="wire" class="tool" title="Draw jumper wires (W)">' + icon('wire') + '<span>Wire</span></button>' +
        '<button data-act="parts" class="partsbtn" title="Parts">' + icon('parts') + '<span>Parts</span></button>' +
        '<button data-act="undo" title="Undo (Ctrl+Z)">' + icon('undo') + '<span>Undo</span></button>' +
        '<button data-act="flow" class="tg" title="Show the current flow and the voltages">' + icon('bolt') + '<span>Flow</span></button>' +
        '<button data-act="xray" class="tg" title="See the metal strips inside">' + icon('xray') + '<span>X-ray</span></button>';
      $('#tb').addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        var a = b.dataset.act;
        if (a === 'move' || a === 'wire') self.setTool(a);
        if (a === 'parts') document.body.classList.toggle('trayopen');
        if (a === 'undo') self.undo();
        if (a === 'flow') self.setFlow(!self.bench.showFlow);
        if (a === 'xray') self.setXray(!self.bench.xray);
      });
      $('#zoom').innerHTML = '<button data-z="in" title="Zoom in">' + icon('plus') + '</button><button data-z="out" title="Zoom out">' + icon('minus') + '</button><button data-z="fit" title="Fit">' + icon('fit') + '</button>';
      $('#zoom').addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        var sz = self.bench.size();
        if (b.dataset.z === 'in') self.bench.zoomAt(sz.left + sz.w / 2, sz.top + sz.h / 2, 1.35);
        if (b.dataset.z === 'out') self.bench.zoomAt(sz.left + sz.w / 2, sz.top + sz.h / 2, 1 / 1.35);
        if (b.dataset.z === 'fit') self.fitView();
        self.bench.renderUi();
      });
      $('#topbar').addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        if (b.dataset.act === 'home') self.showHome();
        if (b.dataset.act === 'hint') self.hint();
        if (b.dataset.act === 'sound') self.toggleSound();
        if (b.dataset.act === 'info') self.showIntro(self.level.def, true);
        if (b.dataset.act === 'board') self.boardMenu();
        if (b.dataset.act === 'clear') self.clearSandbox();
        if (b.dataset.act === 'chal') self.modal('<div class="chmodal">' + $('#goal').innerHTML + '</div><div class="mbtns"><button data-m="x">Close</button></div>');
      });
      $('#tray').addEventListener('click', function (e) {
        var b = e.target.closest('.titem'); if (!b) return;
        var spec = JSON.parse(b.dataset.spec);
        if (spec.type === 'wire') { self.setTool('wire'); document.body.classList.remove('trayopen'); return; }
        self.placeNew(spec.type, spec.props || {});
        document.body.classList.remove('trayopen');
      });
      $('#banner').addEventListener('click', function () { $('#banner').classList.toggle('open'); });
    },
    setTool: function (t) {
      this.bench.tool = t; this.bench.wireStart = null;
      document.querySelectorAll('#tb .tool').forEach(function (b) { b.classList.toggle('on', b.dataset.act === t); });
      document.body.classList.toggle('wiretool', t === 'wire');
      if (t === 'wire') this.toast('Wire: tap a hole, then another hole. Or drag from hole to hole.', 'info');
      this.bench.renderUi();
    },
    setFlow: function (on) { this.bench.showFlow = on; $('#tb [data-act=flow]').classList.toggle('on', on); if (on) this.toast('Moving dots show the current (from + to −). Tags show the voltage at each point.', 'info'); this.bench.renderFlow(); },
    setXray: function (on) { this.bench.xray = on; $('#tb [data-act=xray]').classList.toggle('on', on); this.bench.renderBoard(); if (this.mode === 'level' && this.level && this.level.ready) this.checkLevel(); },
    toggleSound: function () { audio.on = !audio.on; store.data.sound = audio.on; store.save(); if (!audio.on) audio.tones({}); else audio.init(); this.updateTop(); },

    // ---------- screens ----------
    show: function (id) { document.querySelectorAll('.screen').forEach(function (s) { s.hidden = s.id !== id; }); },
    showHome: function () {
      var self = this;
      audio.tones({});
      this.mode = null; this.level = null; this.sim = null;
      this.show('home');
      var stars = store.data.stars, unlocked = 1;
      LEVELS.forEach(function (l, i) { if (stars[l.id]) unlocked = Math.max(unlocked, i + 2); });
      if (store.data.unlockAll) unlocked = 99;
      var total = 0; Object.keys(stars).forEach(function (k) { total += stars[k]; });
      $('#levels').innerHTML = LEVELS.map(function (l, i) {
        var st = stars[l.id] || 0, locked = i + 1 > unlocked;
        return '<button class="lvl' + (locked ? ' locked' : '') + (st ? ' done' : '') + '" data-i="' + i + '" ' + (locked ? 'aria-disabled="true"' : '') + '>' +
          '<span class="ln">' + (i + 1) + '</span><span class="lic">' + levelIcon(l.icon) + '</span><span class="lt">' + esc(l.title) + '</span>' +
          '<span class="ls">' + [1, 2, 3].map(function (k) { return icon('star', k <= st ? 'on' : ''); }).join('') + '</span>' + (locked ? '<span class="lk">' + icon('lock') + '</span>' : '') + '</button>';
      }).join('');
      $('#score').textContent = total + ' / 36';
      $('#levels').onclick = function (e) {
        var b = e.target.closest('.lvl'); if (!b) return;
        if (b.classList.contains('locked')) { self.toast('Finish the level before it first, or turn on “Unlock all levels” below.', 'info'); return; }
        self.startLevel(+b.dataset.i);
      };
      $('#sandboxBtn').onclick = function () { self.startSandbox(); };
      $('#unlockAll').checked = !!store.data.unlockAll;
      $('#unlockAll').onchange = function () { store.data.unlockAll = this.checked; store.save(); self.showHome(); };
      $('#soundHome').checked = audio.on;
      $('#soundHome').onchange = function () { audio.on = this.checked; store.data.sound = audio.on; store.save(); };
      $('#resetAll').onclick = function () {
        self.confirm('Reset all progress? Your stars and your sandbox will be deleted.', 'Reset', function () { store.data = { stars: {}, sound: audio.on }; store.save(); self.showHome(); });
      };
    },
    showIntro: function (def, again) {
      var self = this;
      this.show('intro');
      $('#introNum').textContent = 'Level ' + def.n + ' of ' + LEVELS.length;
      $('#introTitle').textContent = def.title;
      $('#introPic').innerHTML = '<svg viewBox="0 0 320 180" class="ipic">' + def.intro.pic() + '</svg>';
      $('#introText').innerHTML = rich(def.intro.text);
      $('#introGo').textContent = again ? 'Back to the level' : 'Start';
      $('#introGo').onclick = function () { if (again) { self.show('play'); self.bench.renderUi(); } else self.beginLevel(def); };
      $('#introBack').onclick = function () { self.showHome(); };
    },

    // ---------- levels ----------
    startLevel: function (i) { this.showIntro(LEVELS[i]); },
    beginLevel: function (def) {
      this.mode = 'level';
      this.level = { def: def, step: 0, flags: {}, hints: 0, mistakes: 0, done: false, msgs: {}, stepFlags: {}, issueSeen: {} };
      var state = { board: Object.assign({}, def.board), parts: [] };
      this.sim = new BB.Sim(state);
      this.undoStack = [];
      this.show('play');
      document.body.classList.add('levelmode'); document.body.classList.remove('sandmode', 'trayopen');
      this.bench.setSim(this.sim);
      this.setFlow(false); this.setXray(false); this.setTool('move');
      var A = this.actions();
      if (def.setup) def.setup(A);
      this.sim.step(0.001);
      this.level.baseline = {};
      var self = this;
      this.sim.res.issues.forEach(function (is) { self.level.baseline[is.kind] = true; });
      this.sim.events = [];
      this.level.ready = true;
      this.buildTray(def.tray);
      this.updateTop();
      this.renderGoal();
      this.fitView();
      this.bench.render(true);
      this.onSelect(null);
      if (!store.data.tipShown) {
        store.data.tipShown = true; store.save();
        this.toast(window.innerWidth < 1100 ? 'Tip: pinch with two fingers to zoom. Drag an empty spot to move the view.' : 'Tip: scroll to zoom. Drag an empty spot to move the view.', 'info');
      }
    },
    fitView: function () {
      if (this.mode === 'level' && this.level.def.view) {
        var v = this.level.def.view, b = this.sim.board, bench = this.bench;
        var mobile = window.innerWidth < 1100, g = $('#goal');
        var top = mobile && g.offsetHeight ? g.offsetHeight + 12 : 0, right = mobile ? 54 : 54;
        bench.fitRect(v[0], v[1], v[2], v[3], 8, top, right);
        var s0 = bench.view.s;
        // on wide screens show the whole board too, if that does not shrink things much
        var u = [Math.min(v[0], b.x0 - 1), Math.min(v[1], b.y0 - 1), Math.max(v[2], b.x1 + 1), Math.max(v[3], b.y1 + 1)];
        bench.fitRect(u[0], u[1], u[2], u[3], 8, top, right);
        if (bench.view.s < s0 * 0.75) bench.fitRect(v[0], v[1], v[2], v[3], 8, top, right);
      } else this.bench.fitAll();
    },
    L: function () {
      var sim = this.sim, lv = this.level, bench = this.bench;
      var nets = sim._nets || sim.nets();
      var L = {
        sim: sim, flags: lv.flags, xray: bench.xray, stepIndex: lv.step,
        of: function (t) { return sim.state.parts.filter(function (p) { return p.type === t; }); },
        part: function (id) { return sim.part(id); },
        net: function (p, k) { var ks = nets.keys[p.id]; if (!ks || !ks[k] || ks[k][0] === 'F') return null; return nets.find(ks[k]); },
        pinV: function (p, k) { var ks = nets.keys[p.id]; if (!ks || !sim.res) return 0; var v = sim.res.keyV[ks[k]]; return v === undefined ? 0 : v; },
        hnet: function (h) { var o = sim.board.byId[h]; return o ? nets.find('H:' + o.strip) : null; },
        connected: function (a, b) { return L.hnet(a) === L.hnet(b); },
        connectedTo: function (p, k, h) { return L.net(p, k) !== null && L.net(p, k) === L.hnet(h); },
        alone: function (p, k) {
          var n = L.net(p, k); if (n === null) return true;
          var count = 0;
          sim.state.parts.forEach(function (q) { (nets.keys[q.id] || []).forEach(function (key, j) { if ((q !== p || j !== k) && key[0] !== 'F' && nets.find(key) === n) count++; }); });
          return count === 0;
        }
      };
      return L;
    },
    checkLevel: function () {
      var lv = this.level;
      if (!lv || !lv.ready) return;
      // several steps may already be true at once (e.g. both rails joined): check again after each
      for (var guard = 0; guard < 10 && lv && !lv.done; guard++) {
        var step = lv.def.steps[lv.step];
        if (!step || !step.check) return;
        var ok = false;
        try { ok = step.check(this.L()); } catch (e) { ok = false; if (window.console) console.error(e); }
        if (!ok) return;
        this.stepDone(step.ok);
      }
    },
    stepDone: function (msg) {
      var lv = this.level;
      lv.step++;
      audio.blip(880, 0.12, 'sine', 0.06); setTimeout(function () { audio.blip(1320, 0.18, 'sine', 0.05); }, 90);
      if (lv.step >= lv.def.steps.length) { this.finishLevel(); return; }
      this.toast('✓ ' + (msg || 'Done!'), 'good');
      this.renderGoal();
    },
    finishLevel: function () {
      var lv = this.level, self = this;
      lv.done = true;
      var stars = 3 - (lv.hints > 0 ? 1 : 0) - (lv.mistakes + (lv.wrong || 0) > 0 ? 1 : 0);
      stars = Math.max(1, stars);
      var prev = store.data.stars[lv.def.id] || 0;
      store.data.stars[lv.def.id] = Math.max(prev, stars); store.save();
      lv.stars = stars;
      this.renderGoal();
      [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { audio.blip(f, 0.2, 'triangle', 0.06); }, i * 110); });
      var next = LEVELS[lv.def.n];
      var why = [];
      if (lv.hints) why.push('you used ' + lv.hints + ' hint' + (lv.hints > 1 ? 's' : ''));
      if (lv.mistakes) why.push('something burned or shorted ' + lv.mistakes + ' time' + (lv.mistakes > 1 ? 's' : ''));
      if (lv.wrong) why.push('you gave ' + lv.wrong + ' wrong answer' + (lv.wrong > 1 ? 's' : ''));
      setTimeout(function () {
        self.modal('<div class="done"><div class="bigstars">' + [1, 2, 3].map(function (k) { return '<span style="animation-delay:' + (k * 0.18) + 's">' + icon('star', k <= stars ? 'on' : '') + '</span>'; }).join('') + '</div>' +
          '<h2>Level ' + lv.def.n + ' done!</h2><p class="learned">' + rich(lv.def.done) + '</p>' +
          (stars < 3 ? '<p class="mut small">3 stars: no hints, no burned parts and no wrong answers. This time ' + why.join(' and ') + '.</p>' : '') +
          '<div class="mbtns">' + (next ? '<button class="primary" data-m="next">Next level</button>' : '<button class="primary" data-m="sand">Open the sandbox</button>') +
          '<button data-m="stay">Stay here</button><button data-m="home">All levels</button></div></div>', function (a) {
          if (a === 'next') self.startLevel(lv.def.n);
          if (a === 'home') self.showHome();
          if (a === 'sand') self.startSandbox();
        });
      }, 450);
    },
    renderGoal: function () {
      var lv = this.level, def = lv.def, self = this;
      var html = '<div class="ghead"><span class="gnum">Level ' + def.n + '</span><h2>' + esc(def.title) + '</h2><button class="ibtn" data-act="info" title="Watch the intro again">' + icon('info') + '</button></div>';
      html += '<ol class="steps">' + def.steps.map(function (s, i) {
        var cls = i < lv.step ? 'done' : i === lv.step && !lv.done ? 'cur' : 'todo';
        return '<li class="' + cls + '"><span class="sn">Step ' + (i + 1) + ' of ' + def.steps.length + '</span>' + rich(s.text) + '</li>';
      }).join('') + '</ol>';
      var step = def.steps[lv.step];
      if (step && step.choices && !lv.done) {
        html += '<div class="choices">' + step.choices.map(function (c, i) { return '<button data-c="' + i + '">' + esc(c.label) + '</button>'; }).join('') + '</div>';
      }
      html += '<div id="why" class="why" hidden></div>';
      if (!lv.done) {
        var left = def.hints.length - lv.hints;
        html += '<div class="hints">' + def.hints.slice(0, lv.hints).map(function (h, i) { return '<p class="hint"><b>Hint ' + (i + 1) + ':</b> ' + rich(h) + '</p>'; }).join('') + '</div>';
        html += left > 0 ? '<button class="hintbtn" data-act="hint">' + icon('hint') + ' Hint <span class="mut">(' + left + ' left)</span></button>' : '';
      } else html += '<p class="goodtxt">' + icon('star', 'on') + ' Level complete! ' + rich(def.done) + '</p><button class="primary" data-act="next">' + (LEVELS[def.n] ? 'Next level' : 'Open the sandbox') + '</button>';
      $('#goal').innerHTML = html;
      $('#goal').onclick = function (e) {
        var b = e.target.closest('button'); if (!b || b.classList.contains('term')) return;
        if (b.dataset.c !== undefined) self.choose(+b.dataset.c);
        if (b.dataset.act === 'hint') self.hint();
        if (b.dataset.act === 'info') self.showIntro(def, true);
        if (b.dataset.act === 'next') { if (LEVELS[def.n]) self.startLevel(def.n); else self.startSandbox(); }
      };
      $('#goal').classList.remove('collapsed');
      this.updateTop();
    },
    choose: function (i) {
      var lv = this.level, step = lv.def.steps[lv.step];
      if (!step || !step.choices) return;
      var c = step.choices[i];
      if (c.ok) this.stepDone(c.why);
      else { lv.wrong = (lv.wrong || 0) + 1; this.toast(c.why, 'bad'); audio.blip(220, 0.18, 'sawtooth', 0.04); }
    },
    hint: function () {
      var lv = this.level; if (!lv || lv.done) return;
      if (lv.hints < lv.def.hints.length) lv.hints++;
      this.renderGoal();
      document.body.classList.add('goalopen');
    },
    onTapHole: function (h, onPart) {
      if (this.mode !== 'level') return;
      var lv = this.level, step = lv.def.steps[lv.step];
      if (!step || !step.tap || lv.done) return;
      var r = step.tap(this.L(), h);
      if (r.ok) this.stepDone(r.msg); else { if (r.wrong !== false && !onPart) lv.wrong = (lv.wrong || 0) + (r.count ? 1 : 0); this.toast(r.msg, 'bad'); audio.blip(220, 0.15, 'sawtooth', 0.035); }
    },
    updateTop: function () {
      var t = $('#topbar');
      var title = this.mode === 'level' ? 'Level ' + this.level.def.n + ': ' + esc(this.level.def.title) : 'Sandbox';
      var html = '<button data-act="home" class="ibtn" title="All levels">' + icon('back') + '</button><div class="ttl">' + title + '</div>';
      if (this.mode === 'level') html += '<button data-act="hint" class="ibtn" title="Hint">' + icon('hint') + '</button>';
      if (this.mode === 'sandbox') html += '<button data-act="chal" class="ibtn chalbtn" title="Challenges">' + icon('star') + '</button><button data-act="board" class="ibtn" title="Board size">' + icon('board') + '</button><button data-act="clear" class="ibtn" title="Clear the bench">' + icon('trash') + '</button>';
      html += '<button data-act="sound" class="ibtn" title="Sound on/off">' + icon(audio.on ? 'sound' : 'mute') + '</button>';
      t.innerHTML = html;
    },

    // ---------- sandbox ----------
    startSandbox: function () {
      this.mode = 'sandbox'; this.level = null;
      var saved = store.data.sandbox;
      var state = saved && saved.parts ? saved : { board: { cols: 30 }, parts: [] };
      state.parts.forEach(function (p) { p.st = p.st || {}; });
      this.sim = new BB.Sim(state);
      this.undoStack = [];
      this.show('play');
      document.body.classList.add('sandmode'); document.body.classList.remove('levelmode', 'trayopen', 'goalopen');
      this.bench.setSim(this.sim);
      this.setFlow(false); this.setXray(false); this.setTool('move');
      this.buildTray(null);
      this.updateTop();
      this.renderChallenges();
      this.sim.step(0.001);
      this.fitView();
      this.bench.render(true);
      this.onSelect(null);
      if (!state.parts.length) this.toast('Tap “Parts” to add components. Start with a battery or the MB102 power board.', 'info');
    },
    renderChallenges: function () {
      var done = store.data.challenges || {}, self = this;
      var html = '<div class="ghead"><h2>Sandbox</h2></div><p class="small">Every part is here. Build anything! Tap a part to see its values. Tap a hole to see what is connected to it.</p>';
      html += '<h4 class="chh">Try these</h4><ul class="chal">' + CHALLENGES.map(function (c) {
        return '<li class="' + (done[c.id] ? 'done' : '') + '"><span class="ck">' + (done[c.id] ? '✓' : '') + '</span><span><b>' + esc(c.title) + '</b> ' + rich(c.text) + '</span></li>';
      }).join('') + '</ul>';
      $('#goal').innerHTML = html;
      $('#goal').onclick = null;
    },
    checkChallenges: function () {
      if (this.mode !== 'sandbox' || !this.sim.res) return;
      var done = store.data.challenges = store.data.challenges || {}, self = this, changed = false;
      var L = this.L.call({ sim: this.sim, level: { flags: this._chFlags = this._chFlags || {}, step: 0 }, bench: this.bench });
      CHALLENGES.forEach(function (c) {
        if (done[c.id]) return;
        var ok = false; try { ok = c.check(L, self._chFlags[c.id] = self._chFlags[c.id] || {}); } catch (e) { ok = false; }
        if (ok) { done[c.id] = true; changed = true; self.toast('✓ Challenge done: ' + c.title, 'good'); audio.blip(880, 0.12, 'sine', 0.06); }
      });
      if (changed) { store.save(); this.renderChallenges(); }
    },
    saveSandbox: function () {
      if (this.mode !== 'sandbox') return;
      var self = this;
      clearTimeout(this._saveT);
      this._saveT = setTimeout(function () { store.data.sandbox = JSON.parse(self.serialize()); store.save(); }, 400);
    },
    boardMenu: function () {
      var self = this, b = this.sim.state.board;
      this.modal('<h2>Board</h2><div class="mbtns col">' +
        '<button data-m="30"' + (b.cols === 30 ? ' class="primary"' : '') + '>Half size: 400 holes</button>' +
        '<button data-m="63"' + (b.cols === 63 && !b.split ? ' class="primary"' : '') + '>Full size: 830 holes</button>' +
        '<button data-m="63s"' + (b.cols === 63 && b.split ? ' class="primary"' : '') + '>Full size, rails split in the middle</button>' +
        '<button data-m="x">Cancel</button></div>', function (a) {
        if (a === 'x' || !a) return;
        var u = self.snapshot();
        var cfg = a === '30' ? { cols: 30 } : { cols: 63, split: a === '63s' };
        var nb = BB.board.makeBoard(cfg);
        self.sim.state.parts.forEach(function (p) { if (p.ends) p.ends = p.ends.map(function (e) { if (e.at && e.at.slice(0, 2) !== 'P:' && !nb.byId[e.at]) { var pos = self.sim.endPos(e); return { x: pos.x, y: pos.y }; } return e; }); });
        self.sim.setBoard(cfg);
        var lifted = 0;
        self.sim.state.parts.forEach(function (p) {
          if (PARTS[p.type].kind !== 'rigid' || p.free) return;
          if (self.sim.pinPoints(p).some(function (q) { return !q.at; })) { p.free = true; lifted++; }
        });
        if (lifted) self.toast(lifted + ' part' + (lifted > 1 ? 's do' : ' does') + ' not fit on the smaller board. ' + (lifted > 1 ? 'They are' : 'It is') + ' lifted off: drag ' + (lifted > 1 ? 'them' : 'it') + ' back onto the board.', 'info');
        self.commit(u);
        self.bench.renderBoard(); self.bench.render(true); self.fitView();
      });
    },
    clearSandbox: function () {
      var self = this;
      this.confirm('Remove all parts from the bench?', 'Clear', function () { var u = self.snapshot(); self.sim.state.parts = []; self.bench.select(null); self.commit(u); self.bench.render(true); });
    },

    // ---------- tray ----------
    buildTray: function (items) {
      var list = items;
      if (!list) list = ['wire', 'led', 'resistor', 'button', 'pot', 'capacitor', 'battery9', 'aa', 'mb102', 'meter', 'nano', 'esp32', 'pi5', 'wio', 'ldr', 'dht11', 'hcsr04', 'pir', 'mic', 'oled', 'lcd', 'seg7', 'buzzer', 'speaker'];
      var cats = { basic: 'Basics', power: 'Power', tools: 'Tools', boards: 'Boards', sensors: 'Sensors', modules: 'Displays', sound: 'Sound' };
      var groups = {};
      list.forEach(function (it) {
        var spec = typeof it === 'string' ? { type: it } : it;
        var def = PARTS[spec.type];
        (groups[def.cat] = groups[def.cat] || []).push(spec);
      });
      var html = '<div class="trayhead"><b>Parts</b><span class="mut small">Tap to add</span><button class="ibtn closetray" title="Close">' + icon('close') + '</button></div>';
      if (!list.length) html += '<p class="small mut">No parts needed here. Just tap the holes.</p>';
      Object.keys(cats).forEach(function (c) {
        if (!groups[c]) return;
        if (!items) html += '<h4>' + cats[c] + '</h4>';
        html += '<div class="tgrid">' + groups[c].map(function (spec) {
          var def = PARTS[spec.type];
          var label = def.name;
          if (spec.type === 'resistor' && spec.props) label = 'Resistor ' + BB.fmt.R(spec.props.r);
          if (spec.type === 'led' && spec.props) label = BB.engine.LED_TYPES[spec.props.color].label + ' LED';
          return '<button class="titem" data-spec=\'' + esc(JSON.stringify(spec)) + '\'><span class="tpic">' + trayPic(spec) + '</span><span class="tl">' + esc(label) + '</span></button>';
        }).join('') + '</div>';
      });
      $('#tray').innerHTML = html;
      $('#tray .closetray').onclick = function (e) { e.stopPropagation(); document.body.classList.remove('trayopen'); };
      document.body.classList.toggle('notray', !list.length);
    },

    // ---------- placing parts ----------
    placeNew: function (type, props) {
      var def = PARTS[type], sim = this.sim, bench = this.bench;
      var u = this.snapshot();
      var sz = bench.size(), mobile = window.innerWidth < 1100;
      var c = bench.toWorld(sz.left + sz.w / 2, sz.top + (mobile ? sz.h * 0.4 : sz.h / 2));
      var occ = sim.occupancy(), cov = sim.covered(), b = sim.board;
      var free = function (id) { return id && b.byId[id] && !occ[id] && !cov[id]; };
      var p = null;
      var byDist = b.holes.filter(function (h) { return h.kind === 'term'; }).sort(function (a, d) { return Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(d.x - c.x, d.y - c.y); });
      if (def.kind === 'leads') {
        var span = { led: 1, resistor: 4, capacitor: 1, ldr: 2 }[type] || 2;
        for (var i = 0; i < byDist.length && !p; i++) {
          var h = byDist[i], h2 = b.byId[h.row + (h.col + span)];
          if (free(h.id) && free(h2 && h2.id)) p = BB.newPart(type, { props: props, ends: [h.id, h2.id] });
        }
      } else if (def.kind === 'rigid') {
        var pref = { button: [7], nano: [5, 4, 6, 7], esp32: [4, 5, 6], seg7: [5, 4, 6, 7], mb102: [0] }[type] || [3, 10, 4, 11];
        var cands = [];
        for (var x = 1; x <= b.cols; x++) pref.forEach(function (y, pi) { cands.push({ x: x, y: y, d: Math.abs(x - c.x) + pi * 4 }); });
        if (type === 'mb102') cands = [{ x: 2, y: 0, d: 0 }];
        cands.sort(function (a, d) { return a.d - d.d; });
        for (var k = 0; k < cands.length && !p; k++) {
          var cd = cands[k];
          var test = BB.newPart(type, { props: props, x: cd.x, y: cd.y });
          var pts = sim.pinPoints(test);
          if (pts.every(function (q) { return free(q.at); })) p = test;
        }
        if (!p) p = BB.newPart(type, { props: props, x: b.x1 + 4, y: 2, free: true });
      } else {
        // modules and off-board parts go next to the board
        var spot = this.freeSpot(def);
        p = BB.newPart(type, { props: props, x: spot.x, y: spot.y });
        if (def.kind === 'module') {
          var lf = def.leadFrom;
          p.ends = lf.map(function (q, k2) { return { x: spot.x + q[0] + 3, y: spot.y + q[1] + (type === 'meter' ? 6 + k2 * 0 : 0) }; });
          if (type === 'meter') p.ends = [{ x: spot.x + 5, y: spot.y + 30 }, { x: spot.x + 10, y: spot.y + 30 }];
          var railsUsed = b.holes.some(function (h) { return h.kind === 'rail' && occ[h.id]; });
          if ((type === 'battery9' || type === 'aa') && !railsUsed) {
            var plus = b.holes.filter(function (h) { return h.row === 'T+' && free(h.id); })[0], minus = b.holes.filter(function (h) { return h.row === 'T-' && free(h.id); })[0];
            if (plus && minus) p.ends = [{ at: plus.id }, { at: minus.id }];
          }
        }
      }
      if (type === 'wire' && !p.props.color) p.props.color = 'red';
      sim.state.parts.push(p);
      sim.dirty();
      this.commit(u);
      bench.select(p.id);
      bench.render();
      this.ensureVisible(p);
      if (!this._addedTip) { this._addedTip = true; this.toast('Added. Drag it into place. Drag a leg end to move just that leg.', 'info'); }
      return p;
    },
    freeSpot: function (def) {
      var sim = this.sim, b = sim.board, rects = sim.state.parts.map(function (p) { return sim.bodyRect(p); });
      rects.push({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 });
      var w = def.size[0], h = def.size[1];
      var tries = [];
      for (var k = 0; k < 12; k++) { tries.push({ x: b.x0 + k * (w + 2), y: b.y1 + 3 }); }
      for (var k2 = 0; k2 < 6; k2++) { tries.push({ x: b.x0 - w - 3, y: b.y0 + k2 * (h + 2) }); tries.push({ x: b.x1 + 3, y: b.y0 + k2 * (h + 2) }); }
      for (var j = 0; j < tries.length; j++) {
        var t = tries[j];
        var hit = rects.some(function (r) { return t.x < r.x1 + 1 && t.x + w > r.x0 - 1 && t.y < r.y1 + 1 && t.y + h > r.y0 - 1; });
        if (!hit) return { x: Math.round(t.x), y: Math.round(t.y) };
      }
      return { x: Math.round(b.x0), y: Math.round(b.y1 + 3) };
    },
    // Pan (without zooming) so a part is in the free part of the screen: below the goal card
    // and above the bottom sheet on phones.
    ensureVisible: function (p) {
      var r = this.sim.bodyRect(p), bench = this.bench, sz = bench.size();
      var mobile = window.innerWidth < 1100;
      var top = 8, bottom = sz.h - 8;
      if (mobile) {
        var g = $('#goal'); if (g && g.offsetParent && document.body.classList.contains('levelmode')) top = g.offsetTop + g.offsetHeight + 8;
        if (document.body.classList.contains('hassel')) bottom = sz.h * 0.62;
      }
      var a = bench.toScreen(r.x0, r.y0), z = bench.toScreen(r.x1, r.y1);
      if (z.x - a.x > sz.w - 60 || z.y - a.y > bottom - top) { if (!mobile) bench.fitAll(); return; }
      var dx = 0, dy = 0;
      if (a.x < 8) dx = 8 - a.x; else if (z.x > sz.w - 60) dx = sz.w - 60 - z.x;
      if (a.y < top) dy = top - a.y; else if (z.y > bottom) dy = bottom - z.y;
      if (dx || dy) { bench.view.tx += dx; bench.view.ty += dy; bench.applyView(); bench.renderUi(); }
    },
    addWire: function (a, b) {
      var u = this.snapshot();
      var col = 'auto';
      var isRail = function (x, s) { return x && x.slice(0, 2) === 'T' + s || x && x.slice(0, 2) === 'B' + s; };
      if (isRail(a, '+') || isRail(b, '+')) col = 'red';
      else if (isRail(a, '-') || isRail(b, '-')) col = 'black';
      else { var cyc = ['blue', 'green', 'yellow', 'orange', 'purple', 'white']; col = cyc[this.bench.wireColorIdx++ % cyc.length]; }
      var w = BB.newPart('wire', { props: { color: col }, ends: [a, b] });
      this.sim.state.parts.push(w);
      this.sim.dirty();
      this.commit(u);
      audio.blip(660, 0.05, 'square', 0.02);
      this.bench.render();
      return w;
    },
    removePart: function (id, user) {
      var p = this.sim.part(id); if (!p) return;
      if (p.locked && user) { this.toast('This part is fixed in this level.', 'info'); return; }
      var u = user ? this.snapshot() : null;
      var sim = this.sim;
      // wires plugged into an off-board part's pins come loose
      sim.state.parts.forEach(function (q) { if (q.ends) q.ends.forEach(function (e) { if (e.at && e.at.indexOf('P:' + id + ':') === 0) { var pos = sim.endPos(e); delete e.at; e.x = pos.x; e.y = pos.y + 1; } }); });
      sim.state.parts = sim.state.parts.filter(function (q) { return q.id !== id; });
      if (this.bench.sel === id) this.bench.select(null);
      sim.dirty();
      if (u) this.commit(u);
      this.bench.render();
    },

    // ---------- undo / save ----------
    serialize: function () {
      return JSON.stringify(this.sim.state, function (k, v) { if (k && (k[0] === '_' || k === 'vis' || k === 'lastV' || k === 'pinI' || k === 'io')) return undefined; return v; });
    },
    snapshot: function () { return this.serialize(); },
    commit: function (before) {
      if (!before) return;
      this.undoStack.push(before);
      if (this.undoStack.length > 60) this.undoStack.shift();
      this.sim.dirty();
      this.saveSandbox();
    },
    undo: function () {
      var s = this.undoStack.pop();
      if (!s) { this.toast('Nothing to undo.', 'info'); return; }
      var st = JSON.parse(s);
      st.parts.forEach(function (p) { p.st = p.st || {}; });
      this.sim.state.parts = st.parts;
      if (st.board.cols !== this.sim.board.cols || !!st.board.split !== !!this.sim.board.split) { this.sim.setBoard(st.board); this.bench.renderBoard(); }
      this.sim.dirty();
      this.bench.select(null);
      this.bench.render(true);
      this.saveSandbox();
    },

    // ---------- inspector ----------
    showSheet: function () { document.body.classList.add('hassel'); var sp = this.bench.sel && this.sim.part(this.bench.sel); if (sp && window.innerWidth < 1100) this.ensureVisible(sp); },
    onSelect: function (id, quiet) {
      var ins = $('#inspector'), self = this;
      if (id !== this._lastSel) document.body.classList.remove('insfull');
      this._lastSel = id;
      document.body.classList.toggle('hassel', !!id && !quiet);
      if (id && !quiet && window.innerWidth < 1100) { var sp = this.sim.part(id); if (sp) this.ensureVisible(sp); }
      if (!id) {
        ins.innerHTML = '<p class="mut small empty">' + icon('info') + ' Tap a part to see its values here. Tap a hole to see what is connected to it.</p>';
        return;
      }
      var p = this.sim.part(id), def = PARTS[p.type];
      var lock = this.mode === 'level' ? (this.level.def.lock || []) : [];
      var html = '<div class="ihead"><h3>' + esc(def.name) + '</h3><button class="ibtn closeins" title="Close">' + icon('close') + '</button></div><p class="desc">' + rich(def.desc) + '</p>';
      html += '<div class="vals" id="vals"></div>';
      html += '<div class="acts" id="acts"></div>';
      html += '<button class="insmore" data-a="more">' + (document.body.classList.contains('insfull') ? 'Show less ▾' : 'More ▴') + '</button>';
      var ctrls = '';
      (def.props || []).forEach(function (pr) {
        var locked = (p.locked && !pr.env && ['top', 'bottom', 'on', 'mode', 'pos', 'usb'].indexOf(pr.k) < 0) || lock.indexOf(pr.k) >= 0;
        if (pr.k === 'pcb' || pr.k === 'shell') locked = false;
        var v = p.props[pr.k];
        ctrls += '<label class="ctl"><span>' + esc(pr.label) + '</span>';
        if (locked) ctrls += '<b>' + esc(pr.labels ? pr.labels[pr.options.indexOf(v)] : (pr.fmt ? pr.fmt(v) : v)) + '</b>';
        else if (pr.type === 'select') ctrls += '<select data-k="' + pr.k + '">' + pr.options.map(function (o, i) { return '<option value="' + i + '"' + (o === v ? ' selected' : '') + '>' + esc(pr.labels ? pr.labels[i] : o) + '</option>'; }).join('') + '</select>';
        else if (pr.type === 'seg') ctrls += '<span class="seg">' + pr.options.map(function (o, i) { return '<button data-k="' + pr.k + '" data-v="' + i + '" class="' + (o === v ? 'on' : '') + '">' + esc(pr.labels[i]) + '</button>'; }).join('') + '</span>';
        else if (pr.type === 'toggle') ctrls += '<button class="toggle' + (v ? ' on' : '') + '" data-k="' + pr.k + '" data-t="1"><i></i>' + (v ? 'On' : 'Off') + '</button>';
        else if (pr.type === 'range') ctrls += '<input type="range" data-k="' + pr.k + '" min="' + pr.min + '" max="' + pr.max + '" step="' + pr.step + '" value="' + v + '"><em data-out="' + pr.k + '">' + esc(pr.fmt ? pr.fmt(v) : v) + '</em>';
        else if (pr.type === 'swatch') ctrls += '<span class="sw">' + pr.options.map(function (o) { return '<button data-k="' + pr.k + '" data-s="' + o + '" style="background:' + BB.WIRE_RGB[o] + '" class="' + (o === v ? 'on' : '') + '" title="' + o + '"></button>'; }).join('') + '</span>';
        ctrls += '</label>';
      });
      if (def.mcu) ctrls += this.programUi(p, lock.indexOf('program') >= 0);
      html += '<div class="ctls">' + ctrls + '</div>';
      var acts = '';
      if (p.type === 'button') acts += '<button class="holdbtn" data-a="hold">Hold to press</button>';
      (def.actions || []).forEach(function (a) { acts += '<button data-a="' + a.id + '">' + esc(a.label) + '</button>'; });
      if ((def.kind === 'leads' || def.kind === 'module') && p.ends.length === 2 && !p.locked && p.type !== 'wire') acts += '<button data-a="flip">' + icon('flip') + ' Flip</button>';
      if (def.kind === 'rigid' && !def.noRotate && !p.locked) acts += '<button data-a="rotate">' + icon('rotate') + ' Rotate</button>';
      if (p.st.burnt || (p.st.burntSeg && Object.keys(p.st.burntSeg).length)) acts += '<button class="primary" data-a="renew">New ' + (p.type === 'led' ? 'LED' : 'part') + '</button>';
      if (def.mcu && p.st.damaged && Object.keys(p.st.damaged).length) acts += '<button class="primary" data-a="renew">New board</button>';
      if (p.type === 'meter' && p.st.fuse) acts += '<button class="primary" data-a="fuse">New fuse</button>';
      if (!p.locked) acts += '<button class="danger" data-a="del">' + icon('trash') + ' Delete</button>';
      ins.innerHTML = html;
      $('#acts').innerHTML = acts;
      this.refreshInspector();
      var setProp = function (k, v) { var u = self.snapshot(); p.props[k] = v; self.sim.dirty(); self.commit(u); self.bench.render(); self.onInteract('prop', p); };
      ins.onchange = function (e) {
        var t = e.target, k = t.dataset.k; if (!k) return;
        var pr = (def.props || []).find(function (q) { return q.k === k; });
        if (t.tagName === 'SELECT' && pr) { setProp(k, pr.options[+t.value]); self.onSelect(id); }
        if (t.dataset.prog) { setProp('program', t.value); self.onSelect(id); }
        if (t.dataset.role) { var u = self.snapshot(); p.props.pins = Object.assign({}, p.props.pins || {}); p.props.pins[t.dataset.role] = t.value; self.commit(u); self.sim.dirty(); }
      };
      ins.oninput = function (e) {
        var t = e.target, k = t.dataset.k; if (!k || t.type !== 'range') return;
        var pr = def.props.find(function (q) { return q.k === k; });
        p.props[k] = +t.value; self.sim.dirty(); self.bench.render(); self.onInteract('prop', p);
        var out = ins.querySelector('[data-out="' + k + '"]'); if (out) out.textContent = pr.fmt ? pr.fmt(+t.value) : t.value;
      };
      ins.onclick = function (e) {
        var b = e.target.closest('button'); if (!b || b.classList.contains('term')) return;
        if (b.classList.contains('closeins')) { self.bench.select(null); return; }
        var k = b.dataset.k;
        if (k && b.dataset.v !== undefined) { var pr = def.props.find(function (q) { return q.k === k; }); setProp(k, pr.options[+b.dataset.v]); self.onSelect(id); return; }
        if (k && b.dataset.t) { setProp(k, !p.props[k]); self.onSelect(id); return; }
        if (k && b.dataset.s) { setProp(k, b.dataset.s); self.onSelect(id); return; }
        var a = b.dataset.a;
        if (a === 'del') self.removePart(p.id, true);
        if (a === 'flip') { var u = self.snapshot(); p.ends.reverse(); self.sim.dirty(); self.commit(u); self.bench.render(); self.onInteract('moved', p); }
        if (a === 'rotate') { self.rotatePart(p); }
        if (a === 'renew') { var u2 = self.snapshot(); p.st = {}; self.sim.dirty(); self.commit(u2); self.bench.render(true); self.onSelect(id); }
        if (a === 'fuse') { p.st.fuse = false; self.sim.dirty(); self.onSelect(id); }
        if (a === 'clap' || a === 'wave') self.partAction(p, a);
        if (a === 'more') { document.body.classList.toggle('insfull'); b.textContent = document.body.classList.contains('insfull') ? 'Show less ▾' : 'More ▴'; }
      };
      var hold = ins.querySelector('.holdbtn');
      if (hold) {
        var down = function (e) { e.preventDefault(); p.st.pressed = true; self.sim.dirty(); self.onInteract('press', p); hold.classList.add('on'); self.bench.render(); };
        var upf = function () { if (!p.st.pressed) return; p.st.pressed = false; self.sim.dirty(); self.onInteract('release', p); hold.classList.remove('on'); self.bench.render(); };
        hold.addEventListener('pointerdown', down); hold.addEventListener('pointerup', upf); hold.addEventListener('pointerleave', upf); hold.addEventListener('pointercancel', upf);
      }
    },
    programUi: function (p, locked) {
      var def = PARTS[p.type], mcu = def.mcu, P = BB.programs;
      var cur = p.props.program || 'none';
      var s = '<label class="ctl"><span>Program</span>';
      if (locked) s += '<b>' + esc(P.P[cur].name) + '</b>';
      else s += '<select data-prog="1">' + P.ORDER.filter(function (id) { return P.available(mcu, id); }).map(function (id) { return '<option value="' + id + '"' + (id === cur ? ' selected' : '') + '>' + esc(P.P[id].name) + '</option>'; }).join('') + '</select>';
      s += '</label>';
      var prog = P.P[cur];
      s += '<p class="small">' + rich(prog.desc) + '</p>';
      if (mcu === 'pi5') s += '<p class="small mut">The Raspberry Pi has no analog inputs, so knob, light and sound programs are not offered.</p>';
      var roles = Object.keys(prog.roles);
      if (roles.length) {
        var gp = def.pins.filter(function (q) { return q.kind === 'gpio'; });
        s += '<table class="roles"><tr><th>Use</th><th>Pin</th></tr>' + roles.map(function (r) {
          var pin = P.pinFor(p, r);
          var cell = (this.mode === 'sandbox')
            ? '<select data-role="' + r + '">' + gp.filter(function (q) { return !prog.roles[r].analog || q.analog; }).filter(function (q) { return prog.roles[r].mode !== 'out' || !q.inputOnly; }).map(function (q) { return '<option' + (q.n === pin ? ' selected' : '') + '>' + esc(q.n) + '</option>'; }).join('') + '</select>'
            : '<b>' + esc(pin) + (def.pins.find(function (q) { return q.n === pin; }).phys ? ' (pin ' + def.pins.find(function (q) { return q.n === pin; }).phys + ')' : '') + '</b>';
          return '<tr><td>' + esc(prog.roles[r].label) + '</td><td>' + cell + '</td></tr>';
        }, this).join('') + '</table>';
      }
      s += '<div class="serial"><div class="sh">Serial monitor</div><pre id="serial"></pre></div>';
      return s;
    },
    refreshInspector: function () {
      var id = this.bench.sel; if (!id || !this.sim.res) return;
      var p = this.sim.part(id); if (!p) return;
      var def = PARTS[p.type], vals = $('#vals'); if (!vals) return;
      var r = this.sim.res, keys = (r.nets.keys || {})[p.id] || [];
      var rr = { pinV: function (k) { var v = r.keyV[keys[k]]; return v === undefined ? 0 : v; } };
      var rows = def.info ? def.info(p, rr) : [];
      var issues = r.issues.filter(function (is) { return is.part === p.id; });
      var html = rows.map(function (row) { return '<div class="vr"><span>' + esc(row[0]) + '</span><b>' + esc(row[1]) + '</b></div>'; }).join('');
      if (p.type === 'meter') html = '<div class="bigread">' + esc((p.st.reading && p.st.reading.text) || '—') + ' <small>' + esc((p.st.reading && p.st.reading.unit) || '') + '</small></div>';
      if (issues.length) html += issues.map(function (is) { return '<div class="iss ' + is.level + '"><b>' + esc(is.title) + '</b>' + rich(is.text) + '</div>'; }).join('');
      if (vals.innerHTML !== html) vals.innerHTML = html;
      var ser = $('#serial');
      if (ser) { var t = (p.st.serial || []).join('\n') || (p.st.powered ? '' : '(no power)'); if (ser.textContent !== t) ser.textContent = t; }
      var pos = document.querySelector('#inspector input[data-k=pos]');
      if (pos && document.activeElement !== pos && +pos.value !== p.props.pos) { pos.value = p.props.pos; var o = document.querySelector('#inspector [data-out=pos]'); if (o) o.textContent = Math.round(p.props.pos * 100) + ' %'; }
    },
    rotatePart: function (p) {
      var u = this.snapshot(), sim = this.sim, def = PARTS[p.type];
      var old = p.rot || 0;
      p.rot = (old + 90) % 360;
      // keep it plugged in if the rotated pins fit, else lift it off the board
      var pts = sim.pinPoints(p), occ = sim.occupancy(), cov = sim.covered();
      var ok = !p.free && pts.every(function (q) { return q.at && (!occ[q.at] || occ[q.at].id === p.id) && (!cov[q.at] || cov[q.at] === p.id); });
      if (!ok) {
        var found = false;
        for (var dx = -2; dx <= 2 && !found; dx++) for (var dy = -3; dy <= 3 && !found; dy++) {
          var x0 = Math.round(p.x) + dx, y0 = Math.round(p.y) + dy;
          var good = def.pinPos.every(function (q) { var r = BB.rotate(q[0], q[1], p.rot), h = sim.board.holeAt(x0 + r[0], y0 + r[1]); return h && h.x === x0 + r[0] && h.y === y0 + r[1] && (!occ[h.id] || occ[h.id].id === p.id) && (!cov[h.id] || cov[h.id] === p.id); });
          if (good) { p.x = x0; p.y = y0; p.free = false; found = true; }
        }
        if (!found) p.free = true;
      }
      sim.dirty(); this.commit(u); this.bench.render(); this.onInteract('moved', p);
    },
    partAction: function (p, a) {
      if (a === 'clap') { p.st.clapUntil = this.sim.t + 1.2; audio.noise(0.12, 0.25); }
      if (a === 'wave') { p.st.motionUntil = this.sim.t + 4; }
      this.sim.dirty();
    },
    onInteract: function (what, p) { if (this.mode === 'level') this.checkLevel(); this.saveSandbox(); },

    // ---------- the action API (used by tests and level setups) ----------
    actions: function () {
      var self = this;
      var id = function (x) { return typeof x === 'string' ? x : x.id; };
      var A = {
        add: function (type, init) { var p = BB.newPart(type, init || {}); self.sim.state.parts.push(p); self.sim.dirty(); if (self.bench.sim === self.sim) self.bench.render(); return p; },
        wire: function (a, b) { return self.addWire(a, b); },
        del: function (x) { self.removePart(id(x)); },
        flip: function (x) { var p = self.sim.part(id(x)); p.ends.reverse(); self.sim.dirty(); },
        moveEnd: function (x, k, at) { var p = self.sim.part(id(x)); p.ends[k] = { at: at }; self.sim.dirty(); },
        move: function (x, px, py, rot) { var p = self.sim.part(id(x)); p.x = px; p.y = py; if (rot !== undefined) p.rot = rot; p.free = false; self.sim.dirty(); },
        set: function (x, k, v) { var p = self.sim.part(id(x)); p.props[k] = v; self.sim.dirty(); self.onInteract('prop', p); },
        press: function (x, on) { var p = self.sim.part(id(x)); p.st.pressed = on; self.sim.dirty(); },
        action: function (x, a) { self.partAction(self.sim.part(id(x)), a); },
        tap: function (h) { self.bench.hiHole = h; self.onTapHole(h); },
        xray: function (on) { self.setXray(on); self.checkLevel(); },
        choose: function (i) { self.choose(i); },
        wait: function (sec) { for (var t = 0; t < sec; t += 1 / 60) { self.sim.step(1 / 60); self.afterStep(); } },
        find: function (t) { return self.sim.state.parts.filter(function (p) { return p.type === t; }); }
      };
      return A;
    },

    // ---------- each frame ----------
    frame: function (dt) {
      if (!this.sim || $('#play').hidden) return;
      if (this.sim.isDynamic()) { this.sim.step(dt); this.afterStep(); }
      if (this.sim.ver !== this._drawnVer) { this._drawnVer = this.sim.ver; this.bench.render(); }
      var now = performance.now();
      if (!this._insT || now - this._insT > 200) { this._insT = now; this.refreshInspector(); this.updateBanner(); if (this.mode === 'level') this.checkLevel(); else this.checkChallenges(); }
    },
    afterStep: function () {
      var sim = this.sim, self = this;
      // events: burns, fuses, damage
      sim.events.forEach(function (ev) {
        if (ev.type === 'burn') { audio.noise(0.25, 0.35); audio.blip(140, 0.3, 'sawtooth', 0.05, 60); if (navigator.vibrate) try { navigator.vibrate(60); } catch (e) { /* ignore */ } }
        if (ev.type === 'fuse') { audio.blip(1800, 0.05, 'square', 0.05); audio.noise(0.06, 0.2); }
        if (ev.type === 'damage') { audio.noise(0.3, 0.3); }
        if (self.mode === 'level' && self.level && !self.level.done) self.level.mistakes++;
        if (self.bench.sel === ev.part) self.onSelect(ev.part);
      });
      sim.events = [];
      if (this.mode === 'level' && this.level && !this.level.done) {
        var lv = this.level;
        sim.res.issues.forEach(function (is) {
          if (is.kind === 'short' && !lv.baseline.short && !lv.issueSeen.short) { lv.issueSeen.short = true; lv.mistakes++; }
        });
        if (!sim.res.issues.some(function (is) { return is.kind === 'short'; })) { lv.issueSeen.short = false; lv.baseline.short = false; }
        this.checkLevel();
      }
      // sound from buzzers and speakers
      var want = {};
      sim.state.parts.forEach(function (p) {
        if (p.type === 'buzzer' && p.st.sound) want[p.id] = { f: p.st.sound.f, vol: p.st.sound.vol };
        if (p.type === 'speaker' && Math.abs(p._i || 0) > 0.002) {
          var f = 0;
          sim.state.parts.forEach(function (q) { var io = q.st && q.st.io; if (io) Object.keys(io).forEach(function (k) { if (io[k].freq) f = io[k].freq; }); });
          if (f) want[p.id] = { f: f, vol: Math.min(1, Math.abs(p._i) / 0.01) };
        }
      });
      audio.tones(want);
    },
    // The banner above the bench explains the most important problem.
    updateBanner: function () {
      var sim = this.sim, ban = $('#banner'); if (!sim || !sim.res) return;
      var iss = sim.res.issues.slice().sort(function (a, b) { return (a.level === 'danger' ? 0 : 1) - (b.level === 'danger' ? 0 : 1); });
      var msg = null;
      if (iss.length) msg = { level: iss[0].level, title: iss[0].title, text: iss[0].text };
      else if (this.mode === 'level' && this.level && !this.level.done && this.level.def.explain) {
        var t = null; try { t = this.level.def.explain(this.L()); } catch (e) { t = null; }
        if (t) {
          // wait a little before explaining, so we do not nag while the player is still building
          var lv = this.level;
          if (lv.lastExplain !== t) { lv.lastExplain = t; lv.explainT = performance.now(); }
          if (performance.now() - lv.explainT > 1800) msg = { level: 'info', title: 'Why it does not work yet', text: t };
        }
      }
      var key = msg ? msg.level + msg.title + msg.text : '';
      if (key === this._banKey) return;
      this._banKey = key;
      if (!msg) { ban.hidden = true; return; }
      ban.hidden = false;
      ban.className = 'banner ' + msg.level;
      ban.innerHTML = '<b>' + esc(msg.title) + '</b><span>' + rich(msg.text) + '</span>';
      this.bench.renderUi();
    },

    // ---------- small UI pieces ----------
    toast: function (text, kind) {
      var t = document.createElement('div');
      t.className = 'toast ' + (kind || 'info');
      t.innerHTML = rich(text);
      $('#toasts').appendChild(t);
      var all = $('#toasts').children, max = window.innerWidth < 1100 ? 1 : 2; while (all.length > max) all[0].remove();
      setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 400); }, kind === 'info' ? 3400 : 4200);
    },
    say: function (what) { if (what === 'wireStart') this.toast('Now tap the second hole.', 'info'); },
    modal: function (html, cb) {
      var m = $('#modal');
      m.innerHTML = '<div class="mbox">' + html + '</div>';
      m.hidden = false;
      m.onclick = function (e) {
        var b = e.target.closest('[data-m]');
        if (b) { m.hidden = true; if (cb) cb(b.dataset.m); }
        else if (e.target === m) { m.hidden = true; if (cb) cb(null); }
      };
    },
    confirm: function (text, okLabel, cb) { this.modal('<p>' + esc(text) + '</p><div class="mbtns"><button class="danger" data-m="ok">' + esc(okLabel) + '</button><button data-m="no">Cancel</button></div>', function (a) { if (a === 'ok') cb(); }); },
    showTerm: function (t) {
      var term = t.dataset.term, def = BB.GLOSSARY[term] || BB.GLOSSARY[term.replace(/s$/, '')] || '';
      var pop = $('#pop'), r = t.getBoundingClientRect();
      pop.innerHTML = '<b>' + esc(term) + '</b>' + esc(def);
      pop.hidden = false;
      var w = Math.min(280, window.innerWidth - 16);
      pop.style.width = w + 'px';
      pop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
      pop.style.top = (r.bottom + 8 + 120 > window.innerHeight ? r.top - 8 - pop.offsetHeight : r.bottom + 8) + 'px';
    }
  };

  // Sandbox challenges: small free tasks for the boards the levels do not cover.
  function blinkCheck(L, f, type, pin) {
    var b = L.of(type)[0]; if (!b || b.props.program !== 'blink' || !b.st.io || !b.st.io[pin]) return false;
    L.of('led').forEach(function (l) {
      var on = b.st.io[pin].level === 1, pinI = (b.st.pinI || {})[pin] || 0;
      if (on && H.lit(l) && H.safe(l) && Math.abs(pinI - l._i) < 0.15 * l._i) f.on = true;
      if (!on && f.on && !H.lit(l)) f.off = true;
    });
    return f.on && f.off;
  }
  var CHALLENGES = [
    { id: 'pi5', title: 'Raspberry Pi 5 blink.', text: 'The Pi does not fit on the breadboard. Connect GPIO17 (header pin 11) → 220 Ω → LED → GND (pin 6) with wires, and run “Blink”. The Pi gives 3.3 V, so the LED current is smaller.', check: function (L, f) { return blinkCheck(L, f, 'pi5', 'GPIO17'); } },
    { id: 'wio', title: 'Wio Terminal light meter.', text: 'Build a divider (LDR + 10 kΩ) between 3V3 (pin 1) and GND, with the middle on D2/A2 (pin 16). Run “Light meter”: the Wio shows the number on its own screen.', check: function (L, f) {
      var w = L.of('wio')[0]; if (!w || w.props.program !== 'light_meter' || !w.st.display) return false;
      var a = +String(w.st.display[1] || '').replace(/\D/g, '');
      if (a > 600) f.hi = true; if (a < 300 && f.hi) f.lo = true; return f.hi && f.lo;
    } },
    { id: 'nanoMB', title: 'Nano from the MB102.', text: 'Turn off the Nano’s USB cable (in its panel). Power it from a 5V rail: rail + → Nano 5V pin, rail − → Nano GND.', check: function (L) { return L.of('nano').some(function (n) { return n.props.usb === false && n.st.powered && n.st.extPowered; }); } },
    { id: 'espMB', title: 'ESP32 from a 3.3V rail.', text: 'Set one MB102 side to 3.3V. Unplug the ESP32’s USB, then feed its 3V pin from that rail (and GND to −). Never feed 5V into 3V!', check: function (L) { return L.of('esp32').some(function (n) { return n.props.usb === false && n.st.powered && Math.abs(((n.st.lastV || {})['3V'] || 0) - 3.3) < 0.15 && !Object.keys(n.st.damaged || {}).length; }); } }
  ];
  BB.CHALLENGES = CHALLENGES;

  // little tray pictures: draw the real part art, scaled into a box
  function trayPic(spec) {
    var def = PARTS[spec.type];
    var p = BB.newPart(spec.type, { props: spec.props || {}, x: 0, y: 0 });
    var pts, vb;
    var fake = { endPos: function (e) { return e; } };
    if (def.kind === 'leads') {
      var span = { wire: 3, led: 1, resistor: 4, capacitor: 1.4, ldr: 1.6 }[spec.type] || 2;
      p.ends = [{ x: 0, y: 0 }, { x: span, y: 0 }];
      pts = p.ends;
      if (spec.type === 'wire') { p.props.color = 'red'; pts = [{ x: 0, y: 0.6 }, { x: 3, y: 0.6 }]; }
      vb = [-14, -16, span * 10 + 28, 30];
      if (spec.type === 'capacitor') vb = [-14, -16, 42, 32];
    } else if (def.kind === 'rigid') {
      var b = def.body; pts = [];
      vb = [b[0] * 10 - 3, b[1] * 10 - 3, (b[2] - b[0]) * 10 + 6, (b[3] - b[1]) * 10 + 6];
    } else {
      pts = def.kind === 'module' ? def.leadFrom.map(function (q) { return { x: q[0] + 2, y: q[1] }; }) : [];
      var w = def.size[0] * 10, h = def.size[1] * 10;
      vb = [-6, -6, w + (def.kind === 'module' ? 40 : 12), h + 12];
      if (spec.type === 'wio') vb = [-6, -10, w + 12, h + 22];
    }
    var art = '';
    try { art = BB.art.DRAW[spec.type](p, pts, 0, false); } catch (e) { art = ''; }
    return '<svg viewBox="' + vb.join(' ') + '" preserveAspectRatio="xMidYMid meet">' + art + '</svg>';
  }
  function levelIcon(n) {
    var m = {
      holes: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9v6M12 9v6M16 9v6"/>',
      rails: '<path d="M3 8h8M13 8h8M3 16h18"/><path d="M10 8q2-4 4 0"/>',
      led: '<path d="M8 14a4 4 0 1 1 8 0v3H8z"/><path d="M10 17v4M14 17v3M12 2v2M5 5l1.5 1.5M19 5l-1.5 1.5"/>',
      bug: '<path d="M9 7a3 3 0 0 1 6 0M7 10h10v5a5 5 0 0 1-10 0z"/><path d="M4 12h3M17 12h3M5 18l2-1M19 18l-2-1M12 10v10"/>',
      button: '<rect x="5" y="5" width="14" height="14" rx="2"/><circle cx="12" cy="12" r="4"/>',
      knob: '<circle cx="12" cy="13" r="7"/><path d="M12 13l3-4"/><path d="M5 5l2 2M19 5l-2 2"/>',
      mb102: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="8" y="8" width="8" height="3" rx="1"/><path d="M8 15h2M14 15h2"/>',
      meter: '<rect x="6" y="3" width="12" height="18" rx="2"/><rect x="8" y="5" width="8" height="4"/><circle cx="12" cy="14" r="3"/>',
      nano: '<rect x="3" y="8" width="18" height="8" rx="1"/><path d="M5 8V6M8 8V6M11 8V6M14 8V6M17 8V6M5 16v2M8 16v2M11 16v2M14 16v2M17 16v2"/>',
      oled: '<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="6" y="8" width="12" height="7"/>',
      sound: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
      esp32: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 10h8M8 14h5"/><path d="M15 15l3 3M18 15l-3 3"/>'
    };
    return '<svg viewBox="0 0 24 24" class="ico">' + (m[n] || '') + '</svg>';
  }

  BB.app = app;
  BB.store = store;
  BB.audio = audio;
})();
