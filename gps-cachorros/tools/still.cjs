// uso: node tools/still.cjs out_prefix scale subframes t1 t2 t3 ...   -> out_prefix_<t>.png
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const [prefix, scale, sub, ...times] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: Math.round(1080 * scale), height: Math.round(1920 * scale) } });
  p.on('console', m => { if (['error', 'warning'].includes(m.type())) console.log('[console]', m.text().slice(0, 500)); });
  p.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 800)));
  await p.goto(`http://127.0.0.1:8765/src/index.html?scale=${scale}${process.env.QS ? '&' + process.env.QS : ''}`);
  await p.waitForFunction('window.__ready === true', null, { timeout: 180000 });
  for (const t of times) {
    const t0 = Date.now();
    await p.evaluate(`window.R.renderAt(${t}, ${sub})`);
    const ms = Date.now() - t0;
    await p.locator('#c').screenshot({ path: `${prefix}_${String(t).replace('.', '_')}.png` });
    console.log('t', t, 'render', ms, 'ms');
  }
  await b.close();
})();
