// Meiosis theater (v0): shows a selected parent's diploid chromosomes
// and the haploid gamete products after one meiosis event. Each click
// of "Run meiosis" samples a fresh meiosis and highlights the
// crossover-introduced recombinant segments.
//
// v1 will animate the phases; v0 is a static two-panel before/after
// view that makes the outcome legible while we ship the rest.

import { SimState, CreatureJson } from "../state/SimState";

const ALLELE_PALETTE = [
  "#d7443b",
  "#f0b429",
  "#2fa86a",
  "#3a86ff",
  "#8a4fff",
  "#d4606f",
  "#79c9c0",
  "#e3b341",
];

export type MeiosisCallback = (creatureJson: string) => any; // returns gamete JSON

export class MeiosisTheater {
  private root: HTMLElement;
  private archetype: any;
  private gameteEl: HTMLElement;
  private parentEl: HTMLElement;
  private unsubs: Array<() => void> = [];
  private lastGamete: any = null;

  constructor(
    mount: HTMLElement,
    private state: SimState,
    archetype: any,
    private meioseFn: MeiosisCallback
  ) {
    this.archetype = archetype;
    this.root = mount;
    this.root.innerHTML = "";
    this.root.className = "meiosis-theater";

    const controls = document.createElement("div");
    controls.className = "theater-controls";
    const runBtn = document.createElement("button");
    runBtn.className = "force-btn primary";
    runBtn.textContent = "Run meiosis";
    runBtn.addEventListener("click", () => this.run());
    controls.appendChild(runBtn);
    this.root.appendChild(controls);

    const parentBlock = document.createElement("div");
    parentBlock.className = "theater-block";
    const parentHeader = document.createElement("div");
    parentHeader.className = "force-section-title";
    parentHeader.textContent = "Parent (diploid)";
    parentBlock.appendChild(parentHeader);
    this.parentEl = document.createElement("div");
    parentBlock.appendChild(this.parentEl);
    this.root.appendChild(parentBlock);

    const gameteBlock = document.createElement("div");
    gameteBlock.className = "theater-block";
    const gameteHeader = document.createElement("div");
    gameteHeader.className = "force-section-title";
    gameteHeader.textContent = "Gamete (haploid)";
    gameteBlock.appendChild(gameteHeader);
    this.gameteEl = document.createElement("div");
    gameteBlock.appendChild(this.gameteEl);
    this.root.appendChild(gameteBlock);

    const key = document.createElement("div");
    key.className = "force-section-title";
    key.style.marginTop = "12px";
    key.textContent = "Yellow bands on the gamete mark alleles that came from the opposite homolog of the parent (crossover recombinants).";
    this.root.appendChild(key);

    this.unsubs.push(state.onSelected.subscribe((c) => this.renderParent(c)));
    this.renderParent(state.selected);
  }

  private renderParent(c: CreatureJson | null): void {
    this.parentEl.innerHTML = "";
    if (!c) {
      this.parentEl.textContent = "Select a creature to meiose.";
      return;
    }
    for (const [ci, spec] of ((this.archetype.autosomes ?? []) as any[]).entries()) {
      const pair = c.autosomes[ci];
      if (!pair) continue;
      this.parentEl.appendChild(this.renderChr(spec, pair.maternal, pair.paternal));
    }
  }

  private renderChr(spec: any, m: number[], p: number[], recombMask?: boolean[]): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "chromosome";
    const label = document.createElement("div");
    label.className = "chromosome-label";
    label.textContent = spec.name;
    wrap.appendChild(label);
    const pairDiv = document.createElement("div");
    pairDiv.className = "homolog-pair";
    pairDiv.appendChild(this.renderHomolog(spec, m, recombMask));
    pairDiv.appendChild(this.renderHomolog(spec, p, recombMask));
    wrap.appendChild(pairDiv);
    return wrap;
  }

  private renderHomolog(spec: any, alleles: number[], recombMask?: boolean[]): HTMLElement {
    const hom = document.createElement("div");
    hom.className = "homolog";
    const loci = spec.loci ?? [];
    for (let li = 0; li < loci.length; li++) {
      const a = alleles[li] ?? 255;
      const band = document.createElement("div");
      band.className = "locus-band";
      const pos = spec.length_cm > 0 ? loci[li].position_cm / spec.length_cm : 0;
      band.style.left = `${pos * 100}%`;
      band.style.background = a === 255 ? "#7f8a99" : ALLELE_PALETTE[a % ALLELE_PALETTE.length];
      if (recombMask && recombMask[li]) {
        band.style.boxShadow = "0 0 0 2px #f0b429";
      }
      hom.appendChild(band);
    }
    return hom;
  }

  private run(): void {
    const c = this.state.selected;
    if (!c) return;
    const gamete = this.meioseFn(JSON.stringify(c));
    this.lastGamete = gamete;
    this.renderGamete(c, gamete);
  }

  private renderGamete(parent: CreatureJson, gamete: any): void {
    this.gameteEl.innerHTML = "";
    const autosomes = this.archetype.autosomes ?? [];
    for (let ci = 0; ci < autosomes.length; ci++) {
      const spec = autosomes[ci];
      const parentPair = parent.autosomes[ci];
      const gAlleles: number[] = gamete.autosomes[ci] ?? [];
      // Recombinant mask: a locus is "recombinant" if the allele on
      // the gamete isn't equal to either homolog (shouldn't happen) or
      // if it changed side relative to the start of the chromosome.
      // For v0 we just highlight loci where the gamete carries an
      // allele differing from the chosen "reference" homolog: pick
      // the first locus's source and flag disagreements relative to
      // that one.
      const mask = computeRecombMask(parentPair?.maternal ?? [], parentPair?.paternal ?? [], gAlleles);
      const wrap = document.createElement("div");
      wrap.className = "chromosome";
      const label = document.createElement("div");
      label.className = "chromosome-label";
      label.textContent = spec.name;
      wrap.appendChild(label);
      const holder = document.createElement("div");
      holder.className = "homolog-pair";
      holder.appendChild(this.renderHomolog(spec, gAlleles, mask));
      wrap.appendChild(holder);
      this.gameteEl.appendChild(wrap);
    }
    if (gamete.sex_chromosome_name && gamete.sex_chromosome_alleles) {
      const header = document.createElement("div");
      header.className = "chromosome-label";
      header.textContent = `sex chromosome: ${gamete.sex_chromosome_name}`;
      this.gameteEl.appendChild(header);
    }
  }

  setVisible(v: boolean): void {
    this.root.style.display = v ? "block" : "none";
  }

  dispose(): void {
    for (const u of this.unsubs) u();
  }
}

function computeRecombMask(m: number[], p: number[], g: number[]): boolean[] {
  // Reference: the "source" homolog of the first locus. Any locus
  // whose gamete allele matches the other homolog instead is flagged
  // as a crossover-recombinant for visualization purposes.
  const mask: boolean[] = [];
  if (g.length === 0) return mask;
  // Determine starting homolog: which one does locus 0 match?
  const startsOnM = g[0] === (m[0] ?? 255);
  const startsOnP = g[0] === (p[0] ?? 255);
  // If alleles are identical at a locus we default to "same side".
  let onM = startsOnM || !startsOnP;
  for (let i = 0; i < g.length; i++) {
    const mi = m[i] ?? 255;
    const pi = p[i] ?? 255;
    const gi = g[i];
    if (mi === pi) {
      mask.push(false);
      continue;
    }
    const nowOnM = gi === mi;
    if (nowOnM !== onM) {
      mask.push(true);
      onM = nowOnM;
    } else {
      mask.push(false);
    }
  }
  return mask;
}
