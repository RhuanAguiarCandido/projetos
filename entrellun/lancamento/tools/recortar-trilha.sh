#!/usr/bin/env bash
# Recorta a trilha oficial (Luminous Chord, 120 BPM, 58,72 s) para os 18 s do filme.
# Início em 18,56 s: o drop da música (32,05 s) cai em 13,5 s do filme, no impacto da logo,
# e todos os tempos da grade (x,06 / x,56 s na faixa) caem em múltiplos exatos de 0,5 s do filme.
# Entrada de 60 ms (evita clique); saída em 2,5 s a partir de 15,5 s, acompanhando a marca na tela.
set -euo pipefail
cd "$(dirname "$0")/.."
ffmpeg -y -loglevel error -i assets/audio/Luminous_Chord_Remastered.wav \
  -af "atrim=start=18.56:duration=18,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.06,afade=t=out:st=15.5:d=2.5:curve=qsin" \
  -ar 48000 -ac 2 -c:a pcm_s16le assets/audio/trilha-entrellun-luminous-chord.wav
ffprobe -v error -show_entries format=duration -of default=nw=1 assets/audio/trilha-entrellun-luminous-chord.wav
