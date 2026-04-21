# EvoSim

Interactive 3D evolution simulator for undergraduate General Biology II laboratory use.

Students manipulate a population of aquatic organisms with visible Mendelian genomes, observe allele frequencies shift under selection, drift, mutation, and gene flow, watch meiosis happen on screen, and run end-to-end scenarios covering every sub-concept in Campbell Biology chapters 22 through 24.

## Status

Early development. See `EVOSIM_SPEC.md` for the v1.0 specification and `CLAUDE.md` for coding-agent notes.

## Stack

- TypeScript + Vite
- Three.js (3D rendering, WebXR)
- Rust compiled to WebAssembly (single-threaded, stable Rust)
- Playwright for end-to-end tests, Vitest for TypeScript unit tests, `cargo test` for Rust unit tests

## Getting started

```bash
npm install
npm run build:wasm
npm run dev
```

Open `http://localhost:3000` in a modern browser.

## License

MIT. See `LICENSE`.
