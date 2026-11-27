//! Generalized Hoek–Brown envelope and instantaneous tangents (F6.8).
use crate::strength::HoekBrownParams;

fn envelope(p: &HoekBrownParams, s3: f64) -> (f64, f64, f64) {
    let base = (p.mb * s3 / p.ucs + p.s).max(1e-12);
    let ba = base.powf(p.a);
    let delta = p.ucs * ba;
    let k = 1.0 + p.a * p.mb * (ba / base);
    let sn = s3 + delta / (k + 1.0);
    let tau = delta * k.sqrt() / (k + 1.0);
    (sn, tau, k)
}

pub(crate) fn sn_zero(p: &HoekBrownParams) -> f64 {
    p.sn_zero
}

fn point(p: &HoekBrownParams, sn: f64, compatibility: bool) -> Option<(f64, f64, f64)> {
    let zero = p.sn_zero;
    let tension = p.tension;
    if compatibility && sn <= zero {
        return Some(envelope(p, 0.0));
    }
    if !compatibility && sn <= tension {
        return None;
    }
    let (mut lo, mut hi) = if sn <= zero {
        (tension, 0.0)
    } else {
        (0.0, sn)
    };
    let mut x = lo + (hi - lo) * 0.5;
    for _ in 0..256 {
        if hi - lo <= 1e-12 * p.ucs || x == lo || x == hi {
            break;
        }
        let value = envelope(p, x);
        let residual = value.0 - sn;
        if residual.abs() <= 1e-14 * p.ucs.max(sn.abs()) {
            return Some(value);
        }
        if residual < 0.0 {
            lo = x;
        } else {
            hi = x;
        }
        let raw_base = p.mb * x / p.ucs + p.s;
        let base = raw_base.max(1e-12);
        let delta = value.1 * ((value.2 + 1.0) / value.2.sqrt());
        let k = value.2;
        let dk = if raw_base > 1e-12 {
            (k - 1.0) * (p.a - 1.0) * (p.mb / p.ucs) / base
        } else {
            0.0
        };
        let dd = if raw_base > 1e-12 { k - 1.0 } else { 0.0 };
        let slope = 1.0 + dd / (k + 1.0) - (delta / (k + 1.0)) * (dk / (k + 1.0));
        let next = x - residual / slope;
        x = if slope.is_finite() && slope > 0.0 && next > lo && next < hi {
            next
        } else {
            lo + (hi - lo) * 0.5
        };
    }
    Some(envelope(p, lo + (hi - lo) * 0.5))
}

pub(crate) fn tangent(p: &HoekBrownParams, sn: f64, compatibility: bool) -> (f64, f64) {
    let Some((normal, tau, k)) = point(p, sn, compatibility) else {
        return (0.0, 0.0);
    };
    let phi = ((k - 1.0) / (k + 1.0))
        .clamp(-1.0, 1.0)
        .asin()
        .min(89.9_f64.to_radians());
    let t = phi.tan();
    ((tau - normal * t).max(0.0), t)
}

/// Envelope shear strength at effective normal stress for slice faces.
pub(crate) fn tau_at_normal(p: &HoekBrownParams, sn: f64) -> f64 {
    point(p, sn, false).map_or(0.0, |(_, tau, _)| tau)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn original_1980_envelope_at_gsi_100() {
        let p = HoekBrownParams::new(5000.0, 8.0, 1.0, 0.5);
        for s3 in [0.0, 10.0, 100.0, 1000.0] {
            let (normal, tau, _) = envelope(&p, s3);
            let s1 = s3 + (p.mb * p.ucs * s3 + p.ucs * p.ucs).sqrt();
            let k = 1.0 + p.mb * p.ucs / (2.0 * (p.mb * p.ucs * s3 + p.ucs * p.ucs).sqrt());
            let expected_tau = (s1 - s3) * k.sqrt() / (k + 1.0);
            assert!((tau - expected_tau).abs() < 1e-9);
            assert!((tau_at_normal(&p, normal) - tau).abs() < 1e-7);
        }
    }

    #[test]
    fn safeguarded_solution_matches_bisection_over_envelope() {
        for (ucs, mb, s, a) in [
            (15000.0, 0.1, 0.0001, 0.5),
            (5000.0, 8.0, 1.0, 0.5),
            (12000.0, 0.08, 1e-6, 0.53),
        ] {
            let p = HoekBrownParams::new(ucs, mb, s, a);
            for sn in [
                p.tension * 0.9,
                p.tension * 0.5,
                0.0,
                p.sn_zero,
                1.0,
                100.0,
                10000.0,
            ] {
                if sn <= p.tension {
                    continue;
                }
                let (mut lo, mut hi) = if sn <= p.sn_zero {
                    (p.tension, 0.0)
                } else {
                    (0.0, sn)
                };
                for _ in 0..200 {
                    let mid = lo + (hi - lo) * 0.5;
                    if mid == lo || mid == hi {
                        break;
                    }
                    if envelope(&p, mid).0 < sn {
                        lo = mid;
                    } else {
                        hi = mid;
                    }
                }
                let expected = envelope(&p, lo + (hi - lo) * 0.5);
                let actual = point(&p, sn, false).unwrap();
                assert!((actual.0 - expected.0).abs() <= 1e-10 * ucs, "sn={sn}");
                assert!((actual.1 - expected.1).abs() <= 1e-9 * ucs, "sn={sn}");
            }
        }
    }

    #[test]
    fn tension_cut_and_compatibility() {
        let p = HoekBrownParams::new(15000.0, 0.1, 0.0001, 0.5);
        let st = -p.s * p.ucs / p.mb;
        assert_eq!(tangent(&p, st, false), (0.0, 0.0));
        assert_eq!(tau_at_normal(&p, st), 0.0);
        assert!(tangent(&p, st, true).0 > 0.0);
        let sn = (st + sn_zero(&p)) / 2.0;
        let (c, t) = tangent(&p, sn, false);
        assert!((c + sn * t - tau_at_normal(&p, sn)).abs() < 1e-7);
    }
}
