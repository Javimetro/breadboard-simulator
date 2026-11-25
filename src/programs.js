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
      name: 'Knob → LED brightness', desc: 'Reads the knob on an {{analog}} pin and sets the LED brightness with {{PWM}} (very fast on/off). Only some pins can do PWM: on the Nano these are D3, D5, D6, D9, D10 and D11 (marked ~).',
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
        io.pulse('trig'); // a 10 µs HIGH pulse on TRIG starts each measurement
        var s = io.findOn('trig', 'hcsr04', 1);
        var e = io.digitalPeak('echo');
        var txt;
        if (!s) txt = 'No sensor on TRIG';
        else if (!s.st.trig) txt = 'Sensor has no power';
        else if (e === null) txt = 'ECHO unclear (' + io.voltsPeak('echo').toFixed(2) + ' V)';
        else if (e === 0) txt = 'No echo';
        else {
          // time the ECHO pulse: its share of the 60 ms cycle is (average ÷ peak) voltage;
          // 58 µs of pulse = 1 cm (sound goes there and back)
          var frac = io.voltsPeak('echo') > 0 ? io.volts('echo') / io.voltsPeak('echo') : 0;
          if (frac > 0.6) txt = 'ECHO stuck HIGH (no pulse)';
          else { var cm = Math.round(frac * 0.06 / 58e-6); txt = 'Distance: ' + cm + ' cm'; io.mem.dist = cm; }
        }
        if (!/^Distance/.test(txt)) io.mem.dist = null;
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
      name: 'Clap → beep', desc: 'Listens to the microphone (AO) on an analog pin. A loud sound starts a {{kHz|1 kHz}} tone on the speaker pin for half a second.',
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
    // logic thresholds follow the chip's real supply (a USB Nano runs at 4.7 V: HIGH from 0.6 × 4.7 = 2.82 V)
    var k = def.mcu === 'nano' && st.vcc ? st.vcc / cfg.vcc : 1, hiTh = cfg.hiTh * k, loTh = cfg.loTh * k;
    var api = {
      t: ctx.t - (st.t0 || 0), adcMax: cfg.adcMax, mem: st.mem,
      out: function (role, level) { var o = io[pinFor(p, role)]; if (o) { o.level = level ? 1 : 0; delete o.pwm; } },
      pwm: function (role, duty) { var o = io[pinFor(p, role)]; if (!o) return; duty = Math.max(0, Math.min(1, duty)); if (duty <= 0.004) { o.level = 0; delete o.pwm; } else if (duty >= 0.996) { o.level = 1; delete o.pwm; } else { o.pwm = duty; o.level = 1; } },
      tone: function (role, f) { var o = io[pinFor(p, role)]; if (!o) return; if (f > 0) { o.pwm = 0.5; o.level = 1; o.freq = f; } else { o.level = 0; delete o.pwm; delete o.freq; } },
      volts: function (role) { return lv[pinFor(p, role)] || 0; },
      voltsPeak: function (role) { return (st.lastVpeak || {})[pinFor(p, role)] || 0; },
      digitalPeak: function (role) { // for short pulses: the highest voltage during the step
        var v = (st.lastVpeak || {})[pinFor(p, role)] || 0;
        if (v >= hiTh) return 1; if (v <= loTh) return 0; return null;
      },
      pulse: function (role) { var o = io[pinFor(p, role)]; if (o) { o.pwm = 0.0002; o.level = 1; } },
      digital: function (role) {
        if (st.floating && st.floating[pinFor(p, role)]) return Math.random() < 0.5 ? 1 : 0;
        var v = lv[pinFor(p, role)] || 0;
        if (v >= hiTh) return 1;
        if (v <= loTh) return 0;
        return null;
      },
      analog: function (role) {
        var label = pinFor(p, role), pin = def.pins[pinIdx[label]];
        if (!pin || !pin.analog || !cfg.adcMax) return null;
        if (st.floating && st.floating[label]) { st.mem._noise = Math.max(0.1, Math.min(0.9, (st.mem._noise || 0.5) + (Math.random() - 0.5) * 0.12)); return Math.round(st.mem._noise * cfg.adcMax); }
        // the Nano compares with its own supply (AVCC), so the number does not change when 5 V sags
        var ref = def.mcu === 'nano' && st.vcc ? st.vcc : cfg.adcRef;
        var v = Math.max(0, Math.min(ref, lv[label] || 0));
        return Math.round(v / ref * cfg.adcMax);
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
    // run the program only when the last reading was taken with these same pin settings
    // (otherwise an input read before its pull-up was on would give a false value)
    var ioKey = Object.keys(io).map(function (k) { return k + io[k].mode + (io[k].pull || ''); }).join('|');
    var settled = st.lastV && st.ioKey === ioKey;
    st.ioKey = ioKey;
    if (st.powered && !st.dead && !st.inReset && settled) prog.step(api);
    st.io = st.powered ? io : {};
    // Wio Terminal: its own screen shows what the program shows, or the serial output.
  }


  // ---------- "See the code": the real sketch / script for each preset ----------
  // Arduino C++ for the Nano, ESP32 Feather and Wio Terminal; Python (gpiozero) for the Raspberry Pi.
  function ardPin(label) {
    if (/^D\d+$/.test(label)) return label.slice(1);          // Nano D13 → 13
    if (/^A\d$/.test(label)) return label;                    // A0
    var m = /^D(\d)\/A\d$/.exec(label); if (m) return 'D' + m[1]; // Wio D0/A0 → D0
    return label;                                              // ESP32 '13' → 13
  }
  function ardAnalog(label) { var m = /^D\d\/(A\d)$/.exec(label); return m ? m[1] : label; }
  function piPin(label) { return label.replace('GPIO', ''); }
  function code(p, id) {
    var mcu = PARTS[p.type].mcu, P2 = function (role) { return pinFor(p, role); };
    var pi = mcu === 'pi5';
    var L = [];
    if (id === 'none') return pi ? '# No program: the pins do nothing.' : '// No program: the pins do nothing.\nvoid setup() {}\nvoid loop() {}';
    if (pi) {
      var g = function (role) { return piPin(P2(role)); };
      if (id === 'blink') return 'from gpiozero import LED\nfrom time import sleep\n\nled = LED(' + g('led') + ')   # GPIO' + g('led') + '\nwhile True:\n    led.on()\n    sleep(0.5)\n    led.off()\n    sleep(0.5)';
      if (id === 'button_led') return 'from gpiozero import LED, Button\nfrom signal import pause\n\nled = LED(' + g('led') + ')\nbutton = Button(' + g('button') + ')   # pull-up on, button to GND\nbutton.when_pressed = led.on\nbutton.when_released = led.off\npause()';
      if (id === 'motion_alarm') return 'from gpiozero import MotionSensor, Buzzer, LED\nfrom signal import pause\n\npir = MotionSensor(' + g('pir') + ')\nbuzzer = Buzzer(' + g('buzzer') + ')\nled = LED(' + g('led') + ')\npir.when_motion = lambda: (buzzer.on(), led.on())\npir.when_no_motion = lambda: (buzzer.off(), led.off())\npause()';
      if (id === 'tone_button') return 'from gpiozero import TonalBuzzer, Button\nfrom gpiozero.tones import Tone\nfrom signal import pause\n\nspeaker = TonalBuzzer(' + g('speaker') + ')\nbutton = Button(' + g('button') + ')\nbutton.when_pressed = lambda: speaker.play(Tone("A4"))\nbutton.when_released = speaker.stop\npause()';
      if (id === 'distance') return 'from gpiozero import DistanceSensor\nfrom time import sleep\n\n# ECHO gives 5 V: use a 1k / 2.2k divider before GPIO' + g('echo') + '!\nsensor = DistanceSensor(echo=' + g('echo') + ', trigger=' + g('trig') + ')\nwhile True:\n    print("Distance:", round(sensor.distance * 100), "cm")\n    sleep(0.5)';
      if (id === 'thermometer') return 'import adafruit_dht, board\nfrom time import sleep\n\ndht = adafruit_dht.DHT11(board.D' + g('dht') + ')\nwhile True:\n    print("Temp:", dht.temperature, "C  Humidity:", dht.humidity, "%")\n    sleep(2)';
      if (id === 'counter') return 'from gpiozero import LEDBoard\nfrom time import sleep\n\nsegs = LEDBoard(' + ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(function (r) { return g(r); }).join(', ') + ')  # a..g\nDIGITS = ["1111110", "0110000", "1101101", "1111001", "0110011",\n          "1011011", "1011111", "1110000", "1111111", "1111011"]\nwhile True:\n    for d in DIGITS:\n        segs.value = tuple(int(c) for c in d)\n        sleep(1)';
      return '# This program needs an analog pin. The Pi has none.';
    }
    var a = function (role) { return ardPin(P2(role)); }, an = function (role) { return ardAnalog(P2(role)); };
    if (id === 'blink') return 'void setup() {\n  pinMode(' + a('led') + ', OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(' + a('led') + ', HIGH);\n  delay(500);\n  digitalWrite(' + a('led') + ', LOW);\n  delay(500);\n}';
    if (id === 'button_led') return 'void setup() {\n  pinMode(' + a('button') + ', INPUT_PULLUP);  // button to GND\n  pinMode(' + a('led') + ', OUTPUT);\n}\n\nvoid loop() {\n  bool pressed = digitalRead(' + a('button') + ') == LOW;\n  digitalWrite(' + a('led') + ', pressed ? HIGH : LOW);\n}';
    if (id === 'fade_knob') return 'void setup() {\n  pinMode(' + a('fade') + ', OUTPUT);\n}\n\nvoid loop() {\n  int knob = analogRead(' + an('knob') + ');   // 0 to ' + BB.BOARDS[mcu].adcMax + '\n  analogWrite(' + a('fade') + ', map(knob, 0, ' + BB.BOARDS[mcu].adcMax + ', 0, 255));  // PWM\n}';
    if (id === 'light_meter') return '#include <Adafruit_SSD1306.h>\nAdafruit_SSD1306 screen(128, 64, &Wire);\n\nvoid setup() {\n  Serial.begin(9600);\n  screen.begin(SSD1306_SWITCHCAPVCC, 0x3C);\n}\n\nvoid loop() {\n  int light = analogRead(' + an('light') + ');\n  Serial.println(light);\n  screen.clearDisplay();\n  screen.setTextColor(WHITE);\n  screen.setCursor(0, 0);\n  screen.print("Light: ");\n  screen.print(light);\n  screen.display();\n  delay(200);\n}';
    if (id === 'thermometer') return '#include <DHT.h>\nDHT dht(' + a('dht') + ', DHT11);\n\nvoid setup() {\n  Serial.begin(9600);\n  dht.begin();\n}\n\nvoid loop() {\n  Serial.print("Temp: ");\n  Serial.print(dht.readTemperature());\n  Serial.print(" C  Humidity: ");\n  Serial.println(dht.readHumidity());\n  delay(2000);\n}';
    if (id === 'distance') return 'void setup() {\n  Serial.begin(9600);\n  pinMode(' + a('trig') + ', OUTPUT);\n  pinMode(' + a('echo') + ', INPUT);' + (BB.BOARDS[mcu].vcc < 4 ? '  // through a 1k/2.2k divider!' : '') + '\n}\n\nvoid loop() {\n  digitalWrite(' + a('trig') + ', HIGH);   // a 10 µs pulse starts a measurement\n  delayMicroseconds(10);\n  digitalWrite(' + a('trig') + ', LOW);\n  long us = pulseIn(' + a('echo') + ', HIGH);  // how long ECHO stays HIGH\n  Serial.print("Distance: ");\n  Serial.print(us / 58);   // 58 µs = 1 cm\n  Serial.println(" cm");\n  delay(60);\n}';
    if (id === 'motion_alarm') return 'void setup() {\n  pinMode(' + a('pir') + ', INPUT);\n  pinMode(' + a('buzzer') + ', OUTPUT);\n  pinMode(' + a('led') + ', OUTPUT);\n}\n\nvoid loop() {\n  bool motion = digitalRead(' + a('pir') + ') == HIGH;\n  digitalWrite(' + a('buzzer') + ', motion);\n  digitalWrite(' + a('led') + ', motion);\n}';
    if (id === 'clap_beep') return 'void setup() {}\n\nvoid loop() {\n  int sound = analogRead(' + an('mic') + ');\n  if (sound > ' + Math.round(0.8 * BB.BOARDS[mcu].adcMax) + ') {     // a loud sound\n    tone(' + a('speaker') + ', 1000, 500);  // 1 kHz for half a second\n    delay(500);\n  }\n}';
    if (id === 'tone_button') return 'void setup() {\n  pinMode(' + a('button') + ', INPUT_PULLUP);\n}\n\nvoid loop() {\n  if (digitalRead(' + a('button') + ') == LOW) tone(' + a('speaker') + ', 440);  // the note A\n  else noTone(' + a('speaker') + ');\n}';
    if (id === 'counter') return 'int seg[7] = {' + ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(a).join(', ') + '};  // a..g\nbyte digits[10] = {0x7E,0x30,0x6D,0x79,0x33,0x5B,0x5F,0x70,0x7F,0x7B};\n\nvoid setup() {\n  for (int i = 0; i < 7; i++) pinMode(seg[i], OUTPUT);\n}\n\nvoid loop() {\n  for (int n = 0; n < 10; n++) {\n    for (int i = 0; i < 7; i++) digitalWrite(seg[i], (digits[n] >> (6 - i)) & 1);\n    delay(1000);\n  }\n}';
    return '';
  }

  BB.programs = { P: P, ORDER: ORDER, PINS: PINS, run: run, available: available, pinFor: pinFor, code: code };
  if (typeof module !== 'undefined' && module.exports) module.exports = BB.programs;
})();
