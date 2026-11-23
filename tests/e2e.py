"""Browser tests for breadboard-lab.html (headless Chromium, Playwright).

Run:  scripts/e2e.sh            (uses the pop-porn-shots Docker image: Playwright + Chromium)
Checks: every level can be finished, every part works in the sandbox, real pointer input
(tap, drag, pinch) works, zero console errors. Saves screenshots to shots/.
"""
import json, os, sys
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file://' + os.path.join(ROOT, 'breadboard-lab.html')
SHOTS = os.path.join(ROOT, 'shots')
os.makedirs(SHOTS, exist_ok=True)
fails, errors = [], []


def check(cond, what):
    print(('  ok   ' if cond else '  FAIL ') + what)
    if not cond:
        fails.append(what)


def new_page(browser, w, h, touch=False, scale=1):
    ctx = browser.new_context(viewport={'width': w, 'height': h}, device_scale_factor=scale, has_touch=touch, is_mobile=touch)
    page = ctx.new_page()
    page.on('console', lambda m: errors.append(f'{w}px console.{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: errors.append(f'{w}px pageerror: {e}'))
    page.goto(URL)
    page.wait_for_timeout(300)
    return page


def shot(page, name):
    page.screenshot(path=os.path.join(SHOTS, name + '.png'))


def solve_all_levels(page, tag):
    n = page.evaluate('BB.LEVELS.length')
    check(8 <= n <= 12, f'{tag}: {n} levels')
    for i in range(n):
        lid = page.evaluate(f'BB.LEVELS[{i}].id')
        page.evaluate(f'BB.app.startLevel({i})')
        page.click('#introGo')
        page.wait_for_timeout(150)
        before = page.evaluate('BB.app.level.step')
        page.evaluate(f'BB.LEVELS[{i}].solve(BB.app.actions())')
        page.wait_for_timeout(700)
        st = page.evaluate('({done: BB.app.level.done, step: BB.app.level.step, steps: BB.app.level.def.steps.length, stars: BB.app.level.stars, mistakes: BB.app.level.mistakes, issues: BB.app.sim.res.issues.map(i => i.kind)})')
        check(st['done'] and before == 0, f'{tag}: level {i + 1} "{lid}" solved (stars {st.get("stars")}, mistakes {st["mistakes"]}, issues {st["issues"]})' + ('' if st['done'] else f' — stuck at step {st["step"]}/{st["steps"]}'))
        if tag == 'mobile':
            ov = page.evaluate("(() => { const w = innerWidth; const bad = []; ['#topbar', '#tb', '#stage', '#goal'].forEach(s => { const r = document.querySelector(s).getBoundingClientRect(); if (r.right > w + 0.5) bad.push(s + ' ' + Math.round(r.right)); }); if (document.documentElement.scrollWidth > w) bad.push('page ' + document.documentElement.scrollWidth); return bad; })()")
            check(not ov, f'{tag}: level {i + 1} fits in 375 px' + (f' — overflow {ov}' if ov else ''))
        if tag == 'desktop' or i in (0, 2, 8, 11):
            page.click('#modal [data-m=stay]') if page.is_visible('#modal [data-m=stay]') else None
            page.wait_for_timeout(250)
            shot(page, f'{tag}-level{i + 1:02d}-{lid}')
        if page.is_visible('#modal'):
            page.evaluate("document.getElementById('modal').hidden = true")
    saved = page.evaluate("JSON.parse(localStorage.getItem('breadboard-lab.v1')).stars")
    check(len(saved) == n, f'{tag}: progress saved for all levels ({len(saved)})')


def sandbox_every_part(page, tag):
    page.evaluate("BB.app.showHome(); BB.app.startSandbox()")
    page.wait_for_timeout(200)
    types = page.evaluate("Object.keys(BB.PARTS)")
    for t in types:
        if t == 'wire':
            continue
        page.evaluate(f"BB.app.placeNew('{t}', {{}})")
    page.evaluate("BB.app.actions().wait(0.5)")
    page.wait_for_timeout(300)
    cnt = page.evaluate("BB.app.sim.state.parts.length")
    check(cnt == len(types) - 1, f'{tag}: sandbox has every part ({cnt})')
    # every microcontroller can run every program it offers
    progs = page.evaluate("""(() => {
      const out = []; const A = BB.app.actions();
      BB.app.sim.state.parts.filter(p => BB.PARTS[p.type].mcu).forEach(p => {
        BB.programs.ORDER.filter(id => BB.programs.available(BB.PARTS[p.type].mcu, id)).forEach(id => { A.set(p, 'program', id); A.wait(0.2); out.push(p.type + ':' + id); });
      }); return out; })()""")
    check(len(progs) >= 30, f'{tag}: ran {len(progs)} board/program pairs')
    page.evaluate("BB.app.bench.fitAll()")
    page.wait_for_timeout(200)
    shot(page, f'{tag}-sandbox-all-parts')
    # inspector opens for every part
    ok = page.evaluate("""(() => { let n = 0; BB.app.sim.state.parts.forEach(p => { BB.app.bench.select(p.id); BB.app.refreshInspector(); if (document.querySelector('#inspector h3').textContent.length) n++; }); return n; })()""")
    check(ok == cnt, f'{tag}: inspector works for every part ({ok})')
    page.evaluate("BB.app.bench.select(null)")
    # sandbox challenge: power the Nano from the MB102 rails (USB unplugged)
    page.evaluate("BB.app.sim.state.parts = []; BB.app.sim.dirty()")
    page.evaluate("""(() => { const A = BB.app.actions(); A.add('mb102', {x: 2, y: 0}); const n = A.add('nano', {x: 8, y: 5, props: {usb: false}});
      A.wire('h19', 'B+20'); A.wire('h21', 'B-21'); A.wait(0.3); })()""")
    page.wait_for_timeout(500)
    ch = page.evaluate("(JSON.parse(localStorage.getItem('breadboard-lab.v1')) || {}).challenges || {}")
    check(ch.get('nanoMB'), f'{tag}: sandbox challenge "Nano from the MB102" detected')


def ui_level3_by_pointer(page, tag):
    """Finish level 3 with real pointer input: tray taps and dragging legs."""
    if page.is_visible('#modal'):
        page.evaluate("document.getElementById('modal').hidden = true")
    page.evaluate("BB.app.startLevel(2)")
    page.click('#introGo')
    page.wait_for_selector('#play', state='visible')
    page.wait_for_timeout(200)
    if tag == 'mobile':
        page.click('#tb [data-act=parts]')
        page.wait_for_timeout(300)
    page.click('#tray .titem:nth-child(2)')  # resistor 470
    page.wait_for_timeout(200)
    if tag == 'mobile':
        page.click('#tb [data-act=parts]')
        page.wait_for_timeout(300)
    page.click('#tray .titem:nth-child(1)')  # LED
    page.wait_for_timeout(300)
    if tag == 'mobile':  # close the inspector sheet by tapping an empty area
        page.evaluate('BB.app.bench.select(null)')

    def scr(hole):
        return page.evaluate(f"(() => {{ const h = BB.app.sim.board.byId['{hole}']; const s = BB.app.bench.toScreen(h.x, h.y); const r = BB.app.bench.size(); return [s.x + r.left, s.y + r.top]; }})()")

    cdp = page.context.new_cdp_session(page) if tag == 'mobile' else None

    def drag_end(pid_expr, k, hole):
        a = page.evaluate(f"(() => {{ const p = {pid_expr}; const q = BB.app.sim.pinPoints(p)[{k}]; const s = BB.app.bench.toScreen(q.x, q.y); const r = BB.app.bench.size(); return [s.x + r.left, s.y + r.top]; }})()")
        b = scr(hole)
        if cdp:  # a real finger: touch down on the leg, slide, lift
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': a[0], 'y': a[1]}]})
            for t in range(1, 13):
                cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': a[0] + (b[0] - a[0]) * t / 12, 'y': a[1] + (b[1] - a[1]) * t / 12}]})
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        else:
            page.mouse.move(a[0], a[1]); page.mouse.down()
            for t in range(1, 11):
                page.mouse.move(a[0] + (b[0] - a[0]) * t / 10, a[1] + (b[1] - a[1]) * t / 10)
            page.mouse.up()
        page.wait_for_timeout(80)
        return page.evaluate(f"({pid_expr}).ends[{k}].at")

    R = "BB.app.sim.state.parts.find(p => p.type === 'resistor')"
    L = "BB.app.sim.state.parts.find(p => p.type === 'led')"
    l1 = drag_end(L, 0, 'c10'); l2 = drag_end(L, 1, 'T-11')
    r1 = drag_end(R, 0, 'T+10'); r2 = drag_end(R, 1, 'a10')
    check([r1, r2, l1, l2] == ['T+10', 'a10', 'c10', 'T-11'], f'{tag}: legs dragged into holes {[r1, r2, l1, l2]}')
    page.wait_for_timeout(600)
    done = page.evaluate('BB.app.level.done')
    check(done, f'{tag}: level 3 finished with pointer input')
    page.wait_for_timeout(500)
    shot(page, f'{tag}-level03-pointer-done')
    if page.is_visible('#modal [data-m=stay]'):
        page.click('#modal [data-m=stay]')


def ui_misc(page, tag):
    # level 1 by tapping holes on screen + the X-ray and choice buttons
    page.evaluate("BB.app.startLevel(0)")
    page.wait_for_timeout(200)
    shot(page, f'{tag}-intro-level01')
    page.click('#introGo')
    page.wait_for_timeout(300)
    shot(page, f'{tag}-level01-start')

    def tap_hole(h):
        x, y = page.evaluate(f"(() => {{ const o = BB.app.sim.board.byId['{h}']; const s = BB.app.bench.toScreen(o.x, o.y); const r = BB.app.bench.size(); return [s.x + r.left, s.y + r.top]; }})()")
        if tag == 'mobile':
            page.touchscreen.tap(x, y)
        else:
            page.mouse.click(x, y)
        page.wait_for_timeout(120)
    tap_hole('c4')
    page.click('#tb [data-act=xray]')
    page.wait_for_timeout(150)
    tap_hole('d8')
    page.wait_for_timeout(150)
    shot(page, f'{tag}-level01-highlight')
    check(page.evaluate("document.querySelectorAll('#goal .choices button').length") == 0, f'{tag}: level 1 answers stay locked until e8 and f8 are tapped')
    tap_hole('e8'); tap_hole('f8')
    page.wait_for_timeout(150)
    page.click('#goal .choices button:nth-child(2)')
    page.wait_for_timeout(600)
    check(page.evaluate('BB.app.level.done'), f'{tag}: level 1 finished by tapping')
    if page.is_visible('#modal'):
        shot(page, f'{tag}-level01-done-modal')
        page.click('#modal [data-m=stay]')
    # level 9: choose the program with the real menu in the inspector
    page.evaluate("BB.app.startLevel(8)"); page.click('#introGo'); page.wait_for_timeout(200)
    page.evaluate("BB.app.actions().add('nano', {x: 8, y: 5}); BB.app.actions().wait(0.1)")
    page.evaluate("BB.app.bench.select(BB.app.sim.state.parts[0].id)")
    page.wait_for_timeout(200)
    if tag == 'mobile':
        page.click('#inspector .insmore'); page.wait_for_timeout(250)
    page.select_option('#inspector select[data-prog]', 'blink')
    page.wait_for_timeout(300)
    check(page.evaluate("BB.app.sim.state.parts[0].props.program") == 'blink' and page.evaluate("BB.app.level.step") == 2, f'{tag}: program chosen with the real menu (level 9 step 2 done)')
    page.evaluate("BB.app.bench.select(null)")
    # level 8: the colour-band picker with real menus
    page.evaluate("BB.app.startLevel(7)"); page.click('#introGo'); page.wait_for_timeout(200)
    page.evaluate("const A = BB.app.actions(); A.set('m', 'mode', 'V'); A.moveEnd('m', 0, 'T+20'); A.moveEnd('m', 1, 'T-20'); A.wait(0.2); A.moveEnd('m', 0, 'c8'); A.moveEnd('m', 1, 'c12'); A.set('m', 'mode', 'A'); A.wait(0.3)")
    page.wait_for_timeout(400)
    if tag == 'mobile':
        page.evaluate("document.body.classList.remove('goalmin')")
    for k, col in enumerate(['yellow', 'violet', 'red']):
        page.select_option(f'#goal select[data-band="{k}"]', col)
    page.click('#goal .bands .primary')
    page.wait_for_timeout(300)
    check(page.evaluate("BB.app.level.step") == 3, f'{tag}: colour bands read with the picker (level 8)')
    # wire tool: tap-tap on screen makes a wire
    page.evaluate("BB.app.startLevel(1)")
    page.click('#introGo')
    page.wait_for_timeout(200)
    page.click('#tb [data-act=wire]')
    n0 = page.evaluate("BB.app.sim.state.parts.length")
    tap_hole('T+30'); tap_hole('T+32')
    n1 = page.evaluate("BB.app.sim.state.parts.length")
    check(n1 == n0 + 1, f'{tag}: wire tool made a wire by two taps')
    # zoom with the wheel (desktop) / buttons
    s0 = page.evaluate("BB.app.bench.view.s")
    page.click('#zoom [data-z=in]')
    s1 = page.evaluate("BB.app.bench.view.s")
    check(s1 > s0, f'{tag}: zoom in button works')
    # current overlay
    page.evaluate("BB.app.startLevel(2)"); page.click('#introGo'); page.wait_for_timeout(100)
    page.evaluate("BB.LEVELS[2].solve(BB.app.actions())")
    page.wait_for_timeout(500)
    if page.is_visible('#modal [data-m=stay]'):
        page.click('#modal [data-m=stay]')
    page.click('#tb [data-act=flow]')
    page.wait_for_timeout(400)
    nflow = page.evaluate("document.querySelectorAll('.flow path').length")
    nlab = page.evaluate("document.querySelectorAll('.vlabels g').length")
    check(nflow >= 6 and nlab >= 3, f'{tag}: current animation ({nflow} paths) and voltage tags ({nlab})')
    page.evaluate("BB.app.bench.select(BB.app.sim.state.parts.find(p=>p.type==='led').id)")
    page.wait_for_timeout(400)
    shot(page, f'{tag}-level03-current')


def pinch(page):
    page.evaluate("BB.app.bench.select(null)")
    page.wait_for_timeout(300)
    s0 = page.evaluate("BB.app.bench.view.s")
    r = page.evaluate("(() => { const b = document.getElementById('bench').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()")
    cx, cy = r
    cdp = page.context.new_cdp_session(page)
    def touch(kind, pts):
        cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [{'x': x, 'y': y, 'id': i} for i, (x, y) in enumerate(pts)]})
    touch('touchStart', [(cx - 30, cy), (cx + 30, cy)])
    for k in range(1, 8):
        touch('touchMove', [(cx - 30 - k * 10, cy), (cx + 30 + k * 10, cy)])
    touch('touchEnd', [])
    page.wait_for_timeout(100)
    s1 = page.evaluate("BB.app.bench.view.s")
    check(s1 > s0 * 1.5, f'mobile: pinch zoom ({s0:.2f} → {s1:.2f})')


def touch_targets(page, tag):
    small = page.evaluate("""(() => { const out = [];
      document.querySelectorAll('#play button, #home button, #intro button').forEach(b => {
        if (b.closest('[hidden]') || b.classList.contains('term')) return;
        const r = b.getBoundingClientRect(); if (!r.width) return;
        if (r.width < 43.5 || r.height < 43.5) out.push((b.className || b.textContent).slice(0, 30) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
      }); return out; })()""")
    check(not small, f'{tag}: buttons are at least 44 px' + (f' — too small: {small[:6]}' if small else ''))


with sync_playwright() as pw:
    browser = pw.chromium.launch()
    # desktop
    page = new_page(browser, 1440, 900)
    page.evaluate("localStorage.clear()"); page.reload(); page.wait_for_timeout(300)
    shot(page, 'desktop-home')
    touch_targets(page, 'desktop home')
    solve_all_levels(page, 'desktop')
    page.evaluate("BB.app.showHome()"); page.wait_for_timeout(200)
    shot(page, 'desktop-home-done')
    sandbox_every_part(page, 'desktop')
    ui_misc(page, 'desktop')
    ui_level3_by_pointer(page, 'desktop')
    touch_targets(page, 'desktop play')
    # storage that throws must not break the game
    page.evaluate("Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } })")
    page.evaluate("BB.store.save(); BB.store.load(); BB.app.showHome()")
    check(page.is_visible('#home'), 'desktop: game keeps working when storage is blocked')
    page.context.close()
    # mobile
    page = new_page(browser, 375, 812, touch=True, scale=2)
    page.evaluate("localStorage.clear()"); page.reload(); page.wait_for_timeout(300)
    shot(page, 'mobile-home')
    touch_targets(page, 'mobile home')
    solve_all_levels(page, 'mobile')
    ui_misc(page, 'mobile')
    pinch(page)
    ui_level3_by_pointer(page, 'mobile')
    touch_targets(page, 'mobile play')
    sandbox_every_part(page, 'mobile')
    page.evaluate("BB.app.bench.select(BB.app.sim.state.parts.find(p => p.type === 'nano').id)")
    page.wait_for_timeout(300)
    shot(page, 'mobile-sandbox-inspector')
    page.context.close()
    browser.close()

real_errors = [e for e in errors if 'blocked' not in e]
check(not real_errors, f'zero console errors ({len(real_errors)})')
for e in real_errors[:20]:
    print('   ', e)
print(f'\n{len(fails)} failed')
sys.exit(1 if fails else 0)
