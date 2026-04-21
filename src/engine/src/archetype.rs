// Archetype specification. Everything the engine needs to know about a
// species to simulate it: chromosome layouts, sex system, and the
// phenotype channels that loci drive.

use crate::chromosome::{ChromosomeSpec, Locus, SexSystem};
use serde::{Deserialize, Serialize};

/// Per-channel parameters for phenotype assembly. Jitter and clamp
/// ranges are applied during phenotype readout on the JS side; the
/// engine only knows about locus-to-channel mapping.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhenotypeChannel {
    pub name: String,
    pub jitter_sigma: f64,
    pub clamp_range: [f64; 2],
}

/// How a single locus genotype contributes to a phenotype channel
/// value. Populated per locus by the archetype.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum PhenotypeMapping {
    /// Lookup by diploid-genotype string (e.g. "AA", "Aa", "aa").
    Lookup {
        values_by_genotype: std::collections::BTreeMap<String, f64>,
    },
    /// Each allele contributes a value; diploid phenotype is sum (or
    /// scaled by dominance).
    Additive {
        /// Per-allele-name contribution. Sum-of-two for diploid.
        contribution_by_allele: std::collections::BTreeMap<String, f64>,
    },
}

/// Fitness regime: how phenotype values combine into a fitness number
/// under a named selective pressure. Registered in the archetype so
/// scenarios can reference them by name.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum FitnessRegime {
    /// No selection. Everyone has fitness 1.
    Neutral,
    /// Linear gradient on a channel: fitness = 1 + weight * (value - target).
    Linear {
        channel: String,
        weight: f64,
        target: f64,
    },
    /// Gaussian around an optimum: fitness = exp(-((value - optimum)^2) / (2 sigma^2)).
    Gaussian {
        channel: String,
        weight: f64,
        optimum: f64,
        sigma: f64,
    },
    /// Disruptive: mirror Gaussian valleys. Favors extremes.
    Disruptive {
        channel: String,
        weight: f64,
        center: f64,
        sigma: f64,
    },
    /// Overdominant heterozygote advantage at a specific locus. Expects
    /// the locus to be biallelic.
    Overdominant {
        locus: String,
        homozygote_cost_aa: f64,
        homozygote_cost_bb: f64,
    },
    /// Frequency-dependent: fitness is inversely related to phenotype
    /// frequency in the population. `strength` scales the effect.
    FrequencyDependent {
        channel: String,
        strength: f64,
    },
}

/// A species archetype. One JSON file per archetype; loaded at engine
/// init.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Archetype {
    pub name: String,
    pub sex_determination: SexSystem,
    /// Autosomes (non-sex chromosomes).
    pub autosomes: Vec<ChromosomeSpec>,
    /// Sex chromosome layouts. Absent if sex_determination = None.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sex_chromosome: Option<SexChromosomeSpec>,
    pub phenotype_channels: Vec<PhenotypeChannel>,
    /// Locus -> PhenotypeMapping (locus name as key).
    pub phenotype_mappings: std::collections::BTreeMap<String, PhenotypeMapping>,
    /// Named fitness regimes.
    pub fitness_regimes: std::collections::BTreeMap<String, FitnessRegime>,
}

/// XY-style: X carries most loci; Y is short. For ZW, use the same
/// struct; `larger_chromosome` is Z (carries loci), `smaller_chromosome`
/// is W.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SexChromosomeSpec {
    /// Name of the larger / content-bearing chromosome ("X" or "Z").
    pub larger_name: String,
    /// Name of the smaller chromosome ("Y" or "W").
    pub smaller_name: String,
    pub larger_length_cm: f64,
    pub smaller_length_cm: f64,
    /// Loci on the larger chromosome.
    pub larger_loci: Vec<Locus>,
    /// Loci on the smaller chromosome. Usually empty in v1.
    #[serde(default)]
    pub smaller_loci: Vec<Locus>,
}

impl Archetype {
    /// Parse from a JSON string.
    pub fn from_json(s: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(s)
    }

    /// Total number of autosomal loci (summed over all autosomes).
    pub fn num_autosomal_loci(&self) -> usize {
        self.autosomes.iter().map(|c| c.loci.len()).sum()
    }

    /// Look up a locus by name across autosomes and sex chromosomes.
    /// Returns (chromosome_idx, locus_idx, is_on_sex_chromosome,
    /// is_on_larger_sex_chromosome).
    pub fn find_locus(&self, name: &str) -> Option<(usize, usize, bool, bool)> {
        for (ci, chr) in self.autosomes.iter().enumerate() {
            for (li, locus) in chr.loci.iter().enumerate() {
                if locus.name == name {
                    return Some((ci, li, false, false));
                }
            }
        }
        if let Some(sc) = &self.sex_chromosome {
            for (li, locus) in sc.larger_loci.iter().enumerate() {
                if locus.name == name {
                    return Some((0, li, true, true));
                }
            }
            for (li, locus) in sc.smaller_loci.iter().enumerate() {
                if locus.name == name {
                    return Some((0, li, true, false));
                }
            }
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const MINIMAL_ARCHETYPE_JSON: &str = r#"
    {
      "name": "test_species",
      "sex_determination": "XY",
      "autosomes": [
        {
          "name": "chr1",
          "length_cm": 100.0,
          "loci": [
            {
              "name": "BodyColor",
              "position_cm": 20.0,
              "alleles": ["B", "b"],
              "dominance": "complete",
              "dominant_allele": 0,
              "phenotype_channel": "body_color_hue"
            }
          ]
        }
      ],
      "sex_chromosome": {
        "larger_name": "X",
        "smaller_name": "Y",
        "larger_length_cm": 80.0,
        "smaller_length_cm": 10.0,
        "larger_loci": [
          {
            "name": "EyeColor",
            "position_cm": 30.0,
            "alleles": ["E", "e"],
            "dominance": "complete",
            "dominant_allele": 0,
            "phenotype_channel": "eye_color"
          }
        ]
      },
      "phenotype_channels": [
        {"name": "body_color_hue", "jitter_sigma": 0.02, "clamp_range": [0.0, 1.0]},
        {"name": "eye_color", "jitter_sigma": 0.02, "clamp_range": [0.0, 1.0]}
      ],
      "phenotype_mappings": {
        "BodyColor": {"type": "lookup", "values_by_genotype": {"BB": 0.2, "Bb": 0.2, "bb": 0.8}},
        "EyeColor": {"type": "lookup", "values_by_genotype": {"EE": 0.1, "Ee": 0.1, "ee": 0.9}}
      },
      "fitness_regimes": {
        "neutral": {"type": "neutral"}
      }
    }
    "#;

    #[test]
    fn parses_minimal_archetype() {
        let a = Archetype::from_json(MINIMAL_ARCHETYPE_JSON).unwrap();
        assert_eq!(a.name, "test_species");
        assert_eq!(a.autosomes.len(), 1);
        assert_eq!(a.autosomes[0].loci.len(), 1);
        assert!(a.sex_chromosome.is_some());
    }

    #[test]
    fn find_locus_works() {
        let a = Archetype::from_json(MINIMAL_ARCHETYPE_JSON).unwrap();
        assert_eq!(a.find_locus("BodyColor"), Some((0, 0, false, false)));
        assert_eq!(a.find_locus("EyeColor"), Some((0, 0, true, true)));
        assert!(a.find_locus("Unknown").is_none());
    }
}
