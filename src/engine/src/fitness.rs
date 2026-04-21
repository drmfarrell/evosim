// Fitness regimes. Turn a phenotype value set + population context into
// a fitness number. Fitness is *relative*: what matters is
// cross-individual comparison within the generation, not the absolute
// magnitude.

use crate::archetype::{Archetype, FitnessRegime};
use crate::creature::Creature;
use crate::phenotype::PhenotypeValues;

/// Evaluate fitness for a single creature under a named regime.
/// Requires the population's current phenotype frequency table for
/// frequency-dependent regimes.
pub fn fitness(
    regime: &FitnessRegime,
    creature: &Creature,
    phenotype: &PhenotypeValues,
    archetype: &Archetype,
    freq_table: Option<&FrequencyTable>,
) -> f64 {
    let w = match regime {
        FitnessRegime::Neutral => 1.0,
        FitnessRegime::Linear {
            channel,
            weight,
            target,
        } => {
            let v = phenotype.get(channel).copied().unwrap_or(0.0);
            // Fitness proportional to proximity to target along the gradient.
            1.0 + weight * (1.0 - (v - target).abs())
        }
        FitnessRegime::Gaussian {
            channel,
            weight,
            optimum,
            sigma,
        } => {
            let v = phenotype.get(channel).copied().unwrap_or(0.0);
            let d = v - optimum;
            weight * (-(d * d) / (2.0 * sigma * sigma)).exp()
        }
        FitnessRegime::Disruptive {
            channel,
            weight,
            center,
            sigma,
        } => {
            let v = phenotype.get(channel).copied().unwrap_or(0.0);
            let d = v - center;
            // Fitness is minimum at center, higher toward extremes.
            weight * (1.0 - (-(d * d) / (2.0 * sigma * sigma)).exp())
        }
        FitnessRegime::Overdominant {
            locus,
            homozygote_cost_aa,
            homozygote_cost_bb,
        } => overdominant_fitness(
            locus,
            *homozygote_cost_aa,
            *homozygote_cost_bb,
            creature,
            archetype,
        ),
        FitnessRegime::FrequencyDependent { channel, strength } => {
            let v = phenotype.get(channel).copied().unwrap_or(0.0);
            let freq = freq_table
                .and_then(|t| t.for_channel(channel).and_then(|m| m.nearest(v)))
                .unwrap_or(1.0);
            // Lower frequency → higher fitness.
            1.0 + strength * (1.0 - freq)
        }
    };
    w.max(0.0)
}

fn overdominant_fitness(
    locus_name: &str,
    cost_aa: f64,
    cost_bb: f64,
    creature: &Creature,
    archetype: &Archetype,
) -> f64 {
    // Find the locus.
    let (ci, li, on_sex, on_larger) = match archetype.find_locus(locus_name) {
        Some(t) => t,
        None => return 1.0,
    };

    let (a1, a2) = if !on_sex {
        let pair = &creature.autosomes[ci];
        (
            pair.maternal.get(li).copied().unwrap_or(u8::MAX),
            pair.paternal.get(li).copied().unwrap_or(u8::MAX),
        )
    } else if on_larger {
        let pair = match &creature.sex_chromosomes {
            Some(p) => p,
            None => return 1.0,
        };
        match (&pair.maternal_larger, &pair.paternal_larger) {
            (Some(m), Some(p)) => (
                m.get(li).copied().unwrap_or(u8::MAX),
                p.get(li).copied().unwrap_or(u8::MAX),
            ),
            (Some(m), None) => {
                // Hemizygous (XY male); no overdominance possible.
                let v = m.get(li).copied().unwrap_or(u8::MAX);
                return if v == 0 { 1.0 - cost_aa } else { 1.0 - cost_bb };
            }
            (None, Some(p)) => {
                let v = p.get(li).copied().unwrap_or(u8::MAX);
                return if v == 0 { 1.0 - cost_aa } else { 1.0 - cost_bb };
            }
            _ => return 1.0,
        }
    } else {
        // Smaller sex chromosome - rare.
        return 1.0;
    };

    if a1 == a2 {
        if a1 == 0 {
            (1.0 - cost_aa).max(0.0)
        } else {
            (1.0 - cost_bb).max(0.0)
        }
    } else {
        // Heterozygote: full fitness.
        1.0
    }
}

// ---- Frequency tables for frequency-dependent selection ----

use std::collections::BTreeMap;

/// Maps channel value (quantized to bin) -> fraction of population at
/// that value.
pub struct FrequencyTable {
    bins: BTreeMap<String, ChannelBins>,
}

pub struct ChannelBins {
    /// Sorted (value, frequency) pairs.
    entries: Vec<(f64, f64)>,
}

impl ChannelBins {
    /// Return the frequency at the bin closest to `v`, if any.
    pub fn nearest(&self, v: f64) -> Option<f64> {
        if self.entries.is_empty() {
            return None;
        }
        let mut best = self.entries[0];
        let mut best_diff = (best.0 - v).abs();
        for e in self.entries.iter().skip(1) {
            let d = (e.0 - v).abs();
            if d < best_diff {
                best_diff = d;
                best = *e;
            }
        }
        Some(best.1)
    }
}

impl FrequencyTable {
    pub fn build(phenotypes: &[PhenotypeValues], channels: &[String]) -> Self {
        let n = phenotypes.len().max(1) as f64;
        let mut bins: BTreeMap<String, ChannelBins> = BTreeMap::new();
        for chan in channels {
            let mut counts: BTreeMap<i64, usize> = BTreeMap::new();
            for ph in phenotypes {
                if let Some(&v) = ph.get(chan) {
                    // Quantize to 2 decimal places for binning.
                    let q = (v * 100.0).round() as i64;
                    *counts.entry(q).or_insert(0) += 1;
                }
            }
            let entries: Vec<(f64, f64)> = counts
                .into_iter()
                .map(|(k, c)| (k as f64 / 100.0, c as f64 / n))
                .collect();
            bins.insert(chan.clone(), ChannelBins { entries });
        }
        FrequencyTable { bins }
    }

    pub fn for_channel(&self, chan: &str) -> Option<&ChannelBins> {
        self.bins.get(chan)
    }
}
