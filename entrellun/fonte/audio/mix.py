import numpy as np, soundfile as sf, os
SR = 48000; DUR = 25.0; N = int(SR * DUR)
D = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(7)
t = np.arange(N) / SR

def midi(m): return 440.0 * 2 ** ((m - 69) / 12)
def env_adsr(n, a, d, s, r, sus_len):
    a, d, r = int(a * SR), int(d * SR), int(r * SR); sl = max(int(sus_len * SR), 0)
    e = np.concatenate([np.linspace(0, 1, a, endpoint=False), np.linspace(1, s, d, endpoint=False),
                        np.full(sl, s), np.linspace(s, 0, r)])
    return e[:n] if len(e) >= n else np.pad(e, (0, n - len(e)))
def add(buf, x, start):
    i = int(start * SR); j = min(N, i + len(x))
    if j > i: buf[i:j] += x[:j - i]
# ---------- pad (warm, soft saw-ish via few harmonics, slow attack) ----------
def pad_voice(f, dur):
    n = int(dur * SR); tt = np.arange(n) / SR; x = np.zeros(n)
    for det in (-0.12, 0.0, 0.11):
        ff = f * 2 ** (det / 12)
        for h, amp in ((1, 1.0), (2, 0.32), (3, 0.12), (4, 0.05)):
            x += amp * np.sin(2 * np.pi * ff * h * tt + rng.uniform(0, 6.28))
    return x / 6
chords = [  # (start, dur, midi notes)
    (0.0, 4.2, [43, 55, 59, 62, 66]),        # Gmaj7
    (4.0, 4.3, [47, 54, 59, 62, 69]),        # Bm7
    (8.1, 4.2, [40, 55, 59, 62, 66]),        # Em9
    (12.1, 4.6, [45, 57, 62, 64, 69]),       # Asus
    (16.5, 4.6, [45, 55, 61, 64, 69]),       # A7 (tension before the logo)
    (20.9, 4.1, [38, 54, 57, 61, 64, 69]),   # Dmaj9 resolution
]
pad = np.zeros(N)
for st, du, notes in chords:
    for m in notes:
        v = pad_voice(midi(m), du + 1.2) * env_adsr(int((du + 1.2) * SR), 0.9, 0.5, 0.8, 1.2, du - 1.4)
        add(pad, v * (0.55 if m < 50 else 0.32), st)
# gradual growth
pad *= np.interp(t, [0, 4, 12, 20, 21, 25], [0.55, 0.7, 0.85, 1.0, 1.0, 0.85])

# ---------- soft pulse (muted low thump on beats, from 4 s) ----------
BPM = 96; beat = 60 / BPM
pulse = np.zeros(N)
def thump(f0=58, dur=0.35):
    n = int(dur * SR); tt = np.arange(n) / SR
    f = f0 * (1 + 0.6 * np.exp(-tt * 40))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 11) * (1 - np.exp(-tt * 400))
k = 0; tb = 4.0
while tb < 20.7:
    g = np.interp(tb, [4, 8, 16, 20.7], [0.35, 0.55, 0.8, 0.9]) * (1.0 if k % 2 == 0 else 0.6)
    add(pulse, thump() * g, tb); tb += beat; k += 1

# ---------- plucked arpeggio (8ths, from 8 s), soft mallet tone ----------
def pluck(f, dur=0.9):
    n = int(dur * SR); tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(2 * np.pi * 2 * f * tt) * np.exp(-tt * 6) + 0.08 * np.sin(2 * np.pi * 4.01 * f * tt) * np.exp(-tt * 12)
    return x * np.exp(-tt * 4.5) * (1 - np.exp(-tt * 300))
arp = np.zeros(N)
arp_notes = {8.1: [64, 67, 71, 74], 12.1: [64, 69, 71, 76], 16.5: [64, 67, 69, 73]}
tb = 8.1; k = 0
while tb < 20.6:
    key = max(s for s in arp_notes if s <= tb + 1e-6)
    ns = arp_notes[key]; m = ns[k % 4] + (12 if (k // 4) % 2 and tb > 12 else 0)
    g = np.interp(tb, [8.1, 12, 16, 20.6], [0.10, 0.16, 0.2, 0.22])
    add(arp, pluck(midi(m)) * g, tb); tb += beat / 2; k += 1

# ---------- resolve chord at the logo (short bell-like strike) ----------
res = np.zeros(N)
for m in [62, 66, 69, 73, 74, 78]:
    add(res, pluck(midi(m), 3.5) * 0.12, 20.9)
add(res, thump(46, 0.8) * 0.9, 20.9)

# ---------- passage sounds (filtered noise swells, no impacts) ----------
def whoosh(dur, peak, fc0, fc1, gain):
    n = int(dur * SR); tt = np.arange(n) / SR
    noise = rng.standard_normal(n)
    # sweep a simple state-variable band through the noise
    fc = np.interp(tt, [0, dur], [fc0, fc1]); out = np.empty(n); lp = bp = 0.0; q = 0.6
    for i in range(n):
        f = 2 * np.sin(np.pi * fc[i] / SR); hp = noise[i] - lp - q * bp; bp += f * hp; lp += f * bp; out[i] = bp
    e = np.interp(tt, [0, peak, dur], [0, 1, 0]) ** 1.6
    return out * e * gain / (np.abs(out).max() + 1e-9)
fx = np.zeros(N)
add(fx, whoosh(1.6, 1.1, 300, 1400, 0.10), 0.0)    # traces appear
add(fx, whoosh(1.2, 0.75, 400, 2600, 0.20), 3.6)   # sweep to white
add(fx, whoosh(1.4, 0.9, 300, 1500, 0.11), 7.8)    # ribbons interlace
add(fx, whoosh(1.0, 0.6, 500, 2000, 0.12), 11.7)   # to composition
add(fx, whoosh(1.2, 0.75, 2600, 400, 0.20), 16.3)  # sweep back to deep blue
add(fx, whoosh(2.2, 1.3, 300, 1700, 0.11), 17.2)   # ribbon draws the symbol
add(fx, whoosh(0.9, 0.6, 600, 2200, 0.09), 20.0)   # symbol settles

music = pad * 0.30 + pulse * 0.30 + arp * 0.55 + res * 0.65
# ---------- reverb (FFT convolution with decaying stereo noise) ----------
def reverb(x, secs=2.2, wet=0.28, seed=1):
    r = np.random.default_rng(seed); n = int(secs * SR); tt = np.arange(n) / SR
    ir = r.standard_normal(n) * np.exp(-tt * 3.2); ir[:int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))
    ir /= np.sqrt((ir ** 2).sum())
    L = len(x) + n; nfft = 1 << (L - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(ir, nfft), nfft)[:len(x)]
    return x * (1 - wet) + y * wet * 2.5
mL = reverb(music + fx * 0.6, seed=1) + fx * 0.4
mR = reverb(music + fx * 0.6, seed=2) + fx * 0.4

# ---------- narration ----------
vo_times = [0.50, 4.45, 8.35, 12.05, 13.65, 15.15, 17.60, 21.00, 22.35]
vo = np.zeros(N)
for i, st in enumerate(vo_times):
    x, sr = sf.read(os.path.join(os.environ.get('VO_DIR', D), f'vo_{i}.wav')); assert sr == SR
    add(vo, x / (np.abs(x).max() + 1e-9) * 0.7, st)
# gentle presence: light reverb on voice
vo_rv = reverb(vo, secs=0.8, wet=0.08, seed=3)

# ducking: music dips ~7 dB under the voice
envv = np.abs(vo); w = int(0.12 * SR)
envv = np.convolve(envv, np.ones(w) / w, mode='same')
duck = 1 - 0.55 * np.clip(envv / 0.05, 0, 1)
duck = np.convolve(duck, np.ones(int(0.25 * SR)) / int(0.25 * SR), mode='same')
# final fade
fade = np.clip((DUR - t) / 0.6, 0, 1); fade_in = np.clip(t / 0.15, 0, 1)
L = (mL * 0.55 * duck + vo_rv) * fade * fade_in
R = (mR * 0.55 * duck + vo_rv) * fade * fade_in
st = np.stack([L, R], 1); st /= np.abs(st).max() / 0.89
sf.write(os.path.join(D, os.environ.get('OUT', 'mix.wav')), st, SR)
sf.write(os.path.join(D, 'music_only.wav'), np.stack([mL, mR], 1) / np.abs(np.stack([mL, mR], 1)).max() * 0.8, SR)
print('ok')
