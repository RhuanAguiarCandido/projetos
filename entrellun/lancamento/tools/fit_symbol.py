"""Ajusta uma curva fechada suave (série de Fourier) à linha central da fita do símbolo oficial.

A fita desenhada por código no filme usa esta curva para pousar exatamente sobre o
símbolo oficial no momento da revelação. Saída: assets/data/simbolo.js
(pontos em pixels da arte original 1254×1254, meia-largura da fita, cruzamento).
Uso: python3 -I tools/fit_symbol.py
"""
import json
import os
import numpy as np
from PIL import Image
from pathlib import Path
from scipy import ndimage, optimize

root = Path(__file__).resolve().parent.parent
a = np.asarray(Image.open(root / "assets/brand/logo-entrellun.png"))[..., 3] / 255.0
mask = a > 0.5
mask[670:] = False
edge = mask ^ ndimage.binary_erosion(mask)
dt = ndimage.distance_transform_edt(~edge)
K = int(os.environ.get("HARMONICAS", 5))  # nº de harmônicas da série de Fourier
CX, CY = 624.5, 506.5


def curve(p, u):
    cx, cy = p[0], p[1]
    ax, bx, ay, by = p[2:2 + K], p[2 + K:2 + 2 * K], p[2 + 2 * K:2 + 3 * K], p[2 + 3 * K:2 + 4 * K]
    k = np.arange(1, K + 1)[:, None]
    ang = 2 * np.pi * k * u[None]
    x = cx + (ax[:, None] * np.cos(ang) + bx[:, None] * np.sin(ang)).sum(0)
    y = cy + (ay[:, None] * np.cos(ang) + by[:, None] * np.sin(ang)).sum(0)
    return x, y


def init():
    p = np.zeros(2 + 4 * K)
    p[0], p[1] = CX, CY
    p[2] = 338.0            # x = A cos(2πu)
    p[2 + 3 * K + 1] = 110  # y = (B/2) sin(4πu)
    return np.r_[p, 42.0]


u = np.linspace(0, 1, 900, endpoint=False)


def resid(q):
    p, h = q[:-1], q[-1]
    x, y = curve(p, u)
    dx, dy = np.gradient(x), np.gradient(y)
    n = np.hypot(dx, dy)
    nx, ny = -dy / n, dx / n
    far = np.hypot(x - CX, y - CY) > 120  # o cruzamento não tem bordas limpas
    r = []
    for s in (1, -1):
        px, py = x + s * h * nx, y + s * h * ny
        r.append(ndimage.map_coordinates(dt, [py, px], order=1, mode="nearest") * far)
    return np.concatenate(r)


q = optimize.least_squares(resid, init(), x_scale="jac", max_nfev=4000).x
p, h = q[:-1], q[-1]
uu = np.linspace(0, 1, 720, endpoint=False)
x, y = curve(p, uu)
# cruzamento: par de parâmetros distantes com pontos coincidentes
best = None
for i in range(len(uu)):
    d = np.hypot(x - x[i], y - y[i])
    j = np.argmin(np.where(np.abs(((np.arange(len(uu)) - i + 360) % 720) - 360) > 120, d, 1e9))
    if best is None or d[j] < best[0]:
        best = (d[j], i, j)
_, i, j = best
res = resid(q)
print("meia-largura", h, "erro médio de borda (px)", np.abs(res[res > 0]).mean(), "cruzamento", x[i], y[i], uu[i], uu[j])
data = ({
    "fonte": "assets/brand/logo-entrellun.png (px da arte 1254x1254)",
    "meiaLargura": h,
    "pontos": [[round(float(a_), 2), round(float(b_), 2)] for a_, b_ in zip(x, y)],
    "cruzamento": [float(x[i]), float(y[i])],
    "uCruzamento": sorted([float(uu[i]), float(uu[j])]),
    "caixas": {"simbolo": [244, 354, 1005, 659], "entrellun": [105, 685, 1171, 899], "genteGestao": [250, 917, 1019, 995]},
})
Path(os.environ.get("SAIDA", root / "assets/data/simbolo.js")).write_text("window.SIMBOLO = " + json.dumps(data) + ";\n")

im = Image.open(root / "assets/brand/logo-entrellun-oficial-fundo-escuro.png").convert("RGB")
from PIL import ImageDraw
d = ImageDraw.Draw(im)
pts = list(zip(x, y))
d.line(pts + [pts[0]], fill=(255, 120, 85), width=3)
dx, dy = np.gradient(x), np.gradient(y); n = np.hypot(dx, dy)
for s in (1, -1):
    pp = list(zip(x - s * h * dy / n, y + s * h * dx / n)); d.line(pp + [pp[0]], fill=(55, 213, 242), width=2)
d.ellipse([x[0] - 8, y[0] - 8, x[0] + 8, y[0] + 8], outline="yellow", width=3)
d.ellipse([x[60] - 6, y[60] - 6, x[60] + 6, y[60] + 6], outline="red", width=3)
im.crop((200, 320, 1050, 700)).save(os.environ.get("CONFERENCIA", "/tmp/fit_check.png"))
