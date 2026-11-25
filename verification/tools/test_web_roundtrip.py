"""Ida y vuelta de la web contra el motor real (E12g, R5-02).

Para los 21 casos de verificación (51 checks), los 14 modelos diferenciales (búsqueda y superficie fija, por método) y
los modelos de frontera de R5-02, se ejecuta ``ogs analyze`` sobre:

- el modelo original, y
- el texto que guarda la web (``openOgsJson`` + ``saveOgsJson``, módulos reales ejecutados con Node 22),

y se exige el **mismo** código de salida y la **misma** salida byte a byte (reporte idéntico). Antes de E12g, la web
redondeaba a 6 decimales y 6 de los 14 modelos fijos daban ``NoValidSurface``.

Desde la raíz del worktree (hace falta ``cargo build --release -p ogs-cli``)::

    env -u PYTHONPATH -u PYTHONHOME python -m pytest -q verification/tools/test_web_roundtrip.py

Como el resto de las pruebas con el motor, si falta el binario o Node la prueba **falla** (no pasa por omisión).
"""

from __future__ import annotations

import copy
import json
import os
import shutil
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
CASES = ROOT / "verification" / "cases"
DIFF_CASES = ROOT / "verification" / "differential" / "cases"
SAVE_SCRIPT = HERE / "web_roundtrip_save.mjs"
OGS_BIN = os.environ.get("OGS_BIN", str(ROOT / "target" / "release" / "ogs"))
NODE = os.environ.get("NODE", "node")
METHODS = ("bishop", "spencer")


def model_for_check(model: dict, check: dict) -> dict:
    """Igual que ``verification/harness/run.py``: un método, ``slices`` opcional y sin búsqueda si es fija."""
    m = copy.deepcopy(model)
    analysis = m.setdefault("analysis", {})
    analysis["methods"] = [check["method"]]
    if "slices" in check.get("options", {}):
        analysis["slices"] = int(check["options"]["slices"])
    if check["kind"] == "fixed":
        analysis.pop("search", None)
    return m


def verification_models() -> dict[str, dict]:
    out: dict[str, dict] = {}
    for path in sorted(CASES.glob("*.json")):
        if path.name.endswith(".schema.json"):
            continue
        case = json.loads(path.read_text(encoding="utf-8"))
        for i, check in enumerate(case["checks"]):
            out[f"{path.stem}-{i}-{check['method']}-{check['kind']}"] = model_for_check(case["model"], check)
    return out


def differential_models() -> dict[str, dict]:
    out: dict[str, dict] = {}
    for path in sorted(DIFF_CASES.glob("*.ogs.json")):
        model = json.loads(path.read_text(encoding="utf-8"))
        for method in METHODS:
            for kind in ("search", "fixed"):
                out[f"{model['meta']['id']}-{method}-{kind}"] = model_for_check(model, {"method": method, "kind": kind})
    return out


def boundary_models() -> dict[str, dict]:
    """Valores válidos en la frontera abierta de su rango, que ``round6`` llevaba a 0 o a 1 (R5-02)."""
    base = json.loads((DIFF_CASES / "D01.ogs.json").read_text(encoding="utf-8"))
    out: dict[str, dict] = {}

    def variant(name: str, edit) -> None:
        m = model_for_check(base, {"method": "bishop", "kind": "fixed"})
        edit(m)
        out[f"frontera-{name}"] = m

    variant("min_m_alpha-1e-7", lambda m: m["analysis"].__setitem__("min_m_alpha", 1e-7))
    variant("tolerance-1e-8", lambda m: m["analysis"].__setitem__("tolerance", 1e-8))
    variant("ru-0.9999999", lambda m: m["materials"][0].__setitem__("ru", 0.9999999))

    def seismic(key: str):
        def edit(m: dict) -> None:
            m["version"] = "0.2"
            m["analysis"]["seismic"] = {"kh": 0.1, "kv": 0.0, key: 0.9999999}

        return edit

    variant("kh-0.9999999", seismic("kh"))
    variant("kv-0.9999999", seismic("kv"))
    # Círculo fijo con coordenadas de 17 cifras: la ida y vuelta no puede tocarlas.
    variant("circulo-17-cifras", lambda m: m["analysis"].__setitem__(
        "surface", {"type": "circle", "xc": 49.57942825454256, "yc": 34.823211318713575, "r": 36.11677577292455}))
    return out


def all_models() -> dict[str, dict]:
    models = {**verification_models(), **differential_models(), **boundary_models()}
    assert len(models) >= 51 + 56 + 6
    return models


def analyze(path: Path) -> tuple[int, str, str]:
    proc = subprocess.run([OGS_BIN, "analyze", str(path)], capture_output=True, text=True, timeout=600)
    return proc.returncode, proc.stdout, proc.stderr


@pytest.fixture(scope="module")
def roundtrip(tmp_path_factory: pytest.TempPathFactory) -> dict[str, dict]:
    assert os.path.isfile(OGS_BIN), f"falta el binario del motor: {OGS_BIN} (cargo build --release -p ogs-cli)"
    node = shutil.which(NODE)
    assert node, "falta Node 22 para ejecutar saveOgsJson"
    tmp = tmp_path_factory.mktemp("web_roundtrip")
    src, dst = tmp / "original", tmp / "web"
    src.mkdir()
    models = all_models()
    for name, model in models.items():
        (src / f"{name}.json").write_text(json.dumps(model, ensure_ascii=False, indent=2), encoding="utf-8")
    proc = subprocess.run(
        [node, "--experimental-strip-types", "--no-warnings", str(SAVE_SCRIPT), str(src), str(dst)],
        capture_output=True, text=True, cwd=ROOT, timeout=300,
    )
    assert proc.returncode == 0, f"la web rechazó modelos válidos:\n{proc.stderr}\n{sorted(p.name for p in dst.glob('*.rejected'))}"

    names = sorted(models)
    with ThreadPoolExecutor(max_workers=os.cpu_count() or 4) as pool:
        originals = list(pool.map(lambda n: analyze(src / f"{n}.json"), names))
        saved = list(pool.map(lambda n: analyze(dst / f"{n}.json"), names))
    return {n: {"original": o, "web": s, "saved": dst / f"{n}.json", "model": models[n]}
            for n, o, s in zip(names, originals, saved)}


def test_cantidad_de_modelos() -> None:
    assert len(verification_models()) == 51
    assert len(differential_models()) == 14 * 2 * 2
    assert len([p for p in CASES.glob("*.json") if not p.name.endswith(".schema.json")]) == 21


def test_el_texto_guardado_conserva_los_numeros(roundtrip: dict[str, dict]) -> None:
    """Los números del archivo guardado son idénticos a los del original (solo cambian ``version`` y los vacíos)."""
    def strip(m: dict) -> dict:
        m = copy.deepcopy(m)
        m.pop("version", None)
        m.pop("meta", None)
        if m.get("loads") == []:
            m.pop("loads")
        return m

    for name, entry in roundtrip.items():
        saved = json.loads(entry["saved"].read_text(encoding="utf-8"))
        assert saved["version"] == "0.2", name
        assert strip(saved) == strip(entry["model"]), name


def test_ida_y_vuelta_da_el_mismo_reporte_bit_a_bit(roundtrip: dict[str, dict]) -> None:
    failures = []
    for name, entry in roundtrip.items():
        # El original debe calcular de verdad (reporte no vacío): una igualdad entre dos errores no prueba nada.
        assert entry["original"][0] == 0 and entry["original"][1].strip(), f"{name}: el original no calcula"
        if entry["original"] != entry["web"]:
            failures.append(f"{name}: original exit={entry['original'][0]} {entry['original'][2].strip()[:120]!r} "
                            f"| web exit={entry['web'][0]} {entry['web'][2].strip()[:120]!r}")
    assert not failures, f"{len(failures)}/{len(roundtrip)} modelos cambian tras abrir y guardar:\n" + "\n".join(failures)


def test_los_modelos_de_frontera_son_validos_para_el_motor(roundtrip: dict[str, dict]) -> None:
    for name, entry in roundtrip.items():
        if name.startswith("frontera-"):
            assert entry["original"][0] == 0, f"{name}: el original ya no es válido: {entry['original'][2]}"
            assert entry["web"][0] == 0, f"{name}: la web lo invalida: {entry['web'][2]}"
