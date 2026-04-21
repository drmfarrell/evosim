// Per-locus per-generation mutation. Applied to a freshly-formed zygote.

use crate::archetype::Archetype;
use crate::chromosome::AlleleIdx;
use crate::creature::Creature;
use crate::rng::Pcg32;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MutationEvent {
    pub individual_id: u32,
    pub chromosome_idx: usize,
    pub is_sex_chromosome: bool,
    pub is_larger_sex_chromosome: bool,
    pub locus_idx: usize,
    pub old_allele: AlleleIdx,
    pub new_allele: AlleleIdx,
    pub homolog: HomologLabel,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HomologLabel {
    Maternal,
    Paternal,
    /// For XY male on X, or ZW female on W.
    SexSingle,
}

/// Apply per-locus mutation at rate `rate` per locus per generation.
/// Returns the list of events that fired (for logging in the UI).
pub fn mutate(
    creature: &mut Creature,
    archetype: &Archetype,
    rate: f64,
    rng: &mut Pcg32,
) -> Vec<MutationEvent> {
    let mut events = Vec::new();

    // Autosomes.
    for (ci, spec) in archetype.autosomes.iter().enumerate() {
        let pair = &mut creature.autosomes[ci];
        for (li, locus) in spec.loci.iter().enumerate() {
            mutate_one(
                &mut pair.maternal,
                li,
                &locus.alleles,
                rate,
                rng,
                &mut events,
                creature.id,
                ci,
                false,
                false,
                HomologLabel::Maternal,
            );
            mutate_one(
                &mut pair.paternal,
                li,
                &locus.alleles,
                rate,
                rng,
                &mut events,
                creature.id,
                ci,
                false,
                false,
                HomologLabel::Paternal,
            );
        }
    }

    // Sex chromosomes.
    if let (Some(sc_spec), Some(pair)) = (
        &archetype.sex_chromosome,
        creature.sex_chromosomes.as_mut(),
    ) {
        for (li, locus) in sc_spec.larger_loci.iter().enumerate() {
            if let Some(h) = pair.maternal_larger.as_mut() {
                mutate_one(
                    h,
                    li,
                    &locus.alleles,
                    rate,
                    rng,
                    &mut events,
                    creature.id,
                    0,
                    true,
                    true,
                    HomologLabel::Maternal,
                );
            }
            if let Some(h) = pair.paternal_larger.as_mut() {
                mutate_one(
                    h,
                    li,
                    &locus.alleles,
                    rate,
                    rng,
                    &mut events,
                    creature.id,
                    0,
                    true,
                    true,
                    HomologLabel::Paternal,
                );
            }
            if let Some(h) = pair.smaller.as_mut() {
                if li < h.len() {
                    mutate_one(
                        h,
                        li,
                        &locus.alleles,
                        rate,
                        rng,
                        &mut events,
                        creature.id,
                        0,
                        true,
                        false,
                        HomologLabel::SexSingle,
                    );
                }
            }
        }
    }

    events
}

#[allow(clippy::too_many_arguments)]
fn mutate_one(
    homolog: &mut [AlleleIdx],
    li: usize,
    alleles: &[String],
    rate: f64,
    rng: &mut Pcg32,
    events: &mut Vec<MutationEvent>,
    individual_id: u32,
    chromosome_idx: usize,
    is_sex: bool,
    is_larger: bool,
    label: HomologLabel,
) {
    if li >= homolog.len() {
        return;
    }
    if !rng.bernoulli(rate) {
        return;
    }
    let old = homolog[li];
    if alleles.len() < 2 {
        return;
    }
    // Resample uniformly from alleles excluding the current one.
    let n = alleles.len() as u8;
    let mut new = rng.gen_range_usize((n - 1) as usize) as u8;
    if new >= old {
        new += 1;
    }
    homolog[li] = new;
    events.push(MutationEvent {
        individual_id,
        chromosome_idx,
        is_sex_chromosome: is_sex,
        is_larger_sex_chromosome: is_larger,
        locus_idx: li,
        old_allele: old,
        new_allele: new,
        homolog: label,
    });
}
