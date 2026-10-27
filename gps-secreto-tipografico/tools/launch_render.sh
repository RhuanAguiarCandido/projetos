#!/bin/bash
# lança 3 workers que renderizam faixas disjuntas de segmentos (15 segmentos de 90 quadros)
cd "$(dirname "$0")/.."
SS=${1:-4}
nohup node tools/render.cjs --from=0   --to=450  --port=8801 --tag=a --ss=$SS > render/logs/a.out 2>&1 &
nohup node tools/render.cjs --from=450 --to=900  --port=8802 --tag=b --ss=$SS > render/logs/b.out 2>&1 &
nohup node tools/render.cjs --from=900 --to=1350 --port=8803 --tag=c --ss=$SS > render/logs/c.out 2>&1 &
echo lançado
