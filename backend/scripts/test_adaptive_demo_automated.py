#!/usr/bin/env python3
"""
Automated test of the adaptive preference elicitation demo.
Shows that FIM reaches full rank during the session.
"""

import asyncio
import sys
import numpy as np
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.agent.preference_elicitation_agent.vignette_engine import VignetteEngine
from app.agent.preference_elicitation_agent.state import PreferenceElicitationAgentState
from app.agent.preference_elicitation_agent.bayesian.posterior_manager import PosteriorManager
from app.agent.preference_elicitation_agent.bayesian.likelihood_calculator import LikelihoodCalculator
from app.agent.preference_elicitation_agent.information_theory.fisher_information import FisherInformationCalculator
from app.agent.preference_elicitation_agent.information_theory.stopping_criterion import StoppingCriterion


async def run_automated_demo():
    """Run automated demo with predefined choices."""
    print("=" * 70)
    print("AUTOMATED ADAPTIVE PREFERENCE ELICITATION DEMO")
    print("=" * 70)

    # Initialize components
    print("\n1. Initializing components...")
    backend_root = Path(__file__).parent.parent
    offline_dir = str(backend_root / "offline_output")

    engine = VignetteEngine(
        use_personalization=False,
        use_adaptive_selection=True,
        offline_output_dir=offline_dir
    )

    prior_mean = np.zeros(7)
    prior_cov = np.eye(7)

    likelihood_calculator = LikelihoodCalculator()
    posterior_manager = PosteriorManager(prior_mean=prior_mean, prior_cov=prior_cov)
    fisher_calculator = FisherInformationCalculator(likelihood_calculator)
    stopping_criterion = StoppingCriterion(min_vignettes=6, max_vignettes=14)

    print(f"   ✓ Loaded {len(engine._static_beginning_vignettes)} beginning vignettes")
    print(f"   ✓ Loaded {len(engine._static_end_vignettes)} end vignettes")
    print(f"   ✓ Loaded {len(engine._adaptive_library_vignettes)} adaptive library vignettes")

    # Create state
    state = PreferenceElicitationAgentState(
        session_id=99999,
        use_adaptive_selection=True,
        posterior_mean=prior_mean.tolist(),
        posterior_covariance=prior_cov.tolist(),
        fisher_information_matrix=np.zeros((7, 7)).tolist()
    )

    # Simulated choices (alternating A/B)
    simulated_choices = ["B", "A", "B", "A", "B", "A", "B", "A", "B", "A"]

    # Run through vignettes
    print("\n2. Running through vignettes with simulated choices...")
    print("-" * 70)

    current_fim = np.zeros((7, 7))

    for turn in range(1, 15):  # Max 14 vignettes
        # Select next vignette
        next_vignette = await engine._select_adaptive_vignette(state)

        if next_vignette is None:
            print(f"\n✅ Session complete at turn {turn-1}!")
            break

        # Simulate user choice
        choice = simulated_choices[min(turn-1, len(simulated_choices)-1)]

        # Update posterior
        likelihood_fn = likelihood_calculator.create_likelihood_function(
            vignette=next_vignette,
            chosen_option=choice
        )
        observation = {"vignette": next_vignette, "chosen_option": choice}
        updated_posterior = posterior_manager.update(likelihood_fn, observation)

        # Update FIM
        vignette_fim = fisher_calculator.compute_fim(next_vignette, np.array(updated_posterior.mean))
        current_fim += vignette_fim

        # Calculate metrics
        det = np.linalg.det(current_fim)
        eigenvalues = np.linalg.eigvalsh(current_fim)
        rank = np.linalg.matrix_rank(current_fim)
        d_eff = det ** (1/7) if det > 0 else 0

        print(f"\nTurn {turn}: Vignette '{next_vignette.vignette_id}' | Choice: {choice}")
        print(f"   FIM Det: {det:.2e} | D-Eff: {d_eff:.4f} | Rank: {rank}/7")
        print(f"   Eigenvalues: [{eigenvalues[0]:.3f}, {eigenvalues[1]:.3f}, {eigenvalues[2]:.3f}, "
              f"{eigenvalues[3]:.3f}, {eigenvalues[4]:.3f}, {eigenvalues[5]:.3f}, {eigenvalues[6]:.3f}]")

        if rank == 7:
            print(f"   🎉 FULL RANK achieved at turn {turn}!")

        # Update state
        state.completed_vignettes.append(next_vignette.vignette_id)
        state.posterior_mean = updated_posterior.mean if isinstance(updated_posterior.mean, list) else updated_posterior.mean.tolist()
        state.posterior_covariance = updated_posterior.covariance if isinstance(updated_posterior.covariance, list) else updated_posterior.covariance.tolist()
        state.fisher_information_matrix = current_fim.tolist()

        if len(state.completed_vignettes) > 4 and not state.adaptive_phase_complete:
            state.adaptive_vignettes_shown_count += 1

        # Check stopping criterion
        should_continue, reason = stopping_criterion.should_continue(
            posterior=posterior_manager.posterior,
            fim=current_fim,
            n_vignettes_shown=len(state.completed_vignettes)
        )

        if not should_continue and len(state.completed_vignettes) >= 4:
            print(f"\n   ⏹️  Stopping: {reason}")
            state.adaptive_phase_complete = True

    # Final summary
    print("\n" + "=" * 70)
    print("FINAL RESULTS")
    print("=" * 70)
    print(f"Total vignettes shown: {len(state.completed_vignettes)}")
    print(f"Adaptive vignettes: {state.adaptive_vignettes_shown_count}")
    print(f"Final FIM determinant: {np.linalg.det(current_fim):.2e}")
    print(f"Final D-efficiency: {np.linalg.det(current_fim)**(1/7):.4f}")
    print(f"Final rank: {np.linalg.matrix_rank(current_fim)}/7")
    print(f"Min eigenvalue: {np.linalg.eigvalsh(current_fim).min():.4f}")

    final_rank = np.linalg.matrix_rank(current_fim)
    if final_rank == 7:
        print("\n✅ SUCCESS: System achieved full rank FIM!")
        return 0
    else:
        print(f"\n❌ FAILURE: System only achieved rank {final_rank}/7")
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(run_automated_demo()))
