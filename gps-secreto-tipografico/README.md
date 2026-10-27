# O GPS secreto dos cachorros 🐶🧭 — versão tipográfica (sem voz)

Vídeo de motion graphics **9:16 (1080 × 1920), 30 fps, 45 s, H.264 + AAC**, em português do Brasil, sobre o estudo de
**Hart et al. (2013), *Frontiers in Zoology***: cães tendem a se alinhar ao eixo **norte–sul** do campo magnético da Terra
ao defecar, sob campo magnético estável.

Fonte científica: <https://pmc.ncbi.nlm.nih.gov/articles/PMC3882779/>

> **Não há voz nem narração.** A história é contada só por **texto dinâmico** (tipografia 3D cinética + legendas por palavra),
> música e efeitos sonoros — tudo gerado por código neste repositório.
> Este projeto é **novo**: não reaproveita o código nem a abordagem do projeto anterior (`../gps-cachorros`, que continua intacto).

## Entrega

| Arquivo | O que é |
|---|---|
| `entrega/o-gps-secreto-dos-cachorros_9x16_1080x1920_30fps.mp4` | vídeo final (H.264 High, yuv420p, BT.709, AAC 192 kb/s, −14 LUFS) |
| `entrega/capa_1080x1920.png` | quadro de capa |
| `entrega/contato_1s.png` | folha de contato (1 quadro por segundo) |

## Linha do tempo (textos exatos do briefing + legendas de apoio curtas)

| Tempo | Cena | Texto 3D (herói) | Legendas (HUD) |
|---|---|---|---|
| 0–5 s | Gancho | **SEU CACHORRO / TEM GPS?!** | “Ele sabe onde fica o **Norte?**” |
| 5–12 s | Mistério | **POR QUE / TANTAS / VOLTAS?** (depois em anel no chão, com contador de voltas) | “Gira, gira, gira…” · “Será **coincidência?**” |
| 12–21 s | Terra | **CAMPO / MAGNÉTICO / DA TERRA** | “A Terra é um **ímã gigante**” · “Bússolas usam esse campo para achar o **Norte**” |
| 21–32 s | Prova | **70** (contador) **CÃES ANALISADOS** · **EIXO NORTE–SUL** · NORTE / SUL no chão | “37 raças · 1.893 observações” · “com campo magnético **estável**” · crédito Hart et al., 2013 |
| 32–39 s | Reviravolta | glitch + congelamento · **AINDA É UM / MISTÉRIO!** | “Nem sempre **acontece.**” · “Ninguém provou que seja **magnético**” |
| 39–45 s | Final viral | **VOCÊ JÁ / PERCEBEU / ISSO?** + patinhas vetoriais | “Conta nos **comentários**” · “Fonte: Hart et al. (2013), Frontiers in Zoology” |

18 planos, com corte a cada 2–3,5 s; transições (whip, zoom radial, glitch, flash e *wipe* diagonal nas cores da marca) escondem cada corte.

## Pesquisa e práticas aplicadas

| Tema | Prática adotada | Fonte consultada |
|---|---|---|
| Áreas seguras (Reels/TikTok/Shorts) | texto essencial no centro: margens conservadoras de ~15 % no topo, 25–35 % embaixo e 15–20 % à direita; legendas em y ≈ 1000–1300 px, texto herói entre 280 e 1300 px | [reap.video — safe zones](https://reap.video/blog/short-form-video-safe-zones), [Revid — TikTok safe zone](https://www.revid.ai/tiktok-safe-zone), [Blitzcut — caption placement](https://blitzcutai.com/blog/best-caption-placement-short-form-video) |
| Tipografia cinética | movimento só onde reforça a hierarquia; um movimento dominante por cena; mesma família de easing; títulos (Anton 3D) ≠ legendas (Montserrat ExtraBold) | [Digital Silk — kinetic typography](https://www.digitalsilk.com/web-design/web-trends/kinetic-typography/), [Videomaker — typography for motion graphic design](https://www.videomaker.com/article/c3/18022-typography-for-motion-graphic-design/) |
| Tempo de leitura | cada legenda fica ≥ 5/6 s e a ≤ ~17 caracteres/s (limite “adulto” dos guias de *timed text* da Netflix); no vídeo, o pior caso é ~14 cps | [Netflix Timed Text Style Guide (geral)](https://backlothelp.netflix.com/hc/en-us/articles/115000239632-Timed-Text-Style-Guide-Supplementals-Marketing-Assets), [exemplo de limite em cps](https://backlothelp.netflix.com/hc/en-us/articles/220294068-Romanian-Timed-Text-Style-Guide) |
| Motion blur | obturador de 180° (exposição = ½ quadro) por acúmulo de subquadros, com nº de amostras adaptativo ao deslocamento em pixels | [Regra dos 180°](https://www.diyphotography.net/?p=309010), [RenderMan — motion blur](https://rmanwiki.pixar.com/x/144NB) |
| Loudness | −14 LUFS integrado, pico real ≤ −1,5 dBTP (normalização em dois passos com `loudnorm`) | [Fora Soft — LUFS por plataforma](https://www.forasoft.com/learn/audio-for-video/articles-audio/lufs-targets-per-platform-2026) |

Ressalvas honestas: as margens de “zona segura” variam entre fontes e apps — usei valores conservadores; o limite de cps vem de guias de legendagem (não de plataformas sociais).

## Como foi feito (tudo é código e determinístico)

Cada quadro é uma função pura do tempo (linha do tempo GSAP pausada + `totalTime(t)`), então qualquer trecho pode ser re-renderizado isoladamente.

- **Tipografia 3D de verdade** (`src/kit/text.js`): contornos reais das fontes (opentype.js, com *kerning*) → `Shape` → `ExtrudeGeometry` com chanfro; cada letra é um objeto próprio (pivô no centro) com material de gradiente + luz de recorte + brilho varrendo + *flash*. Dithering de opacidade (Bayer) evita ordenação de transparência.
- **Cinética por letra** (`src/kit/kinetic.js`): *slam*, *drop*, *rise*, *spin*, *pop*; sai por *shrink*, *fall*, *slide*; lockups empilhados que ajustam cada linha à largura; brilho e *flash* nas batidas (grade de 120 BPM).
- **HUD ortográfico** (`src/engine/hud.js`): legendas palavra a palavra com pílulas de destaque, sombra, *scrim* suave e ícone de patinha vetorial (no lugar do emoji, que as fontes não têm).
- **Personagem** (`src/world/dog.js`, `toon.js`): golden retriever 3D estilizado (*toon*: 3 faixas suaves, luz de recorte ciano, contorno por casco invertido com largura constante em pixels, tufos instanciados), com rig completo — cabeça, olhos com pálpebras e espiral de tontura, sobrancelhas, orelhas, mandíbula/língua, quatro patas, rabo em cadeia.
- **Mundo**: parque na “hora azul” (`park.js`), Terra pontilhada com continentes do Natural Earth 110 m + linhas dipolares com pulsos Sul→Norte (`space.js`), bússola holográfica e **70 cães** vistos de cima que se alinham ao eixo N–S com histograma polar ilustrativo (`compass.js`).
- **Engine** (`src/engine/engine.js`): HDR com MSAA, profundidade de campo, *bloom*, aberração cromática, glitch, transições, *tone map* suave, grade, vinheta, grão e dither; HUD composto por cima; acumulação de subquadros.
- **Áudio** (`audio/build_audio.py`): trilha eletrônica de 120 BPM (bumbo, claps, hats, baixo, pads, arpejos com *ping-pong delay*, *sidechain*) e efeitos (slam, impacto, whoosh, risers, ticks, bell, glitch) **sintetizados em numpy** e sincronizados aos eventos exportados da própria linha do tempo visual (`events.json`). Nenhuma amostra de terceiros; nenhuma voz.
- **Render** (`tools/render.cjs`): Chromium + SwiftShader (sem GPU), quadros lidos por `readPixels`, segmentos sem perdas FFV1 e uma única codificação final x264 (CRF 16).

## Reproduzir

Requisitos: Node 22, Python 3.11+ (numpy, scipy), FFmpeg, Playwright com Chromium.

```bash
npm install                          # three 0.170, gsap 3.15, opentype.js 2.0, world-atlas, topojson-client
node tools/serve.cjs 8800 &          # servidor estático
node tools/dump_events.cjs           # exporta os eventos de áudio da linha do tempo
python3 -I audio/build_audio.py      # música + efeitos -> audio/build/mix.wav
tools/launch_render.sh 4             # 3 workers, 15 segmentos sem perdas em render/seg
tools/finalize.sh                    # loudnorm + concat + H.264/AAC
node tools/still.cjs out/s 0.5 1 1.8 8.6 23.6   # revisão rápida de quadros (escala 0,5; 1 subquadro)
```

## Precisão científica

- Números vindos do estudo: **70 cães**, **37 raças**, **1.893 observações** (de defecação); preferência pelo **eixo norte–sul** sob **campo magnético estável**.
- O histograma polar é **ilustrativo** (rotulado no vídeo); não são dados reais do artigo.
- O vídeo deixa explícito que **não acontece sempre** e que **ninguém provou que as voltas sejam magnéticas**.
- A imagem de referência do golden retriever citada no briefing **não foi fornecida**; o personagem é procedural, com a mesma geometria e paleta em todas as cenas.

## Créditos e licenças

- Fontes: Anton e Montserrat (SIL Open Font License 1.1) — licenças em `assets/fonts/`.
- Three.js, GSAP (licença padrão GSAP), opentype.js (MIT); geografia: Natural Earth via `world-atlas` (domínio público).
- Música e efeitos: gerados por código neste repositório.
