// Meiosis: given a parent creature and an RNG, produce a gamete.
//
// Algorithm per chromosome pair:
//   1. Sample number of crossovers k ~ Poisson(length_morgans).
//      (1 Morgan = 100 cM. A 100cM chromosome has expected 1 crossover
//      per meiosis.)
//   2. Sample k crossover positions uniformly along the chromosome.
//   3. For each locus on the chromosome, compute how many crossover
//      sites are strictly less than the locus position. If even,
//      the locus keeps its original homolog assignment. If odd, it
//      is swapped.
//   4. After crossover, we have two new homologs A' and B'. Sample
//      one uniformly (independent assortment) to contribute to the
//      gamete.
//
// With nondisjunction enabled, with probability p_ndj a chromosome's
// segregation fails: either both post-crossover homologs go to the
// gamete (producing an n+1 gamete for that chromosome) or neither does
// (n-1). Resulting zygotes are typically inviable; default scenario
// configuration is p_ndj = 0.

use crate::archetype::Archetype;
use crate::chromosome::{ChromosomeSpec, Homolog, Sex, SexSystem};
use crate::creature::{Creature, GameteContent};
use crate::rng::Pcg32;

#[derive(Debug, Clone, Copy)]
pub struct MeiosisParams {
    /// Probability of nondisjunction per chromosome.
    pub p_nondisjunction: f64,
    /// Allow a polyploidy event: if true, *all* chromosomes nondisjoin
    /// in this meiosis (producing an unreduced gamete).
    pub polyploidy_event: bool,
}

impl Default for MeiosisParams {
    fn default() -> Self {
        MeiosisParams {
            p_nondisjunction: 0.0,
            polyploidy_event: false,
        }
    }
}

/// Produce one gamete from a parent via meiosis. Uses the supplied RNG.
pub fn meiose(
    parent: &Creature,
    archetype: &Archetype,
    params: MeiosisParams,
    rng: &mut Pcg32,
) -> GameteContent {
    let mut aneuploid = false;

    // Autosomes.
    let mut gamete_autosomes: Vec<Homolog> = Vec::with_capacity(parent.autosomes.len());
    for (i, pair) in parent.autosomes.iter().enumerate() {
        let spec = &archetype.autosomes[i];
        let (a_prime, b_prime) = crossover_pair(&pair.maternal, &pair.paternal, spec, rng);

        // Nondisjunction branch.
        let force_ndj = params.polyploidy_event || rng.bernoulli(params.p_nondisjunction);
        if force_ndj {
            aneuploid = true;
            // 50/50 whether gamete carries both homologs or neither.
            if rng.bernoulli(0.5) {
                // Both: concatenate. Represent as "extra" alleles by
                // extending the homolog vector. For downstream, an
                // aneuploid gamete > normal length flags the error.
                let mut both = a_prime.clone();
                both.extend_from_slice(&b_prime);
                gamete_autosomes.push(both);
            } else {
                // Neither: empty homolog. Zygote from this plus a
                // normal gamete will be n-1 for this chromosome.
                gamete_autosomes.push(Vec::new());
            }
        } else {
            // Normal: 50/50 between the two post-crossover homologs.
            let pick = if rng.bernoulli(0.5) { a_prime } else { b_prime };
            gamete_autosomes.push(pick);
        }
    }

    // Sex chromosomes.
    let (sex_name, sex_alleles) = meiose_sex_chromosomes(parent, archetype, params, rng);

    GameteContent {
        autosomes: gamete_autosomes,
        sex_chromosome_name: sex_name,
        sex_chromosome_alleles: sex_alleles,
        aneuploid: aneuploid || params.polyploidy_event,
    }
}

fn crossover_pair(
    maternal: &Homolog,
    paternal: &Homolog,
    spec: &ChromosomeSpec,
    rng: &mut Pcg32,
) -> (Homolog, Homolog) {
    let length_morgans = spec.length_cm / 100.0;
    let k = rng.poisson(length_morgans) as usize;

    if k == 0 {
        return (maternal.clone(), paternal.clone());
    }

    // Sample and sort k positions uniformly on [0, length_cm).
    let mut xovers: Vec<f64> = (0..k).map(|_| rng.next_f64() * spec.length_cm).collect();
    xovers.sort_by(|a, b| a.partial_cmp(b).unwrap());

    // For each locus, count crossovers strictly left of its position.
    let mut a_prime: Homolog = Vec::with_capacity(maternal.len());
    let mut b_prime: Homolog = Vec::with_capacity(paternal.len());
    for (li, locus) in spec.loci.iter().enumerate() {
        let count_left = xovers.iter().take_while(|&&x| x < locus.position_cm).count();
        if count_left % 2 == 0 {
            a_prime.push(maternal[li]);
            b_prime.push(paternal[li]);
        } else {
            a_prime.push(paternal[li]);
            b_prime.push(maternal[li]);
        }
    }
    (a_prime, b_prime)
}

fn meiose_sex_chromosomes(
    parent: &Creature,
    archetype: &Archetype,
    _params: MeiosisParams,
    rng: &mut Pcg32,
) -> (Option<String>, Option<Homolog>) {
    let sc_spec = match &archetype.sex_chromosome {
        Some(s) => s,
        None => return (None, None),
    };
    let pair = match &parent.sex_chromosomes {
        Some(p) => p,
        None => return (None, None),
    };

    match (archetype.sex_determination, parent.sex) {
        (SexSystem::XY, Sex::Female) => {
            // Two Xs. Crossover between them, then pick one.
            // Synthesize a ChromosomeSpec for the larger sex chromosome
            // so we can reuse crossover_pair.
            let fake_spec = ChromosomeSpec {
                name: sc_spec.larger_name.clone(),
                length_cm: sc_spec.larger_length_cm,
                loci: sc_spec.larger_loci.clone(),
            };
            let maternal = pair.maternal_larger.as_ref().expect("XY female has maternal X");
            let paternal = pair.paternal_larger.as_ref().expect("XY female has paternal X");
            let (a, b) = crossover_pair(maternal, paternal, &fake_spec, rng);
            let pick = if rng.bernoulli(0.5) { a } else { b };
            (Some(sc_spec.larger_name.clone()), Some(pick))
        }
        (SexSystem::XY, Sex::Male) => {
            // XY male: gamete gets either X (maternal) or Y
            // (smaller_chromosome, inherited from father). 50/50, no
            // crossover (pseudoautosomal regions simplified out).
            if rng.bernoulli(0.5) {
                let x = pair.maternal_larger.as_ref().expect("XY male has maternal X").clone();
                (Some(sc_spec.larger_name.clone()), Some(x))
            } else {
                let y = pair.smaller.as_ref().expect("XY male has Y").clone();
                (Some(sc_spec.smaller_name.clone()), Some(y))
            }
        }
        (SexSystem::ZW, Sex::Male) => {
            // ZZ male: two Zs, treat like XY female.
            let fake_spec = ChromosomeSpec {
                name: sc_spec.larger_name.clone(),
                length_cm: sc_spec.larger_length_cm,
                loci: sc_spec.larger_loci.clone(),
            };
            let maternal = pair.maternal_larger.as_ref().expect("ZZ male has maternal Z");
            let paternal = pair.paternal_larger.as_ref().expect("ZZ male has paternal Z");
            let (a, b) = crossover_pair(maternal, paternal, &fake_spec, rng);
            let pick = if rng.bernoulli(0.5) { a } else { b };
            (Some(sc_spec.larger_name.clone()), Some(pick))
        }
        (SexSystem::ZW, Sex::Female) => {
            // ZW female: passes Z or W (50/50).
            if rng.bernoulli(0.5) {
                let z = pair.paternal_larger.as_ref().expect("ZW female has Z").clone();
                (Some(sc_spec.larger_name.clone()), Some(z))
            } else {
                let w = pair.smaller.as_ref().expect("ZW female has W").clone();
                (Some(sc_spec.smaller_name.clone()), Some(w))
            }
        }
        (SexSystem::None, _) => (None, None),
        (SexSystem::XY, Sex::Hermaphrodite) | (SexSystem::ZW, Sex::Hermaphrodite) => {
            // Should not happen in practice (sex-system archetypes set a binary sex).
            (None, None)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::archetype::{Archetype, PhenotypeChannel};
    use crate::chromosome::{Dominance, Locus};
    use std::collections::BTreeMap;

    fn simple_archetype() -> Archetype {
        Archetype {
            name: "test".to_string(),
            sex_determination: SexSystem::XY,
            autosomes: vec![ChromosomeSpec {
                name: "chr1".to_string(),
                length_cm: 100.0,
                loci: vec![
                    Locus {
                        name: "L1".to_string(),
                        position_cm: 10.0,
                        alleles: vec!["A".to_string(), "a".to_string()],
                        dominance: Dominance::Complete,
                        dominant_allele: Some(0),
                        phenotype_channel: "c".to_string(),
                    },
                    Locus {
                        name: "L2".to_string(),
                        position_cm: 90.0,
                        alleles: vec!["B".to_string(), "b".to_string()],
                        dominance: Dominance::Complete,
                        dominant_allele: Some(0),
                        phenotype_channel: "c".to_string(),
                    },
                ],
            }],
            sex_chromosome: Some(crate::archetype::SexChromosomeSpec {
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

    fn heterozygote_male(archetype: &Archetype) -> Creature {
        // Maternal homolog allele 0, paternal allele 1, across all loci.
        let mut c = Creature::homozygous_founder(0, Sex::Male, archetype, 0);
        for chr in c.autosomes.iter_mut() {
            for i in 0..chr.paternal.len() {
                chr.paternal[i] = 1;
            }
        }
        if let Some(sc) = c.sex_chromosomes.as_mut() {
            if let Some(y) = sc.smaller.as_mut() {
                for i in 0..y.len() {
                    y[i] = 1;
                }
            }
        }
        c
    }

    fn heterozygote_female(archetype: &Archetype) -> Creature {
        let mut c = Creature::homozygous_founder(0, Sex::Female, archetype, 0);
        for chr in c.autosomes.iter_mut() {
            for i in 0..chr.paternal.len() {
                chr.paternal[i] = 1;
            }
        }
        if let Some(sc) = c.sex_chromosomes.as_mut() {
            if let Some(px) = sc.paternal_larger.as_mut() {
                for i in 0..px.len() {
                    px[i] = 1;
                }
            }
        }
        c
    }

    #[test]
    fn no_crossover_produces_parental_gametes() {
        // With length_cm = 0, no crossovers ever. Gametes are always
        // parental type. Here we shorten the chromosome to zero length
        // so both loci are at the same position and crossover is
        // impossible within this chromosome.
        let mut arc = simple_archetype();
        arc.autosomes[0].length_cm = 0.0;
        arc.autosomes[0].loci[0].position_cm = 0.0;
        arc.autosomes[0].loci[1].position_cm = 0.0;

        let parent = heterozygote_male(&arc);
        let mut rng = Pcg32::new(1);

        let mut ab_parental = 0usize; // AB (maternal) or ab (paternal)
        let mut ab_recomb = 0usize;
        for _ in 0..10_000 {
            let g = meiose(&parent, &arc, MeiosisParams::default(), &mut rng);
            let chr = &g.autosomes[0];
            // Parental types are (0,0) or (1,1). Recombinants are (0,1) or (1,0).
            if (chr[0] == 0 && chr[1] == 0) || (chr[0] == 1 && chr[1] == 1) {
                ab_parental += 1;
            } else {
                ab_recomb += 1;
            }
        }
        assert_eq!(ab_recomb, 0, "no recombinants allowed with length_cm=0");
        assert!(ab_parental > 0);
    }

    #[test]
    fn linked_loci_recombine_at_expected_frequency() {
        // Loci 1 cM apart should produce about 1% recombinants.
        let mut arc = simple_archetype();
        arc.autosomes[0].length_cm = 1.0;
        arc.autosomes[0].loci[0].position_cm = 0.0;
        arc.autosomes[0].loci[1].position_cm = 1.0;

        let parent = heterozygote_male(&arc);
        let mut rng = Pcg32::new(2);

        let mut recomb = 0usize;
        let n = 50_000;
        for _ in 0..n {
            let g = meiose(&parent, &arc, MeiosisParams::default(), &mut rng);
            let chr = &g.autosomes[0];
            if (chr[0] == 0 && chr[1] == 1) || (chr[0] == 1 && chr[1] == 0) {
                recomb += 1;
            }
        }
        let freq = recomb as f64 / n as f64;
        // Expected ~0.01 (Poisson mean 0.01 crossovers); finite-sample
        // tolerance.
        assert!(freq < 0.02 && freq > 0.002, "recomb freq was {}", freq);
    }

    #[test]
    fn unlinked_loci_assort_independently() {
        // Loci 100 cM apart under Haldane's mapping function give
        // r = 0.5 * (1 - exp(-2m)) where m = Morgans = 1.0.
        // Expected r = 0.5 * (1 - e^-2) ≈ 0.432. The limit 0.5 is only
        // reached at infinite map distance. We check ~0.43 with finite
        // tolerance.
        let mut arc = simple_archetype();
        arc.autosomes[0].length_cm = 100.0;
        arc.autosomes[0].loci[0].position_cm = 0.0;
        arc.autosomes[0].loci[1].position_cm = 100.0;

        let parent = heterozygote_male(&arc);
        let mut rng = Pcg32::new(3);

        let mut recomb = 0usize;
        let n = 20_000;
        for _ in 0..n {
            let g = meiose(&parent, &arc, MeiosisParams::default(), &mut rng);
            let chr = &g.autosomes[0];
            if (chr[0] == 0 && chr[1] == 1) || (chr[0] == 1 && chr[1] == 0) {
                recomb += 1;
            }
        }
        let freq = recomb as f64 / n as f64;
        let expected = 0.5 * (1.0 - (-2.0_f64).exp());
        assert!(
            (freq - expected).abs() < 0.03,
            "freq was {}, expected ~{}",
            freq,
            expected
        );
    }

    #[test]
    fn xy_male_gametes_are_half_x_half_y() {
        let arc = simple_archetype();
        let parent = heterozygote_male(&arc);
        let mut rng = Pcg32::new(4);

        let mut x_count = 0usize;
        let mut y_count = 0usize;
        let n = 10_000;
        for _ in 0..n {
            let g = meiose(&parent, &arc, MeiosisParams::default(), &mut rng);
            match g.sex_chromosome_name.as_deref() {
                Some("X") => x_count += 1,
                Some("Y") => y_count += 1,
                _ => panic!("unexpected sex chr"),
            }
        }
        let frac_x = x_count as f64 / n as f64;
        assert!((frac_x - 0.5).abs() < 0.02, "frac X was {}", frac_x);
        assert_eq!(x_count + y_count, n);
    }

    #[test]
    fn xy_female_gametes_are_all_x() {
        let arc = simple_archetype();
        let parent = heterozygote_female(&arc);
        let mut rng = Pcg32::new(5);

        for _ in 0..2000 {
            let g = meiose(&parent, &arc, MeiosisParams::default(), &mut rng);
            assert_eq!(g.sex_chromosome_name.as_deref(), Some("X"));
        }
    }

    #[test]
    fn polyploidy_event_produces_unreduced_gamete() {
        let arc = simple_archetype();
        let parent = heterozygote_male(&arc);
        let mut rng = Pcg32::new(6);
        let params = MeiosisParams {
            p_nondisjunction: 0.0,
            polyploidy_event: true,
        };
        let g = meiose(&parent, &arc, params, &mut rng);
        assert!(g.aneuploid);
    }
}
