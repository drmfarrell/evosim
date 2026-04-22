// SpeedSlider: two knobs in one control.
//   - Generation tick rate: how often a new generation is sampled,
//     from 1 gen / 2 seconds ("slow") to 1 gen / 40ms ("turbo").
//   - Behavior speed multiplier: how fast fish swim toward food,
//     court, etc. Defaults tie to tick rate so "slow" shows natural
//     behavior and "fast" accelerates everything.
//
// Pedagogy: at slow speeds, students see each generation fully;
// behavior is visible (fish seek food, occasionally court). At fast
// speeds, generations stream by and students watch the chart trend.

export type SpeedChange = {
  periodMs: number;
  behaviorMultiplier: number;
  label: string;
};

export type SpeedHandler = (c: SpeedChange) => void;

const STOPS: Array<{ label: string; periodMs: number; behavior: number }> = [
  { label: "Slow",   periodMs: 2000, behavior: 0.5 },
  { label: "Normal", periodMs: 700,  behavior: 1.0 },
  { label: "Fast",   periodMs: 200,  behavior: 2.0 },
  { label: "Turbo",  periodMs: 40,   behavior: 4.0 },
];

export class SpeedSlider {
  private root: HTMLElement;
  private input: HTMLInputElement;
  private label: HTMLElement;

  constructor(mount: HTMLElement, private onChange: SpeedHandler, initialStop: number = 1) {
    this.root = mount;
    this.root.className = "speed-slider";
    this.root.innerHTML = `
      <div class="speed-header">
        <div class="speed-title">Simulation speed</div>
        <div class="speed-label"></div>
      </div>
      <input type="range" min="0" max="${STOPS.length - 1}" step="1" value="${initialStop}" />
      <div class="speed-ticks">
        ${STOPS.map((s) => `<span>${s.label}</span>`).join("")}
      </div>
    `;
    this.input = this.root.querySelector("input") as HTMLInputElement;
    this.label = this.root.querySelector(".speed-label") as HTMLElement;
    this.input.addEventListener("input", () => this.emit());
    // Fire an initial event so the runner picks up the default.
    queueMicrotask(() => this.emit());
  }

  private emit(): void {
    const i = Math.max(0, Math.min(STOPS.length - 1, Number(this.input.value)));
    const s = STOPS[i];
    this.label.textContent = s.label;
    this.onChange({
      periodMs: s.periodMs,
      behaviorMultiplier: s.behavior,
      label: s.label,
    });
  }
}
