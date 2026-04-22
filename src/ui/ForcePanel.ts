// ForcePanel: minimal run controls for the active scenario.
// v1 ships: Play/Pause, Step +1, Reset.
// Scenario selection + parameters live on the ScenarioDeck cards so
// students don't have to juggle two control surfaces.

export type ForceHandlers = {
  onPlayPause: () => void;
  onStep: () => void;
  onReset: () => void;
};

export class ForcePanel {
  private root: HTMLElement;
  private playBtn: HTMLButtonElement | null = null;

  constructor(mount: HTMLElement, private handlers: ForceHandlers) {
    this.root = mount;
    this.render();
  }

  private render(): void {
    this.root.innerHTML = "";
    this.root.className = "force-panel";

    const section = document.createElement("div");
    section.className = "force-section";
    const title = document.createElement("div");
    title.className = "force-section-title";
    title.textContent = "Run controls";
    section.appendChild(title);

    const play = document.createElement("button");
    play.className = "force-btn primary";
    play.id = "play-pause-btn";
    play.textContent = "▶ Play";
    play.addEventListener("click", () => this.handlers.onPlayPause());
    this.playBtn = play;
    section.appendChild(play);

    const step = document.createElement("button");
    step.className = "force-btn";
    step.id = "step-btn";
    step.textContent = "Step +1";
    step.addEventListener("click", () => this.handlers.onStep());
    section.appendChild(step);

    const reset = document.createElement("button");
    reset.className = "force-btn";
    reset.id = "reset-btn";
    reset.textContent = "Reset";
    reset.addEventListener("click", () => this.handlers.onReset());
    section.appendChild(reset);

    this.root.appendChild(section);
  }

  setRunning(r: boolean): void {
    if (this.playBtn) this.playBtn.textContent = r ? "❚❚ Pause" : "▶ Play";
  }
}
