"""PNG post-processing for shear-force and bending-moment line charts."""

from __future__ import annotations

import base64
from collections.abc import Iterable
from io import BytesIO
from threading import Lock
from typing import Literal

import numpy as np
from matplotlib.backends.backend_agg import FigureCanvasAgg
from matplotlib.figure import Figure

from .solver import ElementAnalysisResult

InternalForceComponent = Literal["shear_force", "bending_moment"]

_RENDER_LOCK = Lock()
_PLOT_SETTINGS: dict[InternalForceComponent, tuple[str, str, str]] = {
    "shear_force": ("Shear force diagram (V)", "V [N]", "#0072B2"),
    "bending_moment": ("Bending moment diagram (M)", "M [N·m]", "#D55E00"),
}


def render_internal_force_plot(
    elements: Iterable[ElementAnalysisResult],
    component: InternalForceComponent,
    *,
    dpi: int = 140,
) -> bytes:
    """Render one internal-force component for all elements as PNG bytes."""
    element_results = tuple(elements)
    if not element_results:
        raise ValueError("elements must contain at least one ElementAnalysisResult")
    if not all(isinstance(item, ElementAnalysisResult) for item in element_results):
        raise TypeError("elements must contain only ElementAnalysisResult objects")
    if component not in _PLOT_SETTINGS:
        raise ValueError("component must be 'shear_force' or 'bending_moment'")
    if isinstance(dpi, (bool, np.bool_)) or not isinstance(dpi, int):
        raise TypeError("dpi must be an integer")
    if dpi < 72 or dpi > 600:
        raise ValueError("dpi must be between 72 and 600")

    title, y_label, color = _PLOT_SETTINGS[component]
    with _RENDER_LOCK:
        figure = Figure(figsize=(8.0, 4.8), dpi=dpi, layout="constrained")
        FigureCanvasAgg(figure)
        axes = figure.subplots()

        for element in element_results:
            x_local = element.fields.x_local
            values = getattr(element.fields, component)
            axes.plot(
                x_local,
                values,
                linewidth=2.0,
                color=color,
                alpha=0.82,
                label=f"Element {element.element_id}",
            )
            axes.scatter(
                [x_local[0], x_local[-1]],
                [values[0], values[-1]],
                color=color,
                s=20,
                zorder=3,
            )

        axes.axhline(0.0, color="#333333", linewidth=0.9)
        axes.set_title(title)
        axes.set_xlabel("Local coordinate x [m]")
        axes.set_ylabel(y_label)
        axes.grid(True, color="#D9D9D9", linewidth=0.7, alpha=0.8)
        axes.legend(loc="best")

        buffer = BytesIO()
        figure.savefig(
            buffer,
            format="png",
            dpi=dpi,
            metadata={"Software": "frame2d"},
        )
        figure.clear()
    return buffer.getvalue()


def render_shear_force_plot(
    elements: Iterable[ElementAnalysisResult],
    *,
    dpi: int = 140,
) -> bytes:
    """Render the shear-force V line chart as PNG bytes."""
    return render_internal_force_plot(elements, "shear_force", dpi=dpi)


def render_bending_moment_plot(
    elements: Iterable[ElementAnalysisResult],
    *,
    dpi: int = 140,
) -> bytes:
    """Render the bending-moment M line chart as PNG bytes."""
    return render_internal_force_plot(elements, "bending_moment", dpi=dpi)


def png_data_uri(png: bytes) -> str:
    """Encode PNG bytes as a browser-ready data URI."""
    if not isinstance(png, bytes):
        raise TypeError("png must be bytes")
    if not png.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError("png does not contain a PNG signature")
    encoded = base64.b64encode(png).decode("ascii")
    return f"data:image/png;base64,{encoded}"
