const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto(`http://127.0.0.1:8765/src/index.html?scale=1`);
  await p.waitForFunction('window.__ready === true', null, { timeout: 240000 });
  const res = await p.evaluate(async () => {
    const R = window.R, D = R.director, out = [];
    const mot = JSON.parse(await (await fetch('/render/motion.json')).text());
    await R.renderFrame(30, 1, 0.5); R.readPixels();
    for (const sh of D.shots) {
      const f = Math.round((sh.t0 + (sh.t1 - sh.t0) * 0.5) * 30);
      const t0 = performance.now(); await R.renderFrame(f, 1, 0.5); R.readPixels(); const ms = performance.now() - t0;
      const f0 = Math.round(sh.t0 * 30), f1 = Math.round(sh.t1 * 30);
      let sub = 0; for (let k = f0; k < f1; k++) { const px = mot[k]; sub += (px >= 99 || px === 60) ? 1 : px < 20 ? 1 : px < 60 ? 2 : 3; }
      out.push({ id: sh.id, ms: Math.round(ms), frames: f1 - f0, subframes: sub, est_s: Math.round(sub * ms / 1000) });
    }
    return out;
  });
  let tot = 0; for (const r of res) { console.log(JSON.stringify(r)); tot += r.est_s; } console.log('TOTAL est (single-process, full machine):', Math.round(tot / 60), 'min');
  await b.close();
})();
