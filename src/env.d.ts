// Type declarations for non-TS imports used across the app.

declare module "*.css";
declare module "*.json";
declare module "*.glsl";

declare module "./wasm-pkg/evosim_engine.js" {
  export default function init(input?: any): Promise<any>;

  export class EvoEngine {
    constructor(archetypeJson: string, seed: bigint);
    archetypeJson(): string;
    initPopulationBiallelic(n: number, freqAllele0: number): void;
    populationJson(): string;
    creatureJson(idx: number): string;
    randomCreatureJson(freqAllele0: number): string;
    phenotypeJson(creatureJson: string): string;
    meioseJson(creatureJson: string): string;
    stepNeutral(mutationRate: number): void;
    stepWithRegime(regime: string, mutationRate: number): void;
    stepWithTarget(regime: string, mutationRate: number, targetOffspring: number): void;
    bottleneckTo(n: number): void;
    regimeNames(): string[];
    statsJson(): string;
    generation(): number;
    populationSize(): number;
  }
}
