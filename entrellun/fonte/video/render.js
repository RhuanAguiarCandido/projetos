const { chromium } = require('playwright');const {spawn}=require('child_process');
(async()=>{const FPS=30,N=25*FPS;
const ff=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate',String(FPS),'-c:v','png','-i','-','-c:v','libx264','-preset','slow','-crf','14','-pix_fmt','yuv420p','-tune','animation','-r','30','silent.mp4'],{stdio:['pipe','inherit','inherit']});
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('http://127.0.0.1:8765/video/index.html');await p.evaluate(()=>window.ready);
const cv=p.locator('canvas');
for(let i=0;i<N;i++){await p.evaluate(t=>render(t),i/FPS);const buf=await cv.screenshot({type:'png'});
  if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r)); if(i%75==0)console.log('frame',i);}
ff.stdin.end();await new Promise(r=>ff.on('close',r));await b.close();console.log('done');})();
