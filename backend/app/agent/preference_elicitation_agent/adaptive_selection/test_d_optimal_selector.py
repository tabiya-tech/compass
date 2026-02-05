"""
Unit tests for DOptimalSelector.
"""

import pytest
import numpy as np
from app.agent.preference_elicitation_agent.adaptive_selection.d_optimal_selector import DOptimalSelector
from app.agent.preference_elicitation_agent.bayesian.posterior_manager import PosteriorDistribution
from app.agent.preference_elicitation_agent.bayesian.likelihood_calculator import LikelihoodCalculator
from app.agent.preference_elicitation_agent.information_theory.fisher_information import FisherInformationCalculator
from app.agent.preference_elicitation_agent.types import Vignette, VignetteOption, VignetteTemplate


@pytest.fixture
def likelihood_calculator():
    """Create likelihood calculator."""
    return LikelihoodCalculator(temperature=1.0)


@pytest.fixture
def fisher_calculator(likelihood_calculator):
    """Create Fisher Information calculator."""
    return FisherInformationCalculator(likelihood_calculator)


@pytest.fixture
def d_optimal_selector(fisher_calculator):
    """Create D-optimal selector."""
    return DOptimalSelector(
        fisher_calculator=fisher_calculator,
        min_det_threshold=1e-6
    )


@pytest.fixture
def posterior():
    """Create test posterior distribution."""
    dimensions = ["wage", "remote", "career_growth", "flexibility",
                  "job_security", "task_variety", "culture_alignment"]

    mean = np.array([0.5, 0.3, 0.4, 0.2, 0.6, 0.1, 0.5])
    covariance = np.eye(7) * 0.3

    return PosteriorDistribution(
        dimensions=dimensions,
        mean=mean,
        covariance=covariance
    )


@pytest.fixture
def vignettes():
    """Create test vignettes."""
    vignette_1 = Vignette(
        vignette_id="vignette_1",
        category="financial",
        scenario_text="Consider these jobs:",
        options=[
            VignetteOption(
                option_id="A",
                title="Job A",
                attributes={"salary": 20000, "remote": True},
                description="Job A"
            ),
            VignetteOption(
                option_id="B",
                title="Job B",
                attributes={"salary": 30000, "remote": False},
                description="Job B"
            )
        ]
    )

    vignette_2 = Vignette(
        vignette_id="vignette_2",
        category="work_environment",
        scenario_text="Consider these jobs:",
        options=[
            VignetteOption(
                option_id="A",
                title="Job A",
                attributes={"salary": 25000, "remote": True},
                description="Job A"
            ),
            VignetteOption(
                option_id="B",
                title="Job B",
                attributes={"salary": 25000, "remote": False},
                description="Job B"
            )
        ]
    )

    vignette_3 = Vignette(
        vignette_id="vignette_3",
        category="career_growth",
        scenario_text="Consider these jobs:",
        options=[
            VignetteOption(
                option_id="A",
                title="Job A",
                attributes={"salary": 35000, "remote": True},
                description="Job A"
            ),
            VignetteOption(
                option_id="B",
                title="Job B",
                attributes={"salary": 15000, "remote": False},
                description="Job B"
            )
        ]
    )

    return [vignette_1, vignette_2, vignette_3]


@pytest.fixture
def current_fim():
    """Create current FIM (some baseline information)."""
    return np.eye(7) * 0.1


class TestDOptimalSelector:
    """Tests for DOptimalSelector class."""

    def test_init(self, fisher_calculator):
        """Test initialization."""
        selector = DOptimalSelector(
            fisher_calculator=fisher_calculator,
            min_det_threshold=1e-5
        )

        assert selector.fisher_calculator == fisher_calculator
        assert selector.min_det_threshold == 1e-5

    @pytest.mark.asyncio
    async def test_select_next_vignette(self, d_optimal_selector, vignettes, posterior, current_fim):
        """Test selecting next vignette."""
        vignettes_shown = []  # No vignettes shown yet

        selected = await d_optimal_selector.select_next_vignette(
            vignettes=vignettes,
            posterior=posterior,
            current_fim=current_fim,
            vignettes_shown=vignettes_shown
        )

        # Should return one of the vignettes
        assert selected is not None
        assert selected in vignettes

    @pytest.mark.asyncio
    async def test_select_next_vignette_excludes_shown(self, d_optimal_selector, vignettes, posterior, current_fim):
        """Test that already-shown vignettes are excluded."""
        # Mark first vignette as shown
        vignettes_shown = [vignettes[0]]

        selected = await d_optimal_selector.select_next_vignette(
            vignettes=vignettes,
            posterior=posterior,
            current_fim=current_fim,
            vignettes_shown=vignettes_shown
        )

        # Should not select the shown vignette
        assert selected != vignettes[0]

        # Should select from remaining vignettes
        assert selected in [vignettes[1], vignettes[2]]

    @pytest.mark.asyncio
    async def test_select_next_vignette_all_shown(self, d_optimal_selector, vignettes, posterior, current_fim):
        """Test when all vignettes have been shown."""
        # All vignettes shown
        vignettes_shown = vignettes

        selected = await d_optimal_selector.select_next_vignette(
            vignettes=vignettes,
            posterior=posterior,
            current_fim=current_fim,
            vignettes_shown=vignettes_shown
        )

        # Should return None (no available vignettes)
        assert selected is None

    @pytest.mark.asyncio
    async def test_select_next_vignette_empty_list(self, d_optimal_selector, posterior, current_fim):
        """Test with empty vignette list."""
        selected = await d_optimal_selector.select_next_vignette(
            vignettes=[],
            posterior=posterior,
            current_fim=current_fim,
            vignettes_shown=[]
        )

        # Should return None
        assert selected is None

    @pytest.mark.asyncio
    async def test_select_next_vignette_maximizes_information(
        self, d_optimal_selector, vignettes, posterior, current_fim
    ):
        """Test that selection maximizes expected information gain."""
        vignettes_shown = []

        selected = await d_optimal_selector.select_next_vignette(
            vignettes=vignettes,
            posterior=posterior,
            current_fim=current_fim,
            vignettes_shown=vignettes_shown
        )

        # Manually compute expected gains
        posterior_mean = np.array(posterior.mean)
        gains = {}

        for vignette in vignettes:
            _, det_increase = d_optimal_selector.fisher_calculator.compute_expected_fim(
                vignette, posterior_mean, current_fim
            )
            gains[vignette.vignette_id] = det_increase

        # Selected vignette should have highest gain
        max_gain_id = max(gains, key=gains.get)
        assert selected.vignette_id == max_gain_id

    @pytest.mark.asyncio
    async def test_select_next_template(self, d_optimal_selector, posterior, current_fim):
        """Test selecting next template."""
        # Create test templates
        template_1 = VignetteTemplate(
            template_id="template_1",
            category="financial",
            trade_off={"dimension_a": "wage", "dimension_b": "job_security"},
            option_a={"wage": "high", "job_security": "low"},
            option_b={"wage": "low", "job_security": "high"}
        )

        template_2 = VignetteTemplate(
            template_id="template_2",
            category="work_environment",
            trade_off={"dimension_a": "remote_work", "dimension_b": "career_growth"},
            option_a={"remote_work": "high", "career_growth": "low"},
            option_b={"remote_work": "low", "career_growth": "high"}
        )

        templates = [template_1, template_2]
        vignettes_shown = []

        selected = await d_optimal_selector.select_next_template(
            templates=templates,
            posterior=posterior,
            current_fim=current_fim,
            vignettes_shown=vignettes_shown
        )

        # Should return one of the templates
        assert selected is not None
        assert selected in templates

    @pytest.mark.asyncio
    async def test_select_next_template_empty_list(self, d_optimal_selector, posterior, current_fim):
        """Test template selection with empty list."""
        selected = await d_optimal_selector.select_next_template(
            templates=[],
            posterior=posterior,
            current_fim=current_fim,
            vignettes_shown=[]
        )

        # Should return None
        assert selected is None

    def test_rank_vignettes(self, d_optimal_selector, vignettes, posterior, current_fim):
        """Test vignette ranking."""
        ranked = d_optimal_selector.rank_vignettes(
            vignettes=vignettes,
            posterior=posterior,
            current_fim=current_fim
        )

        # Should return list of tuples
        assert isinstance(ranked, list)
        assert len(ranked) == 3

        # Each element should be (vignette, gain)
        for item in ranked:
            assert isinstance(item, tuple)
            assert len(item) == 2
            assert isinstance(item[0], Vignette)
            assert isinstance(item[1], (float, np.floating))

        # Should be sorted by gain (descending)
        gains = [item[1] for item in ranked]
        assert gains == sorted(gains, reverse=True)

    def test_rank_vignettes_empty(self, d_optimal_selector, posterior, current_fim):
        """Test ranking empty vignette list."""
        ranked = d_optimal_selector.rank_vignettes(
            vignettes=[],
            posterior=posterior,
            current_fim=current_fim
        )

        # Should return empty list
        assert ranked == []

    def test_get_template_dimensions_from_metadata(self, d_optimal_selector):
        """Test extracting dimensions from template targeted_dimensions."""
        template = VignetteTemplate(
            template_id="test",
            category="financial",
            trade_off={"dimension_a": "wage", "dimension_b": "job_security"},
            option_a={"wage": "high"},
            option_b={"wage": "low"},
            targeted_dimensions=["wage", "benefits"]
        )

        # _get_template_dimensions checks metadata dict first, but VignetteTemplate doesn't have that
        # It should use targeted_dimensions or fall back to category mapping
        dims = d_optimal_selector._get_template_dimensions(template)

        # Since no metadata dict, should use category mapping
        assert "financial_importance" in dims

    def test_get_template_dimensions_from_category(self, d_optimal_selector):
        """Test extracting dimensions from template category."""
        template = VignetteTemplate(
            template_id="test",
            category="financial",
            trade_off={"dimension_a": "wage", "dimension_b": "job_security"},
            option_a={"wage": "high"},
            option_b={"wage": "low"}
        )

        dims = d_optimal_selector._get_template_dimensions(template)

        # Should map to financial_importance
        assert "financial_importance" in dims

    def test_get_template_dimensions_fallback(self, d_optimal_selector):
        """Test fallback when no metadata or category."""
        template = VignetteTemplate(
            template_id="test",
            category="unknown_category",
            trade_off={"dimension_a": "foo", "dimension_b": "bar"},
            option_a={"foo": "high"},
            option_b={"foo": "low"}
        )

        dims = d_optimal_selector._get_template_dimensions(template)

        # Should return empty list as fallback
        assert dims == []

    def test_estimate_template_info_gain(self, d_optimal_selector, posterior, current_fim):
        """Test estimating information gain from template."""
        # Create posterior with varying uncertainty
        dimensions = ["financial_importance", "work_environment_importance", "career_growth_importance"]
        mean = np.zeros(3)
        covariance = np.diag([0.8, 0.2, 0.5])  # financial has high uncertainty

        test_posterior = PosteriorDistribution(
            dimensions=dimensions,
            mean=mean,
            covariance=covariance
        )

        # Template targeting financial dimension
        template_financial = VignetteTemplate(
            template_id="financial",
            category="financial",
            trade_off={"dimension_a": "wage", "dimension_b": "benefits"},
            option_a={"wage": "high"},
            option_b={"wage": "low"},
            targeted_dimensions=["financial_importance"]
        )

        # Template targeting work environment dimension
        template_work = VignetteTemplate(
            template_id="work",
            category="work_environment",
            trade_off={"dimension_a": "remote_work", "dimension_b": "office_based"},
            option_a={"remote_work": "high"},
            option_b={"remote_work": "low"},
            targeted_dimensions=["work_environment_importance"]
        )

        gain_financial = d_optimal_selector._estimate_template_info_gain(
            template_financial, test_posterior, current_fim
        )

        gain_work = d_optimal_selector._estimate_template_info_gain(
            template_work, test_posterior, current_fim
        )

        # Financial template should have higher gain (higher uncertainty)
        assert gain_financial > gain_work

    def test_estimate_template_info_gain_no_matching_dims(self, d_optimal_selector, posterior, current_fim):
        """Test template with no matching dimensions in posterior."""
        template = VignetteTemplate(
            template_id="test",
            category="unknown",
            trade_off={"dimension_a": "foo", "dimension_b": "bar"},
            option_a={"foo": "high"},
            option_b={"foo": "low"},
            targeted_dimensions=["nonexistent_dimension"]
        )

        gain = d_optimal_selector._estimate_template_info_gain(
            template, posterior, current_fim
        )

        # Should return 0 (no information gain)
        assert gain == 0.0

    def test_rank_consistency_with_selection(self, d_optimal_selector, vignettes, posterior, current_fim):
        """Test that ranking is consistent with selection."""
        # Get ranking
        ranked = d_optimal_selector.rank_vignettes(
            vignettes=vignettes,
            posterior=posterior,
            current_fim=current_fim
        )

        # Top-ranked vignette should be the one selected
        top_ranked = ranked[0][0]

        # Manually compute what select_next_vignette would choose
        posterior_mean = np.array(posterior.mean)
        best_vignette = None
        best_gain = -np.inf

        for vignette in vignettes:
            _, det_increase = d_optimal_selector.fisher_calculator.compute_expected_fim(
                vignette, posterior_mean, current_fim
            )
            if det_increase > best_gain:
                best_gain = det_increase
                best_vignette = vignette

        # Should be the same
        assert top_ranked.vignette_id == best_vignette.vignette_id
