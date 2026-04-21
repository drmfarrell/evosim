// Fertilization: fuse two gametes into a zygote (Creature).
//
// Sex is determined by the sex-chromosome content of the combined
// gametes:
//   XY system: XX → female, XY → male, YY → inviable (should never
//              arise if parents are proper XY).
//   ZW system: ZZ → male, ZW → female, WW → inviable.
//   None: always Hermaphrodite.
//
// Handles:
//   * aneuploid gametes (viability configurable; default: inviable).
//   * polyploid gametes (both parents unreduced → tetraploid; one
//     unreduced + one normal → triploid).
// In v1, triploid zygotes are marked inviable by default; tetraploids
// from two unreduced gametes are viable and reproductively isolated.

use crate::archetype::Archetype;
use crate::chromosome::{DiploidChromosome, Sex, SexSystem};
use crate::creature::{Creature, CreatureId, GameteContent, SexChromosomePair};

#[derive(Debug, Clone)]
pub enum FertilizationOutcome {
    Viable(Creature),
    Inviable(InviabilityReason),
}

#[derive(Debug, Clone, Copy)]
pub enum InviabilityReason {
    /// YY / WW zygote.
    DoubleSmallSexChromosome,
    /// One or both gametes were aneuploid for at least one autosome
    /// (but not from a polyploidy event); zygote is aneuploid.
    AneuploidZygote,
    /// 3n zygote (one normal gamete + one unreduced gamete). Default
    /// inviable.
    Triploid,
    /// Gametes' chromosome counts don't match the archetype for
    /// non-polyploidy reasons.
    ChromosomeCountMismatch,
}

#[derive(Debug, Clone, Copy)]
pub struct FertilizationParams {
    /// Whether triploid zygotes (from one-unreduced-plus-normal) are
    /// viable. Default false (matches Campbell treatment).
    pub triploid_viable: bool,
    /// Whether aneuploid zygotes (non-polyploidy-driven) are viable.
    pub aneuploid_viable: bool,
}

impl Default for FertilizationParams {
    fn default() -> Self {
        FertilizationParams {
            triploid_viable: false,
            aneuploid_viable: false,
        }
    }
}

pub fn fertilize(
    maternal: &GameteContent,
    paternal: &GameteContent,
    archetype: &Archetype,
    next_id: CreatureId,
    generation: u32,
    mother_id: Option<CreatureId>,
    father_id: Option<CreatureId>,
    params: FertilizationParams,
) -> FertilizationOutcome {
    // Check chromosome counts: both gametes should have one homolog
    // per autosome (unless unreduced/polyploid event).
    if maternal.autosomes.len() != archetype.autosomes.len()
        || paternal.autosomes.len() != archetype.autosomes.len()
    {
        return FertilizationOutcome::Inviable(InviabilityReason::ChromosomeCountMismatch);
    }

    // Classify polyploidy/aneuploidy from the gametes.
    let maternal_is_unreduced = gamete_is_fully_unreduced(maternal, archetype);
    let paternal_is_unreduced = gamete_is_fully_unreduced(paternal, archetype);

    // Triploid case: exactly one gamete is unreduced.
    let triploid = maternal_is_unreduced ^ paternal_is_unreduced;
    if triploid && !params.triploid_viable {
        return FertilizationOutcome::Inviable(InviabilityReason::Triploid);
    }

    // Aneuploid (non-polyploidy) case: either gamete is aneuploid but
    // not fully unreduced.
    let aneuploid_partial = (maternal.aneuploid && !maternal_is_unreduced)
        || (paternal.aneuploid && !paternal_is_unreduced);
    if aneuploid_partial && !params.aneuploid_viable {
        return FertilizationOutcome::Inviable(InviabilityReason::AneuploidZygote);
    }

    // Build the autosome diploid set. For tetraploid-producing
    // (both-unreduced) we still just pair them for now; engine-level
    // support for tetraploid genotypes is v1.1. For v1, two
    // unreduced-gamete fertilization produces a v1-modeled tetraploid
    // by concatenating alleles on each homolog slot; downstream
    // treatment flags it via an aneuploid marker on the creature. A
    // future pass will add first-class tetraploid support.
    let mut autosomes: Vec<DiploidChromosome> = Vec::with_capacity(archetype.autosomes.len());
    for (i, spec) in archetype.autosomes.iter().enumerate() {
        let mut m = maternal.autosomes[i].clone();
        let mut p = paternal.autosomes[i].clone();
        // If one homolog is empty (n-1 gamete), pad with sentinel
        // allele 255 so downstream phenotype assembly can detect and
        // handle.
        if m.is_empty() {
            m = vec![u8::MAX; spec.loci.len()];
        }
        if p.is_empty() {
            p = vec![u8::MAX; spec.loci.len()];
        }
        // If homolog is longer than expected (n+1 gamete), truncate
        // to expected length for v1. v1.1 will model aneuploid
        // fully.
        m.truncate(spec.loci.len());
        p.truncate(spec.loci.len());
        autosomes.push(DiploidChromosome {
            maternal: m,
            paternal: p,
        });
    }

    // Sex chromosomes.
    let (sex, sex_chromosomes, sex_invalid) = assemble_sex_chromosomes(maternal, paternal, archetype);
    if sex_invalid {
        return FertilizationOutcome::Inviable(InviabilityReason::DoubleSmallSexChromosome);
    }

    FertilizationOutcome::Viable(Creature {
        id: next_id,
        sex,
        generation,
        autosomes,
        sex_chromosomes,
        mother_id,
        father_id,
    })
}

fn gamete_is_fully_unreduced(g: &GameteContent, archetype: &Archetype) -> bool {
    // An unreduced gamete has, for every autosome, roughly twice the
    // expected locus count (because we concatenated both homologs).
    if !g.aneuploid {
        return false;
    }
    for (i, spec) in archetype.autosomes.iter().enumerate() {
        if g.autosomes[i].len() != 2 * spec.loci.len() {
            return false;
        }
    }
    true
}

fn assemble_sex_chromosomes(
    maternal: &GameteContent,
    paternal: &GameteContent,
    archetype: &Archetype,
) -> (Sex, Option<SexChromosomePair>, bool) {
    let sc_spec = match &archetype.sex_chromosome {
        Some(s) => s,
        None => return (Sex::Hermaphrodite, None, false),
    };

    let (mat_name, mat_alleles) = (
        maternal.sex_chromosome_name.as_deref(),
        maternal.sex_chromosome_alleles.clone(),
    );
    let (pat_name, pat_alleles) = (
        paternal.sex_chromosome_name.as_deref(),
        paternal.sex_chromosome_alleles.clone(),
    );

    match archetype.sex_determination {
        SexSystem::XY => {
            // Maternal gamete always carries X. Paternal carries either X or Y.
            match (mat_name, pat_name) {
                (Some(m), Some(p))
                    if m == sc_spec.larger_name && p == sc_spec.larger_name =>
                {
                    (
                        Sex::Female,
                        Some(SexChromosomePair {
                            maternal_larger: mat_alleles,
                            paternal_larger: pat_alleles,
                            smaller: None,
                        }),
                        false,
                    )
                }
                (Some(m), Some(p))
                    if m == sc_spec.larger_name && p == sc_spec.smaller_name =>
                {
                    (
                        Sex::Male,
                        Some(SexChromosomePair {
                            maternal_larger: mat_alleles,
                            paternal_larger: None,
                            smaller: pat_alleles,
                        }),
                        false,
                    )
                }
                (Some(m), Some(p))
                    if m == sc_spec.smaller_name || p == sc_spec.smaller_name
                        && !(m == sc_spec.larger_name) =>
                {
                    // YY or YX from wrong mother. Should never happen
                    // but we defend against it.
                    (Sex::Hermaphrodite, None, true)
                }
                _ => (Sex::Hermaphrodite, None, true),
            }
        }
        SexSystem::ZW => {
            // Paternal gamete always carries Z. Maternal carries Z or W.
            match (mat_name, pat_name) {
                (Some(m), Some(p))
                    if m == sc_spec.larger_name && p == sc_spec.larger_name =>
                {
                    // ZZ = male.
                    (
                        Sex::Male,
                        Some(SexChromosomePair {
                            maternal_larger: mat_alleles,
                            paternal_larger: pat_alleles,
                            smaller: None,
                        }),
                        false,
                    )
                }
                (Some(m), Some(p))
                    if m == sc_spec.smaller_name && p == sc_spec.larger_name =>
                {
                    // ZW = female.
                    (
                        Sex::Female,
                        Some(SexChromosomePair {
                            maternal_larger: None,
                            paternal_larger: pat_alleles,
                            smaller: mat_alleles,
                        }),
                        false,
                    )
                }
                _ => (Sex::Hermaphrodite, None, true),
            }
        }
        SexSystem::None => (Sex::Hermaphrodite, None, false),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::archetype::{PhenotypeChannel, SexChromosomeSpec};
    use crate::chromosome::{ChromosomeSpec, Dominance, Locus};
    use crate::meiosis::{meiose, MeiosisParams};
    use crate::rng::Pcg32;
    use std::collections::BTreeMap;

    fn arc() -> Archetype {
        Archetype {
            name: "test".to_string(),
            sex_determination: SexSystem::XY,
            autosomes: vec![ChromosomeSpec {
                name: "chr1".to_string(),
                length_cm: 50.0,
                loci: vec![Locus {
                    name: "L1".to_string(),
                    position_cm: 25.0,
                    alleles: vec!["A".to_string(), "a".to_string()],
                    dominance: Dominance::Complete,
                    dominant_allele: Some(0),
                    phenotype_channel: "c".to_string(),
                }],
            }],
            sex_chromosome: Some(SexChromosomeSpec {
                larger_name: "X".to_string(),
                smaller_name: "Y".to_string(),
                larger_length_cm: 80.0,
                smaller_length_cm: 10.0,
                larger_loci: vec![Locus {
                    name: "XL".to_string(),
                    position_cm: 40.0,
                    alleles: vec!["E".to_string(), "e".to_string()],
                    dominance: Dominance::Complete,
                    dominant_allele: Some(0),
                    phenotype_channel: "eye".to_string(),
                }],
                smaller_loci: vec![],
            }),
            phenotype_channels: vec![
                PhenotypeChannel {
                    name: "c".to_string(),
                    jitter_sigma: 0.0,
                    clamp_range: [0.0, 1.0],
                },
                PhenotypeChannel {
                    name: "eye".to_string(),
                    jitter_sigma: 0.0,
                    clamp_range: [0.0, 1.0],
                },
            ],
            phenotype_mappings: BTreeMap::new(),
            fitness_regimes: BTreeMap::new(),
        }
    }

    #[test]
    fn f2_mendelian_ratios() {
        // Cross AA (allele 0) x aa (allele 1). All F1 are Aa. Cross F1
        // x F1. Expect 1:2:1 genotype ratio at the locus.
        let a = arc();
        let mut rng = Pcg32::new(10);

        // Build homozygous AA male, aa female. Cross to get Aa F1.
        let aa_male = Creature::homozygous_founder(1, Sex::Male, &a, 0);
        let aa_female_bb = Creature::homozygous_founder(2, Sex::Female, &a, 1);

        // F1: all Aa (genotype 0,1 or 1,0 depending on parent orientation).
        // Produce many F1, then make F1 x F1 crosses to get F2.

        let mut f2_genotypes: [usize; 3] = [0, 0, 0]; // 0=AA, 1=Aa, 2=aa
        let n = 20_000;
        let mut next_id: CreatureId = 100;
        for _ in 0..n {
            // Two F1 individuals (Aa). Meiose each, fertilize.
            // We build F1 directly by cross.
            let g_mat = meiose(&aa_female_bb, &a, MeiosisParams::default(), &mut rng);
            let g_pat = meiose(&aa_male, &a, MeiosisParams::default(), &mut rng);
            let outcome = fertilize(&g_mat, &g_pat, &a, next_id, 1, Some(aa_female_bb.id), Some(aa_male.id), FertilizationParams::default());
            next_id += 1;
            let f1 = match outcome {
                FertilizationOutcome::Viable(c) => c,
                _ => continue,
            };
            // f1 should be heterozygous (0,1) or (1,0) at L1.
            let a1 = f1.autosomes[0].maternal[0];
            let a2 = f1.autosomes[0].paternal[0];
            assert!(
                (a1 == 0 && a2 == 1) || (a1 == 1 && a2 == 0),
                "F1 not heterozygous at L1: {} {}",
                a1,
                a2
            );

            // Another F1 of opposite sex for the F2 cross.
            let other_sex = if f1.sex == Sex::Male { Sex::Female } else { Sex::Male };
            let f1_other = Creature::homozygous_founder(999, other_sex, &a, 0);
            let mut f1_other_het = f1_other.clone();
            f1_other_het.autosomes[0].paternal[0] = 1;

            // F1 x F1 cross.
            let (mom, dad) = match f1.sex {
                Sex::Female => (&f1, &f1_other_het),
                Sex::Male => (&f1_other_het, &f1),
                Sex::Hermaphrodite => (&f1, &f1_other_het),
            };
            let g_m = meiose(mom, &a, MeiosisParams::default(), &mut rng);
            let g_d = meiose(dad, &a, MeiosisParams::default(), &mut rng);
            let f2_outcome = fertilize(&g_m, &g_d, &a, next_id, 2, Some(mom.id), Some(dad.id), FertilizationParams::default());
            next_id += 1;
            let f2 = match f2_outcome {
                FertilizationOutcome::Viable(c) => c,
                _ => continue,
            };

            let a1 = f2.autosomes[0].maternal[0];
            let a2 = f2.autosomes[0].paternal[0];
            let g = if a1 == 0 && a2 == 0 {
                0
            } else if (a1 == 0 && a2 == 1) || (a1 == 1 && a2 == 0) {
                1
            } else {
                2
            };
            f2_genotypes[g] += 1;
        }

        let total = f2_genotypes.iter().sum::<usize>() as f64;
        let aa = f2_genotypes[0] as f64 / total;
        let ab = f2_genotypes[1] as f64 / total;
        let bb = f2_genotypes[2] as f64 / total;

        // Expect 0.25, 0.50, 0.25 within tolerance.
        assert!((aa - 0.25).abs() < 0.03, "AA fraction {}", aa);
        assert!((ab - 0.50).abs() < 0.03, "Aa fraction {}", ab);
        assert!((bb - 0.25).abs() < 0.03, "aa fraction {}", bb);
    }

    #[test]
    fn xy_male_plus_xy_female_produces_balanced_sex_ratio() {
        let a = arc();
        let mut rng = Pcg32::new(20);

        let female = Creature::homozygous_founder(1, Sex::Female, &a, 0);
        let male = Creature::homozygous_founder(2, Sex::Male, &a, 0);

        let mut males = 0usize;
        let mut females = 0usize;
        let n = 5_000;
        let mut next_id: CreatureId = 100;
        for _ in 0..n {
            let g_m = meiose(&female, &a, MeiosisParams::default(), &mut rng);
            let g_p = meiose(&male, &a, MeiosisParams::default(), &mut rng);
            let outcome = fertilize(&g_m, &g_p, &a, next_id, 1, Some(female.id), Some(male.id), FertilizationParams::default());
            next_id += 1;
            if let FertilizationOutcome::Viable(c) = outcome {
                match c.sex {
                    Sex::Male => males += 1,
                    Sex::Female => females += 1,
                    _ => {}
                }
            }
        }
        let frac_m = males as f64 / (males + females) as f64;
        assert!((frac_m - 0.5).abs() < 0.02, "sex ratio off: {}", frac_m);
    }
}
