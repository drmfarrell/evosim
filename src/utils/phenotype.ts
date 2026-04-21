// Mirror of the engine's phenotype assembly, run on the JS side for
// hot-path rendering and interactive hover. Keeps engine in charge of
// per-generation evaluation (in Rust) but lets the organism view
// recompute on-demand without an extra WASM roundtrip.
//
// Values here do NOT include per-individual jitter; jitter is applied
// once per individual at render time and cached on the mesh.

import type { CreatureJson } from "../state/SimState";

type Archetype = any;
type PhenotypeValues = Record<string, number>;

export function computePhenotype(creature: CreatureJson, archetype: Archetype): PhenotypeValues {
  const result: PhenotypeValues = {};

  // Autosomes.
  const autosomes = archetype.autosomes ?? [];
  for (let ci = 0; ci < autosomes.length; ci++) {
    const chrSpec = autosomes[ci];
    const pair = creature.autosomes[ci];
    if (!pair) continue;
    const loci = chrSpec.loci ?? [];
    for (let li = 0; li < loci.length; li++) {
      const locus = loci[li];
      const a1 = pair.maternal[li];
      const a2 = pair.paternal[li];
      addContribution(result, locus, archetype, a1, a2);
    }
  }

  // Sex chromosomes.
  const sc = archetype.sex_chromosome;
  const pair = creature.sex_chromosomes;
  if (sc && pair) {
    const sys = archetype.sex_determination;
    const largerLoci = sc.larger_loci ?? [];
    for (let li = 0; li < largerLoci.length; li++) {
      const locus = largerLoci[li];
      const m = pair.maternal_larger?.[li];
      const p = pair.paternal_larger?.[li];
      if (m != null && p != null) {
        addContribution(result, locus, archetype, m, p);
      } else if (m != null && p == null && sys === "XY") {
        addHemizygous(result, locus, archetype, m);
      } else if (m == null && p != null && sys === "ZW") {
        addHemizygous(result, locus, archetype, p);
      }
    }
  }

  return result;
}

function addContribution(
  result: PhenotypeValues,
  locus: any,
  archetype: Archetype,
  a1: number,
  a2: number
): void {
  const mapping = archetype.phenotype_mappings?.[locus.name];
  if (!mapping) return;
  const channel: string = locus.phenotype_channel;
  let value = 0;
  if (mapping.type === "lookup") {
    const key = genotypeKey(locus, a1, a2);
    value = mapping.values_by_genotype?.[key] ?? 0;
  } else if (mapping.type === "additive") {
    const k1 = locus.alleles[a1];
    const k2 = locus.alleles[a2];
    value =
      (mapping.contribution_by_allele?.[k1] ?? 0) +
      (mapping.contribution_by_allele?.[k2] ?? 0);
  }
  result[channel] = (result[channel] ?? 0) + value;
}

function addHemizygous(
  result: PhenotypeValues,
  locus: any,
  archetype: Archetype,
  a: number
): void {
  const mapping = archetype.phenotype_mappings?.[locus.name];
  if (!mapping) return;
  const channel: string = locus.phenotype_channel;
  let value = 0;
  if (mapping.type === "lookup") {
    const alleleName = locus.alleles[a];
    const hemiKey = `${alleleName}_`;
    value = mapping.values_by_genotype?.[hemiKey];
    if (value == null) {
      const homKey = `${alleleName}${alleleName}`;
      value = mapping.values_by_genotype?.[homKey] ?? 0;
    }
  } else if (mapping.type === "additive") {
    const k = locus.alleles[a];
    value = mapping.contribution_by_allele?.[k] ?? 0;
  }
  result[channel] = (result[channel] ?? 0) + value;
}

function genotypeKey(locus: any, a1: number, a2: number): string {
  const n1 = locus.alleles[a1];
  const n2 = locus.alleles[a2];
  if (locus.dominance === "complete") {
    const dom = locus.dominant_allele ?? 0;
    if (a1 === dom && a2 !== dom) return `${n1}${n2}`;
    if (a2 === dom && a1 !== dom) return `${n2}${n1}`;
    return `${n1}${n2}`;
  }
  return n1 <= n2 ? `${n1}${n2}` : `${n2}${n1}`;
}
