#!/bin/bash
# Verificações do vídeo final: formato, quadros pretos/congelados, cortes e loudness.
V=${1:-entrega/o-gps-secreto-dos-cachorros_9x16_1080x1920_30fps.mp4}
echo "== formato"; ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,profile,width,height,r_frame_rate,pix_fmt,color_space,nb_frames,duration -of default=nw=1 "$V"
ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,sample_rate,channels,duration -of default=nw=1 "$V"
echo "== quadros pretos (esperado: nenhum)"; ffmpeg -hide_banner -nostats -i "$V" -vf blackdetect=d=0.04:pix_th=0.06 -an -f null - 2>&1 | grep -E "black_start" || echo "nenhum"
echo "== congelamentos (esperado: ~35,6 s, o 'congelamento rápido de quadro' da cena 5)"; ffmpeg -hide_banner -nostats -i "$V" -vf "freezedetect=n=-55dB:d=0.2" -an -f null - 2>&1 | grep -E "freeze_(start|duration)" || echo "nenhum"
echo "== cortes (mudança de cena > 0,35)"; ffmpeg -hide_banner -nostats -i "$V" -vf "select='gt(scene,0.35)',showinfo" -an -f null - 2>&1 | grep -oE "pts_time:[0-9.]+" | sed 's/pts_time://' | tr '\n' ' '; echo
echo "== loudness"; ffmpeg -hide_banner -nostats -i "$V" -af ebur128=peak=true -vn -f null - 2>&1 | grep -E "^\s+(I:|LRA:|Peak:)" | tail -4
