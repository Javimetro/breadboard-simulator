// Preset "programs" for the microcontroller boards. No real code runs: each program reads
// its input pins from the last simulation step and sets its output pins for the next one.
(function () {
  'use strict';
  var BB = (globalThis.BB = globalThis.BB || {});
  var PARTS = BB.PARTS;

  // Default pin for each role, per board.
  var PINS = {
    nano: { led: 'D13', fade: 'D9', button: 'D3', knob: 'A0', light: 'A0', dht: 'D4', trig: 'D9', echo: 'D10', pir: 'D7', buzzer: 'D8', speaker: 'D8', mic: 'A0',
      a: 'D2', b: 'D3', c: 'D4', d: 'D5', e: 'D6', f: 'D7', g: 'D8' },
    esp32: { led: '13', fade: '13', button: '14', knob: 'A2', light: 'A2', dht: '32', trig: '21', echo: '33', pir: '15', buzzer: '27', speaker: '27', mic: 'A2',
      a: '13', b: '12', c: '27', d: '33', e: '15', f: '32', g: '14' },
    pi5: { led: 'GPIO17', fade: 'GPIO18', button: 'GPIO27', dht: 'GPIO4', trig: 'GPIO23', echo: 'GPIO24', pir: 'GPIO22', buzzer: 'GPIO18', speaker: 'GPIO18',
      a: 'GPIO5', b: 'GPIO6', c: 'GPIO13', d: 'GPIO19', e: 'GPIO26', f: 'GPIO16', g: 'GPIO20' },
    wio: { led: 'D0/A0', fade: 'D0/A0', button: 'D1/A1', knob: 'D2/A2', light: 'D2/A2', dht: 'D3/A3', trig: 'D4/A4', echo: 'D5/A5', pir: 'D6/A6', buzzer: 'D8/A8', speaker: 'D8/A8', mic: 'D2/A2',
      a: 'D0/A0', b: 'D1/A1', c: 'D2/A2', d: 'D3/A3', e: 'D4/A4', f: 'D5/A5', g: 'D6/A6' }
  };
  var DIGITS = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };

  var P = {
    none: { name: 'No program', desc: 'The board is on, but does nothing. All its pins are inputs.', roles: {}, step: function () {} },
    blink: {
      name: 'Blink', desc: 'Turns the LED pin on for half a second, then off for half a second, again and again. (Like the Arduino “Blink” example: on the Nano it uses D13, which also drives the small “L” LED on the board.)',
      roles: { led: { label: 'LED', mode: 'out' } },
      step: function (io) { io.out('led', Math.floor(io.t / 0.5) % 2 === 0 ? 1 : 0); }
    },
    button_led: {
      name: 'Button → LED', desc: 'The LED is on while the button is pressed. The button pin uses the chip’s built-in {{pull-up resistor}}, so connect the button between the pin and GND.',
      roles: { button: { label: 'Button', mode: 'in', pull: 'up' }, led: { label: 'LED', mode: 'out' } },
      step: function (io) {
        var b = io.digital('button');
        io.out('led', b === 0 ? 1 : 0);
        io.print(b === 0 ? 'Button: pressed' : b === 1 ? 'Button: not pressed' : 'Button: ?');
      }
    },
    fade_knob: {
      name: 'Knob → LED brightness', desc: 'Reads the knob on an analog pin and sets the LED brightness with {{PWM}} (very fast on/off). Only some pins can do PWM: on the Nano these are D3, D5, D6, D9, D10 and D11 (marked ~).',
      roles: { knob: { label: 'Knob (middle leg)', mode: 'in', analog: true }, fade: { label: 'LED (PWM pin)', mode: 'out', pwm: true } },
      needsAnalog: true,
      step: function (io) {
        var a = io.analog('knob');
        if (a === null) { io.out('fade', 0); return; }
        io.pwm('fade', a / io.adcMax);
        io.print('Knob: ' + a + '  LED: ' + Math.round(100 * a / io.adcMax) + ' %');
      }
    },
    light_meter: {
      name: 'Light meter → screen', desc: 'Reads a light sensor on an analog pin and shows the number on a screen (OLED or LCD on the I2C pins) and in the serial monitor.',
      roles: { light: { label: 'Light sensor (divider middle)', mode: 'in', analog: true } },
      needsAnalog: true, display: true,
      step: function (io) {
        var a = io.analog('light');
        if (a === null) return;
        var bar = Math.round(10 * a / io.adcMax);
        io.show(['LIGHT METER', 'Light: ' + a, '[' + '#'.repeat(bar) + '.'.repeat(10 - bar) + ']']);
        io.print('Light: ' + a);
      }
    },
    thermometer: {
      name: 'Thermometer → screen', desc: 'Reads the DHT11 sensor and shows temperature and humidity on a screen and in the serial monitor.',
      roles: { dht: { label: 'DHT11 data', mode: 'in' } }, display: true,
      step: function (io) {
        var d = io.dht('dht');
        if (d.error) { io.show(['THERMOMETER', d.error]); io.print('DHT11 error: ' + d.error); return; }
        io.show(['THERMOMETER', 'Temp: ' + d.t + ' C', 'Humidity: ' + d.h + ' %']);
        io.print('Temp: ' + d.t + ' C  Humidity: ' + d.h + ' %');
      }
    },
    distance: {
      name: 'Distance meter', desc: 'Sends a pulse on TRIG and times the pulse on ECHO from an HC-SR04. Shows the distance on a screen (if there is one) and in the serial monitor.',
      roles: { trig: { label: 'TRIG', mode: 'out' }, echo: { label: 'ECHO', mode: 'in' } }, display: true,
      step: function (io) {
        io.out('trig', 0);
        var s = io.findOn('trig', 'hcsr04', 1);
        var e = io.digital('echo');
        var txt;
        if (!s) txt = 'No sensor on TRIG';
        else if (!s.st.trig) txt = 'Sensor has no power';
        else if (e === null) txt = 'ECHO unclear (' + io.volts('echo').toFixed(2) + ' V)';
        else if (e === 0) txt = 'No echo';
        else txt = 'Distance: ' + s.props.dist + ' cm';
        io.mem.dist = s && e === 1 ? s.props.dist : null;
        io.show(['DISTANCE', txt]);
        io.print(txt);
      }
    },
    motion_alarm: {
      name: 'Motion alarm', desc: 'When the PIR sensor sees motion, the buzzer sounds and the LED turns on.',
      roles: { pir: { label: 'PIR OUT', mode: 'in' }, buzzer: { label: 'Buzzer (+)', mode: 'out' }, led: { label: 'LED', mode: 'out' } },
      step: function (io) {
        var m = io.digital('pir') === 1;
        io.out('buzzer', m ? 1 : 0); io.out('led', m ? 1 : 0);
        io.print(m ? 'Motion!' : 'All quiet');
      }
    },
    clap_beep: {
      name: 'Clap → beep', desc: 'Listens to the microphone (AO) on an analog pin. A loud sound starts a 1 kHz tone on the speaker pin for half a second.',
      roles: { mic: { label: 'Microphone AO', mode: 'in', analog: true }, speaker: { label: 'Speaker', mode: 'out', tone: true } },
      needsAnalog: true,
      step: function (io) {
        var a = io.analog('mic');
        if (a !== null && a > 0.8 * io.adcMax) io.mem.until = io.t + 0.5;
        var on = io.mem.until > io.t;
        io.tone('speaker', on ? 1000 : 0);
        io.print('Sound: ' + (a === null ? '?' : a) + (on ? '  BEEP!' : ''));
      }
    },
    tone_button: {
      name: 'Button → tone', desc: 'Plays a 440 Hz tone (the note A) on the speaker pin while the button is pressed. Button between its pin and GND.',
      roles: { button: { label: 'Button', mode: 'in', pull: 'up' }, speaker: { label: 'Speaker / buzzer', mode: 'out', tone: true } },
      step: function (io) { var b = io.digital('button'); io.tone('speaker', b === 0 ? 440 : 0); }
    },
    counter: {
      name: '7-segment counter', desc: 'Counts 0 to 9, one step each second, on a common-cathode 7-segment display (a resistor on each segment pin).',
      roles: { a: { label: 'Segment a', mode: 'out' }, b: { label: 'Segment b', mode: 'out' }, c: { label: 'Segment c', mode: 'out' }, d: { label: 'Segment d', mode: 'out' }, e: { label: 'Segment e', mode: 'out' }, f: { label: 'Segment f', mode: 'out' }, g: { label: 'Segment g', mode: 'out' } },
      step: function (io) {
        var n = Math.floor(io.t) % 10, on = DIGITS[n];
        'abcdefg'.split('').forEach(function (s) { io.out(s, on.indexOf(s) >= 0 ? 1 : 0); });
        io.print('Showing ' + n);
      }
    }
  };
  var ORDER = ['none', 'blink', 'button_led', 'fade_knob', 'light_meter', 'thermometer', 'distance', 'motion_alarm', 'clap_beep', 'tone_button', 'counter'];

  function available(mcu, id) {
    var prog = P[id];
    if (!prog) return false;
    if (id === 'none') return true;
    var map = PINS[mcu];
    if (prog.needsAnalog && BB.BOARDS[mcu].adcMax === 0) return false;
    return Object.keys(prog.roles).every(function (r) { return !!map[r]; });
  }
  function pinFor(p, role) {
    var mcu = PARTS[p.type].mcu;
    return (p.props.pins && p.props.pins[role]) || PINS[mcu][role];
  }

  // Runs one step of the part's program, which fills p.st.io (pin modes and levels).
  function run(p, sim, ctx) {
    var def = PARTS[p.type], cfg = BB.BOARDS[def.mcu], st = p.st = p.st || {};
    var id = p.props.program || 'none';
    var prog = P[id] || P.none;
    if (!available(def.mcu, id)) prog = P.none;
    st.mem = st.mem || {};
    if (st.progId !== id) { st.progId = id; st.mem = {}; st.serial = []; st.display = null; st.t0 = ctx.t; }
    var io = {};
    var pinIdx = {};
    def.pins.forEach(function (pin, k) { pinIdx[pin.n] = k; });
    Object.keys(prog.roles).forEach(function (role) {
      var r = prog.roles[role], label = pinFor(p, role);
      io[label] = { mode: r.mode, pull: r.pull, level: 0 };
    });
    var lv = st.lastV || {};
    var api = {
      t: ctx.t - (st.t0 || 0), adcMax: cfg.adcMax, mem: st.mem,
      out: function (role, level) { var o = io[pinFor(p, role)]; if (o) { o.level = level ? 1 : 0; delete o.pwm; } },
      pwm: function (role, duty) { var o = io[pinFor(p, role)]; if (!o) return; duty = Math.max(0, Math.min(1, duty)); if (duty <= 0.004) { o.level = 0; delete o.pwm; } else if (duty >= 0.996) { o.level = 1; delete o.pwm; } else { o.pwm = duty; o.level = 1; } },
      tone: function (role, f) { var o = io[pinFor(p, role)]; if (!o) return; if (f > 0) { o.pwm = 0.5; o.level = 1; o.freq = f; } else { o.level = 0; delete o.pwm; delete o.freq; } },
      volts: function (role) { return lv[pinFor(p, role)] || 0; },
      digital: function (role) {
        if (st.floating && st.floating[pinFor(p, role)]) return Math.random() < 0.5 ? 1 : 0;
        var v = lv[pinFor(p, role)] || 0;
        if (v >= cfg.hiTh) return 1;
        if (v <= cfg.loTh) return 0;
        return null;
      },
      analog: function (role) {
        var label = pinFor(p, role), pin = def.pins[pinIdx[label]];
        if (!pin || !pin.analog || !cfg.adcMax) return null;
        if (st.floating && st.floating[label]) { st.mem._noise = Math.max(0.1, Math.min(0.9, (st.mem._noise || 0.5) + (Math.random() - 0.5) * 0.12)); return Math.round(st.mem._noise * cfg.adcMax); }
        var v = Math.max(0, Math.min(cfg.adcRef, lv[label] || 0));
        return Math.round(v / cfg.adcRef * cfg.adcMax);
      },
      show: function (lines) { st.display = lines; },
      print: function (line) {
        st.serial = st.serial || [];
        if (st.serial[st.serial.length - 1] !== line) { st.serial.push(line); if (st.serial.length > 8) st.serial.shift(); }
      },
      // A part of `type` whose pin `k` is on the same net as the role's pin.
      findOn: function (role, type, k) {
        var nets = sim._nets || sim.nets(), keys = nets.keys[p.id];
        var idx = pinIdx[pinFor(p, role)]; if (idx === undefined || !keys) return null;
        var root = nets.find(keys[idx]);
        if (keys[idx][0] === 'F') return null;
        var found = null;
        sim.state.parts.forEach(function (q) {
          if (q.type !== type || found) return;
          var qk = nets.keys[q.id]; if (qk && qk[k] && qk[k][0] !== 'F' && nets.find(qk[k]) === root) found = q;
        });
        return found;
      },
      dht: function (role) {
        var s = api.findOn(role, 'dht11', 1);
        if (!s) return { error: 'No DHT11 on pin ' + pinFor(p, role) };
        if (!s.st.ok) return { error: 'DHT11 has no power' };
        if (!s.st.pulled) return { error: 'No pull-up on DATA' };
        return { t: s.props.temp, h: s.props.hum };
      }
    };
    if (st.powered && !st.dead) prog.step(api);
    st.io = st.powered ? io : {};
    // Wio Terminal: its own screen shows what the program shows, or the serial output.
  }

  BB.programs = { P: P, ORDER: ORDER, PINS: PINS, run: run, available: available, pinFor: pinFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = BB.programs;
})();
