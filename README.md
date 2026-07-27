# MatVista

**Interactive visual toolkit for materials science — periodic trends, crystal structures, phase diagrams.**

MatVista gives students and material scientists visual, interactive views onto materials data. It grows module by module, and each module stands alone as a tool you can teach with, study from, or use for quick reference.

## Modules

| Module | Status |
|---|---|
| **Periodic Trends Explorer** — heatmap periodic table; color 118 elements by electronegativity, ionization energy, electron affinity, melting/boiling point, density, or atomic mass | ✅ available |
| **Crystal Structure Viewer** — 3D unit cells (FCC, BCC, HCP, diamond, rock salt, perovskite) with defect modes | 🔜 planned |
| **Phase Diagram Explorer** — interactive binary diagrams with live lever-rule calculation | 🔜 planned |
| **Ashby Charts** — log-log property scatter plots for material selection | 🔜 planned |
| **Materials Project integration** — browse 150k+ computed materials | 💡 roadmap |

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
