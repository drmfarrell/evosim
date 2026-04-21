// EvoSim entry point. HARD CAP 300 LINES (see CLAUDE.md). This file
// wires the canvas, the SimState, the archetype loader, the engine
// (WASM), and the view-specific renderers. Any logic heavier than
// wiring belongs in state/, scene/, or ui/.

import "./style.css";
import { SceneManager } from "./scene/SceneManager";
import { OrganismRenderer } from "./scene/OrganismRenderer";
import { ChromosomePanel } from "./scene/ChromosomePanel";
import { SimState } from "./state/SimState";
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

    // Start with a random creature in organism view.
    const creatureJson = engine.randomCreatureJson(0.5);
    const creature = JSON.parse(creatureJson);
    state.setSelected(creature);

    scenarioLabel.textContent = "Archetype: generic_fish";
    generationLabel.textContent = "Generation 0";

    exposeDebugHandles();
    wireViewSwitcher();
    renderStats();
  } catch (e) {
    renderError(e);
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
  if (!c) {
    statsMount.textContent = "No creature selected.";
    return;
  }
  const lines = [
    `id: ${c.id}`,
    `sex: ${c.sex}`,
    `generation: ${c.generation}`,
    `autosomes: ${c.autosomes.length}`,
    `has sex chromosomes: ${c.sex_chromosomes ? "yes" : "no"}`,
  ];
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
  // Expose for dev / testing. See CLAUDE.md "Debug / bench hooks".
  (globalThis as any).__evosim = {
    state,
    engine,
    scene,
    randomCreature: () => {
      if (!engine) return null;
      const j = engine.randomCreatureJson(0.5);
      const c = JSON.parse(j);
      state.setSelected(c);
      return c;
    },
  };
}

state.onSelected.subscribe(() => renderStats());

void boot();
