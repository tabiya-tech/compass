"""
Application-level observability types.

The tracing machinery itself lives in `common_libs.observability`; this package only holds the
Compass-suite domain concepts that the traces are grouped by (see `module_types.TraceModule` and
`module_types.TraceSubModule`).
"""

from app.observability.module_types import TraceModule, TraceSubModule, sub_module_label

__all__ = ["TraceModule", "TraceSubModule", "sub_module_label"]
