// A minimal canvas line chart of per-locus allele-0 frequency over
// generations. One line per locus; colors follow the archetype locus
// order for consistency with the chromosome panel.

type Frame = { generation: number; freqs: number[][] }; // per chromosome, per locus, allele-0 freq

export class AlleleFreqChart {
  private root: HTMLElement;
  private canvas: HTMLCanvasElement;
  private history: Frame[] = [];
  private maxGenerations = 400;
  private locusLabels: string[] = [];

  constructor(mount: HTMLElement, archetypeAutosomes: Array<{ loci: Array<{ name: string }> }>) {
    this.root = mount;
    this.root.innerHTML = "";
    this.root.className = "allele-freq-chart";

    const title = document.createElement("div");
    title.className = "force-section-title";
    title.textContent = "Allele frequency (locus 0 allele)";
    this.root.appendChild(title);

    this.canvas = document.createElement("canvas");
    this.canvas.width = 340;
    this.canvas.height = 160;
    this.canvas.style.width = "100%";
    this.canvas.style.height = "160px";
    this.canvas.style.background = "#0a0e15";
    this.canvas.style.border = "1px solid #2a323e";
    this.root.appendChild(this.canvas);

    for (const chr of archetypeAutosomes) {
      for (const locus of chr.loci) {
        this.locusLabels.push(locus.name);
      }
    }

    this.draw();
  }

  addFrame(generation: number, freqs: number[][]): void {
    this.history.push({ generation, freqs });
    if (this.history.length > this.maxGenerations) {
      this.history.shift();
    }
    this.draw();
  }

  reset(): void {
    this.history = [];
    this.draw();
  }

  private draw(): void {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // axes
    ctx.strokeStyle = "#263040";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const y = (h - 20) * (i / 4) + 5;
      ctx.moveTo(30, y);
      ctx.lineTo(w - 5, y);
    }
    ctx.stroke();

    // Y labels
    ctx.fillStyle = "#7f8a99";
    ctx.font = "10px ui-monospace, SFMono-Regular, monospace";
    const ylabels = ["1.0", "0.75", "0.5", "0.25", "0.0"];
    for (let i = 0; i <= 4; i++) {
      const y = (h - 20) * (i / 4) + 10;
      ctx.fillText(ylabels[i], 2, y);
    }

    if (this.history.length < 2) return;

    const firstGen = this.history[0].generation;
    const lastGen = this.history[this.history.length - 1].generation;
    const genSpan = Math.max(1, lastGen - firstGen);

    const palette = [
      "#d7443b",
      "#f0b429",
      "#2fa86a",
      "#3a86ff",
      "#8a4fff",
      "#d4606f",
      "#79c9c0",
      "#e3b341",
      "#9d6af3",
    ];

    const numChr = this.history[0].freqs.length;
    let lineIdx = 0;
    for (let ci = 0; ci < numChr; ci++) {
      const numLoci = this.history[0].freqs[ci].length;
      for (let li = 0; li < numLoci; li++) {
        ctx.strokeStyle = palette[lineIdx % palette.length];
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let h_i = 0; h_i < this.history.length; h_i++) {
          const frame = this.history[h_i];
          const f = frame.freqs[ci]?.[li] ?? 0.5;
          const x = 30 + ((frame.generation - firstGen) / genSpan) * (w - 35);
          const y = (h - 20) * (1 - f) + 5;
          if (h_i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        lineIdx++;
      }
    }

    // X label (generations).
    ctx.fillStyle = "#7f8a99";
    ctx.fillText(`gen ${firstGen}`, 30, h - 4);
    ctx.fillText(`gen ${lastGen}`, w - 50, h - 4);
  }
}
