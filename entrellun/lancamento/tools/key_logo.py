"""Recorta a logo oficial (fundo escuro) para PNG com transparência, sem alterar cores nem formas.

Color-to-alpha contra a cor exata do fundo da arte: cada pixel p = a*F + (1-a)*B
com o menor alfa possível. Sobre o fundo original o resultado é idêntico ao arquivo oficial.
Uso: python3 -I tools/key_logo.py
"""
import numpy as np
from PIL import Image
from pathlib import Path

root = Path(__file__).resolve().parent.parent
src = np.asarray(Image.open(root / "assets/brand/logo-entrellun-oficial-fundo-escuro.png").convert("RGB")).astype(np.float64)
B = np.median(np.concatenate([src[:40, :40].reshape(-1, 3), src[-40:, -40:].reshape(-1, 3)]), axis=0)
up = np.where(src > B, (src - B) / (255.0 - B), (B - src) / np.maximum(B, 1))
a = np.clip(up.max(axis=2), 0, 1)
a[a < 0.035] = 0  # ruído de compressão do fundo
F = B + (src - B) / np.maximum(a, 1e-6)[..., None]
F = np.clip(F, 0, 255)
out = np.dstack([F, a * 255]).round().astype(np.uint8)
out[a == 0, :3] = 0
Image.fromarray(out, "RGBA").save(root / "assets/brand/logo-entrellun.png")
# caixas de recorte (px da arte original): símbolo, palavra Entrellun, Gente e Gestão
rows = np.where(a.max(axis=1) > 0.5)[0]
print("fundo", B, "linhas com conteúdo", rows.min(), rows.max())
