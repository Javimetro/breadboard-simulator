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

test('Arduino Nano across the gap runs Blink on D2: LED blinks at ≈12.6 mA ((5−1.93)/(25+220+...))', () => {
  const sim = bench([
    ['nano', { x: 8, y: 5, props: { program: 'blink' } }],      // top row c8..c22, bottom row i8..i22
    ['resistor', { props: { r: 220 }, ends: ['a18', 'a25'] }], // D2 is top row index 10 → column 18
    ['led', { ends: ['b25', 'T-26'] }],
    ['wire', { ends: ['a19', 'T-20'] }]                         // GND is top row index 11 → column 19
  ]);
  const nano = byType(sim, 'nano')[0], led = byType(sim, 'led')[0];
  const pts = sim.pinPoints(nano);
  assert.equal(pts[10].at, 'c18'); assert.equal(nano.type && BB.PARTS.nano.pins[10].n, 'D2');
  let maxI = 0, minI = 1;
  for (let k = 0; k < 90; k++) { sim.step(1 / 60); maxI = Math.max(maxI, led._i); minI = Math.min(minI, led._i); }
  near(maxI, 0.012642, 'LED on');
  assert.ok(minI < 1e-6, 'LED off part of the time');
});

test('ESP32: 5V from HC-SR04 ECHO straight into pin 33 is flagged; a 1k/2.2k divider gives 5 × 2.2/(0.1+1+2.2) = 3.33 V (ECHO has 100 Ω inside) and reads HIGH', () => {
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
  assert.ok(bad.res.issues.some(i => i.kind === 'overvolt'), 'over-voltage flagged');
  const good = make(true); run(good, 0.3);
  const esp = byType(good, 'esp32')[0];
  near(esp.st.lastV['33'], 5 * 2.2 / 3.3, 'pin 33 voltage');
  assert.ok(!good.res.issues.some(i => i.kind === 'overvolt'));
  assert.ok(esp.st.serial.some(s => s.startsWith('Distance: 30')), esp.st.serial.join('|'));
});
