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
    'current': 'How much electricity flows, measured in amps (A). 1 mA = 0.001 A. An LED wants about 15 mA.',
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
    'mA': 'Milliamp: one thousandth of an amp. 20 mA = 0.02 A.',
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
    'microcontroller': 'A small computer on one chip that runs one program and controls its pins.'
  };

  // ---------- helpers used by the checks ----------
  function lit(p) { return p && !p.st.burnt && (p._i || 0) > 0.002; }
  function safe(p) { return p && !p.st.burnt && (p._i || 0) <= 0.0255; }
  function inSeries(a, b) { var ia = Math.abs(a._i || 0), ib = Math.abs(b._i || 0); return ia > 0.0005 && Math.abs(ia - ib) < 0.08 * Math.max(ia, ib); }
  function mcuPinNet(L, mcu, label) { var def = BB.PARTS[mcu.type]; var k = def.pins.findIndex(function (q) { return q.n === label; }); return L.net(mcu, k); }
  function anyGndNet(L, mcu) { var def = BB.PARTS[mcu.type], out = []; def.pins.forEach(function (q, k) { if (q.kind === 'gnd') out.push(L.net(mcu, k)); }); return out; }

  // Why is this LED dark? A plain explanation, or null.
  function whyDark(L, led) {
    if (!led || lit(led) || led.st.burnt) return null;
    var pts = L.sim.pinPoints(led);
    if (!pts[0].at || !pts[1].at) return 'Put both LED legs into holes.';
    var na = L.net(led, 0), nk = L.net(led, 1);
    if (na === nk) return null; // the samerow issue explains it
    var va = L.pinV(led, 0), vk = L.pinV(led, 1);
    if (vk - va > 1) return null; // reversed issue explains it
    if (L.alone(led, 0)) return 'The long leg (+) is not connected to anything else. Its strip needs a path to + (through a resistor).';
    if (L.alone(led, 1)) return 'The short leg (−) is not connected to anything else. Connect its strip to the − rail.';
    if ((led._i || 0) > 0.0002) return 'The LED is very dim: only ' + fmt.I(led._i) + '. The resistor is too big.';
    return 'No full loop yet. Current must go from + through the resistor and the LED, and back to −.';
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
    s += '<text x="180" y="76" class="itxt w s">D2</text><path d="M180 62 Q240 20 270 60" class="iwire"/><circle cx="272" cy="70" r="16" class="iledglow blink"/><circle cx="272" cy="70" r="9" class="iled blink"/>';
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
    var s = '<text x="80" y="24" class="itxt" text-anchor="middle">5V straight in</text><text x="240" y="24" class="itxt" text-anchor="middle">With a divider</text>';
    s += '<rect x="40" y="90" width="80" height="50" rx="6" fill="#17181c"/><text x="80" y="120" class="itxt w s" text-anchor="middle">3.3V pin</text>';
    s += '<path d="M80 40 V90" class="iloop hotline"/><text x="88" y="55" class="itxt">5 V</text><path d="M60 70 l40 -20 M60 50 l40 20" class="ix"/>';
    s += '<rect x="200" y="90" width="80" height="50" rx="6" fill="#17181c"/><text x="240" y="120" class="itxt w s" text-anchor="middle">3.3V pin</text>';
    s += '<path d="M240 38 V48 M240 68 V74 M240 74 H270 M270 74 V80 M270 100 V108 M240 74 V90" class="iloop"/><rect x="232" y="48" width="16" height="20" rx="4" class="ires"/><rect x="262" y="80" width="16" height="20" rx="4" class="ires"/>';
    s += '<text x="200" y="45" class="itxt s">5 V</text><text x="190" y="80" class="itxt s good">3.4 V ✓</text>';
    s += '<text x="160" y="170" class="itxt" text-anchor="middle">Two resistors bring 5 V down to a safe 3.4 V.</text>';
    return s;
  };

  // ---------- levels ----------
  var LEVELS = [
    {
      id: 'inside', title: 'Inside the breadboard', icon: 'holes',
      intro: { pic: I.inside, text: 'A {{breadboard}} has metal strips hidden inside. Holes on the same {{strip}} are connected.' },
      board: { cols: 30 }, view: [-0.6, -1.6, 17, 18.6], tray: [], tools: ['xray'],
      steps: [
        { text: 'Tap any hole in the middle area (rows a–j).', tap: function (L, h) { var o = L.sim.board.byId[h]; if (o.kind === 'term') return { ok: true, msg: 'See the 5 holes that light up? They share one metal strip.' }; return { ok: false, msg: 'That is a power rail. Tap a hole in rows a–j.' }; } },
        { text: 'Tap 🔍 X-ray to see the metal strips inside.', check: function (L) { return L.xray; }, ok: 'Each strip joins 5 holes in a column.' },
        { text: 'Tap a hole that is connected to c8.', tap: function (L, h) {
          if (h === 'c8') return { ok: false, msg: 'That is c8 itself. Tap another hole on the same strip.' };
          if (['a8', 'b8', 'd8', 'e8'].indexOf(h) >= 0) return { ok: true, msg: 'Yes! ' + h + ' and c8 share the strip of column 8 (a–e).' };
          return { ok: false, msg: h + ' is not connected to c8. Strips go up and down: a8 to e8.' };
        } },
        { text: 'Are e8 and f8 connected? Tap them to check, then answer.', choices: [
          { label: 'Yes', ok: false, why: 'Look again: tap e8, then f8. They light up different groups.' },
          { label: 'No', ok: true, why: 'Right! The gap in the middle splits each column into two strips.' }] }
      ],
      hints: ['Holes in the same column, on the same side of the middle gap, are connected.', 'c8 is in column 8, top half. Its strip is a8, b8, c8, d8, e8.', 'The middle gap has no metal under it.'],
      done: 'Holes a–e of a column are joined, and holes f–j are joined. The middle gap keeps them apart.',
      solve: function (A) { A.tap('c3'); A.xray(true); A.tap('b8'); A.choose(1); }
    },
    {
      id: 'rails', title: 'Power rails', icon: 'rails',
      intro: { pic: I.rails, text: 'The long rows at the top and bottom are power {{rail}}s: red + and blue −. On some long boards they stop in the middle.' },
      board: { cols: 63, split: true }, view: [17, -1.6, 46, 18.6], tray: ['wire'], tools: ['xray', 'wire'],
      steps: [
        { text: 'Tap a hole in the top red + row.', tap: function (L, h) { if (h.slice(0, 2) === 'T+') return { ok: true, msg: 'The whole row lights up… but only to the middle!' }; return { ok: false, msg: 'Tap a hole in the top row, next to the red line.' }; } },
        { text: 'Is the + hole at column 26 connected to the + hole at column 38?', choices: [
          { label: 'Yes', ok: false, why: 'Tap them both. The light stops at the gap in the red line.' },
          { label: 'No', ok: true, why: 'Right. On this board each rail is cut in the middle. Look for the gap in the red and blue lines.' }] },
        { text: 'Tap ✏️ Wire, then tap a + hole on the left and a + hole on the right of the gap.', check: function (L) { return L.connected('T+26', 'T+38') && !L.connected('T+26', 'T-26'); }, ok: 'The two halves of the + rail are joined now.' },
        { text: 'Now join the two halves of the top blue − rail too.', check: function (L) { return L.connected('T-26', 'T-38') && L.connected('T+26', 'T+38') && !L.connected('T+26', 'T-26'); }, ok: 'Both rails now run along the whole board.' }
      ],
      explain: function (L) { if (L.connected('T+26', 'T-26')) return 'A wire now joins the + rail to the − rail. With power on, that is a {{short circuit}}! Tap that wire and press Delete.'; return null; },
      hints: ['The gap is between column 30 and column 32. Look at the red line.', 'Tap ✏️ Wire. Tap the + hole at column 30, then the + hole at column 32.', 'Do the same in the blue − row: column 30 to column 32.'],
      done: 'Rails carry power along the board. If a long board splits them, two short wires join the halves.',
      solve: function (A) { A.tap('T+20'); A.choose(1); A.wire('T+30', 'T+32'); A.wire('T-30', 'T-32'); }
    },
    {
      id: 'first', title: 'First light', icon: 'led',
      intro: { pic: I.first, text: 'An {{LED}} needs a {{resistor}} to limit the {{current}}. Without one, it burns out.' },
      board: { cols: 30 }, view: [-3, -15.5, 21, 18.6], tray: [{ type: 'led', props: { color: 'red' } }, { type: 'resistor', props: { r: 470 } }, 'wire'],
      setup: function (A) { A.add('battery9', { x: 4, y: -13.5, ends: ['T+3', 'T-3'], locked: true }); },
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
      board: { cols: 30 }, view: [-3, -15.5, 31.5, 18.6], tray: ['wire'],
      setup: function (A) {
        A.add('battery9', { x: 4, y: -13.5, ends: ['T+3', 'T-3'], locked: true });
        A.add('resistor', { props: { r: 470 }, ends: ['T+8', 'a8'], locked: true });
        A.add('led', { id: 'led-a', ends: ['T-9', 'c8'] });
        A.add('resistor', { props: { r: 470 }, ends: ['T+14', 'a14'], locked: true });
        A.add('led', { id: 'led-b', ends: ['b14', 'd14'] });
        A.add('wire', { id: 'short', props: { color: 'yellow' }, ends: ['T+20', 'T-21'] });
        A.add('resistor', { props: { r: 470 }, ends: ['T+26', 'a26'], locked: true });
        A.add('led', { id: 'led-c', ends: ['c26', 'T-27'] });
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
      hints: ['First the short circuit: the yellow wire goes from + to −. Tap it and press Delete.', 'One LED is backwards (long leg toward −). Tap it and press Flip.', 'One LED has both legs in column 14. Drag its short leg to the blue − rail.'],
      done: 'Three mistakes you will meet on your desk: a short circuit, an LED backwards, and both legs in one strip.',
      solve: function (A) { A.del('short'); A.flip('led-a'); A.moveEnd('led-b', 1, 'T-16'); A.wait(0.3); }
    },
    {
      id: 'button', title: 'Push button', icon: 'button',
      intro: { pic: I.button, text: 'A push button closes a gap while you press it. Put it across the middle gap of the board.' },
      board: { cols: 30 }, view: [-3, -15.5, 21, 18.6], tray: ['button', 'wire'],
      setup: function (A) {
        A.add('battery9', { x: 4, y: -13.5, ends: ['T+3', 'T-3'], locked: true });
        A.add('resistor', { props: { r: 470 }, ends: ['T+8', 'a8'], locked: true });
        A.add('led', { ends: ['a10', 'T-11'], locked: true });
      },
      steps: [
        { text: 'Put the button across the middle gap so it joins column 8 and column 10.', check: function (L) {
          var b = L.of('button')[0], l = L.of('led')[0];
          if (!b || b.free) return false;
          var nets = [0, 1, 2, 3].map(function (k) { return L.net(b, k); });
          var r = L.of('resistor')[0];
          return nets.indexOf(L.net(r, 1)) >= 0 && nets.indexOf(L.net(l, 0)) >= 0 && !b.st.pressed && !lit(l);
        }, ok: 'Good. The LED is off: the gap is open.' },
        { text: 'Now press and hold the button (its round cap). The LED should light.', check: function (L) { var b = L.of('button')[0], l = L.of('led')[0]; return b && b.st.pressed && lit(l) && safe(l); }, ok: 'Pressed: the gap closes and the LED lights.' }
      ],
      explain: function (L) {
        var b = L.of('button')[0], l = L.of('led')[0];
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
      board: { cols: 30 }, view: [-3, -15.5, 31.5, 18.6], tray: ['pot', 'wire'],
      setup: function (A) {
        A.add('battery9', { x: 4, y: -13.5, ends: ['T+3', 'T-3'], locked: true });
        A.add('resistor', { props: { r: 330 }, ends: ['a14', 'a18'], locked: true });
        A.add('led', { ends: ['b18', 'T-20'], locked: true });
      },
      steps: [
        { text: 'Add the knob so the current goes: + rail → knob → resistor (column 14) → LED.', check: function (L) { var p = L.of('pot')[0], l = L.of('led')[0]; return p && lit(l) && inSeries(p, l); }, ok: 'The knob is in the loop.' },
        { text: 'Turn the knob all the way one way, then the other. Watch the LED.', check: function (L) {
          var p = L.of('pot')[0], l = L.of('led')[0], f = L.flags;
          if (p && l && inSeries(p, l)) { f.maxI = Math.max(f.maxI || 0, l._i); }
          if (p && l && L.connected && (l._i || 0) < (f.minI === undefined ? 1 : f.minI) && (f.maxI || 0) > 0) f.minI = l._i;
          return (f.maxI || 0) > 0.012 && f.minI !== undefined && f.minI < 0.002 && !l.st.burnt;
        }, ok: 'Bright and dim: the knob controls the current.' }
      ],
      explain: function (L) {
        var p = L.of('pot')[0], l = L.of('led')[0];
        if (p && lit(l) && !inSeries(p, l)) return 'The LED lights, but not through the knob. The current must go through the knob’s middle leg.';
        if (p && lit(l) && (L.flags.maxI || 0) > 0.012 && Math.abs(L.flags.maxI - (L.flags.minI || 1)) < 0.003) return 'The brightness does not change: you are using the two outer legs. Use one outer leg and the middle leg (W).';
        return whyDark(L, l);
      },
      hints: ['Path: + rail → knob leg 1 → knob middle leg (W) → resistor in column 14 → LED → − rail.', 'Put the knob in the board. Add a wire from the + rail to its leg 1.', 'Add a wire from the knob’s middle leg (W) to column 14 (a free hole like c14). Then drag the knob’s white mark.'],
      done: 'The knob changes the resistance, so the current and the brightness change. The fixed 330 Ω keeps the LED safe when the knob is at 0 Ω.',
      solve: function (A) { var p = A.add('pot', { x: 8, y: 5 }); A.wire('T+8', 'b8'); A.wire('b10', 'c14'); A.set(p, 'pos', 0); A.wait(0.3); A.set(p, 'pos', 1); A.wait(0.3); }
    },
    {
      id: 'mb102', title: 'Power supply & Ohm’s law', icon: 'mb102',
      intro: { pic: I.mb102, text: 'The MB102 power board gives 3.3V or 5V to each pair of rails. Pick the right resistor with {{Ohm’s law}}: R = V ÷ I.' },
      board: { cols: 30 }, view: [-9, -2.5, 22, 19.5], tray: [{ type: 'led', props: { color: 'red' } }, { type: 'resistor', props: { r: 22 } }, { type: 'resistor', props: { r: 220 } }, { type: 'resistor', props: { r: 10000 } }, 'wire'],
      lock: ['r', 'color'],
      setup: function (A) { A.add('mb102', { id: 'mb', x: 2, y: 0, props: { top: 'off', bottom: 'off', on: false }, locked: true }); },
      steps: [
        { text: 'Set the top rails to 5V and the bottom rails to 3.3V. Tap the yellow {{jumper}}s.', check: function (L) { var m = L.part('mb'); return m.props.top === '5' && m.props.bottom === '3.3'; }, ok: 'Top rails 5V, bottom rails 3.3V.' },
        { text: 'Turn the power on: tap the white button on the MB102.', check: function (L) { var m = L.part('mb'); return m.props.on && m.props.top === '5'; }, ok: 'Power is on. The green light shows it.' },
        { text: 'Light a red LED from the top 5V rail. Pick the resistor that gives about 15 mA.', check: function (L) {
          return L.of('led').some(function (l) { return (l._i || 0) > 0.008 && safe(l) && L.of('resistor').some(function (r) { return inSeries(l, r) && (Math.abs(L.pinV(r, 0) - 5) < 0.15 || Math.abs(L.pinV(r, 1) - 5) < 0.15); }); });
        }, ok: '(5 − 2) V ÷ 220 Ω ≈ 14 mA. Just right!' }
      ],
      explain: function (L) {
        var l = L.of('led')[0], r = L.of('resistor').find(function (q) { return l && inSeries(l, q); });
        if (l && r && r.props.r === 10000) return 'The LED is very dim: (5 V − 1.7 V) ÷ 10 000 Ω = 0.3 mA. Far too small. Use a smaller resistor.';
        if (l && l.st.burnt) return '22 Ω is too small: (5 V − 2 V) ÷ 22 Ω = 136 mA! For 15 mA you need 3 V ÷ 0.015 A = 200 Ω. Use 220 Ω.';
        return whyDark(L, l);
      },
      hints: ['Ohm’s law: R = V ÷ I. The resistor gets 5 V − 2 V = 3 V. For 15 mA: 3 ÷ 0.015 = 200 Ω.', 'The closest one is 220 Ω (red, red, brown bands).', 'Resistor from the top + rail to a hole (like a12). LED long leg in that column, short leg in the top − rail.'],
      done: 'R = V ÷ I picks the resistor: (5 − 2) ÷ 0.015 = 200 Ω, so 220 Ω. Each side of the MB102 can be 3.3V or 5V.',
      solve: function (A) { A.set('mb', 'top', '5'); A.set('mb', 'bottom', '3.3'); A.set('mb', 'on', true); A.add('resistor', { props: { r: 220 }, ends: ['T+12', 'a12'] }); A.add('led', { ends: ['c12', 'T-14'] }); A.wait(0.3); }
    },
    {
      id: 'meter', title: 'Multimeter', icon: 'meter',
      intro: { pic: I.meter, text: 'A {{multimeter}} measures volts across a part, and current in the path of the current ({{series}}).' },
      board: { cols: 30 }, view: [-9, -2.5, 31.5, 50], tray: [],
      lock: ['r', 'color'],
      setup: function (A) {
        A.add('mb102', { id: 'mb', x: 2, y: 0, props: { top: '5', bottom: '5', on: true }, locked: true });
        A.add('resistor', { props: { r: 220 }, ends: ['T+8', 'a8'], locked: true });
        A.add('led', { ends: ['a12', 'T-14'], locked: true });
        A.add('resistor', { id: 'mystery', props: { r: 4700 }, ends: ['f22', 'f27'], locked: true });
        A.add('meter', { id: 'm', x: 8, y: 20.5, props: { mode: 'off' }, ends: [{ x: 12, y: 49 }, { x: 16, y: 49 }] });
      },
      steps: [
        { text: 'Measure the top + rail: set the dial to V, put the red probe in the + rail and the black probe in the − rail.', check: function (L) { var m = L.part('m'), r = m.st.reading || {}; return r.m === 'V' && Math.abs(r.val - 5) < 0.1 && L.connectedTo(m, 0, 'T+20') && L.connectedTo(m, 1, 'T-20'); }, ok: '5.00 V: the rail voltage.' },
        { text: 'Measure the LED current. There is a gap between column 8 and column 12. Put the probes in the gap, then set the dial to mA.', check: function (L) { var m = L.part('m'), r = m.st.reading || {}, l = L.of('led')[0]; return r.m === 'A' && r.val > 0.005 && inSeries(m, l); }, ok: 'About 14 mA flows through the meter and the LED.' },
        { text: 'Measure the loose resistor (columns 22 and 27): put the probes in its columns, then set the dial to Ω.', check: function (L) { var m = L.part('m'), r = m.st.reading || {}; return r.m === 'ohm' && Math.abs(r.val - 4700) < 250; }, ok: 'The meter reads 4.70 kΩ.' },
        { text: 'Its bands are yellow, violet, red. What value is it?', choices: [
          { label: '4.7 kΩ', ok: true, why: 'Yes: yellow 4, violet 7, red = × 100 → 4700 Ω = 4.7 kΩ.' },
          { label: '47 Ω', ok: false, why: 'The third band is the multiplier: red means × 100, so 47 × 100.' },
          { label: '470 kΩ', ok: false, why: 'Red means × 100 (not × 10 000): 47 × 100 = 4700 Ω.' }] }
      ],
      explain: function (L) {
        var m = L.part('m'), r = (m && m.st.reading) || {};
        if (r.m === 'A' && L.connectedTo(m, 0, 'T+20') && L.connectedTo(m, 1, 'T-20')) return 'Never put the meter in mA mode across the rails: it is like a wire there.';
        if (r.m === 'V' && (L.connectedTo(m, 0, 'T-20') && L.connectedTo(m, 1, 'T+20'))) return 'The reading is negative: the probes are swapped. Red goes to +.';
        if (L.stepIndex === 1 && r.m === 'V' && (L.connectedTo(m, 0, 'a8') && L.connectedTo(m, 1, 'a12'))) return 'Good place! Now turn the dial to mA to measure the current.';
        return null;
      },
      hints: ['Volts: the probes go on two points (across). Current: the meter must be IN the path, so all the current goes through it.', 'For current: red probe in column 8 (like c8), black probe in column 12 (like c12). Then set the dial to mA.', 'For ohms: probes in g22 and g27, then set the dial to Ω. Move the probes first, then turn the dial.'],
      done: 'Volts: measure across. Current: break the loop and put the meter in the gap. Ohms: only on a part with no power.',
      solve: function (A) {
        A.set('m', 'mode', 'V'); A.moveEnd('m', 0, 'T+20'); A.moveEnd('m', 1, 'T-20'); A.wait(0.2);
        A.moveEnd('m', 0, 'c8'); A.moveEnd('m', 1, 'c12'); A.set('m', 'mode', 'A'); A.wait(0.2);
        A.moveEnd('m', 0, 'h22'); A.moveEnd('m', 1, 'h27'); A.set('m', 'mode', 'ohm'); A.wait(0.2);
        A.choose(0);
      }
    },
    {
      id: 'nano', title: 'Arduino Nano: blink', icon: 'nano',
      intro: { pic: I.nano, text: 'The Arduino Nano is a {{microcontroller}} board. Put it across the middle gap, then let a {{pin}} blink an LED.' },
      board: { cols: 30 }, view: [-0.8, -1.6, 31.5, 18.6], tray: ['nano', { type: 'resistor', props: { r: 220 } }, { type: 'led', props: { color: 'green' } }, 'wire'],
      lock: ['r', 'color'],
      steps: [
        { text: 'Put the Arduino Nano across the middle gap.', check: function (L) { var n = L.of('nano')[0]; return n && !n.free; }, ok: 'Each Nano pin now has its own strip of free holes.' },
        { text: 'Tap the Nano and choose the program “Blink”.', check: function (L) { var n = L.of('nano')[0]; return n && n.props.program === 'blink'; }, ok: 'Blink switches pin D2 on and off every half second.' },
        { text: 'Connect pin D2 → resistor → LED → GND. Make the LED blink.', check: function (L) {
          var n = L.of('nano')[0], f = L.flags; if (!n) return false;
          var d2 = n.st.io && n.st.io.D2;
          L.of('led').forEach(function (l) {
            var pinI = (n.st.pinI || {}).D2 || 0;
            if (d2 && d2.level === 1 && lit(l) && safe(l) && Math.abs(pinI - l._i) < 0.1 * l._i) f.on = true;
            if (d2 && d2.level === 0 && f.on && !lit(l)) f.off = true;
          });
          return f.on && f.off;
        }, ok: 'It blinks! The pin gives 5 V, and 220 Ω keeps the current near 13 mA.' }
      ],
      explain: function (L) { var l = L.of('led')[0]; var n = L.of('nano')[0]; if (n && n.props.program === 'blink' && l && !lit(l) && !(n.st.io && n.st.io.D2 && n.st.io.D2.level === 0)) return whyDark(L, l); return null; },
      hints: ['D2 is on the top row of pins (look at the white labels). Holes above it, in the same column, are joined to it.', 'Put the resistor from a hole above D2 to a free column. Put the LED long leg in that column.', 'Connect the LED short leg to GND: a wire from the GND pin’s column to the − rail, and the LED short leg into the − rail.'],
      done: 'A pin set HIGH gives 5 V. With 220 Ω the LED gets about 13 mA, under the 20 mA a pin can give safely.',
      solve: function (A) { var n = A.add('nano', { x: 8, y: 5 }); A.set(n, 'program', 'blink'); A.add('resistor', { props: { r: 220 }, ends: ['a18', 'a25'] }); A.add('led', { props: { color: 'green' }, ends: ['b25', 'T-26'] }); A.wire('a19', 'T-20'); A.wait(1.3); }
    },
    {
      id: 'screen', title: 'Light meter on a screen', icon: 'oled',
      intro: { pic: I.screen, text: 'A light sensor and a resistor make a {{voltage divider}}. The Nano reads it on an {{analog}} pin and shows it on a screen with {{I2C}}.' },
      board: { cols: 30 }, view: [-0.8, -1.6, 31.5, 32], tray: [{ type: 'ldr' }, { type: 'resistor', props: { r: 10000 } }, 'wire'],
      lock: ['r', 'program'],
      setup: function (A) {
        A.add('nano', { id: 'nano', x: 8, y: 5, props: { program: 'light_meter' }, locked: true });
        A.add('oled', { id: 'oled', x: 9, y: 20, locked: true });
      },
      steps: [
        { text: 'Connect the screen: GND → GND, VCC → 5V, SDA → A4, SCL → A5.', check: function (L) { var o = L.part('oled'); return !!o.st.mcu && (o.st.vcc || 0) > 4.5; }, ok: 'The screen is on. I2C uses just SDA (data) and SCL (clock).' },
        { text: 'Build the light sensor: LDR from 5V to A0, and 10 kΩ from A0 to GND.', check: function (L) {
          var n = L.part('nano'), ldr = L.of('ldr')[0], r = L.of('resistor')[0];
          if (!ldr || !r) return false;
          var a0 = mcuPinNet(L, n, 'A0'), v5 = mcuPinNet(L, n, '5V'), gnd = anyGndNet(L, n);
          var ln = [L.net(ldr, 0), L.net(ldr, 1)], rn = [L.net(r, 0), L.net(r, 1)];
          return ln.indexOf(a0) >= 0 && ln.indexOf(v5) >= 0 && rn.indexOf(a0) >= 0 && (gnd.indexOf(rn[0]) >= 0 || gnd.indexOf(rn[1]) >= 0);
        }, ok: 'Now A0 gets a voltage that follows the light.' },
        { text: 'Tap the light sensor and move its Light slider from bright to dark. Watch the number.', check: function (L) {
          var n = L.part('nano'), v = (n.st.lastV || {}).A0 || 0, a = Math.round(v / 5 * 1023), f = L.flags;
          if (!L.part('oled').st.mcu) return false;
          if (a > 600) f.hi = true; if (a < 300 && f.hi) f.lo = true;
          return f.hi && f.lo;
        }, ok: 'Bright: big number. Dark: small number. Your light meter works!' }
      ],
      explain: function (L) {
        var n = L.part('nano'), v = (n.st.lastV || {}).A0 || 0;
        var ldr = L.of('ldr')[0], r = L.of('resistor')[0];
        if (L.stepIndex >= 1 && ldr && (!r || L.alone(r, 0) || L.alone(r, 1)) && v > 4.9) return 'A0 reads 1023 all the time: with only the LDR, A0 is pulled up to 5 V. Add the 10 kΩ resistor from A0 to GND. Two resistors make a voltage divider.';
        return null;
      },
      hints: ['5V, GND, A0, A4 and A5 are on the Nano’s bottom row. The free holes under them (rows h–j) are joined to them.', 'Use wires from those holes to the screen’s pins: GND, VCC, SCL, SDA.', 'Divider: put the LDR between the 5V column and the A0 column (use a wire or the rails), and 10 kΩ between A0 and GND.'],
      done: 'More light → lower LDR resistance → more voltage on A0. The Nano turns 0–5 V into 0–1023, and I2C sends it to the screen with two wires.',
      solve: function (A) {
        A.wire('P:oled:0', 'j21'); A.wire('P:oled:1', 'j19'); A.wire('P:oled:2', 'j16'); A.wire('P:oled:3', 'j15');
        A.wire('h19', 'B+20'); A.wire('h21', 'B-21');
        var l = A.add('ldr', { ends: ['B+26', 'j26'] }); A.add('resistor', { props: { r: 10000 }, ends: ['i26', 'B-28'] }); A.wire('h11', 'h26');
        A.set(l, 'light', 0.9); A.wait(0.3); A.set(l, 'light', 0.05); A.wait(0.3);
      }
    },
    {
      id: 'sound', title: 'Clap → beep', icon: 'sound',
      intro: { pic: I.sound, text: 'A microphone module hears a clap. The Nano answers with a tone on a speaker. The speaker needs a resistor.' },
      board: { cols: 30 }, view: [-0.8, -16, 46, 18.6], tray: ['mic', 'speaker', { type: 'resistor', props: { r: 220 } }, 'wire'],
      lock: ['r', 'program'],
      setup: function (A) { A.add('nano', { id: 'nano', x: 1, y: 5, props: { program: 'clap_beep' }, locked: true }); },
      steps: [
        { text: 'Put the microphone on the board and connect: + → 5V, G → GND, AO → A0.', check: function (L) {
          var m = L.of('mic')[0], n = L.part('nano'); if (!m) return false;
          return (m.st.vcc || 0) > 4.5 && L.net(m, 0) === mcuPinNet(L, n, 'A0');
        }, ok: 'The microphone is on. AO follows the sound.' },
        { text: 'Connect the speaker: D8 → 220 Ω resistor → speaker → GND.', check: function (L) {
          var s = L.of('speaker')[0], n = L.part('nano'); if (!s) return false;
          var d8 = mcuPinNet(L, n, 'D8'), gnd = anyGndNet(L, n);
          var sn = [L.net(s, 0), L.net(s, 1)];
          if (gnd.indexOf(sn[0]) < 0 && gnd.indexOf(sn[1]) < 0) return false;
          return L.of('resistor').some(function (r) { var rn = [L.net(r, 0), L.net(r, 1)]; return rn.indexOf(d8) >= 0 && (rn.indexOf(sn[0]) >= 0 || rn.indexOf(sn[1]) >= 0); });
        }, ok: 'Good: the resistor keeps the pin current safe.' },
        { text: 'Tap the microphone and press 👏 Clap. The speaker should beep.', check: function (L) {
          var s = L.of('speaker')[0], n = L.part('nano'); if (!s || !n.st.io) return false;
          var d8 = n.st.io.D8, pi = (n.st.pinI || {}).D8 || 0;
          if (d8 && d8.freq && Math.abs(s._i || 0) > 0.003 && pi < 0.04 && !(n.st.damaged && n.st.damaged.D8)) L.flags.beep = true;
          return !!L.flags.beep;
        }, ok: 'Beep! Sound in, sound out.' }
      ],
      explain: function (L) {
        var s = L.of('speaker')[0], n = L.part('nano');
        if (n.st.damaged && n.st.damaged.D8) return 'Pin D8 is damaged: the speaker is only 8 Ω, so without a resistor the pin gives about 150 mA. A pin gives 20 mA safely. Tap the Nano and press “New board”, then add the 220 Ω resistor.';
        return null;
      },
      hints: ['Microphone pins: AO, G, +, DO. Run wires from their columns to the Nano’s A0, GND and 5V.', 'Speaker: red wire → a column with the resistor; resistor → a column joined to D8; black wire → GND (or the − rail joined to GND).', 'Then tap the microphone and press 👏 Clap (or move its Sound slider up).'],
      done: 'The mic gives a voltage that follows the sound. A loud sound starts a tone. With 220 Ω the pin current stays near 20 mA: 5 V ÷ (220 + 8) Ω.',
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
      intro: { pic: I.esp32, text: 'The ESP32 works at 3.3V. Its pins must never get 5V. A {{voltage divider}} brings a 5V signal down to a safe level.' },
      board: { cols: 30 }, view: [-3.5, -10, 31.5, 18.6], tray: ['hcsr04', { type: 'resistor', props: { r: 1000 } }, { type: 'resistor', props: { r: 2200 } }, 'wire'],
      lock: ['r', 'program'],
      setup: function (A) { A.add('esp32', { id: 'esp', x: 6, y: 4, props: { program: 'distance' }, locked: true }); },
      steps: [
        { text: 'Put the distance sensor on the board (in a free area). Power it: VCC → USB pin (5V), GND → GND.', check: function (L) { var s = L.of('hcsr04')[0]; return s && (s.st.vcc || 0) > 4.5; }, ok: 'The sensor has 5V from the USB pin.' },
        { text: 'Connect TRIG to pin 21.', check: function (L) { var s = L.of('hcsr04')[0]; return s && s.st.trig; }, ok: 'The ESP32 now sends trigger pulses.' },
        { text: 'Connect ECHO to pin 33 safely: ECHO → 1 kΩ → middle → 2.2 kΩ → GND, and the middle → pin 33.', check: function (L) {
          var e = L.part('esp'), v = (e.st.lastV || {})['33'] || 0;
          return v > 2.5 && v < 3.6 && !(e.st.damaged && e.st.damaged['33']) && (e.st.serial || []).some(function (s) { return /^Distance/.test(s); });
        }, ok: 'Pin 33 gets about 3.3 V: safe, and still HIGH. The distance shows in the serial monitor.' }
      ],
      explain: function (L) {
        var e = L.part('esp'), v = (e.st.lastV || {})['33'] || 0;
        if (e.st.damaged && e.st.damaged['33']) return 'Pin 33 got 5 V and is damaged. On a real ESP32 this can break the chip. Tap the ESP32 and press “New board”, then use the divider.';
        if (v > 3.6) return 'Danger! Pin 33 gets ' + v.toFixed(2) + ' V. The ESP32 takes 3.3 V (3.6 V at most). Use the two resistors as a divider.';
        if (v > 0.3 && v <= 2.47) return 'Pin 33 gets only ' + v.toFixed(2) + ' V. That is too low to read as HIGH (needs 2.5 V). Check the divider: 1 kΩ on top (from ECHO), 2.2 kΩ at the bottom (to GND).';
        return null;
      },
      hints: ['USB is on the bottom row of pins. It gives 5V while the USB cable is plugged in. GND is on the top row.', 'Divider: ECHO column → 1 kΩ → a free middle column → 2.2 kΩ → − rail (joined to GND). Middle gets 5 × 2.2 ÷ 3.2 ≈ 3.4 V.', 'Then a wire from the middle column to a hole below pin 33 (bottom row).'],
      done: '5 V on a 3.3 V pin can break the chip. A 1 kΩ + 2.2 kΩ divider turns 5 V into about 3.3 V: safe and still HIGH.',
      solve: function (A) {
        A.add('hcsr04', { x: 24, y: 3 });
        A.wire('j12', 'b24'); A.wire('a9', 'T-9'); A.wire('T-27', 'b27'); A.wire('a21', 'b25'); A.wait(0.2);
        A.add('resistor', { props: { r: 1000 }, ends: ['c26', 'f26'] }); A.add('resistor', { props: { r: 2200 }, ends: ['g26', 'T-28'] }); A.wire('i16', 'h26'); A.wait(0.4);
      }
    }
  ];
  LEVELS.forEach(function (l, i) { l.n = i + 1; });

  BB.LEVELS = LEVELS;
  BB.levelHelpers = { lit: lit, safe: safe, inSeries: inSeries, whyDark: whyDark };
})();
