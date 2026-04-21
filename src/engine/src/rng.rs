// PCG32 seedable RNG. Small, fast, and well-behaved for simulation use.
// Implementation: O'Neill 2014, "PCG: A Family of Simple Fast
// Space-Efficient Statistically Good Algorithms for Random Number
// Generation."
//
// We avoid `rand` crate at this layer to keep the wasm bundle small and
// to make the RNG stream fully deterministic across platforms.

pub struct Pcg32 {
    state: u64,
    inc: u64,
}

impl Pcg32 {
    pub fn new(seed: u64) -> Self {
        // Mix the seed so zero-seeds don't produce degenerate streams.
        let mut rng = Pcg32 {
            state: 0,
            inc: (seed.wrapping_shl(1) | 1).wrapping_mul(0x9E3779B97F4A7C15),
        };
        rng.next_u32();
        rng.state = rng.state.wrapping_add(seed ^ 0xDA3E39CB94B95BDB);
        rng.next_u32();
        rng
    }

    pub fn next_u32(&mut self) -> u32 {
        let oldstate = self.state;
        self.state = oldstate
            .wrapping_mul(6364136223846793005)
            .wrapping_add(self.inc | 1);
        let xorshifted: u32 = (((oldstate >> 18) ^ oldstate) >> 27) as u32;
        let rot: u32 = (oldstate >> 59) as u32;
        xorshifted.rotate_right(rot)
    }

    pub fn next_u64(&mut self) -> u64 {
        ((self.next_u32() as u64) << 32) | (self.next_u32() as u64)
    }

    /// Uniform f64 in [0.0, 1.0).
    pub fn next_f64(&mut self) -> f64 {
        // 53-bit mantissa precision.
        let x = self.next_u64() >> 11;
        (x as f64) * (1.0 / (1u64 << 53) as f64)
    }

    /// Uniform usize in [0, n). Panics if n == 0.
    pub fn gen_range_usize(&mut self, n: usize) -> usize {
        assert!(n > 0, "gen_range_usize requires n > 0");
        // Rejection sampling to avoid modulo bias for small n.
        let threshold = ((u32::MAX as u64 + 1) - (u32::MAX as u64 + 1) % (n as u64)) as u32;
        loop {
            let r = self.next_u32();
            if r < threshold {
                return (r as usize) % n;
            }
        }
    }

    /// Bernoulli trial with probability p.
    pub fn bernoulli(&mut self, p: f64) -> bool {
        self.next_f64() < p
    }

    /// Poisson-distributed non-negative integer with mean lambda.
    /// Knuth's algorithm. Fine for small lambda (< ~30); if we ever need
    /// large-mean Poisson, replace with rejection sampling.
    pub fn poisson(&mut self, lambda: f64) -> u32 {
        if lambda <= 0.0 {
            return 0;
        }
        let l = (-lambda).exp();
        let mut k: u32 = 0;
        let mut p: f64 = 1.0;
        loop {
            k += 1;
            p *= self.next_f64();
            if p <= l {
                return k - 1;
            }
        }
    }

    /// Gaussian-distributed f64 via Box-Muller.
    #[allow(dead_code)]
    pub fn normal(&mut self, mean: f64, sigma: f64) -> f64 {
        let u1 = self.next_f64().max(f64::MIN_POSITIVE);
        let u2 = self.next_f64();
        let z = (-2.0 * u1.ln()).sqrt() * (2.0 * std::f64::consts::PI * u2).cos();
        mean + z * sigma
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn different_seeds_produce_different_streams() {
        let mut a = Pcg32::new(1);
        let mut b = Pcg32::new(2);
        let mut differ = false;
        for _ in 0..10 {
            if a.next_u32() != b.next_u32() {
                differ = true;
                break;
            }
        }
        assert!(differ);
    }

    #[test]
    fn same_seed_is_reproducible() {
        let mut a = Pcg32::new(42);
        let mut b = Pcg32::new(42);
        for _ in 0..1000 {
            assert_eq!(a.next_u32(), b.next_u32());
        }
    }

    #[test]
    fn range_usize_is_bounded() {
        let mut r = Pcg32::new(7);
        for _ in 0..10_000 {
            let v = r.gen_range_usize(5);
            assert!(v < 5);
        }
    }

    #[test]
    fn bernoulli_is_approximately_right() {
        let mut r = Pcg32::new(99);
        let mut trues = 0;
        let n = 100_000;
        for _ in 0..n {
            if r.bernoulli(0.3) {
                trues += 1;
            }
        }
        let frac = trues as f64 / n as f64;
        assert!((frac - 0.3).abs() < 0.01, "frac was {}", frac);
    }

    #[test]
    fn poisson_mean_is_right() {
        let mut r = Pcg32::new(123);
        let n = 50_000;
        let mut total: u64 = 0;
        for _ in 0..n {
            total += r.poisson(2.0) as u64;
        }
        let mean = total as f64 / n as f64;
        assert!((mean - 2.0).abs() < 0.05, "mean was {}", mean);
    }

    #[test]
    fn normal_approx_mean_sigma() {
        let mut r = Pcg32::new(55);
        let n = 20_000;
        let mut sum = 0.0;
        let mut sq = 0.0;
        for _ in 0..n {
            let x = r.normal(0.0, 1.0);
            sum += x;
            sq += x * x;
        }
        let mean = sum / n as f64;
        let var = sq / n as f64 - mean * mean;
        assert!(mean.abs() < 0.05, "mean {} not near 0", mean);
        assert!((var - 1.0).abs() < 0.1, "var {} not near 1", var);
    }
}
