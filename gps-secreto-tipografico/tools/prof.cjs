const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 500)));
  await p.goto(`http://127.0.0.1:8800/src/index.html?w=1080&h=1920&ss=${process.argv[2]||4}`); await p.waitForFunction('window.__ready===true||window.__err', null, { timeout: 180000 });
  const res = await p.evaluate(`(async()=>{
    const E = GPS.engine, ctx = GPS.ctx, gl = E.r.getContext(); const px = new Uint8Array(4);
    const sync = () => { E.r.setRenderTarget(null); gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px); };
    const out = {};
    for (const t of [8.6, 23.6, 13.5, 41]) {
      GPS.setTime(t); const sc = ctx.scene, cam = ctx.camera; const T = (name, f) => { sync(); const a = performance.now(); f(); sync(); out[t+':'+name] = Math.round(performance.now()-a); };
      // warm
      E.sub({scene: sc, camera: cam}, 1, true);
      T('setTime', () => GPS.setTime(t));
      T('scene', () => { E.r.setRenderTarget(E.rtMain); E.r.clear(true,true,true); E.r.render(sc, cam); });
      T('dof', () => { E.pass(E.mDof, E.rtDof); });
      T('bloom', () => { let src = E.rtMain.texture; for (let i=0;i<E.down.length;i++){ E.mDown.uniforms.tSrc.value = src; E.mDown.uniforms.uTexel.value.set(1/(E.W>>i),1/(E.H>>i)); E.pass(E.mDown, E.down[i]); src = E.down[i].texture;} for (let i=E.up.length-1;i>=0;i--){ E.mUp.uniforms.tSrc.value = src; E.mUp.uniforms.tBase.value = E.down[i].texture; E.mUp.uniforms.uTexel.value.set(1/(E.W>>(i+2)),1/(E.H>>(i+2))); E.pass(E.mUp, E.up[i]); src = E.up[i].texture; } });
      T('comp', () => { E.r.setRenderTarget(E.rtComp); E.r.clear(true,true,true); E.quad.material = E.mComp; E.r.render(E.quadScene, E.cam); });
      E.hudPass({hudScene: ctx.hud.scene, hudCam: ctx.hud.cam}); T('hud', () => { E.hudPass({hudScene: ctx.hud.scene, hudCam: ctx.hud.cam}); });
      T('acc', () => { E.pass(E.mAcc, E.rtAccum); });
      T('final', () => { E.final(0); });
    }
    return out; })()`);
  console.log(JSON.stringify(res, null, 1)); await b.close();
})();
