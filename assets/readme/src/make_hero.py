#!/usr/bin/env python3
"""Genera assets/readme/hero.svg con datos reales del motor.

Uso (desde la raíz del repositorio):
    cargo build --release -p ogs-cli
    target/release/ogs analyze examples/acads1a.ogs.json > /tmp/acads1a.out.json
    python3 assets/readme/src/make_hero.py /tmp/acads1a.out.json

Toma del `ogs analyze` el círculo crítico (xc, yc, r), las dovelas de Bishop, el FS de Bishop y de Spencer, λ y el
número de superficies evaluadas; la geometría, de `examples/acads1a.ogs.json`; y el valor publicado, de
`verification/cases/V047a.json`. Nada de lo dibujado está escrito a mano.
"""
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
out = json.load(open(sys.argv[1]))
model = json.load(open(ROOT / "examples" / "acads1a.ogs.json"))
case = json.load(open(ROOT / "verification" / "cases" / "V047a.json"))

res = {r["method"]: r for r in out["results"]}
bishop, spencer = res["bishop"], res["spencer"]
poly = model["regions"][0]["polygon"]
surf = bishop["surface"]
xc, yc, r = surf["xc"], surf["yc"], surf["r"]
slices = bishop["slices"]
pub_bishop = next(c["published"] for c in case["checks"] if c["method"] == "bishop")


def es(x, nd=3):
    return f"{x:.{nd}f}".replace(".", ",")


# --- paleta (la del icono de la app: apps/web/public/icons/icon.svg) ---
BG, INK, SOIL, SOIL_EDGE, RED = "#12324a", "#f8f1df", "#c9a66b", "#f4e3bd", "#ff6b4a"
MUTED, OCHRE, PANEL = "#cbd5e1", "#d9b97c", "#0d2a40"

# --- transformación mundo → pantalla ---
S = 15.0                 # px por metro
PX0, PY0 = 596, 56       # esquina del panel de la sección
PW, PH = 548, 328
X0 = 25.0                # x del modelo en el borde izquierdo del panel
Y_BASE = PY0 + PH        # y = 20 m en el borde inferior del panel
Y0M = 20.0


def X(x):
    return PX0 + (x - X0) * S


def Y(y):
    return Y_BASE - (y - Y0M) * S


def ground_y(x):
    pts = [p for p in poly if p[1] >= 25]  # perfil superior: (20,25) (30,25) (50,35) (70,35)
    for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
        if xa <= x <= xb:
            return ya + (yb - ya) * (x - xa) / (xb - xa) if xb != xa else ya
    return pts[-1][1]


# perfil del terreno y relleno
top = [p for p in poly if p[1] >= 25]
ground = " ".join(f"{X(x):.1f},{Y(y):.1f}" for x, y in top)
soil_path = f"M{X(20):.1f},{Y(20):.1f} L" + ground.replace(" ", " L") + f" L{X(70):.1f},{Y(20):.1f} Z"
ground_line = "M" + ground.replace(" ", " L")

# arco crítico entre la primera y la última dovela
xa, xb = slices[0]["x_left"], slices[-1]["x_right"]
ya = yc - math.sqrt(r * r - (xa - xc) ** 2)
yb = yc - math.sqrt(r * r - (xb - xc) ** 2)
arc = f"M{X(xa):.1f},{Y(ya):.1f} A{r * S:.1f},{r * S:.1f} 0 0 0 {X(xb):.1f},{Y(yb):.1f}"
mass = f"M{X(xa):.1f},{Y(ya):.1f} A{r * S:.1f},{r * S:.1f} 0 0 0 {X(xb):.1f},{Y(yb):.1f} "
# cierre de la masa por el terreno (de la salida a la entrada)
gp = [(xb, ground_y(xb))] + [p for p in top if xa < p[0] < xb][::-1] + [(xa, ground_y(xa))]
mass += " ".join(f"L{X(x):.1f},{Y(y):.1f}" for x, y in gp) + " Z"

# dovelas: una línea vertical por cada frontera, de la base al terreno
edges = [s["x_left"] for s in slices] + [slices[-1]["x_right"]]
slice_lines = []
for i, xe in enumerate(edges):
    yb_ = slices[i]["y_base_left"] if i < len(slices) else slices[-1]["y_base_right"]
    slice_lines.append(f"M{X(xe):.1f},{Y(yb_):.1f} L{X(xe):.1f},{Y(ground_y(xe)):.1f}")
slice_d = " ".join(slice_lines)

H = 440
svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="{H}" viewBox="0 0 1200 {H}" role="img" aria-labelledby="t d">
  <title id="t">OpenGeoSlide: estabilidad de taludes 2D por equilibrio límite</title>
  <desc id="d">Sección transversal del caso ACADS 1(a), un talud homogéneo de 10 m con la superficie de falla circular crítica y sus {len(slices)} dovelas, calculadas por el motor: Bishop {es(bishop["fos"])} y Spencer {es(spencer["fos"])}; el valor publicado es {es(pub_bishop)}.</desc>
  <defs>
    <clipPath id="panel"><rect x="{PX0}" y="{PY0}" width="{PW}" height="{PH}" rx="14"/></clipPath>
  </defs>
  <rect width="1200" height="{H}" rx="26" fill="{BG}"/>

  <g id="title-block" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif">
    <text x="56" y="92" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="18" letter-spacing="0.3" fill="{OCHRE}">ESTABILIDAD DE TALUDES 2D · EQUILIBRIO LÍMITE</text>
    <text x="54" y="170" font-size="72" font-weight="700" fill="{INK}">OpenGeoSlide</text>
    <text x="56" y="222" font-size="24" fill="{MUTED}">Factor de seguridad de taludes con</text>
    <text x="56" y="254" font-size="24" fill="{MUTED}">Bishop y Spencer, en el navegador o</text>
    <text x="56" y="286" font-size="24" fill="{MUTED}">en su equipo. Libre y verificado.</text>
    <path d="M56 322 H540" stroke="#3d5f78" stroke-width="1.5"/>
    <text x="56" y="356" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="18" fill="{MUTED}">Bishop · Spencer · sismo · cargas · Apache-2.0</text>
    <text x="56" y="388" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="18" fill="{OCHRE}">$ ogs analyze examples/acads1a.ogs.json</text>
  </g>

  <g id="section" clip-path="url(#panel)">
    <rect x="{PX0}" y="{PY0}" width="{PW}" height="{PH}" fill="{PANEL}"/>
    <path id="soil" d="{soil_path}" fill="{SOIL}"/>
    <path id="sliding-mass" d="{mass}" fill="{RED}" fill-opacity="0.30"/>
    <path id="slices" d="{slice_d}" stroke="{BG}" stroke-opacity="0.55" stroke-width="1.2" fill="none"/>
    <path id="ground" d="{ground_line}" stroke="{SOIL_EDGE}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" fill="none"/>
    <path id="critical-surface" d="{arc}" stroke="{RED}" stroke-width="5" stroke-linecap="round" fill="none"/>
    <g font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">
      <text x="624" y="124" font-size="60" font-weight="700" fill="{RED}">FS {es(bishop["fos"])}</text>
      <text x="624" y="154" font-size="20" fill="{INK}">Bishop · publicado {es(pub_bishop)}</text>
      <text x="624" y="182" font-size="20" fill="{MUTED}">Spencer {es(spencer["fos"])} · λ {es(spencer["lambda"])}</text>
      <text x="624" y="350" font-size="18" fill="{BG}">ACADS 1(a) · H = 10 m · r = {es(r)} m</text>
      <text x="624" y="372" font-size="18" fill="{BG}">{len(slices)} dovelas · {bishop["search"]["evaluated"]} superficies</text>
    </g>
  </g>
  <rect x="{PX0}" y="{PY0}" width="{PW}" height="{PH}" rx="14" fill="none" stroke="#3d5f78" stroke-width="1.5"/>
</svg>
"""
dest = ROOT / "assets" / "readme" / "hero.svg"
dest.write_text(svg, encoding="utf-8")
print("hero.svg", len(svg), "bytes;", f"xc={xc} yc={yc} r={r}", f"slices={len(slices)}", f"FS bishop={bishop['fos']} spencer={spencer['fos']}")
