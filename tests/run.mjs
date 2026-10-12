// FloorPlan Studio regression tests.  Run from the project root:   npm --prefix tests install && npm --prefix tests test
// Builds the app with a test hook, serves it locally, drives it in headless Chromium and checks the things that must never break.
// Optional: DWG_FIXTURE=/path/to/file.dwg  also tests DWG import on a real file.
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const failures = [];
async function test(name, fn) {
  try { await fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; failures.push(name); console.log('  FAIL ' + name + '\n         ' + (e && e.message || e)); }
}
function ok(c, msg) { if (!c) throw new Error(msg || 'assertion failed'); }
function near(a, b, tol, msg) { if (!(Math.abs(a - b) <= tol)) throw new Error((msg || 'value') + ': expected ' + b + ' ±' + tol + ', got ' + a); }

/* ---- 1. build + static checks (no browser) ---- */
console.log('Build and files');
const b = spawnSync('node', ['build.mjs', '--test'], { cwd: root, encoding: 'utf8' });
await test('app builds from src/app', () => ok(b.status === 0, b.stderr || b.stdout));
const c = spawnSync('node', ['build.mjs', '--check'], { cwd: root, encoding: 'utf8' });
await test('private/app.html is up to date with src/app', () => ok(c.status === 0, c.stderr));
await test('server code has no syntax errors', () => {
  for (const f of readdirSync(join(root, 'api'))) {
    const r = spawnSync('node', ['--check', join(root, 'api', f)], { encoding: 'utf8' });
    ok(r.status === 0, f + ': ' + r.stderr);
  }
});
await test('vercel.json and package.json are valid JSON', () => {
  JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')); JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
});
await test('vendor files are present', () => {
  for (const f of ['dxf-parser.js', 'libredwg/dist/libredwg-web.js', 'libredwg/wasm/libredwg-web.js', 'libredwg/wasm/libredwg-web.wasm', 'leaflet.js'])
    ok(existsSync(join(root, 'public/vendor', f)) && statSync(join(root, 'public/vendor', f)).size > 1000, 'missing public/vendor/' + f);
});
await test('app is served only through the sign-in gate', () => {
  ok(!existsSync(join(root, 'public', 'app.html')), 'app.html must not be in public/');
});

/* ---- 2. local server ---- */
const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.wasm': 'application/wasm', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const server = createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  let f = null;
  if (u === '/test.html') f = join(root, '.test-build', 'test.html');
  else if (u.startsWith('/vendor/') || u === '/impi-logo.png') f = join(root, 'public', u);
  else if (u.startsWith('/api/')) { res.writeHead(404); return res.end(); } // no cloud in tests: the app must work offline
  if (f && existsSync(f)) { res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); return res.end(readFileSync(f)); }
  res.writeHead(404); res.end();
});
await new Promise(r => server.listen(0, r));
const base = 'http://localhost:' + server.address().port;

const launch = { headless: true };
if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
else if (existsSync('/opt/pw-browsers/chromium')) launch.executablePath = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(launch);

async function fresh() {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  page.errs = [];
  page.on('pageerror', e => page.errs.push(String(e)));
  await page.route('**/*', r => r.request().url().startsWith(base) ? r.continue() : r.abort());
  await page.goto(base + '/test.html');
  try{await page.waitForFunction(() => window.__T,null,{timeout:8000})}catch(e){throw new Error('app did not start. Script errors: '+page.errs.join(' | '))}
  await page.evaluate(() => { const w = document.getElementById('welcome'); if (w) w.style.display = 'none'; });
  page.close2 = () => ctx.close();
  return page;
}
const ADD = `window.add=(arm,x,y,ex)=>{const T=__T,o=T.makeAt(arm,{x,y});Object.assign(o,ex||{});return T.addObj(o)};`;
/* a plan that should pass every readiness rule */
const GOOD = `()=>{${ADD}const T=__T;add('item:marq10',0,0);add('item:marq10',14,0);
 [[-5,0,-90],[5,0,90],[9,0,-90],[19,0,90]].forEach(a=>add('door:exit',a[0],a[1],{rot:a[2]}));
 [[0,0],[14,0]].forEach(a=>{add('sign:fire_ext',a[0]+3,a[1]+3);add('sign:exit_box',a[0]+5,a[1]);add('sign:exit_box',a[0]-5,a[1])});
 add('sign:first_aid',7,8);add('sign:assembly',7,60);
 T.addObj({t:'poly',pts:[{x:-15,y:-15},{x:35,y:-15},{x:35,y:70},{x:-15,y:70}],site:1,label:'Event site'});
 const m=T.S.meta;m.attend=150;m.tstart='10:00';m.tend='18:00';}`;
/* a plan with deliberate problems */
const BAD = `()=>{${ADD}const T=__T;add('item:marq10',0,0);add('item:marq10',11,0);add('item:marq1020',40,0);
 add('door:exit',0,5);add('door:exit',45,0,{w:0.9});T.S.meta.attend=800;}`;

console.log('\nApp in the browser');
let page = await fresh();
await test('loads with no script errors', async () => { ok(page.errs.length === 0, page.errs.join(' | ')); ok(await page.evaluate(() => __T.S.objs.length === 0)); });

await test('undo and redo', async () => {
  const r = await page.evaluate(`(()=>{${ADD}const T=__T;add('item:marq10',0,0);const a=T.S.objs.length;T.undo();const b=T.S.objs.length;T.redo();return [a,b,T.S.objs.length]})()`);
  ok(r[0] === 1 && r[1] === 0 && r[2] === 1, JSON.stringify(r));
});

await test('crowd capacity maths', async () => {
  const r = await page.evaluate(`(()=>{const T=__T;T.S.meta.attend=300;const C=T.crowdAll();return {cap:C.total,over:C.over}})()`);
  ok(r.cap === 100, 'a 10x10 marquee at 1 m2/person should hold 100, got ' + r.cap);
  ok(r.over === true, 'attendance 300 should be flagged over 100');
});
await page.close2();

page = await fresh();
await test('readiness check: a deliberately bad plan is flagged', async () => {
  await page.evaluate(`(${BAD})()`);
  const f = await page.evaluate(() => __T.rdyRun().filter(x => x.sev === 'fail').map(x => x.cat + '|' + x.msg));
  const has = s => f.some(x => x.includes(s));
  ok(has('Tent spacing'), 'tent spacing not flagged');
  ok(has('Assembly point'), 'missing assembly point not flagged');
  ok(has('Fire equipment') || has('fire extinguisher'), 'missing fire equipment not flagged');
  ok(has('narrower than'), 'narrow exit not flagged');
  ok(has('more than the planned capacity'), 'over capacity not flagged');
  ok(has('First aid'), 'missing first aid not flagged');
});
await page.close2();

page = await fresh();
await test('readiness check: a correct plan has no problems', async () => {
  await page.evaluate(`(${GOOD})()`);
  const f = await page.evaluate(() => __T.rdyRun().filter(x => x.sev === 'fail' || x.sev === 'warn').map(x => x.msg));
  ok(f.length === 0, f.join(' | '));
});

await test('evacuation routes generate', async () => {
  const n = await page.evaluate(() => { try { __T.genEvac(); } catch (e) { return 'ERR ' + e.message; } return __T.S.objs.filter(o => o.ev).length; });
  ok(typeof n === 'number' && n > 0, 'no evacuation routes were generated: ' + n);
});

{ const pg2 = await fresh(); const _p = page; page = pg2; await test('dog-leg exit: square corners, festival size, door at the end', async () => {
  const r = await page.evaluate(() => {
    const T = __T; T.S.objs = [{ t: 'line', id: 'w1', pts: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 20 }, { x: 0, y: 20 }], closed: true, style: 'fence' }]; T.S.dogId = 'w1';
    T.dogTap({ x: 15, y: 0.05 });
    document.getElementById('dl_p').value = 'f'; document.getElementById('dl_p').onchange(); document.getElementById('dl_c').value = 'q'; document.getElementById('mo').click();
    const lines = T.S.objs.filter(o => o.t === 'line'), door = T.S.objs.find(o => o.t === 'door');
    let diag = 0; lines.forEach(l => { for (let i = 0; i < l.pts.length - 1; i++) { const dx = Math.abs(l.pts[i + 1].x - l.pts[i].x), dy = Math.abs(l.pts[i + 1].y - l.pts[i].y); if (dx > 1e-6 && dy > 1e-6) diag++; } });
    return { n: lines.length, diag, door: door && door.k, w: door && door.w };
  });
  ok(r.n === 3, 'expected the wall plus two passage walls, got ' + r.n);
  ok(r.diag === 0, r.diag + ' diagonal segments (square corners expected)');
  ok(r.door === 'eexit' && r.w === 3, 'door ' + JSON.stringify(r));
});
  await pg2.close2(); page = _p; }
{ const pg3 = await fresh(); const _q = page; page = pg3; await test('truss: draws, is not counted as floor space, exports on its own layer', async () => {
  const r = await page.evaluate(() => { const T = __T, add = (a, x, y) => T.addObj(T.makeAt(a, { x, y }));
    add('item:marq10', 0, 0); const before = T.crowdAll().total;
    add('item:truss66', 0, 0); T.addObj({ t: 'line', style: 'truss', pts: [{ x: 20, y: 0 }, { x: 26, y: 0 }], closed: false });
    return { before, after: T.crowdAll().total, dxf: T.buildDxf(T.S.objs, 1000, 4).txt.includes('FPS-TRUSS'), errs: 0 }; });
  ok(r.before === r.after, 'truss changed the capacity: ' + JSON.stringify(r)); ok(r.dxf, 'FPS-TRUSS layer missing from the DXF');
  ok(page.errs.length === 0, page.errs.join(' | '));
});
  await pg3.close2(); page = _q; }
{ const pg4 = await fresh(); const _r = page; page = pg4;
await test('crowd: open ground counts inside an event site boundary, with a warning until one is set', async () => {
  const r = await page.evaluate(() => { const T = __T, add = (a, x, y) => T.addObj(T.makeAt(a, { x, y }));
    add('item:marq10', 10, 10); T.S.meta.attend = 3500; const a = T.crowdAll();
    T.addObj({ t: 'poly', pts: [{ x: -10, y: -10 }, { x: 80, y: -10 }, { x: 80, y: 70 }, { x: -10, y: 70 }], site: 1, label: 'Event site' }); const b = T.crowdAll();
    return { warn: a.warn.length, before: a.total, after: b.total, open: b.open && b.open.free, units: b.units.length }; });
  ok(r.warn === 1 && r.before === 100, 'no-boundary case: ' + JSON.stringify(r));
  ok(r.after > 7000 && r.units === 1, 'site boundary not counted: ' + JSON.stringify(r));
});
await test('crowd: typed event area counts open ground with no boundary drawn (existing fencing)', async () => {
  const r = await page.evaluate(() => { const T = __T; T.S.objs = []; T.addObj(T.makeAt('item:marq10', { x: 10, y: 10 })); T.S.meta.attend = 3500; T.S.meta.siteArea = 0;
    const a = T.crowdAll(); T.S.meta.siteArea = 5000; const b = T.crowdAll(); const f = T.rdyRun().filter(x => /No event site area/.test(x.msg)).length;
    return { aw: a.warn.length, ao: !!a.open, bo: b.open && b.open.cap, bsrc: b.open && b.open.src, bw: b.warn.length, f }; });
  ok(r.aw === 1 && !r.ao, 'no area: ' + JSON.stringify(r));
  ok(r.bo > 4000 && r.bsrc === 'typed' && r.bw === 0 && r.f === 0, 'typed area: ' + JSON.stringify(r));
});
await test('crowd: total never exceeds the venue certified capacity', async () => {
  const r = await page.evaluate(() => { const T = __T; T.S.objs = []; T.S.meta.siteArea = 9000; T.S.meta.attend = 7000; T.S.meta.certCap = 0; const a = T.crowdAll(); T.S.meta.certCap = 6000; const b = T.crowdAll(); T.S.meta.certCap = 0; T.S.meta.siteArea = 0; return { a: a.total, b: b.total, c: b.capped, o: b.over }; });
  ok(r.a === 9000 && r.b === 6000 && r.c && r.o, JSON.stringify(r));
});
await test('crowd window: the Set button and the Sheet-tab fields really change the crowd figure', async () => {
  await page.evaluate(() => { const T = __T; T.S.objs = []; T.S.meta.siteArea = 0; T.S.meta.certCap = 0; T.S.meta.attend = 7000; T.addObj(T.makeAt('item:marq10', { x: 10, y: 10 })); });
  await page.click('#tabs button[data-tab="sheet"]');
  await page.fill('#m_sitearea', '9000'); await page.press('#m_sitearea', 'Tab');
  const a = await page.evaluate(() => __T.crowdAll().total); ok(a === 9000, 'Sheet-tab area gave ' + a);
  await page.click('[data-act="crowd"]'); await page.fill('#cm_sitearea', '12000'); await page.fill('#cm_cert', '5500'); await page.click('#modal [data-act="sitearea"]');
  const b = await page.evaluate(() => ({ t: __T.crowdAll().total, m: __T.S.meta.siteArea, txt: document.getElementById('modal').innerText }));
  ok(b.t === 5500 && b.m === 12000 && /certified 5,500/.test(b.txt), 'modal Set gave ' + JSON.stringify([b.t, b.m]));
  await page.click('#modal #mc'); await page.evaluate(() => { __T.S.meta.siteArea = 0; __T.S.meta.certCap = 0; });
});
await test('crowd: an event area smaller than the structures is flagged, not silently zero', async () => {
  const r = await page.evaluate(() => { const T = __T; T.S.objs = []; T.addObj(T.makeAt('item:marq10', { x: 10, y: 10 })); T.S.meta.attend = 500; T.S.meta.siteArea = 50; const c = T.crowdAll(); const f = T.rdyRun().some(x => /no bigger than the structures/.test(x.msg)); T.S.meta.siteArea = 0; return { w: c.warn.some(x => /no bigger than the floor space/.test(x)), f }; });
  ok(r.w && r.f, JSON.stringify(r));
});
await test('map: inserting with a straighten angle rotates the layer and keeps it centred', async () => {
  const r = await page.evaluate(() => { const T = __T; T.S.layers = []; T.S.objs = [];
    const cn = document.createElement('canvas'); cn.width = 400; cn.height = 200; T.addMapLayer(cn, 0.5, { lat: -25.7, lon: 28.2 }, -12.5);
    const L = T.S.layers[0]; return { rot: L.rot }; });
  ok(r.rot === -12.5, JSON.stringify(r));
});
await test('map window: the Straighten control turns the guide grid', async () => {
  await page.evaluate(() => __T.openMap()); await page.waitForSelector('#mprotn', { timeout: 8000 });
  await page.fill('#mprotn', '17'); await page.press('#mprotn', 'Tab');
  const g = await page.evaluate(() => ({ t: document.getElementById('mpgrid').style.transform, r: document.getElementById('mprot').value }));
  await page.keyboard.press('Escape');
  ok(/rotate\(17deg\)/.test(g.t) && g.r === '17', JSON.stringify(g));
});
await test('calibration: distances typed the way plans print them are understood', async () => {
  const r = await page.evaluate(() => ['80600', '80600 mm', '80.6 m', '80,6m', '80 600', '107.9', '250', '5 cm', '2.5km', 'abc', '', '0'].map(v => __T.parseDist(v)));
  const want = [80.6, 80.6, 80.6, 80.6, 80.6, 107.9, 250, 0.05, 2500, NaN, NaN, NaN];
  r.forEach((v, i) => ok((isNaN(want[i]) && isNaN(v)) || Math.abs(v - want[i]) < 1e-9, 'case ' + i + ': got ' + v + ' want ' + want[i]));
});
await test('pencil snap: centres on the line, slides along it, stops at its end, finds corners', async () => {
  const r = await page.evaluate(() => { const T = __T; T.S.layers = []; T.S.objs = []; T.S.view = { x: 400, y: 300, z: 40 };
    const cn = document.createElement('canvas'); cn.width = 600; cn.height = 400; const c = cn.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, 600, 400); c.fillStyle = '#000';
    c.fillRect(100, 99, 300, 4);   /* horizontal line, 4 px thick, centre y = 101 */
    c.fillRect(100, 99, 4, 200);   /* vertical line down from the left end (corner at 102,101) */
    T.S.layers.push({ id: 1, name: 'p', kind: 'plan', img: cn, mpp: 0.1, x: 0, y: 0, rot: 0, op: 1, blend: 'multiply', cal: true, vis: true });
    const px = (x, y) => ({ x: (x + .5) * 0.1, y: (y + .5) * 0.1 });
    const on = T.underlaySnap({ x: px(250, 104).x, y: px(250, 104).y });          /* 3 px below the line, mid-way along */
    const end = T.underlaySnap({ x: px(402, 101).x, y: px(402, 101).y });          /* just beyond the right end of the line */
    const cor = T.underlaySnap({ x: px(105, 104).x, y: px(105, 104).y });          /* near the corner */
    return { on, end, cor }; });
  ok(r.on && Math.abs(r.on.y - 10.1) < 0.06 && Math.abs(r.on.x - 25.05) < 0.12, 'on-line: ' + JSON.stringify(r.on));
  ok(r.end && Math.abs(r.end.x - 39.95) < 0.2 && Math.abs(r.end.y - 10.1) < 0.15, 'line end: ' + JSON.stringify(r.end));
  ok(r.cor && r.cor.j && Math.abs(r.cor.x - 10.2) < 0.08 && Math.abs(r.cor.y - 10.1) < 0.08, 'corner: ' + JSON.stringify(r.cor));
});
await test('ortho: a segment being drawn is held to the plan axes', async () => {
  const r = await page.evaluate(() => { const T = __T; T.S.layers = []; T.S.ortho = true; T.S.tmp = { t: 'line', pts: [{ x: 10, y: 10 }], style: 'wall' };
    const a = T.orthoFix({ x: 30, y: 11.5 }), b = T.orthoFix({ x: 10.8, y: 40 }); T.S.ortho = false; T.S.tmp = null; return { a, b }; });
  ok(r.a.y === 10 && r.a.x === 30 && r.b.x === 10 && r.b.y === 40, JSON.stringify(r));
});
await test('crisp lines: paper goes transparent, ink stays solid', async () => {
  const r = await page.evaluate(() => { const T = __T; const cn = document.createElement('canvas'); cn.width = 20; cn.height = 20; const c = cn.getContext('2d'); c.fillStyle = '#fafafa'; c.fillRect(0, 0, 20, 20); c.fillStyle = '#666'; c.fillRect(5, 5, 4, 4);
    const out = T.crispOf({ img: cn, kind: 'plan' }); const d = out.getContext('2d').getImageData(0, 0, 20, 20).data; return { paper: d[3], ink: d[(6 * 20 + 6) * 4 + 3] }; });
  ok(r.paper === 0 && r.ink === 255, JSON.stringify(r));
});
await test('plan symbols: red, green and yellow markers are found, the legend frame is ignored', async () => {
  const r = await page.evaluate(() => { const T = __T; const cn = document.createElement('canvas'); cn.width = 1000; cn.height = 600; const c = cn.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, 1000, 600);
    c.fillStyle = '#e02020'; c.fillRect(100, 100, 24, 24); c.fillStyle = '#fff'; c.fillRect(108, 106, 8, 12);       /* extinguisher square with white glyph, 1.2 m */
    c.fillStyle = '#0a9a40'; c.fillRect(300, 100, 30, 12); c.fillRect(340, 98, 12, 24);                           /* exit label and arrow: one exit */
    c.fillStyle = '#f2d800'; c.fillRect(500, 100, 22, 22);
    c.strokeStyle = '#e02020'; c.lineWidth = 6; c.strokeRect(600, 300, 380, 280); c.fillStyle = '#e02020'; c.fillRect(640, 340, 24, 24);   /* legend frame with an icon inside */
    const res = T.detectSymbols({ img: cn, mpp: 0.05, x: 0, y: 0, rot: 0 }); const n = { 1: 0, 2: 0, 3: 0 }; res.forEach(o => n[o.k]++); return n; });
  ok(r[1] === 1 && r[2] === 1 && r[3] === 1, JSON.stringify(r));
});
await test('new EXIT sign draws, and the pencil/ortho/venue buttons toggle', async () => {
  const r = await page.evaluate(() => { const T = __T; const cn = document.createElement('canvas'); cn.width = 200; cn.height = 100; const c = cn.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, 200, 100); c.translate(100, 50); c.scale(150, 150); T.drawSign(c, 'exit_sign', 1);
    const d = c.getImageData ? null : null; const g = cn.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); const px = g.getImageData(60, 50, 1, 1).data; return { g: px[1] > px[0] + 40 && px[1] > 100 }; });
  ok(r.g, 'sign is not green');
  await page.click('#tools [data-act="pencil"]'); await page.click('#tools [data-act="ortho"]');
  const st = await page.evaluate(() => ({ p: __T.S.pencil, o: __T.S.ortho, tool: __T.S.tool })); ok(st.p === true && st.o === true && st.tool === 'line', JSON.stringify(st));
  await page.click('#tools [data-act="pencil"]'); await page.click('#tools [data-act="ortho"]');
});
await test('venue: a new event keeps venue objects only and starts a separate plan', async () => {
  const r = await page.evaluate(() => { const T = __T; T.S.objs = []; T.S.meta.event = 'Old event'; T.S.meta.attend = 900;
    const a = T.addObj({ t: 'line', style: 'wall', pts: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }); a.vn = 1; T.addObj(T.makeAt('item:marq10', { x: 20, y: 20 }));
    T.venueNewEvent(); return { n: T.S.objs.length, vn: T.S.objs.every(o => o.vn), ev: T.S.meta.event, att: T.S.meta.attend }; });
  ok(r.n === 1 && r.vn && !r.ev && !r.att, JSON.stringify(r));
});
await test('stanchions and rope: four styles, posts at set spacing, VIP enclosures in the library', async () => {
  const r = await page.evaluate(() => { const T = __T, out = {};
    const cn = document.createElement('canvas'); cn.width = 400; cn.height = 100; const c = cn.getContext('2d'); c.setTransform(30, 0, 0, 30, 10, 50);
    ['stanchion', 'velvet', 'belt', 'ropepole'].forEach(k => { out[k] = T.ropePoles(c, [{ x: 0, y: 0 }, { x: 10, y: 0 }], k, {}); });
    out.sp3 = T.ropePoles(c, [{ x: 0, y: 0 }, { x: 9, y: 0 }], 'stanchion', { sp: 3 });
    out.inLines = ['stanchion', 'velvet', 'belt', 'ropepole'].every(k => T.LINES.some(l => l.k === k));
    out.items = ['vip_a', 'vip_b', 'vip_out', 'rope_sq'].every(k => T.LIBM && T.LIBM[k] || true);
    const px = c.getTransform ? null : null; const d = cn.getContext('2d'); d.setTransform(1, 0, 0, 1, 0, 0); const data = d.getImageData(0, 0, 400, 100).data; let ink = 0; for (let i = 3; i < data.length; i += 4) if (data[i] > 0) ink++; out.ink = ink;
    T.S.objs = []; const ob = T.addObj(T.makeAt('item:vip_a', { x: 5, y: 5 })); out.vip = ob.w === 4; return out; });
  ok(r.stanchion === 6 && r.velvet === 6 && r.belt === 6 && r.ropepole === 5 && r.sp3 === 4, 'posts: ' + JSON.stringify(r));
  ok(r.inLines && r.ink > 300 && r.vip, JSON.stringify(r));
});
await test('perimeter: gaps split the fence into runs, lengths and remapping are right', async () => {
  const r = await page.evaluate(() => { const T = __T, out = {};
    const o = { t: 'line', style: 'fence', pts: [{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}], closed: true, gaps: [1] };
    const rn = T.lineRuns(o); out.runs = rn.runs.length; out.gaps = rn.gaps.length; out.glen = T.gapLen(o);
    out.fenced = T.lineLen(o); out.all = T.lineLenAll(o);
    const ga = T.gapArr(o); T.gapsInsert(ga, 1); out.ins = ga.join('');
    const o2 = { t: 'line', pts: [{x:0,y:0},{x:5,y:0},{x:10,y:0},{x:15,y:0}], gaps: [1] }; const g2 = T.gapsRemove(o2, T.gapArr(o2), 1); out.rem = g2.join('');
    const cn = document.createElement('canvas'); cn.width = 300; cn.height = 300; const c = cn.getContext('2d'); c.setTransform(10,0,0,10,10,10);
    let err = null; try { T.drawLineObj(c, o, false); T.drawLineObj(c, Object.assign({}, o, { segl: 1 }), false); } catch (e) { err = String(e); } out.err = err; return out; });
  ok(r.gaps === 1 && Math.abs(r.glen - 10) < 1e-6 && Math.abs(r.fenced - 30) < 1e-6 && Math.abs(r.all - 40) < 1e-6, JSON.stringify(r));
  ok(r.ins === '01100' && !r.err && r.rem === '10', JSON.stringify(r));
});
await test('perimeter tool: clicking along a fence with a gap and closing makes one measured perimeter in the legend', async () => {
  await page.evaluate(() => { const T = __T; T.S.objs = []; T.S.layers = []; T.S.tab = 'lib'; T.togglePerim(); });
  const pts = [[0,0],[8,0],[8,6],[0,6]];
  const box = await page.evaluate(() => { const b = document.querySelector('canvas').getBoundingClientRect(); return { l: b.left, t: b.top }; });
  const scr = await page.evaluate((pp) => pp.map(p => { const s = __T.w2s({ x: p[0], y: p[1] }); return [s.x, s.y]; }), pts);
  const click = async (xy) => { await page.mouse.move(box.l + xy[0], box.t + xy[1]); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(40); };
  await click(scr[0]); await click(scr[1]);
  await page.evaluate(() => __T.toggleGap());
  await click(scr[2]); await click(scr[3]);
  await page.evaluate(() => __T.toggleGap());
  await click(scr[0]);
  const o = await page.evaluate(() => { const T = __T, l = T.S.objs.filter(x => x.t === 'line')[0]; const lg = T.legendData().filter(e => e.g === 'Perimeter'); return { n: T.S.objs.length, l: l && { c: l.closed, g: l.gaps, p: l.perim, np: l.pts.length }, lg: lg.map(e => e.name + '=' + e.q) }; });
  ok(o.n === 1 && o.l && o.l.c && o.l.p && o.l.np === 4, JSON.stringify(o));
  ok(o.l.g && o.l.g.length === 2 && o.l.g.indexOf(1) >= 0 && o.l.g.indexOf(3) >= 0, JSON.stringify(o));
  ok(/fenced\)=16 m/.test(o.lg.join('|')) && /Total perimeter incl\. gaps=28 m/.test(o.lg.join('|')), JSON.stringify(o));
});
await test('boom gate, sliding gate and stairs draw and are marked passable', async () => {
  const r = await page.evaluate(() => { const T = __T, out = {}; T.S.objs = [];
    ['boom4','boom6','sgate4','sgate6','stairs_s','stairs_m','stairs_l'].forEach(k => { const o = T.addObj(T.makeAt('item:' + k, { x: 5, y: 5 }));
      const cn = document.createElement('canvas'); cn.width = 200; cn.height = 200; const c = cn.getContext('2d'); c.setTransform(10,0,0,10,100,100);
      try { T.drawItem(c, o, false); } catch (e) { out.err = k + ' ' + e; }
      const d = c.getImageData(0,0,200,200).data; let ink = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) ink++; out[k] = ink; });
    out.ps = ['boom4','sgate4','stairs_m'].every(k => T.LIBM[k].ps === 1); return out; });
  ok(!r.err && r.ps && ['boom4','boom6','sgate4','sgate6','stairs_s','stairs_m','stairs_l'].every(k => r[k] > 20), JSON.stringify(r));
});
await test('stand shows name, size and number; number-only and name-only stands draw without errors', async () => {
  const r = await page.evaluate(() => { const T = __T, out = {}; T.S.objs = [];
    const mk = (ex, rot) => { const o = T.addObj(T.makeAt('item:stand33', { x: 5, y: 5 })); Object.assign(o, ex, { rot: rot || 0 }); return o; };
    T.setR(60, 1);
    const ink = (o) => { const cn = document.createElement('canvas'); cn.width = 300; cn.height = 300; const c = cn.getContext('2d'); c.setTransform(60, 0, 0, 60, 150, 150);
      try { T.drawItem(c, o, false); } catch (e) { out.err = String(e); } const d = c.getImageData(0, 0, 300, 300).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] && d[i] < 90 && d[i + 1] < 90) n++; return n; };
    const a = mk({}), b = mk({ label: 'B02' }), c2 = mk({ label: 'B02', sname: 'Rotho-blaas' }), d2 = mk({ label: 'B02', sname: 'Rotho-blaas' }, 180), e = mk({ label: 'B02', sname: 'X' }, 90);
    out.a = ink(a); out.b = ink(b); out.c = ink(c2); out.d = ink(d2); out.e = ink(e); return out; });
  ok(!r.err && r.b > r.a && r.c > r.b && r.d > r.b && r.e > r.a, JSON.stringify(r));
});
await test('Stand names dialog: names added after numbering, saved, and cleared when blank', async () => {
  await page.evaluate(() => { const T = __T; T.S.objs = []; ['A1','A2','A10'].forEach((l, i) => { const o = T.addObj(T.makeAt('item:stand33', { x: i * 4, y: 0 })); o.label = l; }); T.S.tab = 'sheet'; });
  await page.evaluate(() => document.querySelector('[data-tab="sheet"]').click());
  await page.waitForSelector('[data-act="stnames"]');
  await page.click('[data-act="stnames"]');
  await page.waitForSelector('[data-nm]');
  const order = await page.evaluate(() => [...document.querySelectorAll('[data-sn]')].map(b => b.textContent));
  ok(order.join() === 'A1,A2,A10', 'order ' + order);
  await page.fill('[data-nm="0"]', 'Rothoblaas'); await page.fill('[data-nm="2"]', 'Acme');
  await page.click('#mo');
  let r = await page.evaluate(() => __T.S.objs.map(o => o.label + ':' + (o.sname || '')).join('|'));
  ok(r === 'A1:Rothoblaas|A2:|A10:Acme', r);
  await page.click('[data-act="stnames"]'); await page.waitForSelector('[data-nm]');
  await page.fill('[data-nm="0"]', ''); await page.click('#mo');
  r = await page.evaluate(() => __T.S.objs.map(o => o.label + ':' + (o.sname || '')).join('|'));
  ok(r === 'A1:|A2:|A10:Acme', r);
});
await test('auto-trace: outline and walls come out of a synthetic plan at the right size', async () => {
  const r = await page.evaluate(() => { const T = __T;
    const cn = document.createElement('canvas'); cn.width = 1200; cn.height = 800; const c = cn.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, 1200, 800); c.strokeStyle = '#000'; c.fillStyle = '#000';
    c.lineWidth = 3; c.strokeRect(8, 8, 1184, 784);                       /* page frame */
    c.lineWidth = 8; c.beginPath(); c.moveTo(100, 100); c.lineTo(500, 100); c.moveTo(520, 100); c.lineTo(1100, 100); c.lineTo(1100, 700); c.lineTo(100, 700); c.lineTo(100, 96); c.stroke(); /* 1 m doorway in top wall */
    c.lineWidth = 6; c.beginPath(); c.moveTo(600, 100); c.lineTo(600, 390); c.moveTo(600, 410); c.lineTo(600, 700); c.moveTo(100, 400); c.lineTo(600, 400); c.stroke();
    c.font = '40px sans-serif'; c.fillText('HALL 1', 300, 250); c.fillRect(800, 300, 20, 20); c.fillRect(900, 500, 30, 12);
    const L = { img: cn, mpp: 0.05, x: 0, y: 0, rot: 0, kind: 'plan', cal: true, op: 1, vis: true };
    const res = T.traceVenue(L, {});
    const o = res.outlines[0]; let ar = 0; if (o) for (let i = 0; i < o.pts.length; i++) { const a = o.pts[i], b = o.pts[(i + 1) % o.pts.length]; ar += a.x * b.y - b.x * a.y; }
    const xs = o ? o.pts.map(p => p.x) : [0], ys = o ? o.pts.map(p => p.y) : [0];
    return { n: res.outlines.length, np: o && o.pts.length, area: Math.abs(ar / 2), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), walls: res.walls.map(w => [w.a.x, w.a.y, w.b.x, w.b.y].map(v => +v.toFixed(1))) }; });
  ok(r.n === 1 && r.np === 4, JSON.stringify(r));
  ok(Math.abs(r.w - 50.4) < 0.8 && Math.abs(r.h - 30.4) < 0.8, JSON.stringify(r));
  ok(r.walls.length >= 3 && r.walls.length <= 6, JSON.stringify(r));
});
await test('auto-trace: result is placed as venue lines, fades the plan, and one undo removes it', async () => {
  const r = await page.evaluate(() => { const T = __T; T.S.objs = [];
    const cn = document.createElement('canvas'); cn.width = 800; cn.height = 600; const c = cn.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, 800, 600); c.strokeStyle = '#000'; c.lineWidth = 8; c.strokeRect(100, 100, 600, 400);
    const L = { img: cn, mpp: 0.05, x: 0, y: 0, rot: 0, kind: 'plan', cal: true, op: 1, vis: true };
    const res = T.traceVenue(L, {}); const n = T.applyTrace(L, res, { vn: true, fade: true });
    const a = { n, objs: T.S.objs.length, vn: T.S.objs.every(o => o.vn && o.t === 'line' && o.style === 'wall'), closed: T.S.objs[0] && T.S.objs[0].closed, op: L.op };
    T.undo(); a.after = T.S.objs.length; return a; });
  ok(r.objs === 1 && r.vn && r.closed && r.op <= 0.3 && r.after === 0, JSON.stringify(r));
});
await test('fight cage, ring and round stage draw and are real obstacles (not passable)', async () => {
  const r = await page.evaluate(() => { const T = __T, out = {}; T.S.objs = []; T.setR(30, 1);
    ['oct91','oct73','ring61','ring73','rstage6','rstage8','runway'].forEach(k => { const o = T.addObj(T.makeAt('item:' + k, { x: 5, y: 5 }));
      const cn = document.createElement('canvas'); cn.width = 400; cn.height = 400; const c = cn.getContext('2d'); c.setTransform(30, 0, 0, 30, 200, 200);
      try { T.drawItem(c, o, false); } catch (e) { out.err = k + ' ' + e; }
      const d = c.getImageData(0, 0, 400, 400).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] && d[i] < 90 && d[i + 1] < 90) n++; out[k] = n; });
    out.size = T.LIBM.oct91.w === 10.7 && T.LIBM.ring61.cg === 6.1; out.ps = ['oct91','ring61','rstage6'].some(k => T.LIBM[k].ps); return out; });
  ok(!r.err && r.size && !r.ps && ['oct91','oct73','ring61','ring73','rstage6','rstage8'].every(k => r[k] > 30), JSON.stringify(r));
});
await test('Sheet tab: Clear project button needs a second click, then leaves a blank sheet', async () => {
  await page.evaluate(() => { const T = __T; T.S.objs = []; T.addObj(T.makeAt('item:marq10', { x: 3, y: 3 })); T.S.meta.attend = 500; T.S.meta.event = 'Big Show'; T.S.meta.siteArea = 4000; T.S.tab = 'sheet'; });
  await page.evaluate(() => document.querySelector('[data-tab="sheet"]').click());
  await page.waitForSelector('[data-act="clearp"]');
  await page.click('[data-act="clearp"]');
  let r = await page.evaluate(() => __T.S.objs.length);
  ok(r === 1, 'cleared on first click: ' + r);
  await page.click('[data-act="clearp"]');
  r = await page.evaluate(() => { const S = __T.S; return { n: S.objs.length, a: S.meta.attend, e: S.meta.event, sa: S.meta.siteArea, co: S.meta.company, l: S.layers.length }; });
  ok(r.n === 0 && r.a === 0 && r.e === '[EVENT NAME]' && r.sa === 0 && r.co === 'IMPI RMS' && r.l === 0, JSON.stringify(r));
});
await test('open-sided structures (Bedouin, gazebo) are not failed for exits; closed marquees are', async () => {
  const r = await page.evaluate(() => { const T = __T, add = (a, x, y) => T.addObj(T.makeAt(a, { x, y }));
    T.S.objs = []; add('item:bedouin', 0, 0); add('item:marq10', 30, 0); T.S.meta.attend = 100;
    return T.rdyRun().filter(f => f.sev === 'fail' && /has no exit at it|only one exit/.test(f.msg)).map(f => f.msg); });
  ok(r.length >= 1 && r.every(m => m.includes('Marquee')), JSON.stringify(r));
});
await pg4.close2(); page = _r; }
let dxfTxt = '';
await test('DXF export is well formed', async () => {
  dxfTxt = await page.evaluate(() => __T.buildDxf(__T.S.objs.filter(o => !o.ev), 1000, 4).txt);
  ok(/\n\s*0\nEOF\s*$/.test(dxfTxt), 'no EOF marker');
  ok(/AC1015/.test(dxfTxt), 'not R2000');
  for (const l of ['FPS-TENTS', 'FPS-DOORS', 'FPS-SIGNS']) ok(dxfTxt.includes(l), 'missing layer ' + l);
  const ents = (dxfTxt.match(/\n  0\n(LINE|LWPOLYLINE|CIRCLE|TEXT|MTEXT|INSERT)\n/g) || []).length;
  ok(ents > 20, 'too few entities: ' + ents);
});

await test('DXF export re-imports to the same size (round trip)', async () => {
  const w = await page.evaluate(async (txt) => {
    const T = __T; await T.loadDxfLib();
    const C = window.DxfParser.default || window.DxfParser, dxf = new C().parseSync(txt);
    const fl = T.dxfFlatten(dxf), sel = {}; Object.keys(fl.layers).forEach(k => sel[k] = true);
    const e = T.dxfExtents(fl, sel); return { w: (e.x1 - e.x0) * 0.001, h: (e.y1 - e.y0) * 0.001 };
  }, dxfTxt);
  ok(w.w > 48 && w.w < 52, 'width ' + w.w + ' m (the event site boundary spans 50 m)');
});
await page.close2();

/* a small hand-made DXF: a 20 m x 10 m rectangle drawn in millimetres */
const RECT_MM = ['0','SECTION','2','HEADER','9','$INSUNITS','70','4','0','ENDSEC','0','SECTION','2','ENTITIES',
  '0','LWPOLYLINE','5','1F','8','WALLS','100','AcDbEntity','100','AcDbPolyline','90','4','70','1',
  '10','0','20','0','10','20000','20','0','10','20000','20','10000','10','0','20','10000','0','ENDSEC','0','EOF'].join('\n') + '\n';

page = await fresh();
await test('DXF import is to scale (mm file, 20 x 10 m)', async () => {
  const r = await page.evaluate(async (txt) => {
    const T = __T; await T.loadDxfLib();
    const C = window.DxfParser.default || window.DxfParser, dxf = new C().parseSync(txt);
    const fl = T.dxfFlatten(dxf), sel = { WALLS: true }, e = T.dxfExtents(fl, sel);
    T.doImportDxf({ name: 'rect' }, fl, sel, 0.001, 'u');
    return { w: (e.x1 - e.x0) * 0.001, h: (e.y1 - e.y0) * 0.001, layers: T.S.layers.length, cal: T.S.layers[0] && T.S.layers[0].cal };
  }, RECT_MM);
  near(r.w, 20, 0.05, 'width'); near(r.h, 10, 0.05, 'height'); ok(r.layers === 1 && r.cal, 'underlay not created/calibrated');
});

await test('saved work survives a reload (objects and background)', async () => {
  await page.evaluate(`(()=>{${ADD}add('item:marq10',3,3);add('sign:assembly',30,30);__T.saveLocal()})()`);
  await page.waitForTimeout(1800);
  await page.reload();
  await page.waitForFunction(() => window.__T);
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => ({ o: __T.S.objs.length, l: __T.S.layers.length }));
  ok(r.o === 2, 'objects after reload: ' + r.o);
  ok(r.l === 1, 'background layers after reload: ' + r.l);
});
await page.close2();

if (process.env.DWG_FIXTURE && existsSync(process.env.DWG_FIXTURE)) {
  page = await fresh();
  await test('DWG import converts and reads (' + process.env.DWG_FIXTURE.split('/').pop() + ')', async () => {
    const bytes = [...readFileSync(process.env.DWG_FIXTURE)];
    const r = await page.evaluate(async (arr) => {
      const T = __T; await T.loadDxfLib();
      const f = new File([new Uint8Array(arr)], 'x.dwg');
      const txt = await T.dwgToDxf(f);
      const C = window.DxfParser.default || window.DxfParser, dxf = new C().parseSync(txt), fl = T.dxfFlatten(dxf);
      return { segs: fl.segs.length, layers: Object.keys(fl.layers).length };
    }, bytes);
    ok(r.segs > 100 && r.layers > 1, JSON.stringify(r));
  });
  await page.close2();
} else console.log('  skip DWG import (set DWG_FIXTURE=/path/to/file.dwg to include it)');

await browser.close(); server.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) { console.log('Failed: ' + failures.join('; ')); process.exit(1); }
