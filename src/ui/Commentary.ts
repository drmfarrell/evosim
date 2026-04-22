// Commentary: a floating banner that tells the student what experiment
// is running and what to observe. Intentionally terse; students read
// this, then look at the scene.

export type CommentaryState = {
  headline: string;
  observe: string;
  generation: number;
};

export class Commentary {
  private root: HTMLElement;
  private headlineEl: HTMLElement;
  private observeEl: HTMLElement;
  private genEl: HTMLElement;

  constructor(mount: HTMLElement) {
    this.root = mount;
    this.root.className = "commentary hidden";
    this.root.innerHTML = `
      <div class="commentary-row">
        <div class="commentary-headline"></div>
        <div class="commentary-gen"></div>
      </div>
      <div class="commentary-observe"></div>
    `;
    this.headlineEl = this.root.querySelector(".commentary-headline") as HTMLElement;
    this.observeEl = this.root.querySelector(".commentary-observe") as HTMLElement;
    this.genEl = this.root.querySelector(".commentary-gen") as HTMLElement;
  }

  show(state: CommentaryState): void {
    this.root.classList.remove("hidden");
    this.headlineEl.textContent = state.headline;
    this.observeEl.textContent = `Observe: ${state.observe}`;
    this.genEl.textContent = `Generation ${state.generation}`;
  }

  updateGeneration(g: number): void {
    this.genEl.textContent = `Generation ${g}`;
    // Brief flash so each new generation is visible.
    this.genEl.classList.remove("tick");
    // Re-reading offsetWidth forces a reflow so the animation restarts.
    void this.genEl.offsetWidth;
    this.genEl.classList.add("tick");
  }

  hide(): void {
    this.root.classList.add("hidden");
  }
}
