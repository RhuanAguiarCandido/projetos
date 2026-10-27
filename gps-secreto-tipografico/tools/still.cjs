// uso: node tools/still.cjs <saida_prefixo> <scale> <n_subquadros(0=auto)> t1 t2 ... [--scenes=s1,s2] [--ss=4]
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const args = process.argv.slice(2); const flags = args.filter((a) => a.startsWith('--')); const pos = args.filter((a) => !a.startsWith('--'));
  const [prefix, scaleS, nS, ...times] = pos; const scale = +scaleS || 0.5; const n = +nS || 0;
  const W = Math.round(1080 * scale), H = Math.round(1920 * scale);
  const extra = flags.map((f) => f.slice(2)).join('&');
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.log('[console]', m.text().slice(0, 500)); });
  p.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 800)));
  await p.goto(`http://127.0.0.1:8800/src/index.html?w=${W}&h=${H}&${extra}`);
  await p.waitForFunction('window.__ready===true || window.__err', null, { timeout: 180000 });
  const err = await p.evaluate('window.__err'); if (err) { console.log('ERRO:', err); await b.close(); process.exit(1); }
  for (const t of times) {
    const t0 = Date.now(); const N = await p.evaluate(`GPS.renderFrame(Math.round(${+t}*30), ${n || 'undefined'})`);
    await p.locator('#c').screenshot({ path: `${prefix}_${String(t).replace('.', 'p')}.png` }); console.log(`t=${t} N=${N} ${Date.now() - t0}ms`);
  }
  await b.close();
})();
