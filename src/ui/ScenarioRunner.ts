// ScenarioRunner: given a Scenario description, drives the engine
// through the scenario. Handles events (bottleneck, recovery),
// auto-stepping with a configurable period, pause/resume.

import type { Scenario } from "./ScenarioDeck";

export type EngineHandle = {
  initPopulationBiallelic(n: number, freq: number): void;
  bottleneckTo(n: number): void;
  stepWithRegime(regime: string, mutationRate: number): void;
  stepWithTarget(regime: string, mutationRate: number, targetOffspring: number): void;
  populationSize(): number;
  generation(): number;
};

export type ScenarioRunnerHandlers = {
  onAfterStep: () => void;
  onStateChange?: (running: boolean) => void;
};

export class ScenarioRunner {
  private engine: EngineHandle;
  private current: Scenario | null = null;
  private timer: number | null = null;
  private targetSize: number = 0;
  private periodMs: number = 700;

  constructor(engine: EngineHandle, private handlers: ScenarioRunnerHandlers) {
    this.engine = engine;
  }

  load(scenario: Scenario): void {
    this.stop();
    this.current = scenario;
    const freq = scenario.initial_population.allele_frequencies?.default ?? 0.5;
    this.engine.initPopulationBiallelic(scenario.initial_population.N, freq);
    this.targetSize = scenario.initial_population.N;
    this.handlers.onAfterStep();
  }

  /** Change the tick rate; restarts the timer if currently running. */
  setPeriod(periodMs: number): void {
    this.periodMs = Math.max(20, periodMs);
    if (this.timer != null) {
      clearInterval(this.timer);
      this.timer = window.setInterval(() => this.step(), this.periodMs);
    }
  }

  play(periodMs?: number): void {
    if (this.timer != null) return;
    if (!this.current) return;
    if (periodMs != null) this.periodMs = periodMs;
    this.timer = window.setInterval(() => this.step(), this.periodMs);
    this.handlers.onStateChange?.(true);
  }

  pause(): void {
    if (this.timer == null) return;
    clearInterval(this.timer);
    this.timer = null;
    this.handlers.onStateChange?.(false);
  }

  stop(): void {
    this.pause();
    this.current = null;
  }

  step(): void {
    if (!this.current) return;
    const gen = this.engine.generation();
    const events = this.current.events ?? [];

    // Apply events scheduled for this generation BEFORE stepping.
    for (const e of events) {
      if (e.generation !== gen) continue;
      if (e.type === "bottleneck" && e.new_size != null) {
        this.engine.bottleneckTo(e.new_size);
        this.targetSize = e.new_size;
      } else if (e.type === "recovery" && e.new_size != null) {
        this.targetSize = e.new_size;
      }
    }

    try {
      this.engine.stepWithTarget(
        this.current.selection_regime,
        this.current.mutation_rate,
        this.targetSize
      );
    } catch (e) {
      console.error("scenario step failed:", e);
      this.pause();
    }
    this.handlers.onAfterStep();
  }

  get isRunning(): boolean {
    return this.timer != null;
  }

  get scenario(): Scenario | null {
    return this.current;
  }

  get generation(): number {
    return this.engine.generation();
  }
}
