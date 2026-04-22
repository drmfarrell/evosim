// ViewHelp: a one-line description of the current view that appears at
// the top of the scene area. Tells students what they're looking at
// and what they can do here. Visible in all views.

import type { SimState, ViewMode } from "../state/SimState";

const MESSAGES: Record<ViewMode, { headline: string; action: string }> = {
  organism: {
    headline: "One fish, its full genome on the right.",
    action:
      "Hover a gene band → the trait it controls lights up on the fish. Switch to Population Tank to run an experiment.",
  },
  meiosis: {
    headline: "Parent chromosomes above, gamete below.",
    action:
      "Click Run meiosis to see one gamete this parent could produce. Yellow highlights mark loci where crossover shuffled a parental allele.",
  },
  tank: {
    headline: "The whole population across generations.",
    action:
      "Pick an experiment on the right. Click Play to advance generations. Watch the allele-frequency chart below the scenario list.",
  },
};

export class ViewHelp {
  private root: HTMLElement;
  private headlineEl: HTMLElement;
  private actionEl: HTMLElement;
  private unsubs: Array<() => void> = [];

  constructor(mount: HTMLElement, private state: SimState) {
    this.root = mount;
    this.root.className = "view-help";
    this.root.innerHTML = `
      <div class="view-help-headline"></div>
      <div class="view-help-action"></div>
    `;
    this.headlineEl = this.root.querySelector(".view-help-headline") as HTMLElement;
    this.actionEl = this.root.querySelector(".view-help-action") as HTMLElement;
    this.unsubs.push(state.onView.subscribe((v) => this.render(v)));
    this.render(state.view);
  }

  private render(v: ViewMode): void {
    const m = MESSAGES[v];
    if (!m) return;
    this.headlineEl.textContent = m.headline;
    this.actionEl.textContent = m.action;
  }

  dispose(): void {
    for (const u of this.unsubs) u();
  }
}
