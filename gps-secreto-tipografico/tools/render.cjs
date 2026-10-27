// Renderiza quadros determinísticos (Chromium + SwiftShader) e grava segmentos sem perdas (FFV1/MKV, yuv420p BT.709).
// uso: node tools/render.cjs --from=0 --to=1350 [--seg=90] [--out=render/seg] [--port=8801] [--ss=4] [--w=1080] [--h=1920] [--tag=a]
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const http = require('http'); const fs = require('fs'); const path = require('path'); const { spawn } = require('child_process');
const A = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v = '1'] = a.slice(2).split('='); return [k, v]; }));
const FROM = +(A.from ?? 0), TO = +(A.to ?? 1350), SEG = +(A.seg ?? 90), OUT = A.out ?? 'render/seg', PORT = +(A.port ?? 8801), SS = A.ss ?? '4', W = +(A.w ?? 1080), H = +(A.h ?? 1920), TAG = A.tag ?? 'w';
const FPS = 30; fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync('render/logs', { recursive: true });
const log = fs.createWriteStream(`render/logs/${TAG}.log`, { flags: 'a' }); const L = (s) => { const m = `[${new Date().toISOString().slice(11, 19)}] ${s}`; log.write(m + '\n'); console.log(m); };
let ff = null;
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', 'content-type'); res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (!ff) { res.writeHead(500); return res.end('sem ffmpeg'); }
  req.pipe(ff.stdin, { end: false }); req.on('end', () => { res.writeHead(200); res.end('ok'); });
});
(async () => {
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  p.on('pageerror', (e) => L('[pageerror] ' + e.message.slice(0, 500)));
  await p.goto(`http://127.0.0.1:8800/src/index.html?w=${W}&h=${H}&ss=${SS}`); await p.waitForFunction('window.__ready===true||window.__err', null, { timeout: 240000 });
  const err = await p.evaluate('window.__err'); if (err) { L('ERRO ' + err); process.exit(1); }
  await p.evaluate(`window.__buf = new Uint8Array(${W * H * 4}); window.__send = async (f, url) => { const N = await GPS.renderFrame(f); GPS.readFrame(window.__buf); const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: window.__buf }); if (!r.ok) throw new Error('POST ' + r.status); return N; }`);
  const s0 = Math.floor(FROM / SEG), s1 = Math.ceil(TO / SEG);
  for (let s = s0; s < s1; s++) {
    const a = Math.max(FROM, s * SEG), z = Math.min(TO, (s + 1) * SEG, 1350); const name = path.join(OUT, `seg_${String(s).padStart(3, '0')}`);
    if (fs.existsSync(name + '.mkv')) { L(`segmento ${s} já existe — pulando`); continue; }
    ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-framerate', String(FPS), '-i', 'pipe:0',
      '-vf', 'vflip,scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p', '-c:v', 'ffv1', '-level', '3', '-g', '1', '-slices', '4', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-an', '-f', 'matroska', name + '.part.mkv'], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((r) => ff.on('close', r)); const t0 = Date.now(); let tn = 0;
    for (let f = a; f < z; f++) { const t1 = Date.now(); const N = await p.evaluate(`window.__send(${f}, 'http://127.0.0.1:${PORT}/f')`); tn += N; L(`seg ${s} quadro ${f} N=${N} ${((Date.now() - t1) / 1000).toFixed(2)}s`); }
    ff.stdin.end(); await done; fs.renameSync(name + '.part.mkv', name + '.mkv'); L(`segmento ${s} ok (${a}-${z - 1}) ${((Date.now() - t0) / 1000).toFixed(0)}s, N médio ${(tn / (z - a)).toFixed(2)}`);
  }
  await b.close(); server.close(); L('FIM');
})().catch((e) => { L('FALHA ' + e.stack); process.exit(1); });
