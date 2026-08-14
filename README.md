<div align="center">

# Frame Studio / frame2d

**Model 2D frames, run linear-static analysis, and inspect N / V / M — in the browser.**

React workbench · FastAPI · Python FE core

[English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md)

<br/>

<img src="photo/workbench-overview.png" alt="Frame Studio workbench overview" width="920" />

<sub>Visual modeling · reusable material and section libraries · diagrams, tables, and validation checks</sub>

</div>

---

## Quick start

**Requirements:** Python `3.11+` · Node.js `20.19+` or `22.12+` · npm<br>
**Optional:** Docker, for accounts and private model storage in MySQL

```bash
# 1. Clone the repository
git clone https://github.com/feizhang233/2D-Frame-Project.git
cd 2D-Frame-Project

# 2. Install the Python solver and API
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e ".[test]"

# 3. Install the frontend
npm --prefix frontend ci

# 4. Optional: enable registration, login, and model saving
docker compose up -d mysql

# 5. Start the UI and API together
npm run dev
```

Open in the browser:

| Service | URL |
| --- | --- |
| **Frame Studio** | http://127.0.0.1:5173 |
| Swagger UI | http://127.0.0.1:8000/docs |
| Health | http://127.0.0.1:8000/health |

`Ctrl+C` stops both development processes. MySQL keeps running in Docker; stop it with `docker compose stop mysql`.

> Docker is not required for modeling or solving. Without MySQL, the site remains usable in guest mode, but registration, login, and model saving are unavailable. Guest models are never persisted to browser storage.

> **What you see first**  
> The workbench opens with **Portal frame 01**. Click **Run Analysis** to see displacements, reactions, axial force, shear, and bending moment. More ready-to-run examples are available under **Models**.

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
| Visual modeling | SVG canvas, coordinate input, snapping, and member splitting by fraction or distance |
| Reusable properties | Material and section libraries with per-member assignment and a canvas overlay |
| Supports & loads | Fixed, pinned, roller, and inclined supports; nodal and linearly varying member loads |
| One-click analysis | Nodal displacements and reactions plus sampled axial, shear, and bending-moment fields |
| Result verification | Structural diagrams, result tables, equilibrium residuals, and stiffness-symmetry checks |
| Identity and models | Registration/login, revocable HttpOnly sessions, per-user MySQL history, and a no-save guest mode |
| API & scripting | REST endpoints, interactive OpenAPI docs, and an importable `frame2d` package |

---

## Typical workflow

1. **Node** — click the grid or type `X / Y`  
2. **Material / Section** — set `E`, `A`, `I`, Apply to members  
3. **Element** — connect two nodes; optionally insert a node and split  
4. **Support / Load** — restrain DOFs and apply loading  
5. **Run Analysis** — inspect displacement, reactions, shear, moment  
6. **Save / Models** — export JSON or restore a saved, recent, or example model

New elements start unassigned. Missing material/section blocks Save/Run and jumps you to the right panel.

---

## Analysis scope

The solver uses a two-node, prismatic Euler–Bernoulli frame element with three degrees of freedom per node: global `u`, `v`, and `φ`.

- Linear-elastic, small-displacement static analysis
- Axial and bending deformation; shear deformation is not included
- Nodal forces and moments
- Uniform or linearly varying distributed loads in element-local axes
- Fixed, pinned, roller, inclined, and non-zero prescribed support conditions
- Element recovery for displacement, rotation, axial force, shear, and bending moment
- Global residual and per-element equilibrium validation

This project is intended for learning, prototyping, and independent verification. Validate assumptions and results before using them for engineering decisions.

---

## Architecture

```mermaid
flowchart LR
    UI["React workbench"]
    API["FastAPI"]
    FEM["frame2d core"]
    PLOT["Matplotlib diagrams"]
    DB[("MySQL model store")]

    UI --> API
    API --> FEM
    FEM --> API
    API --> PLOT
    API --> UI
    API <--> DB
```

The frontend talks only to the HTTP API. The API can also serve a production build from `frontend/dist`; MySQL stores accounts, login sessions, user-owned models, and recent-analysis snapshots.

---

## Commands

| Task | Command |
| --- | --- |
| Start the UI and API | `npm run dev` |
| Start MySQL | `docker compose up -d mysql` |
| Enable backend hot reload | `FRAME2D_API_RELOAD=1 npm run dev` |
| Run Python tests | `pytest` |
| Check frontend types | `npm run typecheck` |
| Build the frontend | `npm run build` |

| Variable | Default | Purpose |
| --- | --- | --- |
| `FRAME2D_HOST` | `127.0.0.1` | Bind address |
| `FRAME2D_API_PORT` | `8000` | API port |
| `FRAME2D_FRONTEND_PORT` | `5173` | Frontend port |
| `FRAME2D_DATABASE_URL` | `mysql://frame2d:frame2d@127.0.0.1:3307/frame2d` | MySQL model store |
| `FRAME2D_COOKIE_SECURE` | auto-detected | Set to `1` behind an HTTPS reverse proxy |
| `FRAME2D_API_RELOAD` | `0` | `1` = backend reload |
| `FRAME2D_FRONTEND_DIST` | auto-detected | Production frontend directory served by FastAPI |

Separate processes:

```bash
uvicorn frame2d.api:app --host 0.0.0.0 --port 8000 --reload
npm --prefix frontend run dev
```

For a production-style local run, build the frontend first and start the installed entry point:

```bash
npm run build
frame2d-api
```

Then open http://127.0.0.1:8000.

---

## API cheat sheet

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Health |
| `POST` | `/api/v1/solve` | Solve (optional V/M plots) |
| `POST` | `/api/v1/plots/shear-force` | Shear PNG |
| `POST` | `/api/v1/plots/bending-moment` | Moment PNG |
| `GET` / `POST` / `DELETE` | `/api/v1/models` | List, save, or clear model history |
| `POST` | `/api/v1/auth/register` | Create an account and start a session |
| `POST` | `/api/v1/auth/login` | Sign in |
| `GET` | `/api/v1/auth/me` | Read the current account |
| `POST` | `/api/v1/auth/logout` | Revoke the current session |

Model endpoints require a signed-in session. Solve and plot endpoints remain public for guest use.
| `DELETE` | `/api/v1/models/{id}` | Delete one history entry |

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

Nodal loads act in global `+X / +Y`, and positive moments are counterclockwise. Distributed loads use element-local axes; local `+x` runs from node `i` to node `j`, and local `+y` is 90° counterclockwise from local `+x`. Axial force is positive in tension.

For the full derivation and sign conventions, see the [mathematical basis](Math%20Logic/2D_Frame_%E6%9C%89%E9%99%90%E5%85%83%E7%B4%A0%E6%95%B8%E5%AD%B8%E4%BE%9D%E6%93%9A.md).

---

## Layout

```text
frontend/          React + TypeScript + Vite
src/frame2d/       FE core, API, plotting
tests/             numerical & API tests
examples/          JSON / Python samples
Math Logic/        derivations
photo/             README screenshots
docker-compose.yml MySQL + API services and persistent database volume
scripts/dev.mjs    combined dev launcher
```

---

## Contributing

Issues and pull requests are welcome. Before submitting a change, run:

```bash
pytest
npm run typecheck
npm run build
```
