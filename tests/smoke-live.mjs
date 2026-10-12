// After a deploy:   node tests/smoke-live.mjs https://impi-floorplan-studio.vercel.app
// Checks the live site is up and every file the app loads on demand is really being served.
const base = (process.argv[2] || 'https://impi-floorplan-studio.vercel.app').replace(/\/$/, '');
let bad = 0;
async function check(name, fn) {
  try { const m = await fn(); console.log('  ok   ' + name + (m ? '  (' + m + ')' : '')); }
  catch (e) { bad++; console.log('  FAIL ' + name + '  ' + e.message); }
}
const get = (p, o) => fetch(base + p, { redirect: 'manual', ...o });
console.log('Live check: ' + base);
await check('sign-in page loads', async () => { const r = await get('/'); if (r.status !== 200) throw new Error('HTTP ' + r.status); if (!/IMPI|FloorPlan/i.test(await r.text())) throw new Error('wrong page'); });
await check('app is closed to signed-out visitors', async () => { const r = await get('/app'); if (![301, 302, 303, 307, 308, 401].includes(r.status)) throw new Error('HTTP ' + r.status + ' (the app must not be public)'); });
await check('cloud API refuses signed-out requests cleanly', async () => { const r = await get('/api/plans'); if (r.status !== 401) throw new Error('HTTP ' + r.status + ' (expected 401)'); });
for (const [p, min, type] of [['/impi-logo.png', 1000], ['/vendor/dxf-parser.js', 10000], ['/vendor/leaflet.js', 10000], ['/vendor/libredwg/dist/libredwg-web.js', 100000], ['/vendor/libredwg/wasm/libredwg-web.js', 50000], ['/vendor/libredwg/wasm/libredwg-web.wasm', 5000000, 'wasm']])
  await check('served: ' + p, async () => { const r = await get(p); if (r.status !== 200) throw new Error('HTTP ' + r.status); const b = await r.arrayBuffer(); if (b.byteLength < min) throw new Error('only ' + b.byteLength + ' bytes'); if (type === 'wasm' && !/wasm/.test(r.headers.get('content-type') || '')) throw new Error('wrong content-type ' + r.headers.get('content-type')); return Math.round(b.byteLength / 1024) + ' KB'; });
console.log(bad ? '\n' + bad + ' problem(s). Do not rely on this deploy.' : '\nAll good.');
process.exit(bad ? 1 : 0);
