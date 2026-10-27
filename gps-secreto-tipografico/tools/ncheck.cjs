const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 270, height: 480 } });
  p.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 500)));
  await p.goto('http://127.0.0.1:8800/src/index.html?w=270&h=480&ss=2'); await p.waitForFunction('window.__ready===true||window.__err', null, { timeout: 120000 });
  const err = await p.evaluate('window.__err'); if (err) { console.log(err); process.exit(1); }
  const res = await p.evaluate(`(async()=>{ const out=[]; for (let f=0; f<1350; f+=15) { const t=f/30; out.push([+t.toFixed(1), GPS.adaptiveN(t)]); } return out; })()`);
  const hist = {}; res.forEach(([t, n]) => hist[n] = (hist[n] || 0) + 1); console.log('hist', JSON.stringify(hist), 'mean', (res.reduce((a, r) => a + r[1], 0) / res.length).toFixed(2));
  console.log(res.filter((r) => r[1] >= 4).map((r) => r.join(':')).join(' '));
  await b.close();
})();
