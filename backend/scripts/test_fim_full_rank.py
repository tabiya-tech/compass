#!/usr/bin/env python3
"""
Quick test to verify FIM is full rank with new 7D feature extraction.
"""

import sys
import numpy as np
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.agent.preference_elicitation_agent.vignette_engine import VignetteEngine
from app.agent.preference_elicitation_agent.bayesian.likelihood_calculator import LikelihoodCalculator
from app.agent.preference_elicitation_agent.information_theory.fisher_information import FisherInformationCalculator

def test_fim_full_rank():
    """Test that FIM is full rank after loading offline vignettes."""
    print("Testing FIM Full Rank")
    print("=" * 60)

    # Load offline vignettes
    print("\n1. Loading offline vignettes...")
    backend_root = Path(__file__).parent.parent
    offline_dir = str(backend_root / "offline_output")

    engine = VignetteEngine(
        use_personalization=False,
        use_adaptive_selection=True,
        offline_output_dir=offline_dir
    )

    print(f"  ✓ Loaded {len(engine._static_beginning_vignettes)} static beginning vignettes")
    print(f"  ✓ Loaded {len(engine._static_end_vignettes)} static end vignettes")
    print(f"  ✓ Loaded {len(engine._adaptive_library_vignettes)} adaptive library vignettes")

    # Combine all static vignettes
    all_static = engine._static_beginning_vignettes + engine._static_end_vignettes
    print(f"  ✓ Total static vignettes: {len(all_static)}")

    # Initialize components
    print("\n2. Initializing Bayesian components...")
    likelihood_calculator = LikelihoodCalculator()
    fisher_calculator = FisherInformationCalculator(likelihood_calculator)
    print("  ✓ Initialized")

    # Test feature extraction
    print("\n3. Testing feature extraction...")
    test_vignette = all_static[0]
    option_a = test_vignette.options[0]
    option_b = test_vignette.options[1]

    features_a = likelihood_calculator._extract_features(option_a)
    features_b = likelihood_calculator._extract_features(option_b)

    print(f"  Option A attributes: {option_a.attributes}")
    print(f"  Option A features (7D): {features_a}")
    print(f"  Option B features (7D): {features_b}")
    print(f"  Feature difference: {features_a - features_b}")

    # Compute FIM for all static vignettes
    print(f"\n4. Computing cumulative FIM for all {len(all_static)} static vignettes...")
    prior_mean = np.zeros(7)
    cumulative_fim = np.zeros((7, 7))

    for i, vignette in enumerate(all_static, 1):
        vig_fim = fisher_calculator.compute_fim(vignette, prior_mean)
        cumulative_fim += vig_fim

        det = np.linalg.det(cumulative_fim)
        eigenvalues = np.linalg.eigvalsh(cumulative_fim)

        print(f"\n  After vignette {i}:")
        print(f"    Determinant: {det:.2e}")
        print(f"    Eigenvalues: {eigenvalues}")
        print(f"    Min eigenvalue: {eigenvalues.min():.4f}")
        print(f"    Rank: {np.linalg.matrix_rank(cumulative_fim)}/7")

    # Final assessment
    print("\n5. Final Assessment")
    print("=" * 60)
    final_det = np.linalg.det(cumulative_fim)
    final_eigenvalues = np.linalg.eigvalsh(cumulative_fim)
    final_rank = np.linalg.matrix_rank(cumulative_fim)

    print(f"  FIM Determinant: {final_det:.2e}")
    print(f"  D-Efficiency: {final_det**(1/7):.4f}")
    print(f"  Eigenvalues: {final_eigenvalues}")
    print(f"  Min Eigenvalue: {final_eigenvalues.min():.4f}")
    print(f"  Matrix Rank: {final_rank}/7")

    # Check success
    is_full_rank = final_rank == 7
    has_positive_det = final_det > 0
    all_positive_eig = final_eigenvalues.min() > 0

    print(f"\n  ✓ Full Rank: {is_full_rank}")
    print(f"  ✓ Positive Determinant: {has_positive_det}")
    print(f"  ✓ All Positive Eigenvalues: {all_positive_eig}")

    if is_full_rank and has_positive_det and all_positive_eig:
        print("\n✅ SUCCESS: FIM is full rank with positive determinant!")
        return 0
    else:
        print("\n❌ FAILURE: FIM is not full rank or has issues")
        return 1

if __name__ == "__main__":
    sys.exit(test_fim_full_rank())
