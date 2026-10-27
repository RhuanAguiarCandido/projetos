// uso: node tools/lab.cjs test out.png "w=540&h=960"
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const [test, out, extra = ''] = process.argv.slice(2);
  const q = new URLSearchParams(extra); const w = +q.get('w') || 540, h = +q.get('h') || 960;
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on('console', m => { if (['error', 'warning'].includes(m.type())) console.log('[console]', m.text().slice(0, 400)); });
  p.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 700)));
  await p.goto(`http://127.0.0.1:8800/src/lab.html?test=${test}&${extra}`);
  await p.waitForFunction('window.__done === true', null, { timeout: 120000 });
  console.log(JSON.stringify(await p.evaluate('window.__info||null')));
  await p.locator('#c').screenshot({ path: out });
  await b.close();
})();
