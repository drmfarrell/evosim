// Creature: a diploid individual. Holds its genome plus metadata. The
// genome is sized according to the archetype's chromosome layout.

use crate::archetype::Archetype;
use crate::chromosome::{
    AlleleIdx, DiploidChromosome, Homolog, Sex, SexSystem,
};
use crate::rng::Pcg32;
use serde::{Deserialize, Serialize};

pub type CreatureId = u32;

/// Sex chromosome content for this individual. For XY species: if male,
/// one `X`-style homolog + one `Y`-style homolog (smaller). If female,
/// two `X`-style homologs. For ZW species: mirror with Z and W.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SexChromosomePair {
    /// Larger-chromosome homolog inherited from mother.
    pub maternal_larger: Option<Homolog>,
    /// Larger-chromosome homolog inherited from father (e.g., an XX
    /// female's second X; absent if the individual is XY-male, where
    /// father contributed Y).
    pub paternal_larger: Option<Homolog>,
    /// Smaller-chromosome homolog if the individual carries one.
    pub smaller: Option<Homolog>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Creature {
    pub id: CreatureId,
    pub sex: Sex,
    pub generation: u32,
    /// Diploid autosomes, ordered same as archetype.autosomes.
    pub autosomes: Vec<DiploidChromosome>,
    /// Sex chromosomes. None iff archetype.sex_determination == None.
    pub sex_chromosomes: Option<SexChromosomePair>,
    /// Parent IDs. None for generation-0 founders.
    pub mother_id: Option<CreatureId>,
    pub father_id: Option<CreatureId>,
}

impl Creature {
    /// Build a homozygous founder for a given archetype with a single
    /// per-locus allele index chosen for both homologs. This is a
    /// convenience for generation-0 population construction.
    pub fn homozygous_founder(
        id: CreatureId,
        sex: Sex,
        archetype: &Archetype,
        allele_idx: AlleleIdx,
    ) -> Self {
        let autosomes: Vec<DiploidChromosome> = archetype
            .autosomes
            .iter()
            .map(|chr| {
                let n = chr.loci.len();
                DiploidChromosome {
                    maternal: vec![allele_idx; n],
                    paternal: vec![allele_idx; n],
                }
            })
            .collect();

        let sex_chromosomes = match (&archetype.sex_chromosome, archetype.sex_determination, sex) {
            (Some(sc), SexSystem::XY, Sex::Female) => Some(SexChromosomePair {
                maternal_larger: Some(vec![allele_idx; sc.larger_loci.len()]),
                paternal_larger: Some(vec![allele_idx; sc.larger_loci.len()]),
                smaller: None,
            }),
            (Some(sc), SexSystem::XY, Sex::Male) => Some(SexChromosomePair {
                maternal_larger: Some(vec![allele_idx; sc.larger_loci.len()]),
                paternal_larger: None,
                smaller: Some(vec![allele_idx; sc.smaller_loci.len()]),
            }),
            (Some(sc), SexSystem::ZW, Sex::Male) => Some(SexChromosomePair {
                maternal_larger: Some(vec![allele_idx; sc.larger_loci.len()]),
                paternal_larger: Some(vec![allele_idx; sc.larger_loci.len()]),
                smaller: None,
            }),
            (Some(sc), SexSystem::ZW, Sex::Female) => Some(SexChromosomePair {
                maternal_larger: None,
                paternal_larger: Some(vec![allele_idx; sc.larger_loci.len()]),
                smaller: Some(vec![allele_idx; sc.smaller_loci.len()]),
            }),
            _ => None,
        };

        Creature {
            id,
            sex,
            generation: 0,
            autosomes,
            sex_chromosomes,
            mother_id: None,
            father_id: None,
        }
    }

    /// Build a founder with allele frequencies drawn independently at
    /// each locus. `allele_frequencies` is per-locus probability of
    /// index 0 vs index 1 (only biallelic supported here, for now).
    pub fn biallelic_founder(
        id: CreatureId,
        sex: Sex,
        archetype: &Archetype,
        freq_allele0: f64,
        rng: &mut Pcg32,
    ) -> Self {
        let draw = |rng: &mut Pcg32| -> AlleleIdx {
            if rng.bernoulli(freq_allele0) { 0 } else { 1 }
        };

        let autosomes: Vec<DiploidChromosome> = archetype
            .autosomes
            .iter()
            .map(|chr| DiploidChromosome {
                maternal: (0..chr.loci.len()).map(|_| draw(rng)).collect(),
                paternal: (0..chr.loci.len()).map(|_| draw(rng)).collect(),
            })
            .collect();

        let sex_chromosomes = match (&archetype.sex_chromosome, archetype.sex_determination, sex) {
            (Some(sc), SexSystem::XY, Sex::Female) => Some(SexChromosomePair {
                maternal_larger: Some((0..sc.larger_loci.len()).map(|_| draw(rng)).collect()),
                paternal_larger: Some((0..sc.larger_loci.len()).map(|_| draw(rng)).collect()),
                smaller: None,
            }),
            (Some(sc), SexSystem::XY, Sex::Male) => Some(SexChromosomePair {
                maternal_larger: Some((0..sc.larger_loci.len()).map(|_| draw(rng)).collect()),
                paternal_larger: None,
                smaller: Some((0..sc.smaller_loci.len()).map(|_| draw(rng)).collect()),
            }),
            (Some(sc), SexSystem::ZW, Sex::Male) => Some(SexChromosomePair {
                maternal_larger: Some((0..sc.larger_loci.len()).map(|_| draw(rng)).collect()),
                paternal_larger: Some((0..sc.larger_loci.len()).map(|_| draw(rng)).collect()),
                smaller: None,
            }),
            (Some(sc), SexSystem::ZW, Sex::Female) => Some(SexChromosomePair {
                maternal_larger: None,
                paternal_larger: Some((0..sc.larger_loci.len()).map(|_| draw(rng)).collect()),
                smaller: Some((0..sc.smaller_loci.len()).map(|_| draw(rng)).collect()),
            }),
            _ => None,
        };

        Creature {
            id,
            sex,
            generation: 0,
            autosomes,
            sex_chromosomes,
            mother_id: None,
            father_id: None,
        }
    }
}

/// A gamete: haploid product of meiosis. Contains one homolog per
/// autosome plus one sex-chromosome homolog (may be larger or smaller).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameteContent {
    pub autosomes: Vec<Homolog>,
    /// Which sex chromosome this gamete carries ("X"/"Y"/"Z"/"W" name).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sex_chromosome_name: Option<String>,
    /// Alleles on the sex chromosome, if any.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sex_chromosome_alleles: Option<Homolog>,
    /// Whether this gamete is aneuploid (from nondisjunction).
    #[serde(default)]
    pub aneuploid: bool,
}

// Convenience alias used elsewhere.
pub type Gametes = Vec<GameteContent>;
