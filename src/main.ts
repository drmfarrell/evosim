// EvoSim entry point. HARD CAP 300 LINES (see CLAUDE.md). This file
// wires the canvas, the SimState, the archetype loader, the engine
// (WASM), and the view-specific renderers. Any logic heavier than
// wiring belongs in state/, scene/, or ui/.

import "./style.css";
import { SceneManager } from "./scene/SceneManager";
import { OrganismRenderer } from "./scene/OrganismRenderer";
import { ChromosomePanel } from "./scene/ChromosomePanel";
import { PopulationTank } from "./scene/PopulationTank";
import { MeiosisTheater } from "./scene/MeiosisTheater";
import { ForcePanel } from "./ui/ForcePanel";
import { AlleleFreqChart } from "./ui/AlleleFreqChart";
import { SimState, CreatureJson, Stats } from "./state/SimState";
import { loadArchetype } from "./utils/loader";

import init, { EvoEngine } from "./wasm-pkg/evosim_engine.js";

const state = new SimState();
const canvas = document.getElementById("scene-canvas") as HTMLCanvasElement;
const chromosomeMount = document.getElementById("chromosome-panel") as HTMLElement;
const statsMount = document.getElementById("stats-readout") as HTMLElement;
const generationLabel = document.getElementById("generation-label") as HTMLElement;
const scenarioLabel = document.getElementById("scenario-label") as HTMLElement;

let engine: EvoEngine | null = null;
let scene: SceneManager | null = null;
let organismRenderer: OrganismRenderer | null = null;
let chromosomePanel: ChromosomePanel | null = null;
let tank: PopulationTank | null = null;
let meiosisTheater: MeiosisTheater | null = null;
let forcePanel: ForcePanel | null = null;
let alleleChart: AlleleFreqChart | null = null;
let selectedRegime = "neutral";
let mutationRate = 1e-4;
let runInterval: number | null = null;

async function boot(): Promise<void> {
  try {
    await init();
    const archetype = await loadArchetype("generic_fish");
    state.setArchetype(archetype);
    const archetypeJsonStr = JSON.stringify(archetype);
    engine = new EvoEngine(archetypeJsonStr, BigInt(Date.now()));
    const regimes = ["neutral", ...engine.regimeNames().filter((r) => r !== "neutral")];

    scene = new SceneManager(canvas);
    organismRenderer = new OrganismRenderer(scene, state, archetype);
    chromosomePanel = new ChromosomePanel(chromosomeMount, state, archetype);
    tank = new PopulationTank(scene, state, archetype);

    const panelMount = document.createElement("div");
    panelMount.id = "force-panel-mount";
    const chartMount = document.createElement("div");
    chartMount.id = "allele-chart-mount";
    const meiosisMount = document.createElement("div");
    meiosisMount.id = "meiosis-theater-mount";
    const sidePanel = document.getElementById("side-panel") as HTMLElement;
    sidePanel.appendChild(meiosisMount);
    sidePanel.appendChild(panelMount);
    sidePanel.appendChild(chartMount);

    forcePanel = new ForcePanel(panelMount, makeForceHandlers(), regimes);
    alleleChart = new AlleleFreqChart(chartMount, archetype.autosomes);
    meiosisTheater = new MeiosisTheater(meiosisMount, state, archetype, (creatureJson) => {
      if (!engine) return null;
      const gameteJson = engine.meioseJson(creatureJson);
      return JSON.parse(gameteJson);
    });
    state.onView.subscribe((v) => meiosisTheater?.setVisible(v === "meiosis"));
    meiosisTheater.setVisible(state.view === "meiosis");

    const creatureJson = engine.randomCreatureJson(0.5);
    state.setSelected(JSON.parse(creatureJson));

    scenarioLabel.textContent = "Archetype: generic_fish";
    updateGenerationLabel();
    exposeDebugHandles();
    wireViewSwitcher();
    renderStats();
  } catch (e) {
    renderError(e);
  }
}

function makeForceHandlers() {
  return {
    onPlayPause: () => {
      state.setRunning(!state.running);
      if (state.running) startRunLoop();
      else stopRunLoop();
      forcePanel?.setRunning(state.running);
    },
    onStep: () => {
      stepOne();
    },
    onRegimeChange: (r: string) => {
      selectedRegime = r;
    },
    onMutationRateChange: (r: number) => {
      mutationRate = r;
    },
    onInitPopulation: (n: number) => {
      if (!engine) return;
      engine.initPopulationBiallelic(n, 0.5);
      syncPopulation();
      alleleChart?.reset();
      recordFrame();
      state.setView("tank");
      activateTankView();
    },
  };
}

function stepOne(): void {
  if (!engine) return;
  try {
    engine.stepWithRegime(selectedRegime, mutationRate);
    syncPopulation();
    recordFrame();
    updateGenerationLabel();
  } catch (e) {
    renderError(e);
    stopRunLoop();
  }
}

function startRunLoop(): void {
  if (runInterval != null) return;
  runInterval = window.setInterval(() => stepOne(), 250);
}

function stopRunLoop(): void {
  if (runInterval != null) {
    clearInterval(runInterval);
    runInterval = null;
  }
}

function syncPopulation(): void {
  if (!engine || !tank) return;
  const popJson = engine.populationJson();
  const creatures: CreatureJson[] = JSON.parse(popJson);
  tank.setPopulation(creatures);
  if (creatures.length > 0) {
    state.setSelected(creatures[0]);
  }
}

function recordFrame(): void {
  if (!engine || !alleleChart) return;
  const statsJson = engine.statsJson();
  const s: Stats = JSON.parse(statsJson);
  state.setStats(s);
  alleleChart.addFrame(s.generation, s.allele0_freq_autosomes);
}

function updateGenerationLabel(): void {
  const gen = engine?.generation() ?? 0;
  generationLabel.textContent = `Generation ${gen}`;
}

function activateTankView(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>(".view-btn");
  for (const b of Array.from(buttons)) {
    b.classList.toggle("active", b.dataset.view === "tank");
  }
}

function wireViewSwitcher(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>(".view-btn");
  for (const b of Array.from(buttons)) {
    b.addEventListener("click", () => {
      const view = b.dataset.view as "organism" | "meiosis" | "tank";
      state.setView(view);
      for (const other of Array.from(buttons)) {
        other.classList.toggle("active", other === b);
      }
    });
  }
}

function renderStats(): void {
  statsMount.innerHTML = "";
  const c = state.selected;
  const s = state.stats;
  const lines: string[] = [];
  if (c) {
    lines.push(`id: ${c.id}`);
    lines.push(`sex: ${c.sex}`);
    lines.push(`generation: ${c.generation}`);
  }
  if (s) {
    lines.push(`N: ${s.n}`);
    lines.push(`mean fitness: ${s.mean_fitness.toFixed(3)}`);
    lines.push(`H_obs: ${s.observed_heterozygosity.toFixed(3)}`);
    lines.push(`H_exp: ${s.expected_heterozygosity.toFixed(3)}`);
  }
  if (lines.length === 0) {
    statsMount.textContent = "No creature selected.";
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
    stepOne,
  };
}

state.onSelected.subscribe(() => renderStats());
state.onStats.subscribe(() => renderStats());

void boot();
