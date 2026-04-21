// Chromosome panel: renders autosome pairs + sex-chromosome pair as
// banded cylinders (HTML + inline SVG/CSS). Loci are bands colored by
// allele. Hover a band to drive the organism-view highlight.

import { SimState, CreatureJson } from "../state/SimState";

type Archetype = any;

const ALLELE_PALETTE = [
  "#d7443b", // red
  "#f0b429", // amber
  "#2fa86a", // green
  "#3a86ff", // blue
  "#8a4fff", // violet
  "#7f8a99", // gray (unknown / 255)
];

export class ChromosomePanel {
  private root: HTMLElement;
  private unsubs: Array<() => void> = [];

  constructor(
    mount: HTMLElement,
    private state: SimState,
    private archetype: Archetype
  ) {
    this.root = mount;
    this.root.innerHTML = "";
    this.unsubs.push(state.onSelected.subscribe((c) => this.render(c)));
    this.render(state.selected);
  }

  private render(c: CreatureJson | null): void {
    this.root.innerHTML = "";
    if (!c) {
      const empty = document.createElement("div");
      empty.textContent = "No creature selected.";
      empty.style.color = "var(--muted)";
      this.root.appendChild(empty);
      return;
    }

    const header = document.createElement("div");
    header.style.fontSize = "11px";
    header.style.textTransform = "uppercase";
    header.style.letterSpacing = "0.08em";
    header.style.color = "var(--muted)";
    header.style.marginBottom = "8px";
    header.textContent = `Genome (${c.sex}, gen ${c.generation})`;
    this.root.appendChild(header);

    // Autosomes.
    const autosomes = this.archetype.autosomes ?? [];
    for (let ci = 0; ci < autosomes.length; ci++) {
      const spec = autosomes[ci];
      const pair = c.autosomes[ci];
      if (!pair) continue;
      this.root.appendChild(this.renderChromosome(spec, pair.maternal, pair.paternal));
    }

    // Sex chromosomes.
    const sc = this.archetype.sex_chromosome;
    const pair = c.sex_chromosomes;
    if (sc && pair) {
      const larger = {
        name: sc.larger_name,
        length_cm: sc.larger_length_cm,
        loci: sc.larger_loci ?? [],
      };
      const smaller = {
        name: sc.smaller_name,
        length_cm: sc.smaller_length_cm,
        loci: sc.smaller_loci ?? [],
      };

      // Render based on sex.
      if (pair.maternal_larger && pair.paternal_larger) {
        this.root.appendChild(
          this.renderChromosome(larger, pair.maternal_larger, pair.paternal_larger)
        );
      } else if (pair.maternal_larger && !pair.paternal_larger) {
        // XY male: one X (maternal), one Y (smaller from paternal)
        this.root.appendChild(
          this.renderSexPair(larger, smaller, pair.maternal_larger, pair.smaller ?? [])
        );
      } else if (!pair.maternal_larger && pair.paternal_larger) {
        // ZW female: one Z (paternal), one W (smaller maternal)
        this.root.appendChild(
          this.renderSexPair(larger, smaller, pair.paternal_larger, pair.smaller ?? [])
        );
      }
    }
  }

  private renderChromosome(spec: any, m: number[], p: number[]): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "chromosome";

    const label = document.createElement("div");
    label.className = "chromosome-label";
    label.textContent = spec.name;
    wrap.appendChild(label);

    const pair = document.createElement("div");
    pair.className = "homolog-pair";

    const mat = this.renderHomolog(spec, m);
    const pat = this.renderHomolog(spec, p);
    pair.appendChild(mat);
    pair.appendChild(pat);
    wrap.appendChild(pair);

    // Locus labels below (first homolog only, to avoid duplication).
    const labelRow = document.createElement("div");
    labelRow.style.position = "relative";
    labelRow.style.height = "14px";
    for (const locus of spec.loci ?? []) {
      const pos = spec.length_cm > 0 ? locus.position_cm / spec.length_cm : 0;
      const el = document.createElement("span");
      el.className = "locus-label";
      el.style.left = `${pos * 100}%`;
      el.textContent = locus.name;
      labelRow.appendChild(el);
    }
    wrap.appendChild(labelRow);
    return wrap;
  }

  private renderSexPair(
    larger: any,
    smaller: any,
    largerAlleles: number[],
    smallerAlleles: number[]
  ): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "chromosome";

    const label = document.createElement("div");
    label.className = "chromosome-label";
    label.textContent = `${larger.name}/${smaller.name}`;
    wrap.appendChild(label);

    const pair = document.createElement("div");
    pair.className = "homolog-pair";
    pair.appendChild(this.renderHomolog(larger, largerAlleles));
    pair.appendChild(this.renderHomolog(smaller, smallerAlleles));
    wrap.appendChild(pair);

    const labelRow = document.createElement("div");
    labelRow.style.position = "relative";
    labelRow.style.height = "14px";
    for (const locus of larger.loci ?? []) {
      const pos = larger.length_cm > 0 ? locus.position_cm / larger.length_cm : 0;
      const el = document.createElement("span");
      el.className = "locus-label";
      el.style.left = `${pos * 100}%`;
      el.textContent = locus.name;
      labelRow.appendChild(el);
    }
    wrap.appendChild(labelRow);
    return wrap;
  }

  private renderHomolog(spec: any, alleles: number[]): HTMLElement {
    const hom = document.createElement("div");
    hom.className = "homolog";
    const loci = spec.loci ?? [];
    for (let li = 0; li < loci.length; li++) {
      const locus = loci[li];
      const a = alleles[li] ?? 255;
      const band = document.createElement("div");
      band.className = "locus-band";
      const pos = spec.length_cm > 0 ? locus.position_cm / spec.length_cm : 0;
      band.style.left = `${pos * 100}%`;
      band.style.background = colorForAllele(a);
      band.title = `${locus.name}: allele ${locus.alleles?.[a] ?? "?"}`;
      band.dataset.locus = locus.name;
      band.dataset.channel = locus.phenotype_channel;
      band.addEventListener("mouseenter", () => {
        this.state.setHoverLocus(locus.phenotype_channel);
        this.highlightBandsFor(locus.phenotype_channel);
      });
      band.addEventListener("mouseleave", () => {
        this.state.setHoverLocus(null);
        this.highlightBandsFor(null);
      });
      hom.appendChild(band);
    }
    return hom;
  }

  private highlightBandsFor(channel: string | null): void {
    const bands = this.root.querySelectorAll<HTMLElement>(".locus-band");
    for (const b of Array.from(bands)) {
      if (channel != null && b.dataset.channel === channel) {
        b.classList.add("highlight");
      } else {
        b.classList.remove("highlight");
      }
    }
  }

  dispose(): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];
  }
}

function colorForAllele(a: number): string {
  if (a === 255 || a === undefined) return "#7f8a99";
  return ALLELE_PALETTE[a % ALLELE_PALETTE.length];
}
