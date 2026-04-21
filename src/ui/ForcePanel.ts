// ForcePanel: controls for evolutionary forces. v1 ships with just the
// basics needed to run the HW baseline and directional-selection
// scenarios: play/pause/step, mutation rate, and a regime dropdown.
// Additional controls (bottleneck, founder, polyploidy, migration,
// assortative mating) accrue in later phases per EVOSIM_SPEC §8.

export type ForceState = {
  running: boolean;
  mutationRate: number;
  regime: string;
};

export type ForceHandlers = {
  onPlayPause: () => void;
  onStep: () => void;
  onRegimeChange: (regime: string) => void;
  onMutationRateChange: (rate: number) => void;
  onInitPopulation: (n: number) => void;
};

export class ForcePanel {
  private root: HTMLElement;

  constructor(mount: HTMLElement, private handlers: ForceHandlers, regimes: string[]) {
    this.root = mount;
    this.render(regimes);
  }

  private render(regimes: string[]): void {
    this.root.innerHTML = "";
    this.root.className = "force-panel";

    const section = (title: string) => {
      const s = document.createElement("div");
      s.className = "force-section";
      const h = document.createElement("div");
      h.className = "force-section-title";
      h.textContent = title;
      s.appendChild(h);
      this.root.appendChild(s);
      return s;
    };

    const runSec = section("Run");
    const playBtn = document.createElement("button");
    playBtn.className = "force-btn primary";
    playBtn.id = "play-pause-btn";
    playBtn.textContent = "Play";
    playBtn.addEventListener("click", () => {
      this.handlers.onPlayPause();
    });
    runSec.appendChild(playBtn);
    const stepBtn = document.createElement("button");
    stepBtn.className = "force-btn";
    stepBtn.id = "step-btn";
    stepBtn.textContent = "Step +1";
    stepBtn.addEventListener("click", () => this.handlers.onStep());
    runSec.appendChild(stepBtn);

    const popSec = section("Population");
    const init50 = this.button("Init N=50", () => this.handlers.onInitPopulation(50));
    const init200 = this.button("Init N=200", () => this.handlers.onInitPopulation(200));
    popSec.appendChild(init50);
    popSec.appendChild(init200);

    const selSec = section("Selection regime");
    const sel = document.createElement("select");
    sel.className = "force-select";
    sel.id = "regime-select";
    for (const r of regimes) {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r;
      sel.appendChild(opt);
    }
    sel.value = regimes[0] ?? "neutral";
    sel.addEventListener("change", () => this.handlers.onRegimeChange(sel.value));
    selSec.appendChild(sel);

    const mutSec = section("Mutation rate (per locus per generation)");
    const rateRow = document.createElement("div");
    rateRow.className = "force-row";
    const range = document.createElement("input");
    range.type = "range";
    range.min = "0";
    range.max = "50";
    range.value = "10";
    range.id = "mut-range";
    const label = document.createElement("span");
    label.className = "force-readout";
    label.textContent = "1.0e-4";
    range.addEventListener("input", () => {
      const v = Number(range.value) / 10;
      const rate = v === 0 ? 0 : Math.pow(10, -5 + v);
      label.textContent = rate.toExponential(1);
      this.handlers.onMutationRateChange(rate);
    });
    rateRow.appendChild(range);
    rateRow.appendChild(label);
    mutSec.appendChild(rateRow);
  }

  setRunning(r: boolean): void {
    const btn = this.root.querySelector<HTMLButtonElement>("#play-pause-btn");
    if (btn) btn.textContent = r ? "Pause" : "Play";
  }

  private button(text: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement("button");
    b.className = "force-btn";
    b.textContent = text;
    b.addEventListener("click", onClick);
    return b;
  }
}
