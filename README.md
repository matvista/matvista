# MatVista

**Interactive visual toolkit for materials science — periodic trends, crystal structures, phase diagrams.**

MatVista gives students and material scientists visual, interactive views onto materials data. It grows module by module, and each module stands alone as a tool you can teach with, study from, or use for quick reference.

## Modules

| Module | Status |
|---|---|
| **Periodic Trends Explorer** — heatmap periodic table; color 118 elements by electronegativity, ionization energy, electron affinity, melting/boiling point, density, or atomic mass | ✅ available |
| **Crystal Structure Viewer** — 3D unit cells for 8 structures (SC, FCC, BCC, HCP, diamond cubic, rock salt, CsCl, perovskite); ball-and-stick or space-filling, coordination-shell highlighting, and a live theoretical-density calculator | ✅ available |
| **Miller Indices & Slip Systems** — type any (hkl) or [uvw] and see the plane cut the cell in 3D, with the reciprocal construction, d-spacing, family members, and a Schmid-factor ranking over all 12 FCC / 48 BCC slip systems | ✅ available |
| **Defects & diffusion** — point-defect visualiser, equilibrium-vacancy calculator, and a case-hardening simulator solving Fick's second law | ✅ available |
| **Mechanical properties** — engineering stress–strain curves for 7 metals with the 0.002 offset construction, resilience, true-stress overlay, and a Hall–Petch grain-size panel | ✅ available |
| **Phase Diagram Explorer** — interactive Cu–Ni, Pb–Sn and Fe–Fe₃C diagrams; click any point for phases, tie line, lever-rule fractions and steel microstructure | ✅ available |
| **Material Selection (Ashby)** — log–log property chart of 54 materials with movable performance-index guide lines (E/ρ, E^½/ρ, E^⅓/ρ, σ/ρ, σ^⅔/ρ) and live ranking | ✅ available |
| **XRD Simulator** — powder diffraction patterns for SC/BCC/FCC/diamond-cubic samples across four X-ray sources, with indexed peak table, structure overlay, and an extinction panel | ✅ available |

Planned modules and their data requirements are tracked in [ROADMAP.md](ROADMAP.md).

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Stack

- [Vite](https://vite.dev/) + [React](https://react.dev/) + TypeScript
- No chart library — visualizations are hand-rolled DOM/SVG for full control
- Element data derived from [Periodic-Table-JSON](https://github.com/Bowserinator/Periodic-Table-JSON) (CC-BY-SA)

## Contributing

Issues and PRs welcome. Each module lives in `src/components/`; shared data in `src/data/`. Keep modules self-contained so they stand alone as teaching tools.

## License

[MIT](LICENSE)
