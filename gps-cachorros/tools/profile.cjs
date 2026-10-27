const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const scale = process.argv[2] || '0.5', tt = process.argv[3] || '1.0';
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: Math.round(1080 * scale), height: Math.round(1920 * scale) } });
  p.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 500)));
  await p.goto(`http://127.0.0.1:8765/src/index.html?scale=${scale}`);
  await p.waitForFunction('window.__ready === true', null, { timeout: 240000 });
  const res = await p.evaluate(async (tt) => {
    const R = window.R, w = R.world, out = {};
    const time = async (label, fn) => { fn && fn(); const t0 = performance.now(); await R.renderFrame(Math.round(tt * 30), 1, 0.5); R.readPixels(); out[label] = Math.round(performance.now() - t0); };
    await time('warmup');
    await time('baseline');
    R.DBG.noOverlay = true; await time('noOverlay'); R.DBG.noOverlay = false;
    R.DBG.noBloom = true; await time('noBloom'); R.DBG.noBloom = false;
    const sh = R.director.shots.find(s => s.t0 <= tt && s.t1 > tt); const oldDof = sh.dof; sh.dof = { on: false }; await time('noDOF'); sh.dof = oldDof;
    w.park.scene.traverse(o => { if (o.userData.fur) o.visible = false; });
    w.park.scene.children.forEach(c => { if (c.isMesh && c.geometry && c.geometry.isInstancedBufferGeometry) c.visible = false; });
    w.park.trees.visible = false; w.park.dust.visible = false;
    await time('onlySkyAndPost');
    R.DBG.noOverlay = true; R.DBG.noBloom = true; sh.dof = { on: false }; await time('onlySky_noPost');
    return out;
  }, tt);
  console.log(JSON.stringify(res));
  await b.close();
})();
