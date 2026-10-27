#!/bin/bash
# Lança WORKERS processos de render, cada um com segmentos intercalados de SEG quadros.
# uso: tools/launch_render.sh [workers=3] [seg=90] [total=1350] [only="0 3 7"]   (only: índices de segmentos a (re)renderizar)
cd "$(dirname "$0")/.."
WORKERS=${1:-3}; SEG=${2:-90}; TOTAL=${3:-1350}; ONLY=${4:-}
NSEG=$(( (TOTAL + SEG - 1) / SEG ))
LOGDIR=render/logs; mkdir -p $LOGDIR render/seg
IDX=${ONLY:-$(seq 0 $((NSEG-1)))}
w=0; declare -A R
for k in $IDX; do
  a=$((k*SEG)); b=$((a+SEG)); [ $b -gt $TOTAL ] && b=$TOTAL
  R[$((w % WORKERS))]="${R[$((w % WORKERS))]}${a}-${b},"; w=$((w+1))
done
for i in $(seq 0 $((WORKERS-1))); do
  RANGES=${R[$i]%,}; [ -z "$RANGES" ] && continue
  nohup node tools/render.cjs --ranges "$RANGES" --outdir render/seg --scale 1 --sub 0 --port $((9101+i)) > $LOGDIR/worker_$i.log 2>&1 &
  echo "worker $i -> $RANGES"
done
