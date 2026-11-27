//! Generalized Hoek–Brown envelope and instantaneous tangents (F6.8).
use crate::strength::HoekBrownParams;

fn envelope(p: &HoekBrownParams, s3: f64) -> (f64, f64, f64) {
    let base = (p.mb * s3 / p.ucs + p.s).max(1e-12);
    let delta = p.ucs * base.powf(p.a);
    let k = 1.0 + p.a * p.mb * base.powf(p.a - 1.0);
    let sn = s3 + delta / (k + 1.0);
    let tau = delta * k.sqrt() / (k + 1.0);
    (sn, tau, k)
}

pub(crate) fn sn_zero(p: &HoekBrownParams) -> f64 {
    envelope(p, 0.0).0
}

fn point(p: &HoekBrownParams, sn: f64, compatibility: bool) -> Option<(f64, f64, f64)> {
    let zero = sn_zero(p);
    let tension = -p.s * p.ucs / p.mb;
    if compatibility && sn <= zero {
        return Some(envelope(p, 0.0));
    }
    if !compatibility && sn <= tension {
        return None;
    }
    let (mut lo, mut hi) = if sn <= zero {
        (tension, 0.0)
    } else {
        let mut hi = sn.abs().max(1.0);
        while envelope(p, hi).0 < sn && hi.is_finite() {
            hi *= 2.0;
        }
        (0.0, hi)
    };
    for _ in 0..256 {
        if hi - lo <= 1e-12 * p.ucs {
            break;
        }
        let mid = lo + (hi - lo) * 0.5;
        if mid == lo || mid == hi {
            break;
        }
        if envelope(p, mid).0 < sn {
            lo = mid;
        } else {
            hi = mid;
        }
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
        let p = HoekBrownParams {
            ucs: 5000.0,
            mb: 8.0,
            s: 1.0,
            a: 0.5,
        };
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
    fn tension_cut_and_compatibility() {
        let p = HoekBrownParams {
            ucs: 15000.0,
            mb: 0.1,
            s: 0.0001,
            a: 0.5,
        };
        let st = -p.s * p.ucs / p.mb;
        assert_eq!(tangent(&p, st, false), (0.0, 0.0));
        assert_eq!(tau_at_normal(&p, st), 0.0);
        assert!(tangent(&p, st, true).0 > 0.0);
        let sn = (st + sn_zero(&p)) / 2.0;
        let (c, t) = tangent(&p, sn, false);
        assert!((c + sn * t - tau_at_normal(&p, sn)).abs() < 1e-7);
    }
}
