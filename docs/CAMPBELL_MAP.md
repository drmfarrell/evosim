# Campbell Biology Coverage Map

Every EvoSim feature and preset scenario is paired to a specific Campbell Biology section. This file is the index. It is intentionally kept terse; the full scenario descriptions live in the scenario JSON files and worksheet markdown.

Campbell Biology 12th edition is the reference. Section numbers may drift in future editions; update this file when bumping editions.

## Chapter 22: Descent with Modification

| Campbell section | EvoSim feature |
|---|---|
| 22.1 Pre-Darwinian ideas | Contextual only. Not simulated. |
| 22.2 Darwin's three observations + two inferences | All preset scenarios exercise this: variation visible in organism view, heritability visible in meiosis theater, differential reproduction visible in population tank. |
| 22.3 Natural selection postulates | VIDAS panel enforces claim-evidence-reasoning structure on every scenario. |
| 22.4 Evidence for evolution | Implicit: observable population change over generations is direct evidence. |

## Chapter 23: The Evolution of Populations

| Campbell section | EvoSim feature / scenario |
|---|---|
| 23.1 Genetic variation makes evolution possible | Heterozygosity stats, geographic variation via vertical gradient (cline), mutation as visible random event, recombination visible in meiosis theater. |
| 23.2 Hardy-Weinberg | Preset #1 (Hardy-Weinberg baseline). Five HW conditions surfaced as five force-panel controls. |
| 23.3 Natural selection, drift, gene flow alter allele frequencies | Presets #2 (pure drift), #3 (bottleneck), #4 (founder), #11 (gene flow vs selection). |
| 23.4 Modes of selection | Presets #5 (directional), #6 (stabilizing), #7 (disruptive), #8 (heterozygote advantage), #9 (frequency-dependent), #10 (sexual selection). |
| 23.4 Constraints on perfection | Observable: trade-off scenarios (costly sexual display vs survival). |

## Chapter 24: The Origin of Species

| Campbell section | EvoSim feature / scenario |
|---|---|
| 24.1 Biological species concept | Two-population scenarios use hybrid-viability configuration to define species boundary. |
| 24.2 Allopatric speciation | Preset #12 (allopatric with barrier). |
| 24.2 Sympatric: polyploidy | Preset #13 (polyploidy event → instant reproductive isolation). |
| 24.2 Sympatric: habitat differentiation | Preset #14 (habitat differentiation along vertical gradient). |
| 24.3 Hybrid zones | Preset #15 (three sub-variants: reinforcement, fusion, stability). |
| 24.4 Tempo + gene count | Selection strength + mutation rate adjust tempo; configurable locus count exercises few-vs-many-gene speciation. |

## Chapter 15: Prior knowledge leveraged (not re-taught)

- Sex chromosomes (XY/ZW configurable in archetype).
- X-linked / Z-linked inheritance with hemizygous expression (EyeColor locus on X in generic_fish).
- Linked genes with recombination frequency (loci on same autosome; map distance in cM).
- Nondisjunction and polyploidy as speciation mechanisms.

## Out of scope (not in Campbell 22-24)

- Red Queen dynamics / host-pathogen coevolution.
- Multi-trophic ecosystems.
- Emergent fitness from behavioral AI.
- Campbell 16-21 molecular biology (DNA structure, gene expression, regulation, viruses). Students have not covered these at lab time.
- Full ecology (Campbell chs 52-56).
