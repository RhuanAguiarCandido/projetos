// uso: node tools/viewer_shot.cjs out.png "az=0&el=8&d=3.4&t=0,0.8,0.1&pose={...}" [w] [h]
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const [out, query, w = 540, h = 960] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.text().slice(0, 400)); });
  p.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 600)));
  await p.goto(`http://127.0.0.1:8765/src/viewer.html?w=${w}&h=${h}&${query || ''}`);
  await p.waitForFunction('window.__done === true', null, { timeout: 120000 });
  console.log('render ms', Math.round(await p.evaluate('window.__ms')));
  await p.screenshot({ path: out });
  await b.close();
})();
