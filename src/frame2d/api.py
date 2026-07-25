"""FastAPI application for the frame2d solver."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Annotated, Any, Literal

import numpy as np
from fastapi import FastAPI, HTTPException, Query, Request, Response, status
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field

from .models import DistributedLoad, FrameElement, NodalLoad, Node, Support
from .history_store import ModelHistoryStore
from .plotting import (
    png_data_uri,
    render_bending_moment_plot,
    render_shear_force_plot,
)
from .solver import FrameAnalysisResult, solve_frame


def _frontend_dist() -> Path | None:
    """Locate a production frontend build if one is available."""
    configured = os.environ.get("FRAME2D_FRONTEND_DIST", "").strip()
    candidates = []
    if configured:
        candidates.append(Path(configured))
    # src/frame2d/api.py -> project root / frontend / dist
    candidates.append(Path(__file__).resolve().parents[2] / "frontend" / "dist")
    for path in candidates:
        if path.is_dir() and (path / "index.html").is_file():
            return path
    return None

PositiveInt = Annotated[int, Field(strict=True, gt=0)]
FiniteFloat = Annotated[float, Field(allow_inf_nan=False)]


class ApiModel(BaseModel):
    """Shared strict request/response behavior."""

    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class NodeInput(ApiModel):
    id: PositiveInt
    x: FiniteFloat
    y: FiniteFloat


class ElementInput(ApiModel):
    id: PositiveInt
    node_i: PositiveInt
    node_j: PositiveInt
    E: Annotated[float, Field(gt=0.0, allow_inf_nan=False)]
    A: Annotated[float, Field(gt=0.0, allow_inf_nan=False)]
    I: Annotated[float, Field(gt=0.0, allow_inf_nan=False)]


class SupportInput(ApiModel):
    node_id: PositiveInt
    u: bool = False
    v: bool = False
    phi: bool = False
    u_value: FiniteFloat = 0.0
    v_value: FiniteFloat = 0.0
    phi_value: FiniteFloat = 0.0
    angle: FiniteFloat = 0.0


class NodalLoadInput(ApiModel):
    node_id: PositiveInt
    fx: FiniteFloat = 0.0
    fy: FiniteFloat = 0.0
    mz: FiniteFloat = 0.0


class DistributedLoadInput(ApiModel):
    element_id: PositiveInt
    qx_i: FiniteFloat = 0.0
    qy_i: FiniteFloat = 0.0
    qx_j: FiniteFloat = 0.0
    qy_j: FiniteFloat = 0.0


class SolveRequest(ApiModel):
    nodes: list[NodeInput] = Field(min_length=1)
    elements: list[ElementInput] = Field(min_length=1)
    supports: list[SupportInput] = Field(default_factory=list)
    nodal_loads: list[NodalLoadInput] = Field(default_factory=list)
    distributed_loads: list[DistributedLoadInput] = Field(default_factory=list)
    number_of_points: Annotated[int, Field(strict=True, ge=2, le=2001)] = 101
    deformation_scale: FiniteFloat = 1.0
    include_plots: bool = True
    plot_dpi: Annotated[int, Field(strict=True, ge=72, le=300)] = 140


class HealthResponse(ApiModel):
    status: str


class ModelHistoryEntry(ApiModel):
    id: str = Field(min_length=1, max_length=160)
    name: str = Field(min_length=1, max_length=300)
    savedAt: str = Field(min_length=1, max_length=80)
    source: Literal["saved", "analyzed"]
    model: dict[str, Any]


class NodalDisplacementOutput(ApiModel):
    node_id: int
    u: float
    v: float
    phi: float


class NodalReactionOutput(ApiModel):
    node_id: int
    fx: float
    fy: float
    mz: float


class ElementFieldsOutput(ApiModel):
    x_local: list[float]
    axial_displacement: list[float]
    transverse_displacement: list[float]
    rotation: list[float]
    axial_force: list[float]
    shear_force: list[float]
    bending_moment: list[float]
    x_global: list[float]
    y_global: list[float]
    x_deformed: list[float]
    y_deformed: list[float]


class ElementValidationOutput(ApiModel):
    axial_residual: float
    shear_residual: float
    moment_residual: float
    maximum_normalized_residual: float
    passed: bool


class ElementResultOutput(ApiModel):
    element_id: int
    length: float
    direction_cosine_x: float
    direction_cosine_y: float
    local_displacements: list[float]
    local_end_forces: list[float]
    fields: ElementFieldsOutput
    validation: ElementValidationOutput


class GlobalValidationOutput(ApiModel):
    stiffness_symmetry_ratio: float
    free_dof_residual_ratio: float
    passed: bool


class PlotOutput(ApiModel):
    filename: str
    media_type: str
    data_uri: str


class PlotSetOutput(ApiModel):
    shear_force_v: PlotOutput
    bending_moment_m: PlotOutput


class SolveResponse(ApiModel):
    displacement_dof_order: str
    force_dof_order: str
    free_dofs: list[int]
    restrained_dofs: list[int]
    nodal_displacements: list[NodalDisplacementOutput]
    nodal_reactions: list[NodalReactionOutput]
    elements: list[ElementResultOutput]
    validation: GlobalValidationOutput
    plots: PlotSetOutput | None


app = FastAPI(
    title="frame2d API",
    version="0.2.0",
    description=(
        "二维刚架线性静力分析 API；返回节点位移、反力、单元 N/V/M，"
        "并可生成 V、M 折线图。"
    ),
)


@app.exception_handler(ValueError)
@app.exception_handler(TypeError)
@app.exception_handler(np.linalg.LinAlgError)
async def invalid_model_handler(
    request: Request,
    exception: Exception,
) -> JSONResponse:
    """Return invalid or unstable structural models as client errors."""
    del request
    return JSONResponse(status_code=422, content={"detail": str(exception)})


def _solve(payload: SolveRequest) -> FrameAnalysisResult:
    return solve_frame(
        nodes=[Node(**item.model_dump()) for item in payload.nodes],
        elements=[FrameElement(**item.model_dump()) for item in payload.elements],
        supports=[Support(**item.model_dump()) for item in payload.supports],
        nodal_loads=[NodalLoad(**item.model_dump()) for item in payload.nodal_loads],
        distributed_loads=[
            DistributedLoad(**item.model_dump()) for item in payload.distributed_loads
        ],
        number_of_points=payload.number_of_points,
        deformation_scale=payload.deformation_scale,
    )


def _fields_dict(fields: object) -> dict[str, list[float]]:
    names = (
        "x_local",
        "axial_displacement",
        "transverse_displacement",
        "rotation",
        "axial_force",
        "shear_force",
        "bending_moment",
        "x_global",
        "y_global",
        "x_deformed",
        "y_deformed",
    )
    return {name: getattr(fields, name).tolist() for name in names}


def _response_dict(
    result: FrameAnalysisResult,
    payload: SolveRequest,
) -> dict:
    nodal_displacements = [
        {
            "node_id": index + 1,
            "u": float(row[0]),
            "v": float(row[1]),
            "phi": float(row[2]),
        }
        for index, row in enumerate(result.nodal_displacements)
    ]
    nodal_reactions = [
        {
            "node_id": index + 1,
            "fx": float(row[0]),
            "fy": float(row[1]),
            "mz": float(row[2]),
        }
        for index, row in enumerate(result.reactions.reshape((-1, 3)))
    ]
    elements = [
        {
            "element_id": element.element_id,
            "length": element.geometry.L,
            "direction_cosine_x": element.geometry.c,
            "direction_cosine_y": element.geometry.s,
            "local_displacements": element.local_displacements.tolist(),
            "local_end_forces": element.local_end_forces.tolist(),
            "fields": _fields_dict(element.fields),
            "validation": {
                "axial_residual": element.validation.axial_residual,
                "shear_residual": element.validation.shear_residual,
                "moment_residual": element.validation.moment_residual,
                "maximum_normalized_residual": (
                    element.validation.maximum_normalized_residual
                ),
                "passed": element.validation.passed,
            },
        }
        for element in result.elements
    ]

    plots = None
    if payload.include_plots:
        shear_png = render_shear_force_plot(result.elements, dpi=payload.plot_dpi)
        moment_png = render_bending_moment_plot(result.elements, dpi=payload.plot_dpi)
        plots = {
            "shear_force_v": {
                "filename": "shear_force_v.png",
                "media_type": "image/png",
                "data_uri": png_data_uri(shear_png),
            },
            "bending_moment_m": {
                "filename": "bending_moment_m.png",
                "media_type": "image/png",
                "data_uri": png_data_uri(moment_png),
            },
        }

    return {
        "displacement_dof_order": (
            "global [u, v, phi] per node; support partition uses local "
            "[u', v', phi] at inclined supports"
        ),
        "force_dof_order": "[Fx, Fy, Mz] per node",
        "free_dofs": result.free_dofs.tolist(),
        "restrained_dofs": result.restrained_dofs.tolist(),
        "nodal_displacements": nodal_displacements,
        "nodal_reactions": nodal_reactions,
        "elements": elements,
        "validation": {
            "stiffness_symmetry_ratio": result.validation.stiffness_symmetry_ratio,
            "free_dof_residual_ratio": result.validation.free_dof_residual_ratio,
            "passed": result.validation.passed,
        },
        "plots": plots,
    }


@app.get("/", include_in_schema=False, response_model=None)
def root() -> FileResponse | dict[str, str]:
    dist = _frontend_dist()
    if dist is not None:
        return FileResponse(dist / "index.html")
    return {
        "name": "frame2d API",
        "health": "/health",
        "docs": "/docs",
        "openapi": "/openapi.json",
    }


@app.get("/health", response_model=HealthResponse, tags=["system"])
def health() -> HealthResponse:
    return HealthResponse(status="ok")


@app.get(
    "/api/v1/models",
    response_model=list[ModelHistoryEntry],
    tags=["models"],
)
def list_models() -> list[dict[str, Any]]:
    """Return the latest model snapshots stored in MySQL."""
    return ModelHistoryStore().list()


@app.post(
    "/api/v1/models",
    response_model=ModelHistoryEntry,
    status_code=status.HTTP_201_CREATED,
    tags=["models"],
)
def save_model(entry: ModelHistoryEntry) -> dict[str, Any]:
    """Create or replace a model snapshot in MySQL."""
    return ModelHistoryStore().save(entry.model_dump())


@app.delete(
    "/api/v1/models",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["models"],
)
def clear_models(
    source: Annotated[Literal["saved", "analyzed"] | None, Query()] = None,
) -> Response:
    """Delete every model snapshot, optionally restricted by source."""
    ModelHistoryStore().clear(source)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.delete(
    "/api/v1/models/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["models"],
)
def delete_model(entry_id: str) -> Response:
    """Delete a model snapshot from MySQL."""
    if not ModelHistoryStore().delete(entry_id):
        raise HTTPException(status_code=404, detail="Model snapshot not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post("/api/v1/solve", response_model=SolveResponse, tags=["analysis"])
def solve(payload: SolveRequest) -> dict:
    """Run the analysis and optionally embed V/M PNG charts as data URIs."""
    result = _solve(payload)
    return _response_dict(result, payload)


@app.post(
    "/api/v1/plots/shear-force",
    response_class=Response,
    responses={200: {"content": {"image/png": {}}}},
    tags=["plots"],
)
def shear_force_plot(payload: SolveRequest) -> Response:
    """Run the analysis and return the V chart directly as image/png."""
    result = _solve(payload)
    png = render_shear_force_plot(result.elements, dpi=payload.plot_dpi)
    return Response(
        content=png,
        media_type="image/png",
        headers={"Content-Disposition": 'inline; filename="shear_force_v.png"'},
    )


@app.post(
    "/api/v1/plots/bending-moment",
    response_class=Response,
    responses={200: {"content": {"image/png": {}}}},
    tags=["plots"],
)
def bending_moment_plot(payload: SolveRequest) -> Response:
    """Run the analysis and return the M chart directly as image/png."""
    result = _solve(payload)
    png = render_bending_moment_plot(result.elements, dpi=payload.plot_dpi)
    return Response(
        content=png,
        media_type="image/png",
        headers={"Content-Disposition": 'inline; filename="bending_moment_m.png"'},
    )


# Serve the built React workbench when frontend/dist is present.
_FRONTEND_DIST = _frontend_dist()
if _FRONTEND_DIST is not None:
    assets_dir = _FRONTEND_DIST / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="frontend-assets")

    @app.get("/{full_path:path}", include_in_schema=False, response_model=None)
    def spa_fallback(full_path: str) -> FileResponse | JSONResponse:
        """Serve SPA assets or index.html; keep API 404s as JSON."""
        if full_path.startswith("api/") or full_path in {
            "docs",
            "redoc",
            "openapi.json",
            "health",
        }:
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        candidate = _FRONTEND_DIST / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_FRONTEND_DIST / "index.html")


def run() -> None:
    """Run the production-style Uvicorn server installed by this package."""
    import uvicorn

    host = os.environ.get("FRAME2D_HOST", "0.0.0.0")
    port = int(os.environ.get("FRAME2D_API_PORT", "8000"))
    uvicorn.run("frame2d.api:app", host=host, port=port)
