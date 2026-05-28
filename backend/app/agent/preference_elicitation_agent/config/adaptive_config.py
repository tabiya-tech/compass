"""
Configuration for adaptive D-efficiency mode.

Centralizes all settings for the adaptive preference elicitation enhancement.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
import numpy as np
import os


class AdaptiveConfig(BaseModel):
    """Configuration for adaptive D-efficiency mode."""

    # Feature flag
    enabled: bool = Field(
        default=False,
        description="Enable adaptive D-efficiency mode"
    )

    # Prior distribution (population defaults)
    prior_mean: List[float] = Field(
        default=[0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
        description="Prior mean for 7 preference dimensions"
    )

    prior_variance: float = Field(
        default=0.5,
        description="Diagonal elements of prior covariance matrix"
    )

    # Stopping criterion
    min_vignettes: int = Field(
        default=4,
        ge=2,
        description="Minimum number of vignettes to show"
    )

    max_vignettes: int = Field(
        default=12,
        le=20,
        description="Maximum number of vignettes to show"
    )

    fim_det_threshold: float = Field(
        default=1.0,
        description="Stop if det(FIM)/det(prior_FIM) exceeds this ratio. "
                    "Measures relative information gain. Lowered from 10.0 to 1.0 because "
                    "with 7 dimensions and ≤12 two-option vignettes, det(FIM) grows slowly "
                    "and 10.0 was unreachable — max_vignettes was the only criterion firing. "
                    "1.0 triggers early stop around vignette 9-10 in typical sessions."
    )

    max_variance_threshold: float = Field(
        default=0.25,
        description="Stop if max variance across dimensions is below this. "
                    "Must be less than prior_variance (0.5) to be meaningful. "
                    "0.25 = stop when uncertainty is halved from the prior."
    )

    # MNL temperature
    temperature: float = Field(
        default=1.0,
        gt=0.0,
        description="Temperature parameter for choice model (1.0 = standard MNL)"
    )

    # Numerical optimization
    max_newton_iterations: int = Field(
        default=50,
        ge=10,
        description="Maximum Newton-Raphson iterations for MAP estimation"
    )

    convergence_tolerance: float = Field(
        default=1e-6,
        description="Convergence tolerance for optimization"
    )

    # Uncertainty analysis
    uncertainty_threshold: float = Field(
        default=0.3,
        description="Variance threshold for identifying high-uncertainty dimensions"
    )

    # Regularization
    fim_regularization: float = Field(
        default=1e-8,
        description="Regularization term added to FIM for numerical stability"
    )

    covariance_regularization: float = Field(
        default=1e-6,
        description="Regularization added to posterior covariance if singular"
    )

    class Config:
        """Pydantic configuration."""
        arbitrary_types_allowed = True

    @classmethod
    def from_env(cls) -> "AdaptiveConfig":
        """
        Load configuration from environment variables.

        Environment variables:
        - ADAPTIVE_D_EFFICIENCY_ENABLED: "true" or "false"
        - ADAPTIVE_MIN_VIGNETTES: int
        - ADAPTIVE_MAX_VIGNETTES: int
        - ADAPTIVE_FIM_THRESHOLD: float
        - ADAPTIVE_VARIANCE_THRESHOLD: float
        - ADAPTIVE_TEMPERATURE: float

        Returns:
            AdaptiveConfig instance
        """
        return cls(
            enabled=os.getenv("ADAPTIVE_D_EFFICIENCY_ENABLED", "false").lower() == "true",
            min_vignettes=int(os.getenv("ADAPTIVE_MIN_VIGNETTES", "4")),
            max_vignettes=int(os.getenv("ADAPTIVE_MAX_VIGNETTES", "12")),
            fim_det_threshold=float(os.getenv("ADAPTIVE_FIM_THRESHOLD", "1.0")),
            max_variance_threshold=float(os.getenv("ADAPTIVE_VARIANCE_THRESHOLD", "0.25")),
            temperature=float(os.getenv("ADAPTIVE_TEMPERATURE", "1.0")),
            uncertainty_threshold=float(os.getenv("ADAPTIVE_UNCERTAINTY_THRESHOLD", "0.3"))
        )

    def get_prior_covariance(self) -> np.ndarray:
        """
        Get prior covariance matrix.

        Returns:
            7x7 covariance matrix (diagonal with prior_variance)
        """
        return np.eye(7) * self.prior_variance

    def get_prior_mean_array(self) -> np.ndarray:
        """
        Get prior mean as numpy array.

        Returns:
            Array of shape (7,)
        """
        return np.array(self.prior_mean)

    def validate_config(self) -> bool:
        """
        Validate configuration consistency.

        Returns:
            True if valid, False otherwise
        """
        # Check vignette bounds
        if self.min_vignettes > self.max_vignettes:
            return False

        # Check prior mean dimension
        if len(self.prior_mean) != 7:
            return False

        # Check positive values
        if self.prior_variance <= 0:
            return False

        if self.temperature <= 0:
            return False

        return True
