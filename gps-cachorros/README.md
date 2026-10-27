# O GPS secreto dos cachorros 🐶🧭

Vídeo de motion graphics 9:16 (1080 × 1920, 30 fps, 45 s, H.264 + AAC) sobre o estudo de **Hart et al. (2013), *Frontiers in Zoology***: cães tendem a se alinhar ao eixo norte–sul do campo magnético da Terra ao defecar, sob campo magnético estável.

Fonte: <https://pmc.ncbi.nlm.nih.gov/articles/PMC3882779/>

## Entrega

| Arquivo | O que é |
|---|---|
| `entrega/o-gps-secreto-dos-cachorros_9x16_1080x1920_30fps.mp4` (não versionado: >100 MB; gere com `tools/finalize.sh`) | **master** (H.264 High, ≈28 Mb/s, 161 MB, yuv420p, BT.709, AAC 192 kb/s, −14 LUFS) |
| `entrega/o-gps-secreto-dos-cachorros_9x16_1080x1920_30fps_leve.mp4` | versão leve para publicar (≈13 Mb/s, 75 MB, mesmo vídeo e áudio) |
| `entrega/capa_1080x1920.png` | quadro de capa (1,55 s) |

## Como foi feito

Tudo é **código** e é **determinístico**: cada quadro é função pura do tempo, então qualquer trecho pode ser re-renderizado isoladamente.

- **Personagem 3D** (`src/dog.js`, `src/fur.js`, `src/dogAnim.js`): golden retriever procedural em Three.js, com rig completo (cabeça, olhos com pálpebras, sobrancelhas, orelhas caídas com física simples, mandíbula/língua, quatro patas articuladas, rabo em cadeia) e pelagem por *shells* (camadas de fios) com iluminação própria (luz-chave quente, contraluz ciano, brilho sedoso). A mesma geometria e paleta são usadas em todas as cenas.
- **Cenário** (`src/park.js`, `src/space.js`): parque com céu procedural, gramado de lâminas instanciadas com vento, árvores e névoa atmosférica; Terra estilizada com continentes, nuvens, atmosfera, auroras e **campo dipolar** com pulsos de energia (`src/fieldlines.js`).
- **Bússola holográfica** (`src/compass.js`): textura animada em Canvas 2D num plano aditivo, com laços de campo e faíscas orbitais; rosa dos ventos em português (N, L, S, O).
- **Pós-processamento** (`src/post.js`): MSAA + HDR, profundidade de campo, bloom, aberração cromática, glitch, transições (whip, zoom radial, íris em anel, glitch), grade de cor, vinheta, grão, **motion blur real** por acúmulo de subquadros (adaptativo ao movimento).
- **Tipografia cinética e HUD** (`src/typography.js`, `src/overlays.js`): Anton + Montserrat ExtraBold, letras com bounce/spin/slam, extrusão 3D, contador com rolagem, polar histogram, legendas dinâmicas palavra a palavra.
- **Roteiro e câmeras** (`src/shots.js`, `src/director.js`): 18 planos (cortes a cada 1,5–3 s), todos sincronizados à narração.
- **Áudio** (`audio/`): narração em pt-BR com **Kokoro-82M** (voz `pf_dora`); os tempos de cada palavra vêm das durações por fonema do próprio modelo (saída `duration` exposta no grafo ONNX), o que dá legendas em sincronia exata. Trilha eletrônica de 120 BPM e todos os efeitos (whooshes, pops, impactos, roleta, passinhos, glitch…) **sintetizados em numpy**, com *sidechain* sob a voz.

## Reproduzir

Requisitos: Node 22, Python 3.11+, FFmpeg, Playwright com Chromium.

```bash
npm install                                   # three 0.170
pip install kokoro-onnx soundfile onnxruntime scipy onnx
# modelo Kokoro (≈350 MB) em assets/models/: kokoro-v1.0.onnx e voices-v1.0.bin
#   https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
python3 -I audio/narration.py pf_dora         # narração + tempos por palavra
python3 -I audio/build_audio.py pf_dora       # trilha + efeitos + mix
node tools/serve.cjs &                        # servidor estático (porta 8765), usado pelos stills
tools/launch_render.sh 3 90 1350              # render em segmentos sem perdas (3 workers)
tools/finalize.sh pf_dora                     # loudnorm + concat + H.264/AAC
```

Revisão rápida de um quadro: `node tools/still.cjs saida 0.5 1 12.5 21.0` (escala 0,5, 1 subquadro, tempos em s).

## Observações sobre precisão científica

- Números exibidos no vídeo e que vêm do estudo: **70 cães**, **37 raças**, **1.893 observações** (de defecação), preferência pelo **eixo norte–sul** sob **campo magnético estável**.
- O gráfico polar é **ilustrativo** (está rotulado assim no vídeo); não são dados reais do artigo.
- O vídeo deixa explícito que **não acontece sempre** e que a **causa ainda é desconhecida**: o estudo não prova que os cães giram antes de defecar por causa do magnetismo.

## Créditos e licenças

- Fontes: Anton e Montserrat (SIL Open Font License 1.1) — licenças em `assets/fonts/`.
- Three.js (MIT).
- Kokoro-82M / `kokoro-onnx` (Apache-2.0) para a voz sintética.
- Música e efeitos: gerados por código neste repositório, sem amostras de terceiros.
