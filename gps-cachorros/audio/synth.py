"""Primitivas de síntese (numpy/scipy) para trilha e efeitos. 48 kHz, tudo determinístico (semente fixa)."""
import numpy as np
from scipy import signal

SR = 48000
rng = np.random.default_rng(20241027)


def tt(d):
    return np.arange(int(d * SR)) / SR


def midi(m):
    return 440.0 * 2 ** ((np.asarray(m, dtype=float) - 69) / 12)


def adsr(n, a=0.005, d=0.1, s=0.6, r=0.1):
    a_, d_, r_ = int(a * SR), int(d * SR), int(r * SR)
    sus = max(n - a_ - d_ - r_, 0)
    e = np.concatenate([np.linspace(0, 1, a_, endpoint=False), np.linspace(1, s, d_, endpoint=False), np.full(sus, s), np.linspace(s, 0, r_)])
    return e[:n] if len(e) >= n else np.pad(e, (0, n - len(e)))


def expdec(n, tau):
    return np.exp(-np.arange(n) / SR / tau)


def lp(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, min(fc, SR / 2 - 100) / (SR / 2), 'low', output='sos'), x, axis=0)


def hp(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc / (SR / 2), 'high', output='sos'), x, axis=0)


def bp(x, f1, f2, order=2):
    return signal.sosfilt(signal.butter(order, [f1 / (SR / 2), min(f2, SR / 2 - 100) / (SR / 2)], 'band', output='sos'), x, axis=0)


def svf_sweep(x, fc, q=2.0, mode='bp'):
    """Filtro de variáveis de estado com frequência de corte variável no tempo (fc: array por amostra)."""
    n = len(x); out = np.zeros(n); low = 0.0; band = 0.0
    f = 2 * np.sin(np.pi * np.clip(fc, 20, SR / 2.2) / SR); damp = 1.0 / q
    xs = x.tolist(); fs = f.tolist(); o = [0.0] * n
    for i in range(n):
        low += fs[i] * band
        high = xs[i] - low - damp * band
        band += fs[i] * high
        o[i] = band if mode == 'bp' else (low if mode == 'lp' else high)
    return np.array(o)


def sweep_freq(n, f0, f1, curve=2.0):
    u = np.linspace(0, 1, n)
    return f0 * (f1 / f0) ** (u ** curve)


def pan_lr(x, pan=0.0):
    a = (pan + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], axis=1)


def softclip(x, k=1.0):
    return np.tanh(x * k) / np.tanh(k)


# ---------------------------------------------------------------- efeitos
def whoosh(dur=0.8, f0=300, f1=5000, q=1.6, peak=0.5, curve=1.0, grain=0.0):
    n = int(dur * SR); x = rng.standard_normal(n)
    fc = sweep_freq(n, f0, f1, curve)
    y = svf_sweep(x, fc, q)
    u = np.linspace(0, 1, n); pw = np.log(0.5) / np.log(np.clip(peak, 0.05, 0.95)); env = np.sin(np.pi * u ** pw) ** 1.4
    y = y * env
    y /= np.max(np.abs(y)) + 1e-9
    return y * 0.9


def pop(f0=900, f1=180, dur=0.14, click=0.5):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 38)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * expdec(n, dur * 0.28)
    c = np.zeros(n); k = int(0.002 * SR); c[:k] = rng.standard_normal(k) * np.linspace(1, 0, k); c = hp(c, 1500)
    return y * 0.9 + c * click * 0.6


def boom(dur=1.8, f0=70, f1=32, noise=0.35):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 3.2)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * expdec(n, dur * 0.34)
    nz = lp(rng.standard_normal(n), 900) * expdec(n, 0.35) * noise
    return softclip(y * 1.4 + nz, 1.3) * 0.9


def impact(dur=2.2, bright=1.0):
    n = int(dur * SR)
    b = boom(dur)
    cr = hp(rng.standard_normal(n), 2500) * expdec(n, 0.55) * 0.5 * bright
    cr = cr + hp(rng.standard_normal(n), 700) * expdec(n, 0.18) * 0.5
    return softclip(b + cr, 1.2) * 0.8


def riser(dur=2.0, f0=200, f1=7000, pitch=True):
    n = int(dur * SR); x = rng.standard_normal(n)
    fc = sweep_freq(n, f0, f1, 1.6)
    y = svf_sweep(x, fc, 3.0)
    y /= np.max(np.abs(y)) + 1e-9
    y *= np.linspace(0, 1, n) ** 1.3
    if pitch:
        f = sweep_freq(n, f0 * 0.6, f1 * 0.35, 1.4)
        y = y * 0.8 + np.sin(2 * np.pi * np.cumsum(f) / SR) * np.linspace(0, 1, n) ** 2.5 * 0.25
    return y


def downlifter(dur=1.0, f0=6000, f1=200):
    y = riser(dur, f1, f0, pitch=False)[::-1]
    return y


def tick(f=2400, dur=0.012, amp=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) * 0.7 + rng.standard_normal(n) * 0.3) * expdec(n, dur * 0.3) * amp


def ding(f=880, dur=0.9, bright=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    y = np.sin(2 * np.pi * f * t) + 0.35 * bright * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 9) + 0.2 * bright * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 16)
    return y * expdec(n, dur * 0.3) * 0.6


def sparkle(dur=1.0, base=1200):
    n = int(dur * SR); y = np.zeros(n)
    for i, k in enumerate([0, 2, 4, 7, 9, 12, 14, 16]):
        t0 = int(i * 0.055 * SR); d = ding(midi(84 + k) * 1.0, 0.5, 1.0)[: n - t0]
        if t0 < n: y[t0:t0 + len(d)] += d * (0.8 ** i)
    return y * 0.6


def glitch(dur=0.35, amt=1.0):
    n = int(dur * SR); y = np.zeros(n); pos = 0
    while pos < n:
        L = int(rng.uniform(0.01, 0.05) * SR); f = rng.choice([220, 440, 880, 1760, 3300])
        seg = np.sign(np.sin(2 * np.pi * f * np.arange(L) / SR)) * 0.5 + rng.standard_normal(L) * 0.4
        if rng.random() < 0.4: seg = np.zeros(L)
        y[pos:pos + L] += seg[: n - pos]; pos += L
    # bitcrush
    q = 2 ** 4; y = np.round(y * q) / q
    y = hp(y, 300) * expdec(n, dur * 1.2)
    return y * 0.5 * amt


def scratch(dur=0.45):
    n = int(dur * SR); x = rng.standard_normal(n)
    t = np.linspace(0, 1, n); fc = 900 + 2600 * np.abs(np.sin(t * np.pi * 2.2)) * (1 - t * 0.5)
    y = svf_sweep(x, fc, 4.0) * np.sin(np.pi * t) ** 0.6
    y /= np.max(np.abs(y)) + 1e-9
    return y * 0.8


def tapestop(dur=0.6, f=440):
    n = int(dur * SR); t = np.linspace(0, 1, n)
    fr = f * (1 - t) ** 2.2 + 18
    y = (np.sign(np.sin(2 * np.pi * np.cumsum(fr) / SR)) * 0.4 + np.sin(2 * np.pi * np.cumsum(fr * 2.01) / SR) * 0.2) * (1 - t) ** 0.5
    return lp(y, 3500) * 0.7


def boing(dur=0.55, f=300):
    n = int(dur * SR); t = np.arange(n) / SR
    fr = f * (1 + 1.6 * (1 - np.exp(-t * 14))) * (1 + 0.06 * np.sin(2 * np.pi * 28 * t))
    y = np.sin(2 * np.pi * np.cumsum(fr) / SR) + 0.3 * np.sin(2 * np.pi * np.cumsum(fr * 2) / SR)
    return y * expdec(n, dur * 0.35) * 0.6


def zap(dur=0.3):
    n = int(dur * SR); t = np.arange(n) / SR
    fr = 3000 * np.exp(-t * 11) + 200
    y = np.sign(np.sin(2 * np.pi * np.cumsum(fr) / SR)) * 0.5 + np.sin(2 * np.pi * np.cumsum(fr) / SR) * 0.5
    return lp(y, 7000) * expdec(n, dur * 0.4) * 0.7


def blip(f=600, dur=0.07):
    n = int(dur * SR); t = np.arange(n) / SR
    y = np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 3.9 * t) * np.exp(-t * 60)
    return y * expdec(n, dur * 0.35) * (1 - np.exp(-t * 900)) * 0.7


def thud(dur=0.18, f=110):
    n = int(dur * SR); t = np.arange(n) / SR
    y = np.sin(2 * np.pi * (f * np.exp(-t * 14) + 45) * t) * expdec(n, 0.06)
    return y * 0.8


# ---------------------------------------------------------------- bateria / trilha
def kick(dur=0.36, f0=165, f1=46, drive=1.6):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 28)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * expdec(n, 0.14)
    c = np.zeros(n); k = int(0.003 * SR); c[:k] = rng.standard_normal(k) * np.linspace(1, 0, k)
    return softclip(y * 1.2 + hp(c, 2000) * 0.3, drive) * 0.95


def clap(dur=0.3):
    n = int(dur * SR); y = np.zeros(n); x = bp(rng.standard_normal(n), 1100, 5200)
    for d in (0.0, 0.012, 0.025):
        i = int(d * SR); y[i:] += x[: n - i] * expdec(n - i, 0.006)
    y += x * expdec(n, 0.07) * 0.7
    return softclip(y / (np.max(np.abs(y)) + 1e-9) * 0.9, 1.2) * 0.7


def hat(open_=False):
    d = 0.22 if open_ else 0.05; n = int(d * SR)
    x = hp(rng.standard_normal(n), 7500, 3)
    return x * expdec(n, d * (0.45 if open_ else 0.3)) * 0.5


def pluck(f, dur=0.35, bright=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    y = np.sin(2 * np.pi * f * t) + 0.5 * bright * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 14) + 0.25 * bright * np.sin(2 * np.pi * 3.01 * f * t) * np.exp(-t * 22)
    return y * expdec(n, dur * 0.22) * (1 - np.exp(-t * 700))


def marimba(f, dur=0.5):
    n = int(dur * SR); t = np.arange(n) / SR
    y = np.sin(2 * np.pi * f * t) + 0.55 * np.sin(2 * np.pi * 4.0 * f * t) * np.exp(-t * 40) + 0.2 * np.sin(2 * np.pi * 9.2 * f * t) * np.exp(-t * 70)
    return y * expdec(n, dur * 0.28) * (1 - np.exp(-t * 900))


def bass_note(f, dur=0.5, cutoff=420):
    n = int(dur * SR); t = np.arange(n) / SR
    saw = 2 * ((t * f) % 1.0) - 1
    y = lp(saw, cutoff * 2.2) * 0.6 + np.sin(2 * np.pi * f * t) * 0.8
    return softclip(y * adsr(n, 0.004, 0.08, 0.7, 0.06), 1.4) * 0.8


def pad_chord(freqs, dur, cut=1800, det=0.012):
    n = int(dur * SR); t = np.arange(n) / SR; y = np.zeros(n)
    for f in freqs:
        for d in (-det, 0.0, det):
            ph = rng.uniform(0, 6.28)
            y += (2 * (((t * f * (1 + d)) + ph / 6.28) % 1.0) - 1) * 0.3
    y = lp(y, cut) / max(len(freqs), 1)
    return y * adsr(n, min(0.6, dur * 0.35), 0.3, 0.8, min(0.8, dur * 0.4))


def reverb(x, tail=1.6, wet=0.3, damp=4500, pre=0.012, wet_only=False):
    """Reverb por convolução com ruído de decaimento exponencial (estéreo descorrelacionado)."""
    n = int(tail * SR)
    mono = x if x.ndim == 1 else x.mean(axis=1)
    res = []
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-np.arange(n) / SR / (tail * 0.28)); ir = lp(ir, damp, 1)
        ir[: int(pre * SR)] = 0
        res.append(signal.fftconvolve(mono, ir)[: len(mono)])
    r = np.stack(res, axis=1); r /= (np.max(np.abs(r)) + 1e-9)
    r = r * wet * np.max(np.abs(mono))
    return r if wet_only else (pan_lr(mono, 0) if x.ndim == 1 else x) + r
