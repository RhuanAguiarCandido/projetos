# Entrellun — Gente e Gestão · Filme de lançamento (HyperFrames)

Filme de 18 s, 9:16, 1080 × 1920, 60 fps, sem narração. Roteiro técnico em [`ROTEIRO.md`](ROTEIRO.md).

## Entregáveis

| Arquivo | O que é |
|---|---|
| `renders/entrellun-lancamento-9x16-60fps.mp4` | Filme final (H.264 + AAC) |
| `assets/audio/trilha-entrellun.wav` | Trilha gerada por código (PCM 16 bits, 48 kHz, estéreo, 18,000 s) |
| `index.html` | Composição HyperFrames (canvas + GSAP) |

## Estrutura

```
index.html                         composição raiz (data-composition-id="main", 18 s, 60 fps)
assets/brand/logo-entrellun-oficial-fundo-escuro.png   logo oficial, intocada
assets/brand/logo-entrellun.png    a mesma logo com fundo transparente (tools/key_logo.py)
assets/data/simbolo.js             linha central da fita do símbolo oficial (tools/fit_symbol.py)
assets/fonts/                      Plus Jakarta Sans (SIL OFL 1.1) — tipografia narrativa
assets/vendor/gsap.min.js          GSAP 3.14.2 (cópia local; o CDN não é necessário)
assets/audio/trilha-entrellun.wav  trilha
tools/trilha.html                  síntese da trilha (Web Audio API, OfflineAudioContext)
tools/gerar-trilha.cjs             executa a síntese no Chromium e grava o WAV
tools/quadros.cjs                  folha de contato rápida para revisão
```

## Como reproduzir

Requisitos: Node 22+, FFmpeg, Python 3 com `numpy`, `Pillow` e `scipy` (só para refazer os passos de logo), Playwright com Chromium.

```bash
npm install                      # hyperframes 0.8.202 e gsap 3.14.2
npx hyperframes browser ensure   # Chrome headless usado no render

# 1) (opcional) refazer o recorte da logo e o ajuste da curva do símbolo
python3 -I tools/key_logo.py
python3 -I tools/fit_symbol.py

# 2) trilha: OfflineAudioContext → WAV
node tools/gerar-trilha.cjs

# 3) verificar e renderizar
npx hyperframes check
npx hyperframes render -f 60 -q delivery -o renders/entrellun-lancamento-9x16-60fps.mp4
```

Tudo é determinístico: o ruído da trilha vem de um PRNG com semente fixa e cada quadro do filme é função apenas do tempo da timeline.

## Decisões

- **Andamento 120 BPM**: os inícios de seção (2,5 · 6 · 9,5 · 13,5 s) caem exatamente em tempos; o impacto da logo está em 13,5 s, precedido de uma colcheia de silêncio.
- **Fita em código → símbolo oficial**: a curva da fita foi ajustada à arte oficial (erro médio de borda ≈ 2,7 px na arte de 1254 px). No impacto, a fita desenhada está registrada sobre o símbolo e uma máscara circular nascida do cruzamento revela o arquivo oficial, que permanece intacto até o fim. “Entrellun” e “Gente e Gestão” são recortes do mesmo arquivo da logo — nenhuma letra foi redesenhada.
- **Paleta**: fundo `#061A4F` (com leve gradiente radial no mesmo tom), textos `#F4F7FC`, fita no azul elétrico e nas duas faces da fita oficial, ciano só na passagem por cima do cruzamento (12,75–13,5 s) e coral num único ponto, no primeiro cruzamento (6,4–7,2 s).
