// Renderiza tools/trilha.html (OfflineAudioContext) no Chromium e grava assets/audio/trilha-entrellun.wav
// (PCM 16 bits, 48 kHz, estéreo). Pico de amostra normalizado em −1,5 dBFS; se a sonoridade passar
// de −14 LUFS, o ganho é reduzido. Uso: node tools/gerar-trilha.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const outFile = path.join(root, 'assets/audio/trilha-entrellun.wav');

function wav(pcmBytes, frames) {
  const h = Buffer.alloc(44);
  const dataLen = frames * 4;
  h.write('RIFF', 0); h.writeUInt32LE(36 + dataLen, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(48000, 24); h.writeUInt32LE(48000 * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(dataLen, 40);
  return Buffer.concat([h, pcmBytes]);
}

function lufs(file) {
  return spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-']).stderr.toString();
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.join(root, 'tools/trilha.html'));
  const probe = await page.evaluate(() => window.renderTrackPCM(0));
  let gainDb = -1.5 - 20 * Math.log10(probe.peak);
  for (let pass = 0; pass < 2; pass++) {
    const res = await page.evaluate((g) => window.renderTrackPCM(g), gainDb);
    fs.writeFileSync(outFile, wav(Buffer.from(res.b64, 'base64'), res.frames));
    const report = lufs(outFile);
    const m = /I:\s+(-?[\d.]+) LUFS[\s\S]*Peak:\s+(-?[\d.]+) dBFS/.exec(report.split('Summary:').pop() || '');
    const I = m ? parseFloat(m[1]) : NaN;
    console.log(`passo ${pass}: ganho ${gainDb.toFixed(2)} dB · pico bruto ${probe.peak.toFixed(3)} · integrado ${I} LUFS · true peak ${m && m[2]} dBFS`);
    if (!(I > -14)) break;
    gainDb -= I + 14.5;
  }
  await browser.close();
  console.log('gravado', path.relative(root, outFile));
})();
