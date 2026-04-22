// EvoSim entry point. HARD CAP 300 LINES (see CLAUDE.md). This file
// wires the canvas, the SimState, the archetype + scenarios, the
// engine (WASM), and the view-specific renderers. Any logic heavier
// than wiring belongs in state/, scene/, or ui/.

import "./style.css";
import { SceneManager } from "./scene/SceneManager";
import { OrganismRenderer } from "./scene/OrganismRenderer";
import { ChromosomePanel } from "./scene/ChromosomePanel";
import { PopulationTank } from "./scene/PopulationTank";
import { MeiosisTheater } from "./scene/MeiosisTheater";
import { ForcePanel } from "./ui/ForcePanel";
import { AlleleFreqChart } from "./ui/AlleleFreqChart";
import { ScenarioDeck, Scenario } from "./ui/ScenarioDeck";
import { Commentary } from "./ui/Commentary";
import { ScenarioRunner } from "./ui/ScenarioRunner";
import { SpeedSlider } from "./ui/SpeedSlider";
import { ViewHelp } from "./ui/ViewHelp";
import { SimState, CreatureJson, Stats } from "./state/SimState";
import { loadArchetype, loadAllScenarios } from "./utils/loader";

import init, { EvoEngine } from "./wasm-pkg/evosim_engine.js";

const state = new SimState();
const canvas = document.getElementById("scene-canvas") as HTMLCanvasElement;
const chromosomeMount = document.getElementById("chromosome-panel") as HTMLElement;
const statsMount = document.getElementById("stats-readout") as HTMLElement;
const generationLabel = document.getElementById("generation-label") as HTMLElement;
const scenarioLabel = document.getElementById("scenario-label") as HTMLElement;
const scenarioDeckMount = document.getElementById("scenario-deck-mount") as HTMLElement;
const speedSliderMount = document.getElementById("speed-slider-mount") as HTMLElement;
const commentaryMount = document.getElementById("commentary-mount") as HTMLElement;
const viewHelpMount = document.getElementById("view-help-mount") as HTMLElement;

let engine: EvoEngine | null = null;
let scene: SceneManager | null = null;
let organismRenderer: OrganismRenderer | null = null;
let chromosomePanel: ChromosomePanel | null = null;
let tank: PopulationTank | null = null;
let meiosisTheater: MeiosisTheater | null = null;
let forcePanel: ForcePanel | null = null;
let alleleChart: AlleleFreqChart | null = null;
let scenarioDeck: ScenarioDeck | null = null;
let commentary: Commentary | null = null;
let scenarioRunner: ScenarioRunner | null = null;
let speedSlider: SpeedSlider | null = null;

async function boot(): Promise<void> {
  try {
    await init();
    const archetype = await loadArchetype("generic_fish");
    state.setArchetype(archetype);
    const archetypeJsonStr = JSON.stringify(archetype);
    engine = new EvoEngine(archetypeJsonStr, BigInt(Date.now()));

    scene = new SceneManager(canvas);
    organismRenderer = new OrganismRenderer(scene, state, archetype);
    chromosomePanel = new ChromosomePanel(chromosomeMount, state, archetype);
    tank = new PopulationTank(scene, state, archetype);
    commentary = new Commentary(commentaryMount);
    new ViewHelp(viewHelpMount, state);

    const panelMount = document.getElementById("force-panel-mount") as HTMLElement;
    const chartMount = document.getElementById("allele-chart-mount") as HTMLElement;
    const meiosisMount = document.getElementById("meiosis-theater-mount") as HTMLElement;

    forcePanel = new ForcePanel(panelMount, makeForceHandlers());
    alleleChart = new AlleleFreqChart(chartMount, archetype.autosomes);
    meiosisTheater = new MeiosisTheater(meiosisMount, state, archetype, (creatureJson) =>
      engine ? JSON.parse(engine.meioseJson(creatureJson)) : null
    );
    state.onView.subscribe((v) => meiosisTheater?.setVisible(v === "meiosis"));
    meiosisTheater.setVisible(state.view === "meiosis");

    scenarioRunner = new ScenarioRunner(engine as any, {
      onAfterStep: handleAfterStep,
      onStateChange: (r) => forcePanel?.setRunning(r),
    });

    const scenarios = (await loadAllScenarios()) as Scenario[];
    scenarioDeck = new ScenarioDeck(scenarioDeckMount, scenarios, runScenario);
    speedSlider = new SpeedSlider(speedSliderMount, (c) => {
      scenarioRunner?.setPeriod(c.periodMs);
      tank?.setBehaviorSpeed(c.behaviorMultiplier);
    });

    state.setSelected(JSON.parse(engine.randomCreatureJson(0.5)));
    scenarioLabel.textContent = "Pick an experiment to begin";
    updateGenerationLabel();
    wireViewSwitcher();
    renderStats();
    exposeDebugHandles();

    // Auto-start the first experiment so the landing view is alive.
    if (scenarios.length > 0) {
      runScenario(scenarios[0]);
    }
  } catch (e) {
    renderError(e);
  }
}

function runScenario(s: Scenario): void {
  if (!scenarioRunner || !scenarioDeck || !commentary) return;
  scenarioRunner.load(s);
  scenarioDeck.setActive(s.id);
  alleleChart?.reset();
  state.setView("tank");
  setActiveViewButton("tank");
  handleAfterStep();
  if (s.commentary) {
    commentary.show({
      headline: s.commentary.headline,
      observe: s.commentary.observe,
      generation: scenarioRunner.generation,
    });
  } else {
    commentary.hide();
  }
  scenarioLabel.textContent = `Experiment: ${s.title}`;
  if (s.auto_run) scenarioRunner.play();
}

function handleAfterStep(): void {
  if (!engine) return;
  const popJson = engine.populationJson();
  const creatures: CreatureJson[] = JSON.parse(popJson);
  tank?.setPopulation(creatures);
  if (creatures.length > 0) state.setSelected(creatures[0]);
  const statsJson = engine.statsJson();
  const stats: Stats = JSON.parse(statsJson);
  state.setStats(stats);
  alleleChart?.addFrame(stats.generation, stats.allele0_freq_autosomes);
  commentary?.updateGeneration(stats.generation);
  updateGenerationLabel();
}

function makeForceHandlers() {
  return {
    onPlayPause: () => {
      if (!scenarioRunner) return;
      if (scenarioRunner.isRunning) scenarioRunner.pause();
      else if (scenarioRunner.scenario) scenarioRunner.play();
    },
    onStep: () => scenarioRunner?.step(),
    onReset: () => {
      const cur = scenarioRunner?.scenario;
      if (cur) runScenario(cur);
    },
  };
}

function updateGenerationLabel(): void {
  const gen = engine?.generation() ?? 0;
  generationLabel.textContent = `Generation ${gen}`;
}

function setActiveViewButton(view: "organism" | "meiosis" | "tank"): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>(".view-btn");
  for (const b of Array.from(buttons)) {
    b.classList.toggle("active", b.dataset.view === view);
  }
}

function wireViewSwitcher(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>(".view-btn");
  for (const b of Array.from(buttons)) {
    b.addEventListener("click", () => {
      const view = b.dataset.view as "organism" | "meiosis" | "tank";
      state.setView(view);
      setActiveViewButton(view);
    });
  }
}

function renderStats(): void {
  statsMount.innerHTML = "";
  const c = state.selected;
  const s = state.stats;
  const lines: string[] = [];
  if (c) {
    lines.push(`selected creature: id ${c.id}, ${c.sex}, gen ${c.generation}`);
  }
  if (s) {
    lines.push(`population N: ${s.n}`);
    lines.push(`mean fitness: ${s.mean_fitness.toFixed(3)}`);
    lines.push(`H_obs: ${s.observed_heterozygosity.toFixed(3)}`);
    lines.push(`H_exp: ${s.expected_heterozygosity.toFixed(3)}`);
  }
  if (lines.length === 0) {
    statsMount.textContent = "Pick an experiment.";
    return;
  }
  statsMount.innerHTML = lines.map((l) => `<div>${l}</div>`).join("");
}

function renderError(e: unknown): void {
  const msg = e instanceof Error ? e.message : String(e);
  const el = document.createElement("pre");
  el.textContent = `boot error: ${msg}`;
  el.style.color = "var(--bad)";
  el.style.padding = "12px";
  el.style.whiteSpace = "pre-wrap";
  document.body.appendChild(el);
  console.error(e);
}

function exposeDebugHandles(): void {
  (globalThis as any).__evosim = {
    state,
    engine,
    scene,
    scenarioRunner,
    scenarioDeck,
    runScenario,
  };
}

state.onSelected.subscribe(() => renderStats());
state.onStats.subscribe(() => renderStats());

void boot();
