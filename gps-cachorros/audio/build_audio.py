"""Trilha + efeitos + mixagem final (45 s, 48 kHz estéreo).

Uso: python3 -I audio/build_audio.py [voz]
Entradas : audio/build/narration_<voz>.wav, audio/build/timing_<voz>.json
Saída    : audio/build/mix_<voz>.wav
Tudo é sintetizado em código (sem amostras externas): 120 BPM, seções alinhadas às cenas.
"""
import json, os, sys
import numpy as np, soundfile as sf
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import synth as S
from synth import SR, midi

VOICE = sys.argv[1] if len(sys.argv) > 1 else 'pf_dora'
BUILD = os.path.join(HERE, 'build')
N = 45 * SR
BEAT = 0.5

vox, vsr = sf.read(os.path.join(BUILD, f'narration_{VOICE}.wav')); assert vsr == SR
vox = vox if vox.ndim == 1 else vox[:, 0]
vox = np.pad(vox, (0, max(0, N - len(vox))))[:N]


def new():
    return np.zeros((N, 2))


def place(buf, x, t, gain=1.0, pan=0.0):
    if t < 0: x = x[int(-t * SR):]; t = 0
    if x.ndim == 1: x = S.pan_lr(x, pan)
    i = int(round(t * SR)); j = min(N, i + len(x))
    if j > i: buf[i:j] += x[: j - i] * gain


def pingpong(x, delay=0.375, fb=0.38, mix=0.4, taps=4):
    out = x.copy(); d = int(delay * SR)
    for k in range(1, taps + 1):
        sh = np.zeros_like(x); sh[d * k:] = x[: len(x) - d * k][:, ::-1] * (fb ** k) * mix
        out += sh
    return out


# ================================================================ TRILHA
kick_t = []          # tempos dos bumbos (sidechain)
drums, bass, pads, arps, lead = new(), new(), new(), new(), new()
CH = {  # (raiz do baixo, notas do arpejo)
    'C': (48, [60, 64, 67, 72]), 'Am': (45, [57, 60, 64, 69]), 'F': (41, [57, 60, 65, 69]), 'G': (43, [59, 62, 67, 71]),
}
LEAD = {'C': [76, 79, 76, 74, 72, None, 74, 76], 'Am': [72, 76, 81, 79, 76, None, 72, None], 'F': [77, 76, 74, 72, 69, None, 72, 74], 'G': [79, 77, 76, 74, 71, 74, 76, None]}


def groove(t0, t1, chords, full=True, sixteenth=False, hats16=False, arp_gain=0.5, lead_on=True, bass_on=True, kick_gain=1.0):
    """chords: lista de (inicio, fim, nome). Bateria 4x4 + baixo sincopado + arpejo + melodia."""
    t = t0
    while t < t1 - 1e-6:
        pos = ((t - t0) / BEAT) % 4          # posição na barra (batidas)
        k = S.kick() * 0.9 * kick_gain; place(drums, k, t, 1.0, 0.0); kick_t.append(t)
        if int(round(pos)) in (1, 3): place(drums, S.clap(), t, 0.6, 0.05)
        t += BEAT
    # hats
    t = t0
    while t < t1 - 1e-6:
        place(drums, S.hat(False), t + 0.25, 0.30, 0.25)
        if hats16:
            place(drums, S.hat(False), t + 0.125, 0.14, -0.2); place(drums, S.hat(False), t + 0.375, 0.14, 0.2)
        if int(round(((t - t0) / BEAT) % 4)) == 3: place(drums, S.hat(True), t + 0.25, 0.22, 0.1)
        t += BEAT
    for (c0, c1, name) in chords:
        c0 = max(c0, t0); c1 = min(c1, t1)
        if c1 <= c0: continue
        root, tones = CH[name]
        if bass_on:
            for b, dur, oct_ in [(0, 0.45, 0), (0.75, 0.2, 0), (1.5, 0.45, 12), (2.0, 0.45, 0), (2.75, 0.2, 0), (3.5, 0.4, 12)]:
                tb = c0 + b * BEAT
                while tb < c1 - 0.05:
                    place(bass, S.bass_note(midi(root + oct_), dur + 0.1), tb, 0.85)
                    tb += 2.0
                    break
            # repete o padrão a cada barra de 2 s dentro do acorde
            tb0 = c0 + 2.0
            while tb0 < c1 - 0.05:
                for b, dur, oct_ in [(0, 0.45, 0), (0.75, 0.2, 0), (1.5, 0.45, 12), (2.0, 0.45, 0), (2.75, 0.2, 0), (3.5, 0.4, 12)]:
                    if tb0 + b * BEAT < c1 - 0.05: place(bass, S.bass_note(midi(root + oct_), dur + 0.1), tb0 + b * BEAT, 0.85)
                tb0 += 2.0
        # arpejo 16avos
        step = 0.125; ta = c0; i = 0; pat = [0, 1, 2, 3, 2, 1, 3, 2]
        while ta < c1 - 1e-6:
            if i % 2 == 0 or sixteenth:
                note = tones[pat[i % 8]] + (12 if (i // 8) % 2 else 0)
                place(arps, S.pluck(midi(note), 0.28), ta, arp_gain * (1.0 if i % 4 == 0 else 0.6), (-0.35 if i % 2 else 0.35))
            ta += step; i += 1
        # melodia
        if lead_on and name in LEAD:
            tm = c0
            while tm < c1 - 1e-6:
                for j, n in enumerate(LEAD[name]):
                    if n is not None and tm + j * 0.25 < c1 - 1e-6: place(lead, S.marimba(midi(n), 0.45), tm + j * 0.25, 0.42, 0.0)
                tm += 2.0


def pad_section(t0, t1, chords, cut=1400, gain=0.5):
    for (c0, c1, tones) in chords:
        place(pads, S.pad_chord([midi(m) for m in tones], c1 - c0 + 0.8, cut), c0, gain)


# ---- Seção 1+2 (0–12): gancho e voltas
groove(0.0, 12.0, [(0, 2, 'C'), (2, 4, 'Am'), (4, 6, 'F'), (6, 8, 'G'), (8, 10, 'C'), (10, 12, 'Am')], hats16=False, arp_gain=0.42)
pad_section(0, 12, [(0, 4, [48, 55, 60, 64]), (4, 8, [45, 53, 57, 60]), (8, 12, [48, 55, 60, 64])], 1600, 0.22)

# ---- Seção 3 (12–21): espaço — pads largos, arpejo com eco, pulso suave
pad_section(12, 21, [(12, 14, [45, 52, 57, 60, 64, 71]), (14, 16, [41, 48, 53, 57, 60, 64]), (16, 18, [48, 55, 59, 64, 67]), (18, 21, [43, 50, 55, 59, 62, 69])], 1500, 1.3)
for k, (c0, name_tones) in enumerate([(12, [69, 72, 76, 79]), (14, [65, 69, 72, 76]), (16, [67, 71, 76, 79]), (18, [67, 69, 74, 79])]):
    for i in range(16):
        place(arps, S.pluck(midi(name_tones[[0, 1, 2, 3, 2, 1, 3, 2][i % 8]]), 0.5, 0.7), c0 + i * 0.125, 0.42 * (1 if i % 4 == 0 else 0.5), (-0.5 if i % 2 else 0.5))
for t in np.arange(14.0, 21.0, 2.0):
    place(drums, S.kick(0.3, 130, 42) * 0.7, t, 0.6); kick_t.append(float(t))
for t in np.arange(12.0, 21.0, 0.5): place(drums, S.hat(False), t + 0.25, 0.10, 0.3)
bass_space = [(12, 2, 33), (14, 2, 29), (16, 2, 36), (18, 3, 31)]
for t0, d, m in bass_space: place(bass, S.bass_note(midi(m), d, 260), t0, 0.7)

# ---- Seção 4 (21–32): ciência — groove tecnológico
groove(21.0, 31.75, [(21, 23, 'Am'), (23, 25, 'F'), (25, 27, 'C'), (27, 29, 'G'), (29, 31.75, 'Am')], hats16=True, sixteenth=True, arp_gain=0.38, lead_on=False, kick_gain=1.0)
pad_section(21, 31.8, [(21, 25, [57, 60, 64, 69]), (25, 29, [55, 60, 64, 67]), (29, 31.8, [57, 60, 64, 71])], 1200, 0.28)

# ---- Seção 5 (32–39): suspense
for t in np.arange(32.5, 35.4, 1.0): place(drums, S.thud(0.22, 70) * 1.1, float(t), 0.9); place(drums, S.thud(0.22, 70) * 0.8, float(t) + 0.28, 0.7)
for t in np.arange(35.88, 38.9, 1.0): place(drums, S.thud(0.22, 70) * 1.1, float(t), 0.9); place(drums, S.thud(0.22, 70) * 0.8, float(t) + 0.28, 0.7)
tt = S.tt(7.2)
drone = (np.sin(2 * np.pi * midi(28) * tt) * 0.7 + (2 * ((tt * midi(40)) % 1) - 1) * 0.15 * (0.6 + 0.4 * np.sin(2 * np.pi * 0.3 * tt)))
drone = S.lp(drone, 380) * np.minimum(1, tt / 0.6)
place(bass, drone, 32.0, 1.0)
cluster = sum(np.sin(2 * np.pi * midi(m) * tt + k) for k, m in enumerate([52, 53, 58, 64, 59])) * (0.5 + 0.5 * np.sin(2 * np.pi * 5.5 * tt)) ** 1.2 * 0.08
place(pads, S.lp(np.stack([cluster, cluster[::-1]], 1), 1800) * np.minimum(1, tt / 1.2)[:, None], 32.0, 1.0)
for t in np.arange(32.25, 38.9, 0.5): place(arps, S.tick(2100, 0.01, 0.6), float(t), 0.22, 0.5 if int(t * 2) % 2 else -0.5)

# ---- Seção 6 (39–45): final — volta divertida, resolve em dó maior
groove(39.0, 44.6, [(39, 41, 'C'), (41, 43, 'F'), (43, 44, 'G'), (44, 44.6, 'C')], hats16=True, arp_gain=0.45, lead_on=True, kick_gain=1.0)
pad_section(39, 45, [(39, 43, [48, 55, 60, 64, 67]), (43, 45, [43, 50, 55, 59, 62, 67])], 1900, 0.35)
for n in (60, 64, 67, 72, 76): place(lead, S.marimba(midi(n), 0.9), 44.55 + 0.02 * (n - 60) / 4, 0.5, 0.0)
place(drums, S.hat(True) * 2.0, 44.55, 0.8)

# sidechain pelo bumbo + automações
def duck_from(times, depth=0.55, rel=0.11):
    env = np.ones(N)
    for t in times:
        i = int(t * SR); j = min(N, i + int(0.45 * SR))
        if j > i: env[i:j] = np.minimum(env[i:j], 1 - depth * np.exp(-np.arange(j - i) / SR / rel))
    return env


duck = duck_from(kick_t)[:, None]
music = drums * 0.9 + (bass * 0.85 + pads * 0.9 + arps * 0.85 + lead * 0.8) * duck
arp_echo = pingpong(arps * duck, 0.375, 0.42, 0.45, 3) - arps * duck
music = music + arp_echo * 0.85

# automação da trilha: entrada 0.0, cortes dramáticos (disco riscado e congelamento)
g = np.ones(N); tgrid = np.arange(N) / SR
def ramp_gain(t0, t1, v0, v1):
    i, j = int(t0 * SR), int(t1 * SR); g[i:j] = np.linspace(v0, v1, j - i); return j
g[int(31.75 * SR):int(32.0 * SR)] = np.linspace(1, 0.0, int(0.25 * SR))     # morre no riscar do disco
g[int(32.0 * SR):int(36.0 * SR)] = 0.0; g[int(36.0 * SR):int(36.4 * SR)] = 0.0   # suspense usa só as camadas dedicadas
g_sus = np.zeros(N); g_sus[int(32.0 * SR):int(39.0 * SR)] = 1.0
f0, f1 = int(35.58 * SR), int(35.88 * SR)
g_sus[f0:f1] = 0.0                                                          # congelamento: silêncio
g_sus[f0 - int(0.04 * SR):f0] = np.linspace(1, 0, int(0.04 * SR))
# na seção 5 as camadas de bass/pads/arps/drums foram posicionadas direto; aplicamos g_sus somente nelas
sus_idx = (tgrid >= 32.0) & (tgrid < 39.0)
music[sus_idx] = (drums[sus_idx] * 0.9 + (bass[sus_idx] * 0.85 + pads[sus_idx] * 0.9 + arps[sus_idx] * 0.85) * 1.0) * g_sus[sus_idx][:, None]
music[(tgrid >= 31.75) & (tgrid < 32.0)] *= g[(tgrid >= 31.75) & (tgrid < 32.0)][:, None]
# nível da trilha por seção
lvl = np.interp(tgrid, [0, 5, 12, 12.01, 20.5, 21, 31.7, 32, 38.4, 39, 39.5, 44.4, 45], [0.95, 1.0, 1.0, 0.85, 0.85, 1.0, 1.0, 0.9, 0.9, 1.1, 1.05, 1.05, 0.9])
music *= lvl[:, None]
# fade final curtíssimo
music[int(44.78 * SR):] *= np.linspace(1, 0.0, N - int(44.78 * SR))[:, None]

# ================================================================ EFEITOS
sfx = new(); rev_send = np.zeros(N)
rs = np.random.default_rng(11)
PENTA = [72, 74, 76, 79, 81, 84, 86, 88]


def X(t, snd, gain=1.0, pan=0.0, rev=0.0):
    place(sfx, snd, t, gain, pan)
    if rev > 0:
        m = snd if snd.ndim == 1 else snd.mean(axis=1); i = int(round(t * SR)); j = min(N, i + len(m))
        if j > i: rev_send[i:j] += m[: j - i] * rev


def decel_ticks(t0, t1, dt0=0.04, grow=1.12, f=3000, gain=0.35, pan=0.0):
    t = t0; dt = dt0; k = 0
    while t < t1:
        X(t, S.tick(f * (1 + 0.03 * (k % 3)), 0.011), gain, pan); t += dt; dt *= grow; k += 1


def tech_pop(t, gain=0.7, f0=1100, pan=0.0):
    X(t, S.pop(f0, 190, 0.13), gain, pan, rev=0.15)


def clap_roll(t0, t1, g0=0.25, g1=1.0, dt0=0.25, shrink=0.86, snare_like=True):
    t = t0; dt = dt0
    while t < t1 - 0.02:
        g = g0 + (g1 - g0) * (t - t0) / (t1 - t0)
        X(t, S.clap(), g * 0.9, 0.0, 0.05)
        t += dt; dt = max(dt * shrink, 0.045)


# ---- Cena 1
X(0.0, S.whoosh(0.75, 350, 6500, 1.5, 0.55), 0.85, 0.0, 0.1); tech_pop(0.02, 0.9, 1400)
for i in range(12):
    tl = -0.18 + i * 0.035 + 0.18 + 0.0
    if tl > 0.03: X(tl, S.blip(float(midi(PENTA[i % 8]) * 1.0), 0.05), 0.16, float(rs.uniform(-0.4, 0.4)))
X(0.95, S.boom(0.9, 95, 45), 0.5, 0.0, 0.1); X(0.9, S.whoosh(0.35, 800, 5000, 1.5, 0.7), 0.5); tech_pop(1.0, 0.7, 900)
X(1.9, S.whoosh(0.3, 500, 5500, 1.4, 0.6), 0.55)                             # corte (punch)
X(2.15, S.whoosh(0.4, 3000, 700, 1.6, 0.4), 0.28)
X(2.35, S.riser(0.62, 500, 5200), 0.55, 0.0, 0.1); tech_pop(2.45, 0.7, 1300); X(2.65, S.ding(1175, 1.0), 0.45, 0.2, 0.3)
decel_ticks(2.55, 3.95, 0.035, 1.1, 3300, 0.32, 0.25)
X(3.35, S.whoosh(0.3, 500, 5500, 1.4, 0.6), 0.5)
X(4.35, S.whoosh(0.8, 300, 5200, 1.5, 0.7), 0.85, 0.0, 0.1)                   # whip para a cena 2
# ---- Cena 2
tech_pop(5.35, 0.7, 1000); X(5.5, S.pop(1500, 300, 0.1), 0.4, -0.3)
X(5.55, S.whoosh(0.35, 1500, 6000, 1.5, 0.5), 0.35, 0.3); tech_pop(5.62, 0.5, 1700, -0.5)
X(5.7, S.whoosh(0.7, 600, 4500, 1.6, 0.4), 0.45); X(5.9, S.boom(0.6, 80, 50), 0.3)
# passinhos divertidos (a partir da integral da velocidade angular, mesma fórmula da animação)
def inout(x): x = np.clip(x, 0, 1); return np.where(x < 0.5, 4 * x ** 3, 1 - (-2 * x + 2) ** 3 / 2)
dts = 1 / 480; ts = np.arange(5.0, 12.0, dts)
omega = (inout((ts - 5.0) / 0.7) * 4.3 + inout((ts - 7.2) / 1.4) * 2.3 - inout((ts - 9.5) / 1.1) * 6.0).clip(min=0)
theta = np.cumsum(omega) * dts; gait = theta * 0.62 / 0.52 * 2 * np.pi
step_idx = np.floor(gait / (np.pi / 2)).astype(int); changes = np.where(np.diff(step_idx) > 0)[0]
for n_, ci in enumerate(changes):
    t = float(ts[ci]); w = float(omega[ci])
    if t < 5.2 or t > 10.9 or w < 0.3: continue
    X(t, S.blip(float(midi(PENTA[(n_ * 3) % 5] - 12)), 0.06), 0.17 * min(1, w / 3.5), float(((n_ % 2) - 0.5) * 0.6))
    if n_ % 2 == 0: X(t, S.thud(0.08, 160), 0.14 * min(1, w / 3.5), 0.0)
lap_t = [float(ts[np.searchsorted(theta, 2 * np.pi * k)]) for k in range(1, 6) if np.searchsorted(theta, 2 * np.pi * k) < len(ts)]
for k, tl in enumerate(lap_t): X(tl, S.ding(float(midi([72, 76, 79, 81, 84][k])), 0.7), 0.45, 0.3, 0.2); X(tl, S.pop(1400, 250, 0.09), 0.4)
for tw in (6.36, 7.30): X(tw, S.tick(2600, 0.02), 0.35); X(tw + 0.02, S.pop(900, 220, 0.1), 0.35)
X(6.9, S.whoosh(0.3, 500, 5500, 1.4, 0.6), 0.5)
X(9.4, S.riser(0.2, 600, 4000, False), 0.3)
X(9.5, S.whoosh(0.55, 250, 6500, 1.5, 0.35), 0.8, 0.0, 0.1); X(9.5, S.impact(1.2, 0.8), 0.45, 0.0, 0.1); X(9.55, S.boing(0.6, 260), 0.45, 0.2)
decel_ticks(9.7, 11.4, 0.05, 1.14, 1800, 0.4, -0.3)                          # roleta desacelerando
X(10.15, S.sparkle(1.0), 0.45, -0.3, 0.3); X(10.65, S.sparkle(1.0), 0.4, 0.3, 0.3)
X(10.9, S.boing(0.7, 220), 0.3, 0.0)
X(11.35, S.riser(0.7, 300, 9000), 0.9, 0.0, 0.15); clap_roll(10.95, 11.95, 0.25, 0.9, 0.25, 0.84)                            # chicote para o céu
# ---- Cena 3
X(11.9, S.impact(2.4, 1.0), 0.8, 0.0, 0.3); X(11.9, S.whoosh(0.7, 4000, 300, 1.3, 0.3), 0.6)
X(12.85, S.riser(1.8, 500, 6500), 0.28, 0.0, 0.3)
X(13.25, S.whoosh(0.5, 400, 5000, 1.5, 0.5), 0.4); tech_pop(13.3, 0.55, 800); X(13.6, S.boom(1.0, 90, 40), 0.5, 0.0, 0.2); X(13.62, S.whoosh(0.4, 600, 5200, 1.5, 0.5), 0.4)
tech_pop(14.2, 0.45, 1500, -0.4); tech_pop(14.5, 0.45, 1300, 0.4)
X(14.9, S.whoosh(0.3, 500, 5500, 1.4, 0.6), 0.5)
X(16.1, S.riser(0.7, 500, 5200), 0.5, 0.0, 0.2); tech_pop(16.2, 0.55, 1300); X(16.4, S.ding(1319, 1.2), 0.4, 0.2, 0.4)
decel_ticks(16.3, 17.45, 0.04, 1.1, 3300, 0.28, 0.2)
X(17.3, S.sparkle(0.9), 0.45, 0.3, 0.3); tech_pop(17.3, 0.5, 1700)
X(17.9, S.whoosh(0.3, 500, 5500, 1.4, 0.6), 0.5)
X(18.05, S.impact(1.4, 0.7), 0.5, 0.0, 0.3); X(18.1, S.ding(880, 1.4), 0.4, 0.0, 0.4); X(18.1, S.ding(1319, 1.4), 0.3, 0.2, 0.4)
X(19.0, S.riser(2.0, 300, 9500), 1.5, 0.0, 0.2); clap_roll(19.55, 20.95, 0.25, 1.0, 0.25, 0.86)
X(20.6, S.whoosh(0.5, 300, 7000, 1.5, 0.8), 0.7)
# ---- Cena 4
X(20.95, S.impact(2.0, 1.0), 0.9, 0.0, 0.3); X(20.98, S.zap(0.35), 0.4); X(21.0, S.sparkle(1.0), 0.4, 0.0, 0.4)
tech_pop(21.25, 0.5, 1500, -0.5); X(21.3, S.riser(0.5, 800, 5000), 0.3)
for i in range(6): X(21.5 + i * 0.12, S.tick(2000 + 220 * i, 0.012), 0.22, 0.3)
for i in range(13): X(22.0 + i * 0.037, S.tick(1000 + 190 * i, 0.012), 0.3 + 0.02 * i, 0.0)          # contagem até 70
X(22.27, S.impact(1.8, 1.0), 0.85, 0.0, 0.3); X(22.27, S.boom(1.4, 85, 38), 0.6); X(22.3, S.whoosh(0.4, 500, 5000, 1.5, 0.5), 0.45)
X(22.55, S.whoosh(0.35, 1200, 6000, 1.5, 0.5), 0.35, 0.2)
tech_pop(23.1, 0.55, 1300, -0.4); tech_pop(23.45, 0.55, 1500, 0.4)
X(24.25, S.riser(0.5, 500, 5500), 0.4, 0.0, 0.2); tech_pop(24.3, 0.55, 1100)
for i in range(24): X(24.55 + i * 0.022, S.tick(1100 + 90 * i, 0.012), 0.2, (i / 24 - 0.5) * 0.6)    # barras crescendo
X(24.5, S.ding(1320, 0.9), 0.35, 0.3, 0.3)
X(26.55, S.zap(0.3), 0.5, 0.0, 0.1); X(26.6, S.ding(1760, 1.0), 0.35, 0.0, 0.3)
X(26.85, S.whoosh(0.3, 500, 5500, 1.4, 0.6), 0.5)
tech_pop(27.4, 0.5, 1500, -0.4); tech_pop(27.5, 0.5, 1800, 0.4)
X(27.95, S.whoosh(0.4, 4000, 900, 1.4, 0.4), 0.35)
X(28.22, S.impact(1.6, 1.0), 0.8, 0.0, 0.3); X(28.25, S.whoosh(0.5, 500, 5200, 1.5, 0.45), 0.5)
X(29.35, S.whoosh(0.3, 500, 5500, 1.4, 0.6), 0.5)
X(31.4, S.riser(0.55, 300, 6000), 0.4, 0.0, 0.1)
# ---- Cena 5
X(31.95, S.scratch(0.4), 0.9, 0.0, 0.05); X(32.0, S.glitch(0.3, 1.0), 0.55, -0.2); X(32.0, S.boom(1.3, 70, 36), 0.7, 0.0, 0.2)
X(32.2, S.glitch(0.2, 0.9), 0.4, 0.3)
X(33.3, S.thud(0.3, 90), 0.9, 0.0); X(33.35, S.boom(0.8, 75, 38), 0.5, 0.0, 0.2)
for i in range(10): X(33.35 + i * 0.04, S.blip(float(midi(PENTA[i % 8] - 12)), 0.05), 0.12, float(rs.uniform(-0.5, 0.5)))
X(33.9, S.glitch(0.16, 0.8), 0.45, 0.2)
X(34.45, S.boing(0.6, 280), 0.6, 0.2, 0.1); X(34.47, S.pop(700, 200, 0.12), 0.5)
X(35.5, S.glitch(0.12, 1.0), 0.6, 0.0); X(35.52, S.tapestop(0.55), 0.7, 0.0, 0.05)
X(35.88, S.impact(1.8, 0.6), 0.75, 0.0, 0.4); X(35.9, S.whoosh(0.6, 300, 4200, 1.5, 0.3), 0.4)
tech_pop(36.75, 0.5, 700); X(37.3, S.glitch(0.16, 0.8), 0.4, -0.3)
X(38.1, S.riser(0.9, 250, 8500), 1.4, 0.0, 0.15); clap_roll(38.2, 38.95, 0.3, 1.0, 0.2, 0.84)
# ---- Cena 6
X(38.95, S.impact(1.8, 1.0), 0.8, 0.0, 0.25); X(38.98, S.whoosh(0.4, 600, 6000, 1.5, 0.5), 0.5); X(39.0, S.sparkle(1.0), 0.45, 0.0, 0.3); tech_pop(39.02, 0.6, 1400)
decel_ticks(39.25, 42.4, 0.03, 1.035, 3400, 0.2, 0.3)
X(41.95, S.sparkle(1.0), 0.45, 0.3, 0.3); X(42.0, S.riser(0.5, 800, 6500), 0.35, 0.0, 0.2)
X(43.3, S.boing(0.5, 330), 0.4, 0.1)
tech_pop(43.42, 0.65, 1000); X(43.45, S.ding(1047, 1.2), 0.4, -0.2, 0.3); X(43.45, S.ding(1319, 1.2), 0.3, 0.2, 0.3)
X(43.85, S.blip(float(midi(88)), 0.08), 0.35, 0.3); X(43.88, S.sparkle(0.9), 0.4, 0.3, 0.3)
X(44.52, S.impact(1.0, 0.8), 0.4, 0.0, 0.3); X(44.55, S.sparkle(0.8), 0.45, 0.0, 0.3)

# reverb nos envios
sfx_rev = S.reverb(rev_send, 1.8, 1.0, 5000, 0.015, wet_only=True)
sfx = sfx + sfx_rev * 0.6

# ================================================================ MIXAGEM
v = vox * 1.0
v_st = S.pan_lr(v, 0.0)
# presença/ar leve na voz + compressor (3:1, limiar -24 dBFS, ataque 4 ms / release 90 ms) + makeup
vp = S.hp(v, 90) + S.bp(v, 2500, 5200, 1) * 0.18
def compress(x, thr_db=-24.0, ratio=3.0, att=0.004, rel=0.09, makeup_db=7.0):
    a_att, a_rel = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR))
    ax = np.abs(x); e = signal.lfilter([1 - a_att], [1, -a_att], ax)                 # envelope rápido
    e = np.maximum(e, signal.lfilter([1 - a_rel], [1, -a_rel], ax))                    # com release
    db = 20 * np.log10(e + 1e-9); over = np.maximum(db - thr_db, 0)
    gain = 10 ** ((-over * (1 - 1 / ratio) + makeup_db) / 20)
    return x * gain
vp = compress(vp)
vp = np.tanh(vp * 1.1) / np.tanh(1.1) * 0.93
v_st = S.pan_lr(vp, 0.0)
env = np.abs(signal.hilbert(vp)); env = S.lp(env, 7, 1); env /= np.percentile(env, 98) + 1e-9
duck_v = 1 - 0.50 * np.clip(env * 1.4, 0, 1)
duck_s = 1 - 0.22 * np.clip(env * 1.4, 0, 1)
mix = v_st * 1.0 + music * 0.15 * duck_v[:, None] + sfx * 0.42 * duck_s[:, None]
mix = np.tanh(mix * 0.95) / np.tanh(0.95)
pk = np.max(np.abs(mix)); mix = mix / pk * 0.89
sf.write(os.path.join(BUILD, f'mix_{VOICE}.wav'), mix.astype(np.float32), SR)
rms = lambda x: 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
print('ok: duração', round(len(mix) / SR, 2), 's  pico', round(20 * np.log10(np.max(np.abs(mix))), 1), 'dBFS  RMS', round(rms(mix), 1), 'dBFS')
for a, b in [(0, 5), (5, 12), (12, 21), (21, 32), (32, 39), (39, 45)]:
    print(f'  {a:>2}-{b:<2}s  voz {rms(v_st[a*SR:b*SR]):6.1f}  trilha {rms(music[a*SR:b*SR] * 0.15):6.1f}  sfx {rms(sfx[a*SR:b*SR] * 0.42):6.1f}  mix {rms(mix[a*SR:b*SR]):6.1f}')
