import { describe, it, expect } from "vitest";
import { computePhenotype } from "../../src/utils/phenotype";
import genericFish from "../../src/data/species/generic_fish.json";

function makeCreature(overrides: any = {}) {
  const c = {
    id: 1,
    sex: "female" as const,
    generation: 0,
    // 3 autosomes, 3 loci each, all allele 0 (the dominant)
    autosomes: [
      { maternal: [0, 0, 0], paternal: [0, 0, 0] },
      { maternal: [0, 0, 0], paternal: [0, 0, 0] },
      { maternal: [0, 0, 0], paternal: [0, 0, 0] },
    ],
    // XX female
    sex_chromosomes: {
      maternal_larger: [0],
      paternal_larger: [0],
      smaller: null,
    },
    mother_id: null,
    father_id: null,
  };
  return { ...c, ...overrides };
}

describe("computePhenotype on generic_fish", () => {
  it("returns channel values for a dominant-homozygous female", () => {
    const c = makeCreature();
    const ph = computePhenotype(c as any, genericFish);
    expect(ph.body_color_hue).toBe(0.18); // BB
    expect(ph.eye_color).toBe(0.15); // EE (dominant, female)
    // Polygenic body size = S + S + T + T = 0.25 * 4 = 1.0
    expect(ph.body_size).toBeCloseTo(1.0, 5);
  });

  it("hemizygous XY male shows recessive X-linked phenotype", () => {
    const c = makeCreature({
      sex: "male",
      sex_chromosomes: {
        maternal_larger: [1], // recessive e
        paternal_larger: null,
        smaller: [],
      },
    });
    const ph = computePhenotype(c as any, genericFish);
    expect(ph.eye_color).toBe(0.85); // e_ hemizygous → recessive phenotype
  });

  it("heterozygous codominant CoatPattern yields intermediate value", () => {
    const c = makeCreature();
    c.autosomes[0].maternal[1] = 0; // P
    c.autosomes[0].paternal[1] = 1; // p → Pp codominant = 0.5
    const ph = computePhenotype(c as any, genericFish);
    expect(ph.coat_pattern).toBe(0.5);
  });
});
