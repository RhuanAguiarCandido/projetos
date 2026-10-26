// Pré-visualização rápida: node tools/quadros.cjs saida.png 0,1.5,3 [largura-da-miniatura]
// Abre index.html no Chromium, posiciona a timeline em cada tempo e monta uma folha de contato.
const { chromium } = require('playwright');
const path = require('path');
const { execFileSync } = require('child_process');
const fs = require('fs');
(async () => {
  const [out, lista, larg = '360'] = process.argv.slice(2);
  const tempos = lista.split(',').map(Number);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('pageerror', (e) => console.log('ERRO', e.message));
  await p.goto('file://' + path.resolve(__dirname, '../index.html'));
  await p.evaluate(async () => { await document.fonts.ready; return 1; });
  const dir = fs.mkdtempSync('/tmp/claude-0/q-');
  for (let i = 0; i < tempos.length; i++) {
    await p.evaluate((t) => { window.__timelines.main.seek(t, false); window.dispatchEvent(new CustomEvent("hf-seek", { detail: { time: t } })); return 1; }, tempos[i]);
    await p.screenshot({ path: `${dir}/${String(i).padStart(3, '0')}.png` });
  }
  await b.close();
  const cols = Math.min(tempos.length, 6);
  const args = ['-y', '-loglevel', 'error', '-framerate', '1', '-i', `${dir}/%03d.png`, '-vf',
    `scale=${larg}:-1,drawtext=text='%{n}':x=8:y=8:fontcolor=white:fontsize=20:box=1:boxcolor=black,tile=${cols}x${Math.ceil(tempos.length / cols)}:padding=4`, '-frames:v', '1', out];
  execFileSync('ffmpeg', args);
  console.log(out, tempos.join(' '));
})();
