"""Narração pt-BR (Kokoro-82M via ONNX) + tempo de cada palavra para as legendas.

Saídas:
  audio/build/narration_<voz>.wav   faixa de voz (48 kHz mono) já posicionada na linha do tempo de 45 s
  audio/build/timing_<voz>.json     início/fim das falas e das palavras (segundos globais)
Uso: python3 -I audio/narration.py [voz] [velocidade-base]
"""
import json, os, re, sys
import numpy as np, soundfile as sf
from scipy import signal
from kokoro_onnx import Kokoro

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(HERE, 'build'); os.makedirs(OUT, exist_ok=True)
VOICE = sys.argv[1] if len(sys.argv) > 1 else 'pf_dora'
BASE_SPEED = float(sys.argv[2]) if len(sys.argv) > 2 else 1.04
SR = 48000

# fala exibida/legendada  ->  texto enviado ao TTS (números por extenso)
LINES = [
    dict(scene=1, start=0.30, until=4.95,  show="Você sabia que seu cachorro pode ter uma bússola escondida no corpo?",
         tts="Você sabia que seu cachorro pode ter uma bússola escondida no corpo?"),
    dict(scene=2, start=5.25, until=11.9, clause=0.46, sentence=0.3,  show="Sabe quando ele fica rodando, rodando, antes de fazer cocô?",
         tts="Sabe quando ele fica rodando, rodando, antes de fazer cocô?"),
    dict(scene=3, start=12.30, until=20.9, show="Cientistas descobriram algo bizarro: em certas condições, cachorros preferem se alinhar com o campo magnético da Terra!",
         tts="Cientistas descobriram algo bizarro: em certas condições, cachorros preferem se alinhar com o campo magnético da Terra!"),
    dict(scene=4, start=21.25, until=31.9, show="O estudo observou 70 cães e percebeu que, quando o campo magnético estava estável, eles tendiam a ficar na direção norte-sul na hora do cocô!",
         tts="O estudo observou setenta cães e percebeu que, quando o campo magnético estava estável, eles tendiam a ficar na direção norte-sul na hora do cocô!"),
    dict(scene=5, start=32.30, until=38.9, show="Mas calma! Isso não acontece sempre, e os cientistas ainda não sabem exatamente por quê.",
         tts="Mas calma! Isso não acontece sempre, e os cientistas ainda não sabem exatamente por quê."),
    dict(scene=6, start=39.10, until=44.75, clause=0.12, sentence=0.22, show="Ou seja… até pra fazer cocô, seu cachorro pode estar consultando o planeta! Você já reparou nisso?",
         tts="Ou seja, até pra fazer cocô, seu cachorro pode estar consultando o planeta! Você já reparou nisso?"),
]

M = os.path.join(ROOT, 'assets', 'models')
PATCHED = os.path.join(M, 'kokoro-v1.0-timed.onnx')
if not os.path.exists(PATCHED):   # expõe a duração por fonema (já calculada internamente pelo modelo)
    import onnx
    from onnx import helper, TensorProto
    mm = onnx.load(os.path.join(M, 'kokoro-v1.0.onnx'))
    mm.graph.node.append(helper.make_node('Identity', ['/encoder/Cast_output_0'], ['duration'], name='expose_duration'))
    mm.graph.output.append(helper.make_tensor_value_info('duration', TensorProto.INT64, None))
    onnx.save(mm, PATCHED)
k = Kokoro(PATCHED, os.path.join(M, 'voices-v1.0.bin'))
PUNCT = set(',.!?:;…-—')


def synth(text, speed, clause=0.14, sentence=0.32):
    s, sr, spoken = k.create_timed(text, voice=VOICE, speed=speed, lang='pt-br', sentence_pause=sentence, clause_pause=clause)
    s = np.asarray(s, dtype=np.float64)
    a = np.abs(s); idx = np.where(a > 0.012)[0]
    head = max(idx[0] - int(0.02 * sr), 0)
    s = s[head: min(len(s), idx[-1] + int(0.05 * sr))]
    spoken = [(t.phoneme, t.start - head / sr, t.end - head / sr) for t in spoken]
    s = signal.resample_poly(s, SR, sr)
    f = int(0.012 * SR); s[:f] *= np.linspace(0, 1, f); s[-f:] *= np.linspace(1, 0, f)
    return s, spoken


def count_syll(w):
    w = w.lower()
    g = re.findall(r'[aeiouáéíóúâêôãõàü]+', w)
    return max(1, len(g))


def envelope(x, win=0.010):
    n = int(win * SR)
    e = np.sqrt(np.convolve(x * x, np.ones(n) / n, mode='same'))
    return e


def align_words(spoken, text, t0):
    """Agrupa os fonemas (separados pelo fonema ' ') em palavras e devolve [{w,t0,t1}] em segundos globais."""
    groups, cur = [], []
    for ph, a, b in spoken:
        if ph == ' ':
            if cur: groups.append(cur); cur = []
        else: cur.append((ph, a, b))
    if cur: groups.append(cur)
    toks = [(t, False) for t in text.split()]
    if len(groups) != len(toks):
        print(f'  AVISO: {len(groups)} grupos de fonemas vs {len(toks)} palavras ({text[:40]}...)')
    words = []
    for i, (tok, join) in enumerate(toks):
        g = groups[min(i, len(groups) - 1)]
        voiced = [x for x in g if x[0] not in PUNCT] or g
        a, b = voiced[0][1], voiced[-1][2]
        words.append(dict(w=tok, t0=a, t1=b, join=join))
    # junta palavras hifenizadas (norte-sul) em um único token de legenda
    out = []
    for w in words:
        if out and out[-1].get('join'):
            prev = out.pop(); w = dict(w=prev['w'] + w['w'], t0=prev['t0'], t1=w['t1'], join=w['join'])
        out.append(w)
    # fim de cada palavra se estende até o início da próxima (sem buracos), limitado a 0,35 s de pausa
    for i, w in enumerate(out):
        nxt = out[i + 1]['t0'] if i + 1 < len(out) else w['t1']
        w['t1'] = min(max(w['t1'], nxt - 0.0), w['t1'] + 0.35) if i + 1 < len(out) else w['t1']
    return [dict(w=w['w'], t0=round(t0 + w['t0'], 3), t1=round(t0 + w['t1'], 3)) for w in out]


timeline = np.zeros(int(45.0 * SR))
timing = dict(voice=VOICE, lines=[])
for L in LINES:
    sp = BASE_SPEED
    for _ in range(8):  # ajusta velocidade p/ caber na janela da cena
        a, spoken = synth(L['tts'], sp, L.get('clause', 0.14), L.get('sentence', 0.32))
        d = len(a) / SR
        if L['start'] + d <= L['until'] or sp >= 1.28: break
        sp = round(sp + 0.04, 3)
    print(f"cena {L['scene']}: {d:5.2f}s  speed={sp}  fim={L['start'] + d:6.2f}  (limite {L['until']})")
    i0 = int(L['start'] * SR); timeline[i0:i0 + len(a)] += a
    words = align_words(spoken, L['show'], L['start'])
    timing['lines'].append(dict(scene=L['scene'], start=round(L['start'], 3), end=round(L['start'] + d, 3), speed=sp, text=L['show'], words=words))

pk = np.max(np.abs(timeline)); timeline = timeline / pk * 0.89
# HPF 85 Hz + presença leve (+2 dB @ 3.2 kHz)
b, a_ = signal.butter(2, 85 / (SR / 2), 'high'); timeline = signal.lfilter(b, a_, timeline)
sf.write(os.path.join(OUT, f'narration_{VOICE}.wav'), timeline.astype(np.float32), SR)
json.dump(timing, open(os.path.join(OUT, f'timing_{VOICE}.json'), 'w'), ensure_ascii=False, indent=1)
print('ok ->', OUT)
