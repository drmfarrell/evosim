// Chromosome, locus, and allele types. Genome structure is data-driven
// from the archetype JSON loaded at engine init. We keep it
// struct-of-arrays friendly for the hot meiosis path.
//
// Alleles are represented as u8 indices into the locus's allele_names
// vector. This keeps a creature's genome extremely compact and makes
// crossover a simple slice copy.

use serde::{Deserialize, Serialize};

pub type AlleleIdx = u8;
pub type LocusIdx = usize;
pub type ChromosomeIdx = usize;

/// Dominance relationship between two alleles at a diploid locus.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Dominance {
    /// One allele (the dominant) fully masks the other in heterozygotes.
    Complete,
    /// Heterozygote phenotype is intermediate between homozygotes.
    Incomplete,
    /// Heterozygote expresses both alleles distinguishably.
    Codominant,
    /// Heterozygote has a phenotype outside the range of either homozygote.
    Overdominant,
    /// Sum of per-allele additive contributions (for polygenic channels).
    Additive,
}

/// A single locus on a chromosome. Indexed into by the engine; exposed
/// to JS via serde.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Locus {
    pub name: String,
    pub position_cm: f64,
    /// Names of the possible alleles at this locus; index into this
    /// vector is stored on each homolog.
    pub alleles: Vec<String>,
    pub dominance: Dominance,
    /// For Complete dominance: the index of the dominant allele.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub dominant_allele: Option<AlleleIdx>,
    /// Name of the phenotype channel this locus drives.
    pub phenotype_channel: String,
}

/// A chromosome in the archetype. Lengths are in centimorgans (cM).
/// Map function is Haldane's (1 cM = 1% recombinant gametes at short
/// distances; additive on cM for multi-locus); Poisson count of
/// crossovers on the whole chromosome uses mean = length_cm / 100.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChromosomeSpec {
    pub name: String,
    pub length_cm: f64,
    pub loci: Vec<Locus>,
}

/// One homolog of a chromosome: an array of allele indices, one per
/// locus. Ordered same as the matching ChromosomeSpec.loci.
pub type Homolog = Vec<AlleleIdx>;

/// Diploid chromosome pair.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiploidChromosome {
    pub maternal: Homolog,
    pub paternal: Homolog,
}

/// Gamete chromosome: one haploid homolog.
pub type Gamete = Vec<Homolog>; // one per chromosome in the genome

/// Sex-determination system.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum SexSystem {
    XY,
    ZW,
    /// No sex chromosomes (hermaphrodite model, future).
    None,
}

/// Sex of an individual. For XY: Female = XX, Male = XY. For ZW: Male =
/// ZZ, Female = ZW. For None: always Hermaphrodite.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Sex {
    Female,
    Male,
    Hermaphrodite,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dominance_serde_roundtrips() {
        let d = Dominance::Complete;
        let s = serde_json::to_string(&d).unwrap();
        let d2: Dominance = serde_json::from_str(&s).unwrap();
        assert_eq!(d, d2);
    }

    #[test]
    fn sex_serde_roundtrips() {
        let s = Sex::Female;
        let j = serde_json::to_string(&s).unwrap();
        let s2: Sex = serde_json::from_str(&j).unwrap();
        assert_eq!(s, s2);
    }
}
