// Engine tests: circuits with values worked out by hand (Ohm's law, nodal equations,
// and for LEDs the diode equation solved by repeated substitution / bisection).
// Run: node --test tests/
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const E = require('../src/engine.js');

// ±2 % is the allowed error; we also report the actual error.
function near(actual, expected, what, tol = 0.02) {
  const err = Math.abs(actual - expected) / Math.abs(expected);
  assert.ok(err <= tol, `${what}: got ${actual}, expected ${expected} (error ${(err * 100).toFixed(3)} %)`);
}

// Helper to build a netlist. Node 0 is ground (reference) in every test.
function net(n, els) { return { n, els, refHints: [0] }; }
// An LED as the engine sees it: junction + series resistance through an inner node.
function led(color, a, k, inner) {
  const p = E.ledParams(color);
  return [{ t: 'D', a, k: inner, is: p.is, nvt: p.nvt }, { t: 'R', a: inner, b: k, r: p.rs }];
}

test('1. One resistor: I = V / R = 9 V / 1 kΩ = 9 mA', () => {
  const r = E.solve(net(2, [{ t: 'V', p: 1, n: 0, v: 9 }, { t: 'R', a: 1, b: 0, r: 1000 }]));
  near(r.i[1], 0.009, 'current');
  near(r.i[0], 0.009, 'battery current');
});

test('2. Voltage divider 1 kΩ / 2 kΩ on 5 V: Vout = 5 × 2/3 = 3.333 V', () => {
  const r = E.solve(net(3, [{ t: 'V', p: 1, n: 0, v: 5 }, { t: 'R', a: 1, b: 2, r: 1000 }, { t: 'R', a: 2, b: 0, r: 2000 }]));
  near(r.v[2], 10 / 3, 'Vout');
});

test('3. Two 1 kΩ in parallel on 10 V: 500 Ω, I = 20 mA', () => {
  const r = E.solve(net(2, [{ t: 'V', p: 1, n: 0, v: 10 }, { t: 'R', a: 1, b: 0, r: 1000 }, { t: 'R', a: 1, b: 0, r: 1000 }]));
  near(r.i[0], 0.02, 'total current');
});

test('4. 9 V battery with 2 Ω inside, 100 Ω load: V = 9 × 100/102 = 8.824 V', () => {
  const r = E.solve(net(3, [{ t: 'V', p: 2, n: 0, v: 9 }, { t: 'R', a: 2, b: 1, r: 2 }, { t: 'R', a: 1, b: 0, r: 100 }]));
  near(r.v[1], 9 * 100 / 102, 'terminal voltage');
});

test('5. Unbalanced Wheatstone bridge (nodal equations by hand): A = 6.581 V, B = 5.935 V', () => {
  // 0.1 = 0.017A − 0.002B ; 0.033333 = −0.002A + 0.0078333B
  const r = E.solve(net(4, [
    { t: 'V', p: 1, n: 0, v: 10 },
    { t: 'R', a: 1, b: 2, r: 100 }, { t: 'R', a: 2, b: 0, r: 200 },
    { t: 'R', a: 1, b: 3, r: 300 }, { t: 'R', a: 3, b: 0, r: 400 },
    { t: 'R', a: 2, b: 3, r: 500 }
  ]));
  near(r.v[2], 6.5806, 'node A');
  near(r.v[3], 5.9355, 'node B');
});

test('6. Two sources (Millman): M = (9/1k + 5/2k) / (1/1k + 1/2k + 1/3k) = 6.273 V', () => {
  const r = E.solve(net(4, [
    { t: 'V', p: 1, n: 0, v: 9 }, { t: 'V', p: 2, n: 0, v: 5 },
    { t: 'R', a: 1, b: 3, r: 1000 }, { t: 'R', a: 2, b: 3, r: 2000 }, { t: 'R', a: 3, b: 0, r: 3000 }
  ]));
  near(r.v[3], 0.0115 / (1 / 1000 + 1 / 2000 + 1 / 3000), 'middle node');
});

test('7. Current source 2 mA into 4.7 kΩ: V = 9.4 V', () => {
  const r = E.solve(net(2, [{ t: 'I', a: 0, b: 1, i: 0.002 }, { t: 'R', a: 1, b: 0, r: 4700 }]));
  near(r.v[1], 9.4, 'voltage');
});

test('8. Red LED + 470 Ω on 9 V: I = (9 − Vf)/470 → 15.03 mA, Vf ≈ 1.94 V', () => {
  const r2 = E.solve(net(4, [{ t: 'V', p: 1, n: 0, v: 9 }, { t: 'R', a: 1, b: 2, r: 470 }, ...led('red', 2, 0, 3)]));
  assert.ok(r2.converged, 'Newton iteration converged');
  near(r2.i[1], 0.0150308, 'LED current');
  near(r2.v[2], 9 - 470 * 0.0150308, 'LED voltage');
});

test('9. Blue LED + 100 Ω on 5 V: 5 − 3.0 V = 2 V, 2 V / 100 Ω = 20 mA', () => {
  const r = E.solve(net(4, [{ t: 'V', p: 1, n: 0, v: 5 }, { t: 'R', a: 1, b: 2, r: 100 }, ...led('blue', 2, 0, 3)]));
  near(r.i[1], 0.020, 'LED current');
});

test('10. LED in backwards: no current (below 1 nA)', () => {
  const r = E.solve(net(4, [{ t: 'V', p: 1, n: 0, v: 9 }, { t: 'R', a: 1, b: 2, r: 470 }, ...led('red', 0, 2, 3)]));
  assert.ok(Math.abs(r.i[1]) < 1e-9, `current ${r.i[1]}`);
  near(r.v[2], 9, 'all 9 V across the LED');
});

test('11. Red LED with no resistor on a 9 V battery (2 Ω inside): about 585 mA, far over 20 mA', () => {
  const r = E.solve(net(4, [{ t: 'V', p: 1, n: 0, v: 9 }, { t: 'R', a: 1, b: 2, r: 2 }, ...led('red', 2, 0, 3)]));
  near(r.i[1], 0.58545, 'LED current');
});

test('12. Red + green LEDs in series with 330 Ω on 9 V: 14.94 mA', () => {
  const r = E.solve(net(6, [
    { t: 'V', p: 1, n: 0, v: 9 }, { t: 'R', a: 1, b: 2, r: 330 },
    ...led('red', 2, 3, 4), ...led('green', 3, 0, 5)
  ]));
  near(r.i[1], 0.0149433, 'current');
});

test('13. Red and blue LEDs in parallel after 220 Ω on 5 V: red takes it all (13.99 mA), blue stays dark', () => {
  const r = E.solve(net(5, [
    { t: 'V', p: 1, n: 0, v: 5 }, { t: 'R', a: 1, b: 2, r: 220 },
    ...led('red', 2, 0, 3), ...led('blue', 2, 0, 4)
  ]));
  near(r.i[2], 0.0139933, 'red LED');
  assert.ok(r.i[4] < 1e-6, `blue LED ${r.i[4]}`);
});

test('14. 10 kΩ / 10 kΩ divider read by a 10 MΩ meter: 5 × 9990/19990 = 2.4988 V', () => {
  const r = E.solve(net(3, [
    { t: 'V', p: 1, n: 0, v: 5 }, { t: 'R', a: 1, b: 2, r: 10000 }, { t: 'R', a: 2, b: 0, r: 10000 },
    { t: 'R', a: 2, b: 0, r: 10e6 }
  ]));
  const low = 1 / (1 / 10000 + 1 / 10e6);
  near(r.v[2], 5 * low / (10000 + low), 'meter reading');
});

test('15. 10 kΩ knob at 30 %: 3 kΩ + 7 kΩ, wiper = 5 × 7/10 = 3.5 V', () => {
  const r = E.solve(net(3, [{ t: 'V', p: 1, n: 0, v: 5 }, { t: 'R', a: 1, b: 2, r: 3000 }, { t: 'R', a: 2, b: 0, r: 7000 }]));
  near(r.v[2], 3.5, 'wiper');
});

test('16. Capacitor 1000 µF charging through 1 kΩ from 5 V: after 1 s (one τ) V = 5(1 − e⁻¹) = 3.161 V', () => {
  const c = { t: 'C', a: 2, b: 0, c: 1000e-6, v0: 0 };
  const circuit = net(3, [{ t: 'V', p: 1, n: 0, v: 5 }, { t: 'R', a: 1, b: 2, r: 1000 }, c]);
  for (let k = 0; k < 1000; k++) { const r = E.solve(circuit, { dt: 0.001 }); c.v0 = r.capV[2]; }
  near(c.v0, 5 * (1 - Math.exp(-1)), 'capacitor voltage');
});

test('17. Short circuit: 9 V battery (2 Ω inside) + 0.01 Ω wire: I = 9/2.01 = 4.48 A', () => {
  const r = E.solve(net(3, [{ t: 'V', p: 2, n: 0, v: 9 }, { t: 'R', a: 2, b: 1, r: 2 }, { t: 'R', a: 1, b: 0, r: 0.01 }]));
  near(r.i[2], 9 / 2.01, 'short current');
});

test('18. 5 V into ESP32 through 1 kΩ / 2.2 kΩ divider: 5 × 2.2/3.2 = 3.4375 V (safe, under 3.6 V)', () => {
  const r = E.solve(net(3, [{ t: 'V', p: 1, n: 0, v: 5 }, { t: 'R', a: 1, b: 2, r: 1000 }, { t: 'R', a: 2, b: 0, r: 2200 }]));
  near(r.v[2], 3.4375, 'pin voltage');
});

test('19. Two AA cells (3 V, 0.3 Ω) + 100 Ω + red LED: 11.15 mA', () => {
  const r = E.solve(net(5, [{ t: 'V', p: 4, n: 0, v: 3 }, { t: 'R', a: 4, b: 1, r: 0.3 }, { t: 'R', a: 1, b: 2, r: 100 }, ...led('red', 2, 0, 3)]));
  near(r.i[2], 0.0111532, 'current');
});

test('20. Arduino pin (5 V, 25 Ω output) + 220 Ω + red LED: 12.64 mA (under the 20 mA limit)', () => {
  const r = E.solve(net(5, [{ t: 'V', p: 4, n: 0, v: 5 }, { t: 'R', a: 4, b: 1, r: 25 }, { t: 'R', a: 1, b: 2, r: 220 }, ...led('red', 2, 0, 3)]));
  near(r.i[2], 0.012642, 'pin current');
});

test('21. Separate islands each get their own 0 V: two batteries not wired together', () => {
  const r = E.solve({ n: 4, els: [
    { t: 'V', p: 1, n: 0, v: 9 }, { t: 'R', a: 1, b: 0, r: 900 },
    { t: 'V', p: 3, n: 2, v: 3 }, { t: 'R', a: 3, b: 2, r: 300 }
  ] });
  near(r.v[1] - r.v[0], 9, 'island 1');
  near(r.v[3] - r.v[2], 3, 'island 2');
  near(r.i[3], 0.01, 'island 2 current');
});

test('LED forward voltage table matches the colours (at 20 mA)', () => {
  near(E.ledVf('red', 0.02), 2.0, 'red', 0.001);
  near(E.ledVf('green', 0.02), 2.2, 'green', 0.001);
  near(E.ledVf('blue', 0.02), 3.0, 'blue', 0.001);
  near(E.ledVf('white', 0.02), 3.1, 'white', 0.001);
});
