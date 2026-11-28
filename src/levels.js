// The 12 guided levels: intro animation, goal steps, checks, hints, explanations, and an
// automatic solution for each (used by the tests). Text is simple English (B1).
(function () {
  'use strict';
  var BB = (globalThis.BB = globalThis.BB || {});
  var fmt = BB.fmt;

  // ---------- glossary (tap a dotted word to see it) ----------
  BB.GLOSSARY = {
    'breadboard': 'A board for building circuits without solder. You push parts into its holes.',
    'strip': 'A metal clip inside the breadboard. It joins 5 holes in a column (a–e or f–j).',
    'rail': 'A long row of holes at the top or bottom of the breadboard, used for power (+) and ground (−).',
    'circuit': 'A closed loop that current can flow around: from + through parts and back to −.',
    'current': 'How much electricity flows, measured in amps (A). 1 mA = 0.001 A. A small LED is happy with 10–15 mA; 20 mA is its limit.',
    'voltage': 'The “push” that makes current flow, measured in volts (V). A 9V battery pushes harder than a 3V one.',
    'resistance': 'How much a part slows the current, measured in ohms (Ω). More ohms = less current.',
    'resistor': 'A part that limits current. Its colour bands show its value in ohms (Ω).',
    'Ohm’s law': 'Current = voltage ÷ resistance (I = V ÷ R). So R = V ÷ I.',
    'LED': 'Light Emitting Diode: a small light that lets current flow only one way.',
    'anode': 'The + leg of an LED: the longer leg.',
    'cathode': 'The − leg of an LED: the shorter leg, on the flat side of the rim.',
    'short circuit': '+ joined to − with (almost) nothing in between. A huge current flows and things get hot.',
    'series': 'One after the other in the same path. The same current goes through each part.',
    'parallel': 'Side by side: both ends joined. Each part gets the same voltage.',
    'mA': 'Milliamp: one thousandth of an amp. 20 mA = 0.02 A. (1 mA = 1000 µA.)',
    'potentiometer': 'A resistor with a knob. The middle leg (the wiper) slides along it.',
    'jumper': 'A small plastic cap with metal inside that joins two pins. On the MB102 it picks 3.3V or 5V.',
    'regulator': 'A chip that keeps a voltage steady, for example at exactly 5V or 3.3V.',
    'multimeter': 'A tool that measures volts (V), current (A) and resistance (Ω).',
    'fuse': 'A thin wire inside that melts when the current is too big, to protect the device.',
    'pin': 'A metal leg of a board or chip. Each pin has a name, like D2 or GND.',
    'GND': 'Ground: the 0 volt side, the same as − of the power supply.',
    'digital': 'Only two values: HIGH (on, near the supply voltage) or LOW (off, near 0 V).',
    'analog': 'Any value in a range. An analog pin turns a voltage into a number, like 0 to 1023.',
    'PWM': 'Switching a pin on and off very fast. The longer it is on, the brighter the LED looks.',
    'I2C': 'A way for chips to talk using just two wires: SDA (data) and SCL (clock).',
    'voltage divider': 'Two resistors in series. The middle point gets a part of the voltage: Vout = Vin × R2 ÷ (R1 + R2).',
    'logic level': 'The voltage a chip works at: 5V (Arduino Nano) or 3.3V (ESP32, Raspberry Pi).',
    'GPIO': 'General Purpose Input/Output: a pin you can use as an input or an output.',
    'microcontroller': 'A small computer on one chip that runs one program and controls its pins.',
    'wiper': 'The middle leg of a potentiometer. Inside, it slides along the resistor when you turn the knob.',
    'pull-up resistor': 'A resistor from a pin to + (VCC). When nothing else drives the pin, it keeps the pin HIGH instead of floating.',
    'serial monitor': 'A text window where a board can print messages, like “Distance: 30 cm”. Here it is in the board’s panel.',
    'common cathode': 'All LED − sides (cathodes) are joined at one pin (COM), which goes to GND.',
    'forward voltage': 'The voltage an LED “uses” when it is on: about 2 V for red, 3 V for blue or white.',
    'multiplier': 'The third colour band of a resistor. It says how many zeros to add: red = × 100, orange = × 1000.',
    'floating': 'A pin with nothing connected. It picks up noise and reads random values.',
    'TRIG': 'Trigger: the HC-SR04 input. A short pulse here starts one measurement.',
    'ECHO': 'The HC-SR04 output. It goes HIGH (5 V) for as long as the sound takes to come back.',
    'VCC': 'The + power pin of a module. Connect it to + (for example 5V or 3.3V). GND is the − pin.',
    'COM': 'Common: the one pin that all the LEDs inside a display share.',
    'I2C backpack': 'A small board soldered on the back of an LCD. It changes 16 wires into just 4 (GND, VCC, SDA, SCL).',
    'kHz': 'Kilohertz: thousands of times per second. A 1 kHz tone vibrates 1000 times per second.',
    'electrolytic': 'A kind of capacitor that stores a lot of charge. It has + and − legs and must not go in backwards.',
    'header pin': 'One metal pin in a row of pins (a “header”). You plug jumper wires onto them.',
    'BCM': 'The chip’s own number for a Raspberry Pi pin, like BCM17 (= GPIO17). It is not the same as the header pin number.',
    'DCV': 'DC volts: the meter setting for steady voltages, like a battery or a rail.',
    'DCA': 'DC amps: the meter setting for current. On this meter it shows mA.',
    'LDR': 'Light Dependent Resistor: a light sensor. Its resistance goes down when more light falls on it.',
    'µF': 'Microfarad: the unit of a capacitor’s size. 1000 µF stores much more charge than 10 µF.',
    'kΩ': 'Kilo-ohm: 1000 ohms. 4.7 kΩ = 4700 Ω. MΩ (mega-ohm) = 1 000 000 Ω.',
    'VIN': 'Voltage in: the Nano pin for a 7–12 V supply (like a 9V battery). The board’s regulator turns it into 5 V.',
    'BAT': 'On the ESP32 Feather: the pin for one LiPo battery cell (3.7–4.2 V).',
    'EN': 'Enable: pull this pin to GND and the ESP32 Feather turns off.',
    'RST': 'Reset: pull this pin to GND and the board restarts its program.',
    'OL': 'Over limit: the value is too big for the range. A DT-830B shows this as a single “1” on the left (other meters show “OL”).',
    'pull-down resistor': 'A resistor from a pin to GND. When nothing else drives the pin, it keeps the pin LOW instead of floating.',
    'hFE': 'A setting on many meters for testing transistors. This game does not use it.',
    'ATmega328P': 'The chip on the Arduino Nano: the small computer that runs your program.',
    'time constant': 'R × C: how fast a capacitor charges. After one time constant it has about 63 % of the voltage. 1 kΩ × 1000 µF = 1 second.',
    'voltage rating': 'The highest voltage a part can take, printed on it (like 16 V on a capacitor).',
    'AO': 'Analog out: a pin whose voltage goes up and down with the signal (here: how loud the sound is).',
    'DO': 'Digital out: a pin that is only HIGH or LOW (here: HIGH when the sound is louder than a set level).',
    'trimmer': 'A small potentiometer that you turn with a screwdriver or a little knob. It does the same job as a big knob.',
    'diode': 'A part that lets current flow only one way. An LED is a diode that also makes light.',
    'protection diode': 'A tiny diode inside a chip, from each pin to + and to GND. It catches small wrong voltages; a big current through it burns the chip.',
    'level shifter': 'A small board that turns 5 V signals into 3.3 V signals (and back), so 5 V and 3.3 V parts can talk safely.',
    'tolerance': 'How exact a resistor is. Gold = ±5 %: a 4.7 kΩ resistor is really between 4.47 and 4.94 kΩ.',
    'LiPo': 'A flat rechargeable lithium battery. One cell gives 3.7 V (4.2 V when full).',
    'µA': 'Microamp: one thousandth of a mA. 703 µA = 0.703 mA.',
    'polarity': 'Which side is + and which is −. Some parts (LED, electrolytic capacitor, buzzer) only work one way round.'
  };

  // ---------- helpers used by the checks ----------
  function lit(p) { return p && !p.st.burnt && (p._i || 0) > 0.002; }
  function safe(p) { return p && !p.st.burnt && (p._i || 0) <= 0.0205; } // 20 mA is the LED limit used everywhere
  function inSeries(a, b) { var ia = Math.abs(a._i || 0), ib = Math.abs(b._i || 0); return ia > 0.0005 && Math.abs(ia - ib) < 0.08 * Math.max(ia, ib); }
  function mcuPinNet(L, mcu, label) { var def = BB.PARTS[mcu.type]; var k = def.pins.findIndex(function (q) { return q.n === label; }); return L.net(mcu, k); }
  function anyGndNet(L, mcu) { var def = BB.PARTS[mcu.type], out = []; def.pins.forEach(function (q, k) { if (q.kind === 'gnd') out.push(L.net(mcu, k)); }); return out; }

  // level 10: is the light-sensor divider (LDR + 10 kΩ) built between 5V, A0 and GND?
  function dividerOk(L) {
          var n = L.part('nano'), ldr = L.of('ldr')[0], r = L.of('resistor')[0];
          if (!ldr || !r) return false;
          var a0 = mcuPinNet(L, n, 'A0'), v5 = mcuPinNet(L, n, '5V'), v33 = mcuPinNet(L, n, '3V3'), gnd = anyGndNet(L, n);
          var ln = [L.net(ldr, 0), L.net(ldr, 1)], rn = [L.net(r, 0), L.net(r, 1)];
          var isG = function (x) { return gnd.indexOf(x) >= 0; };
          // LDR on top (more light → bigger number) or upside down (more light → smaller number): both are real dividers
          var isV = function (arr) { return arr.indexOf(v5) >= 0 || (v33 !== null && arr.indexOf(v33) >= 0); }; // 5V or 3V3 on top: both make a working divider
          var normal = ln.indexOf(a0) >= 0 && isV(ln) && rn.indexOf(a0) >= 0 && (isG(rn[0]) || isG(rn[1]));
          var flipped = ln.indexOf(a0) >= 0 && (isG(ln[0]) || isG(ln[1])) && rn.indexOf(a0) >= 0 && isV(rn);
          L.flags.flipped = flipped && !normal;
          return normal || flipped;
  }

  // Why is this LED dark? A plain explanation, or null.
  function whyDark(L, led) {
    if (!led || lit(led) || led.st.burnt) return null;
    var pts = L.sim.pinPoints(led);
    if (!pts[0].at || !pts[1].at) return 'Put both LED legs into holes.';
    var na = L.net(led, 0), nk = L.net(led, 1);
    if (na === nk) return null; // the samerow issue explains it
    var va = L.pinV(led, 0), vk = L.pinV(led, 1);
    if (vk - va > 1) return null; // reversed issue explains it
    var hm = halfMiss(L); if (hm) return hm; // a wire that stops on the wrong side of the gap: say exactly that
    // a leg alone in a rail: the rail itself is the problem, not the leg
    var sign = function (k) { var m = pts[k].at && /^[TB]([+-])\d+$/.exec(pts[k].at); return m ? m[1] : null; };
    if (sign(1) === '+') return 'The short leg (−) is in a + rail. It must go toward −: move it to the blue − rail.';
    if (sign(0) === '-' && !lit(led)) return 'The long leg (+) is in a − rail. It must go toward +: move it, or flip the LED.';
    var railOf = function (k) { return pts[k].at && /^[TB][+-]\d+$/.test(pts[k].at) ? pts[k].at : null; };
    if (L.alone(led, 1) && railOf(1)) return 'The short leg (−) is in a − rail, but nothing joins that rail to − yet. Join it to the − of your power (the battery’s − rail, or a GND pin on a board).';
    if (L.alone(led, 0) && railOf(0)) return 'The long leg (+) is in a + rail, but that rail has no power yet. Join it to + with a wire (or use the rail the battery is in).';
    var dead = unpoweredPlusRail(L); if (dead) return dead;
    if (L.alone(led, 0)) return 'The long leg (+) is not connected to anything else. Its strip needs a path to + (through a resistor).';
    if (L.alone(led, 1)) return 'The short leg (−) is not connected to anything else. Connect its strip to the − rail.';
    if ((led._i || 0) > 0.0002) return 'The LED is very dim: only ' + fmt.I(led._i) + '. The resistor is too big.';
    return halfMiss(L) || 'No full loop yet. Current must go from + through the resistor and the LED, and back to −.';
  }
  // Board levels: wiring mistakes around a microcontroller that the parts' own checks do not explain.
  // Returns a sentence or null. Checks, in order: a module without GND or power, a module on 3.3 V that needs 5 V,
  // the program's pins left empty while another pin is used, and DO used where the program reads an analog value.
  function boardWiring(L, n) {
    if (!n || !n.st.powered) return null;
    var def = BB.PARTS[n.type], P = BB.programs, prog = P.P[n.props.program || 'none'], gnds = anyGndNet(L, n);
    var short = function (q) { return { oled: 'screen', lcd: 'LCD', mic: 'microphone', hcsr04: 'distance sensor', dht11: 'DHT11', pir: 'motion sensor' }[q.type] || BB.PARTS[q.type].name.replace(/ \(.*\)$/, ''); };
    var dead = deadPlusRail(L); if (dead) return dead;
    var mods = L.sim.state.parts.filter(function (q) { var d = BB.PARTS[q.type]; return q !== n && !d.mcu && d.kind !== 'leads' && d.pins && d.pins.length >= 3; });
    for (var i = 0; i < mods.length; i++) {
      var q = mods[i], pins = BB.PARTS[q.type].pins, names = pins.map(function (x) { return x.n; });
      var g = names.indexOf('GND') >= 0 ? names.indexOf('GND') : names.indexOf('G'), v = names.indexOf('VCC') >= 0 ? names.indexOf('VCC') : names.indexOf('+');
      if (g < 0 || v < 0) continue;
      var started = pins.some(function (x, k) { return !L.alone(q, k); });
      if (!started) continue;
      var p5n = (def.pins.filter(function (x) { return x.kind === 'v5'; })[0] || {}).n || '5V';
      var onSig = function (mk) { var hit = null; def.pins.forEach(function (x, xk) { if (x.kind === 'gpio' && L.net(n, xk) !== null && L.net(n, xk) === L.net(q, mk)) hit = hit || x.n; }); return hit; };
      var vSig = onSig(v), gSig = onSig(g);
      var powIn = null; def.pins.forEach(function (x, xk) { if (['vin', 'bat', 'nc', 'rst', 'en'].indexOf(x.kind) >= 0 && L.net(n, xk) !== null && L.net(n, xk) === L.net(q, v)) powIn = powIn || x; });
      if (powIn) return 'The ' + short(q) + '’s ' + pins[v].n + ' pin is on ' + powIn.n + '. ' + ({ vin: 'VIN is an input for 7–12 V: it does not give out 5 V.', bat: 'BAT is for a battery going in: it does not give out 5 V.', nc: powIn.n + ' is not a power pin.', rst: 'RST is the reset pin, not power.', en: 'EN switches the board on and off: it is not power.' }[powIn.kind]) + ' Move it to the ' + p5n + ' pin.';
      if (vSig) return 'The ' + short(q) + '’s ' + pins[v].n + ' pin is on pin ' + vSig + ', a signal pin. ' + pins[v].n + ' must go to the ' + p5n + ' pin (power).';
      if (gSig) return 'The ' + short(q) + '’s ' + pins[g].n + ' pin is on pin ' + gSig + ', a signal pin. ' + pins[g].n + ' must go to a GND pin.';
      if (L.alone(q, v)) return 'The ' + short(q) + '’s ' + pins[v].n + ' pin has no power. Wire it to the 5V pin (or to a + rail that is joined to 5V).';
      if (gnds.indexOf(L.net(q, g)) < 0) return 'The ' + short(q) + '’s ' + pins[g].n + ' pin is not joined to GND. Wire it to a GND pin (or to a − rail that is joined to GND).';
      var v33 = def.pins.findIndex(function (x) { return x.kind === 'v33'; });
      if (v33 >= 0 && (q.type === 'mic' || q.type === 'hcsr04') && L.net(q, v) === L.net(n, v33)) return 'The ' + short(q) + '’s ' + pins[v].n + ' pin is on 3.3 V. This module needs 5V: move that wire to the 5V pin.';
    }
    if (!prog || !prog.roles) return null;
    var roles = Object.keys(prog.roles), rolePins = roles.map(function (r) { return P.pinFor(n, r); });
    for (var j = 0; j < roles.length; j++) {
      var pn = rolePins[j], k = def.pins.findIndex(function (x) { return x.n === pn; }), role = prog.roles[roles[j]];
      if (k < 0) continue;
      if (role.analog) { // DO (digital out) wired to a board pin, when the program needs an analog value
        var doMod = mods.filter(function (q) { var dk = BB.PARTS[q.type].pins.findIndex(function (x) { return x.n === 'DO'; }); return dk >= 0 && !L.alone(q, dk) && def.pins.some(function (x, xk) { return x.kind === 'gpio' && L.net(n, xk) === L.net(q, dk); }); })[0];
        if (doMod) return 'You used the ' + short(doMod) + '’s DO pin (digital out: only on/off). The program needs AO (analog out, a voltage that follows the sound). Move the wire from DO to AO.';
      }
      if (!L.alone(n, k)) continue;
      var other = def.pins.filter(function (x, ok) { return x.kind === 'gpio' && rolePins.indexOf(x.n) < 0 && !(prog.display && (x.sda || x.scl)) && !L.alone(n, ok); })[0]; // I2C pins belong to the screen
      if (other) return 'Something is wired to pin ' + other.n + ', but this program uses pin ' + pn + ' for: ' + role.label + '. Move that wire to a hole below ' + pn + '.';
    }
    return null;
  }

  // A + rail that a part uses, with no voltage at all (nothing feeds it): e.g. the LDR or a module's + in B+ with no 5V wire
  function deadPlusRail(L) {
    var sim = L.sim, occ = sim.occupancy(), out = null;
    sim.board.holes.some(function (h) {
      if (h.kind !== 'rail' || !/\+/.test(h.row) || !occ[h.id]) return false;
      var oq = sim.part(occ[h.id].id), opin = oq && BB.PARTS[oq.type].pins && BB.PARTS[oq.type].pins[occ[h.id].k];
      if (opin && /^(GND|G|−|-)$/.test(opin.n)) { out = 'The ' + (oq.type === 'led' ? 'LED’s short leg (−)' : oq.type === 'speaker' ? 'speaker’s black wire' : BB.PARTS[oq.type].name.replace(/ \(.*\)$/, '') + '’s ' + opin.n + ' pin') + ' is in a red + rail (' + h.id + '). It must go toward −: use a blue − rail that is joined to GND.'; return true; }
      var net = L.hnet(h.id), mcus = sim.state.parts.filter(function (q) { return BB.PARTS[q.type].mcu; });
      if (mcus.some(function (q) { return anyGndNet(L, q).indexOf(net) >= 0; })) return false; // a red rail used as GND: odd, but it works, so no "why it does not work"
      var v = sim.holeVoltage(h.id);
      var pin5 = mcus.length ? (BB.PARTS[mcus[0].type].pins.filter(function (x) { return x.kind === 'v5'; })[0] || {}).n || '5V' : '5V';
      if (v === null || v < 1) { out = 'The + rail at ' + h.id + ' has no power yet. Add a wire from the ' + pin5 + ' pin' + (pin5 === '5V' ? '' : ' (5 V)') + ' to that rail.'; return true; }
      return false;
    });
    return out;
  }
  // A + rail that is used but has no voltage, while another + rail has power (e.g. the battery feeds only the top rails)
  function unpoweredPlusRail(L) {
    var sim = L.sim, occ = sim.occupancy(), live = null, deadH = null;
    sim.board.holes.forEach(function (h) {
      if (h.kind !== 'rail' || !/\+/.test(h.row)) return;
      var v = sim.holeVoltage(h.id);
      if (v !== null && v > 1) live = live || h;
      else if (occ[h.id] && !deadH) deadH = h;
    });
    if (!live || !deadH) return null;
    var top = deadH.row.charAt(0) === 'T';
    return 'The ' + (top ? 'top' : 'bottom') + ' + rail (' + deadH.id + ') has no power: only the ' + (top ? 'bottom' : 'top') + ' rails get power now. Join the two + rails with a wire (like ' + live.row + live.col + ' → ' + deadH.row + live.col + '), or use the ' + (top ? 'bottom' : 'top') + ' + rail.';
  }
  // A wire end alone in its strip, while a part's leg sits in the same column on the other side of the gap:
  // the Level 1 lesson (rows a–e and f–j are not joined), said for this exact hole.
  function halfMiss(L) {
    var sim = L.sim, occ = sim.occupancy(), msg = null;
    L.of('wire').concat(L.of('resistor'), L.of('ldr'), L.of('speaker')).some(function (w) {
      return sim.pinPoints(w).some(function (q, k) {
        var m = q.at && /^([a-j])(\d+)$/.exec(q.at); if (!m) return false;
        var top = 'abcde'.indexOf(m[1]) >= 0, mine = top ? 'abcde' : 'fghij', other = top ? 'fghij' : 'abcde';
        // nothing else in this wire end's own strip (a wire joins nets, so look at the holes, not the net)
        for (var r0 = 0; r0 < 5; r0++) { var o0 = occ[mine[r0] + m[2]]; if (o0 && !(o0.id === w.id && o0.k === k)) return false; }
        for (var r = 0; r < 5; r++) {
          var h = other[r] + m[2], o = occ[h], op = o && sim.part(o.id);
          if (op && op.type !== 'wire') {
            msg = 'The ' + ({ wire: 'wire end', resistor: 'resistor leg', ldr: 'LDR leg', speaker: 'speaker wire' }[w.type]) + ' in ' + q.at + ' is in the ' + (top ? 'top half (rows a–e)' : 'bottom half (rows f–j)') + ', but the ' + BB.PARTS[op.type].name.replace(/ \(.*\)$/, '').replace(/^([A-Z])(?=[a-z])/, function (c) { return c.toLowerCase(); }) + ' leg in ' + h + ' is in the ' + (top ? 'bottom half' : 'top half') + '. The two halves of a column are not joined. Move the ' + ({ wire: 'wire end', resistor: 'resistor leg', ldr: 'LDR leg', speaker: 'speaker wire' }[w.type]) + ' to a hole in rows ' + (top ? 'f–j' : 'a–e') + ' of column ' + m[2] + '.';
            return true;
          }
        }
        return false;
      });
    });
    return msg;
  }

  // ---------- small animated intro pictures (viewBox 0 0 320 180) ----------
  var I = {};
  function hole(x, y, extra) { return '<rect x="' + (x - 5) + '" y="' + (y - 5) + '" width="10" height="10" rx="2" class="ih" ' + (extra || '') + '/>'; }
  I.inside = function () {
    var s = '<rect x="20" y="20" width="280" height="140" rx="10" class="iboard"/>';
    var cols = [70, 100, 130, 160, 190, 220, 250];
    s += '<rect x="20" y="86" width="280" height="10" class="ichan"/>';
    cols.forEach(function (x, i) {
      var cl = i === 3 ? 'istrip a1' : 'istrip';
      s += '<rect x="' + (x - 7) + '" y="32" width="14" height="50" rx="4" class="' + cl + '"/><rect x="' + (x - 7) + '" y="100" width="14" height="50" rx="4" class="' + (i === 3 ? 'istrip a2' : 'istrip') + '"/>';
      for (var r = 0; r < 5; r++) { s += hole(x, 40 + r * 9, i === 3 ? 'class="ih g1" style="animation-delay:' + (r * 0.12) + 's"' : ''); s += hole(x, 108 + r * 9, i === 3 ? 'class="ih g2" style="animation-delay:' + (r * 0.12) + 's"' : ''); }
    });
    s += '<text x="160" y="175" class="itxt" text-anchor="middle">5 holes = 1 metal strip. The gap splits each column.</text>';
    return s;
  };
  I.rails = function () {
    var s = '<rect x="10" y="40" width="300" height="70" rx="8" class="iboard"/>';
    s += '<line x1="20" y1="58" x2="150" y2="58" stroke="#d8322b" stroke-width="2"/><line x1="170" y1="58" x2="300" y2="58" stroke="#d8322b" stroke-width="2"/>';
    s += '<line x1="20" y1="92" x2="150" y2="92" stroke="#2d5fd0" stroke-width="2"/><line x1="170" y1="92" x2="300" y2="92" stroke="#2d5fd0" stroke-width="2"/>';
    for (var x = 26; x < 300; x += 12) { if (x > 144 && x < 176) continue; s += hole(x, 68, 'class="ih rw" style="animation-delay:' + ((x - 26) / 300).toFixed(2) + 's"'); s += hole(x, 82); }
    s += '<path d="M138 68 Q160 30 182 68" class="iwire draw"/>';
    s += '<text x="160" y="135" class="itxt" text-anchor="middle">Long rails carry power. Some stop in the middle:</text><text x="160" y="152" class="itxt" text-anchor="middle">a wire joins the two halves.</text>';
    return s;
  };
  I.first = function () {
    var loop = 'M60 40 H260 V140 H60 Z';
    var s = '<path d="' + loop + '" class="iloop"/>';
    s += '<rect x="40" y="70" width="40" height="40" rx="4" class="ibat"/><text x="60" y="95" class="itxt w" text-anchor="middle">9V</text>';
    s += '<rect x="135" y="31" width="50" height="18" rx="8" class="ires"/><rect x="146" y="31" width="4" height="18" fill="#f4d21f"/><rect x="154" y="31" width="4" height="18" fill="#7f3fbf"/><rect x="162" y="31" width="4" height="18" fill="#7a4a21"/>';
    s += '<circle cx="260" cy="90" r="22" class="iledglow"/><circle cx="260" cy="90" r="12" class="iled"/>';
    for (var k = 0; k < 6; k++) s += '<circle r="4" class="idot"><animateMotion dur="3s" repeatCount="indefinite" begin="' + (k * 0.5) + 's" path="' + loop + '"/></circle>';
    s += '<text x="160" y="72" class="itxt" text-anchor="middle">resistor limits the current</text>';
    s += '<text x="160" y="168" class="itxt" text-anchor="middle">Current flows in a loop: + → resistor → LED → −</text>';
    return s;
  };
  I.mistakes = function () {
    var s = '';
    [['LED backwards', 0], ['Both legs in one strip', 1], ['Short circuit', 2]].forEach(function (m, i) {
      var x = 10 + i * 103;
      s += '<rect x="' + x + '" y="20" width="96" height="120" rx="8" class="icard"/>';
      if (i === 0) s += '<circle cx="' + (x + 48) + '" cy="70" r="16" class="iled off"/><path d="M' + (x + 22) + ' 70 h12 M' + (x + 62) + ' 70 h12" class="ileg"/><text x="' + (x + 28) + '" y="60" class="itxt">−</text><text x="' + (x + 62) + '" y="60" class="itxt">+</text>';
      if (i === 1) { s += '<rect x="' + (x + 40) + '" y="35" width="16" height="70" rx="5" class="istrip"/>'; s += '<circle cx="' + (x + 48) + '" cy="70" r="14" class="iled off"/><path d="M' + (x + 48) + ' 48 v-6 M' + (x + 48) + ' 92 v6" class="ileg"/>'; }
      if (i === 2) s += '<path d="M' + (x + 20) + ' 45 h56 M' + (x + 20) + ' 95 h56" class="irail"/><path d="M' + (x + 48) + ' 45 Q' + (x + 70) + ' 70 ' + (x + 48) + ' 95" class="iwire hot"/><path d="M' + (x + 58) + ' 62 l6 6 l-8 2 l6 6" class="ispark"/>';
      s += '<path d="M' + (x + 70) + ' 112 l14 14 M' + (x + 84) + ' 112 l-14 14" class="ix"/>';
      s += '<text x="' + (x + 48) + '" y="158" class="itxt s" text-anchor="middle">' + m[0] + '</text>';
    });
    return s;
  };
  I.button = function () {
    var s = '<rect x="60" y="50" width="70" height="70" rx="6" class="ibtnbody"/><circle cx="95" cy="85" r="20" class="ibtncap"/>';
    s += '<path d="M150 85 H190" class="iloop"/><path d="M190 85 L215 70" class="iswitch"/><path d="M215 85 H240" class="iloop"/>';
    s += '<circle cx="265" cy="85" r="20" class="iledglow sync"/><circle cx="265" cy="85" r="11" class="iled sync2"/>';
    s += '<text x="160" y="150" class="itxt" text-anchor="middle">Press: the gap closes and current flows.</text>';
    return s;
  };
  I.dimmer = function () {
    var s = '<circle cx="100" cy="85" r="40" class="iknobring"/><g class="iknob"><circle cx="100" cy="85" r="30" class="iknobb"/><rect x="97" y="58" width="6" height="18" rx="2" fill="#fff"/></g>';
    s += '<circle cx="230" cy="85" r="34" class="iledglow fade"/><circle cx="230" cy="85" r="14" class="iled"/>';
    s += '<text x="160" y="155" class="itxt" text-anchor="middle">Turn the knob: more ohms → less current → dimmer.</text>';
    return s;
  };
  I.mb102 = function () {
    var s = '<rect x="40" y="30" width="90" height="120" rx="6" fill="#1d1f22"/>';
    s += '<circle cx="62" cy="70" r="3" fill="#d4a530"/><circle cx="85" cy="70" r="3" fill="#d4a530"/><circle cx="108" cy="70" r="3" fill="#d4a530"/>';
    s += '<rect x="55" y="63" width="38" height="14" rx="3" class="ijump"/>';
    s += '<text x="62" y="56" class="itxt w s" text-anchor="middle">3.3</text><text x="108" y="56" class="itxt w s" text-anchor="middle">5V</text>';
    s += '<line x1="150" y1="70" x2="300" y2="70" stroke="#d8322b" stroke-width="3"/><line x1="150" y1="90" x2="300" y2="90" stroke="#2d5fd0" stroke-width="3"/>';
    s += '<text x="225" y="60" class="itxt v1" text-anchor="middle">+ rail: 3.3 V</text><text x="225" y="60" class="itxt v2" text-anchor="middle">+ rail: 5 V</text>';
    s += '<text x="160" y="170" class="itxt" text-anchor="middle">The yellow jumper picks the rail voltage.</text>';
    return s;
  };
  I.meter = function () {
    var s = '<text x="80" y="22" class="itxt" text-anchor="middle">Volts: across</text><text x="240" y="22" class="itxt" text-anchor="middle">Current: in the path</text>';
    s += '<rect x="45" y="70" width="70" height="20" rx="9" class="ires"/><path d="M20 80 H45 M115 80 H140" class="iloop"/>';
    s += '<path d="M55 90 Q50 130 70 140 M105 90 Q110 130 90 140" class="iprobe"/><rect x="58" y="132" width="44" height="30" rx="5" class="imeter"/><text x="80" y="152" class="itxt" text-anchor="middle">5.00V</text>';
    var loop = 'M180 50 H300 V140 H180 Z';
    s += '<path d="M180 50 H300 V140 H262 M218 140 H180 Z" class="iloop"/>';
    s += '<rect x="218" y="128" width="44" height="26" rx="5" class="imeter"/><text x="240" y="146" class="itxt" text-anchor="middle">15mA</text>';
    for (var k = 0; k < 5; k++) s += '<circle r="3.5" class="idot"><animateMotion dur="3s" repeatCount="indefinite" begin="' + (k * 0.6) + 's" path="' + loop + '"/></circle>';
    return s;
  };
  I.nano = function () {
    var s = '<rect x="20" y="40" width="280" height="100" rx="8" class="iboard"/><rect x="20" y="86" width="280" height="8" class="ichan"/>';
    s += '<rect x="60" y="56" width="170" height="68" rx="4" fill="#0e5aa7"/><rect x="48" y="78" width="16" height="24" fill="#c9ccd1"/>';
    for (var i = 0; i < 15; i++) { s += '<circle cx="' + (70 + i * 11) + '" cy="62" r="2.6" fill="#d4a530"/><circle cx="' + (70 + i * 11) + '" cy="118" r="2.6" fill="#d4a530"/>'; }
    s += '<text x="180" y="76" class="itxt w s">D13</text><path d="M180 62 Q240 20 270 60" class="iwire"/><circle cx="272" cy="70" r="16" class="iledglow blink"/><circle cx="272" cy="70" r="9" class="iled blink"/>';
    s += '<text x="160" y="165" class="itxt" text-anchor="middle">Across the gap, every pin gets its own strip.</text>';
    return s;
  };
  I.screen = function () {
    var s = '<g class="isun"><circle cx="60" cy="50" r="18" fill="#ffd34a"/></g><g class="icloud"><ellipse cx="62" cy="52" rx="30" ry="16" fill="#9aa3ad"/></g>';
    s += '<circle cx="60" cy="115" r="16" fill="#f1e2c8" stroke="#b9a37c"/><path d="M50 108 h18 v4 h-18 v4 h18 v4 h-18" stroke="#c4512a" fill="none" stroke-width="2"/>';
    s += '<path d="M80 115 H170" class="iloop"/><rect x="170" y="60" width="120" height="90" rx="6" fill="#0f4fa1"/><rect x="180" y="75" width="100" height="62" fill="#050608"/>';
    s += '<text x="190" y="112" class="ioled v1">Light: 870</text><text x="190" y="112" class="ioled v2">Light: 120</text>';
    s += '<text x="160" y="172" class="itxt" text-anchor="middle">Light → voltage on A0 → a number on the screen.</text>';
    return s;
  };
  I.sound = function () {
    var s = '<rect x="40" y="60" width="40" height="80" rx="4" fill="#b8202a"/><circle cx="60" cy="78" r="12" fill="#2b2b2b"/>';
    s += '<path d="M30 60 q-12 18 0 36 M20 52 q-18 26 0 52" class="iwave"/>';
    s += '<path d="M90 100 H200" class="iloop"/><circle cx="240" cy="100" r="34" fill="#2b2b2e"/><circle cx="240" cy="100" r="22" fill="#1b1b1d"/>';
    s += '<path d="M284 80 q12 20 0 40 M294 70 q18 30 0 60" class="iwave late"/>';
    s += '<text x="160" y="168" class="itxt" text-anchor="middle">A clap goes in, a beep comes out.</text>';
    return s;
  };
  I.esp32 = function () {
    var s = '<text x="80" y="20" class="itxt" text-anchor="middle">5V straight in</text><text x="240" y="20" class="itxt" text-anchor="middle">With a divider</text>';
    s += '<rect x="40" y="96" width="80" height="44" rx="6" fill="#17181c"/><text x="80" y="122" class="itxt w s" text-anchor="middle">3.3V pin</text>';
    s += '<path d="M80 34 V96" class="iloop hotline"/><text x="88" y="48" class="itxt">5 V</text><path d="M60 72 l40 -20 M60 52 l40 20" class="ix"/>';
    s += '<text x="200" y="40" class="itxt s">5 V</text><path d="M222 34 V44 M222 66 V80 M222 102 V118" class="iloop"/>';
    s += '<rect x="214" y="44" width="16" height="22" rx="4" class="ires"/><text x="180" y="59" class="itxt s">1 kΩ</text>';
    s += '<rect x="214" y="80" width="16" height="22" rx="4" class="ires"/><text x="172" y="95" class="itxt s">2.2 kΩ</text>';
    s += '<path d="M212 118 h20 M215 122 h14 M218 126 h8" stroke="#8b96a3" stroke-width="2.4"/><text x="180" y="126" class="itxt s">GND</text>';
    s += '<circle cx="222" cy="73" r="3.5" fill="#3ddc84"/><path d="M222 73 H285 V96" class="iloop"/>';
    s += '<rect x="250" y="96" width="70" height="44" rx="6" fill="#17181c"/><text x="285" y="122" class="itxt w s" text-anchor="middle">3.3V pin</text>';
    s += '<text x="240" y="66" class="itxt s good">3.4 V ✓</text>';
    s += '<text x="160" y="170" class="itxt" text-anchor="middle">Two resistors bring 5 V down to a safe 3.4 V.</text>';
    return s;
  };

  // ---------- levels ----------
  var LEVELS = [
    {
      id: 'inside', title: 'Inside the breadboard', icon: 'holes',
      intro: { pic: I.inside, text: 'A {{breadboard}} has metal strips hidden inside. Holes on the same {{strip}} are connected.' },
      board: { cols: 30 }, view: [-0.6, -1.6, 17, 18.6], phone: [-0.6, -1.6, 15, 18.6], tray: [], tools: ['xray'],
      steps: [
        { text: 'Tap any hole in the middle area (rows a–j).', tap: function (L, h) { var o = L.sim.board.byId[h]; if (o.kind === 'term') return { ok: true, msg: 'See the 5 holes that light up? They share one metal strip.' }; return { ok: false, msg: 'That is a power rail. Tap a hole in rows a–j.' }; } },
        { text: 'Tap X-ray (the magnifier in the bottom bar) to see the metal strips inside.', check: function (L) { return L.xray; }, ok: 'Each strip joins 5 holes in a column.' },
        { text: 'Tap a hole that is connected to c8.', tap: function (L, h) {
          if (h === 'c8') return { ok: false, msg: 'That is c8 itself. Tap another hole on the same strip.' };
          if (!/^[a-j]/.test(h)) return { ok: false, count: true, msg: h + ' is in a power rail, not in column 8. Strips go up and down: a8 to e8.' };
          if (['a8', 'b8', 'd8', 'e8'].indexOf(h) >= 0) return { ok: true, msg: 'Yes! ' + h + ' and c8 share the strip of column 8 (a–e).' };
          return { ok: false, count: true, msg: h + ' is not connected to c8. Strips go up and down: a8 to e8.' };
        } },
        { text: 'Are e8 and f8 connected? Tap them to check, then answer.', ready: function (t) { return t.e8 && t.f8; }, readyText: 'First tap e8, then tap f8, and look at which holes light up.', choices: [
          { label: 'Yes', ok: false, why: 'Look again: tap e8, then f8. They light up different groups.' },
          { label: 'No', ok: true, why: 'Right! The gap in the middle splits each column into two strips.' }] }
      ],
      hints: ['Holes in the same column, on the same side of the middle gap, are connected.', 'c8 is in column 8, top half. Its strip is a8, b8, c8, d8, e8.', 'The middle gap has no metal under it.'],
      done: 'Holes a–e of a column are joined, and holes f–j are joined. The middle gap keeps them apart.',
      solve: function (A) { A.tap('c3'); A.xray(true); A.tap('b8'); A.tap('e8'); A.tap('f8'); A.choose(1); }
    },
    {
      id: 'rails', title: 'Power rails', icon: 'rails',
      intro: { pic: I.rails, text: 'The long rows at the top and bottom are power {{rail}}s: red + and blue −. Tap them to find out how far they go.' },
      board: { cols: 63, split: true }, view: [17, -1.6, 46, 18.6], phone: [22, -1.6, 42, 18.6], tray: ['wire'], tools: ['xray', 'wire'],
      steps: [
        { text: 'Tap a hole in the top red + row.', tap: function (L, h) { if (h.slice(0, 2) === 'T+') return { ok: true, msg: 'The whole row lights up… but only to the middle!' }; return { ok: false, msg: 'Tap a hole in the top row, next to the red line.' }; } },
        { text: 'Is the + hole at column 26 connected to the + hole at column 38?', ready: function (t) { return t['T+26'] && t['T+38']; }, readyText: 'Tap the top + hole at column 26, then the one at column 38, and watch the light.', choices: [
          { label: 'Yes', ok: false, why: 'Tap them both. The light stops at the gap in the red line.' },
          { label: 'No', ok: true, why: 'Right. On this board each rail is cut in the middle. Look for the gap in the red and blue lines.' }] },
        { text: 'Tap Wire (bottom bar), then tap a + hole on the left and a + hole on the right of the gap.', check: function (L) { return L.connected('T+26', 'T+38') && !L.connected('T+26', 'T-26'); }, ok: 'The two halves of the + rail are joined now.' },
        { text: 'Now join the two halves of the top blue − rail too.', check: function (L) { return L.connected('T-26', 'T-38') && L.connected('T+26', 'T+38') && !L.connected('T+26', 'T-26'); }, ok: 'Both rails now run along the whole board.' }
      ],
      explain: function (L) { if (L.connected('T+26', 'T-26') || L.connected('T+38', 'T-38') || L.connected('T+26', 'T-38') || L.connected('T+38', 'T-26')) return 'A wire now joins the + rail to the − rail. With power on, that is a {{short circuit}}! Tap that wire and press Delete.'; return null; },
      hints: ['The gap is between column 30 and column 32. Look at the red line.', 'Tap Wire (bottom bar). Tap the + hole at column 30, then the + hole at column 32.', 'Do the same in the blue − row: column 30 to column 32.'],
      done: 'Rails carry power along the board. If a long board splits them, two short wires join the halves.',
      solve: function (A) { A.tap('T+20'); A.tap('T+26'); A.tap('T+38'); A.choose(1); A.wire('T+30', 'T+32'); A.wire('T-30', 'T-32'); }
    },
    {
      id: 'first', title: 'First light', icon: 'led',
      intro: { pic: I.first, text: 'An {{LED}} needs a {{resistor}} to limit the {{current}}. Without one, it burns out.' },
      board: { cols: 30 }, view: [-3, -15.5, 21, 18.6], phone: [0, -15.5, 19, 18.6], tray: [{ type: 'led', props: { color: 'red' } }, { type: 'resistor', props: { r: 470 } }, 'wire'],
      setup: function (A) { A.add('battery9', { x: 4, y: -13.5, ends: ['T+3', 'T-4'], locked: true }); },
      steps: [
        { text: 'Light the LED. Put the resistor in the loop so the LED does not burn.', check: function (L) {
          return L.of('led').some(function (l) { return lit(l) && safe(l) && L.of('resistor').some(function (r) { return inSeries(l, r); }); });
        }, ok: 'It lights! (9 V − 2 V) ÷ 470 Ω ≈ 15 mA: safe for an LED.' }
      ],
      explain: function (L) {
        var l = L.of('led')[0];
        if (l && lit(l) && !L.of('resistor').some(function (r) { return inSeries(l, r); })) return 'The LED is on, but the resistor is not in its path. Put the resistor in the loop.';
        return whyDark(L, l);
      },
      hints: ['Current must make a full loop: + rail → resistor → LED long leg → LED short leg → − rail.', 'Put one resistor leg in the red + rail (top row) and the other leg in a hole like a10.', 'Put the LED long leg (+) in the same column as the resistor (like c10) and the short leg (−) in the blue − rail.'],
      done: 'The resistor limits the current: (9 V − 2 V) ÷ 470 Ω ≈ 15 mA. Without it, the current is hundreds of mA and the LED burns.',
      solve: function (A) { A.add('resistor', { props: { r: 470 }, ends: ['T+10', 'a10'] }); A.add('led', { ends: ['c10', 'T-11'] }); A.wait(0.3); }
    },
    {
      id: 'mistakes', title: 'Fix three mistakes', icon: 'bug',
      intro: { pic: I.mistakes, text: 'This {{circuit}} has three common mistakes. Find them and fix them.' },
      board: { cols: 30 }, view: [-3, -15.5, 31.5, 18.6], phone: [1, -4, 29, 18.6], tray: ['wire'],
      setup: function (A) {
        A.add('battery9', { x: 4, y: -13.5, ends: ['T+3', 'T-4'], locked: true });
        A.add('resistor', { props: { r: 470 }, ends: ['T+8', 'a8'], locked: true });
        A.add('led', { id: 'led-a', props: { color: 'red' }, ends: ['T-9', 'c8'] });
        A.add('resistor', { props: { r: 470 }, ends: ['T+14', 'a14'], locked: true });
        A.add('led', { id: 'led-b', props: { color: 'yellow' }, ends: ['b14', 'd14'] });
        A.add('wire', { id: 'short', props: { color: 'yellow' }, ends: ['T+20', 'T-21'] }).deletable = true; // removing it is the lesson
        A.add('resistor', { props: { r: 470 }, ends: ['T+26', 'a26'], locked: true });
        A.add('led', { id: 'led-c', props: { color: 'blue' }, ends: ['c26', 'T-27'] });
      },
      steps: [
        { text: 'Remove the short circuit.', check: function (L) { return !L.connected('T+20', 'T-20'); }, ok: 'No more short circuit. The battery can push current again.' },
        { text: 'Make all three LEDs light.', check: function (L) { var ls = L.of('led'); return ls.length >= 3 && ls.every(function (l) { return lit(l) && safe(l); }) && !L.connected('T+20', 'T-20'); }, ok: 'All three LEDs are on!' }
      ],
      explain: function (L) {
        if (L.connected('T+20', 'T-20')) return 'The yellow wire joins + to − directly: a {{short circuit}}. All current goes through it, so no LED can light. Tap the wire, then Delete.';
        var dark = L.of('led').filter(function (l) { return !lit(l); });
        return dark.length ? whyDark(L, dark[0]) : null;
      },
      hints: ['First the short circuit: the yellow wire goes from + to −. Tap it and press Delete.', 'The red LED is backwards (long leg toward −). Tap it and press Flip.', 'The yellow LED has both legs in column 14. Drag its short leg to the blue − rail.'],
      done: 'Three mistakes you will meet on your desk: a short circuit, an LED backwards, and both legs in one strip.',
      solve: function (A) { A.del('short'); A.flip('led-a'); A.moveEnd('led-b', 1, 'T-16'); A.wait(0.3); }
    },
    {
      id: 'button', title: 'Push button', icon: 'button',
      intro: { pic: I.button, text: 'A push button closes a gap while you press it. Put it across the middle gap of the board.' },
      board: { cols: 30 }, view: [-3, -15.5, 21, 18.6], phone: [0, -15.5, 19, 18.6], placeFree: ['button'], tray: ['button', 'wire'],
      setup: function (A) {
        A.add('battery9', { x: 4, y: -13.5, ends: ['T+3', 'T-4'], locked: true });
        A.add('resistor', { props: { r: 470 }, ends: ['T+8', 'a8'], locked: true });
        A.add('led', { ends: ['a10', 'T-11'], locked: true });
      },
      steps: [
        { text: 'Put the button across the middle gap so it joins column 8 and column 10.', check: function (L) {
          var b = L.of('button')[0], l = L.of('led')[0];
          if (!b || b.free) return false;
          var nets = [0, 1, 2, 3].map(function (k) { return L.net(b, k); });
          var r = L.of('resistor')[0];
          var rows = L.sim.pinPoints(b).map(function (q) { return (q.at || '').charAt(0); });
          if (rows.some(function (c) { return 'abcdefghij'.indexOf(c) < 0 || !c; })) return false; // a leg in a rail: not across the gap
          return nets.indexOf(L.net(r, 1)) >= 0 && nets.indexOf(L.net(l, 0)) >= 0 && !b.st.pressed && !lit(l);
        }, ok: 'Good. The LED is off: the gap is open.' },
        { text: 'Now press and hold the button (its round cap). The LED should light.', check: function (L) { var b = L.of('button')[0], l = L.of('led')[0]; return b && b.st.pressed && lit(l) && safe(l); }, ok: 'Pressed: the gap closes and the LED lights.' }
      ],
      explainFirst: function (L) { // a button in a rail joins the LED's legs: say why, not just "both legs joined"
        var b = L.of('button')[0], q = b && L.sim.pinPoints(b).filter(function (p) { return p.at && /^[TB][+-]/.test(p.at); })[0];
        return q ? 'Two of the button’s legs are in a rail (' + q.at + '). Inside, those legs are always joined, so the rail now joins the resistor and the LED to −. Put the button across the middle gap: legs in e8, e10, f8 and f10.' : null;
      },
      explain: function (L) {
        var b = L.of('button')[0], l = L.of('led')[0];
        var bRail = b && L.sim.pinPoints(b).filter(function (q) { return q.at && /^[TB][+-]/.test(q.at); })[0];
        if (bRail) return 'Two of the button’s legs are in a rail (' + bRail.at + '). The rail joins them to everything else there. Put the button across the middle gap: legs in e8, e10, f8 and f10.';
        var bw = L.of('wire').filter(function (w) { var wn = [L.net(w, 0), L.net(w, 1)], rn = L.of('resistor')[0] && L.net(L.of('resistor')[0], 1); return l && wn.indexOf(rn) >= 0 && wn.indexOf(L.net(l, 0)) >= 0; })[0];
        if (bw && lit(l) && !(b && b.st.pressed)) return 'A wire joins column 8 and column 10, so the LED is always on. The button must be the only way between them. Tap that wire and press Delete.';
        var bp = b && L.sim.pinPoints(b).map(function (q) { var m = q.at && /^[a-j](\d+)$/.exec(q.at); return m ? +m[1] : null; });
        if (bp && bp.every(function (c) { return c !== null; }) && !(bp.indexOf(8) >= 0 && bp.indexOf(10) >= 0)) return 'The button is in columns ' + Math.min.apply(0, bp) + ' and ' + Math.max.apply(0, bp) + '. It must join column 8 (the resistor) and column 10 (the LED). Drag it so its legs sit in e8, e10, f8 and f10.';
        if (b && !b.st.pressed && lit(l)) return 'The LED is on without a press. The button is turned the wrong way: two of its legs are always joined inside, and they now join the two columns. Tap the button and press Rotate.';
        return null;
      },
      hints: ['The resistor ends in column 8. The LED starts in column 10. The button must join them.', 'Drag the button so its four legs sit in e8, e10, f8 and f10.', 'To press: touch and hold the round black cap.'],
      done: 'A button is a gap that closes when you press. The legs facing each other across the middle gap are always joined inside.',
      solve: function (A) { var b = A.add('button', { x: 8, y: 7 }); A.wait(0.2); A.press(b, true); A.wait(0.2); A.press(b, false); A.wait(0.1); }
    },
    {
      id: 'dimmer', title: 'Dimmer knob', icon: 'knob',
      intro: { pic: I.dimmer, text: 'A {{potentiometer}} is a knob that changes its {{resistance}}. Use it to make an LED brighter or dimmer.' },
      board: { cols: 30 }, view: [-3, -15.5, 31.5, 18.6], phone: [1, -9, 24, 18.6], lock: ['r'], tray: ['pot', 'wire'],
      setup: function (A) {
        A.add('battery9', { x: 4, y: -13.5, ends: ['T+3', 'T-4'], locked: true });
        A.add('resistor', { props: { r: 470 }, ends: ['a14', 'a18'], locked: true });
        A.add('led', { ends: ['b18', 'T-20'], locked: true });
      },
      steps: [
        { text: 'Add the knob so the current goes: + rail → knob → resistor (column 14) → LED.', check: function (L) {
          // in the loop through the middle leg (wiper), at any knob position: even dim counts, turning it is step 2
          var p = L.of('pot')[0], l = L.of('led')[0];
          var skips = p && l && [L.net(p, 0), L.net(p, 1), L.net(p, 2)].indexOf(L.net(l, 0)) >= 0; // the knob goes straight to the LED: the 470 Ω is not in the path
          return p && l && !l.st.burnt && !skips && inSeries(p, l) && !L.alone(p, 1) && (l._i || 0) > 0.0003;
        }, ok: 'The knob is in the loop. The LED is dim or bright depending on where the knob is.' },
        { text: 'Turn the knob all the way one way, then the other. Watch the LED.', check: function (L) {
          var p = L.of('pot')[0], l = L.of('led')[0], f = L.flags;
          if (!p || !l || l.st.burnt) return false;
          // count only the two ends of the knob, while it really is in the LED's path: both ways, as the step says
          if (inSeries(p, l)) {
            // keep the reading taken nearest each end (not the last one on the way out of the end zone)
            if (p.props.pos <= 0.08 && (f.pLo === undefined || p.props.pos <= f.pLo)) { f.pLo = p.props.pos; f.iLo = l._i || 0; }
            if (p.props.pos >= 0.92 && (f.pHi === undefined || p.props.pos >= f.pHi)) { f.pHi = p.props.pos; f.iHi = l._i || 0; }
          }
          return f.iLo !== undefined && f.iHi !== undefined && Math.max(f.iLo, f.iHi) > 0.012 && Math.min(f.iLo, f.iHi) < 0.002;
        }, ok: 'Bright and dim: the knob controls the current.' }
      ],
      explainFirst: function (L) {
        var p = L.of('pot')[0], l = L.of('led')[0], r = L.of('resistor')[0];
        if (p && l && r && l.st.burnt && [L.net(p, 1), L.net(p, 0), L.net(p, 2)].indexOf(L.net(l, 0)) >= 0) return 'The current skipped the 470 Ω: the knob goes straight to the LED’s column. At 0 Ω on the knob nothing limits the current, so the LED burned. Wire the knob’s middle leg to column 14 (the 470 Ω), not to the LED. Then press “New LED”.';
        return null;
      },
      explain: function (L) {
        var p = L.of('pot')[0], l = L.of('led')[0];
        if (!p) return 'The loop is open where the knob should be. Add the knob (Parts), then join + rail → knob → column 14.';
        if (p && l && !l.st.burnt && [L.net(p, 0), L.net(p, 1), L.net(p, 2)].indexOf(L.net(l, 0)) >= 0) return 'The knob goes straight to the LED’s column, so the current skips the 470 Ω. At 0 Ω on the knob nothing would limit the current and the LED would burn. Wire the knob’s middle leg to column 14 (the 470 Ω), not to the LED.';
        if (p && l && inSeries(p, l) && !L.alone(p, 1) && !lit(l) && (l._i || 0) > 0.0003) return 'Good wiring! The LED is dim because the knob is set to a high resistance. Turn the knob to make it brighter.';
        if (p && lit(l) && !inSeries(p, l)) return 'The LED lights, but not through the knob. The current must go through the knob’s middle leg.';
        // the knob is in the loop, but through its two outer legs: always the full 10 kΩ, so the LED is dim and never changes
        if (p && l && inSeries(p, l) && L.alone(p, 1)) return 'You use the two outer legs of the knob. Between them it is always the full ' + fmt.R(p.props.r) + ', so the LED stays dim and turning does nothing. Use one outer leg and the middle leg ({{wiper}}, marked W).';
        return whyDark(L, l);
      },
      hints: ['Path: + rail → knob leg 1 → knob middle leg ({{wiper}}, W) → resistor in column 14 → LED → − rail.', 'Put the knob in the board. Add a wire from the top + rail (the one the battery feeds) to its leg 1.', 'Add a wire from the knob’s middle leg (W) to column 14 (a free hole like c14). Then drag the knob’s white mark.'],
      done: 'The knob changes the resistance, so the current and the brightness change. The fixed 470 Ω keeps the LED safe (about 15 mA) when the knob is at 0 Ω.',
      solve: function (A) { var p = A.add('pot', { x: 8, y: 10 }); A.wire('T+2', 'B+2'); A.wire('B+8', 'j8'); A.wire('j10', 'e14'); /* no wire end under the knob */ A.set(p, 'pos', 0); A.wait(0.3); A.set(p, 'pos', 1); A.wait(0.3); }
    },
    {
      id: 'mb102', title: 'Power supply & Ohm’s law', icon: 'mb102',
      intro: { pic: I.mb102, text: 'The MB102 power board gives 3.3V or 5V to each pair of rails. Pick the right resistor with {{Ohm’s law}}: R = V ÷ I.' },
      board: { cols: 30 }, view: [-9, -2.5, 22, 19.5], phone: [-8, -2.5, 18, 19.5], tray: [{ type: 'led', props: { color: 'red' } }, { type: 'resistor', props: { r: 22 } }, { type: 'resistor', props: { r: 220 } }, { type: 'resistor', props: { r: 10000 } }, 'wire'],
      lock: ['r', 'color'],
      setup: function (A) { A.add('mb102', { id: 'mb', x: 2, y: 0, props: { top: 'off', bottom: 'off', on: false }, locked: true }); },
      steps: [
        { text: 'Set the top rails to 5V and the bottom rails to 3.3V. Tap the yellow {{jumper}}s.', check: function (L) { var m = L.part('mb'); return m.props.top === '5' && m.props.bottom === '3.3'; }, ok: 'Top rails 5V, bottom rails 3.3V.' },
        { text: 'Turn the power on: tap the white button on the MB102.', check: function (L) { var m = L.part('mb'); return m.props.on && m.props.top === '5'; }, ok: 'Power is on. The green light shows it.' },
        { text: 'Light a red LED from the top 5V rail. Pick the resistor that gives about 15 mA.', check: function (L) {
          // the order in the loop does not matter (resistor first or LED first): the loop must use the top + rail
          var top = L.hnet('T+20');
          return L.of('led').some(function (l) {
            if (!((l._i || 0) > 0.008 && safe(l))) return false;
            return L.of('resistor').some(function (r) { return inSeries(l, r) && [L.net(l, 0), L.net(r, 0), L.net(r, 1)].indexOf(top) >= 0; });
          });
        }, ok: '(5 − 2) V ÷ 220 Ω ≈ 14 mA. Just right!' }
      ],
      explainFirst: function (L) { var l = L.of('led')[0]; if (l && l.st.burnt && !L.of('resistor').some(function (r) { var ln = [L.net(l, 0), L.net(l, 1)]; return ln.indexOf(L.net(r, 0)) >= 0 || ln.indexOf(L.net(r, 1)) >= 0; })) return 'There was no resistor in the LED’s loop: about ' + fmt.I(l.st.burntBy || 0.1) + ' went through it (it can take 20 mA). For 15 mA: (5 V − 2 V) ÷ 0.015 A = 200 Ω. Put a 220 Ω in the loop, then tap the LED and press “New LED”.'; return l && l.st.burnt ? 'The resistor was too small: about ' + fmt.I(l.st.burntBy || 0.1) + ' went through the LED (it can take 20 mA). For 15 mA: (5 V − 2 V) ÷ 0.015 A = 200 Ω. Use 220 Ω, then tap the LED and press “New LED”.' : null; },
      explain: function (L) {
        var mbp = L.part('mb');
        if (mbp && mbp.props.top === '3.3' && mbp.props.bottom === '5') return 'The jumpers are swapped: the top rails get 3.3V and the bottom rails 5V. This level wants 5V on top. Tap each yellow jumper to change it.';
        if (mbp && !mbp.props.on && L.of('led').length) return 'The MB102 is switched off, so the rails have no power. Tap its white power button.';
        var l = L.of('led')[0], r = L.of('resistor').find(function (q) { return l && inSeries(l, q); });
        // the 10 kΩ lets so little through that the current test above cannot see it: find it by its nets
        var r10 = l && L.of('resistor').find(function (q) { var ln = [L.net(l, 0), L.net(l, 1)]; return q.props.r === 10000 && (ln.indexOf(L.net(q, 0)) >= 0 || ln.indexOf(L.net(q, 1)) >= 0); });
        if (l && r10 && !lit(l) && (l._i || 0) > 0.00005) return 'The LED only glows a little: (5 V − 2 V) ÷ 10 000 Ω = 0.3 mA. It needs about 15 mA. Use a smaller resistor.';
        if (l && r && r.props.r === 10000) return 'The LED only glows a little: (5 V − 2 V) ÷ 10 000 Ω = 0.3 mA. It needs about 15 mA. Use a smaller resistor.';
        if (l && l.st.burnt && !L.of('resistor').some(function (q) { var ln = [L.net(l, 0), L.net(l, 1)]; return ln.indexOf(L.net(q, 0)) >= 0 || ln.indexOf(L.net(q, 1)) >= 0; })) return 'There was no resistor in the LED’s loop: about ' + fmt.I(l.st.burntBy || 0.1) + ' went through it (it can take 20 mA). Put a 220 Ω in the loop, then tap the LED and press “New LED”.';
        if (l && l.st.burnt) return 'The resistor was too small: about ' + fmt.I(l.st.burntBy || 0.1) + ' went through the LED (it can take 20 mA). For 15 mA: (5 V − 2 V) ÷ 0.015 A = 200 Ω. Use 220 Ω.';
        if (l && lit(l) && r && [L.net(l, 0), L.net(r, 0), L.net(r, 1)].indexOf(L.hnet('T+20')) < 0) return 'The LED is on, but from the bottom rails (3.3V). This step wants the top rails (5V).';
        if (l && lit(l) && !r) return 'The LED is on, but there is no resistor in its loop. Put the resistor in the loop.';
        if (l && lit(l) && (l._i || 0) < 0.008) return 'The LED is on, but only ' + fmt.I(l._i) + '. Aim for about 15 mA: (5 V − 2 V) ÷ 0.015 A ≈ 200 Ω, so one 220 Ω. More resistance means less current.';
        return whyDark(L, l);
      },
      hints: ['Ohm’s law: R = V ÷ I. The resistor gets 5 V − 2 V = 3 V. For 15 mA: 3 ÷ 0.015 = 200 Ω.', 'The closest one is 220 Ω (red, red, brown bands).', 'Resistor from the top + rail to a hole (like a12). LED long leg in that column, short leg in the top − rail.'],
      done: 'R = V ÷ I picks the resistor: (5 − 2) ÷ 0.015 = 200 Ω, so 220 Ω. Each side of the MB102 can be 3.3V or 5V.',
      solve: function (A) { A.set('mb', 'top', '5'); A.set('mb', 'bottom', '3.3'); A.set('mb', 'on', true); A.add('resistor', { props: { r: 220 }, ends: ['T+12', 'a12'] }); A.add('led', { ends: ['c12', 'T-14'] }); A.wait(0.3); }
    },
    {
      id: 'meter', title: 'Multimeter', icon: 'meter',
      intro: { pic: I.meter, text: 'A {{multimeter}} measures volts across a part. To measure current, you put the meter into the loop ({{series}}).' },
      board: { cols: 30 }, view: [-9, -2.5, 49, 25], phone: [-6.5, -2.5, 31, 48.5], tray: [],
      lock: ['r', 'color'],
      setup: function (A) {
        A.add('mb102', { id: 'mb', x: 2, y: 0, props: { top: '5', bottom: '5', on: true }, locked: true });
        A.add('resistor', { props: { r: 220 }, ends: ['T+8', 'a8'], locked: true });
        A.add('led', { ends: ['a12', 'T-14'], locked: true });
        var mys = A.add('resistor', { id: 'mystery', props: { r: 4700 }, ends: ['f22', 'f27'], locked: true });
        mys.hideValue = true; // the player reads the colour bands, then checks with the meter
        // phones (portrait): meter under the board; wide screens: meter beside it
        var narrow = typeof window !== 'undefined' && window.innerWidth < 1100;
        A.add('meter', narrow ? { id: 'm', x: 9, y: 21.5, props: { mode: 'off' }, ends: [{ x: 15, y: 19.6 }, { x: 18, y: 19.6 }] }
          : { id: 'm', x: 33, y: -2, props: { mode: 'off' }, ends: [{ x: 31, y: 21 }, { x: 34, y: 21 }] });
      },
      steps: [
        { sheet: 'Red probe in the + rail, black probe in the − rail, and the dial on DCV (volts).', text: 'Measure the top + rail. Put the red probe in the + rail and the black probe in the − rail. Then tap the meter and set the dial to {{DCV}} (volts).', check: function (L) { var m = L.part('m'), r = m.st.reading || {}; return r.m === 'V' && Math.abs(r.val - 5) < 0.1 && (L.connectedTo(m, 0, 'T+20') || L.connectedTo(m, 0, 'B+20')) && (L.connectedTo(m, 1, 'T-20') || L.connectedTo(m, 1, 'B-20')); }, ok: '5.00 V: the rail voltage.' },
        { text: 'Measure the LED current. There is a gap between column 8 and column 12. Put the probes in the gap first. Then set the dial to {{DCA}} (mA).', check: function (L) { var m = L.part('m'), r = m.st.reading || {}, l = L.of('led')[0]; return r.m === 'A' && r.val > 0.005 && inSeries(m, l); }, ok: 'About 14 mA flows through the meter and the LED.' },
        { text: 'Read the loose resistor (columns 22–27): zoom in and pick the colour of each band. The 3rd band is the {{multiplier}} (how many zeros).', bands: { want: ['yellow', 'violet', 'red'], ok: 'Yellow 4, violet 7, red × 100: 4700 Ω = 4.7 kΩ. Now check it with the meter.', tip: 'the 1st and 2nd bands are digits, the 3rd says how many zeros. The gold band ({{tolerance}}) is at the other end.' } },
        { text: 'Check it: put the probes in the resistor’s columns in the bottom half (like g22 and g27), then set the dial to Ω.', check: function (L) { var m = L.part('m'), r = m.st.reading || {}; return r.m === 'ohm' && Math.abs(r.val - 4700) < 250; }, ok: 'The meter reads 4.70 kΩ, the same as the bands.' }
      ],
      explain: function (L) {
        var m = L.part('m'), r = (m && m.st.reading) || {};
        if (r.m === 'A' && L.connectedTo(m, 0, 'T+20') && L.connectedTo(m, 1, 'T-20')) return 'Never put the meter in mA mode across the rails: it is like a wire there.';
        if (r.m === 'V' && (L.connectedTo(m, 0, 'T-20') && L.connectedTo(m, 1, 'T+20'))) return 'The reading is negative: the probes are swapped. Red goes to +.';
        if ((r.m === 'A' || r.m === 'V' || r.m === 'ohm') && m && L.net(m, 0) !== null && L.net(m, 0) === L.net(m, 1)) return 'Both probes are in the same strip, so the meter sees no difference. Put them in two different columns' + (L.stepIndex === 1 ? ': column 8 and column 12 (the gap).' : '.');
        if (L.stepIndex === 3 && r.m === 'ohm' && m) { var tips8 = L.sim.pinPoints(m).map(function (q) { return q.at || ''; }); if (tips8.some(function (a) { return /^[a-e](22|27)$/.test(a); })) return 'The resistor is in row f, in the bottom half. Rows a–e of the same column are not joined to it. Put the probes in g22 and g27.'; }
        if (L.stepIndex === 1 && r.m === 'A' && typeof r.val === 'number' && Math.abs(r.val) < 0.0005) return 'The meter shows 0 mA: no current goes through it. In mA mode the meter must be IN the path: red probe in column 8, black probe in column 12.';
        var ledA = L.of('led')[0];
        if (L.stepIndex === 1 && r.m === 'A' && typeof r.val === 'number' && r.val > 0.001 && ledA && !lit(ledA)) return 'In mA mode the meter is like a wire. Here it gives the current a way around the LED, so the LED goes dark. Put the meter IN the gap instead: red probe in column 8, black probe in column 12.';
        if (r.m === 'A' && typeof r.val === 'number' && r.val < -0.0005) return 'The reading is negative: the current goes into the black probe. Swap the probes: red on the side that comes from + (column 8), black on the LED side (column 12).';
        var led8 = L.of('led')[0];
        if (r.m === 'A' && led8 && !lit(led8) && [L.net(led8, 0), L.net(led8, 1)].indexOf(L.net(m, 0)) >= 0 && [L.net(led8, 0), L.net(led8, 1)].indexOf(L.net(m, 1)) >= 0) return 'In mA mode the meter is like a wire. Across the LED it takes all the current, so the LED goes out. Put the meter IN the path instead: in the gap between column 8 and column 12.';
        if (L.stepIndex === 1 && r.m === 'V' && (L.connectedTo(m, 0, 'a8') && L.connectedTo(m, 1, 'a12'))) return 'Good place! Now turn the dial to DCA (mA) to measure the current.';
        return null;
      },
      hints: ['Volts: the probes go on two points (across). Current: the meter must be IN the path, so all the current goes through it.', 'For current: red probe in column 8 (like c8), black probe in column 12 (like c12). Then set the dial to DCA (mA).', 'For ohms: probes in g22 and g27, then set the dial to Ω. Move the probes first, then turn the dial.'],
      done: 'Volts: measure across. Current: break the loop and put the meter in the gap. Ohms: only on a part with no power.',
      solve: function (A) {
        A.set('m', 'mode', 'V'); A.moveEnd('m', 0, 'T+20'); A.moveEnd('m', 1, 'T-20'); A.wait(0.2);
        A.moveEnd('m', 0, 'c8'); A.moveEnd('m', 1, 'c12'); A.set('m', 'mode', 'A'); A.wait(0.2);
        A.bands(['yellow', 'violet', 'red']);
        A.moveEnd('m', 0, 'h22'); A.moveEnd('m', 1, 'h27'); A.set('m', 'mode', 'ohm'); A.wait(0.2);
      }
    },
    {
      id: 'nano', title: 'Arduino Nano: blink', icon: 'nano',
      intro: { pic: I.nano, text: 'The Arduino Nano is a {{microcontroller}} board. Put it across the middle gap, then let a {{pin}} blink an LED.' },
      board: { cols: 30 }, view: [-0.8, -1.6, 31.5, 18.6], phone: [-2.2, -1.6, 33.2, 26], placeFree: ['nano'], tray: ['nano', { type: 'resistor', props: { r: 220 } }, { type: 'led', props: { color: 'red' } }, 'wire'],
      lock: ['r', 'color'],
      steps: [
        { text: 'Put the Arduino Nano across the middle gap.', check: function (L) { var n = L.of('nano')[0]; return n && !n.free; }, ok: 'Each Nano pin now has its own strip of free holes.' },
        { text: 'Tap the Nano and choose the program “Blink”.', check: function (L) { var n = L.of('nano')[0]; return n && n.props.program === 'blink'; }, ok: 'Blink switches pin D13 on and off. Look: the small “L” LED on the Nano blinks too.' },
        { text: 'Connect pin D13 → resistor → LED → GND. Make your LED blink.', check: function (L) {
          var n = L.of('nano')[0], f = L.flags; if (!n) return false;
          var d2 = n.st.io && n.st.io.D13;
          L.of('led').forEach(function (l) {
            var pinI = (n.st.pinI || {}).D13 || 0;
            if (d2 && d2.level === 1 && lit(l) && safe(l) && Math.abs(pinI - l._i) < 0.1 * l._i) f.on = true;
            if (d2 && d2.level === 0 && f.on && !lit(l)) f.off = true;
          });
          return f.on && f.off;
        }, ok: 'It blinks! The pin gives about 4.4 V, and 220 Ω keeps the current near 11 mA.' }
      ],
      explain: function (L) {
        var l = L.of('led')[0], n = L.of('nano')[0];
        var d13 = n ? BB.PARTS.nano.pins.findIndex(function (x) { return x.n === 'D13'; }) : -1;
        if (n && l && lit(l) && n.props.program === 'blink' && L.alone(n, d13)) return 'Your LED is on all the time: it gets its power from a pin that is always on (like 5V), not from D13. Blink switches D13: move the resistor to a hole below D13.';
        if (!n || n.props.program !== 'blink' || !l || lit(l) || (n.st.io && n.st.io.D13 && n.st.io.D13.level === 0)) return null;
        // the LED's − side goes somewhere, but not back to the Nano's GND: say that, not "not connected"
        // the resistor (or the LED) sits on another pin: Blink only switches D13
        var nDef = BB.PARTS[n.type], wrongPin = null;
        L.of('resistor').concat([l]).forEach(function (q) {
          [0, 1].forEach(function (k) { var qn = L.net(q, k); if (qn === null) return; nDef.pins.forEach(function (pin, pk) { if (pin.kind === 'gpio' && pin.n !== 'D13' && L.net(n, pk) === qn) wrongPin = wrongPin || pin.n; }); });
        });
        if (wrongPin) return 'Your circuit is on pin ' + wrongPin + ', but Blink switches pin D13. Move it to a hole below D13 (the first pin of the bottom row).';
        var nk = L.net(l, 1);
        if (nk !== null && (!L.alone(l, 1) || /^[TB]-/.test(L.sim.pinPoints(l)[1].at || '')) && anyGndNet(L, n).indexOf(nk) < 0) return 'The LED’s short leg (−) is in a strip or rail that is not joined to the Nano’s GND. Current must flow back to the Nano. Add a wire from a GND pin to that rail.';
        return whyDark(L, l);
      },
      hints: ['D13 is the first pin of the bottom row, next to the USB plug. The free holes below it, in the same column, are joined to it.', 'Put the resistor from a hole below D13 to a free column on the left (like column 3). Put the LED long leg in that column.', 'Connect GND: a wire from a hole below the bottom GND pin to the blue − rail. Put the LED short leg in that rail.'],
      done: 'A HIGH pin gives about 4.4 V. The LED takes about 2 V, so the 220 Ω resistor gets about 2.4 V: about 11 mA. That is safe, because a pin can give 20 mA.',
      solve: function (A) { var n = A.add('nano', { x: 8, y: 5 }); A.set(n, 'program', 'blink'); A.add('resistor', { props: { r: 220 }, ends: ['h8', 'h3'] }); A.add('led', { props: { color: 'red' }, ends: ['i3', 'B-4'] }); A.wire('h21', 'B-20'); A.wait(1.3); }
    },
    {
      id: 'screen', title: 'Light meter on a screen', icon: 'oled',
      intro: { pic: I.screen, text: 'A light sensor changes its resistance with light. The Nano turns this into a number and shows it on a small screen.' },
      board: { cols: 30 }, view: [-0.8, -1.6, 31.5, 32], phone: [-0.8, -1.6, 31.5, 32], tray: [{ type: 'ldr' }, { type: 'resistor', props: { r: 10000 } }, 'wire'],
      lock: ['r', 'program'],
      setup: function (A) {
        A.add('nano', { id: 'nano', x: 8, y: 5, props: { program: 'light_meter' }, locked: true });
        A.add('oled', { id: 'oled', x: 9, y: 20, locked: true });
      },
      steps: [
        { text: 'Connect the screen with 4 wires ({{I2C}}): GND → GND, {{VCC}} → 5V, SDA → A4, SCL → A5.', check: function (L) { var o = L.part('oled'); return !!o.st.mcu && (o.st.vcc || 0) > 4.5; }, ok: 'The screen is on. I2C uses just SDA (data) and SCL (clock).' },
        { text: 'Build a {{voltage divider}}: {{LDR}} from 5V to A0, and 10 kΩ from A0 to GND. A0 is an {{analog}} pin.', check: function (L) { return dividerOk(L);
        }, ok: 'Now A0 gets a voltage that follows the light.' },
        { text: 'Tap the light sensor and move its Light slider from bright to dark. Watch the number.', check: function (L) {
          var n = L.part('nano'), v = (n.st.lastV || {}).A0 || 0, a = Math.round(v / (n.st.vcc || 5) * 1023), f = L.flags;
          if (!L.part('oled').st.mcu || !dividerOk(L)) return false; // the divider must still be there
          // either way round: the number must swing from big to small (or small to big) as the light changes
          if (a > 600) f.hi = true; if (a < 300) f.lo = true;
          return f.hi && f.lo;
        }, ok: 'The number follows the light. Your light meter works! (With the LDR on top, more light gives a bigger number.)' }
      ],
      explain: function (L) {
        var n = L.part('nano'), v = (n.st.lastV || {}).A0 || 0;
        var ldr = L.of('ldr')[0], r = L.of('resistor')[0];
        var o = L.part('oled');
        if (L.stepIndex === 0 && o.st.mcu && (o.st.vcc || 0) > 2.8 && (o.st.vcc || 0) < 4) return 'The screen is on 3.3 V. Real OLED screens like this also work on 3.3 V, but this step uses 5V: move the VCC wire to the 5V pin.';
        if (L.stepIndex >= 1 && ldr && r && !dividerOk(L)) {
          var gn = anyGndNet(L, n), a0 = mcuPinNet(L, n, 'A0'), rn = [L.net(r, 0), L.net(r, 1)];
          if (rn.indexOf(a0) >= 0 && gn.indexOf(rn[0]) < 0 && gn.indexOf(rn[1]) < 0) return 'The 10 kΩ starts at A0, but its other end does not reach GND. Put it in a GND strip, or in a − rail that is joined to a GND pin.';
        }
        if (L.stepIndex >= 1 && ldr && r && !dividerOk(L)) {
          var shared = [L.net(ldr, 0), L.net(ldr, 1)].filter(function (x) { return x !== null && (x === L.net(r, 0) || x === L.net(r, 1)); })[0];
          if (shared !== undefined && shared !== mcuPinNet(L, n, 'A0') && L.alone(n, BB.PARTS.nano.pins.findIndex(function (x) { return x.n === 'A0'; }))) return 'Your divider is built, but its middle is not joined to A0. Add a wire from the middle column (between the LDR and the 10 kΩ) to a hole below A0.';
        }
        if (L.stepIndex >= 1 && ldr && !r && [L.net(ldr, 0), L.net(ldr, 1)].indexOf(mcuPinNet(L, n, 'A0')) >= 0 && anyGndNet(L, n).some(function (g) { return [L.net(ldr, 0), L.net(ldr, 1)].indexOf(g) >= 0; })) return 'A0 reads 0 all the time: the LDR goes from A0 to GND, but nothing feeds A0 from 5V. Put the LDR between 5V and A0, and the 10 kΩ from A0 to GND.';
        var hm10 = L.stepIndex >= 1 ? halfMiss(L) : null; if (hm10) return hm10;
        if (L.stepIndex >= 1 && ldr) { var lnn = [L.net(ldr, 0), L.net(ldr, 1)], g10 = anyGndNet(L, n), p5 = mcuPinNet(L, n, '5V'); if (lnn.indexOf(p5) >= 0 && (g10.indexOf(lnn[0]) >= 0 || g10.indexOf(lnn[1]) >= 0)) return 'The LDR goes straight from 5V to GND, so A0 is not between the two parts. A divider needs the middle: LDR from 5V to A0, and the 10 kΩ from A0 to GND.'; }
        var dp10 = L.stepIndex >= 1 ? deadPlusRail(L) : null; if (dp10) return dp10;
        if (L.stepIndex >= 1 && ldr && (!r || L.alone(r, 0) || L.alone(r, 1)) && v > (n.st.vcc || 5) - 0.2) return 'A0 reads 1023 all the time: with only the LDR, A0 is pulled all the way up to the supply. Add the 10 kΩ resistor from A0 to GND. Two resistors make a voltage divider.';
        var bwx = boardWiring(L, n); if (bwx) return bwx;
        return null;
      },
      hints: ['5V, GND, A0, A4 and A5 are on the Nano’s bottom row. The free holes under them (rows h–j) are joined to them.', 'Use wires from those holes to the screen’s pins: GND, VCC, SCL, SDA.', 'Divider: put the LDR between the 5V column and the A0 column (use a wire or the rails), and 10 kΩ between A0 and GND.'],
      done: 'More light → lower LDR resistance → more voltage on A0. The Nano turns 0–5 V into 0–1023, and I2C sends it to the screen with two wires.',
      solve: function (A) {
        A.wire('P:oled:0', 'j21'); A.wire('P:oled:1', 'j19'); A.wire('P:oled:2', 'j16'); A.wire('P:oled:3', 'j15');
        A.wire('h19', 'B+20'); A.wire('h21', 'B-21');
        var l = A.add('ldr', { ends: ['B+26', 'j26'] }); A.add('resistor', { props: { r: 10000 }, ends: ['f26', 'f30'] }); A.wire('j30', 'B-30'); A.wire('h11', 'h26'); // the resistor beside the LDR, not on top of it
        A.set(l, 'light', 0.9); A.wait(0.3); A.set(l, 'light', 0.05); A.wait(0.3);
      }
    },
    {
      id: 'sound', title: 'Clap → beep', icon: 'sound',
      intro: { pic: I.sound, text: 'A microphone module hears a clap. The Nano answers with a tone on a speaker. The speaker needs a resistor.' },
      board: { cols: 30 }, view: [-0.8, -9, 44, 18.6], phone: [-0.8, -6, 31.5, 26], tray: ['mic', 'speaker', { type: 'resistor', props: { r: 220 } }, 'wire'],
      lock: ['r', 'program'],
      setup: function (A) { A.add('nano', { id: 'nano', x: 1, y: 5, props: { program: 'clap_beep' }, locked: true }); },
      steps: [
        { text: 'Put the microphone on the board. Connect + to 5V and G to GND. Connect the module’s {{AO}} pin (“Analog Out”, letter O) to the Nano’s A0 pin (“A-zero”).', check: function (L) {
          var m = L.of('mic')[0], n = L.part('nano'); if (!m) return false;
          return (m.st.vcc || 0) > 4.5 && L.net(m, 0) === mcuPinNet(L, n, 'A0');
        }, ok: 'The microphone is on. AO follows the sound.' },
        { text: 'Connect the speaker in a line: pin D8, then the 220 Ω resistor, then the speaker, then GND.', check: function (L) {
          var s = L.of('speaker')[0], n = L.part('nano'); if (!s) return false;
          var d8 = mcuPinNet(L, n, 'D8'), gnd = anyGndNet(L, n);
          var sn = [L.net(s, 0), L.net(s, 1)];
          if (gnd.indexOf(sn[0]) < 0 && gnd.indexOf(sn[1]) < 0) return false;
          if (sn.indexOf(d8) >= 0) return false; // the speaker sits right on D8: the resistor is not in its path
          return L.of('resistor').some(function (r) { var rn = [L.net(r, 0), L.net(r, 1)]; return rn.indexOf(d8) >= 0 && (rn.indexOf(sn[0]) >= 0 || rn.indexOf(sn[1]) >= 0); });
        }, ok: 'Good: the resistor keeps the pin current safe.' },
        { text: 'Tap the microphone and press 👏 Clap. The speaker should beep.', check: function (L) {
          var s = L.of('speaker')[0], n = L.part('nano'); if (!s || !n.st.io) return false;
          var d8 = n.st.io.D8, pi = (n.st.pinI || {}).D8 || 0;
          if (d8 && d8.freq && Math.abs(s._i || 0) > 0.003 && pi < 0.04 && !(n.st.damaged && n.st.damaged.D8)) L.flags.beep = true;
          return !!L.flags.beep;
        }, ok: 'Beep! Sound in, sound out.' }
      ],
      explainFirst: function (L) { // the speaker right on D8: this says why D8 got hurt better than the pin warning
        var n = L.part('nano'), spk = L.of('speaker')[0], d8n = mcuPinNet(L, n, 'D8');
        if (!spk || d8n === null || [L.net(spk, 0), L.net(spk, 1)].indexOf(d8n) < 0) return null;
        return L.of('resistor').some(function (r) { return [L.net(r, 0), L.net(r, 1)].indexOf(d8n) >= 0; })
          ? 'The resistor is beside the speaker, not in its path: the speaker’s red wire is joined to D8 directly, so the pin gives far too much current. Put the resistor between D8 and the red wire. If D8 is damaged, tap the Nano and press “New board”.'
          : 'There is no resistor between D8 and the speaker. The speaker is only 8 Ω, so the pin gives far too much current. Put the 220 Ω between D8 and the red wire. If D8 is damaged, tap the Nano and press “New board”.';
      },
      explain: function (L) {
        var s = L.of('speaker')[0], n = L.part('nano');
        var m = L.of('mic')[0], spk = L.of('speaker')[0], d8n = mcuPinNet(L, n, 'D8');
        if (spk && d8n !== null && [L.net(spk, 0), L.net(spk, 1)].indexOf(d8n) >= 0) {
          var beside = L.of('resistor').some(function (r) { return [L.net(r, 0), L.net(r, 1)].indexOf(d8n) >= 0; });
          return beside ? 'The resistor is beside the speaker, not in its path: the speaker’s red wire is joined to D8 directly. Put the resistor between D8 and the red wire (D8 → resistor → speaker → GND).'
            : 'There is no resistor between D8 and the speaker. The speaker is only 8 Ω: alone it would pull far too much current from the pin. Put the 220 Ω between D8 and the red wire.';
        }
        var hm11 = halfMiss(L); if (hm11) return hm11;
        if (spk && L.stepIndex >= 1 && L.of('resistor').length && [L.net(spk, 0), L.net(spk, 1)].every(function (x) { return x !== null && anyGndNet(L, n).indexOf(x) < 0; }) && !L.alone(spk, 1)) return 'The speaker’s black wire does not reach GND. Put it in a − rail that is joined to a GND pin (or in a GND strip).';
        if (m && (m.st.vcc || 0) > 4.5 && L.net(m, 0) !== null && L.net(m, 0) !== mcuPinNet(L, n, 'A0')) {
          var on = null; BB.PARTS[n.type].pins.forEach(function (pin, pk) { if (pin.analog && pin.n !== 'A0' && L.net(n, pk) === L.net(m, 0)) on = on || pin.n; });
          if (on) return 'AO goes to ' + on + ', but the program listens on A0. Move the wire to a hole below A0.';
        }
        if (n.st.damaged && n.st.damaged.D8) return 'Pin D8 is damaged: the speaker is only 8 Ω, so without a resistor the pin gives about 150 mA. A pin gives 20 mA safely (40 mA at most). Tap the Nano and press “New board”, then add the 220 Ω resistor.';
        var bwx = boardWiring(L, n); if (bwx) return bwx;
        return null;
      },
      hints: ['Microphone pins: AO, G, +, DO. Run wires from their columns to the Nano’s A0, GND and 5V.', 'Speaker: 1. Put the resistor between a column joined to D8 and a free column. 2. Put the speaker’s red wire in that free column. 3. Put its black wire in the − rail, joined to GND.', 'Then tap the microphone and press 👏 Clap (or move its Sound slider up).'],
      done: 'The mic gives a voltage that follows the sound, and a loud sound starts a tone. The resistor keeps the pin current near 19 mA, just under the safe 20 mA.',
      solve: function (A) {
        var m = A.add('mic', { x: 24, y: 3 });
        A.wire('j12', 'B+12'); A.wire('a12', 'T-12'); A.wire('B+20', 'b26'); A.wire('b25', 'T-26'); A.wire('b24', 'i4');
        var sp = A.add('speaker', { x: 33, y: -4, ends: ['c22', 'T-23'] });
        A.wire('a5', 'a18'); A.add('resistor', { props: { r: 220 }, ends: ['b18', 'b22'] });
        A.action(m, 'clap'); A.wait(0.4);
      }
    },
    {
      id: 'esp32', title: 'ESP32: the 5V danger', icon: 'esp32',
      intro: { pic: I.esp32, text: 'The ESP32 works at 3.3V (its {{logic level}}). Its pins must never get 5V. Two resistors bring a 5V signal down to a safe level.' },
      board: { cols: 30 }, view: [-3.5, -10, 35, 18.6], phone: [-3.5, -5, 35.5, 19], placeFree: ['hcsr04'], tray: ['hcsr04', { type: 'resistor', props: { r: 1000 } }, { type: 'resistor', props: { r: 2200 } }, 'wire'],
      lock: ['r', 'program'],
      setup: function (A) { A.add('esp32', { id: 'esp', x: 6, y: 4, props: { program: 'distance' }, locked: true }); },
      steps: [
        { text: 'Plug the distance sensor into row a, in the free columns on the right (22–30). Then power it: VCC to the USB pin (5V), GND to GND.', check: function (L) { var s = L.of('hcsr04')[0]; return s && (s.st.vcc || 0) > 4.5; }, ok: 'The sensor has 5V from the USB pin.' },
        { text: 'Connect {{TRIG}} to pin 21.', check: function (L) { var s = L.of('hcsr04')[0]; return s && s.st.trig; }, ok: 'The ESP32 now sends trigger pulses.' },
        { text: 'Build a {{voltage divider}} for {{ECHO}}: ECHO → 1 kΩ → a free middle column → 2.2 kΩ → GND (the − rail joined to GND).', check: function (L) {
          var s = L.of('hcsr04')[0], e = L.part('esp'); if (!s) return false;
          var echo = L.net(s, 2), gnds = anyGndNet(L, e);
          return L.of('resistor').some(function (r1) {
            var a = L.net(r1, 0), b = L.net(r1, 1); if (r1.props.r !== 1000 || (a !== echo && b !== echo)) return false;
            var mid = a === echo ? b : a;
            return mid !== null && L.of('resistor').some(function (r2) { var c = L.net(r2, 0), d = L.net(r2, 1); return r2.props.r === 2200 && ((c === mid && gnds.indexOf(d) >= 0) || (d === mid && gnds.indexOf(c) >= 0)); });
          });
        }, ok: 'The middle column now gets 5 × 2.2 ÷ 3.2 ≈ 3.4 V on paper. The sensor’s own output resistance makes it about 3.3 V while ECHO is HIGH.' },
        { text: 'Connect the middle column to pin 33 with a wire.', check: function (L) {
          var e = L.part('esp'), v = (e.st.lastVpeak || {})['33'] || 0, s = L.of('hcsr04')[0];
          if (!s || !(v > 2.5 && v < 3.6) || (e.st.damaged && e.st.damaged['33'])) return false;
          var echo = L.net(s, 2), p33 = mcuPinNet(L, e, '33'), gnds = anyGndNet(L, e);
          var top = L.of('resistor').some(function (r) { var a = L.net(r, 0), b = L.net(r, 1); return r.props.r === 1000 && ((a === echo && b === p33) || (b === echo && a === p33)); });
          var bot = L.of('resistor').some(function (r) { var a = L.net(r, 0), b = L.net(r, 1); return r.props.r === 2200 && ((a === p33 && gnds.indexOf(b) >= 0) || (b === p33 && gnds.indexOf(a) >= 0)); });
          return top && bot && (e.st.serial || []).some(function (x) { return /^Distance/.test(x); });
        }, ok: 'Pin 33 gets about 3.3 V: under the 3.6 V maximum, and still HIGH. The distance shows in the {{serial monitor}}.' }
      ],
      explainFirst: true, // its divider texts are more exact than the generic pin warning
      explain: function (L) {
        var e = L.part('esp'), v = (e.st.lastVpeak || {})['33'] || 0;
        var hc = L.of('hcsr04')[0];
        var r22e = L.of('resistor').filter(function (q) { return q.props.r === 2200; })[0];
        if (hc && r22e && L.net(hc, 2) !== null && [L.net(r22e, 0), L.net(r22e, 1)].indexOf(L.net(hc, 2)) >= 0) return 'The 2.2 kΩ is on ECHO. Swap the two resistors: the 1 kΩ goes on ECHO (top), and the 2.2 kΩ goes from the middle to GND (bottom).';
        if (hc && L.of('resistor').length >= 2 && L.net(hc, 2) !== null && L.net(hc, 2) === mcuPinNet(L, e, '33')) return 'Pin 33 is on ECHO, above the divider, so it still gets the full 5 V pulses. Move the pin-33 wire to the middle column, between the 1 kΩ and the 2.2 kΩ.';
        if (hc && L.net(hc, 1) !== null && L.net(hc, 1) === mcuPinNet(L, e, '33')) return 'TRIG is on pin 33, but the program sends the pulse on pin 21. Move the TRIG wire to a hole below pin 21. Pin 33 is for ECHO (through the divider).';
        if (hc && L.net(hc, 2) !== null && L.net(hc, 2) === mcuPinNet(L, e, '21')) return 'Pin 21 is on ECHO. The program sends the pulse on pin 21, so it must go to TRIG (the pin next to ECHO). ECHO goes to the divider, then to pin 33.';
        if (e.st.damaged && e.st.damaged['33']) return 'Pin 33 got 5 V and is damaged. On a real ESP32 this can break the chip. Tap the ESP32 and press “New board”, then use the divider.';
        // the 2.2 kΩ goes to a − rail that is not joined to GND: the divider has no bottom
        var r22 = L.of('resistor').filter(function (q) { return q.props.r === 2200; })[0];
        if (r22 && anyGndNet(L, e).indexOf(L.net(r22, 0)) < 0 && anyGndNet(L, e).indexOf(L.net(r22, 1)) < 0 && [L.net(r22, 0), L.net(r22, 1)].some(function (x) { return x === L.hnet('T-2') || x === L.hnet('B-2'); }))
          return 'The 2.2 kΩ goes to a − rail, but that rail is not joined to GND. Add a wire from the ESP32’s GND pin to that rail.';
        if (v > 3.6) { return 'Danger! Pin 33 gets ' + v.toFixed(2) + ' V. The ESP32 takes 3.3 V (3.6 V at most). Use the two resistors as a divider.'; }
        if (v > 0.3 && v <= 2.47) return 'Pin 33 gets only ' + v.toFixed(2) + ' V. That is too low to read as HIGH (needs 2.5 V). Check the divider: 1 kΩ on top (from ECHO), 2.2 kΩ at the bottom (to GND).';
        var bwx = boardWiring(L, e); if (bwx) return bwx;
        return null;
      },
      hints: ['USB is on the bottom row of pins. It gives 5V while the USB cable is plugged in. GND is on the top row.', 'Divider: ECHO column → 1 kΩ → a free middle column → 2.2 kΩ → − rail (joined to GND). Middle gets 5 × 2.2 ÷ 3.2 ≈ 3.4 V on paper (about 3.3 V in practice).', 'Then a wire from the middle column to a hole below pin 33 (bottom row).'],
      done: '5 V on a 3.3 V pin can break the chip. A 1 kΩ + 2.2 kΩ divider turns 5 V into about 3.3 V. That is under the ESP32’s 3.6 V maximum, and still reads HIGH.',
      solve: function (A) {
        A.add('hcsr04', { x: 24, y: 3 });
        A.wire('j12', 'b24'); A.wire('a9', 'T-9'); A.wire('T-27', 'b27'); A.wire('a21', 'b25'); A.wait(0.2);
        A.add('resistor', { props: { r: 1000 }, ends: ['c26', 'c29'] }); A.add('resistor', { props: { r: 2200 }, ends: ['d29', 'T-30'] }); A.wait(0.2); A.wire('e29', 'i16'); A.wait(0.4);
      }
    }
  ];
  LEVELS.forEach(function (l, i) { l.n = i + 1; });

  BB.LEVELS = LEVELS;
  BB.levelHelpers = { lit: lit, safe: safe, inSeries: inSeries, whyDark: whyDark };
})();
