#!/usr/bin/env python3
"""Trilha eletrônica (120 BPM) + efeitos sonoros — SEM VOZ — sintetizados em numpy e sincronizados aos eventos da linha do tempo visual.
uso: python3 -I audio/build_audio.py   (lê audio/build/events.json; escreve audio/build/mix.wav, 48 kHz estéreo)"""
import json, os, sys
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
DUR = 45.0
N = int((DUR + 2.0) * SR)
BEAT = 0.5
rng = np.random.default_rng(20240607)
HERE = os.path.dirname(os.path.abspath(__file__))
EV = json.load(open(os.path.join(HERE, 'build', 'events.json')))


# ----------------------------------------------------------------------------- utilidades DSP
def T(n): return np.arange(n) / SR
def midi(m): return 440.0 * 2 ** ((m - 69) / 12)
def sos(kind, fc, order=2): return signal.butter(order, fc, btype=kind, fs=SR, output='sos')
def lp(x, fc, order=2): return signal.sosfilt(sos('low', min(fc, SR * 0.45), order), x)
def hp(x, fc, order=2): return signal.sosfilt(sos('high', fc, order), x)
def bp(x, f1, f2, order=2): return signal.sosfilt(sos('band', [f1, min(f2, SR * 0.45)], order), x)
def noise(n): return rng.standard_normal(n).astype(np.float64)
def expenv(n, decay): return np.exp(-T(n) * decay)
def attack(n, a):
    e = np.ones(n); k = min(n, int(a * SR)); e[:k] = np.linspace(0, 1, k) ** 2; return e
def fade_out(n, r):
    e = np.ones(n); k = min(n, int(r * SR)); e[n - k:] = np.linspace(1, 0, k) ** 2; return e
def saw(freq, n, detune_cents=0.0):
    f = freq * 2 ** (detune_cents / 1200); ph = (np.cumsum(np.full(n, f / SR)) + rng.random()) % 1.0; return 2 * ph - 1
def sine(freq, n): return np.sin(2 * np.pi * np.cumsum(np.full(n, freq / SR)))
def sweep_sine(f0, f1, n, curve=6.0):
    t = T(n); f = f1 + (f0 - f1) * np.exp(-t * curve * 4 / max(1e-3, n / SR)); return np.sin(2 * np.pi * np.cumsum(f / SR))
def tanh_clip(x, g=1.0): return np.tanh(x * g)

L = np.zeros(N); R = np.zeros(N)
class Bus:
    def __init__(self): self.l = np.zeros(N); self.r = np.zeros(N)
    def add(self, sig, t, gain=1.0, pan=0.0):
        i = int(round(t * SR)); n = len(sig)
        if i < 0: sig = sig[-i:]; n = len(sig); i = 0
        if i >= N: return
        n = min(n, N - i); a = (pan + 1) * np.pi / 4; self.l[i:i + n] += sig[:n] * gain * np.cos(a); self.r[i:i + n] += sig[:n] * gain * np.sin(a)
    def stereo(self, l, r, t, gain=1.0):
        i = int(round(t * SR)); n = min(len(l), N - i)
        if i < 0 or n <= 0: return
        self.l[i:i + n] += l[:n] * gain; self.r[i:i + n] += r[:n] * gain

drums, bass, pad, arp, sfx, fxsend = Bus(), Bus(), Bus(), Bus(), Bus(), Bus()


# ----------------------------------------------------------------------------- instrumentos
def kick(v=1.0):
    n = int(0.5 * SR); t = T(n)
    f = 48 + 120 * np.exp(-t * 30); body = np.sin(2 * np.pi * np.cumsum(f / SR)) * np.exp(-t * 7.0)
    click = hp(noise(n), 3000) * np.exp(-t * 400) * 0.35
    return tanh_clip((body + click) * 1.6, 1.0) * v

def clap(v=1.0):
    n = int(0.35 * SR); t = T(n); x = bp(noise(n), 900, 4200)
    e = sum(np.exp(-np.clip(t - o, 0, None) * 90) * (t >= o) for o in (0.0, 0.011, 0.022)) * 0.5 + np.exp(-t * 14) * 0.5 * (t >= 0.03)
    return x * e * v * 0.9

def hat(v=1.0, open_=False):
    n = int((0.22 if open_ else 0.06) * SR); t = T(n); return hp(noise(n), 7500, 3) * np.exp(-t * (16 if open_ else 70)) * v * 0.5

def bass_note(f, dur, v=1.0):
    n = int(dur * SR); t = T(n); e = attack(n, 0.004) * fade_out(n, 0.04) * (0.55 + 0.45 * np.exp(-t * 5))
    x = lp(saw(f, n) * 0.6 + np.sign(sine(f, n)) * 0.25, 420, 2) + sine(f, n) * 0.9
    return x * e * v * 0.55

def pad_chord(freqs, dur, v=1.0, bright=1.0):
    n = int(dur * SR); e = attack(n, 0.5) * fade_out(n, 0.6); L_ = np.zeros(n); R_ = np.zeros(n)
    for f in freqs:
        L_ += saw(f, n, -9) + saw(f, n, 3) * 0.7; R_ += saw(f, n, 9) + saw(f, n, -3) * 0.7
    fc = 700 + 1600 * bright
    return lp(L_, fc) * e * v * 0.05, lp(R_, fc) * e * v * 0.05

def pluck(f, dur=0.5, v=1.0, bright=1.0):
    n = int(dur * SR); t = T(n); x = saw(f, n) * 0.6 + sine(f * 2, n) * 0.3 + sine(f, n) * 0.4
    x = lp(x, 2600 * bright + 600, 2)
    return x * np.exp(-t * 9.0) * attack(n, 0.002) * v * 0.5

def bell(f, dur=1.4, v=1.0):
    n = int(dur * SR); t = T(n); m = 3.0 * np.exp(-t * 5)
    ph = 2 * np.pi * np.cumsum(np.full(n, f / SR)); return np.sin(ph + m * np.sin(ph * 3.5)) * np.exp(-t * 2.6) * v * 0.5

def pingpong(sig, time, fb=0.4, mix=0.5, n_rep=5):
    n = len(sig); d = int(time * SR); out_l = np.zeros(n + d * n_rep); out_r = np.zeros(n + d * n_rep); out_l[:n] += sig * (1 - mix * 0)
    cur = sig * mix
    for k in range(1, n_rep + 1):
        tgt = out_r if k % 2 else out_l; tgt[k * d:k * d + n] += cur; cur = cur * fb
    out_l[:n] += sig * 0; return out_l, out_r

def reverb_ir(sec=1.8, seed=1):
    r = np.random.default_rng(seed); n = int(sec * SR); t = T(n); x = r.standard_normal(n) * np.exp(-t * (4.2 / sec * 1.6))
    x = lp(x, 7000); x[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR)); return x / np.sqrt(np.sum(x * x))


# ----------------------------------------------------------------------------- arranjo
def beats_in(a, b, step=BEAT): return [round(x, 4) for x in np.arange(a, b - 1e-6, step)]
CH_A = {'Am': [57, 60, 64], 'F': [53, 57, 60], 'C': [48, 52, 55], 'G': [55, 59, 62]}
ROOT = {'Am': 33, 'F': 29, 'C': 36, 'G': 31}
PROG_MIN = ['Am', 'F', 'C', 'G']; PROG_MAJ = ['C', 'G', 'Am', 'F']
def chord_at(t):
    b = int(t // 2.0)
    return (PROG_MAJ if t >= 39.0 else PROG_MIN)[b % 4]

kicks = []
def add_kick(t, v=1.0): kicks.append(t); drums.add(kick(v), t, 0.95)

# S1: batida entra aos poucos
for i, t in enumerate(beats_in(2.5, 5.0)): add_kick(t, 0.55 + 0.1 * i)
# S2 (break antes de 12)
for t in beats_in(5.0, 11.5): add_kick(t, 1.0)
for t in beats_in(5.5, 11.5, 1.0): drums.add(clap(0.8), t + 0.0, 0.5, 0.0)    # 2 e 4
# S3: meio-tempo, ar
for t in beats_in(12.0, 20.5, 1.0): add_kick(t, 0.85)
# S4: pulsante
for t in beats_in(21.0, 31.75): add_kick(t, 1.0)
for t in beats_in(21.5, 31.75, 1.0): drums.add(clap(0.9), t, 0.5)
# S5: sem bumbo; batimento cardíaco grave
for t in beats_in(33.0, 39.0, 1.0):
    hb = lp(kick(0.5), 140, 2); drums.add(hb, t, 0.9); drums.add(lp(kick(0.32), 120, 2), t + 0.17, 0.8)
# S6: festa
for t in beats_in(39.0, 44.5): add_kick(t, 1.0)
for t in beats_in(39.5, 44.5, 1.0): drums.add(clap(0.9), t, 0.5)

def hats(a, b, step, v=0.6, off=True, accent=0.0):
    for t in beats_in(a, b, step):
        k = int(round(t / step))
        if off and (k % 2 == 0): continue
        drums.add(hat(v * (1.0 + (0.25 if k % 4 == 3 else 0))), t, 0.45, 0.25 * (-1) ** k)
hats(5.0, 11.5, 0.25, 0.55)
hats(12.0, 20.5, 0.25, 0.28, off=True)
hats(21.0, 31.75, 0.125, 0.4, off=True)
hats(39.0, 44.5, 0.25, 0.6)
for t in beats_in(5.25, 11.5, 1.0): drums.add(hat(0.9, True), t, 0.45)
for t in beats_in(21.25, 31.75, 1.0): drums.add(hat(0.9, True), t, 0.45)
for t in beats_in(39.25, 44.5, 1.0): drums.add(hat(0.9, True), t, 0.45)

# baixo
def bass_pattern(a, b, v=1.0):
    t = a
    while t < b - 1e-6:
        ch = chord_at(t); r = ROOT[ch]
        for k, (o, dd) in enumerate([(0, 0.24), (0, 0.24), (12, 0.2), (0, 0.24)] * 2):
            tt = t + k * 0.25
            if tt >= b: break
            if (tt - 0) % 0.5 < 1e-6 or o:
                bass.add(bass_note(midi(r + o), dd, v), tt, 0.9)
        t += 2.0
bass_pattern(5.0, 11.5, 1.0); bass_pattern(21.0, 31.75, 1.0); bass_pattern(39.0, 44.5, 1.0)
for t0, t1 in [(0.0, 2.5), (2.5, 5.0)]:            # pulso grave da introdução
    for t in beats_in(t0, t1): bass.add(bass_note(midi(33), 0.45, 0.8), t, 0.7)
for t in beats_in(12.0, 20.5, 2.0): bass.add(bass_note(midi(ROOT[chord_at(t)]), 1.9, 0.9), t, 0.8)
for t in beats_in(32.0, 39.0, 2.0): bass.add(sine(midi(33), int(2.0 * SR)) * fade_out(int(2.0 * SR), 0.5) * attack(int(2.0 * SR), 0.4) * 0.35, t, 0.7)

# pads
def pad_section(a, b, v=1.0, bright=1.0, minor_color=False):
    t = a
    while t < b - 1e-6:
        ch = chord_at(t); notes = [midi(m + 12) for m in CH_A[ch]] + ([midi(70 + 12 - 12)] if minor_color else [])
        l, r = pad_chord(notes, 2.2, v, bright); pad.stereo(l, r, t, 1.0); t += 2.0
pad_section(0.0, 5.0, 0.8, 0.2); pad_section(12.0, 21.0, 1.2, 0.8); pad_section(21.0, 32.0, 0.6, 0.9); pad_section(39.0, 45.0, 1.0, 1.2)
pad_section(5.0, 12.0, 0.5, 0.5)
# S5 — pad sombrio com segunda menor (A, C, E, Bb)
for t in beats_in(32.0, 39.0, 2.0):
    l, r = pad_chord([midi(45), midi(48), midi(52), midi(58), midi(70)], 2.4, 1.0, 0.35); pad.stereo(l, r, t, 1.0)

# arpejos
def arp_section(a, b, step, octave=0, v=1.0, bright=1.0, delay=0.375, pat=(0, 1, 2, 1, 2, 1, 0, 1)):
    t = a; k = 0
    while t < b - 1e-6:
        ch = chord_at(t); tones = [m + 12 * 2 for m in CH_A[ch]]; tones = tones + [tones[0] + 12]
        idx = pat[k % len(pat)]; f = midi(tones[idx % 4] + 12 * octave)
        s = pluck(f, 0.55, v * (1.0 if k % 2 == 0 else 0.7), bright); l, r = pingpong(s, delay, 0.42, 0.5, 4)
        arp.stereo(l, r, t, 0.9); t += step; k += 1
arp_section(5.5, 11.5, 0.25, 0, 0.8, 0.6)
arp_section(12.0, 20.5, 0.5, 1, 0.7, 1.0, 0.75, (0, 2, 1, 3, 2, 1, 3, 2))
arp_section(21.0, 31.75, 0.125, 0, 0.7, 0.9, 0.1875)
arp_section(39.0, 44.5, 0.25, 1, 0.9, 1.3, 0.375, (0, 2, 1, 3, 2, 3, 1, 2))
# S5 — motivo de "pergunta" (sobe e não resolve)
for t, m in [(35.1, 69), (35.6, 72), (36.1, 76), (36.9, 82)]:
    s = pluck(midi(m), 1.0, 0.9, 0.8); l, r = pingpong(s, 0.5, 0.5, 0.6, 5); arp.stereo(l, r, t, 1.0)


# ----------------------------------------------------------------------------- efeitos sonoros
def riser(dur, v=1.0, f0=250, f1=7000):
    n = int(dur * SR); t = T(n); x = noise(n); fc = f0 * (f1 / f0) ** (t / dur); out = np.zeros(n)
    # filtro passa-banda varrendo em blocos (aproximação eficiente)
    blk = 1024
    for i in range(0, n, blk):
        c = fc[min(i + blk // 2, n - 1)]; seg = x[i:i + blk + 256]; y = signal.sosfilt(sos('band', [c * 0.7, min(c * 1.5, SR * 0.45)], 2), seg); out[i:i + blk] = y[:min(blk, n - i)]
    return out * (t / dur) ** 2.2 * v * 1.6 * fade_out(n, 0.01)

def whoosh(dur=0.5, v=1.0, up=True, pan0=-0.7, pan1=0.7):
    n = int(dur * SR); t = T(n); x = noise(n); c0, c1 = (350, 4200) if up else (4200, 350); fc = c0 * (c1 / c0) ** (t / dur); out = np.zeros(n); blk = 512
    for i in range(0, n, blk):
        c = fc[min(i + blk // 2, n - 1)]; y = signal.sosfilt(sos('band', [c * 0.6, min(c * 1.6, SR * 0.45)], 2), x[i:i + blk + 256]); out[i:i + blk] = y[:min(blk, n - i)]
    env = np.sin(np.pi * (t / dur)) ** 2.0; pan = np.linspace(pan0, pan1, n); a = (pan + 1) * np.pi / 4
    s = out * env * v * 1.5; return s * np.cos(a), s * np.sin(a)

def slam(v=1.0):
    n = int(0.45 * SR); t = T(n); body = sweep_sine(260, 62, n, 5) * np.exp(-t * 9); sub = sine(48, n) * np.exp(-t * 7) * 0.8
    snap = bp(noise(n), 1500, 6000) * np.exp(-t * 55) * 0.7; click = hp(noise(n), 5000) * np.exp(-t * 300) * 0.5
    return tanh_clip((body + sub + snap + click) * 1.3) * v * 0.9

def impact(v=1.0):
    n = int(2.4 * SR); t = T(n); sub = sweep_sine(110, 34, n, 3) * np.exp(-t * 2.2); body = sweep_sine(220, 55, n, 8) * np.exp(-t * 6) * 0.8
    wash = lp(noise(n), 2400) * np.exp(-t * 3.0) * 0.5; crash = hp(noise(n), 4500) * np.exp(-t * 2.4) * 0.28
    return tanh_clip((sub + body + wash + crash) * 1.2) * v

def tick_s(v=1.0, f=2600):
    n = int(0.06 * SR); t = T(n); return (sine(f, n) * 0.6 + hp(noise(n), 4000) * 0.4) * np.exp(-t * 90) * v * 0.55

def pop_s(v=1.0):
    n = int(0.16 * SR); t = T(n); f = 520 + 520 * (1 - np.exp(-t * 40)); ph = 2 * np.pi * np.cumsum(f / SR)
    return (np.sin(ph) * 0.8 + np.sin(ph * 2) * 0.25) * np.exp(-t * 28) * attack(n, 0.002) * v * 0.7

def spin_s(v=1.0):
    n = int(0.9 * SR); t = T(n); x = noise(n); fc = 500 * (4.0) ** np.sin(np.pi * t / 0.9); out = np.zeros(n); blk = 512
    for i in range(0, n, blk):
        c = fc[min(i + blk // 2, n - 1)]; y = signal.sosfilt(sos('band', [c * 0.7, min(c * 1.4, SR * 0.45)], 2), x[i:i + blk + 256]); out[i:i + blk] = y[:min(blk, n - i)]
    env = np.sin(np.pi * t / 0.9) ** 1.6; pan = np.sin(2 * np.pi * t / 0.9 * 1.0 - 0.5) * 0.85; a = (pan + 1) * np.pi / 4; s = out * env * v * 1.6
    return s * np.cos(a), s * np.sin(a)

def glitch_s(v=1.0):
    n = int(0.9 * SR); out = np.zeros(n); r = np.random.default_rng(int(v * 1000) + 7); t_pos = 0
    for k in range(7):
        ln = int(r.uniform(0.02, 0.07) * SR); seg = bp(noise(ln), r.uniform(300, 1500), r.uniform(2500, 7000)) * np.exp(-T(ln) * 20)
        q = 2 ** r.integers(3, 6); seg = np.round(seg * q) / q; rep = int(r.integers(1, 4)); seg = np.tile(seg, rep)
        s0 = int(t_pos * SR); out[s0:s0 + len(seg)] += seg[:max(0, n - s0)][:len(out) - s0] * 0.8; t_pos += r.uniform(0.04, 0.11)
    tape = sweep_sine(500, 40, n, 3) * np.exp(-T(n) * 4) * 0.5
    return tanh_clip((out * 1.5 + tape)) * v * 0.8

def sparkle_s(v=1.0):
    n = int(1.6 * SR); out = np.zeros(n); r = np.random.default_rng(5); notes = [88, 91, 93, 95, 98, 100, 91, 95, 100, 103]
    for k, m in enumerate(notes):
        s0 = int(k * 0.07 * SR); b = bell(midi(m), 0.6, 0.35); out[s0:s0 + len(b)] += b[:max(0, n - s0)][:len(out) - s0]
    return out * v

def reverse_cymbal(dur=0.9, v=1.0):
    n = int(dur * SR); x = hp(noise(n), 3500) * (np.linspace(0, 1, n) ** 2.5); return x * v * 0.5

SFX_GAIN = {'slam': 1.0, 'impact': 1.0, 'whip': 0.8, 'whoosh': 0.9, 'zoomhit': 0.9, 'dive': 1.0, 'tick': 0.8, 'pop': 0.8, 'ding': 0.8, 'sparkle': 0.7, 'spin': 0.7, 'glitch': 0.9, 'flash': 0.9, 'wipe': 0.8, 'outro': 1.0}
impacts = []
for e in EV:
    t, ty, v = e['t'], e['type'], e.get('v', 1.0)
    if ty == 'slam': sfx.add(slam(v), t, 0.9); impacts.append(t)
    elif ty == 'impact':
        sfx.add(impact(v), t, 1.0); fxsend.add(impact(v) * 0.3, t, 0.5); impacts.append(t); sfx.add(riser(1.1, 0.6), max(0, t - 1.1), 0.7)
    elif ty in ('whip',):
        l, r = whoosh(0.42, v, up=True, pan0=-0.8, pan1=0.8); sfx.stereo(l, r, max(0, t - 0.30), 0.8)
    elif ty == 'whoosh':
        l, r = whoosh(0.7, v, up=True, pan0=0.8, pan1=-0.8); sfx.stereo(l, r, max(0, t - 0.5), 0.9)
    elif ty in ('zoomhit', 'dive'):
        l, r = whoosh(0.55, v, up=False, pan0=0, pan1=0); sfx.stereo(l, r, max(0, t - 0.25), 1.0); sfx.add(sweep_sine(180, 38, int(0.7 * SR), 4) * expenv(int(0.7 * SR), 4) * 0.7, t, 0.9)
    elif ty == 'tick': sfx.add(tick_s(v, 2400 + 200 * (e['t'] * 7 % 5)), t, 0.8, ((int(round(t * 100)) % 7) - 3) / 6.0)
    elif ty == 'pop': sfx.add(pop_s(v), t, 0.9, 0.2)
    elif ty == 'ding': sfx.add(bell(midi(88), 1.6, 1.0), t, 0.8); fxsend.add(bell(midi(88), 1.6, 0.6), t, 0.6)
    elif ty == 'sparkle': l = sparkle_s(v); sfx.add(l, t, 0.8, -0.3); sfx.add(l, t + 0.013, 0.5, 0.4)
    elif ty == 'spin':
        l, r = spin_s(v); sfx.stereo(l, r, max(0, t - 0.45), 0.8)
    elif ty == 'glitch': sfx.add(glitch_s(v), t, 0.9, 0.0); fxsend.add(glitch_s(v) * 0.3, t, 0.4)
    elif ty == 'flash': sfx.add(hp(noise(int(0.4 * SR)), 3000) * expenv(int(0.4 * SR), 9) * 0.8, t, 0.8); sfx.add(riser(0.45, 0.8, 600, 9000), max(0, t - 0.45), 0.8); sfx.add(impact(0.7), t, 0.8)
    elif ty == 'wipe':
        l, r = whoosh(0.5, v, up=True, pan0=-1, pan1=1); sfx.stereo(l, r, max(0, t - 0.3), 1.0); sfx.add(riser(0.5, 0.5), max(0, t - 0.5), 0.6)
    elif ty == 'outro':
        sfx.add(reverse_cymbal(0.5, 1.0), t - 0.02, 0.9); sfx.add(sweep_sine(120, 36, int(1.0 * SR), 3) * expenv(int(1.0 * SR), 4) * 0.9, 44.95, 0.8)
# viradas: risers extras antes dos blocos grandes
for t0, t1 in [(11.1, 12.0), (20.1, 21.0), (38.2, 39.0), (16.3, 17.0)]: sfx.add(riser(t1 - t0, 0.55), t0, 0.7)
# queda de fita no congelamento (32.0)
sfx.add(sweep_sine(700, 35, int(0.7 * SR), 3) * expenv(int(0.7 * SR), 3.5) * 0.7, 31.95, 0.8)


# ----------------------------------------------------------------------------- mixagem
def sidechain_env(times, depth=0.7, rel=0.22):
    e = np.zeros(N)
    for t in times:
        i = int(t * SR); n = min(int(rel * 4 * SR), N - i)
        if n > 0: e[i:i + n] = np.maximum(e[i:i + n], np.exp(-np.arange(n) / SR / rel))
    return 1.0 - depth * e
sc = sidechain_env(kicks + [t for t in impacts], 0.62, 0.20)

IR_L, IR_R = reverb_ir(1.9, 1), reverb_ir(1.9, 2)
def rev(bus, wet):
    l = signal.fftconvolve(bus.l, IR_L)[:N]; r = signal.fftconvolve(bus.r, IR_R)[:N]; return l * wet, r * wet

music_l = bass.l * 0.85 * sc + pad.l * 0.9 * sc + arp.l * 0.65 * sc
music_r = bass.r * 0.85 * sc + pad.r * 0.9 * sc + arp.r * 0.65 * sc
rl, rr_ = rev(pad, 0.5); rl2, rr2 = rev(arp, 0.45); rl3, rr3 = rev(fxsend, 0.9); rl4, rr4 = rev(sfx, 0.18)
L_out = drums.l * 0.9 + music_l + sfx.l * 0.95 + rl + rl2 + rl3 + rl4
R_out = drums.r * 0.9 + music_r + sfx.r * 0.95 + rr_ + rr2 + rr3 + rr4
# mestre: filtro de graves, saturação suave e limite
L_out = hp(L_out, 28); R_out = hp(R_out, 28)
peak = max(np.max(np.abs(L_out)), np.max(np.abs(R_out)), 1e-9); g = 0.88 / peak
L_out = np.tanh(L_out * g * 1.1) / np.tanh(1.1); R_out = np.tanh(R_out * g * 1.1) / np.tanh(1.1)
n_out = int(DUR * SR) + int(0.2 * SR)
fade = np.ones(n_out); k = int(0.25 * SR); fade[-k:] = np.linspace(1, 0, k)
st = np.stack([L_out[:n_out] * fade, R_out[:n_out] * fade], 1)
out = (np.clip(st, -1, 1) * 32767).astype(np.int16)
os.makedirs(os.path.join(HERE, 'build'), exist_ok=True)
wavfile.write(os.path.join(HERE, 'build', 'mix.wav'), SR, out)
print('ok', out.shape, 'pico', float(np.max(np.abs(st))))
