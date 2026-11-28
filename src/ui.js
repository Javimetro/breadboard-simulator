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
  // plain text (glossary words not tappable): for places right above real controls
  function plain(s) { return esc(s).replace(/\{\{([^}|]+)(\|([^}]+))?\}\}/g, function (m, term, x, shown) { return shown || term; }); }
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
    board: '<rect x="2.5" y="4" width="19" height="16" rx="1.5"/><path d="M4.5 6.5h15M4.5 17.5h15" stroke-width="1.2"/><path d="M3 12h18" stroke-width="2.2" opacity=".5"/><path d="M6 9.5h.01M9 9.5h.01M12 9.5h.01M15 9.5h.01M18 9.5h.01M6 14.5h.01M9 14.5h.01M12 14.5h.01M15 14.5h.01M18 14.5h.01" stroke-width="2.2"/>',
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
      // after a reload, go back to the level (its intro) or the sandbox the player was in
      var w = store.data.where;
      if (w && w.sandbox) this.startSandbox();
      else if (w && LEVELS[w.level]) this.startLevel(w.level);
      var self = this, last = performance.now();
      var loop = function (now) {
        var dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000)); last = now;
        try { self.frame(dt); } catch (e) { if (window.console) console.error(e); }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      window.addEventListener('resize', function () { if (self.sim) self.bench.renderUi(); });
      // save the sandbox at once when the page is hidden (switching apps on a phone, closing the tab)
      var saveNow = function () { self.saveNow(); };
      window.addEventListener('pagehide', saveNow);
      document.addEventListener('visibilitychange', function () { if (document.hidden) saveNow(); });
      $('#stage').addEventListener('pointerdown', function () { $('#toasts').innerHTML = ''; });
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
        if (a === 'parts') { document.body.classList.toggle('trayopen'); document.body.classList.remove('pulseparts'); store.data.partsTip = true; store.save(); $('#toasts').innerHTML = ''; } // the tip pointed here: its job is done
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
        if (b.dataset.z === 'fit') { var gf = $('#goal'); self.bench.fitAll(window.innerWidth < 1100 && self.mode === 'level' && gf.offsetParent ? gf.offsetTop + gf.offsetHeight + 8 : 0); } // the whole board and every part (phones: below the task card)
        self.bench.renderUi();
      });
      $('#topbar').addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        if (b.dataset.act === 'home') self.showHome();
        if (b.dataset.act === 'hint') self.hint();
        if (b.dataset.act === 'restart') self.confirm('Start this level again? Your parts on the bench will be reset.', 'Restart', function () { self.beginLevel(self.level.def); });
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
      $('#banner').addEventListener('click', function () { var bn = $('#banner'); bn.classList.toggle('open'); clearTimeout(bn._t); if (bn.classList.contains('open')) bn._t = setTimeout(function () { bn.classList.remove('open'); }, 7000); }); // folds itself again, so it does not hide the board
    },
    setTool: function (t) {
      this.bench.hideTip(); this.bench.stickyHi = false;
      this.bench.tool = t; this.bench.wireStart = null;
      document.querySelectorAll('#tb .tool').forEach(function (b) { b.classList.toggle('on', b.dataset.act === t); });
      document.body.classList.toggle('wiretool', t === 'wire');
      if (t === 'wire') this.toast('Wire: tap a hole, then another hole. Or drag from hole to hole.', 'info');
      this.bench.renderUi();
    },
    setFlow: function (on) { $('#banner').classList.remove('open'); /* the toast would cover an open “why” panel */ this.bench.showFlow = on; $('#tb [data-act=flow]').classList.toggle('on', on); if (on) this.toast('Moving dots show the current (from + to −). Tags show the voltage at each point.', 'info', true); this.bench.renderFlow(); },
    setXray: function (on) { this.bench.xray = on; $('#tb [data-act=xray]').classList.toggle('on', on); this.bench.renderBoard(); if (this.mode === 'level' && this.level && this.level.ready) this.checkLevel(); },
    toggleSound: function () { audio.on = !audio.on; store.data.sound = audio.on; store.save(); if (!audio.on) audio.tones({}); else audio.init(); this.updateTop(); },

    // ---------- screens ----------
    show: function (id) { document.querySelectorAll('.screen').forEach(function (s) { s.hidden = s.id !== id; }); },
    showHome: function () {
      var self = this;
      audio.tones({});
      this.clearToasts();
      if (this.mode) { store.data.where = null; store.save(); }
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
        if (b.classList.contains('locked')) { self.toast('Finish the previous level first, or turn on “Unlock all levels” below.', 'info'); return; }
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
      // the first time: how to move around (shown here, not over the board)
      $('#introTip').textContent = store.data.tipShown ? '' : (window.innerWidth < 1100 ? 'Tip: pinch with two fingers to zoom. Drag an empty spot to move the view.' : 'Tip: scroll to zoom. Drag an empty spot to move the view.');
      store.data.tipShown = true; store.save();
      $('#introGo').textContent = again ? 'Back to the level' : 'Start';
      $('#introGo').onclick = function () {
        if (again) { self.show('play'); self.bench.renderUi(); return; }
        var sv = store.data.levelSave;
        // half-finished earlier (or the page was reloaded): continue, or start again
        if (sv && sv.i === def.n - 1) self.modal('<h2>Continue?</h2><p>You started this level before. Your parts are still there.</p><div class="mbtns"><button class="primary" data-m="go">Continue where I stopped</button><button data-m="new">Start again</button></div>',
          function (a) { if (a === 'go') self.beginLevel(def, sv); else if (a === 'new') { store.data.levelSave = null; store.save(); self.beginLevel(def); } });
        else self.beginLevel(def);
      };
      $('#introBack').onclick = function () { self.showHome(); };
    },

    // ---------- levels ----------
    startLevel: function (i) { if (this.level) this.level.cancelDone = true; this.clearToasts(); this.showIntro(LEVELS[i]); }, // an old “done” box must not open over the new intro
    clearToasts: function () { $('#toasts').innerHTML = ''; this._banKey = null; $('#banner').hidden = true; $('#modal').hidden = true; },
    beginLevel: function (def, resume) {
      this.clearToasts();
      store.data.where = { level: def.n - 1 }; store.save();
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
      if (resume) {
        // put back the parts and the progress from the saved level
        var rs = JSON.parse(resume.state);
        rs.parts.forEach(function (q) { q.st = q.st || {}; });
        this.sim.state.parts = rs.parts;
        ['step', 'flags', 'hints', 'mistakes', 'wrong', 'tapped'].forEach(function (k) { if (resume[k] !== undefined) this.level[k] = resume[k]; }, this);
      }
      this.sim.step(0.001);
      this.level.baseline = {};
      var self = this;
      this.sim.res.issues.forEach(function (is) { self.level.baseline[is.kind] = true; });
      this.sim.events = [];
      this.level.ready = true;
      this.sim.state.parts.forEach(function (q) { if (!q.deletable) q.keep = true; }); // parts the level gave you cannot be deleted (the tray cannot give them back)
      // the first level that needs parts on a phone: show where they are
      var hasTray = (def.tray || []).some(function (it) { return (typeof it === 'string' ? it : it.type) !== 'wire'; });
      document.body.classList.toggle('pulseparts', hasTray && window.innerWidth < 1100 && !store.data.partsTip);
      if (hasTray && window.innerWidth < 1100 && !store.data.partsTip) { var self2 = this; setTimeout(function () { if (self2.level && !self2.level.done && !store.data.partsTip) self2.toast('Your parts are in “Parts” below ↓', 'info'); }, 400); }
      this.buildTray(def.tray);
      this.updateTop();
      this.renderGoal();
      this.fitView();
      this.bench.render(true);
      this.onSelect(null);
    },
    fitView: function () {
      this._viewBefore = this._viewFocus = null;
      if (this.mode === 'level' && this.level.def.view) {
        var v = this.level.def.view, b = this.sim.board, bench = this.bench;
        var mobile = window.innerWidth < 1100, g = $('#goal');
        var top = mobile && g.offsetHeight ? g.offsetHeight + 12 : 0, right = mobile ? 0 : 54;
        // phones: a tighter view (where the work happens) so holes are big enough for a finger
        if (mobile && this.level.def.phone) { var ph = this.level.def.phone; bench.fitRect(ph[0], ph[1], ph[2], ph[3], 6, top, right, true, 50); return; } // + room for the problem chip under the card, if there is spare height
        bench.fitRect(v[0], v[1], v[2], v[3], 8, top, right);
        if (mobile) return;
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
        mistake: function (key) { lv.mistakeKeys = lv.mistakeKeys || {}; if (!lv.mistakeKeys[key] && !lv.done) { lv.mistakeKeys[key] = 1; lv.mistakes++; } }, // counts once per level
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
      // never judge while a leg, part or wire is still being dragged: the circuit passes through wrong states on the way.
      // The drop calls onInteract → checkLevel again. (Turning a knob or holding a button is judged live.)
      var dg = this.bench && this.bench.drag;
      if (dg && (dg.kind === 'end' || dg.kind === 'body' || dg.kind === 'wire') && dg.moved) return;
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
    stepTaskHtml: function () {
      var lv = this.level;
      return this.mode === 'level' && lv && !lv.done && lv.def.steps[lv.step] ? '<p class="steptask"><b>Step ' + (lv.step + 1) + ':</b> ' + plain(lv.def.steps[lv.step].sheet || lv.def.steps[lv.step].text) + '</p>' : '';
    },
    stepDone: function (msg) {
      var lv = this.level;
      $('#toasts').innerHTML = ''; // the last step's message is old news
      document.body.classList.remove('pulseparts'); // the player found the parts (or this step needs none)
      lv.step++;
      var stp = document.querySelector('#inspector .steptask'); // keep the sheet's step text in step with the goal card
      if (stp) { var nh = this.stepTaskHtml(); if (nh) stp.outerHTML = nh; else stp.remove(); }
      this.saveSandbox(); // also saves the level in progress
      audio.blip(880, 0.12, 'sine', 0.06); setTimeout(function () { audio.blip(1320, 0.18, 'sine', 0.05); }, 90);
      if (lv.step >= lv.def.steps.length) { this.finishLevel(); return; }
      // the band picker shows the good news inside the card, so nothing covers the resistor below it
      var wasBands = lv.def.steps[lv.step - 1] && lv.def.steps[lv.step - 1].bands; // after the band picker the meter's dial is at the bottom: say it up top
      if (lv.def.steps[lv.step].bands) lv.bandNote = ['good', '✓ ' + (msg || 'Done!')];
      this.renderGoal(); // first the new card, so the toast is placed under its real height
      if (!lv.def.steps[lv.step].bands) this.toast('✓ ' + (msg || 'Done!'), 'good', wasBands);
    },
    finishLevel: function () {
      var lv = this.level, self = this;
      $('#toasts').innerHTML = ''; document.body.classList.remove('pulseparts');
      lv.done = true;
      if (store.data.levelSave && store.data.levelSave.i === lv.def.n - 1) store.data.levelSave = null; // finished: nothing to continue
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
      var times = function (n) { return n === 1 ? 'once' : n === 2 ? 'twice' : n + ' times'; };
      var burns = lv.mistakes - (lv.overv || 0);
      if (burns > 0) why.push('something burned or shorted ' + times(burns));
      if (lv.overv) why.push('a pin got too much voltage ' + times(lv.overv));
      if (lv.wrong) why.push('you gave ' + lv.wrong + ' wrong answer' + (lv.wrong > 1 ? 's' : ''));
      // first let the player see the result (the LED lighting up); never open under a finger that is still down
      var showDone = function () {
        if (Object.keys(self.bench.pointers).length) { setTimeout(showDone, 250); return; }
        if (self.level !== lv || lv.cancelDone) return;
        self.modal('<div class="done"><div class="bigstars">' + [1, 2, 3].map(function (k) { return '<span style="animation-delay:' + (k * 0.18) + 's">' + icon('star', k <= stars ? 'on' : '') + '</span>'; }).join('') + '</div>' +
          '<h2>Level ' + lv.def.n + ' done!</h2><p class="learned">' + rich(lv.def.done) + '</p>' +
          (stars < 3 ? '<p class="mut small">3 stars: no hints, nothing burned, no pin with too much voltage, no wrong answers. This time ' + why.join(' and ') + '.</p>' : '') +
          '<div class="mbtns">' + (next ? '<button class="primary" data-m="next">Next level</button>' : '<button class="primary" data-m="sand">Open the sandbox</button>') +
          '<button data-m="stay">Stay here</button><button data-m="home">All levels</button></div></div>', function (a) {
          if (a === 'next') self.startLevel(lv.def.n);
          if (a === 'home') self.showHome();
          if (a === 'sand') self.startSandbox();
          // stay: on phones, show the whole finished circuit (not during the level: never move the view under a finger)
          if ((a === 'stay' || a === null) && window.innerWidth < 1100 && self.level === lv) { var gg = $('#goal'); self.bench.fitAll(gg.offsetTop + gg.offsetHeight + 8); self.bench.renderUi(); }
        }, 'bottom');
      };
      setTimeout(showDone, this.doneDelay === undefined ? 2600 : this.doneDelay); // time to see the result (the LED, the screen) first
    },
    renderGoal: function () {
      var lv = this.level, def = lv.def, self = this;
      var html = '<div class="ghead" data-act="fold"><span class="gnum">Level ' + def.n + '</span><h2>' + esc(def.title) + '</h2><span class="gstep">' + (lv.done ? 'Done' : 'Step ' + (lv.step + 1) + '/' + def.steps.length) + '</span><button class="ibtn fold" data-act="fold" title="Show / hide">' + '<svg class="ico" viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>' + '</button><button class="ibtn" data-act="info" title="Watch the intro again">' + icon('info') + '</button></div>';
      html += '<ol class="steps">' + def.steps.map(function (s, i) {
        var cls = i < lv.step ? 'done' : i === lv.step && !lv.done ? 'cur' : 'todo';
        return '<li class="' + cls + '"><span class="sn">Step ' + (i + 1) + ' of ' + def.steps.length + '</span>' + rich(s.text) + '</li>';
      }).join('') + '</ol>';
      var step = def.steps[lv.step];
      // answers unlock only after the player has looked (tapped the holes the question is about)
      var ready = !step || !step.ready || step.ready(lv.tapped || {});
      if (step && step.choices && !lv.done) {
        if (ready) html += '<div class="choices">' + step.choices.map(function (c, i) { return '<button data-c="' + i + '">' + esc(c.label) + '</button>'; }).join('') + '</div>';
        else html += '<p class="lockq">' + rich(step.readyText) + '</p>';
      }
      if (step && step.bands && !lv.done) html += '<div class="bands">' + this.bandsHtml() + '</div>';
      html += '<div id="why" class="why" hidden></div>';
      if (!lv.done) {
        var left = def.hints.length - lv.hints;
        html += '<div class="hints">' + def.hints.slice(0, lv.hints).map(function (h, i) { return '<p class="hint"><b>Hint ' + (i + 1) + ':</b> ' + rich(h) + '</p>'; }).join('') + '</div>';
        html += left > 0 ? '<button class="hintbtn" data-act="hint">' + icon('hint') + ' Hint <span class="mut">(' + left + ' left)</span></button>' : '';
      } else html += '<p class="goodtxt">' + icon('star', 'on') + ' Level complete! ' + rich(def.done) + '</p><button class="primary" data-act="next">' + (LEVELS[def.n] ? 'Next level' : 'Open the sandbox') + '</button>';
      $('#goal').innerHTML = html;
      $('#goal').onclick = function (e) {
        var b = e.target.closest('button');
        if (window.innerWidth < 1100 && ((!b && e.target.closest('.ghead')) || (b && b.dataset.act === 'fold'))) { document.body.classList.toggle('goalmin'); self.bench.renderUi(); return; }
        if (!b || b.classList.contains('term')) return;
        if (b.dataset.c !== undefined) self.choose(+b.dataset.c);
        if (b.dataset.act === 'hint') self.hint();
        if (b.dataset.act === 'bands') self.checkBands();
        if (b.dataset.slot !== undefined) { lv.bandSlot = +b.dataset.slot; self.redrawBands(); }
        if (b.dataset.chip) { lv.bandPick = lv.bandPick || [null, null, null]; if (lv.bandNote && lv.bandNote[0] === 'good') lv.bandNote = null; lv.bandPick[lv.bandSlot || 0] = b.dataset.chip; if (lv.bandBad) lv.bandBad = lv.bandBad.filter(function (x) { return x !== (lv.bandSlot || 0); }); if ((lv.bandSlot || 0) < 2) lv.bandSlot = (lv.bandSlot || 0) + 1; audio.blip(660, 0.05, 'sine', 0.03); self.redrawBands(); }
        if (b.dataset.act === 'info') self.showIntro(def, true);
        if (b.dataset.act === 'next') { if (LEVELS[def.n]) self.startLevel(def.n); else self.startSandbox(); }
      };
      if (!document.body.classList.contains('hassel')) document.body.classList.remove('goalmin'); // a sheet is open: it shows the step
      // phones, colour-band step: a taller card for the picker, and the board zoomed onto the resistor below it
      var bandStep = !!(step && step.bands && !lv.done);
      if (bandStep && this.bench.sel && window.innerWidth < 1100) { this.bench.select(null); document.body.classList.remove('goalmin'); } // the picker needs the card, the resistor needs the board
      var wasBand = document.body.classList.contains('bandstep');
      document.body.classList.toggle('bandstep', bandStep);
      if (step && step.ready && window.innerWidth < 1100 && lv.step > 0) requestAnimationFrame(function () { self.fitView(); self.bench.renderUi(); }); // the question box made the card taller: keep the holes below it
      if (wasBand && !bandStep) requestAnimationFrame(function () { // zoomed on the resistor: now show the resistor and the meter, the next step's work
        var mys = self.sim.state.parts.filter(function (q) { return q.hideValue; })[0], mt = self.sim.state.parts.filter(function (q) { return q.type === 'meter'; })[0];
        if (!mys || !mt || window.innerWidth >= 1100) { self.fitView(); self.bench.renderUi(); return; }
        var a = self.sim.bodyRect(mys), m = self.sim.bodyRect(mt), g = $('#goal'), tips = self.sim.pinPoints(mt);
        var x0 = Math.min(a.x0, m.x0), x1 = Math.max(a.x1, m.x1), y0 = a.y0 - 2;
        tips.forEach(function (q) { x0 = Math.min(x0, q.x - 1.5); x1 = Math.max(x1, q.x + 1.5); y0 = Math.min(y0, q.y - 1.5); }); // and the probe tips: the player moves them next
        self.bench.fitRect(x0 - 1, y0, x1 + 1, m.y0 + (m.y1 - m.y0) * 0.84, 6, g.offsetTop + g.offsetHeight + 8, 0, true);
        self.bench.renderUi();
      });
      if (bandStep && window.innerWidth < 1100) {
        var mys = this.sim.state.parts.filter(function (q) { return q.hideValue; })[0];
        if (mys) requestAnimationFrame(function () {
          var g = $('#goal'), pts = self.sim.pinPoints(mys);
          self.bench.fitRect(Math.min(pts[0].x, pts[1].x) - 1, pts[0].y - 1.5, Math.max(pts[0].x, pts[1].x) + 1, pts[0].y + 1.5, 10, g.offsetTop + g.offsetHeight + 8, 0);
          self.bench.renderUi();
          self.redrawBands();
        });
      }
      this.updateTop();
    },
    choose: function (i) {
      var lv = this.level, step = lv.def.steps[lv.step];
      if (!step || !step.choices) return;
      var c = step.choices[i];
      if (c.ok) this.stepDone(c.why);
      else {
        lv.wrong = (lv.wrong || 0) + 1; this.toast(c.why, 'bad'); audio.blip(220, 0.18, 'sawtooth', 0.04);
        // no blind guessing: after a wrong answer, look again (tap the holes) before answering
        if (step.ready) { lv.tapped = {}; this.renderGoal(); }
      }
    },
    // colour-band picker: a big resistor with 3 empty bands; tap a band, then tap its colour chip
    bandsHtml: function () {
      var lv = this.level, pick = lv.bandPick || [null, null, null], slot = lv.bandSlot || 0, RGB = BB.art.BAND_RGB;
      var digit = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'grey', 'white'];
      var light = { yellow: 1, white: 1, orange: 1, grey: 1 };
      var svg = '<svg viewBox="0 0 300 64" class="bigres" aria-hidden="true"><line x1="0" y1="32" x2="300" y2="32" stroke="#b9bdc2" stroke-width="5"/>' +
        '<rect x="50" y="8" width="200" height="48" rx="22" fill="#e8c99a" stroke="#a98a5e" stroke-width="2"/>' +
        [92, 128, 164].map(function (x, k) {
          var c = pick[k];
          return '<rect x="' + (x - 10) + '" y="9" width="20" height="46" fill="' + (c ? RGB[c] : '#e8c99a') + '"' + (c ? '' : ' stroke="#7a6a50" stroke-dasharray="4 3" stroke-width="2"') + '/>' +
            (c ? '' : '<text x="' + x + '" y="38" font-size="16" text-anchor="middle" fill="#6b5a40">?</text>') +
            (k === slot ? '<path d="M' + (x - 9) + ' 63 L' + x + ' 56 L' + (x + 9) + ' 63Z" fill="#4cc9f0"/>' : '');
        }).join('') + '<rect x="214" y="9" width="12" height="46" fill="' + RGB.gold + '"/></svg>';
      var bad = lv.bandBad || [];
      var slots = '<div class="bslots">' + ['1st', '2nd', '3rd'].map(function (n, k) { return '<button data-slot="' + k + '" class="' + (k === slot ? 'on' : '') + (bad.indexOf(k) >= 0 ? ' bad' : '') + '">' + n + (pick[k] ? '<small>' + pick[k] + '</small>' : '') + '</button>'; }).join('') + '<button class="primary" data-act="bands">Check</button></div>';
      var note = lv.bandNote ? '<p class="bnote ' + lv.bandNote[0] + '">' + rich(lv.bandNote[1]) + '</p>' : '';
      var opts = slot < 2 ? digit.map(function (c, k) { return [c, String(k)]; }) : [['black', '×1'], ['brown', '×10'], ['red', '×100'], ['orange', '×1k'], ['yellow', '×10k']];
      var chips = '<div class="chips">' + opts.map(function (o) { return '<button data-chip="' + o[0] + '" title="' + o[0] + '" class="' + (pick[slot] === o[0] ? 'on' : '') + '" style="background:' + RGB[o[0]] + ';color:' + (light[o[0]] ? '#111' : '#fff') + '"><b>' + o[1] + '</b><small>' + o[0] + '</small></button>'; }).join('') + '</div>';
      var val = '';
      if (pick[0] && pick[1] && pick[2]) {
        var ohm = (digit.indexOf(pick[0]) * 10 + digit.indexOf(pick[1])) * Math.pow(10, digit.indexOf(pick[2]));
        val = '<p class="small">Your answer: ' + digit.indexOf(pick[0]) + digit.indexOf(pick[1]) + ' × ' + Math.pow(10, digit.indexOf(pick[2])) + ' = <b>' + (ohm >= 1000 ? ohm / 1000 + ' kΩ' : ohm + ' Ω') + '</b></p>';
      }
      return note + svg + slots + '<p class="small mut">' + (slot < 2 ? 'Read the resistor on the board. Band ' + (slot + 1) + ' is a digit. Tap its colour:' : 'Band 3 is the {{multiplier}} (how many zeros). Tap its colour:').replace(/\{\{([^}]+)\}\}/g, '$1') + '</p>' + chips + val;
    },
    redrawBands: function () {
      var el = document.querySelector('#goal .bands'); if (!el) return;
      el.innerHTML = this.bandsHtml();
      // keep the chips in sight if the card has to scroll (small phones)
      var ch = el.querySelector('.chips'); if (ch && ch.scrollIntoView) ch.scrollIntoView({ block: 'nearest' });
    },
    checkBands: function (picked) {
      var lv = this.level, step = lv.def.steps[lv.step]; if (!step || !step.bands) return;
      picked = picked || (lv.bandPick || [null, null, null]).slice();
      // feedback goes in the picker itself (a toast would cover the zoomed resistor the player must look at)
      if (picked.some(function (x) { return !x; })) { lv.bandNote = ['info', 'Pick a colour for each of the 3 bands.']; lv.bandSlot = picked.findIndex(function (x) { return !x; }); this.redrawBands(); return; }
      var want = step.bands.want, bad = [], names = ['1st', '2nd', '3rd'];
      for (var k = 0; k < 3; k++) if (picked[k] !== want[k]) bad.push(k);
      if (!bad.length) { lv.bandNote = null; lv.bandBad = null; this.stepDone(step.bands.ok); return; }
      lv.wrong = (lv.wrong || 0) + 1;
      lv.bandBad = bad; lv.bandSlot = bad[0];
      // say what the player's colours mean, then where to look again (without giving the answer)
      var DG = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'grey', 'white'];
      var ohm = (DG.indexOf(picked[0]) * 10 + DG.indexOf(picked[1])) * Math.pow(10, DG.indexOf(picked[2]));
      var f0 = bad[0], col = picked[f0], cap = col.charAt(0).toUpperCase() + col.slice(1);
      var mean = f0 < 2 ? cap + ' is ' + DG.indexOf(col) : cap + ' means × ' + Math.pow(10, DG.indexOf(col));
      lv.bandNote = ['bad', mean + ', so your answer is ' + (ohm >= 1000 ? ohm / 1000 + ' kΩ' : ohm + ' Ω') + '. Look at the ' + names[f0] + ' band again: is it really ' + col + '?' +
        (f0 < 2 ? ' Read from the end away from the gold band.' : '') + (bad.length > 1 ? ' (The ' + names[bad[1]] + ' band is not right either.)' : '')];
      this.redrawBands();
      audio.blip(220, 0.18, 'sawtooth', 0.04);
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
      lv.tapped = lv.tapped || {};
      var wasReady = step && step.ready ? step.ready(lv.tapped) : true;
      lv.tapped[h] = true;
      if (step && step.ready && !wasReady && step.ready(lv.tapped)) this.renderGoal();
      if (!step || !step.tap || lv.done) return;
      var r = step.tap(this.L(), h);
      if (r.ok) this.stepDone(r.msg); else { if (r.wrong !== false && !onPart) lv.wrong = (lv.wrong || 0) + (r.count ? 1 : 0); this.toast(r.msg, 'bad'); audio.blip(220, 0.15, 'sawtooth', 0.035); }
    },
    updateTop: function () {
      var t = $('#topbar');
      var title = this.mode === 'level' ? 'Level ' + this.level.def.n + ': ' + esc(this.level.def.title) : 'Sandbox';
      var html = '<button data-act="home" class="ibtn" title="All levels">' + icon('back') + '</button><div class="ttl">' + title + '</div>';
      if (this.mode === 'level') html += '<button data-act="restart" class="ibtn" title="Start this level again">' + icon('rotate') + '</button><button data-act="hint" class="ibtn" title="Hint">' + icon('hint') + '</button>';
      if (this.mode === 'sandbox') html += '<button data-act="chal" class="ibtn chalbtn" title="Challenges">' + icon('star') + '</button><button data-act="board" class="ibtn" title="Board size">' + icon('board') + '</button><button data-act="clear" class="ibtn" title="Clear the bench">' + icon('trash') + '</button>';
      html += '<button data-act="sound" class="ibtn" title="Sound on/off">' + icon(audio.on ? 'sound' : 'mute') + '</button>';
      t.innerHTML = html;
    },

    // ---------- sandbox ----------
    startSandbox: function () {
      store.data.where = { sandbox: true }; store.save();
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
      try { this.sim.step(0.001); } catch (err) {
        // a saved bench that cannot load must never lock the player out
        this.sim = new BB.Sim({ board: { cols: 30 }, parts: [] }); this.bench.setSim(this.sim); this.sim.step(0.001);
        this.toast('Your saved sandbox could not be loaded, so it starts empty.', 'bad');
      }
      this.fitView();
      this.bench.render(true);
      this.onSelect(null);
      if (!state.parts.length) this.toast(window.innerWidth < 1100 ? 'Tap “Parts” to add components. Start with a battery or the MB102 power board.' : 'Pick a part on the left to add it. Start with a battery or the MB102 power board.', 'info');
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
      var self = this;
      clearTimeout(this._saveT);
      if (this.mode === 'sandbox') this._saveT = setTimeout(function () { self.saveNow(); }, 400);
      else if (this.mode === 'level' && this.level && this.level.ready && !this.level.done) this._saveT = setTimeout(function () { self.saveNow(); }, 400);
    },
    // save the sandbox, or the level in progress (so a reload in the middle loses nothing)
    saveNow: function () {
      clearTimeout(this._saveT);
      if (this.mode === 'sandbox' && this.sim) store.data.sandbox = JSON.parse(this.serialize());
      else if (this.mode === 'level' && this.level && this.level.ready && !this.level.done) {
        var lv = this.level;
        store.data.levelSave = { i: lv.def.n - 1, state: this.serialize(), step: lv.step, flags: lv.flags, hints: lv.hints, mistakes: lv.mistakes, wrong: lv.wrong || 0, tapped: lv.tapped || {} };
      } else return;
      store.save();
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
        var loose = 0;
        self.sim.state.parts.forEach(function (p) { if (p.ends) p.ends = p.ends.map(function (e) { if (e.at && e.at.slice(0, 2) !== 'P:' && !nb.byId[e.at]) { loose++; var pos = self.sim.endPos(e); return { x: pos.x, y: pos.y }; } return e; }); });
        self.sim.setBoard(cfg);
        var lifted = 0;
        self.sim.state.parts.forEach(function (p) {
          if (PARTS[p.type].kind !== 'rigid' || p.free) return;
          if (self.sim.pinPoints(p).some(function (q) { return !q.at; })) { p.free = true; lifted++; }
        });
        if (lifted || loose) self.toast((lifted ? lifted + ' part' + (lifted > 1 ? 's' : '') + ' did not fit and ' + (lifted > 1 ? 'are' : 'is') + ' lifted off. ' : '') + (loose ? loose + ' leg' + (loose > 1 ? 's are' : ' is') + ' now loose. ' : '') + 'Drag them back onto the board.', 'info');
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
      if (items) { groups = { all: list.map(function (it) { return typeof it === 'string' ? { type: it } : it; }) }; cats = { all: '' }; } // levels: one grid, in the level's order
      Object.keys(cats).forEach(function (c) {
        if (!groups[c]) return;
        if (!items) html += '<h4>' + cats[c] + '</h4>';
        html += '<div class="tgrid">' + groups[c].map(function (spec) {
          var def = PARTS[spec.type];
          var label = def.name;
          if (spec.type === 'resistor' && spec.props) label = 'Resistor ' + BB.fmt.R(spec.props.r);
          if (spec.type === 'led' && spec.props) label = BB.engine.LED_TYPES[spec.props.color].label + ' LED';
          return '<button class="titem" aria-label="' + esc(label) + '" data-spec=\'' + esc(JSON.stringify(spec)) + '\'><span class="tpic" aria-hidden="true">' + trayPic(spec) + '</span><span class="tl">' + esc(label) + '</span></button>';
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
      // a new part must not touch a strip that is already used (that would wire it into
      // another part) and must not sit on top of another part's body
      var usedStrip = {};
      Object.keys(occ).forEach(function (id) { var h = b.byId[id]; if (h) usedStrip[h.strip] = true; });
      var free = function (id) { return id && b.byId[id] && !occ[id] && !cov[id] && !usedStrip[b.byId[id].strip]; };
      var bodies = sim.state.parts.filter(function (q) { return q.type !== 'wire'; }).map(function (q) { return sim.bodyRect(q); });
      var overlaps = function (r) { return bodies.some(function (o) { return r.x0 < o.x1 - 0.2 && r.x1 > o.x0 + 0.2 && r.y0 < o.y1 - 0.2 && r.y1 > o.y0 + 0.2; }); };
      var p = null;
      // leads parts go in rows c–h, away from the rails (their bodies would hide the rail holes)
      var byDist = b.holes.filter(function (h) { return h.kind === 'term' && (def.kind !== 'leads' || (h.y >= 5 && h.y <= 12)); }).sort(function (a, d) { return Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(d.x - c.x, d.y - c.y); });
      if (def.kind === 'leads') {
        var span = { led: 1, resistor: 4, capacitor: 1, ldr: 2 }[type] || 2;
        for (var i = 0; i < byDist.length && !p; i++) {
          var h = byDist[i], h2 = b.byId[h.row + (h.col + span)];
          if (free(h.id) && free(h2 && h2.id)) {
            var cand = BB.newPart(type, { props: props, ends: [h.id, h2.id] });
            if (!overlaps(sim.bodyRect(cand))) p = cand;
          }
        }
        if (!p) { var ls = this.freeSpot({ size: [span + 2, 3] }); p = BB.newPart(type, { props: props, ends: [{ x: ls.x + 1, y: ls.y + 2 }, { x: ls.x + 1 + span, y: ls.y + 2 }] }); }
      } else if (def.kind === 'rigid' && this.mode === 'level' && (this.level.def.placeFree || []).indexOf(type) >= 0) {
        // where to put it IS the lesson here: it starts next to the board, the player plugs it in
        var r0 = BB.newPart(type, { props: props, x: 0, y: 0 }), br = sim.bodyRect(r0);
        p = BB.newPart(type, { props: props, x: Math.round(c.x - (br.x1 + br.x0) / 2), y: Math.round(b.y1 + 2 - br.y0), free: true });
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
          var tr = sim.bodyRect(test);
          var onBoard = type === 'mb102' || (tr.x0 >= b.x0 - 0.5 && tr.x1 <= b.x1 + 0.5); // do not hang off the end of the board
          if (onBoard && pts.every(function (q) { return free(q.at); }) && (type === 'mb102' || !overlaps(tr))) p = test;
        }
        if (!p) {
          // no room on the board: put it next to the board, where nothing else lies
          var bd = def.body, sp = this.freeSpot({ size: [bd[2] - bd[0], bd[3] - bd[1]] });
          p = BB.newPart(type, { props: props, x: sp.x - bd[0], y: sp.y - bd[1], free: true });
        }
      } else {
        // modules and off-board parts go next to the board
        var spot = this.freeSpot(type === 'meter' ? { size: [def.size[0], def.size[1] + 6] } : def); // + room for the meter's probes below it
        p = BB.newPart(type, { props: props, x: spot.x, y: spot.y });
        if (def.kind === 'module') {
          var lf = def.leadFrom;
          p.ends = lf.map(function (q, k2) { return def.leadOut ? { x: spot.x + q[0] + 2 + k2 * 2, y: spot.y + def.size[1] + 2 } : { x: spot.x + q[0] + 3, y: spot.y + q[1] }; });
          if (type === 'meter') p.ends = [{ x: spot.x + 5, y: spot.y + 30 }, { x: spot.x + 10, y: spot.y + 30 }];
          var railsUsed = b.holes.some(function (h) { return h.kind === 'rail' && occ[h.id]; });
          if ((type === 'battery9' || type === 'aa') && !railsUsed) {
            var plus = b.holes.filter(function (h) { return h.row === 'T+' && free(h.id); })[0], minus = b.holes.filter(function (h) { return h.row === 'T-' && free(h.id); })[0];
            if (plus && minus) p.ends = [{ at: plus.id }, { at: minus.id }];
          }
        }
      }
      if (type === 'wire' && !p.props.color) p.props.color = 'red';
      if (this.mode === 'level' && this.level) this.level.acted = true;
      sim.state.parts.push(p);
      sim.dirty();
      this.commit(u);
      $('#toasts').innerHTML = '';
      bench.select(p.id, true); // selected (outlined), but the phone sheet stays closed so the board stays visible
      bench.render();
      this.ensureVisible(p);
      if (type === 'pot') this.toast('Added. Drag the knob to turn it. To move the whole part, hold the knob still for a moment, then drag.', 'info');
      else if (!this._addedTip) { this._addedTip = true; this.toast(def.kind === 'leads' ? 'Added. Drag it into place. Drag the end of a leg to move just that leg.' : 'Added. Drag it into place.', 'info'); }
      return p;
    },
    freeSpot: function (def) {
      var sim = this.sim, b = sim.board;
      // a module's flying leads count as part of it (a new part must not land under the meter's probes)
      var rects = sim.state.parts.map(function (p) {
        var r = Object.assign({}, sim.bodyRect(p));
        if (PARTS[p.type].kind === 'module' && p.ends) sim.pinPoints(p).forEach(function (q) { r.x0 = Math.min(r.x0, q.x - 1); r.x1 = Math.max(r.x1, q.x + 1); r.y0 = Math.min(r.y0, q.y - 1); r.y1 = Math.max(r.y1, q.y + 4); });
        return r;
      });
      rects.push({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 });
      var w = def.size[0], h = def.size[1];
      var tries = [];
      // batteries sit above the board, so their leads go straight down into the rails
      if (def.spot === 'above') for (var a = 0; a < 4; a++) tries.push({ x: b.x0 + 3 + a * (w + 2), y: b.y0 - h - 3 });
      // below the board in a grid: 3 to a row, then the next row (not one endless line)
      for (var rrow = 0; rrow < 6; rrow++) for (var k = 0; k < 3; k++) tries.push({ x: b.x0 + k * (Math.max(w, 12) + 2), y: b.y1 + 3 + rrow * 16 });
      for (var r2 = 0; r2 < 40; r2++) for (var k3 = 0; k3 < 4; k3++) tries.push({ x: b.x0 + k3 * (Math.max(w, 12) + 2), y: b.y1 + 99 + r2 * 8 }); // further down, never on top of another part
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
      if ((p.locked || p.keep) && user) { this.toast('This part belongs to the level, so it cannot be deleted. Move it instead, or tap ⟳ to restart the level.', 'info'); return; }
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
      return JSON.stringify(this.sim.state, function (k, v) { if (k && (k[0] === '_' || k === 'vis' || k === 'lastV' || k === 'lastVpeak' || k === 'pinI' || k === 'io' || k === 'smoke' || k === 'ioKey')) return undefined; return v; });
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
      var st = JSON.parse(s), now = {};
      this.sim.state.parts.forEach(function (p) { now[p.id] = p; });
      // undo puts parts back where they were, but a burnt LED stays burnt (like on a real desk)
      var KEEP = ['burnt', 'burntBy', 'burntSeg', 'dead', 'deadWhy', 'damaged', 'damageWhy', 'fuse'];
      st.parts.forEach(function (p) {
        p.st = p.st || {};
        var cur = now[p.id]; if (!cur) return;
        KEEP.forEach(function (k) { if (cur.st[k] !== undefined) p.st[k] = cur.st[k]; });
      });
      this.sim.state.parts = st.parts;
      if (st.board.cols !== this.sim.board.cols || !!st.board.split !== !!this.sim.board.split) { this.sim.setBoard(st.board); this.bench.renderBoard(); }
      this.sim.dirty();
      this.bench.select(null);
      this.bench.render(true);
      this.saveSandbox();
    },

    // ---------- inspector ----------
    showSheet: function () { document.body.classList.add('hassel'); var sp = this.bench.sel && this.sim.part(this.bench.sel); if (sp && window.innerWidth < 1100) this.focusPart(sp); },
    // phones: make the selected part big enough to work on, and keep it above the sheet
    focusPart: function (p) {
      var bench = this.bench;
      if (bench.drag) return; // never move the view while a finger drags
      var big = PARTS[p.type].kind === 'module' || PARTS[p.type].kind === 'offboard' || p.type === 'mb102' || (PARTS[p.type].props || []).some(function (q) { return q.env; }); // sensors you set (light, sound…): keep the screen / speaker in view // the meter, batteries, Pi...: do not zoom into them
      // fold the task card only for small parts placed on the board; for boards and the meter the task tells what to pick in the sheet
      if (this.mode === 'level') document.body.classList.add('goalmin'); // the sheet shows the step text instead
      if (big) { this.frameForSheet(p); return; } // the meter, sensors...: frame what the player must watch, above the sheet
      if (!this._viewBefore) this._viewBefore = Object.assign({}, bench.view); // put back when the sheet closes
      if (bench.view.s * 10 < 19) bench.view.s = 2.2;
      // centre the part's pins (where the player works) in the free area between the goal card and the sheet
      var pts = this.sim.pinPoints(p), r = this.sim.bodyRect(p);
      var cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
      if (pts.length) { cx = 0; cy = 0; pts.forEach(function (q) { cx += q.x; cy += q.y; }); cx /= pts.length; cy /= pts.length; }
      var sz = bench.size(), g = $('#goal');
      var top = this.mode === 'level' && g.offsetParent ? g.offsetTop + g.offsetHeight + 8 : 8, bottom = sz.h * 0.6;
      bench.view.tx = sz.w / 2 - cx * 10 * bench.view.s;
      bench.view.ty = (top + bottom) / 2 - cy * 10 * bench.view.s;
      bench.applyView(); bench.renderUi();
      this._viewFocus = Object.assign({}, bench.view);
    },
    // A sheet is opening for p: fit the area the player must watch between the task card and the sheet.
    // Sensors: the sensor and the screen / speaker that shows its effect. Meter: its probe tips on the board.
    frameForSheet: function (p) {
      var sim = this.sim, bench = this.bench, def = PARTS[p.type], box = null;
      var add = function (r) { box = box ? { x0: Math.min(box.x0, r.x0), y0: Math.min(box.y0, r.y0), x1: Math.max(box.x1, r.x1), y1: Math.max(box.y1, r.y1) } : Object.assign({}, r); };
      if ((def.props || []).some(function (q) { return q.env; })) {
        add(sim.bodyRect(p));
        sim.state.parts.forEach(function (q) { if (['oled', 'lcd', 'speaker', 'buzzer', 'seg7', 'wio'].indexOf(q.type) >= 0) add(sim.bodyRect(q)); });
      } else if (p.type === 'meter') {
        sim.pinPoints(p).forEach(function (q) { if (q.at) add({ x0: q.x - 4, y0: q.y - 3, x1: q.x + 4, y1: q.y + 3 }); });
      }
      if (!box) return;
      var sz = bench.size(), g = $('#goal');
      var top = this.mode === 'level' && g.offsetParent ? g.offsetTop + g.offsetHeight + 8 : 8;
      var sheetTop = sz.h - Math.min(Math.max(0.36 * sz.h, 290), 0.56 * sz.h); // the sheet's height rule in style.css
      var w = (box.x1 - box.x0 + 1) * 10, h = (box.y1 - box.y0 + 1) * 10;
      var s = Math.min(2.2, (sz.w - 16) / w, Math.max(40, sheetTop - top - 12) / h);
      if (!this._viewBefore) this._viewBefore = Object.assign({}, bench.view);
      bench.view.s = s;
      bench.view.tx = sz.w / 2 - (box.x0 + box.x1) / 2 * 10 * s;
      bench.view.ty = (top + sheetTop) / 2 - (box.y0 + box.y1) / 2 * 10 * s;
      bench.applyView(); bench.renderUi();
      this._viewFocus = Object.assign({}, bench.view);
    },
    // the sheet closed: go back to the view from before the part was zoomed in, unless the player moved it since
    restoreView: function () {
      var vb = this._viewBefore, vf = this._viewFocus, v = this.bench.view;
      this._viewBefore = this._viewFocus = null;
      if (!vb || !vf || Math.abs(v.s - vf.s) > 1e-6 || Math.abs(v.tx - vf.tx) > 1 || Math.abs(v.ty - vf.ty) > 1) return;
      Object.assign(v, vb); this.bench.applyView(); this.bench.renderUi();
    },
    onSelect: function (id, quiet) {
      id = id || null;
      var ins = $('#inspector'), self = this;
      if (id !== this._lastSel) document.body.classList.remove('insfull');
      this._lastSel = id;
      document.body.classList.toggle('hassel', !!id && !quiet);
      if (id && !quiet && window.innerWidth < 1100) { var sp = this.sim.part(id); if (sp) this.focusPart(sp); }
      if (!id) {
        this.restoreView();
        document.body.classList.remove('goalmin'); // the sheet showed the step; now the card shows it again
        ins.innerHTML = '<p class="mut small empty">' + icon('info') + ' Tap a part to see its values here. Tap a hole to see what is connected to it.</p>';
        return;
      }
      var p = this.sim.part(id), def = PARTS[p.type];
      var lock = this.mode === 'level' ? (this.level.def.lock || []) : [];
      var html = '<div class="ihead"><h3>' + esc(def.name) + '</h3><button class="ibtn closeins" title="Close">' + icon('close') + '</button></div><p class="desc">' + rich(def.desc) + '</p>';
      // phones: the folded goal card's current step, repeated at the top of the sheet
      html += '<div class="acts" id="acts"></div>'; // Delete / Flip / New part first: on a phone the sheet is short
      if (def.mcu) html += '<div class="ctls progfirst">' + this.programUi(p, lock.indexOf('program') >= 0) + '</div>'; // the program comes first: steps ask for it
      html += '<!--meterctls-->' + this.stepTaskHtml(); // the step text comes after the controls the step asks for
      html += '<div class="vals" id="vals"></div>';
      html += '<button class="insmore" data-a="more">' + (document.body.classList.contains('insfull') ? 'Show less ▾' : 'More ▴') + '</button>';
      var ctrls = '';
      (def.props || []).forEach(function (pr) {
        if (p.hideValue && pr.k === 'r') return;
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

      // the meter: its dial row first (the steps ask for it); other parts: controls after the values
      var envFirst = (def.props || []).some(function (q) { return q.env; }); // a sensor's light / sound slider is what the step asks for
      if (envFirst && p.type !== 'meter') html = html.replace('<!--meterctls-->', '<div class="ctls">' + ctrls + '</div>');
      else if (p.type === 'meter') html = html.replace('<div class="vals" id="vals"></div>', '').replace('<!--meterctls-->', '<div class="ctls">' + ctrls + '</div><div class="vals" id="vals"></div>'); // dial, reading, then the step
      else if (!envFirst) html += '<div class="ctls">' + ctrls + '</div>';
      var acts = '';
      if (p.type === 'button') acts += '<button class="holdbtn" data-a="hold">Hold to press</button>';
      (def.actions || []).forEach(function (a) { acts += '<button data-a="' + a.id + '">' + esc(a.label) + '</button>'; });
      if ((def.kind === 'leads' || def.kind === 'module') && p.ends.length === 2 && !p.locked && p.type !== 'wire') acts += '<button data-a="flip">' + icon('flip') + ' Flip</button>';
      if (def.kind === 'rigid' && !def.noRotate && !p.locked) acts += '<button data-a="rotate">' + icon('rotate') + ' Rotate</button>';
      if (p.st.burnt || (p.st.burntSeg && Object.keys(p.st.burntSeg).length)) acts += '<button class="primary" data-a="renew">New ' + (p.type === 'led' ? 'LED' : 'part') + '</button>';
      if (def.mcu && (p.st.dead || (p.st.damaged && Object.keys(p.st.damaged).length))) acts += '<button class="primary" data-a="renew">New board</button>';
      if (p.type === 'meter' && p.st.fuse) acts += '<button class="primary" data-a="fuse">New fuse</button>';
      if (!p.locked && !p.keep) acts += '<button class="danger" data-a="del">' + icon('trash') + ' Delete</button>';
      ins.innerHTML = html;
      $('#acts').innerHTML = acts;
      this.refreshInspector();
      var setProp = function (k, v) { var u = self.snapshot(); p.props[k] = v; self.sim.dirty(); self.commit(u); self.bench.render(); self.onInteract('prop', p); };
      ins.onchange = function (e) {
        var t = e.target, k = t.dataset.k;
        if (t.type === 'range') { if (self._rangeUndo) self.commit(self._rangeUndo); self._rangeUndo = null; return; }
        if (t.dataset.prog) { setProp('program', t.value); document.body.classList.remove('insfull'); self.onSelect(id); var sp = self.sim.part(id); if (sp && window.innerWidth < 1100) self.ensureVisible(sp); return; }
        if (t.dataset.role) { var u = self.snapshot(); p.props.pins = Object.assign({}, p.props.pins || {}); p.props.pins[t.dataset.role] = t.value; self.commit(u); self.sim.dirty(); return; }
        if (!k) return;
        var pr = (def.props || []).find(function (q) { return q.k === k; });
        if (t.tagName === 'SELECT' && pr) { setProp(k, pr.options[+t.value]); self.onSelect(id); }
      };
      ins.oninput = function (e) {
        var t = e.target, k = t.dataset.k; if (!k || t.type !== 'range') return;
        var pr = def.props.find(function (q) { return q.k === k; });
        if (!self._rangeUndo) self._rangeUndo = self.snapshot(); // one undo step per slider move
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
        if (a === 'fuse') { var u3 = self.snapshot(); p.st.fuse = false; self.sim.dirty(); self.commit(u3); self.onSelect(id); }
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
      // the real code, so the player can do the same on their own board
      var src = BB.programs.code(p, cur, this.sim);
      if (src) s += '<details class="code"><summary>See the code (' + (mcu === 'pi5' ? 'Python, gpiozero' : 'Arduino') + ')</summary><pre>' + esc(src) + '</pre>' +
        '<p class="small mut">' + (mcu === 'pi5' ? 'Save it as blink.py on the Pi and run: python3 blink.py' : 'Paste it into the Arduino IDE, pick your board, and press Upload.') + '</p></details>';
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
      // the mic's label follows what it hears (a clap is loud even with the slider on quiet)
      var so = p.type === 'mic' && document.querySelector('#inspector [data-out=sound]');
      if (so) {
        var lvS = Math.max(p.props.sound || 0, p.st.level || 0), sd = (def.props[0].fmt)(lvS); if (so.textContent !== sd) so.textContent = sd;
        var sIn = document.querySelector('#inspector input[data-k=sound]'); if (sIn && document.activeElement !== sIn && +sIn.value !== lvS) sIn.value = lvS; // the thumb shows the clap too (the setting is unchanged)
      }
      var pos = document.querySelector('#inspector input[data-k=pos]');
      if (pos && document.activeElement !== pos && +pos.value !== p.props.pos) { pos.value = p.props.pos; var o = document.querySelector('#inspector [data-out=pos]'); if (o) o.textContent = Math.round(p.props.pos * 100) + ' %'; }
    },
    rotatePart: function (p) {
      var u = this.snapshot(), sim = this.sim, def = PARTS[p.type];
      var old = p.rot || 0;
      // turn around the part's centre, so it stays where it was
      var r0 = sim.bodyRect(p), c0 = { x: (r0.x0 + r0.x1) / 2, y: (r0.y0 + r0.y1) / 2 };
      p.rot = (old + 90) % 360;
      var r1 = sim.bodyRect(p);
      p.x += c0.x - (r1.x0 + r1.x1) / 2; p.y += c0.y - (r1.y0 + r1.y1) / 2;
      // keep it plugged in if the rotated pins fit nearby, else lift it off the board
      var pts = sim.pinPoints(p), occ = sim.occupancy(), cov = sim.covered();
      var ok = !p.free && pts.every(function (q) { return q.at && (!occ[q.at] || occ[q.at].id === p.id) && (!cov[q.at] || cov[q.at] === p.id); });
      if (!ok) {
        var found = false;
        var cands = [];
        for (var dx = -4; dx <= 4; dx++) for (var dy = -4; dy <= 4; dy++) cands.push([dx, dy]);
        cands.sort(function (a, b) { return Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]); });
        for (var ci = 0; ci < cands.length && !found; ci++) {
          var x0 = Math.round(p.x) + cands[ci][0], y0 = Math.round(p.y) + cands[ci][1];
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
    onInteract: function (what, p) { if (this.mode === 'level') { if (this.level) this.level.acted = true; this.checkLevel(); } this.saveSandbox(); },

    // ---------- the action API (used by tests and level setups) ----------
    actions: function () {
      var self = this;
      var id = function (x) { return typeof x === 'string' ? x : x.id; };
      // a typo in a test or a level setup (or a rail gap like T-13) must fail loudly, not leave a loose leg
      var checkHole = function (at) { if (typeof at === 'string' && at.slice(0, 2) !== 'P:' && !self.sim.board.byId[at]) throw new Error('No hole called ' + at + ' on this board'); };
      var A = {
        add: function (type, init) { var p = BB.newPart(type, init || {}); (p.ends || []).forEach(function (e) { checkHole(e && e.at); }); self.sim.state.parts.push(p); self.sim.dirty(); if (self.bench.sim === self.sim) self.bench.render(); return p; },
        wire: function (a, b) { return self.addWire(a, b); },
        del: function (x) { self.removePart(id(x)); },
        flip: function (x) { var p = self.sim.part(id(x)); p.ends.reverse(); self.sim.dirty(); },
        moveEnd: function (x, k, at) { checkHole(at); var p = self.sim.part(id(x)); p.ends[k] = { at: at }; self.sim.dirty(); },
        move: function (x, px, py, rot) { var p = self.sim.part(id(x)); p.x = px; p.y = py; if (rot !== undefined) p.rot = rot; p.free = false; self.sim.dirty(); },
        set: function (x, k, v) { var p = self.sim.part(id(x)); p.props[k] = v; self.sim.dirty(); self.onInteract('prop', p); },
        press: function (x, on) { var p = self.sim.part(id(x)); p.st.pressed = on; self.sim.dirty(); },
        action: function (x, a) { self.partAction(self.sim.part(id(x)), a); },
        tap: function (h) { self.bench.hiHole = h; self.onTapHole(h); },
        xray: function (on) { self.setXray(on); self.checkLevel(); },
        choose: function (i) { self.choose(i); },
        bands: function (arr) { self.checkBands(arr); },
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
        // show the new state (e.g. “New LED”), but never open the sheet or move the view under a dragging finger
        if (self.bench.sel === ev.part) { if (self.bench.drag) self._pendingSel = ev.part; else self.onSelect(ev.part, !document.body.classList.contains('hassel')); }
      });
      sim.events = [];
      if (this.mode === 'level' && this.level && !this.level.done) {
        var lv = this.level;
        sim.res.issues.forEach(function (is) {
          if (is.kind === 'short' && !lv.baseline.short && !lv.issueSeen.short) { lv.issueSeen.short = true; lv.mistakes++; }
        });
        if (!sim.res.issues.some(function (is) { return is.kind === 'short'; })) { lv.issueSeen.short = false; lv.baseline.short = false; }
        // too much voltage on a board pin is a mistake too (once each time it happens)
        var ovNow = {};
        sim.res.issues.forEach(function (is) {
          if (is.kind !== 'overvolt' || is.level !== 'danger') return;
          var key = 'ov:' + is.part + ':' + is.pin; ovNow[key] = 1;
          if (!lv.issueSeen[key]) { lv.issueSeen[key] = true; lv.mistakes++; lv.overv = (lv.overv || 0) + 1; }
        });
        Object.keys(lv.issueSeen).forEach(function (k) { if (k.slice(0, 3) === 'ov:' && !ovNow[k]) lv.issueSeen[k] = false; });
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
      var lvl = this.mode === 'level';
      var iss = sim.res.issues.filter(function (i) { return !(lvl && i.kind === 'floating'); }).sort(function (a, b) { return (a.level === 'danger' ? 0 : 1) - (b.level === 'danger' ? 0 : 1); });
      var msg = null;
      var lvd = lvl && this.level && !this.level.done ? this.level.def : null, first = null;
      if (iss.length && lvd && lvd.explainFirst && lvd.explain && this.level.acted) { try { first = typeof lvd.explainFirst === 'function' ? lvd.explainFirst(this.L()) : lvd.explain(this.L()); } catch (e) { first = null; } }
      if (first) msg = { level: iss[0].level, title: 'Why it does not work yet', text: first };
      else if (iss.length) msg = { level: iss[0].level, title: iss[0].title, text: iss[0].text };
      else if (this.mode === 'level' && this.level && !this.level.done && this.level.def.explain) {
        var t = null; try { t = this.level.def.explain(this.L()); } catch (e) { t = null; }
        // a blinking pin makes the reason come and go every half second: keep it on screen for a while
        var lvk = this.level, nowk = performance.now();
        var running = sim.state.parts.some(function (q) { return PARTS[q.type].mcu && q.props.program && q.props.program !== 'none'; });
        if (lvk.explainStep !== lvk.step) { lvk.explainStep = lvk.step; lvk.explainSeen = 0; lvk.lastExplain = null; }
        if (t) lvk.explainSeen = nowk; else if (running && lvk.lastExplain && lvk.explainSeen && nowk - lvk.explainSeen < 1500) t = lvk.lastExplain; // a blinking pin: keep it steady
        if (t && this.level.acted) {
          // wait a little before explaining, so we do not nag while the player is still building
          var lv = this.level;
          if (lv.lastExplain !== t) { lv.lastExplain = t; lv.explainT = performance.now(); }
          if (performance.now() - lv.explainT > 1800) msg = { level: 'info', title: 'Why it does not work yet', text: t };
        }
      }
      var runningB = sim.state.parts.some(function (q) { return PARTS[q.type].mcu && q.props.program && q.props.program !== 'none'; }), nowB = performance.now();
      if (msg) this._banHold = { msg: msg, t: nowB, step: lvl && this.level ? this.level.step : -1 };
      else if (runningB && this._banHold && nowB - this._banHold.t < 1500 && this._banHold.step === (lvl && this.level ? this.level.step : -1)) msg = this._banHold.msg; // keep it steady through the blink
      var key = msg ? msg.level + msg.title + msg.text : '';
      if (key === this._banKey) return;
      this._banKey = key;
      if (!msg) { ban.hidden = true; return; }
      ban.hidden = false;
      ban.className = 'banner ' + msg.level;
      this.placeBanner();
      ban.innerHTML = '<b>' + esc(msg.title) + '</b><span>' + rich(msg.text) + '</span>';
      this.bench.renderUi();
    },

    placeBanner: function () {
      var ban = $('#banner'), g = $('#goal');
      if (window.innerWidth >= 1100) { ban.style.top = ''; var tb = $('#toasts'); if (tb) tb.style.bottom = ban.hidden ? '' : (ban.offsetHeight + 28) + 'px'; return; } // toasts stay above the banner
      var top = 8;
      if (this.mode === 'level' && g.offsetParent) top = g.offsetTop + g.offsetHeight + 6;
      ban.style.top = top + 'px';
    },
    // ---------- small UI pieces ----------
    toast: function (text, kind, high) { // high: phones, under the task card (keeps the lower screen free)
      var t = document.createElement('div');
      t.className = 'toast ' + (kind || 'info');
      t.innerHTML = rich(text);
      $('#toasts').appendChild(t);
      var all = $('#toasts').children, max = window.innerWidth < 1100 ? 1 : 2; while (all.length > max) all[0].remove();
      // phones: above the toolbar; while a sheet is open, under the goal card instead.
      // They never take taps, and the next touch on the bench clears them.
      var box = $('#toasts');
      if (window.innerWidth < 1100) {
        var sheet = high || document.body.classList.contains('hassel') || document.body.classList.contains('trayopen');
        if (sheet) {
          var g = $('#goal'), tb = $('#topbar'), gr = g && g.offsetParent && this.mode === 'level' ? g.getBoundingClientRect() : null;
          box.style.top = Math.round((gr ? gr.bottom : (tb.offsetParent ? tb.getBoundingClientRect().bottom : 8)) + 6) + 'px';
          box.style.bottom = 'auto';
        } else { box.style.top = 'auto'; box.style.bottom = 'calc(74px + env(safe-area-inset-bottom, 0px))'; }
      } else { var bn = $('#banner'); box.style.top = ''; box.style.bottom = bn && !bn.hidden && bn.offsetHeight ? (bn.offsetHeight + 28) + 'px' : ''; } // desktop: above the problem banner, never on it
      setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 400); }, kind === 'info' ? 3400 : 4200);
    },
    say: function (what) { if (what === 'wireStart') this.toast('Now tap the second hole.', 'info'); },
    modal: function (html, cb, where) {
      var m = $('#modal'), downHere = false;
      m.innerHTML = '<div class="mbox">' + html + '</div>';
      m.className = where === 'bottom' ? 'bottom' : '';
      m.hidden = false;
      m.onpointerdown = function () { downHere = true; };
      m.onclick = function (e) {
        // ignore a tap whose finger went down before the box opened (its click lands on the box); keyboard clicks have detail 0
        if (!downHere && e.detail !== 0) return;
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
    { id: 'nanoMB', title: 'Nano from the MB102.', text: 'Unplug the Nano’s USB cable (switch USB off in its panel). Power it from a 5V rail: rail + → Nano 5V pin, rail − → Nano GND.', check: function (L) { return L.of('nano').some(function (n) { return n.props.usb === false && n.st.powered && n.st.extPowered; }); } },
    { id: 'cap', title: 'Charge a capacitor.', text: 'Put a 1000 µF capacitor (+ leg to +) in series with a 1 kΩ resistor on a 5V rail. Tap the capacitor and watch its voltage rise: after one {{time constant}} (1 kΩ × 1000 µF = 1 second) it has about 63 % of 5 V.', check: function (L, f) {
      // a real RC charge: from below 1 V to over 4.5 V, ending near 5 V (not 9 V), and slowly (a resistor in series)
      return L.of('capacitor').some(function (c) {
        var v = (c.vis && c.vis.v) || 0, t = L.sim.t;
        if (v < 1 && c.props.c >= 1000e-6) { f.low = true; f.t0 = t; }
        return f.low && v > 4.5 && v < 5.2 && t - f.t0 > 0.8;
      });
    } },
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
      if (spec.type === 'led') vb = [-12, -42, 34, 48]; // the LED body stands above its legs
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
