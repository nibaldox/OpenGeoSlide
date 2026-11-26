"""Tests de `forces.py` (comparación por cruce de las fuerzas de ogs y del oráculo)."""

from __future__ import annotations

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from forces import compare_forces, element_ids, oracle_forces_by_id  # noqa: E402

MODEL = {"reinforcements": [
    {"id": "P1", "type": "pile"},
    {"id": "A1", "type": "anchor", "x1": 0.0, "y1": 0.0, "x2": 10.0, "y2": 0.0, "tensile_capacity": 100.0},
    {"id": "G1", "type": "geosynthetic", "x1": 0.0, "y1": 5.0, "x2": 10.0, "y2": 5.0, "tensile_capacity": 10.0,
     "pullout": {"model": "development", "length1": 2.0, "length2": 2.0}},
]}


def _og(i, x, fx, fy=0.0, status="applied"):
    return {"id": i, "x": x, "y": 1.0, "fx": fx, "fy": fy, "status": status, "application": "active"}


def _cs(index, x, fx, fy=0.0, pile=None):
    return {"index": index, "x": x, "y": 1.0, "fx": fx, "fy": fy, "pile": pile}


def test_the_oracle_numbers_tension_elements_and_piles_apart():
    assert element_ids(MODEL) == (["A1", "G1"], ["P1"])
    got = oracle_forces_by_id(MODEL, [_cs(0, 1, 1), _cs(1, 2, 1), _cs(0, 3, 1, pile=True)])
    assert [i for i, _ in got] == ["A1", "G1", "P1"]


def test_equal_forces_are_identical_and_position_differences_do_not_count_as_force():
    r = compare_forces(MODEL, [_og("A1", 4.0, 50.0)], [_cs(0, 4.001, 50.0)])
    assert r["unexplained"] == 0 and r["pairs"][0]["explanation"] == "igual"
    assert math.isclose(r["max_dxy"], 0.001) and r["max_dF"] == 0.0


def test_same_magnitude_other_direction_is_a_direction_difference():
    a = (60.0 * math.cos(0.9), 60.0 * math.sin(0.9))
    b = (60.0 * math.cos(0.88), 60.0 * math.sin(0.88))
    r = compare_forces(MODEL, [_og("P1", 9.0, *a)], [_cs(0, 9.0, *b, pile=True)])
    p = r["pairs"][0]
    assert p["explanation"] == "direccion" and math.isclose(p["dangle_deg"], math.degrees(-0.02), rel_tol=1e-9)


def test_a_ramp_difference_is_explained_by_the_slope_times_the_position_shift():
    # Tmax/ℓ1 = 5 kN/m por metro; Δs = −0,001 → ΔF = −0,005
    r = compare_forces(MODEL, [_og("G1", 1.000, 5.0)], [_cs(1, 0.999, 4.995)])
    p = r["pairs"][0]
    assert p["explanation"] == "rampa" and math.isclose(p["slope"], 5.0), p
    assert r["unexplained"] == 0


def test_an_unexplained_difference_and_unmatched_crossings_are_counted():
    r = compare_forces(MODEL, [_og("A1", 4.0, 50.0), _og("A1", 6.0, 50.0)], [_cs(0, 4.0, 40.0)])
    assert r["pairs"][0]["explanation"] == "sin explicar"
    assert len(r["only_ogs"]) == 1 and r["only_oracle"] == [] and r["unexplained"] == 2


def test_forces_not_applied_are_listed_apart_and_not_compared():
    r = compare_forces(MODEL, [_og("A1", 4.0, 0.0, status="no_capacity")], [])
    assert r["n_ogs"] == 0 and r["ogs_not_applied"] == [{"id": "A1", "status": "no_capacity"}] and r["unexplained"] == 0


def test_the_radial_offset_of_the_oracle_point_is_measured_against_the_exact_circle():
    circle = {"xc": 0.0, "yc": 0.0, "r": 10.0}
    o = {"id": "A1", "x": 6.0, "y": 8.0, "fx": 1.0, "fy": 0.0, "status": "applied"}
    c = {"index": 0, "x": 5.99, "y": 7.99, "fx": 1.0, "fy": 0.0}
    r = compare_forces(MODEL, [o], [c], circle)
    assert math.isclose(r["max_radial_oracle"], abs(math.hypot(5.99, 7.99) - 10.0))
