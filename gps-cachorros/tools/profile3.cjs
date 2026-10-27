const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const scale = process.argv[2] || '1', tt = process.argv[3] || '1.0';
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: Math.round(1080 * scale), height: Math.round(1920 * scale) } });
  await p.goto(`http://127.0.0.1:8765/src/index.html?scale=${scale}`);
  await p.waitForFunction('window.__ready === true', null, { timeout: 240000 });
  const res = await p.evaluate(async (tt) => {
    const R = window.R, w = R.world, out = {};
    const time = async (label) => { const t0 = performance.now(); await R.renderFrame(Math.round(tt * 30), 1, 0.5); R.readPixels(); out[label] = Math.round(performance.now() - t0); };
    await time('warmup'); await time('baseline');
    const fur = []; w.park.scene.traverse(o => { if (o.userData.fur) fur.push(o); });
    const grass = w.park.scene.children.filter(c => c.userData.grass);
    const hide = async (label, objs) => { objs.forEach(o => o.visible = false); await time(label); objs.forEach(o => o.visible = true); };
    await hide('noFur', fur); await hide('noGrass', grass); await hide('noTrees', [w.park.trees]); await hide('noDust', [w.park.dust]); await hide('noFlowers', [w.park.flowers]); await hide('noGround', [w.park.ground]); await hide('noSky', [w.park.sky]);
    await hide('noFur+Grass', [...fur, ...grass]);
    await hide('noFur+Grass+Trees+Dust+Flowers', [...fur, ...grass, w.park.trees, w.park.dust, w.park.flowers]);
    return out;
  }, tt);
  console.log(JSON.stringify(res));
  await b.close();
})();
