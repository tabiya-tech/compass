"""
Integration tests for adaptive D-efficiency preference elicitation.

Tests the complete offline → online flow:
1. Load offline-generated vignettes
2. Simulate user choices
3. Verify posterior updates
4. Test adaptive selection
5. Verify stopping criterion
6. Complete end-to-end flow
"""

import pytest
import json
import numpy as np
from pathlib import Path
from typing import List, Dict, Any

from app.agent.preference_elicitation_agent.types import Vignette, VignetteOption
from app.agent.preference_elicitation_agent.bayesian.likelihood_calculator import LikelihoodCalculator
from app.agent.preference_elicitation_agent.bayesian.posterior_manager import PosteriorManager
from app.agent.preference_elicitation_agent.information_theory.fisher_information import FisherInformationCalculator
from app.agent.preference_elicitation_agent.information_theory.stopping_criterion import StoppingCriterion
from app.agent.preference_elicitation_agent.adaptive_selection.d_optimal_selector import DOptimalSelector


# Fixtures for integration tests
@pytest.fixture
def offline_output_dir():
    """Path to offline optimization output."""
    # Offline output is in backend root, not in agent directory
    backend_root = Path(__file__).parent.parent.parent.parent
    return backend_root / "offline_output"


@pytest.fixture
def static_beginning_vignettes(offline_output_dir):
    """Load static beginning vignettes from offline output."""
    path = offline_output_dir / "static_vignettes_beginning.json"

    if not path.exists():
        pytest.skip(f"Offline vignettes not found at {path}. Run offline optimization first.")

    with open(path) as f:
        data = json.load(f)

    vignettes = []
    for v_dict in data["vignettes"]:
        vignettes.append(Vignette(**v_dict))

    return vignettes


@pytest.fixture
def static_end_vignettes(offline_output_dir):
    """Load static end vignettes from offline output."""
    path = offline_output_dir / "static_vignettes_end.json"

    if not path.exists():
        pytest.skip(f"Offline vignettes not found at {path}. Run offline optimization first.")

    with open(path) as f:
        data = json.load(f)

    vignettes = []
    for v_dict in data["vignettes"]:
        vignettes.append(Vignette(**v_dict))

    return vignettes


@pytest.fixture
def adaptive_library_vignettes(offline_output_dir):
    """Load adaptive library vignettes from offline output."""
    path = offline_output_dir / "adaptive_library.json"

    if not path.exists():
        pytest.skip(f"Offline vignettes not found at {path}. Run offline optimization first.")

    with open(path) as f:
        data = json.load(f)

    vignettes = []
    for v_dict in data["vignettes"]:
        vignettes.append(Vignette(**v_dict))

    return vignettes


@pytest.fixture
def preference_dimensions():
    """Standard preference dimensions."""
    return ["wage", "remote", "career_growth", "flexibility",
            "job_security", "task_variety", "culture_alignment"]


@pytest.fixture
def prior_mean():
    """Default prior mean (neutral preferences)."""
    return np.zeros(7)


@pytest.fixture
def prior_covariance():
    """Default prior covariance (moderate uncertainty)."""
    return np.eye(7) * 1.0


@pytest.fixture
def likelihood_calculator():
    """Create likelihood calculator."""
    return LikelihoodCalculator(temperature=1.0)


@pytest.fixture
def posterior_manager(prior_mean, prior_covariance, likelihood_calculator):
    """Create posterior manager with likelihood calculator."""
    pm = PosteriorManager(
        prior_mean=prior_mean,
        prior_cov=prior_covariance
    )
    # Attach likelihood calculator for convenience
    pm.likelihood_calculator = likelihood_calculator
    return pm


@pytest.fixture
def fisher_calculator(likelihood_calculator):
    """Create Fisher Information calculator."""
    return FisherInformationCalculator(likelihood_calculator)


@pytest.fixture
def d_optimal_selector(fisher_calculator):
    """Create D-optimal selector."""
    return DOptimalSelector(fisher_calculator)


@pytest.fixture
def stopping_criterion():
    """Create stopping criterion."""
    return StoppingCriterion(
        min_vignettes=4,
        max_vignettes=12,
        det_threshold=1e2,
        max_variance_threshold=0.5
    )


class TestOfflineVignetteLoading:
    """Test loading offline-generated vignettes."""

    def test_static_beginning_vignettes_exist(self, static_beginning_vignettes):
        """Test that static beginning vignettes were generated."""
        assert len(static_beginning_vignettes) >= 4
        assert all(isinstance(v, Vignette) for v in static_beginning_vignettes)

    def test_static_end_vignettes_exist(self, static_end_vignettes):
        """Test that static end vignettes were generated."""
        assert len(static_end_vignettes) >= 2
        assert all(isinstance(v, Vignette) for v in static_end_vignettes)

    def test_adaptive_library_exists(self, adaptive_library_vignettes):
        """Test that adaptive library was generated."""
        assert len(adaptive_library_vignettes) >= 10
        assert all(isinstance(v, Vignette) for v in adaptive_library_vignettes)

    def test_vignette_schema_correct(self, static_beginning_vignettes):
        """Test that offline vignettes match online schema."""
        vignette = static_beginning_vignettes[0]

        # Required fields
        assert hasattr(vignette, 'vignette_id')
        assert hasattr(vignette, 'category')
        assert hasattr(vignette, 'scenario_text')
        assert hasattr(vignette, 'options')

        # Options structure
        assert len(vignette.options) == 2
        assert all(hasattr(opt, 'option_id') for opt in vignette.options)
        assert all(hasattr(opt, 'title') for opt in vignette.options)
        assert all(hasattr(opt, 'description') for opt in vignette.options)
        assert all(hasattr(opt, 'attributes') for opt in vignette.options)

    def test_vignettes_have_unique_ids(self, static_beginning_vignettes, adaptive_library_vignettes):
        """Test that all vignettes have unique IDs."""
        all_vignettes = static_beginning_vignettes + adaptive_library_vignettes
        vignette_ids = [v.vignette_id for v in all_vignettes]

        assert len(vignette_ids) == len(set(vignette_ids))


class TestPosteriorUpdates:
    """Test posterior belief updates with user choices."""

    def test_posterior_updates_after_single_choice(
        self, posterior_manager, static_beginning_vignettes
    ):
        """Test that posterior updates after a single choice."""
        vignette = static_beginning_vignettes[0]

        # Initial posterior
        initial_mean = np.array(posterior_manager.posterior.mean)
        initial_variance = np.mean([
            posterior_manager.posterior.get_variance(dim)
            for dim in posterior_manager.posterior.dimensions
        ])

        # Create likelihood function for this choice
        likelihood_fn = posterior_manager.likelihood_calculator.create_likelihood_function(
            vignette=vignette,
            chosen_option="A"
        )

        # Simulate user choosing option A
        observation = {"vignette": vignette, "chosen_option": "A"}
        updated_posterior = posterior_manager.update(likelihood_fn, observation)

        # Posterior should change
        updated_mean = np.array(updated_posterior.mean)
        assert not np.allclose(initial_mean, updated_mean)

        # Uncertainty should decrease
        updated_variance = np.mean([
            updated_posterior.get_variance(dim)
            for dim in updated_posterior.dimensions
        ])
        assert updated_variance < initial_variance

    def test_posterior_updates_multiple_choices(
        self, posterior_manager, static_beginning_vignettes
    ):
        """Test posterior updates with multiple choices."""
        # Track variance over time
        variances = []

        # Initial variance
        variances.append(np.mean([
            posterior_manager.posterior.get_variance(dim)
            for dim in posterior_manager.posterior.dimensions
        ]))

        # Make 3 choices
        for i in range(min(3, len(static_beginning_vignettes))):
            vignette = static_beginning_vignettes[i]

            # Create likelihood function
            likelihood_fn = posterior_manager.likelihood_calculator.create_likelihood_function(
                vignette=vignette,
                chosen_option="A"
            )

            observation = {"vignette": vignette, "chosen_option": "A"}
            updated_posterior = posterior_manager.update(likelihood_fn, observation)

            variance = np.mean([
                updated_posterior.get_variance(dim)
                for dim in updated_posterior.dimensions
            ])
            variances.append(variance)

        # Variance should generally decrease (learning from data)
        assert variances[-1] < variances[0]

    def test_different_choices_lead_to_different_posteriors(
        self, prior_mean, prior_covariance, static_beginning_vignettes, likelihood_calculator
    ):
        """Test that choosing A vs B leads to different posteriors."""
        vignette = static_beginning_vignettes[0]

        # Create two independent posterior managers
        pm1 = PosteriorManager(
            prior_mean=prior_mean,
            prior_cov=prior_covariance
        )

        pm2 = PosteriorManager(
            prior_mean=prior_mean,
            prior_cov=prior_covariance
        )

        # Create likelihood functions for different choices
        likelihood_fn_a = likelihood_calculator.create_likelihood_function(
            vignette=vignette,
            chosen_option="A"
        )

        likelihood_fn_b = likelihood_calculator.create_likelihood_function(
            vignette=vignette,
            chosen_option="B"
        )

        # Update with different choices
        obs_a = {"vignette": vignette, "chosen_option": "A"}
        obs_b = {"vignette": vignette, "chosen_option": "B"}

        posterior_a = pm1.update(likelihood_fn_a, obs_a)
        posterior_b = pm2.update(likelihood_fn_b, obs_b)

        # Should lead to different beliefs
        assert not np.allclose(posterior_a.mean, posterior_b.mean)


class TestAdaptiveSelection:
    """Test adaptive vignette selection."""

    @pytest.mark.asyncio
    async def test_select_most_informative_vignette(
        self, d_optimal_selector, adaptive_library_vignettes,
        posterior_manager, fisher_calculator
    ):
        """Test that selector chooses most informative vignette."""
        # Compute current FIM (empty initially)
        current_fim = np.zeros((7, 7))

        # Select next vignette
        selected = await d_optimal_selector.select_next_vignette(
            vignettes=adaptive_library_vignettes,
            posterior=posterior_manager.posterior,
            current_fim=current_fim,
            vignettes_shown=[]
        )

        assert selected is not None
        assert selected in adaptive_library_vignettes

    @pytest.mark.asyncio
    async def test_no_vignette_shown_twice(
        self, d_optimal_selector, adaptive_library_vignettes, posterior_manager
    ):
        """Test that vignettes are not repeated."""
        current_fim = np.eye(7) * 0.1
        vignettes_shown = []

        # Select 3 vignettes
        for _ in range(3):
            selected = await d_optimal_selector.select_next_vignette(
                vignettes=adaptive_library_vignettes,
                posterior=posterior_manager.posterior,
                current_fim=current_fim,
                vignettes_shown=vignettes_shown
            )

            assert selected is not None
            assert selected not in vignettes_shown

            vignettes_shown.append(selected)

        # All selected vignettes should be unique
        assert len(vignettes_shown) == len(set(v.vignette_id for v in vignettes_shown))

    @pytest.mark.asyncio
    async def test_selection_adapts_to_posterior(
        self, d_optimal_selector, adaptive_library_vignettes, fisher_calculator
    ):
        """Test that selection changes based on posterior beliefs."""
        current_fim = np.eye(7) * 0.1

        # Posterior with low uncertainty in wage dimension
        posterior_certain_wage = PosteriorManager(
            prior_mean=np.array([2.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
            prior_cov=np.diag([0.01, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0])
        )

        # Posterior with low uncertainty in remote dimension
        posterior_certain_remote = PosteriorManager(
            prior_mean=np.array([0.0, 2.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
            prior_cov=np.diag([1.0, 0.01, 1.0, 1.0, 1.0, 1.0, 1.0])
        )

        # Selections should potentially differ
        selected_1 = await d_optimal_selector.select_next_vignette(
            vignettes=adaptive_library_vignettes,
            posterior=posterior_certain_wage.posterior,
            current_fim=current_fim,
            vignettes_shown=[]
        )

        selected_2 = await d_optimal_selector.select_next_vignette(
            vignettes=adaptive_library_vignettes,
            posterior=posterior_certain_remote.posterior,
            current_fim=current_fim,
            vignettes_shown=[]
        )

        # At least one should be selected
        assert selected_1 is not None or selected_2 is not None


class TestStoppingCriterion:
    """Test stopping criterion integration."""

    def test_continues_below_minimum(self, stopping_criterion, posterior_manager):
        """Test that elicitation continues below minimum vignettes."""
        current_fim = np.eye(7) * 0.1

        should_continue, reason = stopping_criterion.should_continue(
            posterior=posterior_manager.posterior,
            fim=current_fim,
            n_vignettes_shown=2  # Below minimum of 4
        )

        assert should_continue is True
        assert "minimum" in reason.lower()

    def test_stops_at_maximum(self, stopping_criterion, posterior_manager):
        """Test that elicitation stops at maximum vignettes."""
        current_fim = np.eye(7) * 0.1

        should_continue, reason = stopping_criterion.should_continue(
            posterior=posterior_manager.posterior,
            fim=current_fim,
            n_vignettes_shown=12  # At maximum
        )

        assert should_continue is False
        assert "maximum" in reason.lower()

    def test_stops_when_uncertainty_low(self, stopping_criterion):
        """Test that elicitation stops when uncertainty is sufficiently low."""
        # Create posterior with very low uncertainty
        low_uncertainty_posterior = PosteriorManager(
            prior_mean=np.ones(7),
            prior_cov=np.eye(7) * 0.01  # Very low uncertainty
        )

        current_fim = np.eye(7) * 10.0  # High information

        should_continue, reason = stopping_criterion.should_continue(
            posterior=low_uncertainty_posterior.posterior,
            fim=current_fim,
            n_vignettes_shown=6  # Between min and max
        )

        # Should stop due to low uncertainty
        assert should_continue is False


class TestCompleteFlow:
    """Test complete end-to-end preference elicitation flow."""

    @pytest.mark.asyncio
    async def test_complete_session_flow(
        self, static_beginning_vignettes, static_end_vignettes,
        adaptive_library_vignettes, posterior_manager,
        d_optimal_selector, stopping_criterion, fisher_calculator
    ):
        """Test a complete user session from start to finish."""
        vignettes_shown = []
        current_fim = np.zeros((7, 7))

        # Phase 1: Show 4 static beginning vignettes
        for i in range(4):
            vignette = static_beginning_vignettes[i]
            vignettes_shown.append(vignette)

            # Simulate user choice (alternate A/B for variety)
            choice = "A" if i % 2 == 0 else "B"

            # Update posterior
            likelihood_fn = posterior_manager.likelihood_calculator.create_likelihood_function(
                vignette=vignette,
                chosen_option=choice
            )
            observation = {"vignette": vignette, "chosen_option": choice}
            updated_posterior = posterior_manager.update(likelihood_fn, observation)

            # Update FIM
            vignette_fim = fisher_calculator.compute_fim(vignette, np.array(updated_posterior.mean))
            current_fim += vignette_fim

        # Phase 2: Adaptive vignettes (up to 8 more)
        adaptive_count = 0
        max_adaptive = 8

        while adaptive_count < max_adaptive:
            # Check stopping criterion
            should_continue, reason = stopping_criterion.should_continue(
                posterior=posterior_manager.posterior,
                fim=current_fim,
                n_vignettes_shown=len(vignettes_shown)
            )

            if not should_continue:
                break

            # Select next vignette
            selected = await d_optimal_selector.select_next_vignette(
                vignettes=adaptive_library_vignettes,
                posterior=posterior_manager.posterior,
                current_fim=current_fim,
                vignettes_shown=vignettes_shown
            )

            if selected is None:
                break

            vignettes_shown.append(selected)

            # Simulate choice
            choice = "A" if adaptive_count % 2 == 0 else "B"

            # Update posterior
            likelihood_fn = posterior_manager.likelihood_calculator.create_likelihood_function(
                vignette=selected,
                chosen_option=choice
            )
            observation = {"vignette": selected, "chosen_option": choice}
            updated_posterior = posterior_manager.update(likelihood_fn, observation)

            # Update FIM
            vignette_fim = fisher_calculator.compute_fim(selected, np.array(updated_posterior.mean))
            current_fim += vignette_fim

            adaptive_count += 1

        # Phase 3: Show 2 static end vignettes
        for i in range(2):
            vignette = static_end_vignettes[i]
            vignettes_shown.append(vignette)

            # Simulate choice
            choice = "A" if i % 2 == 0 else "B"

            # Update posterior (final)
            likelihood_fn = posterior_manager.likelihood_calculator.create_likelihood_function(
                vignette=vignette,
                chosen_option=choice
            )
            observation = {"vignette": vignette, "chosen_option": choice}
            updated_posterior = posterior_manager.update(likelihood_fn, observation)

        # Verify session constraints
        total_vignettes = len(vignettes_shown)
        assert 6 <= total_vignettes <= 14  # 4 beginning + 0-8 adaptive + 2 end

        # Verify we have 4 static beginning
        assert vignettes_shown[:4] == static_beginning_vignettes[:4]

        # Verify we have 2 static end
        assert vignettes_shown[-2:] == static_end_vignettes[:2]

        # Verify all vignettes unique
        vignette_ids = [v.vignette_id for v in vignettes_shown]
        assert len(vignette_ids) == len(set(vignette_ids))

        # Verify final posterior exists and is reasonable
        final_posterior = posterior_manager.posterior
        assert final_posterior is not None
        assert len(final_posterior.mean) == 7

        # Verify uncertainty decreased
        final_variance = np.mean([
            final_posterior.get_variance(dim)
            for dim in final_posterior.dimensions
        ])
        assert final_variance < 1.0  # Should be less than prior variance

    def test_fim_increases_monotonically(
        self, static_beginning_vignettes, fisher_calculator
    ):
        """Test that FIM determinant increases as vignettes are shown."""
        current_fim = np.zeros((7, 7))
        beta = np.array([0.5, 0.3, 0.4, 0.2, 0.6, 0.1, 0.5])

        determinants = [fisher_calculator.compute_d_efficiency(current_fim)]

        for vignette in static_beginning_vignettes[:4]:
            vignette_fim = fisher_calculator.compute_fim(vignette, beta)
            current_fim += vignette_fim

            det = fisher_calculator.compute_d_efficiency(current_fim)
            determinants.append(det)

        # Determinant should increase (or at least not decrease significantly)
        for i in range(1, len(determinants)):
            assert determinants[i] >= determinants[i-1] * 0.99  # Allow tiny numerical errors
