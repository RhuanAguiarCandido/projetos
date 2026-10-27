// exporta os eventos de áudio (tempos de impactos, whooshes etc.) gerados junto com a linha do tempo visual
const { chromium } = require('/opt/node-tools/node_modules/playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 270, height: 480 } });
  p.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 500)));
  await p.goto('http://127.0.0.1:8800/src/index.html?w=270&h=480&ss=0'); await p.waitForFunction('window.__ready===true||window.__err', null, { timeout: 180000 });
  const err = await p.evaluate('window.__err'); if (err) { console.log(err); process.exit(1); }
  const ev = await p.evaluate('GPS.events()'); fs.writeFileSync('audio/build/events.json', JSON.stringify(ev, null, 1));
  const c = {}; ev.forEach((e) => c[e.type] = (c[e.type] || 0) + 1); console.log(ev.length, 'eventos', JSON.stringify(c)); await b.close();
})();
