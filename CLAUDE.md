# Notes for Claude (or any coding agent working on this repo)

Read this before touching anything load-bearing. Most of it is the v1.0
setup spec translated into operational rules, plus lessons lifted from
`~/chemsim/CLAUDE.md` where they still apply. Some ChemSim rules do
**not** apply; they are called out explicitly.

---

## Project in one paragraph

EvoSim is a browser-based interactive evolution simulator built for
General Biology II lab use. Students see 3D aquatic creatures whose
phenotypes come from visible Mendelian genomes. Three linked views
(Organism, Meiosis Theater, Population Tank) share one centralized
state. Scope is pinned to Campbell Biology chapters 22-24 with 1-15
as assumed prior knowledge. See `EVOSIM_SPEC.md` for the full spec.

---

## Build invariants (do not break these)

- **Stable Rust only.** No nightly. No `-Z build-std`. No `rust-toolchain.toml`.
  EvoSim's engine is single-threaded and doesn't need wasm-bindgen-rayon.
  If you find yourself reaching for nightly, you are probably about to
  add threading. Don't. See "Departures from ChemSim" below.
- **Single-threaded WASM.** No `wasm-bindgen-rayon`. No `initThreadPool`.
  No `SharedArrayBuffer`. No `crossOriginIsolated`. Per-generation compute
  is tiny (roughly 55k simple ops at N=500); single-thread WASM runs it
  in sub-millisecond. Adding threading is solving a problem we don't have.
- **No COOP/COEP headers.** Dev server serves plain HTTP on localhost.
  HTTPS is only needed in production. If you find yourself setting
  `Cross-Origin-Opener-Policy` or `Cross-Origin-Embedder-Policy`, you
  are probably about to re-introduce threading. Don't.
- **`main.ts` is capped at 300 lines.** ChemSim's two-thousand-line
  module-level-state monolith is the one mistake this project refuses to
  repeat. A CI check enforces the cap (once CI is wired). All state
  changes route through `SimState`. No module-level `let`s in `main.ts`.
- **No em dashes.** In code, comments, UI text, docs. Use commas,
  semicolons, colons, parentheses, or new sentences.
- **No molecular-biology vocabulary in default UI.** Students have not
  covered Campbell chapters 16-21 at lab time. See EVOSIM_SPEC Section 15.3
  for the permitted/forbidden word list. "Gene," "allele," "locus,"
  "chromosome" are fine. "DNA sequence," "transcription," "mRNA,"
  "promoter" are not.
- **No anthropomorphism in UI language.** No verbs of intention for
  creatures. "Allele B rose to 0.6," not "the fish learned to be darker."

---

## Departures from ChemSim (intentional)

These rules in `~/chemsim/CLAUDE.md` do NOT apply here:

- **Rust nightly pinning via `rust-toolchain.toml`.** We use stable.
- **`.cargo/config.toml` with atomics / bulk-memory / mutable-globals /
  shared-memory linker args.** We don't need any of that.
- **`--features parallel` on wasm-pack.** Not a thing here.
- **HTTPS dev + `@vitejs/plugin-basic-ssl`.** Plain HTTP localhost is fine.
- **COOP/COEP headers on dev and preview servers.** Not needed.
- **Persistent spin-wait worker pool (`persistent_pool.rs`).** Not needed.
- **Atomics.wait latency worries.** Not needed.
- **`std::thread::spawn` caveats.** Since we don't thread at all, the
  whole discussion is moot.

ChemSim's service worker rule *does* still apply: if you add a service
worker, do not intercept navigation requests. That's a genuine browser
behavior that affects us too (though without COOP/COEP we are less
exposed to the specific failure mode).

---

## Architecture at a glance

```
src/
  main.ts                  Thin entry. HARD CAP 300 LINES. Delegates
                           everything to SimState + renderers + UI.

  state/
    SimState.ts            Centralized state + event bus. The only place
                           population, selected individual, mode, run
                           state, history, and stats live. All UI
                           mutations route through its methods.
    History.ts             Ring buffer for rewind.

  scene/
    SceneManager.ts        Three.js scene, camera, lights, view switch.
    OrganismRenderer.ts    Single fish on pedestal.
    MeiosisTheater.ts      Animated meiosis view.
    PopulationTank.ts      Aquatic box with N creatures. Reuses the
                           ChemSim box scaffolding pattern (camera,
                           volumetric feel). Not the physics.
    CreatureMesh.ts        Procedural fish mesh + phenotype-driven
                           transforms. Uses InstancedMesh for the tank.
    ChromosomePanel.ts     Banded-cylinder chromosome visualization.
    VRManager.ts           WebXR session (later phase).

  ui/
    ViewSwitcher.ts
    ForcePanel.ts          Selection regime, mutation rate, events.
    AlleleFreqChart.ts
    PhenotypeHistogram.ts
    PedigreeView.ts
    VidasPanel.ts
    StatsReadout.ts
    ScenarioLoader.ts
    TextbookRefPanel.ts    Campbell chapter citations for current scenario.
    TutorialOverlay.ts

  engine/                  Rust crate, compiled to WASM.
    Cargo.toml
    src/
      lib.rs               WASM entry points.
      creature.rs          Creature struct.
      chromosome.rs        Chromosome, Locus, Allele.
      meiosis.rs           Meiosis algorithm.
      fertilization.rs     Mating, gamete fusion.
      mutation.rs          Per-locus mutation sampling.
      fitness.rs           Fitness regimes (directional, stabilizing,
                           etc.).
      selection.rs         Survival sampling.
      mating.rs            Mating scheme logic.
      population.rs        Population struct, generation step.
      events.rs            Bottleneck, founder, polyploidy, migration.
      rng.rs               PCG seedable RNG.

  data/
    species/
      generic_fish.json    V1 archetype: XY system, 3 autosomes + 1 sex
                           chromosome, 9 autosomal + 1 X-linked loci.
    scenarios/             15 preset scenarios (see EVOSIM_SPEC §9).
    skeletons/             GLB meshes (or procedural; decide per arc).

  utils/
    constants.ts
    loader.ts
    rng_seed.ts

  wasm-pkg/                wasm-pack output (gitignored).
public/                    Static assets if needed.
scripts/
  generate_archetype.py
  validate_scenario.py
  campbell_index.py
tests/
  e2e/                     Playwright specs.
  unit/                    Vitest specs.
docs/
  STUDENT_GUIDE.md
  INSTRUCTOR_GUIDE.md
  ARCHITECTURE.md
  CAMPBELL_MAP.md          Campbell section -> scenario/feature index.
  labs/                    One markdown worksheet per scenario.
```

---

## Hot paths (where the sim actually spends time)

1. **Per-generation step** in Rust. Roughly: fitness evaluation (O(N)),
   survival sampling (O(N)), mating pair selection (O(N)), meiosis per
   pair (O(N · num_chromosomes · avg_crossovers)), fertilization (O(N)),
   mutation (O(N · num_loci)). At N=500 with 9 loci on 4 chromosomes,
   total is about 55,000 simple ops. Sub-millisecond in Rust WASM.
2. **Per-frame render** in JS. Three.js draws N creatures via
   `InstancedMesh`. Per-instance color and scale matrices. Dominant cost
   is GPU, not JS.
3. **Chart panel updates** on each generation. Use a sliding window over
   the history ring buffer. Don't re-render from scratch.

Before touching any of these, read:

- `EVOSIM_SPEC.md` §2 (architecture)
- `EVOSIM_SPEC.md` §4 (genome model)
- `EVOSIM_SPEC.md` §6 (habitat)
- This file's "Anti-patterns" section.

---

## Debug / bench hooks exposed on `globalThis.__evosim`

Plan (to be implemented as the engine lands):

```js
__evosim.state                        // SimState instance
__evosim.engine                       // Wasm Population instance
__evosim.benchGeneration(n)           // time n generation steps
__evosim.benchRender(n)               // time n render passes
__evosim.runScenario("name")          // load and run a preset
__evosim.dumpPedigree(individualId)   // print ancestry
__evosim.snapshot()                   // JSON of current state
__evosim.restoreSnapshot(obj)         // restore from JSON
```

Live under `src/main.ts` or a dedicated `src/debug.ts`; keep them
minimal and document them in this section as they exist.

---

## Patterns to follow

- **State changes route through `SimState`.** Never mutate population
  arrays, selected individual, run state, or mode from renderers or UI
  modules directly. The UI listens to SimState events; it does not own
  state.
- **Generations are atomic.** A generation step runs entirely in WASM
  and returns a new population snapshot. JS does not observe
  intermediate intra-generation state (beyond intra-generation kinematic
  motion, which is purely decorative).
- **RNG is seedable and explicit.** Anything stochastic in Rust takes a
  `&mut Rng` parameter. No `thread_rng`, no `OsRng` in the hot path. A
  reproducible run is a lab requirement, not a convenience.
- **Archetype JSON is the single source of truth for genome
  configuration.** Don't hardcode the locus table anywhere in Rust or
  TypeScript. New species get a new JSON; the engine reads it and
  allocates accordingly.
- **Fitness regime is a pure function of phenotype and gradient.**
  Given a genotype and the ambient gradient, the regime deterministically
  yields a fitness contribution. No hidden state, no history dependence.

---

## Anti-patterns (likely to break things or curriculum)

- **Adding threading, parallelism, worker pools, or SharedArrayBuffer.**
  We do not need it. If a use case arises (e.g. fast-forward 10k
  generations at N=5000), add `rayon::par_iter` scoped to the offspring
  kernel, not a persistent pool.
- **Reaching for `nightly` Rust.** You are probably about to thread.
  Don't.
- **Adding behavioral AI.** Creatures do not forage, flee, fight, or
  decide. Fitness is configured (declared), not emergent. See EVOSIM_SPEC
  §1.2 and §3.5.
- **Adding predators, prey, food, decomposers, or pathogens as
  simulated entities.** Out of scope (Campbell ecology is chs 52+).
- **Adding molecular-biology vocabulary to default UI.** Students haven't
  seen chs 16-21. See §15.3 of the spec.
- **Using emergent motion as a proxy for fitness.** Intra-generation
  motion is decorative only. Fitness must be computed from genotype
  under the configured regime.
- **Hardcoding any genome parameter.** Ploidy, chromosome count, locus
  count, allele count, cM lengths, dominance modes — all data-driven
  from the archetype JSON.
- **Caching mutable data across frames in hot paths.** If you find
  yourself adding a cache that depends on population state, make sure
  generation-step writes invalidate it.
- **Anthropomorphizing UI text.** "The fish wants..." is a bug.

---

## Common failure modes and what they mean

| Symptom | Likely cause |
|---|---|
| Wasm build error: unresolved external / target mismatch | You forgot `--target web` on wasm-pack, or pulled in a non-wasm-safe dep. Check Cargo.toml. |
| `ReferenceError: __wbindgen_...` | Wasm module not yet initialized. Await `init()` before calling engine functions. |
| Genotype-phenotype mismatch on hover | Chromosome panel state is out of sync with SimState.selectedIndividual. You probably mutated one without updating the other. Route through SimState. |
| F2 ratios off from 1:2:1 at large sample | RNG seed collision between parent and offspring arrays, or meiosis is using a non-independent stream. Check `rng.split()` discipline. |
| Hardy-Weinberg baseline drifts noticeably at N=1000 | Finite-population drift at N=1000 is real but small. If deviation > 5% in 50 gens, something in survival sampling is biased. |
| Allele frequency changes when mutation rate = 0 and selection = none | Selection-sampling bias or a mating scheme that isn't actually random. |
| `main.ts` growing past 300 lines | Refactor before adding features. Move pieces into `ui/` or `state/`. |
| Creature mesh looks cartoonish | Palette, proportions, or materials need review. Reference HHMI BioInteractive, not comic-style illustrations. See §3.8. |

---

## Things you're likely to be asked to do next

- **Implement a new scenario.** Add a JSON in `src/data/scenarios/`.
  Validate against archetype loci. Add a markdown worksheet in
  `docs/labs/`. Add an e2e test in `tests/e2e/`.
- **Add a phenotype channel.** Extend `generic_fish.json` with the new
  channel's jitter sigma and clamp range. Extend `CreatureMesh.ts` with
  the phenotype-driven transform. Add a locus that drives it if needed.
- **Add a new selection regime.** Extend `engine/src/fitness.rs` with
  the new regime enum variant + function. Expose via WASM bindings.
  Add a preset scenario and a unit test.
- **Regenerate an archetype JSON.** Run `scripts/generate_archetype.py`.
  Don't hand-edit chromosome/locus arrays when there's a generator.
- **Performance tuning.** Before optimizing, benchmark with
  `__evosim.benchGeneration(1000)`. If it's below target, profile first.
  The hottest paths are fitness eval and meiosis; check SoA layout in
  `population.rs`.

---

## Don't waste cycles on

- Making threading work. It isn't needed.
- Micro-optimizing JS render loops below N=1000. GPU is the bottleneck.
- Tuning RNG beyond PCG. It's fine.
- Adding features before the core genome + meiosis + organism view are
  working end to end.

---

## Tests

- `npm run test:unit` — Vitest on TS side + `cargo test` on Rust side.
  Rust tests cover genetics correctness (Mendelian ratios, X-linked
  patterns, linkage recombination, HW stability, drift timescale,
  selection response, heterozygote advantage equilibrium, polyploidy
  mechanics). TS tests cover archetype/scenario JSON validation.
- `npm run test:e2e` — Playwright, headless Chromium, no HTTPS (we
  don't use SharedArrayBuffer so plain HTTP works).
- `cd src/engine && cargo test` — Rust unit tests directly.

If a change touches meiosis, selection, or mating, run all three.

---

## Spec reference

`EVOSIM_SPEC.md` is the source of truth for scope and decisions. When a
decision is ambiguous, re-read the relevant spec section before writing
code. Section pointers:

- §1.2 What this is NOT
- §1.4 Target users and hardware
- §1.5 Curricular alignment (Campbell mapping)
- §2.2 Deliberate departures from ChemSim
- §3.3 Misconception-countering design rules (the table)
- §4 Genome model
- §5 Phenotype assembly
- §6 Habitat model
- §8 Evolutionary force controls
- §9 Preset scenarios
- §15 Key design decisions and constraints
