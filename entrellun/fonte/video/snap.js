const { chromium } = require('playwright');
(async()=>{
  const times=process.argv[2].split(',').map(Number), out=process.argv[3];
  const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
  p.on('console',m=>console.log('console',m.text()));p.on('pageerror',e=>console.log('ERR',e.message));
  await p.goto('http://127.0.0.1:8765/video/index.html');await p.evaluate(()=>window.ready);
  for(const t of times){await p.evaluate(t=>render(t),t);await p.locator('canvas').screenshot({path:`${out}/f_${t.toFixed(2)}.png`});}
  await b.close();
})();
