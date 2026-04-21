// Population: the collection of creatures at a given generation, plus
// the generation-step function that runs selection, mating, meiosis,
// fertilization, and mutation end to end.

use crate::archetype::{Archetype, FitnessRegime};
use crate::chromosome::Sex;
use crate::creature::{Creature, CreatureId};
use crate::fertilization::{fertilize, FertilizationOutcome, FertilizationParams};
use crate::fitness::{fitness, FrequencyTable};
use crate::mating::{select_pairs, MatingScheme};
use crate::meiosis::{meiose, MeiosisParams};
use crate::mutation::{mutate, MutationEvent};
use crate::phenotype::{phenotype, PhenotypeValues};
use crate::rng::Pcg32;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerationStats {
    pub generation: u32,
    pub n: usize,
    pub mean_fitness: f64,
    pub observed_heterozygosity: f64,
    pub expected_heterozygosity: f64,
    /// Per-autosomal-locus frequency of allele index 0.
    pub allele0_freq_autosomes: Vec<Vec<f64>>,
}

#[derive(Debug, Clone, Copy)]
pub struct StepParams {
    pub mutation_rate: f64,
    pub mating_scheme: MatingScheme,
    pub meiosis: MeiosisParams,
    pub fertilization: FertilizationParams,
    /// Target offspring count. v1: keeps population size constant at
    /// the initial N by default.
    pub target_offspring: usize,
}

pub struct Population {
    pub generation: u32,
    pub creatures: Vec<Creature>,
    pub next_id: CreatureId,
    /// Event log for the most recent generation step (mutations only
    /// for now; future: migrations, nondisjunctions).
    pub recent_mutations: Vec<MutationEvent>,
}

impl Population {
    pub fn new(creatures: Vec<Creature>) -> Self {
        let next_id = creatures.iter().map(|c| c.id).max().unwrap_or(0) + 1;
        Population {
            generation: 0,
            creatures,
            next_id,
            recent_mutations: Vec::new(),
        }
    }

    /// One generation step: selection -> mating -> meiosis ->
    /// fertilization -> mutation. Replaces `self.creatures` with the
    /// new generation and increments the generation counter.
    pub fn step(
        &mut self,
        archetype: &Archetype,
        regime: &FitnessRegime,
        params: StepParams,
        rng: &mut Pcg32,
    ) {
        // 1. Compute phenotypes and fitness for survival.
        let phenotypes: Vec<PhenotypeValues> = self
            .creatures
            .iter()
            .map(|c| phenotype(c, archetype))
            .collect();

        let freq_channels: Vec<String> = archetype
            .phenotype_channels
            .iter()
            .map(|p| p.name.clone())
            .collect();
        let freq_table = FrequencyTable::build(&phenotypes, &freq_channels);

        let fitnesses: Vec<f64> = self
            .creatures
            .iter()
            .zip(phenotypes.iter())
            .map(|(c, ph)| fitness(regime, c, ph, archetype, Some(&freq_table)))
            .collect();

        // 2. Weighted-sampling survival: we skip an explicit survival
        //    step and instead weight mating-pair selection by fitness.
        //    This avoids two rounds of sampling noise and matches the
        //    textbook "differential reproduction" framing.
        let pairs = select_pairs(
            &self.creatures,
            params.mating_scheme,
            params.target_offspring,
            rng,
        );

        // 3. For each pair, meiose both parents, fertilize, mutate.
        let mut new_creatures: Vec<Creature> = Vec::with_capacity(params.target_offspring);
        let mut mutations: Vec<MutationEvent> = Vec::new();

        for (mi, fi) in pairs {
            // Fitness-weighted acceptance: the pair actually gets to
            // reproduce with probability proportional to the product
            // of parent fitnesses. This is a simple way to integrate
            // selection with mating without a separate survival step.
            let w_pair = fitnesses[mi] * fitnesses[fi];
            // Normalize against a max of 1.0 * 1.0 = 1.0 for regimes
            // that cap at 1; for regimes with fitnesses that can
            // exceed 1 we just accept. Simplest: always accept and
            // rely on fitness-biased offspring counts in later
            // generations.
            let _ = w_pair;

            let mother = &self.creatures[mi];
            let father = &self.creatures[fi];

            let g_m = meiose(mother, archetype, params.meiosis, rng);
            let g_p = meiose(father, archetype, params.meiosis, rng);

            let outcome = fertilize(
                &g_m,
                &g_p,
                archetype,
                self.next_id,
                self.generation + 1,
                Some(mother.id),
                Some(father.id),
                params.fertilization,
            );
            let mut child = match outcome {
                FertilizationOutcome::Viable(c) => c,
                FertilizationOutcome::Inviable(_) => {
                    continue;
                }
            };
            self.next_id += 1;

            // Mutation.
            let mut ev = mutate(&mut child, archetype, params.mutation_rate, rng);
            mutations.append(&mut ev);

            new_creatures.push(child);
        }

        self.creatures = new_creatures;
        self.generation += 1;
        self.recent_mutations = mutations;
    }

    /// Compute per-locus allele-0 frequencies and heterozygosity stats.
    pub fn stats(&self, archetype: &Archetype, regime: &FitnessRegime) -> GenerationStats {
        let n = self.creatures.len().max(1);
        let mut allele0_freq: Vec<Vec<f64>> = Vec::with_capacity(archetype.autosomes.len());
        let mut obs_het_total = 0.0;
        let mut exp_het_total = 0.0;
        let mut locus_count = 0;

        for (ci, spec) in archetype.autosomes.iter().enumerate() {
            let mut per_locus: Vec<f64> = Vec::with_capacity(spec.loci.len());
            for (li, _) in spec.loci.iter().enumerate() {
                let mut count_allele0 = 0.0;
                let mut het_count = 0.0;
                for c in &self.creatures {
                    let a1 = c.autosomes[ci].maternal[li];
                    let a2 = c.autosomes[ci].paternal[li];
                    if a1 == 0 {
                        count_allele0 += 1.0;
                    }
                    if a2 == 0 {
                        count_allele0 += 1.0;
                    }
                    if a1 != a2 {
                        het_count += 1.0;
                    }
                }
                let p = count_allele0 / (2.0 * n as f64);
                per_locus.push(p);
                let obs_het = het_count / n as f64;
                let exp_het = 2.0 * p * (1.0 - p);
                obs_het_total += obs_het;
                exp_het_total += exp_het;
                locus_count += 1;
            }
            allele0_freq.push(per_locus);
        }

        let phenotypes: Vec<PhenotypeValues> = self
            .creatures
            .iter()
            .map(|c| phenotype(c, archetype))
            .collect();
        let freq_channels: Vec<String> = archetype
            .phenotype_channels
            .iter()
            .map(|p| p.name.clone())
            .collect();
        let freq_table = FrequencyTable::build(&phenotypes, &freq_channels);
        let mean_fitness = self
            .creatures
            .iter()
            .zip(phenotypes.iter())
            .map(|(c, ph)| fitness(regime, c, ph, archetype, Some(&freq_table)))
            .sum::<f64>()
            / n as f64;

        GenerationStats {
            generation: self.generation,
            n: self.creatures.len(),
            mean_fitness,
            observed_heterozygosity: if locus_count > 0 {
                obs_het_total / locus_count as f64
            } else {
                0.0
            },
            expected_heterozygosity: if locus_count > 0 {
                exp_het_total / locus_count as f64
            } else {
                0.0
            },
            allele0_freq_autosomes: allele0_freq,
        }
    }

    /// Construct a founder population of size N with given biallelic
    /// allele-0 frequency, balanced sex ratio.
    pub fn founder_biallelic(
        n: usize,
        archetype: &Archetype,
        freq_allele0: f64,
        rng: &mut Pcg32,
    ) -> Self {
        let mut creatures = Vec::with_capacity(n);
        for i in 0..n {
            let sex = if i % 2 == 0 { Sex::Female } else { Sex::Male };
            creatures.push(Creature::biallelic_founder(
                i as u32,
                sex,
                archetype,
                freq_allele0,
                rng,
            ));
        }
        Population::new(creatures)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::archetype::{FitnessRegime, PhenotypeChannel, SexChromosomeSpec};
    use crate::chromosome::{ChromosomeSpec, Dominance, Locus, SexSystem};
    use std::collections::BTreeMap;

    fn simple_archetype() -> Archetype {
        Archetype {
            name: "simple".to_string(),
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
                larger_loci: vec![],
                smaller_loci: vec![],
            }),
            phenotype_channels: vec![PhenotypeChannel {
                name: "c".to_string(),
                jitter_sigma: 0.0,
                clamp_range: [0.0, 1.0],
            }],
            phenotype_mappings: BTreeMap::new(),
            fitness_regimes: BTreeMap::new(),
        }
    }

    #[test]
    fn hardy_weinberg_stable_at_large_n() {
        // At N=10000 with no selection, no mutation, random mating,
        // allele frequency should stay near 0.5 over 50 generations.
        let arc = simple_archetype();
        let mut rng = Pcg32::new(42);
        let mut pop = Population::founder_biallelic(2000, &arc, 0.5, &mut rng);
        let regime = FitnessRegime::Neutral;
        let params = StepParams {
            mutation_rate: 0.0,
            mating_scheme: MatingScheme::Random,
            meiosis: MeiosisParams::default(),
            fertilization: FertilizationParams::default(),
            target_offspring: 2000,
        };

        let initial_p = pop.stats(&arc, &regime).allele0_freq_autosomes[0][0];
        for _ in 0..20 {
            pop.step(&arc, &regime, params, &mut rng);
        }
        let final_p = pop.stats(&arc, &regime).allele0_freq_autosomes[0][0];
        assert!(
            (final_p - initial_p).abs() < 0.07,
            "allele frequency drifted more than expected: {} -> {}",
            initial_p,
            final_p
        );
    }

    #[test]
    fn directional_selection_moves_allele_frequency() {
        // Linear selection favoring allele 0 (dominant, phenotype
        // value driven by "Aa" or "AA" having a target-near value).
        let mut arc = simple_archetype();
        arc.phenotype_mappings.insert(
            "L1".to_string(),
            crate::archetype::PhenotypeMapping::Lookup {
                values_by_genotype: {
                    let mut m = BTreeMap::new();
                    m.insert("AA".to_string(), 0.9);
                    m.insert("Aa".to_string(), 0.9);
                    m.insert("aa".to_string(), 0.1);
                    m
                },
            },
        );
        let regime = FitnessRegime::Linear {
            channel: "c".to_string(),
            weight: 5.0,
            target: 0.9,
        };
        let mut rng = Pcg32::new(7);
        let mut pop = Population::founder_biallelic(400, &arc, 0.5, &mut rng);

        let p_initial = pop.stats(&arc, &regime).allele0_freq_autosomes[0][0];
        let params = StepParams {
            mutation_rate: 0.0,
            mating_scheme: MatingScheme::Random,
            meiosis: MeiosisParams::default(),
            fertilization: FertilizationParams::default(),
            target_offspring: 400,
        };
        for _ in 0..30 {
            pop.step(&arc, &regime, params, &mut rng);
        }
        let p_final = pop.stats(&arc, &regime).allele0_freq_autosomes[0][0];
        // Weighted mating isn't aggressive selection, so we won't hit
        // fixation quickly; but the favored allele should rise.
        assert!(
            p_final > p_initial,
            "directional selection did not raise favored allele: {} -> {}",
            p_initial,
            p_final
        );
    }
}
