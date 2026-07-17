from frame2d import FrameElement, NodalLoad, Node, Support, solve_frame
from frame2d.plotting import (
    png_data_uri,
    render_bending_moment_plot,
    render_shear_force_plot,
)


def solved_element_results():
    return solve_frame(
        nodes=[Node(1, 0.0, 0.0), Node(2, 2.0, 0.0)],
        elements=[FrameElement(1, 1, 2, E=200.0, A=0.02, I=0.001)],
        supports=[Support(1, u=True, v=True, phi=True)],
        nodal_loads=[NodalLoad(2, fy=-1.0)],
        number_of_points=5,
    ).elements


def test_v_and_m_plots_are_valid_png_images() -> None:
    elements = solved_element_results()

    shear_png = render_shear_force_plot(elements, dpi=72)
    moment_png = render_bending_moment_plot(elements, dpi=72)

    assert shear_png.startswith(b"\x89PNG\r\n\x1a\n")
    assert moment_png.startswith(b"\x89PNG\r\n\x1a\n")
    assert len(shear_png) > 1_000
    assert len(moment_png) > 1_000
    assert png_data_uri(shear_png).startswith("data:image/png;base64,")
