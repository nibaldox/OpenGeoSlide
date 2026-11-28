#!/usr/bin/env python3
"""Valida los ejemplos de docs/formato-ogs-json.md contra el esquema 0.7 y contra el binario `ogs`.

Uso (desde la raíz del repositorio, con el binario compilado: `cargo build --release -p ogs-cli`):

    env -u PYTHONPATH -u PYTHONHOME uv run -q --no-project --with jsonschema \
        python docs/tools/validar_ejemplos.py [--ogs target/release/ogs] [--doc docs/formato-ogs-json.md]

El documento marca cada ejemplo con un comentario HTML justo antes del bloque ```json:

    <!-- ogs-ejemplo nombre=<id> estado=<converged|invalid:<codigo>|not_converged:<codigo>> -->
        Documento completo. Debe validar contra el esquema y `ogs analyze` debe salir con código 0 y dar ese
        estado en **todos** los métodos del informe (los que no se citan, convergidos). Opcional:
        `fos=<metodo>:<valor>,<metodo>:<valor>` compara el FS a 4 decimales.
        `fuerzas=<estado>,<estado>` (o `ninguna`): los `status` de `reinforcement_forces`, en orden, deben ser esos en
        **todos** los métodos. `avisos=<codigo>,<codigo>`: cada código debe estar en `warnings` de todos los métodos.
        `grieta=x:<v>,depth:<v>,water_force:<v>` (o `ninguna`): el objeto `tension_crack` del informe de **todos** los
        métodos, comparado a 4 decimales (`ninguna` = ningún método lo trae).
        `cruce=soil_force:<v>,governs:<soil|shear|bending>,arm:<v>`: el primer cruce de `reinforcement_forces` de
        **todos** los métodos (pilote de Ito-Matsui); los números a 4 decimales, `governs` por igualdad.
        `pasadas=<metodo>:<n>,…`: `strength.passes` del método (lazo de Hoek-Brown, v0.6), por igualdad.
        `ley=<hoek_brown|shansep>`: `strength.slices` no vacío y con esa `law` en **todas** sus entradas, en todos los métodos.
        `sv=<indice>:<vertical_stress>:<ocr>`: la entrada de `strength.slices` con ese `index` (SHANSEP), de **todos** los
        métodos, a 4 decimales.
        `nc=<metodo>:<campo>:<valor>,…`: `search.non_circular` del método (`seeds` y `evaluated` por igualdad; `seed_fos`
        y `polyline_fos`, a 4 decimales). `superficie=polilinea:<max>`: la superficie de **todos** los métodos es una
        polilínea con a lo sumo `<max>` vértices.

    <!-- ogs-fragmento base=<id> ruta=<a.b.0.c> esperado=ok|error:<subcadena> esquema=acepta|rechaza [estado=...] -->
        Reemplaza el valor de `ruta` en el ejemplo `base` por el JSON del bloque (una lista usa índices) y lo
        corre. `esperado=ok`: `ogs analyze` sale con código 0 (y, si hay `estado=`, todos los métodos dan ese
        estado). `esperado=error:<subcadena>`: sale con código 2 y el mensaje contiene la subcadena (use `~` en
        lugar de espacio). `esquema=` es lo que debe decir el esquema (`rechaza` = hay errores). Con `esperado=ok`,
        también valen `fos=`, `fuerzas=` y `avisos=`, con el mismo sentido que en `ogs-ejemplo`.

Sale con código 1 si algo no se cumple.
"""
from __future__ import annotations

import argparse
import copy
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from jsonschema import Draft202012Validator

MARCA = re.compile(r"<!--\s*(ogs-ejemplo|ogs-fragmento)\s+(.*?)\s*-->\s*```json\n(.*?)```", re.S)


def atributos(texto: str) -> dict[str, str]:
    return dict(re.findall(r"(\w+)=(\S+)", texto))


def fijar(doc: dict, ruta: str, valor) -> dict:
    d = copy.deepcopy(doc)
    nodo = d
    partes = ruta.split(".")
    for p in partes[:-1]:
        nodo = nodo[int(p)] if isinstance(nodo, list) else nodo[p]
    ult = partes[-1]
    if isinstance(nodo, list):
        nodo[int(ult)] = valor
    else:
        nodo[ult] = valor
    return d


def comprobar_informe(nombre: str, res: list[dict], at: dict[str, str], fallos: list[str]) -> None:
    """Comprueba `fos=`, `fuerzas=` y `avisos=` sobre los resultados de `ogs analyze`."""
    for par in filter(None, at.get("fos", "").split(",")):
        m, _, v = par.partition(":")
        r = next((r for r in res if r["method"] == m), None)
        if r is None or r["fos"] is None or round(r["fos"], 4) != round(float(v), 4):
            fallos.append(f"[{nombre}] FS de {m}: {None if r is None else r['fos']}, se esperaba {v}")
    if "fuerzas" in at:
        esperado = [] if at["fuerzas"] == "ninguna" else at["fuerzas"].split(",")
        for r in res:
            obtenido = [f["status"] for f in r.get("reinforcement_forces", [])]
            if obtenido != esperado:
                fallos.append(f"[{nombre}] {r['method']}: reinforcement_forces {obtenido}, se esperaba {esperado}")
    if "grieta" in at:
        for r in res:
            tc = r.get("tension_crack")
            if at["grieta"] == "ninguna":
                if tc is not None:
                    fallos.append(f"[{nombre}] {r['method']}: tension_crack {tc}, se esperaba ninguna")
                continue
            for par in at["grieta"].split(","):
                k, _, v = par.partition(":")
                if tc is None or round(tc[k], 4) != round(float(v), 4):
                    fallos.append(f"[{nombre}] {r['method']}: tension_crack.{k} {None if tc is None else tc[k]}, se esperaba {v}")
    if "cruce" in at:
        # El primer cruce de `reinforcement_forces` de cada método (pilote de Ito-Matsui, E15i-7): `soil_force` y `arm`
        # se comparan a 4 decimales; `governs` (soil, shear o bending), por igualdad.
        for r in res:
            rf = r.get("reinforcement_forces") or []
            if not rf:
                fallos.append(f"[{nombre}] {r['method']}: sin reinforcement_forces, se esperaba cruce={at['cruce']}")
                continue
            for par in at["cruce"].split(","):
                k, _, v = par.partition(":")
                obt = rf[0].get(k)
                if k == "governs":
                    ok = obt == v
                else:
                    ok = obt is not None and round(obt, 4) == round(float(v), 4)
                if not ok:
                    fallos.append(f"[{nombre}] {r['method']}: cruce.{k} {obt}, se esperaba {v}")
    for par in filter(None, at.get("pasadas", "").split(",")):
        m, _, v = par.partition(":")
        r = next((r for r in res if r["method"] == m), None)
        obt = ((r or {}).get("strength") or {}).get("passes")
        if obt != int(v):
            fallos.append(f"[{nombre}] {m}: strength.passes {obt}, se esperaba {v}")
    if "ley" in at:
        for r in res:
            sl = (r.get("strength") or {}).get("slices") or []
            if not sl or any(x.get("law") != at["ley"] for x in sl):
                fallos.append(f"[{nombre}] {r['method']}: strength.slices sin la ley {at['ley']}")
    if "sv" in at:
        ind, _, resto = at["sv"].partition(":")
        vs, _, oc = resto.partition(":")
        for r in res:
            e = next((x for x in (r.get("strength") or {}).get("slices", []) if x["index"] == int(ind)), None)
            if e is None or round(e["vertical_stress"], 4) != round(float(vs), 4) or round(e["ocr"], 4) != round(float(oc), 4):
                fallos.append(f"[{nombre}] {r['method']}: strength.slices[{ind}] {e}, se esperaba σ′v {vs} y OCR {oc}")
    for par in filter(None, at.get("nc", "").split(",")):
        m, _, resto = par.partition(":")
        k, _, v = resto.partition(":")
        r = next((r for r in res if r["method"] == m), None)
        nc = ((r or {}).get("search") or {}).get("non_circular") or {}
        obt = nc.get(k)
        ok = obt is not None and (obt == int(v) if k in ("seeds", "evaluated") else round(obt, 4) == round(float(v), 4))
        if not ok:
            fallos.append(f"[{nombre}] {m}: search.non_circular.{k} {obt}, se esperaba {v}")
    if "superficie" in at:
        tipo, _, mx = at["superficie"].partition(":")
        for r in res:
            pts = r["surface"].get("points") if r.get("surface") else None
            if pts is None or len(pts) > int(mx):
                fallos.append(f"[{nombre}] {r['method']}: superficie {None if pts is None else len(pts)} vértices, se esperaba polilínea de a lo sumo {mx}")
    for cod in filter(None, at.get("avisos", "").split(",")):
        for r in res:
            if cod not in r["warnings"]:
                fallos.append(f"[{nombre}] {r['method']}: falta el aviso {cod} en {r['warnings']}")


def correr(ogs: str, doc: dict) -> subprocess.CompletedProcess:
    with tempfile.NamedTemporaryFile("w", suffix=".ogs.json", delete=False) as f:
        json.dump(doc, f)
        ruta = f.name
    try:
        return subprocess.run([ogs, "analyze", ruta], capture_output=True, text=True)
    finally:
        Path(ruta).unlink(missing_ok=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ogs", default="target/release/ogs")
    ap.add_argument("--doc", default="docs/formato-ogs-json.md")
    ap.add_argument("--schema", default="schema/ogs-0.7.schema.json")
    a = ap.parse_args()

    validador = Draft202012Validator(json.loads(Path(a.schema).read_text()))
    texto = Path(a.doc).read_text()
    bloques = MARCA.findall(texto)
    ejemplos: dict[str, dict] = {}
    fallos: list[str] = []
    n_ej = n_fr = 0

    for tipo, attrs, cuerpo in bloques:
        at = atributos(attrs)
        valor = json.loads(cuerpo)
        if tipo == "ogs-ejemplo":
            n_ej += 1
            nombre = at["nombre"]
            ejemplos[nombre] = valor
            errs = sorted(validador.iter_errors(valor), key=lambda e: list(e.path))
            if errs:
                fallos.append(f"[{nombre}] el esquema lo rechaza: {errs[0].message[:200]}")
            p = correr(a.ogs, valor)
            if p.returncode != 0:
                fallos.append(f"[{nombre}] ogs salió con {p.returncode}: {p.stderr.strip()[:200]}")
                continue
            res = json.loads(p.stdout)["results"]
            esperado = at.get("estado", "converged")
            est, _, cod = esperado.partition(":")
            for r in res:
                if r["status"] != est or (cod and cod not in r["warnings"]):
                    fallos.append(f"[{nombre}] {r['method']}: estado {r['status']} {r['warnings']}, se esperaba {esperado}")
            comprobar_informe(nombre, res, at, fallos)
            print(f"ejemplo {nombre}: esquema OK, ogs " + ", ".join(f"{r['method']} {r['status']}" + (f" {r['fos']:.4f}" if r["fos"] else "") for r in res))
        else:
            n_fr += 1
            base = ejemplos.get(at["base"])
            if base is None:
                fallos.append(f"fragmento con base desconocida: {at['base']}")
                continue
            doc = fijar(base, at["ruta"], valor)
            nombre = f"{at['base']}:{at['ruta']}"
            rechaza = bool(list(validador.iter_errors(doc)))
            if (at["esquema"] == "rechaza") != rechaza:
                fallos.append(f"[{nombre}] el esquema {'rechaza' if rechaza else 'acepta'}, se esperaba {at['esquema']}")
            p = correr(a.ogs, doc)
            esp = at["esperado"]
            if esp == "ok":
                if p.returncode != 0:
                    fallos.append(f"[{nombre}] ogs salió con {p.returncode}: {p.stderr.strip()[:200]}")
                else:
                    res = json.loads(p.stdout)["results"]
                    if "estado" in at:
                        est, _, cod = at["estado"].partition(":")
                        for r in res:
                            if r["status"] != est or (cod and cod not in r["warnings"]):
                                fallos.append(f"[{nombre}] {r['method']}: estado {r['status']} {r['warnings']}, se esperaba {at['estado']}")
                    comprobar_informe(nombre, res, at, fallos)
            else:
                sub = esp.split(":", 1)[1].replace("~", " ")
                if p.returncode != 2 or sub not in p.stderr:
                    fallos.append(f"[{nombre}] código {p.returncode}, stderr {p.stderr.strip()[:200]!r}; se esperaba {sub!r}")
            print(f"fragmento {nombre}: ogs código {p.returncode}, esquema {'rechaza' if rechaza else 'acepta'}")

    print(f"\n{n_ej} ejemplos y {n_fr} fragmentos")
    if n_ej == 0:
        fallos.append("no se encontró ningún ejemplo marcado")
    for f in fallos:
        print("FALLO:", f)
    print("OK" if not fallos else f"{len(fallos)} fallos")
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
