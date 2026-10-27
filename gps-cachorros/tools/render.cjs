// Render determinístico por segmentos sem perdas (FFV1/MKV).
// uso: node tools/render.cjs --ranges 0-90,270-360 --outdir render/seg [--scale 1] [--sub 0] [--port 9101] [--voice pf_dora]
// Cada segmento vira render/seg/seg_<inicio>.mkv; o encode final (H.264 + áudio) é feito por tools/finalize.sh.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const RANGES = arg('ranges', '0-90').split(',').map((r) => r.split('-').map(Number)), OUTDIR = arg('outdir', 'render/seg'), SCALE = +arg('scale', 1), SUB = +arg('sub', 0), PORT = +arg('port', 9101), VOICE = arg('voice', 'pf_dora'), SHUT = +arg('shutter', 0.5);
const root = path.resolve(__dirname, '..');
const W = Math.round(1080 * SCALE), H = Math.round(1920 * SCALE);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf' };
fs.mkdirSync(path.resolve(OUTDIR), { recursive: true });
let ff = null;
const startFF = (out) => {
  ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', '30', '-i', 'pipe:0', '-vf', 'vflip,format=rgb24', '-c:v', 'ffv1', '-level', '3', '-g', '1', '-slicecrc', '0', '-threads', '2', '-f', 'matroska', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  ff.stdin.on('error', () => {});
  return ff;
};
const server = http.createServer((req, res) => {
  if (req.method === 'POST') {
    const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => {
      const buf = Buffer.concat(chunks); const ok = ff.stdin.write(buf);
      if (ok) { res.writeHead(200); res.end('ok'); } else ff.stdin.once('drain', () => { res.writeHead(200); res.end('ok'); });
    }); return;
  }
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res);
}).listen(PORT, '127.0.0.1');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  p.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 500)));
  p.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 300)); });
  await p.goto(`http://127.0.0.1:${PORT}/src/index.html?scale=${SCALE}&voice=${VOICE}`);
  await p.waitForFunction('window.__ready === true', null, { timeout: 300000 });
  for (const [FROM, TO] of RANGES) {
    const out = path.join(OUTDIR, `seg_${String(FROM).padStart(5, '0')}.mkv`), tmp = out.replace('.mkv', '.part.mkv');
    startFF(tmp); const t0 = Date.now();
    for (let f = FROM; f < TO; f++) {
      await p.evaluate(async ([f, sub, shut, url]) => { await window.R.renderFrame(f, sub, shut); await window.R.send(url); }, [f, SUB, SHUT, `http://127.0.0.1:${PORT}/frame`]);
      if ((f - FROM) % 15 === 14) { const el = (Date.now() - t0) / 1000, n = f - FROM + 1; console.log(`[${FROM}-${TO}] ${n}/${TO - FROM}  ${(el / n).toFixed(2)} s/frame`); }
    }
    ff.stdin.end(); await new Promise((r) => ff.on('close', r)); fs.renameSync(tmp, out); console.log('segment done', out);
  }
  await b.close(); server.close(); console.log('ALL DONE');
})().catch((e) => { console.error(e); process.exit(1); });
