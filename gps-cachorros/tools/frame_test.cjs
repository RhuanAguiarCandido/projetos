// uso: node tools/frame_test.cjs scale out_prefix frame:N frame:N ...   (N=0 -> automático)
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const [scale, prefix, ...specs] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: Math.round(1080 * scale), height: Math.round(1920 * scale) } });
  p.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 500)));
  await p.goto(`http://127.0.0.1:8765/src/index.html?scale=${scale}`);
  await p.waitForFunction('window.__ready === true', null, { timeout: 240000 });
  for (const sp of specs) {
    const [f, n] = sp.split(':').map(Number);
    const info = await p.evaluate(async ([f, n]) => { await window.R.renderFrame(f, n, 0.5); return { N: window.__lastN, px: window.R.director.motionPx(f / 30, f / 30 + 0.5 / 30) }; }, [f, n]);
    await p.locator('#c').screenshot({ path: `${prefix}_${f}_n${n}.png` });
    console.log('frame', f, 'N=', n, JSON.stringify(info));
  }
  await b.close();
})();
