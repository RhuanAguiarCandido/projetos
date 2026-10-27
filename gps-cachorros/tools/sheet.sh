#!/bin/bash
# uso: tools/sheet.sh out.png cols "queryA" "queryB" ...   (cada célula 540x540... ou W×H via env CW/CH)
OUT=$1; COLS=$2; shift 2
CW=${CW:-540}; CH=${CH:-540}
D=$(mktemp -d); i=0
for q in "$@"; do node tools/viewer_shot.cjs $D/$i.png "$q" $CW $CH > $D/$i.log 2>&1 & i=$((i+1)); if (( i % 4 == 0 )); then wait; fi; done; wait
python3 -I - "$D" "$OUT" "$COLS" "$i" "$CW" "$CH" <<'PY'
import sys
from PIL import Image
d,out,cols,n,cw,ch=sys.argv[1],sys.argv[2],int(sys.argv[3]),int(sys.argv[4]),int(sys.argv[5]),int(sys.argv[6])
rows=(n+cols-1)//cols
o=Image.new('RGB',(cols*cw,rows*ch))
for k in range(n):
    try: o.paste(Image.open(f'{d}/{k}.png'),((k%cols)*cw,(k//cols)*ch))
    except Exception as e: print('missing',k,e)
o.save(out); print(out,o.size)
PY
cat $D/*.log | grep -E "console|pageerror" | head
