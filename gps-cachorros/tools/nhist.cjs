const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 270, height: 480 } });
  await p.goto(`http://127.0.0.1:8765/src/index.html?scale=0.25`);
  await p.waitForFunction('window.__ready === true', null, { timeout: 240000 });
  const res = await p.evaluate(() => {
    const D = window.R.director; const px = []; const dt = 0.5 / 30;
    for (let f = 0; f < 1350; f++) px.push(D.motionPx(f / 30, f / 30 + dt));
    return px;
  });
  require('fs').writeFileSync('/tmp/claude-0/-home-user-projetos/fd2eec2b-8a7e-58a1-91c0-93b178f0ca22/scratchpad/motion.json', JSON.stringify(res));
  const hist = (lo, hi) => res.filter(x => x >= lo && x < hi).length;
  console.log('px<8', hist(0, 8), ' 8-16', hist(8, 16), ' 16-30', hist(16, 30), ' 30-44', hist(30, 44), ' 44-70', hist(44, 70), ' 70+', hist(70, 1e9));
  // por segundo: max px
  const per = []; for (let s = 0; s < 45; s++) per.push(Math.round(Math.max(...res.slice(s * 30, s * 30 + 30))));
  console.log(per.join(' '));
  await b.close();
})();
