<div align="center">

# Frame Studio / frame2d

**Draw 2D frames, run linear-static analysis, and inspect N / V / M — in the browser.**

React workbench · FastAPI · Python FE core

[English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md)

<br/>

<img src="photo/workbench-overview.png" alt="Frame Studio workbench overview" width="920" />

<sub>Out of the box: canvas modeling · material / section libraries · result tables & diagrams</sub>

</div>

---

## Get running in 60 seconds

**Requirements:** Python `3.11+` · Node.js `20.19+` or `22.12+` · npm

```bash
# 1. Clone
git clone https://github.com/feizhang233/Frame-Studio.git 2D-Frame-Project
cd 2D-Frame-Project

# 2. Python env + solver
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e ".[test]"

# 3. Frontend deps
npm --prefix frontend install

# 4. One command: UI + API
npm run dev
```

Open in the browser:

| Service | URL |
| --- | --- |
| **Frame Studio** | http://127.0.0.1:5173 |
| Swagger UI | http://127.0.0.1:8000/docs |
| Health | http://127.0.0.1:8000/health |

`Ctrl+C` stops both processes.

> **What you see first**  
> Built-in example **Portal frame 01** (portal frame + uniform load). Click **Run Analysis** — Results shows displacements, reactions, axial force, shear, and bending moment.

---

## Screenshots

### Modeling workbench

Tool rail follows the workflow: nodes → materials → sections → elements → supports → loads.  
Edit properties on the left; pick, drag, and zoom on the canvas.

<p align="center">
  <img src="photo/workbench-overview.png" alt="Modeling and material library" width="880" />
</p>

### Shear & moment results

After analysis, expand Results for structural diagrams and per-element envelopes.

<p align="center">
  <img src="photo/shear-force-results.png" alt="Shear force results" width="880" />
</p>

<p align="center">
  <img src="photo/bending-moment-results.png" alt="Bending moment results" width="880" />
</p>

---

## Features

| Area | What you get |
| --- | --- |
| Visual modeling | SVG canvas; coordinate input; split members at a fraction or distance |
| Material / section libraries | Dropdown definitions; assign to elements; **More details** map on canvas |
| Supports & loads | Fixed / pin / roller presets; nodal forces/moments; distributed loads |
| One-click solve | Linear static: displacements, reactions, `N / V / M` fields |
| Result checks | Diagrams + tables; residual & stiffness-symmetry validation |
| Model history | MySQL saved models + recent analyses + example browser |
| API & scripting | REST + Swagger + importable `frame2d` package |

---

## Typical workflow

1. **Node** — click the grid or type `X / Y`  
2. **Material / Section** — set `E`, `A`, `I`, Apply to members  
3. **Element** — connect two nodes; optionally insert a node and split  
4. **Support / Load** — restrain DOFs and apply loading  
5. **Run Analysis** — inspect displacement, reactions, shear, moment  
6. **Save / Models** — export JSON or restore from history / examples  

New elements start unassigned. Missing material/section blocks Save/Run and jumps you to the right panel.

---

## Architecture

```mermaid
flowchart LR
    UI["React workbench"]
    API["FastAPI"]
    FEM["frame2d core"]
    DB[("MySQL model store")]

    UI --> API
    API --> FEM
    FEM --> API
    API --> UI
    API <--> DB
```

---

## Commands

```bash
docker compose up -d mysql           # start MySQL once
npm run dev                          # UI + API
FRAME2D_API_RELOAD=1 npm run dev     # also reload Python

pytest
npm run typecheck
npm run build
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `FRAME2D_HOST` | `127.0.0.1` | Bind address |
| `FRAME2D_API_PORT` | `8000` | API port |
| `FRAME2D_FRONTEND_PORT` | `5173` | Frontend port |
| `FRAME2D_DATABASE_URL` | `mysql://frame2d:frame2d@127.0.0.1:3307/frame2d` | MySQL model store |
| `FRAME2D_API_RELOAD` | `0` | `1` = backend reload |

Separate processes:

```bash
uvicorn frame2d.api:app --host 0.0.0.0 --port 8000 --reload
npm --prefix frontend run dev
```

---

## API cheat sheet

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Health |
| `POST` | `/api/v1/solve` | Solve (optional V/M plots) |
| `POST` | `/api/v1/plots/shear-force` | Shear PNG |
| `POST` | `/api/v1/plots/bending-moment` | Moment PNG |
| `GET/POST/DELETE` | `/api/v1/models` | Model history |

```bash
curl -X POST http://127.0.0.1:8000/api/v1/solve \
  -H "Content-Type: application/json" \
  --data-binary @examples/cantilever_request.json \
  --output result.json
```

---

## Python library

```python
from frame2d import FrameElement, NodalLoad, Node, Support, solve_frame

result = solve_frame(
    nodes=[Node(1, 0.0, 0.0), Node(2, 2.0, 0.0)],
    elements=[FrameElement(1, 1, 2, E=210e9, A=3e-3, I=8e-6)],
    supports=[Support(1, u=True, v=True, phi=True)],
    nodal_loads=[NodalLoad(2, fy=-10_000.0)],
)

print(result.nodal_displacements)
print(result.elements[0].fields.bending_moment)
```

---

## Units (SI examples)

| Quantity | Unit | Quantity | Unit |
| --- | --- | --- | --- |
| Length / displacement | `m` | Elastic modulus | `Pa` |
| Rotation | `rad` | Area / second moment | `m²` / `m⁴` |
| Force / N / V | `N` | Moment / M | `N·m` |
| Distributed load | `N/m` | | |

Nodal loads: global `+X / +Y`; positive moment counterclockwise. Distributed loads follow element-local axes. Axial force positive in tension.  
See the [mathematical basis](Math%20Logic/2D_Frame_%E6%9C%89%E9%99%90%E5%85%83%E7%B4%A0%E6%95%B8%E5%AD%B8%E4%BE%9D%E6%93%9A.md).

---

## Layout

```text
photo/             UI screenshots for this README
frontend/          React + TypeScript + Vite
src/frame2d/       FE core, API, plotting
tests/             numerical & API tests
examples/          JSON / Python samples
Math Logic/        derivations
docker-compose.yml MySQL + API services and persistent database volume
scripts/dev.mjs    combined dev launcher
```

---

## Contributing

Issues and PRs welcome. Before submitting:

```bash
pytest && npm run typecheck
```
