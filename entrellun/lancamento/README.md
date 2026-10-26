# Entrellun — Gente e Gestão · Filme de lançamento (HyperFrames)

Filme de 18 s, 9:16, 1080 × 1920, 60 fps, sem narração. Roteiro técnico em [`ROTEIRO.md`](ROTEIRO.md).

## Entregáveis

| Arquivo | O que é |
|---|---|
| `renders/entrellun-lancamento-9x16-60fps.mp4` | Filme final (H.264 + AAC) |
| `assets/audio/trilha-entrellun-luminous-chord.wav` | Trilha do filme: trecho de 18 s de *Luminous Chord (Remastered)* (PCM 16 bits, 48 kHz, estéreo) |
| `index.html` | Composição HyperFrames (canvas + GSAP) |

## Estrutura

```
index.html                         composição raiz (data-composition-id="main", 18 s, 60 fps)
assets/brand/logo-entrellun-oficial-fundo-escuro.png   logo oficial, intocada (idêntica ao anexo)
assets/brand/referencias/          anexos recebidos: paleta e logos (fundo escuro e claro)
assets/brand/logo-entrellun.png    a mesma logo com fundo transparente (tools/key_logo.py)
assets/data/simbolo.js             linha central da fita do símbolo oficial (tools/fit_symbol.py)
assets/fonts/                      Plus Jakarta Sans (SIL OFL 1.1) — tipografia narrativa
assets/vendor/gsap.min.js          GSAP 3.14.2 (cópia local; o CDN não é necessário)
assets/audio/Luminous_Chord_Remastered.wav        faixa fornecida, completa e intocada (58,72 s)
assets/audio/trilha-entrellun-luminous-chord.wav  trecho usado no filme (tools/recortar-trilha.sh)
beats/                             grade de batidas detectada pelo HyperFrames (npx hyperframes beats)
tools/recortar-trilha.sh           recorte 18,56–36,56 s com entrada de 60 ms e saída de 2,5 s
tools/quadros.cjs                  folha de contato rápida para revisão
```

## Como reproduzir

Requisitos: Node 22+, FFmpeg, Python 3 com `numpy`, `Pillow` e `scipy` (só para refazer os passos de logo), Playwright com Chromium (só para `tools/quadros.cjs`).

```bash
npm install                      # hyperframes 0.8.202 e gsap 3.14.2
npx hyperframes browser ensure   # Chrome headless usado no render

# 1) (opcional) refazer o recorte da logo e o ajuste da curva do símbolo
python3 -I tools/key_logo.py
python3 -I tools/fit_symbol.py

# 2) trilha: recorte da faixa fornecida, alinhado ao drop
bash tools/recortar-trilha.sh

# 3) verificar e renderizar
npx hyperframes check
npx hyperframes render -f 60 -q delivery -o renders/entrellun-lancamento-9x16-60fps.mp4
```

Tudo é determinístico: cada quadro do filme é função apenas do tempo da timeline.

## Decisões

- **Sincronia com a trilha (120 BPM)**: o trecho começa em 18,56 s da faixa, de modo que o drop (32,05 s) cai no impacto da logo (13,5 s) e toda a grade da faixa cai em múltiplos de 0,5 s do filme. Os eventos visuais estão ancorados nos eventos musicais: 1,5 s (primeira frase), 5,5 s (entrada da fita da gestão), 9,5 s (volta da banda: a lemniscata nasce), 11,0 · 11,75 · 12,5 · 13,0 · 13,25 s (bumbos do crescendo: pulsos da fita), 13,5 s (drop: logo), 14,0 · 14,5 · 15,0 s (nome, categoria, assinatura). Detalhes em `ROTEIRO.md`.
- **Fita em código → símbolo oficial**: a curva da fita foi ajustada à arte oficial (série de Fourier com 5 harmônicas; erro médio de borda ≈ 3,1 px na arte de 1254 px). No impacto, a fita desenhada está registrada sobre o símbolo e uma máscara circular nascida do cruzamento revela o arquivo oficial, que permanece intacto até o fim. “Entrellun” e “Gente e Gestão” são recortes do mesmo arquivo da logo — nenhuma letra foi redesenhada.
- **Paleta**: fundo `#061A4F` (com leve gradiente radial no mesmo tom), textos `#F4F7FC`, fita no azul elétrico e nas duas faces da fita oficial, ciano só na passagem por cima do cruzamento (12,75–13,5 s) e coral num único ponto, no primeiro cruzamento (6,4–7,2 s).

## Verificação do render final

- `ffprobe`: H.264 1080 × 1920, 60/1 fps, 1080 quadros, 18,000 s; AAC 48 kHz estéreo, 18,000 s.
- `npx hyperframes beats`: 119,9 BPM, 36 batidas no trecho, todas a ≈35–45 ms de múltiplos de 0,5 s do filme.
- `npx hyperframes audio` no MP4 final: ataques em 1,53 · 5,525 · 9,52 · 11,015 · 11,765 · 12,515 · 13,015 · 13,265 · 13,51 · 14,015 · 14,51 · 15,01 s — cada um 10–30 ms (≈1 quadro) depois do evento visual correspondente. −16,8 LUFS integrado, true peak −3,6 dBFS, sem clipping.
- `npx hyperframes check`: sem erros de contrato. O verificador de layout acusa sobreposição de texto em 5,5 s — é a transição intencional em que a ponta da fita reta apaga “Pessoas têm potencial” e escreve “Gestão dá direção” com máscaras complementares (o verificador não considera máscaras CSS).
