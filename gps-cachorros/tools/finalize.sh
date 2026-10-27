#!/bin/bash
# Junta os segmentos sem perdas, normaliza o áudio (-14 LUFS, TP -1.5 dB) e gera o MP4 final (H.264 + AAC).
# uso: tools/finalize.sh [voz=pf_dora] [saida=entrega/o-gps-secreto-dos-cachorros_9x16_1080x1920_30fps.mp4]
set -e
cd "$(dirname "$0")/.."
VOICE=${1:-pf_dora}
OUT=${2:-entrega/o-gps-secreto-dos-cachorros_9x16_1080x1920_30fps.mp4}
mkdir -p entrega render
MIX=audio/build/mix_$VOICE.wav
[ -f "$MIX" ] || { echo "falta $MIX (rode: python3 -I audio/build_audio.py $VOICE)"; exit 1; }

# ---- 1) loudnorm em dois passos
echo "[1/3] medindo loudness..."
ffmpeg -hide_banner -nostats -i "$MIX" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2> render/loudnorm_pass1.txt
python3 -I - "$VOICE" <<'PY'
import json, re, sys
t = open('render/loudnorm_pass1.txt').read()
j = json.loads(t[t.rindex('{'):t.rindex('}') + 1])
open('render/loudnorm_args.txt', 'w').write(
    "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=%s:measured_TP=%s:measured_LRA=%s:measured_thresh=%s:offset=%s:linear=true:print_format=summary" %
    (j['input_i'], j['input_tp'], j['input_lra'], j['input_thresh'], j['target_offset']))
print('medido: I=%s LUFS  TP=%s dBTP  LRA=%s' % (j['input_i'], j['input_tp'], j['input_lra']))
PY
echo "[2/3] aplicando normalização..."
ffmpeg -hide_banner -nostats -y -i "$MIX" -af "$(cat render/loudnorm_args.txt)" -ar 48000 -c:a pcm_s16le audio/build/final_$VOICE.wav 2> render/loudnorm_pass2.txt
tail -n 12 render/loudnorm_pass2.txt | grep -E "Output|Input|Target" || true

# ---- 2) concatena segmentos e codifica
ls render/seg/seg_*.mkv > /dev/null 2>&1 || { echo "sem segmentos em render/seg"; exit 1; }
: > render/list.txt
for f in $(ls render/seg/seg_[0-9]*.mkv | grep -v part | sort); do echo "file '$(pwd)/$f'" >> render/list.txt; done
echo "[3/3] codificando $(wc -l < render/list.txt) segmentos -> $OUT"
ffmpeg -hide_banner -loglevel warning -stats -y -f concat -safe 0 -i render/list.txt -i audio/build/final_$VOICE.wav -map 0:v:0 -map 1:a:0 \
  -vf "scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p" -r 30 \
  -c:v libx264 -preset slow -crf 16 -maxrate 30M -bufsize 60M -profile:v high -level 4.2 -pix_fmt yuv420p \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -c:a aac -b:a 192k -ar 48000 -ac 2 -t 45 -movflags +faststart \
  -metadata title="O GPS secreto dos cachorros" -metadata comment="Hart et al. (2013), Frontiers in Zoology - https://pmc.ncbi.nlm.nih.gov/articles/PMC3882779/" "$OUT"
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,pix_fmt,duration,nb_frames,sample_rate,channels -show_entries format=duration,size,bit_rate -of default=nw=1 "$OUT"
