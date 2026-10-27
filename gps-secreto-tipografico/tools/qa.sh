#!/bin/bash
# Verificações do MP4 final: formato, quadros, loudness, pretos/congelamentos inesperados; gera capa e folha de contato.
# uso: tools/qa.sh [arquivo.mp4]
cd "$(dirname "$0")/.."
F=${1:-entrega/o-gps-secreto-dos-cachorros_9x16_1080x1920_30fps.mp4}
echo "== formato"; ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,profile,width,height,r_frame_rate,pix_fmt,color_space,nb_frames,duration -of default=nw=1 "$F"
ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,sample_rate,channels,duration -of default=nw=1 "$F"
echo "== contagem real de quadros"; ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of default=nw=1 "$F"
echo "== loudness"; ffmpeg -hide_banner -nostats -i "$F" -vn -af loudnorm=I=-14:TP=-2.5:LRA=11:print_format=summary -f null - 2>&1 | grep -E "Input Integrated|Input True Peak|Input LRA"
echo "== pretos (esperado só no fim)"; ffmpeg -hide_banner -nostats -i "$F" -vf "blackdetect=d=0.1:pix_th=0.12" -an -f null - 2>&1 | grep -E "black_start" || echo "nenhum"
echo "== congelamentos >0,7 s"; ffmpeg -hide_banner -nostats -i "$F" -vf "freezedetect=n=-55dB:d=0.7" -an -f null - 2>&1 | grep -E "freeze_(start|duration)" || echo "nenhum"
mkdir -p entrega
ffmpeg -hide_banner -loglevel error -y -ss 1.8 -i "$F" -frames:v 1 entrega/capa_1080x1920.png
ffmpeg -hide_banner -loglevel error -y -i "$F" -vf "fps=1,scale=216:384,tile=9x5" -frames:v 1 entrega/contato_1s.png
ls -la entrega
