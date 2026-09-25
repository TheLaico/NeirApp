#!/usr/bin/env python3
"""Genera la capa de vegetación pintada del mapa de Neira a partir de la elevación real (DEM).

OpenStreetMap casi no trae cobertura vegetal en Neira, así que se deriva una ilustración a partir del
relieve (elevación + pendiente): bosque en las laderas empinadas y quebradas, cafetales en las laderas
medias y pasto en lo plano. Es una capa DECORATIVA (no es un inventario de cultivos ni de bosques).

Uso:  python scripts/build-vegetation.py
Salida: public/map/vegetation.webp  y  public/map/vegetation.json (coordenadas del rectángulo)
Elevación: Terrarium (Mapzen / NASA SRTM) en AWS Open Data.
"""
import io
import json
import math
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "map"

# Rectángulo que cubre la imagen (debe contener los límites de desplazamiento del mapa).
S, W, N, E = 5.140, -75.550, 5.200, -75.490
ZOOM = 15
FINAL = 2560  # ancho final en px
SS = 2  # supersampling para suavizar los bordes al dibujar
rng = np.random.default_rng(7)


def tile_xy(lon, lat, z):
    n = 2**z
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def fetch_dem():
    x0, y0 = tile_xy(W, N, ZOOM)
    x1, y1 = tile_xy(E, S, ZOOM)
    tx0, ty0, tx1, ty1 = int(x0), int(y0), int(x1), int(y1)
    cols, rows = tx1 - tx0 + 1, ty1 - ty0 + 1
    mosaic = np.zeros((rows * 256, cols * 256), dtype=np.float32)
    for j in range(rows):
        for i in range(cols):
            url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{ZOOM}/{tx0 + i}/{ty0 + j}.png"
            with urllib.request.urlopen(url, timeout=60) as r:
                img = np.asarray(Image.open(io.BytesIO(r.read())).convert("RGB"), dtype=np.float32)
            mosaic[j * 256:(j + 1) * 256, i * 256:(i + 1) * 256] = img[..., 0] * 256 + img[..., 1] + img[..., 2] / 256 - 32768
    # recorte exacto al rectángulo pedido
    px0, py0 = int((x0 - tx0) * 256), int((y0 - ty0) * 256)
    px1, py1 = int((x1 - tx0) * 256), int((y1 - ty0) * 256)
    return mosaic[py0:py1, px0:px1]


def resize(a, w, h):
    return np.asarray(Image.fromarray(a.astype(np.float32), mode="F").resize((w, h), Image.BICUBIC), dtype=np.float32)


def blur(a, passes=2):
    """Suavizado simple (promedio 3x3 repetido)."""
    for _ in range(passes):
        p = np.pad(a, 1, mode="edge")
        a = sum(p[i:i + a.shape[0], j:j + a.shape[1]] for i in range(3) for j in range(3)) / 9
    return a


def value_noise(w, h, cell, octaves=4):
    """Ruido fractal suave en [0, 1]."""
    total, amp, norm = np.zeros((h, w), np.float32), 1.0, 0.0
    for o in range(octaves):
        c = max(2, int(cell / (2**o)))
        grid = rng.random((h // c + 3, w // c + 3)).astype(np.float32)
        total += amp * resize(grid, (w // c + 3) * c, (h // c + 3) * c)[:h, :w]
        norm += amp
        amp *= 0.5
    return total / norm


def smooth(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def main():
    dem = fetch_dem()
    h_px, w_px = dem.shape
    print(f"DEM {w_px}x{h_px}px, elevación {dem.min():.0f}–{dem.max():.0f} m")

    H = round(FINAL * ((N - S) / (E - W)))
    w, h = FINAL * SS, H * SS

    elev = resize(dem, w, h)
    m_per_px_dem = 156543.03 * math.cos(math.radians((N + S) / 2)) / 2**ZOOM
    gy, gx = np.gradient(dem, m_per_px_dem)
    slope = np.degrees(np.arctan(np.hypot(gx, gy)))
    slope = resize(blur(slope.astype(np.float32), 2), w, h)

    n_big = value_noise(w, h, cell=380 * SS // 2, octaves=4)
    n_small = value_noise(w, h, cell=60 * SS // 2, octaves=2)

    # puntajes de cobertura (0-1)
    forest = smooth(slope + (n_big - 0.5) * 16 + (elev - 1900) / 120, 24, 36)
    forest = np.clip(forest + 0.6 * smooth(elev, 2350, 2600), 0, 1)
    coffee = (1 - forest) * smooth(slope + (n_small - 0.5) * 8, 7, 15)
    pasture = np.clip(1 - forest - coffee, 0, 1)

    # color de fondo: mezcla suave de los tres tipos (con leve variación tonal)
    C_FOREST, C_COFFEE, C_PASTURE = np.array([84, 138, 104]), np.array([176, 212, 172]), np.array([222, 236, 214])
    base = (
        forest[..., None] * C_FOREST + coffee[..., None] * C_COFFEE + pasture[..., None] * C_PASTURE
    ) + (n_small[..., None] - 0.5) * 22
    img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), "RGB").convert("RGBA")
    draw = ImageDraw.Draw(img, "RGBA")

    def scatter(score, count, keep_pow):
        ys, xs = rng.integers(0, h, count), rng.integers(0, w, count)
        keep = rng.random(count) < score[ys, xs] ** keep_pow
        ys, xs = ys[keep], xs[keep]
        order = np.argsort(ys)  # de arriba abajo: las copas de abajo tapan a las de arriba
        return xs[order], ys[order]

    # bosque: copas con sombra, cuerpo y brillo
    xs, ys = scatter(forest, 140_000 * SS * SS // 4, 1.6)
    for x, y in zip(xs, ys):
        r = int(rng.integers(5, 10)) * SS // 2 + 2
        tone = rng.random()
        body = (int(23 + 14 * tone), int(84 + 30 * tone), int(60 + 22 * tone), 255)
        draw.ellipse((x - r + 2, y - r + 3, x + r + 2, y + r + 3), fill=(12, 52, 38, 120))
        draw.ellipse((x - r, y - r, x + r, y + r), fill=body)
        draw.ellipse((x - r * 0.55 - 1, y - r * 0.6 - 1, x + r * 0.05, y - r * 0.05), fill=(160, 210, 170, 120))

    # cafetales: arbustos pequeños, más claros y ordenados
    xs, ys = scatter(coffee, 260_000 * SS * SS // 4, 1.2)
    for x, y in zip(xs, ys):
        r = int(rng.integers(2, 4)) * SS // 2 + 1
        tone = rng.random()
        draw.ellipse((x - r, y - r + 1, x + r, y + r + 1), fill=(64, 124, 92, 140))
        draw.ellipse((x - r, y - r, x + r, y + r), fill=(int(96 + 40 * tone), int(168 + 26 * tone), int(122 + 26 * tone), 255))
        if rng.random() < 0.16:  # granos rojos del café
            draw.ellipse((x - 1, y - 1, x + 1, y + 1), fill=(182, 83, 60, 255))

    # pasto: fino grano de brizna
    xs, ys = scatter(pasture, 120_000 * SS * SS // 4, 1.0)
    for x, y in zip(xs, ys):
        draw.line((x, y, x + int(rng.integers(-2, 3)), y - int(rng.integers(2, 5))), fill=(140, 190, 150, 170), width=1)

    img = img.resize((FINAL, H), Image.LANCZOS)

    # transparencia: el borde se desvanece y el casco urbano queda libre (el mapa base se ve debajo)
    alpha = Image.new("L", (FINAL, H), 255)
    ad = ImageDraw.Draw(alpha)
    boundary = json.loads((OUT / "boundary.geojson").read_text(encoding="utf-8"))["features"][0]["geometry"]
    ring = boundary["coordinates"][0]
    poly = [((lon - W) / (E - W) * FINAL, (N - lat) / (N - S) * H) for lon, lat in ring]
    ad.polygon(poly, fill=0)
    # el casco urbano también incluye las casas reales (OpenStreetMap), dilatadas para dejar un colchón
    buildings = json.loads((OUT / "buildings.geojson").read_text(encoding="utf-8"))["features"]
    urban = Image.new("L", (FINAL, H), 0)
    ud = ImageDraw.Draw(urban)
    for f in buildings:
        coords = f["geometry"]["coordinates"]
        rings = coords if f["geometry"]["type"] == "MultiPolygon" else [coords]
        for r in rings:
            pts = [((lon - W) / (E - W) * FINAL, (N - lat) / (N - S) * H) for lon, lat in r[0]]
            ud.polygon(pts, fill=255)
    urban = urban.filter(ImageFilter.MaxFilter(31)).filter(ImageFilter.GaussianBlur(20))
    alpha = ImageChops.subtract(alpha, urban)
    alpha = alpha.filter(ImageFilter.GaussianBlur(16))
    edge = Image.new("L", (FINAL, H), 0)
    ImageDraw.Draw(edge).rectangle((70, 70, FINAL - 70, H - 70), fill=255)
    alpha = ImageChops.multiply(alpha, edge.filter(ImageFilter.GaussianBlur(50)))
    img.putalpha(alpha)

    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / "vegetation.webp", "WEBP", quality=82, method=6)
    (OUT / "vegetation.json").write_text(
        json.dumps({"coordinates": [[W, N], [E, N], [E, S], [W, S]], "width": FINAL, "height": H}), encoding="utf-8"
    )
    size = (OUT / "vegetation.webp").stat().st_size / 1024
    print(f"vegetation.webp {FINAL}x{H}  {size:.0f} KB")


if __name__ == "__main__":
    main()
