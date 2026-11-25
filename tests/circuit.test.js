// Circuit tests: real parts on a real breadboard (holes, strips, rails), checked against hand values.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
require('../src/engine.js'); require('../src/board.js'); require('../src/parts.js');
require('../src/circuit.js'); require('../src/programs.js');
const BB = globalThis.BB;

function near(a, e, what, tol = 0.02) {
  const err = Math.abs(a - e) / Math.abs(e);
  assert.ok(err <= tol, `${what}: got ${a}, expected ${e} (error ${(err * 100).toFixed(2)} %)`);
}
function bench(parts, board = { cols: 30 }) {
  const sim = new BB.Sim({ board, parts: parts.map(([t, i]) => BB.newPart(t, i)) });
  return sim;
}
function run(sim, secs = 0.2, dt = 1 / 60) { for (let t = 0; t < secs; t += dt) sim.step(dt); return sim.res; }
const byType = (sim, t) => sim.state.parts.filter(p => p.type === t);

test('Breadboard: a1–e1 are one strip, f1 is not; rails run along; split rails stop in the middle', () => {
  const b = BB.board.makeBoard({ cols: 30 });
  assert.equal(b.byId.a1.strip, b.byId.e1.strip);
  assert.notEqual(b.byId.e1.strip, b.byId.f1.strip);
  assert.equal(b.byId['T+2'].strip, b.byId['T+30'].strip);
  assert.notEqual(b.byId['T+2'].strip, b.byId['T-2'].strip);
  assert.equal(b.holes.length, 30 * 10 + 4 * 25, '400 holes');
  const full = BB.board.makeBoard({ cols: 63, split: true });
  assert.equal(full.holes.length, 63 * 10 + 4 * 50, '830 holes');
  assert.notEqual(full.byId['T+2'].strip, full.byId['T+60'].strip, 'split rail');
  assert.equal(BB.board.makeBoard({ cols: 63 }).byId['T+2'].strip, BB.board.makeBoard({ cols: 63 }).byId['T+60'].strip);
});

test('9V battery → 470 Ω → red LED through rails and strips: 15.0 mA (2 Ω battery: (9−1.94)/472)', () => {
  const sim = bench([
    ['battery9', { x: -24, y: 0, ends: ['T+3', 'T-3'] }],
    ['resistor', { props: { r: 470 }, ends: ['T+5', 'a5'] }],
    ['led', { ends: ['c5', 'T-8'] }]
  ]);
  run(sim);
  const led = byType(sim, 'led')[0];
  near(led._i, 0.01497, 'LED current');
  assert.ok(!led.st.burnt);
  assert.equal(sim.res.issues.length, 0, JSON.stringify(sim.res.issues));
  near(sim.holeVoltage('e5'), 9 - 0.01497 * 472, 'voltage at column 5');
});

test('LED with no resistor on 9V burns out and becomes an open circuit', () => {
  const sim = bench([['battery9', { ends: ['T+3', 'T-3'] }], ['led', { ends: ['T+5', 'T-6'] }]]);
  run(sim, 0.1);
  const led = byType(sim, 'led')[0];
  assert.ok(led.st.burnt, 'burnt');
  run(sim, 0.1);
  assert.ok(Math.abs(led._i) < 1e-6);
  assert.ok(sim.res.issues.some(i => i.kind === 'burnt'));
});

test('LED legs in the same strip: no current through it, and a warning', () => {
  const sim = bench([['battery9', { ends: ['T+3', 'T-3'] }], ['resistor', { props: { r: 470 }, ends: ['T+5', 'a5'] }], ['led', { ends: ['b5', 'd5'] }], ['wire', { ends: ['e5', 'T-8'] }]]);
  run(sim);
  const led = byType(sim, 'led')[0];
  assert.ok(Math.abs(led._i) < 1e-6);
  assert.ok(sim.res.issues.some(i => i.kind === 'samerow'));
});

test('Backwards LED: dark, and the “in backwards” warning', () => {
  const sim = bench([['battery9', { ends: ['T+3', 'T-3'] }], ['resistor', { props: { r: 470 }, ends: ['T+5', 'a5'] }], ['led', { ends: ['T-7', 'c5'] }]]);
  run(sim);
  assert.ok(Math.abs(byType(sim, 'led')[0]._i) < 1e-6);
  assert.ok(sim.res.issues.some(i => i.kind === 'reversed'));
});

test('Short circuit: wire from + rail to − rail: 9/2.02 = 4.46 A and a short-circuit warning', () => {
  const sim = bench([['battery9', { ends: ['T+3', 'T-3'] }], ['wire', { ends: ['T+10', 'T-10'] }]]);
  run(sim, 0.05);
  near(byType(sim, 'battery9')[0]._i, 9 / 2.02, 'short current');
  assert.ok(sim.res.issues.some(i => i.kind === 'short'));
});

test('Push button across the gap: LED on only when pressed', () => {
  const sim = bench([
    ['battery9', { ends: ['T+3', 'T-3'] }],
    ['resistor', { props: { r: 470 }, ends: ['T+5', 'a5'] }],
    ['button', { x: 5, y: 7 }],             // pins e5, e7, f5, f7
    ['led', { ends: ['a7', 'T-9'] }]
  ]);
  const btn = byType(sim, 'button')[0], led = byType(sim, 'led')[0];
  assert.deepEqual(sim.pinPoints(btn).map(p => p.at), ['e5', 'e7', 'f5', 'f7']);
  run(sim);
  assert.ok(Math.abs(led._i) < 1e-6, 'off when not pressed');
  btn.st.pressed = true; sim.dirty();
  run(sim);
  near(led._i, 0.01497, 'on when pressed');
});

test('Potentiometer as a dimmer with 330 Ω: knob end → (9−1.95)/(330+2+0.5) ≈ 21 mA; other end: Vf≈1.63 V at 0.7 mA, (9−1.63)/10332.5 = 0.713 mA', () => {
  const parts = [
    ['battery9', { ends: ['T+3', 'T-3'] }],
    ['pot', { x: 10, y: 3, props: { pos: 0 } }],   // pins a10 a12 a14
    ['wire', { ends: ['T+10', 'b10'] }],
    ['resistor', { props: { r: 330 }, ends: ['b12', 'b18'] }],
    ['led', { ends: ['c18', 'T-20'] }]
  ];
  const sim = bench(parts);
  run(sim);
  const led = byType(sim, 'led')[0], pot = byType(sim, 'pot')[0];
  near(led._i, 0.0212, 'bright end');
  pot.props.pos = 1; sim.dirty(); run(sim);
  near(led._i, 0.000713, 'dim end');
});

test('MB102: 5V top rail, 3.3V bottom rail; blue LED + 100 Ω on 5V = 20 mA', () => {
  const sim = bench([
    ['mb102', { x: 2, y: 0, props: { top: '5', bottom: '3.3' } }],
    ['resistor', { props: { r: 100 }, ends: ['T+10', 'a10'] }],
    ['led', { props: { color: 'blue' }, ends: ['b10', 'T-12'] }]
  ]);
  run(sim);
  near(sim.holeVoltage('T+20'), 5, 'top rail', 0.01);
  near(sim.holeVoltage('B+20'), 3.3, 'bottom rail', 0.01);
  near(byType(sim, 'led')[0]._i, 0.02, 'blue LED', 0.02);
});

test('Multimeter: V reads the rail, mA in series reads the LED current, Ω reads a loose resistor', () => {
  const sim = bench([
    ['mb102', { x: 2, y: 0 }],
    ['meter', { x: 0, y: 24, props: { mode: 'V' }, ends: ['T+20', 'T-20'] }],
    ['resistor', { props: { r: 220 }, ends: ['T+8', 'a8'] }],
    ['led', { ends: ['b12', 'T-14'] }],
    ['meter', { x: 30, y: 24, props: { mode: 'A' }, ends: ['c8', 'c12'] }],
    ['resistor', { props: { r: 4700 }, ends: ['f22', 'f27'] }],
    ['meter', { x: 60, y: 24, props: { mode: 'ohm' }, ends: ['j22', 'j27'] }]
  ]);
  run(sim);
  const [mv, ma, mo] = byType(sim, 'meter');
  near(mv.st.reading.val, 5, 'volts', 0.01);
  // 5 V through 220 Ω + 1 Ω meter + red LED (hand: bisection gives 13.94 mA)
  near(ma.st.reading.val, 0.01393, 'milliamps');
  near(mo.st.reading.val, 4700, 'ohms', 0.01);
});

test('Meter in mA mode across the rails: the fuse blows', () => {
  const sim = bench([['mb102', { x: 2, y: 0 }], ['meter', { props: { mode: 'A' }, ends: ['T+20', 'T-20'] }]]);
  run(sim, 0.05);
  assert.ok(byType(sim, 'meter')[0].st.fuse);
});

test('Arduino Nano on USB (4.7 V after its diode) runs Blink on D13: LED blinks at 11.49 mA (hand: (4.7 − Vf)/245 Ω, Vf ≈ 1.89 V)', () => {
  const sim = bench([
    ['nano', { x: 8, y: 5, props: { program: 'blink' } }],      // top row c8..c22, bottom row g8..g22
    ['resistor', { props: { r: 220 }, ends: ['h8', 'h3'] }],   // D13 is bottom row index 0 → column 8
    ['led', { ends: ['i3', 'B-4'] }],
    ['wire', { ends: ['h21', 'B-20'] }]                         // GND is bottom row index 13 → column 21
  ]);
  const nano = byType(sim, 'nano')[0], led = byType(sim, 'led')[0];
  const pts = sim.pinPoints(nano);
  assert.equal(pts[15].at, 'g8'); assert.equal(BB.PARTS.nano.pins[15].n, 'D13');
  let maxI = 0, minI = 1;
  for (let k = 0; k < 90; k++) { sim.step(1 / 60); maxI = Math.max(maxI, led._i); minI = Math.min(minI, led._i); }
  near(maxI, 0.011485, 'LED on');
  assert.ok(minI < 1e-6, 'LED off part of the time');
});

test('ESP32: 5V from HC-SR04 ECHO straight into pin 33 is flagged; a 1k/2.2k divider gives 5 × 2.2/(0.01+1+2.2) = 3.43 V (ECHO has 10 Ω inside) and reads HIGH', () => {
  function make(divider) {
    const parts = [
      ['esp32', { x: 6, y: 4, props: { program: 'distance' } }],   // long row b6..b21, short row h10..h21
      ['hcsr04', { x: 24, y: 3 }],                                // a24 VCC, a25 TRIG, a26 ECHO, a27 GND
      ['wire', { ends: ['j12', 'b24'] }],                          // USB (5V) → VCC  (short row idx 2 → col 12)
      ['wire', { ends: ['a9', 'T-9'] }],                           // GND (long idx 3 → col 9) → − rail
      ['wire', { ends: ['T-27', 'b27'] }],                         // sensor GND
      ['wire', { ends: ['a21', 'b25'] }]                           // pin 21 → TRIG
    ];
    if (divider) parts.push(['resistor', { props: { r: 1000 }, ends: ['c26', 'f26'] }], ['resistor', { props: { r: 2200 }, ends: ['g26', 'T-28'] }], ['wire', { ends: ['i16', 'h26'] }]);
    else parts.push(['wire', { ends: ['c26', 'i16'] }]);         // pin 33 (short idx 6 → col 16)
    return bench(parts);
  }
  const bad = make(false); run(bad, 0.3);
  assert.ok(bad.res.issues.some(i => i.kind === 'overvolt' || i.kind === 'damaged'), 'over-voltage flagged (or the pin already died)');
  const good = make(true); run(good, 0.3);
  const esp = byType(good, 'esp32')[0];
  near(esp.st.lastVpeak['33'], 5 * 2.2 / 3.21, 'pin 33 voltage while ECHO is HIGH');
  near(esp.st.lastV['33'], 5 * 2.2 / 3.21 * (30 * 58e-6 / 0.06), 'average: ECHO is HIGH 58 µs/cm × 30 cm every 60 ms (2.9 %)', 0.05);
  assert.ok(!good.res.issues.some(i => i.kind === 'overvolt'));
  assert.ok(esp.st.serial.some(s => s.startsWith('Distance: 30')), esp.st.serial.join('|'));
});

test('Two supplies without a common GND: LED stays dark and a "No common GND" warning shows; joining GNDs fixes it', () => {
  const sim = bench([
    ['mb102', { x: 2, y: 0 }],
    ['nano', { x: 8, y: 5, props: { program: 'blink' } }],
    ['resistor', { props: { r: 220 }, ends: ['h8', 'h3'] }],
    ['led', { ends: ['i3', 'B-4'] }]                            // LED − goes to the MB102 − rail, not to the Nano
  ]);
  const led = byType(sim, 'led')[0];
  let maxI = 0;
  for (let k = 0; k < 60; k++) { sim.step(1 / 60); maxI = Math.max(maxI, led._i); }
  assert.ok(maxI < 1e-6, 'no loop back to the Nano');
  assert.ok(sim.res.issues.some(i => i.kind === 'noground'));
  sim.state.parts.push(BB.newPart('wire', { ends: ['h21', 'B-20'] })); sim.dirty();
  for (let k = 0; k < 60; k++) { sim.step(1 / 60); maxI = Math.max(maxI, led._i); }
  near(maxI, 0.011485, 'LED on with common GND');
  assert.ok(!sim.res.issues.some(i => i.kind === 'noground'));
});

test('PWM on two boards at once: knob ≈80 % and ≈20 % give ≈ 0.82 × 11.5 mA and ≈ 0.18 × 11.5 mA (USB Nano: 4.7 V)', () => {
  const sim = bench([
    ['nano', { x: 1, y: 5, props: { program: 'fade_knob' } }],
    ['nano', { x: 16, y: 5, props: { program: 'fade_knob' } }]
  ], { cols: 63 });
  const [n1, n2] = byType(sim, 'nano');
  // instead of real knobs, hold A0 with dividers: 5 V × 0.8 and 5 V × 0.2
  const add = (t, i) => sim.state.parts.push(BB.newPart(t, i));
  // Nano 1 at x=1: A0 = g4, 5V = g12, GND = g14, D9 (PWM) = c4 (top idx 3)
  add('resistor', { props: { r: 1000 }, ends: ['h4', 'h12'] });            // 5V → A0 : 1 kΩ (top)
  add('resistor', { props: { r: 4700 }, ends: ['i4', 'i14'] });            // A0 → GND : 4.7 kΩ  → 5 × 4.7/5.7 = 0.82
  add('resistor', { props: { r: 220 }, ends: ['a4', 'a24'] }); add('led', { ends: ['b24', 'b25'] }); add('wire', { ends: ['a25', 'a12'] }); // D9 → 220 → LED → GND(top, x=12)
  // Nano 2 at x=16: A0 = g19, 5V = g27, GND = g29, D9 = c19, top GND = c27
  add('resistor', { props: { r: 4700 }, ends: ['h19', 'h27'] });          // 5V → A0 : 4.7 kΩ (top)
  add('resistor', { props: { r: 1000 }, ends: ['i19', 'i29'] });          // A0 → GND : 1 kΩ → 5 × 1/5.7 = 0.18
  add('resistor', { props: { r: 220 }, ends: ['a19', 'a40'] }); add('led', { ends: ['b40', 'b41'] }); add('wire', { ends: ['a41', 'a27'] });
  for (let k = 0; k < 30; k++) sim.step(1 / 60);
  const [l1, l2] = byType(sim, 'led');
  const full = 0.011485;
  const d1 = Math.round(5 * 4.7 / 5.7 / 5 * 1023) / 1023, d2 = Math.round(5 * 1 / 5.7 / 5 * 1023) / 1023;
  near(l1._i, full * d1, 'LED 1 average current');
  near(l2._i, full * d2, 'LED 2 average current');
});

test('MB102 short: the regulator limits at its 0.7 A rating, the rail falls near 0 V (0.7 A × 0.05 Ω of wire and links)', () => {
  const sim = bench([['mb102', { x: 2, y: 0 }], ['wire', { ends: ['T+10', 'T-10'] }]]);
  for (let k = 0; k < 10; k++) sim.step(1 / 60);
  const mb = byType(sim, 'mb102')[0];
  near(mb._i, 0.7, 'limited current');
  assert.ok(sim.holeVoltage('T+20') < 0.05);
  for (let k = 0; k < 60; k++) sim.step(1 / 60);
  assert.ok(sim.res.issues.some(i => i.kind === 'short'), 'the short message stays on');
});

test('Multimeter Ω range: 1 MΩ reads 1.00 MΩ; two in series (2.2 MΩ) read OL (the DT-830B tops out at 2 MΩ)', () => {
  const sim = bench([['resistor', { props: { r: 1000000 }, ends: ['a5', 'a8'] }], ['meter', { props: { mode: 'ohm' }, ends: ['b5', 'b8'] }]]);
  for (let k = 0; k < 3; k++) sim.step(1 / 60);
  const m = byType(sim, 'meter')[0];
  near(m.st.reading.val, 1e6, '1 MΩ');
  assert.equal(m.st.reading.text + ' ' + m.st.reading.unit, '1.00 MΩ');
  sim.state.parts.push(BB.newPart('resistor', { props: { r: 1000000 }, ends: ['c8', 'c11'] }));
  m.ends[1] = { at: 'b11' }; sim.state.parts.push(BB.newPart('resistor', { props: { r: 220000 }, ends: ['d11', 'd14'] })); m.ends[1] = { at: 'b14' };
  sim.dirty(); for (let k = 0; k < 3; k++) sim.step(1 / 60);
  assert.equal(m.st.reading.text, 'OL');
});

test('OLED on 9 V: no crash, an over-voltage warning, blank screen', () => {
  const sim = bench([['battery9', { ends: ['T+3', 'T-3'] }], ['oled', { x: 10, y: 20 }]]);
  const o = byType(sim, 'oled')[0];
  sim.state.parts.push(BB.newPart('wire', { ends: ['P:' + o.id + ':1', 'T+10'] }), BB.newPart('wire', { ends: ['P:' + o.id + ':0', 'T-10'] }));
  sim.dirty();
  for (let k = 0; k < 10; k++) sim.step(1 / 60);
  assert.ok(sim.res.issues.some(i => i.kind === 'overvolt'));
  assert.ok(!o.vis.lines);
});

test('5 V into the ESP32 3V pin (USB off) destroys the board; 3.3 V there powers it', () => {
  const make = (v) => {
    const sim = bench([['mb102', { x: 2, y: 0, props: { top: v, bottom: v } }], ['esp32', { x: 6, y: 4, props: { usb: false } }],
      ['wire', { ends: ['a7', 'T+8'] }], ['wire', { ends: ['a9', 'T-9'] }]]);   // 3V pin is long-row index 1 → column 7; GND index 3 → column 9
    for (let k = 0; k < 60; k++) sim.step(1 / 60);
    return [sim, byType(sim, 'esp32')[0]];
  };
  const [s5, e5] = make('5');
  assert.ok(e5.st.dead, 'dead at 5 V'); assert.ok(s5.res.issues.some(i => i.kind === 'dead'));
  const [, e3] = make('3.3');
  assert.ok(e3.st.powered && !e3.st.dead, 'runs at 3.3 V');
});

test('Nano: 9 V into the 5V pin kills it; 9 V into VIN gives 5.00 V on the 5V pin (its regulator)', () => {
  const sim = bench([['battery9', { ends: ['T+3', 'T-3'] }], ['nano', { x: 8, y: 5, props: { usb: false } }],
    ['wire', { ends: ['h22', 'T+22'] }], ['wire', { ends: ['h21', 'T-21'] }]]);  // VIN = bottom index 14 → column 22; GND index 13 → column 21
  for (let k = 0; k < 30; k++) sim.step(1 / 60);
  const n = byType(sim, 'nano')[0];
  assert.ok(n.st.powered && !n.st.dead);
  near(n.st.lastV['5V'], 5.0, '5V pin from the regulator', 0.01);
  const sim2 = bench([['battery9', { ends: ['T+3', 'T-3'] }], ['nano', { x: 8, y: 5, props: { usb: false } }],
    ['wire', { ends: ['h19', 'T+20'] }], ['wire', { ends: ['h21', 'T-21'] }]]); // 5V pin = bottom index 11 → column 19
  for (let k = 0; k < 60; k++) sim2.step(1 / 60);
  assert.ok(byType(sim2, 'nano')[0].st.dead, '9 V on the 5V pin kills it');
});

test('Input with an open button and no pull-up is floating; with the button pressed to GND it is not', () => {
  const sim = bench([['nano', { x: 8, y: 5, props: { program: 'motion_alarm' } }], ['button', { x: 24, y: 7 }],
    ['wire', { ends: ['a15', 'a24'] }], ['wire', { ends: ['j26', 'h21'] }]]); // PIR input D7 = top index 5 → column 13? (D7 is index 5 → x 13)
  sim.state.parts[2].ends = [{ at: 'a13' }, { at: 'a24' }]; sim.dirty();
  for (let k = 0; k < 10; k++) sim.step(1 / 60);
  assert.ok(sim.res.issues.some(i => i.kind === 'floating'), 'floating while open');
  byType(sim, 'button')[0].st.pressed = true; sim.dirty();
  for (let k = 0; k < 10; k++) sim.step(1 / 60);
  assert.ok(!sim.res.issues.some(i => i.kind === 'floating'), 'not floating when pressed to GND');
});

test('Meter diode mode on a red LED: about 1 mA test current, reads 1627 mV (hand: Vf = 1.8 + 0.0517·ln(0.62/20) + 0.006)', () => {
  const sim = bench([['led', { ends: ['a5', 'a6'] }], ['meter', { props: { mode: 'diode' }, ends: ['b5', 'b6'] }]]);
  for (let k = 0; k < 3; k++) sim.step(1 / 60);
  near(byType(sim, 'meter')[0].st.reading.val, 1.627, 'LED forward voltage');
  byType(sim, 'meter')[0].ends.reverse(); sim.dirty(); sim.step(1 / 60);
  assert.equal(byType(sim, 'meter')[0].st.reading.text, 'OL', 'backwards: OL');
});

test('USB current limit: Nano 5V pin into 5.5 Ω is held at 0.5 A (not 5/5.7 = 0.88 A), then the USB port trips', () => {
  const sim = bench([['nano', { x: 8, y: 5 }], ['resistor', { props: { r: 22 }, ends: ['h19', 'h23'] }], ['resistor', { props: { r: 22 }, ends: ['i19', 'i23'] }],
    ['resistor', { props: { r: 22 }, ends: ['j19', 'j23'] }], ['resistor', { props: { r: 22 }, ends: ['f23', 'f27'] }], ['wire', { ends: ['g23', 'g21'] }], ['wire', { ends: ['h27', 'h21'] }]]);
  // 5V pin (column 19) → four 22 Ω in parallel (5.5 Ω) → GND (column 21)
  sim.state.parts[4].ends = [{ at: 'f19' }, { at: 'f23' }];
  sim.state.parts = sim.state.parts.filter((p, i) => i !== 6); sim.dirty();
  for (let k = 0; k < 10; k++) sim.step(1 / 60);
  const n = byType(sim, 'nano')[0];
  near(n.st.usbI, 0.5, 'limited current');
  for (let k = 0; k < 150; k++) sim.step(1 / 60);
  assert.ok(n.st.usbTripped || sim.res.issues.some(i => i.kind === 'short'), 'USB port trips');
});

test('Nano 3V3 pin straight into a red LED: held at the 50 mA limit (not 117 mA)', () => {
  const sim = bench([['nano', { x: 8, y: 5 }], ['led', { ends: ['h9', 'h12'] }]]); // 3V3 = bottom index 1 (column 9); LED − to column 12, joined to GND below
  sim.state.parts.push(BB.newPart('wire', { ends: ['i12', 'i21'] })); sim.dirty();
  for (let k = 0; k < 10; k++) sim.step(1 / 60);
  near(byType(sim, 'led')[0]._i, 0.05, 'LED current', 0.02);
});

test('A USB port cannot take current back: 9 V on the 5V pin of a USB-powered Nano kills it', () => {
  const sim = bench([['battery9', { ends: ['T+3', 'T-3'] }], ['nano', { x: 8, y: 5 }], ['wire', { ends: ['h19', 'T+20'] }], ['wire', { ends: ['h21', 'T-21'] }]]);
  for (let k = 0; k < 60; k++) sim.step(1 / 60);
  assert.ok(byType(sim, 'nano')[0].st.dead);
});

test('Pi 5: on the MB102 (0.7 A) it cannot start (needs > 1 A, 5 V / 4.2 Ω = 1.19 A) and keeps restarting; 9 V on pin 2 kills it', () => {
  const sim = bench([['mb102', { x: 2, y: 0 }], ['pi5', { x: 0, y: 22, props: { usb: false } }]]);
  const pi = byType(sim, 'pi5')[0];
  sim.state.parts.push(BB.newPart('wire', { ends: ['P:' + pi.id + ':1', 'T+20'] }), BB.newPart('wire', { ends: ['P:' + pi.id + ':5', 'T-20'] })); // phys pin 2 (5V), 6 (GND)
  sim.dirty();
  let restarts = 0, maxI = 0;
  for (let k = 0; k < 240; k++) { sim.step(1 / 60); maxI = Math.max(maxI, byType(sim, 'mb102')[0]._i); if (sim.res.issues.some(i => /restarting/.test(i.title))) restarts++; }
  assert.ok(restarts > 0, 'the Pi keeps restarting');
  near(maxI, 0.7, 'the MB102 gives its 0.7 A limit while the Pi tries to start');
  const sim2 = bench([['battery9', { ends: ['T+3', 'T-3'] }], ['pi5', { x: 0, y: 22, props: { usb: false } }]]);
  const pi2 = byType(sim2, 'pi5')[0];
  sim2.state.parts.push(BB.newPart('wire', { ends: ['P:' + pi2.id + ':1', 'T+20'] }), BB.newPart('wire', { ends: ['P:' + pi2.id + ':5', 'T-20'] }));
  sim2.dirty();
  for (let k = 0; k < 60; k++) sim2.step(1 / 60);
  assert.ok(pi2.st.dead, '9 V on pin 2 kills it');
});

test('5 V through 1 MΩ into an ESP32 pin: the clamp diode holds it, ≈1.4 µA flows, no damage', () => {
  const sim = bench([['mb102', { x: 2, y: 0 }], ['esp32', { x: 6, y: 4, props: { program: 'button_led' } }], ['resistor', { props: { r: 1000000 }, ends: ['T+20', 'i19'] }], ['wire', { ends: ['a9', 'T-9'] }]]);
  for (let k = 0; k < 60; k++) sim.step(1 / 60);
  const e = byType(sim, 'esp32')[0];
  assert.ok(!Object.keys(e.st.damaged).length, 'no damage');
  assert.ok(byType(sim, 'resistor')[0]._i < 3e-6);
});

test('Two batteries in series (9 V + 3 V) through 1 kΩ: 12/1002.3 = 11.97 mA and no "No common GND" warning', () => {
  const sim = bench([['battery9', { ends: ['T+3', 'a5'] }], ['aa', { ends: ['b5', 'T-3'] }], ['resistor', { props: { r: 1000 }, ends: ['T+10', 'T-10'] }]]);
  for (let k = 0; k < 5; k++) sim.step(1 / 60);
  near(byType(sim, 'resistor')[0]._i, 12 / 1002.3, 'series current');
  assert.ok(!sim.res.issues.some(i => i.kind === 'noground'));
});

test('Nano from a 9 V battery on VIN: the 5V pin is a steady 5.00 V, and the battery gives the load current too', () => {
  const sim = bench([['battery9', { ends: ['T+3', 'T-3'] }], ['nano', { x: 8, y: 5, props: { usb: false } }],
    ['wire', { ends: ['h22', 'T+22'] }], ['wire', { ends: ['h21', 'T-21'] }], ['resistor', { props: { r: 47 }, ends: ['i19', 'i25'] }], ['wire', { ends: ['j25', 'B-26'] }], ['wire', { ends: ['j21', 'B-20'] }]]);
  const n = byType(sim, 'nano')[0], v5 = [];
  for (let k = 0; k < 20; k++) { sim.step(1 / 60); v5.push(n.st.lastV['5V']); }
  assert.ok(v5.slice(5).every(v => Math.abs(v - 5) < 0.02), 'no flicker: ' + v5.slice(5).map(v => v.toFixed(2)).join(' '));
  // load: 5 V / 47 Ω = 106 mA, plus the board's own 5 V / 250 Ω = 20 mA → the battery gives ≈ 126 mA
  near(byType(sim, 'battery9')[0]._i, 5 / 47 + 5 / 250, 'battery current');
});

test('Red and yellow-green LEDs in parallel on one 220 Ω resistor: red ≈ 10 mA hogs it, green ≈ 1.4 mA (info message)', () => {
  const sim = bench([['mb102', { x: 2, y: 0 }], ['resistor', { props: { r: 220 }, ends: ['T+10', 'a10'] }], ['led', { ends: ['b10', 'T-11'] }], ['led', { props: { color: 'green' }, ends: ['c10', 'T-12'] }]]);
  for (let k = 0; k < 5; k++) sim.step(1 / 60);
  const [red, green] = byType(sim, 'led');
  assert.ok(red._i > 2 * green._i, `red ${red._i} green ${green._i}`);
  assert.ok(sim.res.issues.some(i => i.kind === 'hog'));
});

// Step like the live app does: only while the simulation says something is still changing.
function runLikeApp(sim, maxSteps = 120) { let k = 0; sim.step(1 / 60); while (sim.isDynamic() && k++ < maxSteps) sim.step(1 / 60); return k; }

test('Live loop: a Nano with USB unplugged switches on by itself when 5 V reaches its 5V pin', () => {
  const sim = bench([['mb102', { x: 2, y: 0 }], ['nano', { x: 8, y: 5, props: { usb: false } }], ['wire', { ends: ['h19', 'B+20'] }], ['wire', { ends: ['h21', 'B-21'] }]]);
  runLikeApp(sim);
  assert.ok(byType(sim, 'nano')[0].st.powered, 'powered without forced extra steps');
});

test('No false "fighting": a USB Nano sharing GND with a 9 V battery that drives its own 100 Ω load', () => {
  const sim = bench([['nano', { x: 8, y: 5 }], ['battery9', { ends: ['T+3', 'T-3'] }], ['resistor', { props: { r: 100 }, ends: ['T+10', 'T-10'] }], ['wire', { ends: ['a19', 'T-20'] }]]);
  for (let k = 0; k < 10; k++) sim.step(1 / 60);
  near(byType(sim, 'battery9')[0]._i, 9 / 102, 'battery current (9 V / 102 Ω)');
  assert.ok(!sim.res.issues.some(i => i.kind === 'fight'), JSON.stringify(sim.res.issues.map(i => i.kind)));
});

test('Nano on VIN with 5V shorted to GND: the regulator limits at 0.8 A, steady message, then cuts out when hot', () => {
  const sim = bench([['battery9', { ends: ['T+3', 'T-3'] }], ['nano', { x: 8, y: 5, props: { usb: false } }],
    ['wire', { ends: ['h22', 'T+22'] }], ['wire', { ends: ['h21', 'T-21'] }], ['wire', { ends: ['i19', 'i21'] }]]);
  const kinds = [];
  for (let k = 0; k < 30; k++) { sim.step(1 / 60); kinds.push(sim.res.issues.some(i => i.kind === 'short')); }
  assert.ok(kinds.slice(5).every(Boolean), 'the short message stays on: ' + kinds.join(''));
  near(byType(sim, 'battery9')[0]._i, 0.8 + 0, 'battery gives the 0.8 A limit (no load from the dead-shorted board itself)', 0.05);
  // 9 V − 2 Ω × 0.8 A = 7.4 V on VIN; heat = 7.4 V × 0.8 A ≈ 5.9 W → cut-out within about a second
  for (let k = 0; k < 120; k++) sim.step(1 / 60);
  assert.ok(byType(sim, 'nano')[0].st.regOffUntil > 0, 'thermal cut-out happened');
});

test('USB Nano + MB102 5 V on its 5V pin: safe (the USB diode blocks back-flow): an info note, not danger', () => {
  const sim = bench([['mb102', { x: 2, y: 0 }], ['nano', { x: 8, y: 5 }], ['wire', { ends: ['h19', 'B+20'] }], ['wire', { ends: ['h21', 'B-21'] }]]);
  for (let k = 0; k < 10; k++) sim.step(1 / 60);
  assert.ok(sim.res.issues.some(i => i.kind === 'usbdiode'));
  assert.ok(!sim.res.issues.some(i => i.level === 'danger'), JSON.stringify(sim.res.issues.map(i => i.kind)));
});

test('4 × AA (6 V) on the Nano 5V pin: a strong warning, but it survives (the ATmega is rated 6 V absolute max)', () => {
  const sim = bench([['aa', { props: { cells: 4 }, ends: ['T+3', 'T-3'] }], ['nano', { x: 8, y: 5, props: { usb: false } }], ['wire', { ends: ['h19', 'T+20'] }], ['wire', { ends: ['h21', 'T-21'] }]]);
  for (let k = 0; k < 60; k++) sim.step(1 / 60);
  const n = byType(sim, 'nano')[0];
  assert.ok(!n.st.dead, 'still alive');
  assert.ok(sim.res.issues.some(i => i.kind === 'overvolt' && i.level === 'warn'));
});

test('Resistor with both legs in one strip: warning (it does nothing)', () => {
  const sim = bench([['battery9', { ends: ['T+3', 'T-3'] }], ['wire', { ends: ['T+5', 'a5'] }], ['resistor', { props: { r: 470 }, ends: ['b5', 'd5'] }], ['led', { ends: ['e5', 'T-8'] }]]);
  for (let k = 0; k < 3; k++) sim.step(1 / 60);
  assert.ok(sim.res.issues.some(i => i.kind === 'samerow' && /resistor/.test(i.title)));
});

test('Nano RST wired to GND: held in reset, Blink stops, the LED stays dark', () => {
  const sim = bench([['nano', { x: 8, y: 5, props: { program: 'blink' } }], ['resistor', { props: { r: 220 }, ends: ['h8', 'h3'] }],
    ['led', { ends: ['i3', 'B-4'] }], ['wire', { ends: ['h21', 'B-20'] }], ['wire', { ends: ['i20', 'j21'] }]]); // RST (bottom index 12 → col 20) to GND (col 21)
  let maxI = 0;
  for (let k = 0; k < 90; k++) { sim.step(1 / 60); maxI = Math.max(maxI, byType(sim, 'led')[0]._i); }
  assert.ok(maxI < 1e-6, 'LED dark while in reset');
  assert.ok(sim.res.issues.some(i => i.kind === 'reset'));
});

test('ECHO (5 V pulses, 2.9 % of the time) straight into ESP32 pin 33: flagged at once, but the pin takes seconds (not ms) to die', () => {
  const parts = [['esp32', { x: 6, y: 4, props: { program: 'distance' } }], ['hcsr04', { x: 24, y: 3 }], ['wire', { ends: ['j12', 'b24'] }],
    ['wire', { ends: ['a9', 'T-9'] }], ['wire', { ends: ['T-27', 'b27'] }], ['wire', { ends: ['a21', 'b25'] }], ['wire', { ends: ['c26', 'i16'] }]];
  const sim = bench(parts);
  for (let k = 0; k < 30; k++) sim.step(1 / 60);
  const e = byType(sim, 'esp32')[0];
  assert.ok(sim.res.issues.some(i => i.kind === 'overvolt'), 'flagged within half a second');
  assert.ok(!e.st.damaged['33'], 'not dead yet after 0.5 s');
  for (let k = 0; k < 600; k++) sim.step(1 / 60);
  assert.ok(e.st.damaged['33'], 'dead after a while');
});

test('Speed: a USB Nano and the MB102 with GNDs NOT joined still converges fast (no solver cliff)', () => {
  const sim = bench([['mb102', { x: 2, y: 0 }], ['nano', { x: 8, y: 5, props: { program: 'fade_knob' } }],
    ['resistor', { props: { r: 220 }, ends: ['T+8', 'a8'] }], ['resistor', { props: { r: 220 }, ends: ['T+9', 'a9'] }], ['resistor', { props: { r: 220 }, ends: ['T+10', 'a10'] }]]);
  for (let k = 0; k < 10; k++) sim.step(1 / 60);
  const t0 = Date.now(); for (let k = 0; k < 50; k++) sim.step(1 / 60);
  const ms = (Date.now() - t0) / 50;
  assert.ok(sim.res.converged, 'converged');
  assert.ok(ms < 6, `${ms.toFixed(2)} ms per step`);
});
