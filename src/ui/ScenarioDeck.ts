// ScenarioDeck: the front door for students. A column of scenario
// cards, each with a title, one-line description, and a Play button.
// Clicking Play loads the scenario and kicks off auto-run via the
// supplied handler.

export type Scenario = {
  id: string;
  order?: number;
  title: string;
  short_desc: string;
  campbell_ref?: string;
  archetype: string;
  initial_population: { N: number; allele_frequencies?: Record<string, number> };
  selection_regime: string;
  mutation_rate: number;
  mating_scheme?: string;
  events?: Array<{ type: string; generation: number; new_size?: number }>;
  auto_run?: boolean;
  commentary?: { headline: string; observe: string };
};

export class ScenarioDeck {
  private root: HTMLElement;
  private activeId: string | null = null;

  constructor(
    mount: HTMLElement,
    private scenarios: Scenario[],
    private onPlay: (s: Scenario) => void
  ) {
    this.root = mount;
    this.render();
  }

  private render(): void {
    this.root.innerHTML = "";
    this.root.className = "scenario-deck";

    const header = document.createElement("div");
    header.className = "deck-header";
    header.innerHTML = `
      <div class="deck-title">Experiments</div>
      <div class="deck-subtitle">Click one to start. You can pause, step, or pick another at any time.</div>
    `;
    this.root.appendChild(header);

    const list = document.createElement("div");
    list.className = "deck-list";
    const ordered = [...this.scenarios].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    for (const s of ordered) {
      list.appendChild(this.makeCard(s));
    }
    this.root.appendChild(list);
  }

  private makeCard(s: Scenario): HTMLElement {
    const card = document.createElement("div");
    card.className = "deck-card";
    card.dataset.scenarioId = s.id;

    const body = document.createElement("div");
    body.className = "deck-card-body";
    body.innerHTML = `
      <div class="deck-card-title">${escapeHtml(s.title)}</div>
      <div class="deck-card-desc">${escapeHtml(s.short_desc)}</div>
      ${s.campbell_ref ? `<div class="deck-card-ref">${escapeHtml(s.campbell_ref)}</div>` : ""}
    `;
    card.appendChild(body);

    const btn = document.createElement("button");
    btn.className = "deck-card-play";
    btn.textContent = "▶ Run";
    btn.addEventListener("click", () => {
      this.setActive(s.id);
      this.onPlay(s);
    });
    card.appendChild(btn);

    return card;
  }

  setActive(id: string | null): void {
    this.activeId = id;
    const cards = this.root.querySelectorAll<HTMLElement>(".deck-card");
    for (const c of Array.from(cards)) {
      c.classList.toggle("active", c.dataset.scenarioId === id);
    }
  }

  get active(): string | null {
    return this.activeId;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
