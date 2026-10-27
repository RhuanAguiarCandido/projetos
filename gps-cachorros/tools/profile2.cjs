const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const scale = process.argv[2] || '1', tt = process.argv[3] || '1.0';
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: Math.round(1080 * scale), height: Math.round(1920 * scale) } });
  p.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 500)));
  await p.goto(`http://127.0.0.1:8765/src/index.html?scale=${scale}${process.env.QS ? '&' + process.env.QS : ''}`);
  await p.waitForFunction('window.__ready === true', null, { timeout: 240000 });
  const res = await p.evaluate(async (tt) => {
    const R = window.R, out = {};
    const time = async (label) => { const t0 = performance.now(); await R.renderFrame(Math.round(tt * 30), 1, 0.5); R.readPixels(); out[label] = Math.round(performance.now() - t0); };
    await time('warmup'); await time('baseline');
    R.DBG.tm = {}; await time('timed'); out.stages = Object.fromEntries(Object.entries(R.DBG.tm).map(([k, v]) => [k, Math.round(v)])); R.DBG.tm = null;
    for (const m of [0.5, 0.25]) { R.director.shellMul = m; await time('shellMul' + m); }
    R.director.shellMul = 1;
    return out;
  }, tt);
  console.log(JSON.stringify(res));
  await b.close();
})();
