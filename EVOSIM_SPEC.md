# EvoSim: Interactive Evolution Simulator for Undergraduate Biology

## Specification Document v1.0

**Author:** Dr. Fountain Farrell, Cheyney University of Pennsylvania
**Target:** Claude Code implementation with parallel research agents
**Date:** April 2026

---

## 1. Project Overview

### 1.1 What This Is

A browser-based, WebXR-compatible interactive evolution simulator built for General Biology II laboratory use. Students observe and manipulate evolution in a rendered aquatic ecosystem populated by creatures with visible, Mendelian-driven phenotypes. Three linked views share a single simulation state:

1. **Organism view.** A single diploid creature rendered on a pedestal, with its chromosomes shown as banded cylinders in a side panel. Every locus maps 1:1 to a pointable feature on the body. Hovering a gene highlights the trait; hovering the trait highlights the gene.
2. **Meiosis theater.** An animated, scrubbable sub-scene showing homolog pairing, crossing over at configurable map distances, independent assortment, gamete formation, nondisjunction events, and fertilization. Students see the *source* of sexually-produced variation, not just its outcome.
3. **Population tank.** An aquatic 3D box (reusing the ChemSim box scaffolding) populated with 50 to 500 creatures of a focal species. Vertical gradients in temperature, light, and optional salinity create ecological niches along the depth axis. An optional mid-tank barrier enables allopatric scenarios. Students impose evolutionary forces (selection pressure, genetic drift via finite size, bottleneck, founder event, migration, mutation rate, assortative mating, polyploidy event) and observe allele frequencies, heterozygosity, and phenotype distributions shift across generations.

State is shared. Selecting a creature in the tank opens it in the organism view. Triggering a mating event opens the meiosis theater on the chosen parent pair. Rewind restores prior generations via a history ring buffer.

### 1.2 What This Is NOT

The scope restrictions matter as much as the features. EvoSim is intentionally not:

- **Not an artificial-life sandbox.** Creatures do not evolve open-ended morphologies or learn neural controllers. Morphology is discrete, Mendelian, and deterministic given genotype. Karl-Sims-style evolved virtual creatures are out of scope.
- **Not an ecology simulator.** No trophic levels, no food webs, no predators as separate evolving species, no decomposers, no evolving plant foods, no Red Queen arms races. These are ecology-unit material (Campbell chs 52-56), not evolution-unit material (chs 22-24).
- **Not a host-pathogen coevolution engine.** Pathogens are out. Period.
- **Not behavior AI.** Creatures do not forage, flee, or fight. Intra-generation motion is kinematic and decorative. Fitness is **configured** (declared as a function of genotype given a selective regime), not **emergent** (arising from simulated behavior). This matches the pedagogical level of Campbell Ch 23.
- **Not a molecular biology tool.** DNA sequences, gene expression, transcription, translation, regulatory elements are all out. Campbell chs 16-21 have not been covered at lab time; the sim must not assume that material. Loci and alleles are abstract symbols, not nucleotide sequences.
- **Not a game.** No score, no avatars, no narrative. A creature surviving is an observation, not a win condition.

### 1.3 Why This Matters

No existing educational tool does what EvoSim does. The competitive landscape:

- **Avida-ED** (avida-ed.msu.edu) is the current gold standard for undergraduate digital-evolution labs. Assessment studies show real learning gains, but the abstract grid-of-squares representation is explicitly flagged as the reason student understanding of the **genetic origin of variation** remains weak after instruction. (Lark et al., *An Avida-ED digital evolution curriculum for undergraduate biology*, Evol. Educ. Outreach 2016; https://link.springer.com/article/10.1186/s12052-016-0060-0)
- **SimBio EvoBeaker** modules (*Darwinian Snails*, *Finches & Evolution*) are pedagogically strong. Students can sequentially disable variation, heritability, and differential survival to probe natural-selection assumptions. But the visuals are 2D and schematic, the tool is commercial, and meiosis is not rendered. (https://simbio.com/products-college/Evolution)
- **HHMI BioInteractive Population Genetics Explorer** gives the fullest set of manipulable population-genetics parameters (selection, drift, bottleneck, mutation, migration, inbreeding, assortative mating). But it presents everything as line graphs over generations. No creatures are ever visible. (https://www.biointeractive.org/classroom-resources/population-genetics-explorer)
- **NetLogo BEAGLE** suite (Peppered Moths, Bug Hunt Coevolution, Bug Hunters Adaptations) renders organisms as small 2D agents on a top-down map. Meiosis and chromosomes are absent. (https://ccl.northwestern.edu/rp/beagle/)
- **Karl Sims Evolved Virtual Creatures** and **Framsticks** render fully embodied 3D organisms, but their genotypes are opaque graph-based representations with emergent morphology. Pedagogically useless for Mendelian genetics.

The gap EvoSim fills: a tool that simultaneously shows (a) a rendered 3D creature students can point at, (b) that creature's chromosomes and alleles with explicit genotype-to-phenotype correspondence, (c) animated meiosis and fertilization as visible events linking parent genomes to offspring genomes, and (d) a population-scale view with all standard Campbell-chapter-23-and-24 evolutionary-force controls. This combination does not exist.

### 1.4 Target Users

Freshman-level General Biology II students at Cheyney University and peer institutions. Students have completed Campbell Biology chapters 1-15 plus 22-24 at lab time. Campbell chs 16-21 (molecular biology, gene expression, viruses, genomes) have *not* been covered and must not be assumed.

Hardware is heterogeneous: Chromebooks, laptops, phones, with occasional access to Meta Quest 3 headsets. The app must degrade gracefully: VR if available, 3D on desktop, simplified 3D on mobile.

The visual language is deliberately non-cartoonish. Reference aesthetic: HHMI BioInteractive's Rock Pocket Mouse materials and the user's companion project ChemSim (ball-and-stick molecules with deformable electrostatic clouds). Creatures are rendered as credible aquatic organisms with variable body proportions, muted naturalistic coloration, no cartoon faces, no gamification overlays.

### 1.5 Curricular Alignment

EvoSim maps 1:1 to Campbell Biology Unit 4 (*Mechanisms of Evolution*), chapters 22 through 24. Every preset scenario exercises one or more explicit Campbell sub-concepts. Vocabulary matches the textbook exactly: fitness means relative reproductive success, not physical strength; evolution means change in allele frequencies, not change in individuals; selection modes are directional/disruptive/stabilizing/balancing/sexual, matching the chapter.

Concepts from chapters 1-15 are available as prior knowledge and may be leveraged freely: Mendelian inheritance (complete dominance, incomplete dominance, codominance, multiple alleles, polygenic inheritance, pleiotropy), meiosis mechanics (Ch 13), sex chromosomes + sex-linked inheritance (Ch 15), linked genes + recombination frequency (Ch 15), chromosomal abnormalities (nondisjunction, aneuploidy, polyploidy; Ch 15).

Concepts from chapters 16 onward (DNA structure, gene expression, regulation, viruses, genomics) must **not** appear as assumed background in UI text, scenarios, or worksheets.

---

## 2. Architecture

### 2.1 Technology Stack

```
Presentation Layer:  Three.js (3D rendering, WebXR built in)
Simulation Engine:   Rust compiled to WebAssembly (WASM), single-threaded
UI Layer:            Vanilla TypeScript (small, no framework)
Build System:        Vite
Testing:             Playwright (e2e) + Vitest (unit)
```

This mirrors the ChemSim stack minus the threading layer. Rationale:

- **Three.js** is mature, WebXR-ready, and the ChemSim box scaffolding transfers directly.
- **Rust to WASM** gives strong types for genome structs, fast meiosis/fitness/mutation kernels, painless seedable RNG for reproducible labs, and clean `cargo test` for genetics validation. The ChemSim build scaffold (Vite + wasm-pack + native WASM import) lifts over verbatim.
- **Vanilla TypeScript** UI keeps bundle weight down.
- **Vite** gives the HTTPS dev server with the same dev ergonomics ChemSim already has.
- **Playwright + Vitest** matches ChemSim's two-level testing.

### 2.2 Deliberate Departures From ChemSim

Three changes from ChemSim's architectural choices, each justified:

- **No persistent worker pool. No multi-threading.** Evolution compute is tiny compared to molecular dynamics. At N=500 creatures with nine loci, a generation step is roughly 55,000 simple operations (mating pair selection, per-pair meiosis, per-locus mutation, per-individual fitness evaluation, survival sampling). That is sub-millisecond in single-threaded Rust, well under 1% of a frame budget. The ChemSim-specific spin-wait pool to bypass Rayon dispatch latency is unnecessary. This simplification drops the nightly Rust toolchain requirement, the `+atomics,+bulk-memory,+mutable-globals` rustflags, and the COOP/COEP SharedArrayBuffer choreography from the critical path. If a future fast-forward-1000-generations use case demands parallelism, a straightforward `rayon::par_iter` over the offspring array will be a small, scoped addition.
- **`SimState` class on day one.** ChemSim's `src/main.ts` is a two-thousand-line module-level-state monolith, flagged in its own `CLAUDE.md` as the single biggest maintenance risk. EvoSim ships a dedicated `SimState` class in its first commit. All UI mutations route through state methods. Renderers and UI panels subscribe to state events. A CI lint rejects any PR that adds module-level `let` to `main.ts`, hard-capped at 300 lines.
- **HTTPS dev server optional, not required.** Without SharedArrayBuffer, we do not need HTTPS on localhost dev. Production deploys still use HTTPS. This removes one of ChemSim's most fragile choreographed configurations.

### 2.3 Architecture Diagram

```
+------------------------------------------------------------+
|  Browser (Desktop / Mobile / Quest Browser)                |
|                                                            |
|  +-----------------+   +-------------------------------+   |
|  |   UI Layer       |   |   Three.js Scene Manager      |   |
|  |   (Vanilla TS)   |   |                               |   |
|  |                  |   |  +-------------------------+  |   |
|  |   - View switch  |   |  |  Organism view renderer  | |   |
|  |   - Force panel  |--->  |  Meiosis theater         | |   |
|  |   - Stats panel  |   |  |  Population tank         | |   |
|  |   - Replay bar   |   |  |  Chromosome panel        | |   |
|  +--------+---------+   |  +-------------------------+  |   |
|           |              +---------------+---------------+  |
|           |                              |                  |
|           v                              v                  |
|       +-------------------------------------------+         |
|       |         SimState (centralized)             |        |
|       |   Population, selected-individual, mode,   |        |
|       |   run-state, history ring buffer, stats    |        |
|       +-------------------+-----------------------+         |
|                           |                                 |
|                           v Each tick / generation          |
|       +---------------------------------------------+       |
|       |       WASM Evolution Engine (Rust, 1 thread) |      |
|       |   - Creature array (SoA genotypes)           |      |
|       |   - Meiosis (crossover + assortment + NDJ)   |      |
|       |   - Fertilization, mutation                  |      |
|       |   - Fitness regimes, survival sampling       |      |
|       |   - Population events (bottleneck, founder,  |      |
|       |     polyploidy, migration)                   |      |
|       |   - Seedable RNG (PCG)                       |      |
|       +---------------------------------------------+       |
+------------------------------------------------------------+
```

### 2.4 Data Flow Per Generation

Generations are discrete. Intra-generation motion is kinematic animation (decorative swimming in the tank), not behavior simulation.

1. UI sends force-panel parameters to WASM (selection regime, mutation rate, event triggers).
2. WASM computes each creature's fitness under the active regime.
3. WASM samples survival (seeded RNG, reproducible with fixed seed).
4. Surviving creatures pair for mating per configured mating scheme (random, assortative, sexual-selection-weighted, inbreeding, etc.).
5. For each pair, meiosis runs on each parent: homolog pairing, Poisson crossover draws per chromosome at configured map lengths, independent assortment across chromosomes, gamete assembly. Optional nondisjunction.
6. Fertilization fuses a gamete from each parent into a zygote.
7. Per-locus mutation applied at configured rate.
8. WASM returns new population roster to JS.
9. SimState updates. Tank renderer re-instances creature meshes. Chart panels pull from the history ring buffer.

Target: 60 FPS intra-generation render on desktop. Generation transition under 16ms at N=200, under 100ms at N=500.

---

## 3. Pedagogical Design Principles

Every UI and simulation decision is checked against this section before being added.

### 3.1 Campbell 22-24 Is the Ceiling

Nothing in the default UI, tutorial, worksheet set, or preset scenarios introduces a concept not covered by Campbell chapters 22 through 24. Concepts from chapters 1-15 are fair game as prior knowledge. Concepts from chapters 16-21 are forbidden from default-mode UI text. An "advanced sandbox" mode may expose additional parameters, but these are opt-in and labeled as such.

### 3.2 VIDAS as the Spine

HHMI BioInteractive's VIDAS framework decomposes natural selection into five components: **V**ariation, **I**nheritance, **D**ifferential survival and reproduction, **A**daptation, **S**elective pressure. (https://biologycorner.com/2019/04/19/evolution-vida-chart/) Every guided lab scenario ends with a VIDAS summary screen that students populate from observations made during the run. Claim-evidence-reasoning is enforced by UI flow, not by instructor nagging.

### 3.3 Design Against Specific Misconceptions

Each misconception has a matching design rule. Sources: Berkeley Understanding Evolution misconceptions taxonomy (https://evolution.berkeley.edu/teach-evolution/misconceptions-about-evolution/), Gregory 2009 (https://link.springer.com/article/10.1007/s12052-009-0128-1), Coley & Tanner on cognitive construals (https://www.lifescied.org/doi/10.1187/cbe.14-06-0094).

| Misconception | Design rule |
|---|---|
| Individuals evolve during their lifetime | Each creature's genotype is locked from birth and visibly displayed. No button changes a living creature's alleles. "Evolution" is labeled and framed at the population layer only: "allele A frequency rose from 0.4 to 0.6" is the headline, never "this creature improved." |
| Organisms try to adapt / teleology | No UI string uses verbs of intention for creatures ("the fish wants to be darker"). Mutation is shown as a visible independent random event (dice-roll icon, timestamped in a log) that occurs *before* environment changes in each generation, demonstrating independence. |
| Survival of the fittest means strongest | Fitness is labeled *relative reproductive success* everywhere. Tooltip on fitness number: "contribution to the next generation's gene pool, relative to other individuals." The survival panel shows the actual post-selection distribution: many survivors with varying traits, not a single optimal genotype. |
| Evolution is progress / directional | No "progress bar," no "evolution score," no leaderboard. Default longitudinal metrics are allele frequency and phenotype distribution only. A rewind-and-change-environment feature lets students watch a previously-favored allele become deleterious after a shift, reinforcing that fitness is relative to current conditions. |
| Genetic drift only occurs in small populations | Drift is computed and plotted for all population sizes. Its dominance at small N is a visible finding, not a precondition. The drift-only preset runs at multiple N values simultaneously for comparison. |
| Natural selection produces perfect organisms | Selection acts only on existing variation. A dedicated scenario demonstrates extinction from lack-of-variation: a population with all one allele at a locus cannot respond to a new pressure. Trade-off examples (costly sexual-display traits that hurt survival) make compromises visible (Campbell 23.4, 23.19). |
| Mutation is directed | Mutations are sampled before environment changes each generation. The mutation log timestamps this sequence. A "neutral-then-beneficial" scenario demonstrates a mutation occurring as neutral, then becoming beneficial only after a later environment shift. |
| Each trait has one locus with two alleles | V1 ships with loci that have two alleles as default (the Campbell level), but the genome configuration exposes multi-allele loci and polygenic additive traits. Tooltip warns this is a simplification and real biology is richer. |
| Species are Platonic essences (essentialism) | Creatures display continuous within-population variation via per-individual phenotype jitter. Two identical genotypes never render pixel-identical. Essentialist construals are contradicted by what the student sees. |
| Anthropomorphism | Creatures are aquatic organisms with no faces rendered by default. No emoting, no gamification, no friendly sound effects. |

### 3.4 Make Random Visible

Avida-ED's documented weakness is that abstract representations obscure the random origin of variation. EvoSim's design response: every stochastic event is visually explicit. Mutations draw a die-roll icon on the chromosome panel. Migration across a barrier animates the migrant crossing. Polyploidy events animate the meiotic error producing a tetraploid gamete. On first demonstration of mating, a visible lottery wheel picks parents; subsequent runs suppress the wheel but a keystroke brings it back.

### 3.5 Configured Fitness, Visible Causation

Fitness is declared in each regime (for example, "dark-coat fitness multiplier is 1.2 in dark-substrate zones"). It is not emergent from behavioral AI. This matches the Campbell 23.4 pedagogical level.

The causal chain is kept visible through two design choices:
- Each fitness regime's declared function is displayed in an inspectable panel. Hovering a creature shows its fitness contribution breakdown by locus.
- Visual correspondence between phenotype and environment is deliberate: dark-coat creatures on dark-substrate zones are visibly harder to distinguish against background; light-coat on light substrate likewise. Students can see *why* the fitness difference exists even though the sim does not compute predator line-of-sight.

### 3.6 Deterministic Mode

Every run accepts an explicit RNG seed. Fixed seed plus fixed parameters plus fixed code version equals bit-for-bit identical results. Required for instructor-graded labs and for "rewind and change one thing" pedagogical moves.

### 3.7 Scaffolded Entry

The app opens into a "guided first run" mode: a single creature, one autosome, one locus, two alleles, visible homolog pair, a single meiosis animation. Complexity accrues one concept at a time. The full population tank is accessible at any time via a mode switch, but it is not the default entry point.

### 3.8 Visual Design Language

Reference projects: HHMI BioInteractive (Rock Pocket Mouse), Visible Biology, and the user's ChemSim.

Do:
- Muted naturalistic palettes for creatures (earth tones, desaturated blues/greens). Strong saturation reserved for chromosome-allele color coding, a functional visual channel.
- Scientific-style sans serifs (Inter, IBM Plex Sans, or similar) for UI text.
- Real data displays: log scales where appropriate, error bars on means, confidence intervals where meaningful.
- Chromosomes as banded cylinders with crisp edges (HHMI-illustration style), not cartoon wavy X shapes.
- Gametes as translucent membrane-bound spheres with visible haploid chromosome complement.
- Tank rendering with gentle volumetric lighting, subtle caustics, faint depth-fog at lower elevations.

Don't:
- Comic-sans or "friendly" display fonts.
- Smiling creature faces, eyebrows, emoji.
- Gamification overlays (stars, confetti, level-up chimes).
- Pastel primary-school palettes.
- Onomatopoeic sound effects. Audio is optional and limited to a soft generation-tick.

---

## 4. Genome Model

The core data model. Get this right and everything else follows.

### 4.1 Diploid Genome

Each creature is diploid. The genome is a pair of chromosome sets: maternal and paternal.

v1 default configuration:
- 3 autosomes + 1 sex chromosome pair (so 2n = 8 for a female, or 2n = 8 for a male with different sex-chromosome content)
- 3 loci per autosome (9 autosomal loci total)
- 1 to 2 loci on the sex chromosome
- 2 alleles per locus by default (multi-allele schema supported for v2)
- Configuration is data-driven via species archetype JSON files

### 4.2 Sex Chromosomes

EvoSim supports XY (mammal-style) and ZW (bird-style) sex-determination systems, configurable per archetype. Default is XY for familiarity.

- **XY**: XX female, XY male. X-linked recessive phenotypes show hemizygous expression in males. Y is short, carrying few or no loci in v1.
- **ZW**: ZZ male, ZW female. Z-linked recessives hemizygous in females.

The sex-linked locus default is a color-vision or coat-color gene, producing a classic X-linked recessive pattern students recognize from Ch 15 (color-blindness analog).

### 4.3 Locus Specification

Each locus defines:
- **Name** and **position on chromosome** in cM
- **Allele set** (2 for v1 default; schema supports more)
- **Dominance relationship**: complete dominance, incomplete dominance, codominance, overdominance
- **Phenotype channel** the locus drives (see Section 5)
- **Fitness contribution function** under each selective regime

### 4.4 Linkage and Map Distance

Loci on the same chromosome are linked. Crossover probability between two loci follows the standard Haldane mapping function with the cM distance configured in the archetype. Students can visually observe that loci far apart on a chromosome assort nearly independently while loci close together co-segregate.

Recombination frequencies are displayed in the chromosome panel on hover. This directly exercises Campbell Ch 15 recombination-frequency material.

### 4.5 Meiosis

Meiosis is the spine of the meiosis theater and runs per parent per mating event.

Algorithm:
1. For each of the n autosomes + sex chromosome, pair maternal and paternal homologs.
2. For each homolog pair, sample k crossover sites. k drawn from Poisson with mean equal to chromosome map length in Morgans (1.0 default for each chromosome). Crossover positions uniform along the chromosome.
3. Execute crossover: alleles on one side of each crossover site exchange between homologs. The theater view highlights exchanged segments in contrasting colors.
4. Independent assortment: for each chromosome, one homolog of the post-crossover pair is sampled uniformly for the gamete.
5. **Nondisjunction** (optional): with probability p_NDJ (default 0, instructor-exposed), the sampling step for one chromosome fails, producing an aneuploid gamete. Aneuploid zygotes have configurable viability (default: nonviable and displayed briefly as a ghosted individual before removal). This is the mechanism that also produces polyploidy events (Section 4.8).

The theater animates each step on a scrubbable timeline and supports replay at different seeds to demonstrate crossover stochasticity.

### 4.6 Fertilization

Two gametes (one from each parent) fuse. Mating pair selection depends on mating scheme:
- **Random** (default): pairs sampled uniformly.
- **Assortative**: weighted by phenotypic similarity on a configured trait.
- **Disassortative**: weighted against phenotypic similarity.
- **Inbreeding**: forced sib-mating or cousin-mating for demonstration.
- **Sexual selection**: mate choice weighted by a display-trait locus (intersexual) or by combat-trait locus (intrasexual).

The theater animates fusion: two translucent gametes approach, membranes merge, chromosome pairing in the zygote is rendered.

### 4.7 Mutation

Per-locus per-zygote mutation at rate μ (instructor-exposed, default 10⁻⁴). On firing, the locus's allele resamples uniformly from the allele set excluding the current allele.

Mutation log records: generation, individual ID, locus, old allele, new allele. Inspectable and exportable.

### 4.8 Polyploidy Event

One-shot instructor trigger. Implementation: force a nondisjunction in *all* chromosomes simultaneously for one meiosis, producing an unreduced gamete that fuses with a normal gamete to create a triploid zygote (usually sterile, short-lived) or with another unreduced gamete to create a tetraploid zygote (fertile, reproductively isolated from the diploid parent population via gametic incompatibility in hybrid crosses).

This directly exercises Campbell Ch 24.2 sympatric-speciation-by-polyploidy content, including the distinction between autopolyploidy (one parent species) and allopolyploidy (two parent species, when the polyploidy event occurs post-hybridization).

### 4.9 Chromosomal Abnormalities Beyond Polyploidy

Schema supports translocations, inversions, and deletions for future expansion. V1 exposes only nondisjunction and polyploidy. (Campbell Ch 15 introduces the others; they are valid prior knowledge but not required v1 features.)

---

## 5. Phenotype Assembly

How genotype becomes a visible aquatic organism.

### 5.1 Creature Archetype

V1 ships with one archetype: a generic small-fish. Archetype is a JSON file specifying a base skeleton (head, spine, dorsal fin anchor, pectoral fin anchors, tail anchor, eye positions), a set of phenotype *channels*, and the mapping from loci to channel values.

Fish archetype rationale: aquatic habitat means no terrain or legged-locomotion complexity; a small-fish form is scientifically legitimate (sticklebacks, guppies, cichlids, killifish are all canonical evolution case studies); students recognize fish immediately; color, pattern, body shape, fin size are all appreciable and pointable phenotypes.

### 5.2 Phenotype Channels

Each channel is a continuous parameter affecting the rendered mesh. V1 channels:

| Channel | Visible effect | Default driver | Purpose |
|---|---|---|---|
| `body_color_hue` | Skin hue | 1 autosomal locus, complete dominance (A dark, a light) | Classic directional-selection demo (rock pocket mouse analog on substrate) |
| `body_size` | Overall scale | Polygenic (3 additive loci across 2 chromosomes) | Polygenic / quantitative variation (Ch 14) |
| `body_shape_streamlined` | Fusiform vs deep-bodied | 1 autosomal locus, incomplete dominance | Stabilizing or disruptive selection target |
| `dorsal_fin_size` | Dorsal fin height | 1 autosomal locus, complete dominance | Sexual-selection display trait (intersexual) |
| `coat_pattern` | Solid / striped / spotted | 1 autosomal locus, codominant (three visibly distinct phenotypes for AA/Aa/aa) | Codominance / incomplete-dominance demo |
| `metabolic_rate` | Base swimming speed modifier; fitness contribution under cold stress | 1 autosomal locus, codominant | Driver of cline along vertical gradient |
| `mating_display_intensity` | Intensity of courtship coloration (males only in XY archetype) | 1 autosomal locus, complete dominance | Sexual-selection and hybrid-zone reinforcement |
| `eye_color` | X-linked color phenotype | 1 sex-linked locus, recessive | Classic X-linked recessive; Campbell Ch 15 |
| `combat_weapon` | Small spine or horn presence | 1 autosomal locus, complete dominance | Intrasexual sexual selection |

All channels pass through a per-individual jitter pass with configured sigma, so identical genotypes do not render pixel-identical. This is the primary design tool against essentialism misconceptions.

### 5.3 Per-Individual Jitter

Each channel has a jitter_sigma configured in the archetype. Jitter is applied once per individual at birth and persists for that individual's life. Jitter magnitudes are tuned to be small relative to between-genotype spacing (e.g., 5% of the genotype-induced range), so Mendelian ratios remain legible while essentialism is undermined.

### 5.4 Rendering

Base fish mesh is a moderate-poly model (2K-4K triangles). Phenotype channels drive:
- Scale and shape via bone-level transforms (no morph targets needed v1)
- Color via material uniform
- Pattern via small texture atlas swapped at material level
- Optional parts (enlarged fin, combat weapon) via conditional mesh attachment

For N up to 500 in the tank, use Three.js `InstancedMesh` with per-instance color and scale matrices. Separate instanced meshes for mutually-exclusive conditional-part subsets ("has weapon" / "no weapon"). Conditional parts are separate draw calls but still instanced.

### 5.5 Chromosome Panel

Side panel in organism view.

- n autosomes + sex chromosome pair rendered as vertical banded cylinders
- Maternal and paternal homologs side by side
- Loci as labeled bands colored by allele
- Hover gene → corresponding trait on the 3D fish highlights; hover trait → chromosome band highlights
- Click gene → popup with allele symbol, dominance, phenotype channel effect, current genotype, population allele frequency, Campbell textbook reference (which chapter section covers it)

---

## 6. Habitat Model

### 6.1 The Tank

A 3D aquatic box, reusing ChemSim's box infrastructure (dimensions, camera, orbit controls, VR session, render loop plumbing). Default size and proportions are tuned for housing 50 to 500 creatures visibly without overcrowding.

Visual treatment: gentle volumetric lighting with soft caustics at the top, gradual depth fog below. The box itself is subtle; creatures are the subject.

### 6.2 Vertical Gradient

The tank has built-in gradients along the vertical (depth) axis:
- **Temperature**: warm at top, cold at bottom (default 25°C surface, 4°C bottom)
- **Light**: bright at top, dim at bottom
- **Salinity** (optional, off by default): configurable gradient

Fitness regimes can reference the gradient. A creature at position y in the tank experiences temperature T(y), light L(y), and so on. This is cheap to compute and enables:
- **Cline** (Campbell 23.1): allele frequency gradients along the vertical axis when fitness depends on depth
- **Habitat-differentiation sympatric speciation** (Campbell 24.2): a population splits into two ecotypes occupying different depth bands, with ecology-induced assortative mating
- **Environmental shifts**: "warming events" raise the whole gradient, shifting selection

### 6.3 Optional Barrier

A toggleable mid-tank divider with configurable permeability (0.0 impermeable, 1.0 freely passable). Used for:
- **Allopatric speciation scenarios**: set to 0, let two populations diverge
- **Reinforcement / hybrid zone scenarios**: divergence under 0, then lower barrier to observe outcomes
- **Gene flow scenarios**: partial permeability produces measurable migration rates

### 6.4 Optional Second Patch

A scenario can instantiate two separate tanks with a migration rate parameter between them, supporting:
- **Founder-effect scenarios**: extract N individuals to the new patch, observe allele-frequency divergence
- **Gene-flow scenarios**: ongoing migration with measurable effect on both populations

### 6.5 What Is Not Simulated

- **No food, no eating, no hunger, no starvation**: food is not a simulated entity. Fitness regimes reference the gradient directly, not food availability.
- **No predators, no prey, no trophic levels**
- **No disease, no pathogens**
- **No behavioral AI**: swim motion is a kinematic noise pattern (small sinusoidal + Perlin drift). Creatures do not sense, decide, or act.

This is deliberate. Campbell 22-24 does not teach trophic ecology or behavioral ecology. Including them would both balloon scope and introduce cause-effect noise that students would struggle to attribute to genetic causes.

---

## 7. Simulation Views

### 7.1 View A: Organism

Single creature on a rotatable pedestal (or floating with slow drift, for aquatic consistency). Chromosome panel on the right. Hover-to-highlight bidirectional. Buttons: generate-random, import-from-genotype-string, find-this-genotype-in-tank, export-genotype-string.

Primary pedagogical moment: student clicks through tank individuals and internalizes that genotype determines phenotype deterministically (modulo jitter), and that the genome is a discrete structure they can read and reason about.

### 7.2 View B: Meiosis Theater

Animated, scrubbable. Timeline steps:
1. Interphase: chromosomes replicate (each becomes a sister-chromatid pair).
2. Prophase I: synapsis (homologs pair); chiasmata form at sampled crossover sites; segment exchange animates.
3. Metaphase I / Anaphase I: homolog pairs align; homologs separate to opposite poles. Independent assortment visible because two chromosomes segregate independently.
4. Telophase I / Meiosis II: sister chromatids separate.
5. Four haploid gamete products displayed.
6. Fertilization: one gamete fuses with partner's gamete; zygote's diploid genotype displays.

Controls: scrub bar, crossover-rate slider, nondisjunction toggle, label show/hide toggles, step-back, step-forward, replay with new seed. Nondisjunction toggled on demonstrates aneuploid gamete production; polyploidy event demonstrates unreduced gamete production.

Primary pedagogical moment: students see exactly where genetic variation comes from in sexual reproduction, and specifically see that crossover produces chromosomes different from either parent's.

### 7.3 View C: Population Tank

The 3D aquatic box populated with the current generation. Creatures swim with small kinematic motion. Selection, mating, meiosis, mutation all execute at generation boundaries.

**Panels:**
- Allele frequency time series: per locus, color-coded by allele, one line per allele per locus
- Phenotype distribution: histogram per channel per generation
- Stats readout: N, mean fitness, observed heterozygosity (H_obs), expected heterozygosity (H_exp), F_IS (inbreeding coefficient)
- Pedigree viewer: tree of ancestry for a selected individual, up to configurable depth
- VIDAS summary: five slots (V, I, D, A, S), student annotates during guided scenarios
- Event log: timestamped record of mutations, migrations, bottleneck events, polyploidy events
- Textbook reference panel: shows the Campbell section the current scenario exercises

**Controls (time):** play, pause, step-one-generation, rewind-to-generation-X, jump-to-generation-Y. Rewind is true state restoration via ring buffer, not replay.

**Controls (forces), all per Section 8:** mutation rate slider, selection regime dropdown + strength slider, mating scheme dropdown, bottleneck button, founder button, polyploidy button, migration rate slider, environmental event scheduler, barrier toggle + permeability, gradient-shift scheduler.

---

## 8. Evolutionary Force Controls

Each control maps to a specific Campbell section or violates a specific Hardy-Weinberg condition, and is labeled accordingly.

### 8.1 Mutation Rate (Violates HW Condition 1)

Per-locus per-generation slider, 0 to 10⁻². Default 10⁻⁴.

### 8.2 Mating Scheme (Violates HW Condition 2)

Dropdown: random (default), assortative, disassortative, inbreeding (sib or cousin), sexual selection (intra or intersexual). Strength parameters configurable per scheme.

### 8.3 Selection Regime (Violates HW Condition 3)

Dropdown of six regimes, each a fitness function over phenotype channels:
- **Directional**: linear fitness gradient along one channel (Campbell 23.4, Fig 23.13a)
- **Disruptive**: bimodal fitness favoring extremes (Campbell 23.4, Fig 23.13b; Cameroon seedcracker finches)
- **Stabilizing**: Gaussian fitness around an optimum (Campbell 23.4, Fig 23.13c; human birth weight)
- **Heterozygote advantage (balancing)**: Aa > AA and aa; maintains polymorphism (Campbell 23.4; sickle-cell/malaria example)
- **Frequency-dependent (balancing)**: fitness inversely proportional to phenotype frequency (Campbell 23.4; scale-eating fish)
- **Sexual selection**: intrasexual (combat-trait-weighted male survival or access) or intersexual (display-trait-weighted female mate choice); "good genes" variant where display is costly but correlates with a health allele (Campbell 23.4, Fig 23.16)

Each regime's declared function is inspectable in a panel. Strength slider per regime.

### 8.4 Population Size Control (Violates HW Condition 4)

Default N is configurable per scenario. Drift magnitude is emergent from finite N and visible in live stats.

One-shot buttons:
- **Bottleneck**: cull population to N survivors, sampled by a configured criterion (uniform random, or fitness-weighted)
- **Founder event**: extract N individuals to a new patch; origin population continues independently

### 8.5 Gene Flow (Violates HW Condition 5)

- **Migration rate**: per-generation per-individual probability of moving between patches (when second patch is instantiated)
- **Barrier permeability**: for single-tank scenarios with a mid-tank divider

### 8.6 Environmental Events

- **Gradient shift**: scheduled change to the vertical gradient at generation G, persisting for M generations. Demonstrates selection-pressure change.
- **One-shot environmental shocks**: temperature spike, light attenuation event, salinity pulse

### 8.7 Speciation-Specific Events

- **Polyploidy event** (Section 4.8): one-shot button producing an unreduced gamete; if the resulting tetraploid reproduces, a new reproductively-isolated species emerges immediately. Directly exercises Campbell 24.2 autopolyploidy.
- **Barrier up / barrier down**: for allopatric scenarios and subsequent hybrid-zone contact.
- **Hybrid fitness configuration**: in two-population scenarios, configure hybrid viability (for reinforcement vs fusion vs stability outcomes, Campbell 24.3).

---

## 9. Preset Scenarios

Each preset is a JSON file in `data/scenarios/`. Loading a preset sets parameters, initial population, and scenario script (timed events). Each ships with a markdown lab worksheet and a VIDAS prompt set.

Scenario list, mapped to Campbell sections:

1. **Hardy-Weinberg baseline** (Ch 23.2). N=1000, no selection, no mutation, random mating. Student verifies p² + 2pq + q² holds across 50 generations.
2. **Pure drift** (Ch 23.3). N=20, no selection, no mutation, random mating. Allele frequency wanders; ~70% of seeds reach fixation within 200 generations.
3. **Bottleneck and recovery** (Ch 23.3, greater prairie chicken analog). Large population with allele diversity at several loci; cull to N=10; observe heterozygosity collapse; optionally add new mutations and watch slow recovery.
4. **Founder effect** (Ch 23.3, Tristan da Cunha analog). Five individuals migrate to a new patch; initial allele frequencies in founders diverge from source by chance.
5. **Directional selection: dark substrate** (Ch 23.4). Dark-bottom tank favors dark coat via configured regime; allele frequency at coat locus rises monotonically over ~50 generations.
6. **Stabilizing selection: body size** (Ch 23.4, human-birth-weight analog). Extreme sizes disfavored; heterozygosity at polygenic size loci maintained.
7. **Disruptive selection: body shape** (Ch 23.4, seedcracker-finch analog). Bimodal fitness favoring extremes; observe phenotype bimodality emerge.
8. **Balancing selection: heterozygote advantage** (Ch 23.4, sickle-cell analog). AA and aa low fitness; Aa highest. Polymorphism stably maintained. Rewind to observe what happens without the pressure.
9. **Frequency-dependent selection** (Ch 23.4, scale-eating fish analog). Rare-phenotype fitness advantage; observe frequency oscillation around 0.5.
10. **Sexual selection runaway** (Ch 23.4, Fisher runaway). Costly display trait linked to female preference; both spread despite survival cost.
11. **Gene flow counteracting selection** (Ch 23.3, Parus major Vlieland analog). Two patches with different local optima and migration between; observe how migration prevents full local adaptation.
12. **Allopatric speciation** (Ch 24.2). Single tank, barrier up at generation 0, different selection regimes on the two sides; observe divergence and reproductive-isolation emergence; drop barrier at generation 200 and observe hybrid zone outcomes.
13. **Sympatric speciation by polyploidy** (Ch 24.2). Diploid population; trigger polyploidy event at generation 50; observe immediate reproductive isolation between the tetraploid lineage and diploid parent population.
14. **Sympatric speciation by habitat differentiation** (Ch 24.2, apple maggot fly analog). Vertical gradient with strong disruptive selection and assortative mating by depth preference; observe two ecotypes emerge.
15. **Hybrid zone outcomes** (Ch 24.3). Two previously allopatric populations meet; three sub-variants demonstrating reinforcement (hybrid fitness low), fusion (hybrid fitness high), and stability (hybrid fitness matched).

Each preset's worksheet is authored with explicit VIDAS prompts and with references to the Campbell figure and page number it exercises.

---

## 10. Data Pipeline

### 10.1 Species Archetype JSON (abbreviated example)

```json
{
  "name": "generic_fish",
  "skeleton": "skeletons/fish.glb",
  "sex_determination": "XY",
  "chromosomes": [
    {
      "name": "chr1",
      "length_cM": 100,
      "loci": [
        {"name": "BodyColor", "position_cM": 20,
         "alleles": ["B", "b"], "dominance": "complete", "dominant_allele": "B",
         "phenotype_channel": "body_color_hue",
         "values_by_genotype": {"BB": 0.2, "Bb": 0.2, "bb": 0.8}},
        {"name": "Size1", "position_cM": 40,
         "alleles": ["S", "s"], "dominance": "additive",
         "phenotype_channel": "body_size",
         "additive_contribution": {"S": 0.1, "s": -0.1}}
      ]
    }
  ],
  "sex_chromosome": {
    "x_name": "X", "y_name": "Y", "y_length_cM": 10, "x_length_cM": 80,
    "x_loci": [
      {"name": "EyeColor", "position_cM": 30,
       "alleles": ["E", "e"], "dominance": "complete", "dominant_allele": "E",
       "phenotype_channel": "eye_color",
       "values_by_genotype": {"EE": 0.1, "Ee": 0.1, "ee": 0.9, "E_": 0.1, "e_": 0.9}}
    ]
  },
  "phenotype_channels": [
    {"name": "body_color_hue", "jitter_sigma": 0.02, "clamp_range": [0, 1]},
    {"name": "body_size", "jitter_sigma": 0.05, "clamp_range": [0.6, 1.5]}
  ],
  "fitness_regimes": {
    "directional_dark": {"body_color_hue": {"type": "linear", "weight": 1.0, "target": 1.0}},
    "stabilizing_medium_size": {"body_size": {"type": "gaussian", "weight": 1.0, "optimum": 1.0, "sigma": 0.15}},
    "heterozygote_advantage_S": {"body_size": {"type": "overdominant", "heterozygote_bonus": 0.3}}
  }
}
```

### 10.2 Scenario JSON

```json
{
  "name": "directional_selection_dark_substrate",
  "campbell_ref": "Chapter 23.4, Figure 23.13a",
  "archetype": "generic_fish",
  "initial_population": {"N": 200, "allele_frequencies": {"B": 0.5}},
  "gradient": {"substrate": "dark"},
  "selection_regime": "directional_dark",
  "selection_strength": 0.3,
  "mutation_rate": 1e-5,
  "crossover_rate": 1.0,
  "mating_scheme": "random",
  "events": [],
  "stop_condition": {"type": "allele_fixation", "locus": "BodyColor"},
  "worksheet": "labs/directional_dark_substrate.md",
  "vidas_prompts": [
    {"slot": "V", "prompt": "Describe the variation you observe in body color at generation 0."},
    {"slot": "I", "prompt": "Open the organism view on a parent-offspring pair. What do they share?"},
    {"slot": "D", "prompt": "At generation 10, compare survival of BB, Bb, bb. Which are over-represented among survivors?"},
    {"slot": "A", "prompt": "At generation 50, how does the population differ from generation 0?"},
    {"slot": "S", "prompt": "What selective pressure caused this shift? How is it visible in the tank?"}
  ]
}
```

### 10.3 Content Authoring Scripts

- `scripts/generate_archetype.py`: YAML locus table + skeleton GLB → archetype JSON
- `scripts/validate_scenario.py`: scenario JSON validated against archetype's locus and channel definitions
- `scripts/campbell_index.py`: generate an index mapping Campbell sections to scenarios and features

---

## 11. Automated Test-User Agent

### 11.1 Test Framework

```
tests/
  e2e/
    organism_view.spec.ts
    organism_hover.spec.ts
    chromosome_panel.spec.ts
    meiosis_theater.spec.ts
    meiosis_crossover_distribution.spec.ts
    meiosis_nondisjunction.spec.ts
    meiosis_polyploidy_event.spec.ts
    population_render_500.spec.ts
    population_drift.spec.ts
    selection_directional.spec.ts
    selection_stabilizing.spec.ts
    selection_heterozygote_advantage.spec.ts
    sexual_selection_display.spec.ts
    sexlinked_hemizygous_pattern.spec.ts
    bottleneck_heterozygosity.spec.ts
    hardy_weinberg_stability.spec.ts
    allopatric_divergence.spec.ts
    hybrid_zone_reinforcement.spec.ts
    vr_entry.spec.ts
    perf_generation_500.spec.ts
  unit/
    genetics_engine.test.ts
    dominance.test.ts
    linkage_recombination.test.ts
    sex_chromosome.test.ts
    polyploidy.test.ts
    fitness_regimes.test.ts
    archetype_loader.test.ts
    scenario_loader.test.ts
```

### 11.2 Genetics Validation (runs in `cargo test`)

- **Mendelian F2 ratios**: AA × aa → F1 all Aa; F1 × F1 → F2 1:2:1 genotype, 3:1 phenotype (complete dominance) within statistical tolerance over 10k offspring.
- **X-linked pattern**: carrier female × unaffected male → half sons affected, daughters unaffected or carrier; directly matches Campbell Ch 15 pedigrees.
- **Linkage**: with 1 cM between two loci, recombinant-gamete frequency is ~1%.
- **Hardy-Weinberg stability**: at N=10000, no selection/mutation/drift-reducing forces, allele frequencies deviate less than 1% over 100 generations.
- **Drift timescale**: mean time to fixation from p=0.5 scales as 4N generations (Kimura) within wide tolerance.
- **Selection response**: directional selection with s=0.1 moves allele frequency toward fixation at expected rate.
- **Heterozygote advantage equilibrium**: with s1=0.1, s2=0.2 (fitnesses 1-s1 for AA, 1 for Aa, 1-s2 for aa), equilibrium allele frequency matches analytical prediction.
- **Polyploidy**: triploid zygote flagged inviable or sterile by default; tetraploid zygote can reproduce with other tetraploids and produces infertile F1 with diploids.

### 11.3 Screenshot Comparison

Organism view and meiosis theater have stable reference renderings committed to the repo. Population tank does not; its frame-level output is stochastic.

### 11.4 How Claude Code Uses This

After each change:
1. `npm run build` (Rust to WASM, bundle JS)
2. `npm run test:unit` (Vitest + cargo test)
3. `npm run test:e2e` (Playwright)
4. If tests pass: proceed. If fail: read output, fix, repeat.
5. Periodic human checkpoint per roadmap (Section 13).

---

## 12. Parallel Research Agent Instructions

Mirrors ChemSim Section 8. While the implementation agent builds, a research agent fills in content and identifies funding.

### 12.1 Research Task 1: Prior Art Confirmation

Re-verify and extend the Section 1.3 tool survey. Specifically:
- Recent (2023-2026) browser-based evolution education entrants on GitHub, arXiv, CBE-LSE
- VR/AR evolution simulators on App Lab, SideQuest, Steam (few or none known; confirm)
- Commercial competitors beyond SimBio (Labster, etc.)
- Open-source 3D fish morphology pipelines that could shorten phenotype-assembly build; licensing compatibility with MIT

Deliverable: updated competitor table; honest confirmation or revision of the "nothing else does this" claim.

### 12.2 Research Task 2: Grant Mechanism Search

Mirror ChemSim's grant search plus:
- NSF DBI (Division of Biological Infrastructure) educational components
- NSF IUSE evolution education priority areas
- HHMI Inclusive Excellence and BioInteractive development RFPs
- Simons Foundation undergraduate science programs
- ASCB Educational Programs
- Society for the Study of Evolution education grants
- Research Corporation Cottrell Scholar Awards

Deliverable: ranked list with deadlines and typical award sizes; draft paragraph tailored to HBCU faculty PI developing open-source Campbell-aligned evolution software.

### 12.3 Research Task 3: Pedagogy Validation and Assessment

Securing and mapping assessment instruments:
- CINS (Anderson, Fisher, Norman 2002) 20-item MC
- CANS (Kalinowski et al. 2016) successor
- GAENE (Smith et al. 2016) acceptance-of-evolution scale

Map each instrument's items to EvoSim design rules (Section 3.3 misconception table) to plan pre/post assessment in pilot deployment.

Draft IRB protocol outline for a simulation-efficacy study comparing EvoSim pilot group vs Avida-ED comparison group on CANS gains.

### 12.4 Research Task 4: Fish Morphology Assets

Survey MakeHuman-class tools for fish equivalents. Evaluate whether a procedural fish-body generator (parametric) or a set of curated skeleton GLBs is the better path for the v1 archetype.

---

## 13. Implementation Roadmap

### Phase 1: Foundation (1-2 weeks)

1. Vite + TypeScript + Rust-to-WASM scaffold lifted from ChemSim with threading removed. No nightly Rust required; stable Rust.
2. `SimState` class and event bus. UI and renderers subscribe; no direct state mutation. CI lint capping `main.ts` at 300 lines.
3. Rust engine skeleton: `Creature`, `Genotype`, `Chromosome`, `Locus`, `Population` structs. Meiosis algorithm (Section 4.5) implemented and unit-tested, including X-linked inheritance and linkage.
4. Three.js scene with a single fish mesh in a box. Color via per-instance uniform. Orbit controls.
5. Archetype JSON loader and validator. Minimal `generic_fish.json`.
6. Playwright + Vitest scaffolding.
7. First e2e test: render one fish from a hand-written genotype.

### Phase 2: Organism View + Chromosome Panel (1-2 weeks)

1. Chromosome panel renderer (HTML/Canvas is fine for v1).
2. Genotype-to-phenotype pipeline wired through SimState.
3. All v1 phenotype channels implemented (Section 5.2 table), including sex-linked and polygenic additive.
4. Hover bidirectional highlight (gene ↔ trait).
5. Click gene → popup with dominance, phenotype effect, Campbell reference.
6. Genotype string import/export.
7. Per-individual jitter pass.
8. Checkpoint: human review of one fish in organism view, chromosome panel correct, X-linked pattern visible in male vs female.

### Phase 3: Meiosis Theater (1-2 weeks)

1. Timeline data structure.
2. Animated synapsis, chiasmata, crossover with exchanged-segment highlighting.
3. Scrub bar.
4. Crossover rate slider, nondisjunction toggle, polyploidy-event button.
5. Gamete visualization (translucent membrane with chromosome content).
6. Fertilization animation.
7. Checkpoint: human review.

### Phase 4: Population Tank (2-3 weeks)

1. Lift ChemSim box scaffolding (scene, camera, bounds, VR session).
2. `InstancedMesh` rendering of N creatures (target N=500 desktop, N=100 Chromebook).
3. Per-generation simulation step in WASM.
4. Vertical gradient system.
5. Intra-generation kinematic motion (Perlin drift + small sinusoids).
6. Allele-frequency time series panel.
7. Phenotype distribution panel.
8. Stats readout (N, fitness, H_obs, H_exp, F_IS).
9. Force panel with all Section 8 controls.
10. History ring buffer + rewind.
11. Checkpoint: human review.

### Phase 5: Scenarios, VIDAS, Worksheets (1 week)

1. Scenario JSON loader and validator.
2. All 15 v1 preset scenarios authored and end-to-end tested.
3. VIDAS summary panel with student-annotation input.
4. Lab worksheet rendering from markdown with Campbell figure callouts.
5. Textbook reference panel showing current scenario's Campbell citations.
6. Checkpoint: pilot with two freshmen on one preset; watch and note pain points.

### Phase 6: Speciation Scenarios (1 week)

1. Second-patch instantiation + migration rate.
2. Barrier toggle with permeability.
3. Hybrid fitness configuration for hybrid-zone scenarios.
4. Polyploidy-event wiring end-to-end.
5. Scenarios 12-15 (allopatric, sympatric-polyploidy, sympatric-habitat, hybrid zone).
6. Checkpoint: human review of all speciation scenarios.

### Phase 7: Polish, VR, Accessibility (1-2 weeks)

1. WebXR session, controller select, floating panels in 3D.
2. Keyboard controls (full app usable without mouse).
3. Screen reader labels.
4. Service worker (offline cache with navigation passthrough, per ChemSim lesson).
5. Guided-first-run tutorial overlay.
6. Export: allele-frequency CSV, snapshot PNG, pedigree PDF, mutation-log JSON.

Total rough estimate: 10-14 weeks of Claude Code time.

---

## 14. File Structure

```
evosim/
  README.md
  EVOSIM_SPEC.md
  CLAUDE.md                       # Pragmatic agent-facing notes (mirror ChemSim's style)
  package.json
  vite.config.ts
  tsconfig.json

  src/
    main.ts                       # Thin. Hard-capped at 300 lines. Delegates everything.
    state/
      SimState.ts                 # Centralized state + event bus
      History.ts                  # Ring buffer for rewind
    scene/
      SceneManager.ts
      OrganismRenderer.ts
      MeiosisTheater.ts
      PopulationTank.ts           # Reuses ChemSim box scaffolding
      CreatureMesh.ts             # Fish mesh + phenotype-driven transforms
      ChromosomePanel.ts
      VRManager.ts
    ui/
      ViewSwitcher.ts
      ForcePanel.ts
      AlleleFreqChart.ts
      PhenotypeHistogram.ts
      PedigreeView.ts
      VidasPanel.ts
      StatsReadout.ts
      ScenarioLoader.ts
      TextbookRefPanel.ts
      TutorialOverlay.ts
    engine/
      Cargo.toml                  # Stable Rust. No nightly.
      src/
        lib.rs
        creature.rs
        chromosome.rs
        locus.rs
        meiosis.rs
        fertilization.rs
        mutation.rs
        fitness.rs
        selection.rs
        mating.rs
        population.rs
        events.rs                 # Bottleneck, founder, polyploidy, migration
        rng.rs                    # PCG seedable
    data/
      species/
        generic_fish.json
      scenarios/
        01_hardy_weinberg.json
        02_pure_drift.json
        03_bottleneck_recovery.json
        04_founder_effect.json
        05_directional_dark.json
        06_stabilizing_body_size.json
        07_disruptive_body_shape.json
        08_balancing_heterozygote.json
        09_frequency_dependent.json
        10_sexual_selection_runaway.json
        11_gene_flow_vs_selection.json
        12_allopatric_speciation.json
        13_sympatric_polyploidy.json
        14_sympatric_habitat.json
        15_hybrid_zone.json
      skeletons/
        fish.glb
    utils/
      constants.ts
      loader.ts
      rng_seed.ts
  scripts/
    generate_archetype.py
    validate_scenario.py
    campbell_index.py
    requirements.txt
  tests/
    e2e/
    unit/
  docs/
    STUDENT_GUIDE.md
    INSTRUCTOR_GUIDE.md
    ARCHITECTURE.md
    CAMPBELL_MAP.md               # Concept-to-feature map (Campbell sections → scenarios/features)
    labs/                         # One worksheet per preset scenario
```

---

## 15. Key Design Decisions and Constraints

### 15.1 SimState Is Mandatory

No module-level state in `main.ts`. CI lint enforces.

### 15.2 Single-Threaded Simulation Engine

No `wasm-bindgen-rayon`, no nightly Rust, no SharedArrayBuffer, no COOP/COEP in dev. If a future use case demands parallelism, add `rayon::par_iter` to the offspring-update kernel as a small scoped addition.

### 15.3 No Molecular-Biology Vocabulary in Default UI

Words permitted: gene, allele, locus, chromosome, diploid, haploid, genotype, phenotype, meiosis, gamete, fertilization, crossover, independent assortment, recombination frequency, nondisjunction, polyploidy, dominance, codominance, heterozygous, homozygous, recessive, sex-linked, hemizygous, population, allele frequency, Hardy-Weinberg, microevolution, selection, drift, gene flow, migration, mutation, bottleneck, founder effect, fitness, adaptation, speciation, reproductive isolation, prezygotic, postzygotic, allopatric, sympatric, hybrid, hybrid zone, reinforcement, cline. All appear in Campbell 1-15 or 22-24.

Words forbidden from default UI: DNA sequence, nucleotide, codon, transcription, translation, mRNA, promoter, enhancer, regulatory gene, operon, virus (as evolving entity), and the like.

### 15.4 No Client-Side Telemetry, No Accounts

Runs entirely client-side. No FERPA concerns. No institutional IT approval required.

### 15.5 Offline Capable

PWA with navigation-passthrough service worker. ChemSim's lesson: SW intercepting navigations drops COOP/COEP in some code paths. We do not need COOP/COEP, but keeping the same SW pattern avoids future regressions.

### 15.6 Open Source, MIT Licensed

For broader impacts (grants) and adoption by peer institutions.

### 15.7 Performance Budgets

- Desktop: N=500 at 60 FPS in population tank. Generation transition under 100ms.
- Chromebook: N=100 at 30 FPS. Generation transition under 250ms.
- Mobile: N=50 at 30 FPS.
- Quest 3: N=100 at 72 FPS in population tank.

Platform-specific N caps. Concepts do not degrade, only population sizes.

### 15.8 Deterministic Mode

Seedable PCG RNG. Same seed + same parameters + same code version = bit-for-bit identical run.

### 15.9 No Em Dashes

All documentation, UI text, and comments avoid em dashes. Use commas, semicolons, colons, parentheses, or separate sentences.

### 15.10 No Anthropomorphic UI Language

No verbs of intention for creatures anywhere. "Allele frequency of B rose to 0.6," not "the fish learned to be darker." "BB homozygotes were over-represented among reproducers," not "BB wanted to win."

### 15.11 Every Stochastic Event Is Visible

Mutations draw dice icons. Migration animates the migrant. Mate-choice lottery is visible on first demonstration. Every student gets to see, not infer, the randomness.

### 15.12 Discrete Generations in v1

Overlapping generations add demography that is not in Campbell 22-24. V2 may add if curriculum expands.

---

## 16. Success Criteria

### 16.1 Organism View

- [ ] Student generates a random fish and sees a plausibly rendered creature
- [ ] Chromosome panel shows correct genotype including X-linked loci
- [ ] X-linked hemizygous pattern visible: male with one recessive X allele shows the recessive phenotype
- [ ] Hovering a gene highlights the corresponding body trait; hovering a trait highlights the gene
- [ ] Clicking a gene shows allele, dominance, phenotype channel, Campbell reference, population allele frequency
- [ ] Exporting and re-importing a genotype string produces the identical fish (modulo jitter)
- [ ] A freshman unprompted says something like "so the dark allele is dominant, and this fish has Bb, so it's dark"

### 16.2 Meiosis Theater

- [ ] Timeline steps through interphase, prophase I with synapsis and chiasmata, metaphase/anaphase I, meiosis II, haploid gametes
- [ ] Crossover events at different seeds produce visibly different gametes
- [ ] With crossover rate = 0, gametes at linked loci are parental types only (verified in unit test)
- [ ] Nondisjunction toggle produces aneuploid gametes
- [ ] Polyploidy event produces an unreduced gamete
- [ ] Fertilization assembles a zygote with exactly one chromosome from each parent at each position
- [ ] A student can articulate why crossover produces variation independent of mutation

### 16.3 Population Tank

- [ ] Hardy-Weinberg baseline: allele frequencies within 5% of initial over 50 generations at N=1000
- [ ] Pure drift at N=20: at least 7 of 10 seeds reach fixation within 200 generations
- [ ] Directional selection: favored allele rises monotonically within statistical tolerance
- [ ] Bottleneck: observed heterozygosity drops and does not self-recover
- [ ] Founder effect: new patch's allele frequencies visibly diverge from source
- [ ] Heterozygote-advantage scenario maintains both alleles at long-run equilibrium near analytical prediction
- [ ] Polyploidy event produces a reproductively isolated tetraploid lineage; diploid-tetraploid matings produce sterile triploids
- [ ] Allopatric scenario produces populations that, on barrier drop, show reduced interbreeding per configured hybrid fitness
- [ ] Hybrid-zone scenarios exhibit reinforcement, fusion, or stability per configured hybrid fitness
- [ ] VIDAS panel correctly aggregates student annotations during a guided directional-selection run
- [ ] N=500 creatures render at 60 FPS on a modern laptop

### 16.4 Accessibility and Deployment

- [ ] Full feature set operable via keyboard
- [ ] Screen reader announces current population stats, selected creature genotype, force-panel values
- [ ] App loads and runs offline after first visit
- [ ] App loads on a Chromebook with graceful reduced-N defaults

### 16.5 Pedagogy

- [ ] Pilot with General Biology II students: pre/post on CANS shows statistically significant gain
- [ ] CANS gain at least equal to Avida-ED comparison-group gain
- [ ] Students can articulate at least six misconceptions from Section 3.3 with specific sim observations that contradicted them
- [ ] Instructor post-use interview reports no novel misconception *created* by EvoSim

---

## 17. Known Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Fish mesh reads as cartoonish | High; breaks "not childish" goal | Early aesthetic review with user and two peer biology faculty. Iterate on materials, proportions, palettes before Phase 4. Reference HHMI BioInteractive. |
| SimState discipline slips; main.ts bloats | High; repeats ChemSim tech debt | CI lint caps `main.ts` at 300 lines. Any PR exceeding must refactor first. |
| Meiosis animation confusing rather than clarifying | High; pedagogical centerpiece | Storyboard before coding. Paper mockup shown to two students before implementing. Iterate. |
| Students cherry-pick favorable rewinds for assessment | Medium; undermines grading | Graded mode disables rewind. Session trace recorded for instructor review. |
| Phenotype jitter hides Mendelian ratios | Medium; creates new misconception | Per-channel jitter sigma must be small relative to between-genotype spacing. Validated in Phase 2 checkpoint. |
| Scope creep back toward ecology / Red Queen | High; blows curriculum alignment | Reject any PR or feature request that references concepts not in Campbell 1-15 or 22-24. Advanced-sandbox mode may expose extras but never in default UI. |
| Textbook edition drift (12e → 13e) changes section numbers | Low; affects references only | Keep Campbell citations in one data file (`CAMPBELL_MAP.md`). Edition update is a one-file PR. |
| N=500 with instancing hits Chromebook GPU ceiling | Medium | Auto-detect and cap N per platform. Concepts do not degrade, only population counts. |
| Preset scenarios feel too scripted | Medium; turns sim into movie | Every preset has a sandbox exit ramp to change parameters and re-run. |

---

## 18. References and Resources

### Curriculum

- Urry, L. A., Cain, M. L., Wasserman, S. A., Minorsky, P. V., & Orr, R. B. (2021). *Campbell Biology* (12th ed.). Pearson. Unit 4 (chapters 22-24) is the primary reference. Chapter 15 (Chromosomal Basis of Inheritance) is the key prior-knowledge reference.
- AAAS (2011). *Vision and Change in Undergraduate Biology Education: A Call to Action*. https://www.aaas.org/resources/vision-change-undergraduate-biology-education-call-action . Evolution is core concept #1; modeling and simulation is core competency #3.

### Pedagogy

- Berkeley Understanding Evolution: misconceptions taxonomy. https://evolution.berkeley.edu/teach-evolution/misconceptions-about-evolution/
- Gregory, T. R. (2009). Understanding Natural Selection: Essential Concepts and Common Misconceptions. *Evolution: Education and Outreach*, 2, 156-175. https://link.springer.com/article/10.1007/s12052-009-0128-1
- Coley, J. D., & Tanner, K. D. (2015). Relations between Intuitive Biological Thinking and Biological Misconceptions. *CBE-LSE*. https://www.lifescied.org/doi/10.1187/cbe.14-06-0094
- HHMI BioInteractive VIDAS framework. https://www.biointeractive.org/

### Assessment Instruments

- Anderson, D. L., Fisher, K. M., & Norman, G. J. (2002). Development and evaluation of the Conceptual Inventory of Natural Selection. https://onlinelibrary.wiley.com/doi/abs/10.1002/tea.10053
- Kalinowski, S. T., et al. (2016). Conceptual Assessment of Natural Selection (CANS). https://www.lifescied.org/doi/10.1187/cbe.15-06-0134

### Prior Art

- Avida-ED: https://avida-ed.msu.edu/ . Curriculum paper: Lark et al. 2016, https://link.springer.com/article/10.1186/s12052-016-0060-0
- SimBio EvoBeaker: https://simbio.com/products-college/Evolution
- HHMI Population Genetics Explorer: https://www.biointeractive.org/classroom-resources/population-genetics-explorer
- NetLogo BEAGLE: https://ccl.northwestern.edu/rp/beagle/

### Population Genetics Background

- Hartl, D. L., & Clark, A. G. *Principles of Population Genetics*. Sanity reference for drift timescale and fixation probability unit tests.
- Kimura, M. (1983). *The Neutral Theory of Molecular Evolution*.

### Three.js + WebXR + Rust/WASM

See ChemSim Section 14 for reusable references. EvoSim's stack is a subset (no threading).

### Companion Project

- ChemSim specification: `~/chemsim/CHEMSIM_SPEC.md`. Stack baseline and box-scaffolding reference.
- ChemSim agent notes: `~/chemsim/CLAUDE.md`. Build-invariant lessons worth reading before starting EvoSim's own `CLAUDE.md`.

---

## Appendix A: Glossary for Non-Technical Readers

- **Allele.** A version of a gene at a given locus.
- **Autosome.** A chromosome that is not a sex chromosome.
- **Cline.** A gradient in allele frequency along a spatial axis, typically produced by a gradient in selection.
- **Diploid.** Having two copies of each chromosome, one from each parent.
- **Fitness (relative).** Reproductive success of an individual relative to other individuals in the same population. Not physical strength, health, or size.
- **Gamete.** A haploid sex cell (sperm or egg).
- **Genetic drift.** Random change in allele frequencies across generations from sampling effects. Stronger effect in small populations.
- **Genotype.** The full set of alleles an individual carries.
- **Hardy-Weinberg equilibrium.** Theoretical state in which allele and genotype frequencies do not change across generations; requires large N, random mating, no selection, no mutation, no gene flow.
- **Hemizygous.** Having only one copy of a gene, as males have for X-linked loci in an XY sex-determination system.
- **Heterozygosity.** Fraction of individuals heterozygous at a given locus. A measure of genetic diversity.
- **Locus.** A specific position on a chromosome.
- **Meiosis.** The cell division that produces gametes. Halves chromosome number; shuffles alleles via crossover and independent assortment.
- **Phenotype.** The observable traits an individual exhibits, produced by the genotype (and in real biology, environment, which v1 does not model).
- **Polyploid.** Having more than two chromosome sets (triploid 3n, tetraploid 4n, and so on).
- **WASM.** WebAssembly. Near-native-speed code (here compiled from Rust) running in the browser.
