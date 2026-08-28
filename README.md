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
| **Heat treatment** — TTT diagrams for 1080/5140/4340 steels with a cooling-rate slider read by Scheil additivity, predicted phase fractions and hardness, and a Jominy end-quench comparison | ✅ available |
| **Material Selection (Ashby)** — log–log property chart of 54 materials with movable performance-index guide lines (E/ρ, E^½/ρ, E^⅓/ρ, σ/ρ, σ^⅔/ρ) and live ranking | ✅ available |
| **XRD Simulator** — powder diffraction patterns for SC/BCC/FCC/diamond-cubic samples across four X-ray sources, with indexed peak table, structure overlay, and an extinction panel | ✅ available |

Modules are grouped in the header by where they sit in a materials course — Structure, Microstructure, Properties, Analysis.

The app opens on a landing page introducing the nine modules; each card links straight
into one. `#/trends` is the periodic table.

## Sharing a view

Every module is linkable, and so is what it is showing. The URL carries the state that
changes the result, so a worked example can be handed over as a link:

| Link | Shows |
|---|---|
| `#/heattreat?rate=1200&steel=4340` | 4340 quenched at 1200 °C/s |
| `#/miller?plane=110&s=bcc&sigma=90` | (110) in a BCC cell, 90 MPa applied |
| `#/phase?T=200&sys=pb-sn&x=40` | Pb–40 wt% Sn at 200 °C |
| `#/trends?el=W&prop=melt` | the table coloured by melting point, tungsten selected |

View controls that only change how the same result is drawn — bond display, auto-rotate,
elastic zoom — stay out of the URL, so a shared link stays short and says something.
Values outside a control's range are clamped to it, and an unrecognised module or value
falls back rather than failing, so an edited link still lands somewhere useful.

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
