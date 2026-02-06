"""
Offline optimization pipeline for preference elicitation.

This module contains tools for pre-computing optimized vignettes using
information-theoretic principles (D-efficiency).

The offline pipeline runs once before deployment to generate:
- Static vignettes (6 pre-optimized for maximum information)
  - 4 beginning vignettes (shown first to all users)
  - 2 end vignettes (shown last as holdout for validation)
- Adaptive library (40 vignettes for runtime D-optimal selection)

Pipeline flow:
1. ProfileGenerator: Generate all possible job profile combinations (~560 profiles)
2. DominanceFilter: Remove dominated profiles (e.g., ~560 → ~200 non-dominated)
3. DEfficiencyOptimizer: Select 6 static vignettes maximizing D-efficiency
4. AdaptiveLibraryBuilder: Build 40-vignette library for adaptive selection

Usage:
    # Run the full pipeline via CLI
    cd offline_optimization
    python run_offline_optimization.py --output-dir ./output

    # Or use components programmatically
    from offline_optimization import ProfileGenerator, DominanceFilter, ...
"""

from .profile_generator import ProfileGenerator
from .dominance_filter import DominanceFilter
from .d_efficiency_optimizer import DEfficiencyOptimizer
from .adaptive_library_builder import AdaptiveLibraryBuilder

__all__ = [
    "ProfileGenerator",
    "DominanceFilter",
    "DEfficiencyOptimizer",
    "AdaptiveLibraryBuilder",
]
