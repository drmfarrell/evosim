// EvoSim engine: WASM entry points.
//
// All numerical work is single-threaded and deterministic given the
// seed. No shared memory, no threads, no SharedArrayBuffer. See
// ~/evosim/CLAUDE.md for the rationale.

mod archetype;
mod chromosome;
mod creature;
mod fertilization;
mod fitness;
mod mating;
mod meiosis;
mod mutation;
mod phenotype;
mod population;
mod rng;

use wasm_bindgen::prelude::*;

use archetype::Archetype;
use creature::Creature;
use meiosis::{meiose, MeiosisParams};
use phenotype::phenotype as compute_phenotype;
use population::{Population, StepParams};
use rng::Pcg32;

/// Opaque handle to an engine instance (archetype + RNG + population).
#[wasm_bindgen]
pub struct EvoEngine {
    archetype: Archetype,
    rng: Pcg32,
    population: Option<Population>,
}

#[wasm_bindgen]
impl EvoEngine {
    /// Create a new engine from an archetype JSON string and a seed.
    #[wasm_bindgen(constructor)]
    pub fn new(archetype_json: &str, seed: u64) -> Result<EvoEngine, JsError> {
        let archetype = Archetype::from_json(archetype_json)
            .map_err(|e| JsError::new(&format!("archetype parse error: {}", e)))?;
        Ok(EvoEngine {
            archetype,
            rng: Pcg32::new(seed),
            population: None,
        })
    }

    /// Return the archetype as a JSON string (for JS-side reference).
    #[wasm_bindgen(js_name = archetypeJson)]
    pub fn archetype_json(&self) -> Result<String, JsError> {
        serde_json::to_string(&self.archetype)
            .map_err(|e| JsError::new(&format!("archetype serialize error: {}", e)))
    }

    /// Initialize a founder population of N individuals with given
    /// allele-0 frequency. Replaces any existing population.
    #[wasm_bindgen(js_name = initPopulationBiallelic)]
    pub fn init_population_biallelic(&mut self, n: usize, freq_allele0: f64) {
        self.population = Some(Population::founder_biallelic(
            n,
            &self.archetype,
            freq_allele0,
            &mut self.rng,
        ));
    }

    /// Return the current population as a JSON array of creatures.
    #[wasm_bindgen(js_name = populationJson)]
    pub fn population_json(&self) -> Result<String, JsError> {
        let pop = match &self.population {
            Some(p) => p,
            None => return Ok("[]".to_string()),
        };
        serde_json::to_string(&pop.creatures)
            .map_err(|e| JsError::new(&format!("population serialize error: {}", e)))
    }

    /// Return a single creature by index.
    #[wasm_bindgen(js_name = creatureJson)]
    pub fn creature_json(&self, idx: usize) -> Result<String, JsError> {
        let pop = self.population.as_ref().ok_or_else(|| JsError::new("no population"))?;
        let c = pop.creatures.get(idx).ok_or_else(|| JsError::new("index out of range"))?;
        serde_json::to_string(c)
            .map_err(|e| JsError::new(&format!("creature serialize error: {}", e)))
    }

    /// Build a random single creature (not in any population).
    #[wasm_bindgen(js_name = randomCreatureJson)]
    pub fn random_creature_json(&mut self, freq_allele0: f64) -> Result<String, JsError> {
        let sex = if self.rng.bernoulli(0.5) {
            chromosome::Sex::Female
        } else {
            chromosome::Sex::Male
        };
        let c = Creature::biallelic_founder(0, sex, &self.archetype, freq_allele0, &mut self.rng);
        serde_json::to_string(&c)
            .map_err(|e| JsError::new(&format!("creature serialize error: {}", e)))
    }

    /// Compute phenotype channel values for a creature given as JSON.
    #[wasm_bindgen(js_name = phenotypeJson)]
    pub fn phenotype_json(&self, creature_json: &str) -> Result<String, JsError> {
        let c: Creature = serde_json::from_str(creature_json)
            .map_err(|e| JsError::new(&format!("creature parse error: {}", e)))?;
        let p = compute_phenotype(&c, &self.archetype);
        serde_json::to_string(&p)
            .map_err(|e| JsError::new(&format!("phenotype serialize error: {}", e)))
    }

    /// Run a single meiosis on a given creature and return a gamete
    /// JSON.
    #[wasm_bindgen(js_name = meioseJson)]
    pub fn meiose_json(&mut self, creature_json: &str) -> Result<String, JsError> {
        let c: Creature = serde_json::from_str(creature_json)
            .map_err(|e| JsError::new(&format!("creature parse error: {}", e)))?;
        let g = meiose(&c, &self.archetype, MeiosisParams::default(), &mut self.rng);
        serde_json::to_string(&g)
            .map_err(|e| JsError::new(&format!("gamete serialize error: {}", e)))
    }

    /// Advance the population by one generation under a neutral regime
    /// (no selection; pure HW + drift).
    #[wasm_bindgen(js_name = stepNeutral)]
    pub fn step_neutral(&mut self, mutation_rate: f64) -> Result<(), JsError> {
        self.step_with_regime("neutral", mutation_rate)
    }

    /// Advance the population by one generation under a named regime
    /// defined in the archetype's `fitness_regimes` map. Returns an
    /// error if the regime is unknown.
    #[wasm_bindgen(js_name = stepWithRegime)]
    pub fn step_with_regime(
        &mut self,
        regime_name: &str,
        mutation_rate: f64,
    ) -> Result<(), JsError> {
        let pop = self
            .population
            .as_mut()
            .ok_or_else(|| JsError::new("no population"))?;
        let regime = match regime_name {
            "neutral" => archetype::FitnessRegime::Neutral,
            other => self
                .archetype
                .fitness_regimes
                .get(other)
                .cloned()
                .ok_or_else(|| JsError::new(&format!("unknown regime: {}", other)))?,
        };
        let params = StepParams {
            mutation_rate,
            mating_scheme: mating::MatingScheme::Random,
            meiosis: MeiosisParams::default(),
            fertilization: fertilization::FertilizationParams::default(),
            target_offspring: pop.creatures.len(),
        };
        pop.step(&self.archetype, &regime, params, &mut self.rng);
        Ok(())
    }

    /// Return generation stats (allele frequencies, heterozygosity) as
    /// JSON.
    #[wasm_bindgen(js_name = statsJson)]
    pub fn stats_json(&self) -> Result<String, JsError> {
        let pop = self
            .population
            .as_ref()
            .ok_or_else(|| JsError::new("no population"))?;
        let stats = pop.stats(&self.archetype, &archetype::FitnessRegime::Neutral);
        serde_json::to_string(&stats)
            .map_err(|e| JsError::new(&format!("stats serialize error: {}", e)))
    }

    /// Return the list of archetype regime names.
    #[wasm_bindgen(js_name = regimeNames)]
    pub fn regime_names(&self) -> Vec<String> {
        let mut names: Vec<String> =
            self.archetype.fitness_regimes.keys().cloned().collect();
        names.sort();
        names
    }

    /// Bottleneck: sample `n` random survivors from the current
    /// population (without replacement) and replace the population
    /// with them. If `n >= current_size`, no-op. Does not change the
    /// generation counter.
    #[wasm_bindgen(js_name = bottleneckTo)]
    pub fn bottleneck_to(&mut self, n: usize) -> Result<(), JsError> {
        let pop = self
            .population
            .as_mut()
            .ok_or_else(|| JsError::new("no population"))?;
        let cur = pop.creatures.len();
        if n >= cur {
            return Ok(());
        }
        let mut indices: Vec<usize> = (0..cur).collect();
        for i in 0..n {
            let j = i + self.rng.gen_range_usize(indices.len() - i);
            indices.swap(i, j);
        }
        indices.truncate(n);
        let new_pop: Vec<creature::Creature> =
            indices.into_iter().map(|i| pop.creatures[i].clone()).collect();
        pop.creatures = new_pop;
        Ok(())
    }

    /// Step one generation, producing `target_offspring` offspring
    /// under the given regime. Enables recovery after a bottleneck.
    #[wasm_bindgen(js_name = stepWithTarget)]
    pub fn step_with_target(
        &mut self,
        regime_name: &str,
        mutation_rate: f64,
        target_offspring: usize,
    ) -> Result<(), JsError> {
        let pop = self
            .population
            .as_mut()
            .ok_or_else(|| JsError::new("no population"))?;
        let regime = match regime_name {
            "neutral" => archetype::FitnessRegime::Neutral,
            other => self
                .archetype
                .fitness_regimes
                .get(other)
                .cloned()
                .ok_or_else(|| JsError::new(&format!("unknown regime: {}", other)))?,
        };
        let params = StepParams {
            mutation_rate,
            mating_scheme: mating::MatingScheme::Random,
            meiosis: MeiosisParams::default(),
            fertilization: fertilization::FertilizationParams::default(),
            target_offspring,
        };
        pop.step(&self.archetype, &regime, params, &mut self.rng);
        Ok(())
    }

    /// Current generation counter.
    #[wasm_bindgen(js_name = generation)]
    pub fn generation(&self) -> u32 {
        self.population.as_ref().map(|p| p.generation).unwrap_or(0)
    }

    /// Current population size.
    #[wasm_bindgen(js_name = populationSize)]
    pub fn population_size(&self) -> usize {
        self.population.as_ref().map(|p| p.creatures.len()).unwrap_or(0)
    }
}

// Log helper for debugging inside WASM.
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub fn greet() -> String {
    "EvoSim engine online.".to_string()
}
