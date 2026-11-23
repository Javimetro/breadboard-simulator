// Component library: pins, geometry, properties and electrical models. No DOM.
// Drawing lives in art.js. Microcontroller programs live in programs.js.
(function () {
  'use strict';
  var BB = (globalThis.BB = globalThis.BB || {});
  var E = BB.engine;

  // ---------- helpers ----------
  function fmtR(r) {
    if (r >= 1e6) return +(r / 1e6).toPrecision(3) + ' MΩ';
    if (r >= 1e3) return +(r / 1e3).toPrecision(3) + ' kΩ';
    return +r.toPrecision(3) + ' Ω';
  }
  function fmtI(i) {
    var a = Math.abs(i);
    if (a >= 1) return (+i.toPrecision(3)) + ' A';
    if (a >= 1e-3) return (+(i * 1e3).toPrecision(3)) + ' mA';
    if (a >= 1e-6) return (+(i * 1e6).toPrecision(3)) + ' µA';
    return '0 mA';
  }
  function fmtV(v) { return (Math.abs(v) < 0.005 ? '0.00' : v.toFixed(2)) + ' V'; }
  function fmtP(p) { return p >= 1 ? p.toFixed(2) + ' W' : Math.round(p * 1000) + ' mW'; }
  BB.fmt = { R: fmtR, I: fmtI, V: fmtV, P: fmtP };

  // Heating: a part above its limit warms up and fails after `secs` seconds.
  // Far above the limit (`instant` × limit) it fails at once.
  function heat(st, value, limit, dt, secs, instant) {
    st.heat = st.heat || 0;
    if (value > limit * instant) st.heat = 1;
    else if (value > limit) st.heat += (dt / secs) * (value / limit);
    else st.heat = Math.max(0, st.heat - dt * 0.5);
    return st.heat >= 1;
  }

  // Resistor colour code (4 bands: digit, digit, multiplier, gold tolerance).
  var BAND = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'grey', 'white'];
  function bands(r) {
    var exp = Math.floor(Math.log10(r)) - 1;
    var sig = Math.round(r / Math.pow(10, exp));
    if (sig >= 100) { sig = Math.round(sig / 10); exp++; }
    return [BAND[Math.floor(sig / 10)], BAND[sig % 10], exp >= 0 ? BAND[exp] : (exp === -1 ? 'gold' : 'silver'), 'gold'];
  }
  BB.resistorBands = bands;
  var R_VALUES = [10, 22, 47, 100, 150, 220, 330, 470, 1000, 2200, 4700, 10000, 22000, 47000, 100000, 1000000];

  var SILICON = { is: 2.52e-9, nvt: 1.752 * 0.025852 }; // 1N4148-like diode, ≈0.6 V at 1 mA

  // ---------- microcontroller boards ----------
  // pin kinds: gpio, gnd, v5 (5 V out), v33 (3.3 V out), vin, rst, en, bat, nc
  function mcuPin(label, kind, extra) { return Object.assign({ n: label, kind: kind }, extra || {}); }

  var NANO_TOP = ['D12', 'D11', 'D10', 'D9', 'D8', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'GND', 'RST', 'RX0', 'TX1'];
  var NANO_BOT = ['D13', '3V3', 'REF', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', '5V', 'RST', 'GND', 'VIN'];
  function nanoPins() {
    var pins = [], pos = [];
    function kindOf(l) {
      if (l === 'GND') return 'gnd'; if (l === '5V') return 'v5'; if (l === '3V3') return 'v33';
      if (l === 'VIN') return 'vin'; if (l === 'RST') return 'rst'; if (l === 'REF') return 'nc';
      return 'gpio';
    }
    NANO_TOP.forEach(function (l, i) { pins.push(mcuPin(l, kindOf(l), { analog: false, pwm: ['D3', 'D5', 'D6', 'D9', 'D10', 'D11'].indexOf(l) >= 0 })); pos.push([i, 0]); });
    NANO_BOT.forEach(function (l, i) {
      var k = kindOf(l);
      // A6 and A7 on the Nano are analog input only.
      pins.push(mcuPin(l, k, { analog: /^A/.test(l), inputOnly: l === 'A6' || l === 'A7', sda: l === 'A4', scl: l === 'A5' }));
      pos.push([i, 6]);
    });
    return { pins: pins, pos: pos };
  }
  var FEATHER_LONG = ['RST', '3V', 'NC', 'GND', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'SCK', 'MO', 'MI', 'RX', 'TX', '21'];
  var FEATHER_SHORT = ['BAT', 'EN', 'USB', '13', '12', '27', '33', '15', '32', '14', 'SCL', 'SDA'];
  var FEATHER_GPIO = { A0: 26, A1: 25, A2: 34, A3: 39, A4: 36, A5: 4, SCK: 5, MO: 18, MI: 19, RX: 16, TX: 17, SCL: 22, SDA: 23 };
  function featherPins() {
    var pins = [], pos = [];
    function kindOf(l) {
      if (l === 'GND') return 'gnd'; if (l === '3V') return 'v33'; if (l === 'USB') return 'v5';
      if (l === 'RST' || l === 'EN') return 'rst'; if (l === 'BAT') return 'bat'; if (l === 'NC') return 'nc';
      return 'gpio';
    }
    FEATHER_LONG.forEach(function (l, i) {
      pins.push(mcuPin(l, kindOf(l), { analog: /^A\d/.test(l), inputOnly: ['A2', 'A3', 'A4'].indexOf(l) >= 0, pwm: ['A2', 'A3', 'A4'].indexOf(l) < 0, gpio: FEATHER_GPIO[l] || +l || null }));
      pos.push([i, 0]);
    });
    FEATHER_SHORT.forEach(function (l, i) {
      pins.push(mcuPin(l, kindOf(l), { analog: ['13', '12', '27', '33', '15', '32', '14'].indexOf(l) >= 0, pwm: true, sda: l === 'SDA', scl: l === 'SCL', gpio: FEATHER_GPIO[l] || +l || null }));
      pos.push([i + 4, 8]);
    });
    return { pins: pins, pos: pos };
  }
  // Raspberry Pi 40-pin header, physical pin 1..40 (odd pins on the inner row).
  var PI_HEADER = [null,
    '3V3', '5V', 'GPIO2', '5V', 'GPIO3', 'GND', 'GPIO4', 'GPIO14', 'GND', 'GPIO15',
    'GPIO17', 'GPIO18', 'GPIO27', 'GND', 'GPIO22', 'GPIO23', '3V3', 'GPIO24', 'GPIO10', 'GND',
    'GPIO9', 'GPIO25', 'GPIO11', 'GPIO8', 'GND', 'GPIO7', 'GPIO0', 'GPIO1', 'GPIO5', 'GND',
    'GPIO6', 'GPIO12', 'GPIO13', 'GND', 'GPIO19', 'GPIO16', 'GPIO26', 'GPIO20', 'GND', 'GPIO21'];
  function headerPins(names, extraFn) {
    var pins = [], pos = [];
    for (var k = 1; k <= 40; k++) {
      var l = names[k];
      var kind = l === 'GND' ? 'gnd' : l === '5V' ? 'v5' : l === '3V3' ? 'v33' : /^(DNC|NC)/.test(l) ? 'nc' : 'gpio';
      pins.push(mcuPin(l, kind, Object.assign({ phys: k }, extraFn ? extraFn(l, k) : {})));
      // odd pins: row 1 (y=1), even pins: row 0 (y=0); column = (k-1)>>1
      pos.push([(k - 1) >> 1, k % 2 === 1 ? 1 : 0]);
    }
    return { pins: pins, pos: pos };
  }
  function piPins() {
    return headerPins(PI_HEADER, function (l) { return { sda: l === 'GPIO2', scl: l === 'GPIO3', analog: false, pwm: true }; });
  }
  // Wio Terminal 40-pin header (Raspberry Pi layout), from Seeed's official pinout.
  // Pins without an Arduino name are listed by their Raspberry Pi (BCM) name.
  var WIO_HEADER = [null,
    '3V3', '5V', 'SDA', '5V', 'SCL', 'GND', 'BCM4', 'TXD', 'GND', 'RXD',
    'BCM17', 'BCM18', 'D0/A0', 'GND', 'D1/A1', 'D2/A2', '3V3', 'D3/A3', 'MOSI', 'GND',
    'MISO', 'D4/A4', 'SCLK', 'CE0', 'GND', 'CE1', 'BCM0', 'BCM1', 'BCM5', 'GND',
    'BCM6', 'D5/A5', 'D6/A6', 'GND', 'BCM19', 'D7/A7', 'D8/A8', 'BCM20', 'GND', 'BCM21'];
  var _wio = null;
  function wioPinsCache() { return _wio || (_wio = wioPins()); }
  function wioPins() { return headerPins(WIO_HEADER, function (l, k) { return { sda: l === 'SDA', scl: l === 'SCL', analog: /A\d/.test(l), pwm: [13, 16, 23, 33, 37].indexOf(k) >= 0 }; }); }

  var BOARDS = {
    nano: { vcc: 5, rout: 25, adcMax: 1023, adcRef: 5, hiTh: 3.0, loTh: 1.5, absMax: 5.5, pinMax: 0.04, pinSafe: 0.02, usbMax: 0.5, v33Max: 0.05, name: 'Arduino Nano' },
    esp32: { vcc: 3.3, rout: 30, adcMax: 4095, adcRef: 3.3, hiTh: 2.475, loTh: 0.825, absMax: 3.6, pinMax: 0.04, pinSafe: 0.02, usbMax: 0.5, v33Max: 0.6, name: 'ESP32 Feather' },
    pi5: { vcc: 3.3, rout: 40, adcMax: 0, adcRef: 3.3, hiTh: 2.0, loTh: 0.8, absMax: 3.6, pinMax: 0.016, pinSafe: 0.008, usbMax: 1.6, v33Max: 0.8, name: 'Raspberry Pi 5' },
    wio: { vcc: 3.3, rout: 50, adcMax: 1023, adcRef: 3.3, hiTh: 2.31, loTh: 0.99, absMax: 3.6, pinMax: 0.02, pinSafe: 0.008, usbMax: 0.5, v33Max: 0.3, name: 'Wio Terminal' }
  };
  BB.BOARDS = BOARDS;

  // A regulated output (USB port, AMS1117, the boards' 3.3 V regulators). Three modes, chosen
  // by the simulation inside each step (see BB.updateSrcModes):
  //   'v'   holds its voltage V (small series resistance rn)
  //   'lim' gives its maximum current iLim (current limit: the voltage drops)
  //   'off' cannot take current back: if another source pushes harder, it lets go and the
  //         voltage rises to whatever that other source makes.
  function limSrc(n, st, key, g, out, V, rn, iLim) {
    var mode = (st.mode || (st.mode = {}))[key] || 'v';
    var src = { key: key, V: V, iLim: iLim, out: out, g: g, mode: mode, el: null };
    if (mode === 'lim') src.el = n.I(g, out, iLim);
    else if (mode === 'off') n.R(out, g, 1e7);
    else { var s = n.node(); src.el = n.V(s, g, V); n.R(s, out, rn); }
    if (src.el !== null && n.mark) n.mark(src.el);
    return src;
  }
  // Decide each regulated source's mode from a solved result. Returns true if any mode changed.
  BB.updateSrcModes = function (p, rr) {
    var srcs = p._e && p._e.srcs; if (!srcs || !srcs.length) return false;
    var changed = false, st = p.st;
    st.mode = st.mode || {};
    srcs.forEach(function (src) {
      var v = rr.v(src.out) - rr.v(src.g), i = src.el === null ? 0 : rr.i(src.el), m = src.mode, next = m;
      if (m === 'v') { if (i > src.iLim * 1.02) next = 'lim'; else if (i < -0.004) next = 'off'; }
      else if (m === 'lim') { if (v > src.V + 0.002) next = 'v'; }
      else if (m === 'off') { if (v < src.V - 0.01) next = 'v'; }
      if (next !== m) { st.mode[src.key] = next; if (next === 'lim') st['since_' + src.key] = st.now || 0; changed = true; }
    });
    return changed;
  };
  function srcState(src, r, st, ctx) {
    var i = src.el === null ? 0 : r.i(src.el), v = r.v(src.out) - r.v(src.g);
    if (src.mode !== 'lim') st['since_' + src.key] = ctx.t;
    return { i: i, v: v, limited: src.mode === 'lim', off: src.mode === 'off', since: ctx.t - (st['since_' + src.key] || ctx.t) };
  }

  // Electrical model shared by all microcontroller boards.
  var LOAD = { nano: 250, esp32: 62, pi5: 8.3, wio: 33 }; // board's own current draw when fed through a pin (≈20 mA, 80 mA, 0.6 A, 150 mA)
  function mcuStamp(p, n, ctx) {
    var def = PARTS[p.type], cfg = BOARDS[def.mcu], st = p.st;
    var pins = def.pins;
    var g = n.node();
    n.ref(g);
    st.now = ctx.t;
    var e = p._e = { g: g, gnd: [], pin: {}, srcs: [] };
    pins.forEach(function (pin, i) { if (pin.kind === 'gnd') e.gnd.push(n.R('p' + i, g, 0.01)); });
    // pins with the same power job are one copper net inside the board (Pi/Wio have two 5V and two 3V3 pins)
    var first = {};
    pins.forEach(function (pin, i) { if (pin.kind === 'v5' || pin.kind === 'v33') { if (first[pin.kind] === undefined) first[pin.kind] = i; else n.R('p' + i, 'p' + first[pin.kind], 0.01); } });
    var usb = !st.dead && p.props.usb !== false && !st.usbTripped;
    var lv = st.lastV || {};
    var via = null;
    if (!usb && !st.dead) {
      if (def.mcu === 'nano') via = (lv['5V'] || 0) > 4.3 ? '5V' : (lv.VIN || 0) > 6.5 ? 'VIN' : null;
      else if (def.mcu === 'esp32') via = (lv.USB || 0) > 4.3 ? '5V' : (lv['3V'] || 0) > 3.0 ? '3V' : (lv.BAT || 0) > 3.0 ? 'BAT' : null;
      else via = (lv['5V'] || 0) > 4.3 ? '5V' : null;
    }
    st.extVia = via;
    st.extPowered = !!via;
    st.powered = usb || !!via;
    var vccNode = n.node();
    pins.forEach(function (pin, i) {
      if (pin.kind === 'v5') {
        if (i !== first.v5) return;
        if (usb) e.srcs.push(Object.assign(limSrc(n, st, 'usb', g, n.pin(i), 5.0, 0.2, cfg.usbMax), { label: pin.n, what: 'usb', idx: i }));
        else if (def.mcu === 'nano' && via === 'VIN') e.srcs.push(Object.assign(limSrc(n, st, 'reg', g, n.pin(i), 5.0, 0.1, 0.8), { label: pin.n, what: 'reg', idx: i }));
        else n.R('p' + i, g, via === '5V' ? LOAD[def.mcu] : 1e6);
      } else if (pin.kind === 'v33') {
        if (i !== first.v33) return;
        if (st.powered && via !== '3V') e.srcs.push(Object.assign(limSrc(n, st, 'v33', g, n.pin(i), 3.3, def.mcu === 'nano' ? 2 : 0.3, cfg.v33Max), { label: pin.n, what: 'v33', idx: i }));
        else n.R('p' + i, g, via === '3V' ? 41 : 1e6);
      } else if (pin.kind === 'vin') {
        n.R('p' + i, g, via === 'VIN' ? 400 : 1e6);
      } else if (pin.kind === 'bat') {
        n.R('p' + i, g, via === 'BAT' ? 46 : 1e6);
      }
    });
    if (st.powered) e.vcc = n.V(vccNode, g, cfg.vcc); else n.R(vccNode, g, 1);
    var io = st.io || {};
    pins.forEach(function (pin, i) {
      if (pin.kind !== 'gpio') { if (pin.kind === 'rst' || pin.kind === 'nc') n.R('p' + i, g, 1e8); return; }
      var cfgPin = io[pin.n];
      var dmg = st.damaged && st.damaged[pin.n];
      var rec;
      if (!st.powered || !cfgPin || dmg) rec = { el: n.R('p' + i, g, 1e8), mode: 'in' };
      else if (cfgPin.mode === 'out') {
        var level = cfgPin.level;
        if (cfgPin.pwm !== undefined) level = ctx.pwmHigh ? (ctx.pwmHigh(cfgPin.pwm) ? 1 : 0) : 1;
        var src = n.node();
        var vs = n.V(src, g, level ? cfg.vcc : 0);
        rec = { el: n.R(src, 'p' + i, cfg.rout), mode: 'out', src: vs };
      } else {
        rec = { el: n.R('p' + i, g, 1e8), mode: 'in', pull: cfgPin.pull };
        if (cfgPin.pull === 'up') n.R('p' + i, vccNode, def.mcu === 'nano' ? 35000 : 45000);
      }
      // every I/O pin has protection ("clamp") diodes to the chip's supply and to GND
      if (!dmg) { rec.cHi = n.D('p' + i, vccNode, SILICON.is, SILICON.nvt); rec.cLo = n.D(g, 'p' + i, SILICON.is, SILICON.nvt); if (n.flag) { n.flag(rec.cHi, 'clamp'); n.flag(rec.cLo, 'clamp'); } }
      e.pin[pin.n] = rec;
    });
  }
  function mcuAfter(p, r, ctx) {
    var def = PARTS[p.type], cfg = BOARDS[def.mcu], st = p.st, e = p._e;
    st.lastV = {}; st.lastVpeak = {};
    st.pinI = {};
    def.pins.forEach(function (pin, i) {
      var v = r.pinV(i) - r.v(e.g), vp = (r.pinVpeak ? r.pinVpeak(i) : r.pinV(i)) - r.v(e.g);
      // two pins may share a name (Pi: two 5V pins): keep the higher one
      st.lastV[pin.n] = Math.max(v, st.lastV[pin.n] === undefined ? -1e9 : st.lastV[pin.n]);
      st.lastVpeak[pin.n] = Math.max(vp, st.lastVpeak[pin.n] === undefined ? -1e9 : st.lastVpeak[pin.n]);
    });
    st.damaged = st.damaged || {};
    st.damageWhy = st.damageWhy || {};
    // power pins: too much voltage kills the board
    var PMAX = { v5: 5.6, v33: 3.7, vin: 20, bat: 4.5 };
    def.pins.forEach(function (pin, i) {
      var mx = PMAX[pin.kind]; if (!mx || st.dead) return;
      var v = r.pinV(i) - r.v(e.g);
      if (v > mx) {
        st.pwrHeat = (st.pwrHeat || 0) + ctx.dt;
        var tip = pin.kind === 'v5' && def.mcu === 'nano' ? 'To power the Nano from 7–12 V (like a 9V battery), use the VIN pin: its regulator makes 5 V.'
          : pin.kind === 'v33' ? 'Feed a 3.3V pin only from a 3.3 V supply.' : pin.kind === 'bat' ? 'BAT is for one LiPo cell (3.7–4.2 V).' : '';
        ctx.issue(p, 'overvolt', 'danger', 'Too much voltage on the ' + pin.n + ' pin: ' + fmtV(v), 'The ' + pin.n + ' pin takes at most ' + { v5: '5.5', v33: '3.6', vin: '20', bat: '4.3' }[pin.kind] + ' V. ' + tip, i);
        if (st.pwrHeat > 0.5) { st.dead = true; st.deadWhy = 'Its ' + pin.n + ' pin got ' + fmtV(v) + '.'; st.smoke = ctx.t; ctx.event(p, 'damage', pin.n); ctx.dirty(); }
      }
    });
    if (st.dead) ctx.issue(p, 'dead', 'danger', 'The ' + cfg.name + ' is dead', (st.deadWhy || '') + ' Too much voltage on a power pin destroys the board. Fix the wiring, then tap the board and press “New board”.');
    if (st.extPowered && def.mcu === 'pi5') ctx.issue(p, 'pipower', 'warn', 'The Pi 5 needs a strong supply', 'Through its 5V pins the Pi 5 draws about 0.6 A, and up to 5 A when busy. A breadboard supply (MB102: 700 mA) is not enough. Use the official 5V 5A USB-C supply.', def.pins.findIndex(function (q) { return q.kind === 'v5'; }));
    // power outputs: current limit, back-feeding, and the USB port's fuse
    e.srcs.forEach(function (src) {
      var c = srcState(src, r, st, ctx);
      if (src.what === 'usb') st.usbI = c.i;
      if (c.off && c.v > src.V + 0.15) {
        ctx.issue(p, 'fight', 'danger', 'Another power source pushes into the ' + src.label + ' pin', 'The board makes ' + src.V + ' V on its ' + src.label + ' pin, but another source pushes it to ' + fmtV(c.v) + '. A ' + (src.what === 'usb' ? 'USB port' : 'regulator') + ' cannot take current back, so the voltage rises. Use one power source only.', src.idx);
      }
      if (c.limited) {
        ctx.issue(p, 'short', 'danger', 'Too much current from the ' + src.label + ' pin',
          'The ' + src.label + ' pin gives its maximum (about ' + fmtI(src.iLim) + ') and its voltage falls to ' + fmtV(c.v) + '. Something joins it to GND with too little resistance' + (src.what === 'usb' ? '. Soon the USB port cuts the power to protect your computer.' : '.') + ' Remove the wire or part that joins ' + src.label + ' to GND.', src.idx);
        if (src.what === 'usb' && c.since > 2) { st.usbTripped = true; st.tripT = ctx.t; st.mode = {}; ctx.dirty(); }
      }
    });
    if (st.usbTripped) {
      ctx.issue(p, 'short', 'danger', 'The USB port cut the power (short circuit)', 'Too much current flowed, so the USB port switched off. It tries again every 2 seconds. Remove the wire or part that joins 5V (or 3.3V) to GND.');
      if (ctx.t - st.tripT > 2) { st.usbTripped = false; ctx.dirty(); }
    }
    Object.keys(st.damaged).forEach(function (pn) {
      ctx.issue(p, 'damaged', 'danger', 'Pin ' + pn + ' is damaged', (st.damageWhy[pn] || 'It got too much voltage or current.') + ' On a real board this pin (or the whole chip) can be dead now. Fix the wiring, then tap the board and press “New board”.', def.pins.findIndex(function (q) { return q.n === pn; }));
    });
    st.pinHeat = st.pinHeat || {};
    def.pins.forEach(function (pin, i) {
      if (pin.kind !== 'gpio') return;
      var pe = e.pin[pin.n];
      var cur = pe ? Math.abs(r.i(pe.el)) : 0;
      st.pinI[pin.n] = cur;
      if (st.damaged[pin.n] || !pe) return;
      var peak = Math.abs(r.iPeak ? r.iPeak(pe.el) : cur);
      var v = st.lastVpeak[pin.n];
      // current pushed into the pin's protection diodes (from a higher voltage, or below GND)
      var inj = Math.max(pe.cHi !== undefined ? r.iPeak(pe.cHi) : 0, pe.cLo !== undefined ? r.iPeak(pe.cLo) : 0);
      if (inj > 0.001) {
        var lowSide = pe.cLo !== undefined && r.iPeak(pe.cLo) > 0.001;
        if (inj > 0.005) st.pinHeat[pin.n] = (st.pinHeat[pin.n] || 0) + ctx.dt * inj / 0.005;
        ctx.issue(p, 'overvolt', 'danger', lowSide ? 'Pin ' + pin.n + ' is pulled below GND' : 'Pin ' + pin.n + ' gets ' + fmtV(v) + '. That is too much!',
          (lowSide ? 'A pin must stay between GND and ' + cfg.vcc + ' V. Check that + and − are not swapped. ' :
            'The ' + cfg.name + ' works at ' + cfg.vcc + ' V' + (st.powered ? '' : ' (and now it has no power at all)') + '. ' + fmtI(inj) + ' is pushed into the pin through its protection diode. More than about 1 mA can break the chip. ') +
          (cfg.vcc < 4 && !lowSide ? 'Use a voltage divider (two resistors) to bring 5 V down to about 3.3 V.' : ''), i);
        if (st.pinHeat[pin.n] > 1) { st.damaged[pin.n] = true; st.damageWhy[pin.n] = 'About ' + fmtI(inj) + ' was pushed into it (it got ' + fmtV(v) + ').'; st.smoke = ctx.t; ctx.event(p, 'damage', pin.n); ctx.dirty(); }
      }
      if (st.damaged[pin.n]) return;
      if (pe.mode === 'out') {
        if (peak > cfg.pinMax) {
          st.pinHeat[pin.n] = (st.pinHeat[pin.n] || 0) + ctx.dt * (peak / cfg.pinMax);
          ctx.issue(p, 'pin', 'danger', 'Too much current from pin ' + pin.n + ': ' + fmtI(peak),
            'A pin of the ' + cfg.name + ' can give about ' + fmtI(cfg.pinSafe) + ' safely (' + fmtI(cfg.pinMax) + ' at most). More current damages the chip. Add a resistor (for an LED, 220 Ω or more).', i);
          if (st.pinHeat[pin.n] > 1.0) { st.damaged[pin.n] = true; st.damageWhy[pin.n] = 'It had to give ' + fmtI(peak) + ', far more than the ' + fmtI(cfg.pinMax) + ' it can give.'; st.smoke = ctx.t; ctx.event(p, 'damage', pin.n); ctx.dirty(); }
        } else if (peak > cfg.pinSafe * 1.05) {
          ctx.issue(p, 'pinwarn', 'warn', 'Pin ' + pin.n + ' gives ' + fmtI(peak), 'This is more than the safe ' + fmtI(cfg.pinSafe) + '. Use a bigger resistor.', i);
        }
      } else if (st.powered && pe.mode === 'in' && !pe.pull && st.io && st.io[pin.n] && ctx.pinFloating(p, i)) {
        // an input with nothing driving it "floats": it picks up noise and reads random values
        st.floating = st.floating || {};
        st.floating[pin.n] = true;
        ctx.issue(p, 'floating', 'info', 'Pin ' + pin.n + ' is floating', 'Nothing drives this input (it has no path to + or GND), so it picks up electrical noise and reads random values. Connect the sensor to it, or add a pull-up or pull-down resistor.', i);
      }
      if (st.floating && (pe.mode !== 'in' || !ctx.pinFloating(p, i))) delete st.floating[pin.n];
    });
  }

  // Common info lines for 2-terminal parts
  function twoTermInfo(p, r) {
    var v = r.pinV(0) - r.pinV(1), i = p._i || 0;
    return [['Voltage across', fmtV(v)], ['Current', fmtI(i)], ['Power', fmtP(Math.abs(v * i))]];
  }

  var PARTS = {};

  // ---------- basics ----------
  PARTS.wire = {
    name: 'Jumper wire', cat: 'basic', kind: 'leads', maxSpan: 0,
    desc: 'A wire joins two holes. Current flows through it with almost no loss.',
    pins: [{ n: 'end 1' }, { n: 'end 2' }],
    defaults: { color: 'auto' },
    props: [{ k: 'color', label: 'Colour', type: 'swatch', options: ['red', 'black', 'blue', 'green', 'yellow', 'orange', 'white', 'purple'] }],
    links: function () { return [[0, 1]]; },
    stamp: function (p, n) { p._e = n.R('p0', 'p1', 0.02); },
    after: function (p, r, ctx) {
      var i = r.i(p._e); p._i = i;
      p.vis = { hot: Math.abs(i) > 1.5 };
      if (Math.abs(i) > 1.5) ctx.issue(p, 'hotwire', 'warn', 'This wire carries ' + fmtI(i), 'So much current makes the wire hot. This only happens with a short circuit.');
    },
    info: function (p, r) { return [['Current', fmtI(p._i || 0)]]; }
  };

  PARTS.led = {
    name: 'LED', cat: 'basic', kind: 'leads', maxSpan: 5,
    desc: 'An LED is a small light. Current can flow only one way ({{polarity}}): in at the long leg (+), out at the short leg (−).',
    pins: [{ n: '+', d: 'Anode (+): the long leg' }, { n: '−', d: 'Cathode (−): the short leg, flat side' }],
    defaults: { color: 'red' },
    props: [{ k: 'color', label: 'Colour', type: 'select', options: ['red', 'orange', 'yellow', 'green', 'blue', 'white'], labels: ['Red (2.0 V)', 'Orange (2.05 V)', 'Yellow (2.1 V)', 'Green (2.2 V)', 'Blue (3.0 V)', 'White (3.1 V)'] }],
    stamp: function (p, n) {
      if (p.st.burnt) { p._e = null; n.R('p0', 'p1', 1e9); return; }
      var lp = E.ledParams(p.props.color);
      var mid = n.node();
      p._e = n.D('p0', mid, lp.is, lp.nvt);
      n.R(mid, 'p1', lp.rs);
    },
    after: function (p, r, ctx) {
      var i = p._e === null ? 0 : r.i(p._e);
      p._i = i;
      var vrev = r.pinV(1) - r.pinV(0);
      var sameNet = ctx.netOfPin(p, 0) !== null && ctx.netOfPin(p, 0) === ctx.netOfPin(p, 1);
      if (!p.st.burnt && heat(p.st, i, 0.03, ctx.dt, 4, 5)) {
        p.st.burnt = true; p.st.burntBy = i; p.st.smoke = ctx.t;
        ctx.event(p, 'burn', i);
      }
      p.vis = { b: p.st.burnt ? 0 : Math.min(1.25, Math.sqrt(Math.max(0, i) / 0.02)), burnt: !!p.st.burnt, hot: p.st.heat > 0.05 };
      if (p.st.burnt) {
        var vf = E.ledVf(p.props.color, 0.015);
        ctx.issue(p, 'burnt', 'danger', 'The LED burned out',
          (p.st.burntBy ? 'About ' + fmtI(p.st.burntBy) + ' went through it. ' : '') +
          'An LED can take about 20 mA. With no resistor (or one that is too small) the current gets far too big. ' +
          'Put a resistor in the loop, then tap the LED and press “New LED”.');
      } else if (i > 0.0305) {
        ctx.issue(p, 'overI', 'danger', 'Too much current: ' + fmtI(i), 'An LED takes about 20 mA at most. It is getting hot and will burn out. Use a bigger resistor.');
      } else if (sameNet && ctx.nodeSupplied(p, 0)) {
        ctx.issue(p, 'samerow', 'warn', 'Both LED legs are connected together',
          'Both legs are in the same strip (or joined by a wire). The current goes around the LED, not through it. Put the legs in two different strips.');
      } else if (vrev > 1.0) {
        ctx.issue(p, 'reversed', 'warn', 'The LED is in backwards',
          'The long leg (+) must go toward + and the short leg (−) toward −. Tap the LED and press “Flip”.');
      }
    },
    info: function (p, r) {
      var i = p._i || 0;
      var s = p.st.burnt ? 'Burned out' : i > 0.0305 ? 'Too much current!' : i > 0.002 ? 'On' : i > 0.00005 ? 'Dim (it glows a little)' : 'Off';
      return [['State', s]].concat(twoTermInfo(p, r)).concat([['LED voltage at 20 mA', E.LED_TYPES[p.props.color].vf20.toFixed(2) + ' V'], ['Safe current', 'up to 20 mA']]);
    }
  };

  PARTS.resistor = {
    name: 'Resistor', cat: 'basic', kind: 'leads', maxSpan: 10,
    desc: 'A resistor limits current. Bigger ohms (Ω) means less current. The colour bands show its value.',
    pins: [{ n: 'leg 1' }, { n: 'leg 2' }],
    defaults: { r: 220 },
    props: [{ k: 'r', label: 'Resistance', type: 'select', options: R_VALUES, labels: R_VALUES.map(fmtR) }],
    stamp: function (p, n) {
      if (p.st.burnt) { p._e = n.R('p0', 'p1', 1e9); return; }
      p._e = n.R('p0', 'p1', p.props.r);
    },
    after: function (p, r, ctx) {
      var i = r.i(p._e); p._i = i;
      var pw = i * i * (p.st.burnt ? 1e9 : p.props.r);
      if (!p.st.burnt && heat(p.st, pw, 1.0, ctx.dt, 2, 4)) { p.st.burnt = true; p.st.smoke = ctx.t; ctx.event(p, 'burn'); }
      p.vis = { hot: Math.min(1, pw / 0.5), burnt: !!p.st.burnt };
      if (p.st.burnt) ctx.issue(p, 'burnt', 'danger', 'The resistor burned', 'It had too much power. A small resistor can take 0.25 W (250 mW). Tap it and press “New part”.');
      else if (pw > 0.25) ctx.issue(p, 'hot', 'warn', 'The resistor is hot: ' + fmtP(pw), 'A small resistor can take 0.25 W. Power = voltage × current. Use a bigger resistor, or check for a short circuit.');
    },
    info: function (p, r) {
      if (p.hideValue) return [['Value', '? Read the bands, or measure it'], ['Bands', bands(p.props.r).join(', ')]].concat(twoTermInfo(p, r));
      return [['Value', fmtR(p.props.r) + ' (±5 %)'], ['Bands', bands(p.props.r).join(', ')]].concat(twoTermInfo(p, r)).concat([['Max power', '0.25 W']]);
    }
  };

  PARTS.capacitor = {
    name: 'Capacitor', cat: 'basic', kind: 'leads', maxSpan: 3,
    desc: 'A capacitor stores a little charge, like a tiny fast battery. This kind ({{electrolytic}}) has + and − legs: the stripe marks −.',
    pins: [{ n: '+', d: 'Long leg (+)' }, { n: '−', d: 'Short leg (−), stripe side' }],
    defaults: { c: 100e-6 },
    props: [{ k: 'c', label: 'Capacity', type: 'select', options: [10e-6, 100e-6, 470e-6, 1000e-6], labels: ['10 µF', '100 µF', '470 µF', '1000 µF'] }],
    stamp: function (p, n) { p._e = n.C('p0', 'p1', p.props.c, p.st); },
    after: function (p, r, ctx) {
      var v = r.pinV(0) - r.pinV(1);
      p._i = r.i(p._e);
      p.st.v0 = r.capV(p._e);
      p.vis = { v: v };
      if (v < -1) ctx.issue(p, 'reversed', 'warn', 'The capacitor is in backwards', 'Its − leg (stripe side) must go to the lower voltage. Backwards, it can get hot and even pop.');
      if (Math.abs(v) > 16) ctx.issue(p, 'overvolt', 'danger', 'Too much voltage for this capacitor', 'It is made for 16 V at most.');
    },
    dynamic: function (p) { return Math.abs(p._i || 0) > 1e-6; },
    info: function (p, r) {
      var c = p.props.c;
      return [['Value', (c * 1e6) + ' µF, 16 V'], ['Charge voltage', fmtV(r.pinV(0) - r.pinV(1))], ['Current now', fmtI(p._i || 0)]];
    }
  };

  PARTS.button = {
    name: 'Push button', cat: 'basic', kind: 'rigid',
    desc: 'Pressing the button joins its left and right legs. The two legs facing each other across the middle gap are always joined inside.',
    pins: [{ n: '1' }, { n: '2' }, { n: '3' }, { n: '4' }],
    pinPos: [[0, 0], [2, 0], [0, 3], [2, 3]],
    body: [-0.45, 0.25, 2.45, 2.75],
    defaults: {},
    props: [],
    links: function (p) { var l = [[0, 2], [1, 3]]; if (p.st.pressed) l.push([0, 1]); return l; },
    stamp: function (p, n) {
      n.R('p0', 'p2', 0.03); n.R('p1', 'p3', 0.03);
      p._e = p.st.pressed ? n.R('p0', 'p1', 0.05) : null;
    },
    after: function (p, r) { p._i = p._e === null ? 0 : r.i(p._e); p.vis = { pressed: !!p.st.pressed }; },
    hot: [{ id: 'press', x: 1, y: 1.5, r: 1.6, kind: 'press' }],
    info: function (p) { return [['State', p.st.pressed ? 'Pressed: closed' : 'Not pressed: open'], ['Current through the switch', fmtI(p._i || 0)]]; }
  };

  PARTS.pot = {
    name: 'Potentiometer (knob)', cat: 'basic', kind: 'rigid',
    desc: 'A knob with a resistor inside. The middle leg (the {{wiper}}) slides along it, so turning the knob changes the resistance.',
    pins: [{ n: '1', d: 'End 1' }, { n: 'W', d: 'Wiper (middle leg)' }, { n: '3', d: 'End 3' }],
    pinPos: [[0, 0], [2, 0], [4, 0]],
    body: [-1.3, -6.6, 5.3, 0.3],
    defaults: { r: 10000, pos: 0.5, style: 'rotary' },
    props: [{ k: 'style', label: 'Looks like (match yours)', type: 'select', options: ['rotary', 'trimmer'], labels: ['Round knob', 'Blue trimmer'] }, { k: 'r', label: 'Total', type: 'select', options: [1000, 10000, 100000], labels: ['1 kΩ', '10 kΩ', '100 kΩ'] }, { k: 'pos', label: 'Knob', type: 'range', min: 0, max: 1, step: 0.01, fmt: function (v) { return Math.round(v * 100) + ' %'; } }],
    stamp: function (p, n) {
      var a = p.props.pos, R = p.props.r;
      if (p.st.burnt) { p._e = [n.R('p0', 'p1', 1e9), n.R('p1', 'p2', 1e9)]; return; }
      p._e = [n.R('p0', 'p1', Math.max(0.5, a * R)), n.R('p1', 'p2', Math.max(0.5, (1 - a) * R))];
    },
    after: function (p, r, ctx) {
      var i1 = r.i(p._e[0]), i2 = r.i(p._e[1]);
      var a = p.props.pos, R = p.props.r;
      var pw = i1 * i1 * Math.max(0.5, a * R) + i2 * i2 * Math.max(0.5, (1 - a) * R);
      p._i = Math.max(Math.abs(i1), Math.abs(i2));
      if (!p.st.burnt && heat(p.st, pw, 0.25, ctx.dt, 2, 6)) { p.st.burnt = true; p.st.smoke = ctx.t; ctx.event(p, 'burn'); }
      p.vis = { pos: a, burnt: !!p.st.burnt };
      if (p.st.burnt) ctx.issue(p, 'burnt', 'danger', 'The knob burned inside', 'When the knob is turned to the end, its resistance is almost 0 Ω. With no other resistor, a big current flows and burns it.');
      else if (pw > 0.25) ctx.issue(p, 'hot', 'warn', 'The knob is getting hot', 'Too much current goes through the knob. Put a fixed resistor in the loop too.');
    },
    hot: [{ id: 'knob', x: 2, y: -3.3, r: 2.2, kind: 'knob' }],
    info: function (p) {
      var a = p.props.pos, R = p.props.r;
      return [['Leg 1 to wiper', fmtR(a * R)], ['Wiper to leg 3', fmtR((1 - a) * R)], ['Current', fmtI(p._i || 0)]];
    }
  };

  function battStamp(p, n, v, rint) {
    var s = n.node();
    p._e = n.V(s, 'p1', v);
    if (n.mark) n.mark(p._e);
    n.R(s, 'p0', rint);
  }
  function battAfter(p, r, ctx, limit, name) {
    var i = r.i(p._e); p._i = i;
    var other = ctx.poweredBy(p, 0);
    p.vis = { hot: Math.abs(i) > limit };
    if (other && Math.abs(i) > 0.05) {
      ctx.issue(p, 'fight', 'danger', 'Two power sources are fighting',
        'The ' + name + ' is joined to another power source with a different voltage. ' + fmtI(Math.abs(i)) + ' flows from one into the other' + (i < 0 ? ', backwards into the battery' : '') + '. This heats both, and it can damage the power board. Use only one power source for the same rails.');
    } else if (i > limit) {
      ctx.issue(p, 'short', 'danger', 'Short circuit! ' + fmtI(i) + ' from the ' + name,
        'The + side is joined to the − side with almost nothing in between. A huge current flows, and the battery and wires get hot. ' +
        'Always have a part (like a resistor or LED) between + and −. Find the wire that joins them and remove it.');
    }
  }
  PARTS.battery9 = {
    name: '9V battery', cat: 'power', kind: 'module',
    desc: 'A 9 volt battery with a snap clip. The red wire is +, the black wire is −.',
    pins: [{ n: '+', d: 'Red wire (+)' }, { n: '−', d: 'Black wire (−)' }],
    size: [19.5, 10.5], leadFrom: [[0, 3.4], [0, 7.1]],
    defaults: {}, props: [],
    stamp: function (p, n) { battStamp(p, n, 9, 2); },
    after: function (p, r, ctx) { battAfter(p, r, ctx, 1, '9V battery'); },
    info: function (p, r) { return [['Voltage', fmtV(r.pinV(0) - r.pinV(1))], ['Current out', fmtI(p._i || 0)], ['Inside resistance', '2 Ω']]; }
  };
  PARTS.aa = {
    name: 'AA battery holder', cat: 'power', kind: 'module',
    desc: 'A holder for AA batteries in series. Each AA cell gives 1.5 V, so 2 cells give 3 V and 4 cells give 6 V.',
    pins: [{ n: '+', d: 'Red wire (+)' }, { n: '−', d: 'Black wire (−)' }],
    size: [22.5, 13], leadFrom: [[0, 4.5], [0, 8.5]],
    defaults: { cells: 2 },
    props: [{ k: 'cells', label: 'Cells', type: 'select', options: [2, 4], labels: ['2 × AA (3 V)', '4 × AA (6 V)'] }],
    stamp: function (p, n) { battStamp(p, n, 1.5 * p.props.cells, 0.15 * p.props.cells); },
    after: function (p, r, ctx) { battAfter(p, r, ctx, 2, 'AA batteries'); },
    info: function (p, r) { return [['Voltage', fmtV(r.pinV(0) - r.pinV(1))], ['Current out', fmtI(p._i || 0)]]; }
  };

  // MB102: plugs into both pairs of power rails at one end of the board.
  PARTS.mb102 = {
    name: 'MB102 power supply', cat: 'power', kind: 'rigid', noRotate: true,
    desc: 'A power board that plugs onto the end of the breadboard. A yellow jumper on each side picks 3.3V or 5V for that pair of rails.',
    pins: [{ n: 'top +' }, { n: 'top +' }, { n: 'top −' }, { n: 'top −' }, { n: 'bottom +' }, { n: 'bottom +' }, { n: 'bottom −' }, { n: 'bottom −' }],
    pinPos: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 16], [1, 16], [0, 17], [1, 17]],
    body: [-9.2, -1.6, 3.3, 18.6], covers: true,
    defaults: { top: '5', bottom: '5', on: true, pcb: 'black' },
    props: [
      { k: 'top', label: 'Top rails', type: 'seg', options: ['3.3', 'off', '5'], labels: ['3.3V', 'OFF', '5V'] },
      { k: 'bottom', label: 'Bottom rails', type: 'seg', options: ['3.3', 'off', '5'], labels: ['3.3V', 'OFF', '5V'] },
      { k: 'on', label: 'Power switch', type: 'toggle' },
      { k: 'pcb', label: 'Board colour (match yours)', type: 'select', options: ['black', 'green', 'red', 'blue'], labels: ['Black', 'Green', 'Red', 'Blue'] }
    ],
    links: function () { return [[0, 1], [2, 3], [4, 5], [6, 7], [2, 6]]; },
    stamp: function (p, n, ctx) {
      var g = n.node(); n.ref(g);
      p.st.now = ctx.t;
      [2, 3, 6, 7].forEach(function (k) { n.R('p' + k, g, 0.01); });
      p._e = { srcs: [] };
      [['top', 0, 1], ['bottom', 4, 5]].forEach(function (sd) {
        var sel = p.props[sd[0]];
        var plus = n.node();
        n.R(plus, 'p' + sd[1], 0.01); n.R(plus, 'p' + sd[2], 0.01);
        // AMS1117 regulator: holds 3.3 V / 5 V, limits at about 1 A, cannot take current back
        if (p.props.on && sel !== 'off' && !p.st.tripped) p._e.srcs.push(Object.assign(limSrc(n, p.st, sd[0], g, plus, sel === '5' ? 5 : 3.3, 0.05, 1.0), { side: sd[0] }));
        else n.R(plus, g, 1e7);
      });
    },
    after: function (p, r, ctx) {
      var tot = 0, st = p.st, lim = null;
      p._e.srcs.forEach(function (src) {
        var c = srcState(src, r, st, ctx);
        tot += Math.max(0, c.i);
        if (c.limited) { lim = { side: src.side, v: c.v }; if (c.since > 3) { st.tripped = true; st.tripT = ctx.t; st.mode = {}; ctx.dirty(); } }
        if (c.off && c.v > src.V + 0.15) ctx.issue(p, 'fight', 'danger', 'Two power sources are fighting', 'Another power source pushes the MB102 ' + src.side + ' rail to ' + fmtV(c.v) + '. The MB102 cannot take current back. Use one power source only for these rails.');
      });
      p._i = tot;
      if (st.tripped && ctx.t - st.tripT > 2.5) { st.tripped = false; ctx.dirty(); }
      p.vis = { on: p.props.on && !st.tripped };
      if (lim) st.lastLim = lim;
      if (lim || st.tripped) {
        var L = st.lastLim || {};
        ctx.issue(p, 'short', 'danger', st.tripped ? 'The MB102 switched off: it got too hot' : 'Short circuit on the ' + L.side + ' rails',
          (st.tripped ? 'A short circuit made its regulator too hot, so it shut down. It tries again in a moment. ' :
            'Something joins the ' + L.side + ' + rail to the − rail with almost no resistance. The MB102 gives as much as it can (about 1 A). The rail voltage falls to ' + fmtV(L.v) + ', and the regulator gets very hot. ') +
          'Remove the wire or part that joins + to −.');
      } else if (tot > 0.7) {
        ctx.issue(p, 'overload', 'warn', 'The MB102 gives ' + fmtI(tot), 'It is made for 700 mA at most. Its regulators get hot.');
      }
    },
    hot: [{ id: 'jtop', x: -3.1, y: 2.0, r: 1.6, kind: 'jumper', side: 'top' }, { id: 'jbot', x: -3.1, y: 13.8, r: 1.6, kind: 'jumper', side: 'bottom' }, { id: 'sw', x: -6.7, y: 8.5, r: 1.6, kind: 'switch' }],
    info: function (p, r) {
      return [['Top rails', p.props.top === 'off' ? 'Off' : p.props.top + ' V'], ['Bottom rails', p.props.bottom === 'off' ? 'Off' : p.props.bottom + ' V'], ['Power', p.props.on ? 'On' : 'Off'], ['Current out', fmtI(p._i || 0) + ' (max 700 mA)']];
    }
  };

  // ---------- multimeter ----------
  PARTS.meter = {
    name: 'Multimeter', cat: 'tools', kind: 'module',
    desc: 'Measures voltage (V), current (A) and resistance (Ω). Red probe = +, black probe = COM (−).',
    pins: [{ n: 'red', d: 'Red probe (V Ω mA)' }, { n: 'black', d: 'Black probe (COM)' }],
    size: [15.4, 26.6], leadFrom: [[5.74, 26.04], [9.66, 26.04]],
    defaults: { mode: 'V' },
    props: [{ k: 'mode', label: 'Dial', type: 'seg', options: ['off', 'V', 'A', 'ohm', 'diode'], labels: ['OFF', 'DCV', 'DCA', 'Ω', '→|'] }],
    stamp: function (p, n) {
      var m = p.props.mode;
      p._e = { m: m };
      if (m === 'V') p._e.el = n.R('p0', 'p1', 10e6);
      else if (m === 'A') p._e.el = p.st.fuse ? n.R('p0', 'p1', 1e9) : n.R('p0', 'p1', 1.0);
      else if (m === 'ohm') { var s = n.node(); p._e.src = n.V(s, 'p1', 1.0); p._e.el = n.R(s, 'p0', 1000); }
      else if (m === 'diode') { var sd = n.node(); p._e.src = n.V(sd, 'p1', 3.0); p._e.el = n.R(sd, 'p0', 2200); } // about 1 mA test current
      else p._e.el = n.R('p0', 'p1', 1e9);
    },
    after: function (p, r, ctx) {
      var m = p._e.m, read = '', unit = '', val = null;
      var connected = ctx.pinConnected(p, 0) && ctx.pinConnected(p, 1);
      if (m === 'V') {
        val = r.pinV(0) - r.pinV(1);
        read = Math.abs(val) < 0.005 ? '0.00' : (Math.abs(val) >= 100 ? val.toFixed(1) : val.toFixed(2)); unit = 'V';
      } else if (m === 'A') {
        val = r.i(p._e.el);
        if (!p.st.fuse && Math.abs(val) > 0.25) {
          p.st.fuse = true; ctx.event(p, 'fuse');
        }
        if (p.st.fuse) { read = '0.0'; unit = 'mA'; val = 0; }
        else { read = (val * 1000).toFixed(Math.abs(val) < 0.02 ? 2 : 1); unit = 'mA'; }
      } else if (m === 'ohm') {
        var vp = r.pinV(0) - r.pinV(1);
        var it = r.i(p._e.el);
        if (it < 1e-10 || !connected || vp / it > 2e6) { read = 'OL'; unit = 'Ω'; val = Infinity; }
        else {
          val = vp / it;
          if (val < 0) { read = '-' + 'OL'; unit = 'Ω'; }
          else if (val >= 999.5e3) { read = (val / 1e6).toFixed(2); unit = 'MΩ'; }
          else if (val >= 999.95) { read = (val / 1e3).toFixed(2); unit = 'kΩ'; }
          else { read = val.toFixed(1); unit = 'Ω'; }
        }
        if (connected && ctx.poweredBy(p, 0)) {
          ctx.issue(p, 'ohmpower', 'warn', 'Turn the power off to measure resistance',
            'In Ω mode the meter sends its own small current. A battery or power supply in the same circuit makes the reading wrong. Measure a resistor when it is not powered.');
        }
      } else if (m === 'diode') {
        var vd = r.pinV(0) - r.pinV(1);
        if (!connected || vd > 2.0) { read = 'OL'; unit = 'mV'; val = Infinity; }
        else { val = vd; read = String(Math.round(vd * 1000)); unit = 'mV'; }
        if (connected && ctx.poweredBy(p, 0)) ctx.issue(p, 'ohmpower', 'warn', 'Turn the power off to test a diode', 'In diode mode the meter sends its own small current. Test a part when it is not powered.');
      } else { read = ''; unit = ''; }
      if (p.st.fuse && m === 'A') {
        ctx.issue(p, 'fuse', 'danger', 'The meter fuse blew',
          'In mA mode the meter is almost like a wire (about 1 Ω). Across a battery or rail it makes a short circuit, so its fuse blows. ' +
          'To measure current, open the circuit and put the meter in the gap (in series). Tap the meter and press “New fuse”.');
      }
      p._i = p._e.el !== undefined ? r.i(p._e.el) : 0;
      p.st.reading = { m: m, text: read, unit: unit, val: val };
      p.vis = { text: read, unit: unit, m: m };
    },
    hot: [{ id: 'dial', x: 7.7, y: 15.05, r: 4.6, kind: 'dial' }],
    info: function (p) {
      var rd = p.st.reading || {};
      var help = { V: 'Volts between the red and black probe. Put the probes across a part.', A: 'Current through the meter in mA. The meter must be IN the path (open the loop and put it in the gap).', ohm: 'Resistance of a part with no power.', diode: 'Diode test: shows the voltage an LED or diode needs, in mV. Red probe on the long leg (+). OL = no current flows (backwards, or more than 2 V).', off: 'The meter is off.' }[p.props.mode];
      return [['Reading', (rd.text || '—') + ' ' + (rd.unit || '')], ['Mode', help], ['Range', 'This meter picks the range for you. On a real DT-830B you turn the dial to a range, like 20 V or 200 mA.']];
    }
  };

  // ---------- microcontroller boards ----------
  var np = nanoPins();
  PARTS.nano = {
    name: 'Arduino Nano', cat: 'boards', kind: 'rigid', mcu: 'nano',
    desc: 'A small Arduino board (ATmega328P chip). It works at 5V. Put it across the middle gap so each pin has its own strip.',
    pins: np.pins, pinPos: np.pos,
    body: [-2.0, -0.6, 15.0, 6.6], covers: true,
    defaults: { usb: true, program: 'none' },
    props: [{ k: 'usb', label: 'USB cable plugged in', type: 'toggle' }],
    links: function (p) { var g = []; var gi = []; np.pins.forEach(function (pin, i) { if (pin.kind === 'gnd') gi.push(i); }); for (var k = 1; k < gi.length; k++) g.push([gi[0], gi[k]]); return g; },
    stamp: mcuStamp, after: mcuAfter,
    info: function (p) { return [['Power', p.st.powered ? 'On (' + (p.props.usb !== false ? 'USB' : 'from pins') + ')' : 'Off']]; }
  };
  var fp = featherPins();
  PARTS.esp32 = {
    name: 'ESP32 Feather (HUZZAH32)', cat: 'boards', kind: 'rigid', mcu: 'esp32',
    desc: 'An Adafruit board with an ESP32 chip (Wi-Fi + Bluetooth). It works at 3.3V: its pins must never get 5V.',
    pins: fp.pins, pinPos: fp.pos,
    body: [-2.6, -0.55, 17.4, 8.55], covers: true,
    defaults: { usb: true, program: 'none' },
    props: [{ k: 'usb', label: 'USB cable plugged in', type: 'toggle' }],
    links: function () { return []; },
    stamp: mcuStamp, after: mcuAfter,
    info: function (p) { return [['Power', p.st.powered ? 'On' : 'Off'], ['Logic level', '3.3 V (pins take max 3.6 V)']]; }
  };
  var pp = piPins();
  PARTS.pi5 = {
    name: 'Raspberry Pi 5', cat: 'boards', kind: 'offboard', mcu: 'pi5',
    desc: 'A full small computer. It is too big for the breadboard, so you connect its {{GPIO}} {{header pin|header pins}} with jumper wires. Its pins work at 3.3V. Pin names like GPIO17 are {{BCM}} numbers.',
    pins: pp.pins, pinPos: pp.pos.map(function (q) { return [q[0] + 7.4, q[1] + 1.0]; }),
    size: [33.5, 22],
    defaults: { usb: true, program: 'none' },
    props: [{ k: 'usb', label: 'Power supply plugged in', type: 'toggle' }],
    links: function () { var g = [], first = -1; pp.pins.forEach(function (pin, i) { if (pin.kind === 'gnd') { if (first < 0) first = i; else g.push([first, i]); } }); return g; },
    stamp: mcuStamp, after: mcuAfter,
    info: function (p) { return [['Power', p.st.powered ? 'On' : 'Off'], ['Analog inputs', 'None (needs an extra chip)']]; }
  };
  PARTS.wio = {
    name: 'Wio Terminal', cat: 'boards', kind: 'offboard', mcu: 'wio',
    desc: 'A Seeed board with a screen, buttons and sensors built in. Its 40-pin header on the back is like the Raspberry Pi one (names like BCM17 are Raspberry Pi {{BCM}} names). Pins work at 3.3V.',
    pins: wioPinsCache().pins, pinPos: wioPinsCache().pos.map(function (q) { return [q[0] + 4.25, q[1] + 28.6]; }),
    size: [28.5, 31],
    defaults: { usb: true, program: 'none', shell: 'blue' },
    props: [{ k: 'usb', label: 'USB cable plugged in', type: 'toggle' }, { k: 'shell', label: 'Case colour (match yours)', type: 'select', options: ['blue', 'white'], labels: ['Blue', 'White'] }],
    links: function () { var g = [], first = -1; PARTS.wio.pins.forEach(function (pin, i) { if (pin.kind === 'gnd') { if (first < 0) first = i; else g.push([first, i]); } }); return g; },
    stamp: mcuStamp, after: mcuAfter,
    info: function (p) { return [['Power', p.st.powered ? 'On' : 'Off']]; }
  };

  // ---------- sensors, displays, sound ----------
  function needPower(p, r, ctx, vccPin, gndPin, vmin, vmax, name) {
    var v = r.pinV(vccPin) - r.pinV(gndPin);
    p.st.vcc = v;
    if (v > vmax + 0.3) ctx.issue(p, 'overvolt', 'danger', 'Too much voltage for the ' + name, 'It gets ' + fmtV(v) + ' but takes at most ' + vmax + ' V.');
    if (v < -0.5) ctx.issue(p, 'reversed', 'danger', name + ': power is backwards', 'VCC must go to + and GND to −. Swap the two wires.');
    return v >= vmin && v <= vmax + 0.3;
  }
  // Finds the microcontroller whose pin with flag `flag` (sda/scl) is on the same net as pin `pi`.
  function mcuPinOnNet(ctx, p, pi) {
    var net = ctx.netOfPin(p, pi);
    if (net === null) return null;
    var found = null;
    ctx.parts.forEach(function (q) {
      var d = PARTS[q.type];
      if (!d.mcu) return;
      d.pins.forEach(function (pin, k) { if (!found && ctx.netOfPin(q, k) === net) found = { mcu: q, pin: pin, idx: k }; });
    });
    return found;
  }
  BB.mcuPinOnNet = mcuPinOnNet;

  function i2cDisplay(p, r, ctx, idx, vmin, vmax, name) {
    var ok = needPower(p, r, ctx, idx.vcc, idx.gnd, vmin, vmax, name);
    var sda = mcuPinOnNet(ctx, p, idx.sda), scl = mcuPinOnNet(ctx, p, idx.scl);
    var mcu = (sda && sda.mcu) || (scl && scl.mcu);
    var why = '';
    if (!ok) why = (p.st.vcc || 0) < vmin ? 'No power. Connect VCC to + and GND to −.' : 'Too much voltage on VCC (' + fmtV(p.st.vcc) + '). It takes at most ' + vmax + ' V.';
    else if (!sda && !scl) why = 'Not connected to a board. Connect SDA and SCL.';
    else if (sda && sda.pin.scl && scl && scl.pin.sda) why = 'SDA and SCL are swapped.';
    else if (!sda || !sda.pin.sda) why = 'SDA must go to the board’s SDA pin' + (mcu ? ' (' + sdaName(mcu) + ').' : '.');
    else if (!scl || !scl.pin.scl) why = 'SCL must go to the board’s SCL pin' + (mcu ? ' (' + sclName(mcu) + ').' : '.');
    else if (sda.mcu !== scl.mcu) why = 'SDA and SCL go to two different boards.';
    else if (!mcu || !mcu.st.powered) why = 'The board is not powered.';
    else if (ctx.netOfPin(p, idx.gnd) !== ctx.netOfPin(mcu, PARTS[mcu.type].pins.findIndex(function (q) { return q.kind === 'gnd'; }))) why = 'The screen GND must be joined to the board GND.';
    p.st.why = why;
    p.st.mcu = why || !mcu ? null : mcu.id;
    var lines = why || !mcu ? null : (mcu.st.display || null);
    p.vis = { on: ok, lines: lines, why: why };
    if (ok && why && mcu) ctx.issue(p, 'i2c', 'warn', name + ' stays blank', why + ' I2C uses two wires: SDA (data) and SCL (clock).');
    return lines;
  }
  function sdaName(m) { var d = PARTS[m.type]; var q = d.pins.find(function (x) { return x.sda; }); return q ? q.n : 'SDA'; }
  function sclName(m) { var d = PARTS[m.type]; var q = d.pins.find(function (x) { return x.scl; }); return q ? q.n : 'SCL'; }

  PARTS.oled = {
    name: 'OLED screen 128×64 (I2C)', cat: 'modules', kind: 'offboard',
    desc: 'A small screen. It talks with the board over I2C: two wires, SDA (data) and SCL (clock). It works with 3.3V or 5V. Connect its 4 pins with jumper wires.',
    pins: [{ n: 'GND' }, { n: 'VCC' }, { n: 'SCL' }, { n: 'SDA' }],
    pinPos: [[3.8, 0.75], [4.8, 0.75], [5.8, 0.75], [6.8, 0.75]],
    size: [10.6, 10.7],
    defaults: {}, props: [],
    stamp: function (p, n) {
      n.R('p1', 'p0', 250); // about 20 mA at 5 V
      n.R('p3', 'p1', 10000); n.R('p2', 'p1', 10000); // pull-up resistors on the module
    },
    after: function (p, r, ctx) { i2cDisplay(p, r, ctx, { gnd: 0, vcc: 1, scl: 2, sda: 3 }, 2.8, 5.5, 'OLED screen'); },
    info: function (p) { return [['Power', fmtV(p.st.vcc || 0)], ['Status', p.st.why || 'Working']]; }
  };
  PARTS.lcd = {
    name: '16×2 LCD (I2C)', cat: 'modules', kind: 'offboard',
    desc: 'A text screen: 2 lines of 16 letters. The small board on its back (an {{I2C backpack}}) lets you use just 4 wires. It needs 5V.',
    pins: [{ n: 'GND' }, { n: 'VCC' }, { n: 'SDA' }, { n: 'SCL' }],
    pinPos: [[-0.2, 4.5], [-0.2, 5.5], [-0.2, 6.5], [-0.2, 7.5]],
    size: [31.5, 14],
    defaults: { light: 'green' },
    props: [{ k: 'light', label: 'Backlight', type: 'select', options: ['green', 'blue'], labels: ['Yellow-green', 'Blue'] }],
    stamp: function (p, n) { n.R('p1', 'p0', 200); n.R('p2', 'p1', 4700); n.R('p3', 'p1', 4700); },
    after: function (p, r, ctx) {
      var lines = i2cDisplay(p, r, ctx, { gnd: 0, vcc: 1, sda: 2, scl: 3 }, 2.5, 5.5, 'LCD');
      var v = p.st.vcc || 0;
      if (v > 2.5 && v < 4.3) { p.vis.faint = true; ctx.issue(p, 'lcdlow', 'warn', 'The LCD text is very faint', 'This LCD is made for 5V. At ' + fmtV(v) + ' the letters are hard to see. Use 5V for VCC.'); }
      return lines;
    },
    info: function (p) { return [['Power', fmtV(p.st.vcc || 0)], ['Status', p.st.why || 'Working']]; }
  };
  PARTS.seg7 = {
    name: '7-segment display', cat: 'modules', kind: 'rigid',
    desc: 'Shows one digit with 7 LED bars (a to g) and a dot. All the − sides are joined at {{COM}} ({{common cathode}}). Each bar needs its own resistor.',
    pins: [{ n: 'g' }, { n: 'f' }, { n: 'COM' }, { n: 'a' }, { n: 'b' }, { n: 'e' }, { n: 'd' }, { n: 'COM' }, { n: 'c' }, { n: 'dp' }],
    pinPos: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [0, 6], [1, 6], [2, 6], [3, 6], [4, 6]],
    body: [-0.9, -0.55, 4.9, 6.55], covers: true,
    defaults: { color: 'red' }, props: [],
    links: function () { return [[2, 7]]; },
    stamp: function (p, n) {
      var lp = E.ledParams('red');
      n.R('p2', 'p7', 0.01);
      p._e = {};
      p.st.burntSeg = p.st.burntSeg || {};
      [['a', 3], ['b', 4], ['c', 8], ['d', 6], ['e', 5], ['f', 1], ['g', 0], ['dp', 9]].forEach(function (s) {
        if (p.st.burntSeg[s[0]]) return;
        var mid = n.node();
        p._e[s[0]] = n.D('p' + s[1], mid, lp.is, lp.nvt);
        n.R(mid, 'p2', lp.rs);
      });
    },
    after: function (p, r, ctx) {
      var seg = {};
      Object.keys(p._e).forEach(function (k) {
        var i = r.i(p._e[k]);
        p.st.segHeat = p.st.segHeat || {};
        var h = { heat: p.st.segHeat[k] || 0 };
        if (heat(h, i, 0.03, ctx.dt, 1.2, 3)) { p.st.burntSeg[k] = true; p.st.smoke = ctx.t; ctx.event(p, 'burn'); }
        p.st.segHeat[k] = h.heat;
        seg[k] = Math.min(1.2, Math.sqrt(Math.max(0, i) / 0.015));
      });
      p.vis = { seg: seg, burnt: Object.keys(p.st.burntSeg) };
      if (Object.keys(p.st.burntSeg).length) ctx.issue(p, 'burnt', 'danger', 'A segment burned out', 'Each segment is a small LED. Without its own resistor it gets too much current.');
    },
    info: function () { return [['Type', 'Common cathode (COM goes to GND)']]; }
  };
  PARTS.ldr = {
    name: 'Light sensor (LDR)', cat: 'sensors', kind: 'leads', maxSpan: 3,
    desc: 'A resistor that changes with light: about 1 kΩ in bright light and 1 MΩ in the dark. With a second resistor it makes a voltage that a pin can read.',
    pins: [{ n: 'leg 1' }, { n: 'leg 2' }],
    defaults: { light: 0.7 },
    props: [{ k: 'light', label: 'Light', type: 'range', min: 0, max: 1, step: 0.01, env: true, fmt: function (v) { return v < 0.15 ? 'Dark' : v < 0.45 ? 'Dim room' : v < 0.8 ? 'Bright room' : 'Sunlight'; } }],
    res: function (p) { return Math.pow(10, 6 - 3 * p.props.light); },
    stamp: function (p, n) { p._e = n.R('p0', 'p1', PARTS.ldr.res(p)); },
    after: function (p, r) { p._i = r.i(p._e); p.vis = { light: p.props.light }; },
    info: function (p, r) { return [['Resistance now', fmtR(PARTS.ldr.res(p))]].concat(twoTermInfo(p, r)); }
  };
  PARTS.dht11 = {
    name: 'Temp. & humidity sensor (DHT11)', cat: 'sensors', kind: 'rigid',
    desc: 'Measures temperature and humidity and sends them as a digital signal on one data wire. The data wire needs a {{pull-up resistor}} (10 kΩ to VCC).',
    pins: [{ n: 'VCC' }, { n: 'DATA' }, { n: 'NC', d: 'Not connected' }, { n: 'GND' }],
    pinPos: [[0, 0], [1, 0], [2, 0], [3, 0]],
    body: [-0.7, -6.4, 3.7, 0.25],
    defaults: { temp: 22, hum: 45 },
    props: [{ k: 'temp', label: 'Room temperature', type: 'range', min: 0, max: 50, step: 1, env: true, fmt: function (v) { return v + ' °C'; } }, { k: 'hum', label: 'Humidity', type: 'range', min: 20, max: 90, step: 1, env: true, fmt: function (v) { return v + ' %'; } }],
    stamp: function (p, n) { n.R('p0', 'p3', 5000); n.R('p1', 'p3', 1e8); n.R('p2', 'p3', 1e9); },
    after: function (p, r, ctx) {
      var ok = needPower(p, r, ctx, 0, 3, 3.0, 5.5, 'DHT11');
      var vd = r.pinV(1) - r.pinV(3);
      p.st.ok = ok; p.st.pulled = ok && vd > 0.7 * p.st.vcc;
      p.vis = { on: ok };
    },
    info: function (p) { return [['Power', fmtV(p.st.vcc || 0)], ['Data line', p.st.pulled ? 'Pulled up: OK' : 'Not pulled up']]; }
  };
  PARTS.hcsr04 = {
    name: 'Ultrasonic distance sensor (HC-SR04)', cat: 'sensors', kind: 'rigid',
    desc: 'Sends a sound pulse you cannot hear and waits for the echo. It needs 5V. Its {{ECHO}} pin gives 5V pulses: too much for a 3.3V board.',
    pins: [{ n: 'VCC' }, { n: 'TRIG' }, { n: 'ECHO' }, { n: 'GND' }],
    pinPos: [[0, 0], [1, 0], [2, 0], [3, 0]],
    body: [-7.3, -4.6, 10.3, 0.25],
    defaults: { dist: 30 },
    props: [{ k: 'dist', label: 'Object distance', type: 'range', min: 3, max: 200, step: 1, env: true, fmt: function (v) { return v + ' cm'; } }],
    stamp: function (p, n, ctx) {
      n.R('p0', 'p3', 333); // ~15 mA at 5 V
      n.R('p1', 'p3', 10000);
      var v = p.st.vcc || 0;
      // ECHO is HIGH for 58 µs per cm, once every 60 ms (a short pulse, not a steady 5 V)
      var active = v >= 4.5 && p.st.trig;
      var high = active && (ctx.pwmHigh ? ctx.pwmHigh(p.st.duty) : true);
      var s = n.node();
      p._e = n.V(s, 'p3', high ? v : 0);
      n.R(s, 'p2', 10);
    },
    after: function (p, r, ctx) {
      var ok = needPower(p, r, ctx, 0, 3, 4.5, 5.5, 'HC-SR04');
      var v = r.pinV(0) - r.pinV(3);
      if (v > 2.5 && v < 4.5) ctx.issue(p, 'lowv', 'warn', 'The distance sensor needs 5V', 'It gets ' + fmtV(v) + '. At 3.3V the HC-SR04 does not work well. Power it from 5V (on an ESP32 Feather: the USB pin).');
      // a measurement starts when TRIG gets a short HIGH pulse (more than about 2 V)
      var trigPeak = r.pinVpeak(1) - r.pinV(3);
      var was = !!p.st.trig;
      p.st.trig = ok && trigPeak > 2.0;
      var d = p.st.trig ? Math.min(0.5, p.props.dist * 58e-6 / 0.06) : 0;
      if (was !== p.st.trig || d !== p.st.duty) ctx.dirty();
      p.st.duty = d;
      p.vis = { on: ok, pinging: p.st.trig };
    },
    dynamic: function (p) { return !!p.st.trig; },
    info: function (p) { return [['Power', fmtV(p.st.vcc || 0)], ['Measuring', p.st.trig ? 'Yes: TRIG pulses, ECHO answers' : 'No: TRIG gets no pulses'], ['ECHO pulse', p.st.trig ? Math.round(p.props.dist * 58) + ' µs (58 µs per cm)' : '—']]; }
  };
  PARTS.pir = {
    name: 'Motion sensor (PIR HC-SR501)', cat: 'sensors', kind: 'offboard',
    desc: 'Sees warm moving bodies. When it sees motion, its OUT pin goes to 3.3V for a few seconds. Power it with 5V.',
    pins: [{ n: 'VCC' }, { n: 'OUT' }, { n: 'GND' }],
    pinPos: [[3.6, 13.4], [4.6, 13.4], [5.6, 13.4]],
    size: [12.8, 13.4],
    defaults: {}, props: [],
    stamp: function (p, n) {
      n.R('p0', 'p2', 50000);
      var on = (p.st.vcc || 0) >= 4.5 && p.st.motionUntil > (p.st.now || 0);
      var s = n.node();
      p._e = n.V(s, 'p2', on ? 3.3 : 0);
      n.R(s, 'p1', 1000);
    },
    after: function (p, r, ctx) {
      var ok = needPower(p, r, ctx, 0, 2, 4.5, 20, 'PIR sensor');
      var v = r.pinV(0) - r.pinV(2);
      if (v > 2 && v < 4.5) ctx.issue(p, 'lowv', 'warn', 'The motion sensor needs 5V', 'It gets ' + fmtV(v) + '. Power it from 5V.');
      var was = p.st.out;
      p.st.now = ctx.t;
      p.st.out = ok && p.st.motionUntil > ctx.t;
      if (was !== p.st.out) ctx.dirty();
      p.vis = { on: ok, motion: p.st.out };
    },
    dynamic: function (p) { return p.st.motionUntil > (p.st.now || 0) - 0.1; },
    actions: [{ id: 'wave', label: '👋 Wave a hand' }],
    info: function (p) { return [['Power', fmtV(p.st.vcc || 0)], ['OUT', p.st.out ? 'HIGH: motion!' : 'LOW: no motion']]; }
  };
  PARTS.mic = {
    name: 'Microphone module (KY-038)', cat: 'sensors', kind: 'rigid',
    desc: 'Hears sound. AO gives a voltage that gets bigger with louder sound. DO goes HIGH when the sound is louder than the level set by its small screw.',
    pins: [{ n: 'AO' }, { n: 'G' }, { n: '+' }, { n: 'DO' }],
    pinPos: [[0, 0], [1, 0], [2, 0], [3, 0]],
    body: [-1.0, -13.2, 4.0, 0.25],
    defaults: { sound: 0.05 },
    props: [{ k: 'sound', label: 'Sound level', type: 'range', min: 0, max: 1, step: 0.01, env: true, fmt: function (v) { return v < 0.15 ? 'Quiet' : v < 0.5 ? 'Talking' : v < 0.8 ? 'Loud' : 'Clap!'; } }],
    stamp: function (p, n) {
      n.R('p2', 'p1', 1000);
      var v = p.st.vcc || 0, s = p.props.sound;
      if (p.st.clapUntil > (p.st.now || 0)) s = Math.max(s, 0.95);
      p.st.level = s;
      var a = n.node(); n.V(a, 'p1', v >= 3 ? v * (0.5 + 0.45 * s) : 0); n.R(a, 'p0', 1000);
      var d = n.node(); n.V(d, 'p1', v >= 3 && s > 0.6 ? v : 0); n.R(d, 'p3', 1000);
    },
    after: function (p, r, ctx) {
      var ok = needPower(p, r, ctx, 2, 1, 3.0, 5.5, 'microphone');
      p.st.now = ctx.t;
      var lv = p.st.lastLevel; p.st.lastLevel = p.st.level;
      if (lv !== p.st.level) ctx.dirty();
      p.vis = { on: ok, level: p.st.level };
    },
    dynamic: function (p) { return p.st.clapUntil > (p.st.now || 0) - 0.1; },
    actions: [{ id: 'clap', label: '👏 Clap' }],
    info: function (p) { return [['Power', fmtV(p.st.vcc || 0)], ['Sound level', Math.round((p.st.level || 0) * 100) + ' %']]; }
  };
  PARTS.buzzer = {
    name: 'Active buzzer', cat: 'sound', kind: 'rigid',
    desc: 'Beeps by itself when it gets 3–5V. The long leg (+) goes to +. Backwards, it stays quiet.',
    pins: [{ n: '+' }, { n: '−' }],
    pinPos: [[0, 0], [3, 0]],
    body: [-0.9, -2.4, 3.9, 2.4],
    defaults: {}, props: [],
    stamp: function (p, n) {
      var mid = n.node();
      p._e = n.D('p0', mid, SILICON.is, SILICON.nvt);
      n.R(mid, 'p1', 140);
    },
    after: function (p, r, ctx) {
      var i = r.i(p._e); p._i = i;
      var v = r.pinV(0) - r.pinV(1);
      p.st.sound = i > 0.012 ? { f: 2300, vol: Math.min(1, i / 0.03) } : null;
      p.vis = { on: !!p.st.sound };
      if (v < -1) ctx.issue(p, 'reversed', 'warn', 'The buzzer is in backwards', 'Its long leg (+) must go toward +.');
      if (v > 6) ctx.issue(p, 'overvolt', 'warn', 'Too much voltage for the buzzer', 'It is made for 3–5V. At ' + fmtV(v) + ' it gets hot.');
    },
    info: function (p, r) { return [['State', p.st.sound ? 'Beeping' : 'Quiet']].concat(twoTermInfo(p, r)); }
  };
  PARTS.speaker = {
    name: 'Small speaker (8 Ω)', cat: 'sound', kind: 'module',
    desc: 'Makes sound when the current goes back and forth fast (a tone). It is only 8 Ω, so from a board pin always add a resistor (about 220 Ω).',
    pins: [{ n: '+', d: 'Red wire' }, { n: '−', d: 'Black wire' }],
    size: [11.5, 11.5], leadFrom: [[11.0, 4.6], [11.0, 7.0]],
    defaults: {}, props: [],
    stamp: function (p, n) { p._e = n.R('p0', 'p1', 8); },
    after: function (p, r, ctx) {
      var i = r.i(p._e); p._i = i;
      var pw = i * i * 8;
      p.vis = { vib: Math.min(1, Math.abs(i) / 0.02) };
      if (pw > 0.5) {
        ctx.issue(p, 'hot', 'warn', 'The speaker coil is getting hot', 'A steady current makes no sound. It only heats the coil. Play a tone from a board, through a resistor.');
      }
    },
    info: function (p, r) { return [['Coil', '8 Ω']].concat(twoTermInfo(p, r)); }
  };

  BB.PARTS = PARTS;
  BB.R_VALUES = R_VALUES;
  if (typeof module !== 'undefined' && module.exports) module.exports = PARTS;
})();
