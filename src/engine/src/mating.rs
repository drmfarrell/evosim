// Mating scheme: given a population and a scheme, produce pairs of
// parents for the next generation.

use crate::chromosome::Sex;
use crate::creature::Creature;
use crate::rng::Pcg32;

#[derive(Debug, Clone, Copy)]
pub enum MatingScheme {
    Random,
    /// Assortative on a phenotype channel (exact-value weighted).
    /// For v1 we keep it simple: skip implementation here, fall back
    /// to random. v1.1 will add.
    Assortative,
    /// Disassortative; same caveat.
    Disassortative,
    /// Inbreeding: force sib-mating where possible.
    SiblingMating,
}

/// Return a vector of (mother_idx, father_idx) pairs. The number of
/// pairs equals the target offspring count. Panics if the population
/// lacks either sex (unless Hermaphrodite).
pub fn select_pairs(
    population: &[Creature],
    scheme: MatingScheme,
    target_offspring: usize,
    rng: &mut Pcg32,
) -> Vec<(usize, usize)> {
    match scheme {
        MatingScheme::Random => random_pairs(population, target_offspring, rng),
        MatingScheme::SiblingMating => sibling_pairs(population, target_offspring, rng),
        _ => random_pairs(population, target_offspring, rng),
    }
}

fn random_pairs(
    population: &[Creature],
    n: usize,
    rng: &mut Pcg32,
) -> Vec<(usize, usize)> {
    let females: Vec<usize> = population
        .iter()
        .enumerate()
        .filter(|(_, c)| c.sex == Sex::Female || c.sex == Sex::Hermaphrodite)
        .map(|(i, _)| i)
        .collect();
    let males: Vec<usize> = population
        .iter()
        .enumerate()
        .filter(|(_, c)| c.sex == Sex::Male || c.sex == Sex::Hermaphrodite)
        .map(|(i, _)| i)
        .collect();

    if females.is_empty() || males.is_empty() {
        return Vec::new();
    }

    let mut pairs = Vec::with_capacity(n);
    for _ in 0..n {
        let m = females[rng.gen_range_usize(females.len())];
        let f = males[rng.gen_range_usize(males.len())];
        pairs.push((m, f));
    }
    pairs
}

fn sibling_pairs(
    population: &[Creature],
    n: usize,
    rng: &mut Pcg32,
) -> Vec<(usize, usize)> {
    // Group individuals by mother_id (a sibling group shares a mother).
    use std::collections::HashMap;
    let mut groups: HashMap<u32, Vec<usize>> = HashMap::new();
    for (i, c) in population.iter().enumerate() {
        if let Some(mid) = c.mother_id {
            groups.entry(mid).or_default().push(i);
        }
    }
    // For each pair, pick a random sibling group; within it pick a
    // random female and random male. Fall back to random if no
    // heterosexual siblings.
    let mut pairs = Vec::with_capacity(n);
    let group_keys: Vec<u32> = groups.keys().copied().collect();
    if group_keys.is_empty() {
        return random_pairs(population, n, rng);
    }
    for _ in 0..n {
        let key = group_keys[rng.gen_range_usize(group_keys.len())];
        let sibs = &groups[&key];
        let females: Vec<usize> = sibs.iter().copied().filter(|&i| population[i].sex == Sex::Female).collect();
        let males: Vec<usize> = sibs.iter().copied().filter(|&i| population[i].sex == Sex::Male).collect();
        if !females.is_empty() && !males.is_empty() {
            let m = females[rng.gen_range_usize(females.len())];
            let f = males[rng.gen_range_usize(males.len())];
            pairs.push((m, f));
        } else {
            // Fall back to random.
            let mut rand = random_pairs(population, 1, rng);
            if let Some(p) = rand.pop() {
                pairs.push(p);
            }
        }
    }
    pairs
}
