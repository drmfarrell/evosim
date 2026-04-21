// Phenotype assembly: given a creature's genotype and the archetype's
// phenotype mappings, compute per-channel phenotype values.
//
// The engine computes the genotype-driven baseline value. Per-individual
// jitter is applied on the JS side during render so it doesn't affect
// fitness computation.

use crate::archetype::{Archetype, PhenotypeMapping};
use crate::chromosome::{AlleleIdx, Dominance, SexSystem};
use crate::creature::Creature;
use std::collections::BTreeMap;

/// One per channel. Values have not been jittered or clamped yet.
pub type PhenotypeValues = BTreeMap<String, f64>;

/// Compute phenotype channel values for a creature.
pub fn phenotype(creature: &Creature, archetype: &Archetype) -> PhenotypeValues {
    let mut values: BTreeMap<String, f64> = BTreeMap::new();

    // Autosomal contributions.
    for (ci, spec) in archetype.autosomes.iter().enumerate() {
        let pair = &creature.autosomes[ci];
        for (li, locus) in spec.loci.iter().enumerate() {
            let a1 = pair.maternal.get(li).copied().unwrap_or(u8::MAX);
            let a2 = pair.paternal.get(li).copied().unwrap_or(u8::MAX);
            add_contribution(&mut values, locus, archetype, a1, a2);
        }
    }

    // Sex-chromosome contributions.
    if let (Some(sc_spec), Some(pair)) = (
        &archetype.sex_chromosome,
        creature.sex_chromosomes.as_ref(),
    ) {
        for (li, locus) in sc_spec.larger_loci.iter().enumerate() {
            match (
                pair.maternal_larger.as_ref().and_then(|h| h.get(li).copied()),
                pair.paternal_larger.as_ref().and_then(|h| h.get(li).copied()),
                pair.smaller.is_some(),
                archetype.sex_determination,
            ) {
                (Some(m), Some(p), _, _) => {
                    // Two larger-chromosome alleles (homozygous sex).
                    add_contribution(&mut values, locus, archetype, m, p);
                }
                (Some(m), None, true, SexSystem::XY) => {
                    // Hemizygous male: only one X allele.
                    add_contribution_hemizygous(&mut values, locus, archetype, m);
                }
                (None, Some(p), true, SexSystem::ZW) => {
                    // Hemizygous ZW female: only one Z allele from father.
                    add_contribution_hemizygous(&mut values, locus, archetype, p);
                }
                _ => {}
            }
        }
    }

    values
}

fn add_contribution(
    values: &mut PhenotypeValues,
    locus: &crate::chromosome::Locus,
    archetype: &Archetype,
    a1: AlleleIdx,
    a2: AlleleIdx,
) {
    let mapping = match archetype.phenotype_mappings.get(&locus.name) {
        Some(m) => m,
        None => return,
    };
    let channel = &locus.phenotype_channel;
    let value = match mapping {
        PhenotypeMapping::Lookup { values_by_genotype } => {
            let key = genotype_key(locus, a1, a2);
            *values_by_genotype.get(&key).unwrap_or(&0.0)
        }
        PhenotypeMapping::Additive {
            contribution_by_allele,
        } => {
            let k1 = locus.alleles.get(a1 as usize).cloned().unwrap_or_default();
            let k2 = locus.alleles.get(a2 as usize).cloned().unwrap_or_default();
            contribution_by_allele.get(&k1).copied().unwrap_or(0.0)
                + contribution_by_allele.get(&k2).copied().unwrap_or(0.0)
        }
    };
    *values.entry(channel.clone()).or_insert(0.0) += value;
}

fn add_contribution_hemizygous(
    values: &mut PhenotypeValues,
    locus: &crate::chromosome::Locus,
    archetype: &Archetype,
    a: AlleleIdx,
) {
    let mapping = match archetype.phenotype_mappings.get(&locus.name) {
        Some(m) => m,
        None => return,
    };
    let channel = &locus.phenotype_channel;
    let value = match mapping {
        PhenotypeMapping::Lookup { values_by_genotype } => {
            // Try a "hemi" key like "E_" (convention: allele + underscore).
            let allele_name = locus.alleles.get(a as usize).cloned().unwrap_or_default();
            let hemi_key = format!("{}_", allele_name);
            if let Some(v) = values_by_genotype.get(&hemi_key) {
                *v
            } else {
                // Fall back: treat as homozygous.
                let key = genotype_key(locus, a, a);
                *values_by_genotype.get(&key).unwrap_or(&0.0)
            }
        }
        PhenotypeMapping::Additive {
            contribution_by_allele,
        } => {
            let k = locus.alleles.get(a as usize).cloned().unwrap_or_default();
            contribution_by_allele.get(&k).copied().unwrap_or(0.0)
        }
    };
    *values.entry(channel.clone()).or_insert(0.0) += value;
}

/// Construct a genotype lookup key like "AA", "Aa", "aa".
/// Ordering normalized so "Aa" and "aA" both produce "Aa".
fn genotype_key(locus: &crate::chromosome::Locus, a1: AlleleIdx, a2: AlleleIdx) -> String {
    let n1 = locus.alleles.get(a1 as usize).cloned().unwrap_or_default();
    let n2 = locus.alleles.get(a2 as usize).cloned().unwrap_or_default();
    match locus.dominance {
        Dominance::Complete => {
            // Put the dominant allele first if present.
            let dom = locus.dominant_allele.unwrap_or(0);
            if a1 == dom && a2 != dom {
                format!("{}{}", n1, n2)
            } else if a2 == dom && a1 != dom {
                format!("{}{}", n2, n1)
            } else {
                format!("{}{}", n1, n2)
            }
        }
        _ => {
            // Alphabetize for a canonical form.
            if n1 <= n2 {
                format!("{}{}", n1, n2)
            } else {
                format!("{}{}", n2, n1)
            }
        }
    }
}
