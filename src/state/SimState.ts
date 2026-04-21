// Centralized simulation state + event bus.
// This is the single place that holds population data, selected
// individual, view mode, run state, history, and stats. All UI
// mutations must go through its methods. See CLAUDE.md.

export type ViewMode = "organism" | "meiosis" | "tank";

export type CreatureJson = {
  id: number;
  sex: "male" | "female" | "hermaphrodite";
  generation: number;
  autosomes: Array<{
    maternal: number[];
    paternal: number[];
  }>;
  sex_chromosomes?: {
    maternal_larger: number[] | null;
    paternal_larger: number[] | null;
    smaller: number[] | null;
  } | null;
  mother_id?: number | null;
  father_id?: number | null;
};

export type ArchetypeJson = unknown; // Opaque on the JS side; pass-through.

export type Stats = {
  generation: number;
  n: number;
  mean_fitness: number;
  observed_heterozygosity: number;
  expected_heterozygosity: number;
  allele0_freq_autosomes: number[][];
};

type Listener<T> = (next: T, previous: T) => void;

class Emitter<T> {
  private listeners: Set<Listener<T>> = new Set();
  emit(next: T, previous: T): void {
    for (const fn of this.listeners) fn(next, previous);
  }
  subscribe(fn: Listener<T>): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export class SimState {
  private _view: ViewMode = "organism";
  private _archetype: ArchetypeJson | null = null;
  private _selected: CreatureJson | null = null;
  private _selectedHoverLocus: string | null = null;
  private _running: boolean = false;
  private _stats: Stats | null = null;

  readonly onView = new Emitter<ViewMode>();
  readonly onArchetype = new Emitter<ArchetypeJson | null>();
  readonly onSelected = new Emitter<CreatureJson | null>();
  readonly onHoverLocus = new Emitter<string | null>();
  readonly onRunning = new Emitter<boolean>();
  readonly onStats = new Emitter<Stats | null>();

  get view(): ViewMode {
    return this._view;
  }
  setView(v: ViewMode): void {
    if (v === this._view) return;
    const prev = this._view;
    this._view = v;
    this.onView.emit(v, prev);
  }

  get archetype(): ArchetypeJson | null {
    return this._archetype;
  }
  setArchetype(a: ArchetypeJson | null): void {
    const prev = this._archetype;
    this._archetype = a;
    this.onArchetype.emit(a, prev);
  }

  get selected(): CreatureJson | null {
    return this._selected;
  }
  setSelected(c: CreatureJson | null): void {
    const prev = this._selected;
    this._selected = c;
    this.onSelected.emit(c, prev);
  }

  get hoverLocus(): string | null {
    return this._selectedHoverLocus;
  }
  setHoverLocus(name: string | null): void {
    const prev = this._selectedHoverLocus;
    this._selectedHoverLocus = name;
    this.onHoverLocus.emit(name, prev);
  }

  get running(): boolean {
    return this._running;
  }
  setRunning(r: boolean): void {
    const prev = this._running;
    this._running = r;
    this.onRunning.emit(r, prev);
  }

  get stats(): Stats | null {
    return this._stats;
  }
  setStats(s: Stats | null): void {
    const prev = this._stats;
    this._stats = s;
    this.onStats.emit(s, prev);
  }
}
