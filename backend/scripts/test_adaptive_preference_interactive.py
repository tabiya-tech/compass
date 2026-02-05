#!/usr/bin/env python3
"""
Interactive test script for Adaptive D-Efficiency Preference Elicitation.

This script demonstrates the adaptive D-optimal vignette selection with real-time
display of Bayesian posterior updates, Fisher Information Matrix, and D-efficiency scores.

Usage:
    poetry run python scripts/test_adaptive_preference_interactive.py
"""

import asyncio
import sys
import logging
import numpy as np
import json
from pathlib import Path
from typing import Optional
from datetime import datetime

# Rich imports
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.logging import RichHandler
from rich.traceback import install
from rich import box
from rich.text import Text
from rich.progress import Progress, SpinnerColumn, TextColumn

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.agent.preference_elicitation_agent.vignette_engine import VignetteEngine
from app.agent.preference_elicitation_agent.state import PreferenceElicitationAgentState
from app.agent.preference_elicitation_agent.types import Vignette
from app.agent.preference_elicitation_agent.bayesian.posterior_manager import PosteriorManager
from app.agent.preference_elicitation_agent.bayesian.likelihood_calculator import LikelihoodCalculator
from app.agent.preference_elicitation_agent.information_theory.fisher_information import FisherInformationCalculator
from app.agent.preference_elicitation_agent.information_theory.stopping_criterion import StoppingCriterion

# Install rich traceback handler
install(show_locals=True)

# Initialize console
console = Console()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    datefmt="[%X]",
    handlers=[RichHandler(console=console, rich_tracebacks=True, show_path=False)]
)

# Suppress noisy loggers
logging.getLogger('httpx').setLevel(logging.WARNING)
logging.getLogger('httpcore').setLevel(logging.WARNING)


def print_header(text: str):
    """Print a formatted header."""
    console.print(Panel(Text(text, justify="center", style="bold magenta"), box=box.DOUBLE))


def print_section(text: str):
    """Print a formatted section header."""
    console.print(f"\n[bold blue]{text}[/]")
    console.print(f"[blue]{'-'*len(text)}[/]")


def print_vignette(vignette: Vignette):
    """Display a vignette beautifully."""
    panel_content = f"[bold]{vignette.scenario_text}[/]\n\n"

    for opt in vignette.options:
        panel_content += f"[bold cyan]{opt.title}[/]\n"
        panel_content += f"{opt.description}\n\n"

    console.print(Panel(
        panel_content,
        title=f"[bold green]Vignette: {vignette.vignette_id}[/]",
        subtitle=f"[dim]Category: {vignette.category}[/]",
        border_style="green",
        box=box.ROUNDED
    ))


def display_posterior_stats(posterior_manager: PosteriorManager, title: str = "Posterior Distribution"):
    """Display current posterior statistics."""
    posterior = posterior_manager.posterior

    table = Table(title=title, box=box.ROUNDED, show_lines=True)
    table.add_column("Dimension", style="cyan", no_wrap=True)
    table.add_column("Mean (μ)", style="yellow")
    table.add_column("Std Dev (σ)", style="magenta")
    table.add_column("95% CI", style="green")

    dims = posterior.dimensions

    for i, dim in enumerate(dims):
        mean = posterior.mean[i]
        variance = posterior.get_variance(dim)
        std = np.sqrt(variance)
        ci_lower = mean - 1.96 * std
        ci_upper = mean + 1.96 * std

        # Shorten dimension names for display
        display_name = dim.replace("_importance", "").replace("_", " ").title()

        table.add_row(
            display_name,
            f"{mean:+.3f}",
            f"±{std:.3f}",
            f"[{ci_lower:+.3f}, {ci_upper:+.3f}]"
        )

    console.print(table)


def display_fim_stats(fim: np.ndarray, title: str = "Fisher Information Matrix"):
    """Display FIM statistics."""
    # Calculate eigenvalues and D-efficiency
    eigenvalues = np.linalg.eigvalsh(fim)
    det = np.linalg.det(fim)
    d_efficiency = det ** (1 / len(eigenvalues))
    condition_number = eigenvalues.max() / eigenvalues.min() if eigenvalues.min() > 1e-10 else np.inf

    table = Table(title=title, box=box.ROUNDED)
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="yellow")

    table.add_row("Determinant (det(FIM))", f"{det:.2e}")
    table.add_row("D-Efficiency (det^(1/k))", f"{d_efficiency:.4f}")
    table.add_row("Condition Number", f"{condition_number:.2f}")
    table.add_row("Min Eigenvalue", f"{eigenvalues.min():.4f}")
    table.add_row("Max Eigenvalue", f"{eigenvalues.max():.4f}")

    console.print(table)

    # Show eigenvalues
    eig_table = Table(title="Eigenvalues (Information per Direction)", box=box.SIMPLE)
    eig_table.add_column("#", style="dim")
    eig_table.add_column("Value", style="green")

    for i, eig in enumerate(eigenvalues, 1):
        eig_table.add_row(str(i), f"{eig:.4f}")

    console.print(eig_table)


def display_stopping_criterion_status(
    stopping_criterion: StoppingCriterion,
    posterior_manager: PosteriorManager,
    current_fim: np.ndarray,
    n_shown: int
):
    """Display stopping criterion status."""
    should_continue, reason = stopping_criterion.should_continue(
        posterior=posterior_manager.posterior,
        fim=current_fim,
        n_vignettes_shown=n_shown
    )

    status_color = "green" if should_continue else "red"
    status_text = "CONTINUE" if should_continue else "STOP"

    table = Table(title="Stopping Criterion Status", box=box.ROUNDED)
    table.add_column("Check", style="cyan")
    table.add_column("Status", style=status_color)

    table.add_row("Decision", f"[bold {status_color}]{status_text}[/]")
    table.add_row("Reason", reason)
    table.add_row("Vignettes Shown", f"{n_shown} (min: {stopping_criterion.min_vignettes}, max: {stopping_criterion.max_vignettes})")

    # Calculate current metrics
    det = np.linalg.det(current_fim + np.eye(current_fim.shape[0]) * 1e-8)  # Add small regularization like in should_continue
    max_variance = max([posterior_manager.posterior.get_variance(dim) for dim in posterior_manager.posterior.dimensions])

    table.add_row("FIM Determinant", f"{det:.2e} (threshold: {stopping_criterion.det_threshold:.2e})")
    table.add_row("Max Variance", f"{max_variance:.4f} (threshold: {stopping_criterion.max_variance_threshold:.4f})")

    console.print(table)


async def run_adaptive_session():
    """Run a complete adaptive preference elicitation session."""
    # Initialize session log
    session_log = {
        "session_metadata": {
            "timestamp": datetime.now().isoformat(),
            "script_version": "1.0.0",
            "description": "Adaptive D-optimal preference elicitation session"
        },
        "turns": [],
        "final_summary": {}
    }

    print_header("Adaptive D-Efficiency Preference Elicitation")

    console.print(Panel(
        "This interactive demo shows the adaptive D-optimal vignette selection in action.\n\n"
        "You'll see:\n"
        "• Phase 1: 4 static beginning vignettes\n"
        "• Phase 2: 0-8 adaptive D-optimal vignettes\n"
        "• Phase 3: 2 static end vignettes\n\n"
        "With real-time Bayesian posterior updates and FIM calculations!",
        style="blue",
        box=box.ROUNDED
    ))

    # Initialize components
    print_section("Initializing Adaptive Components")

    with console.status("[bold green]Loading offline vignettes...", spinner="dots"):
        engine = VignetteEngine(
            use_personalization=False,
            use_adaptive_selection=True,
            offline_output_dir=None  # Uses default: backend/offline_output
        )

    console.print("[green]✓[/] Loaded offline vignettes")
    console.print(f"  • {len(engine._static_beginning_vignettes)} static beginning")
    console.print(f"  • {len(engine._adaptive_library_vignettes)} adaptive library")
    console.print(f"  • {len(engine._static_end_vignettes)} static end")

    # Initialize Bayesian components
    # Dimensions must match PosteriorDistribution.dimensions
    dims = [
        "financial_importance",
        "work_environment_importance",
        "career_growth_importance",
        "work_life_balance_importance",
        "job_security_importance",
        "task_preference_importance",
        "values_culture_importance"
    ]

    prior_mean = np.zeros(7)
    prior_cov = np.eye(7)

    likelihood_calculator = LikelihoodCalculator()
    posterior_manager = PosteriorManager(prior_mean=prior_mean, prior_cov=prior_cov)
    fisher_calculator = FisherInformationCalculator(likelihood_calculator)
    stopping_criterion = StoppingCriterion(min_vignettes=6, max_vignettes=14)

    console.print("[green]✓[/] Initialized Bayesian posterior manager")
    console.print("[green]✓[/] Initialized Fisher Information Matrix calculator")
    console.print("[green]✓[/] Initialized stopping criterion (6-14 vignettes)\n")

    # Create state
    state = PreferenceElicitationAgentState(
        session_id=99999,
        use_adaptive_selection=True,
        posterior_mean=prior_mean.tolist(),
        posterior_covariance=prior_cov.tolist(),
        fisher_information_matrix=np.zeros((7, 7)).tolist()
    )

    # Display initial prior
    print_section("Initial Prior Distribution")
    display_posterior_stats(posterior_manager, "Prior Distribution (Before Any Vignettes)")
    console.input("\n[dim]Press Enter to start...[/]")

    # Session variables
    current_fim = np.zeros((7, 7))
    vignettes_shown = []

    # Main loop
    turn = 1
    while True:
        print_header(f"Turn {turn}")

        # Initialize turn log
        turn_log = {
            "turn_number": turn,
            "timestamp": datetime.now().isoformat(),
            "vignette": None,
            "user_choice": None,
            "prior_state": {},
            "posterior_state": {},
            "fim_update": {},
            "stopping_criterion": {}
        }

        # Select next vignette
        with console.status("[bold green]Selecting next vignette...", spinner="dots"):
            next_vignette = await engine._select_adaptive_vignette(state)

        if next_vignette is None:
            console.print("[bold green]✅ Session complete![/]")
            break

        # Log vignette details
        turn_log["vignette"] = {
            "vignette_id": next_vignette.vignette_id,
            "category": next_vignette.category,
            "scenario_text": next_vignette.scenario_text,
            "options": [
                {
                    "option_id": opt.option_id,
                    "title": opt.title,
                    "description": opt.description,
                    "attributes": opt.attributes
                }
                for opt in next_vignette.options
            ]
        }

        # Display vignette
        print_vignette(next_vignette)

        # Get user choice
        while True:
            choice = console.input("\n[bold cyan]Your choice (A/B): [/]").strip().upper()
            if choice in ["A", "B"]:
                break
            console.print("[red]Please enter A or B[/]")

        turn_log["user_choice"] = choice
        console.print(f"[green]✓[/] You chose option {choice}\n")

        # Log prior state (before update)
        turn_log["prior_state"] = {
            "mean": posterior_manager.posterior.mean.tolist() if hasattr(posterior_manager.posterior.mean, 'tolist') else list(posterior_manager.posterior.mean),
            "covariance": posterior_manager.posterior.covariance.tolist() if hasattr(posterior_manager.posterior.covariance, 'tolist') else [list(row) for row in posterior_manager.posterior.covariance],
            "variances": {dim: float(posterior_manager.posterior.get_variance(dim)) for dim in posterior_manager.posterior.dimensions}
        }

        # Update posterior
        print_section("Updating Bayesian Posterior")

        with console.status("[bold green]Computing likelihood...", spinner="dots"):
            likelihood_fn = likelihood_calculator.create_likelihood_function(
                vignette=next_vignette,
                chosen_option=choice
            )
            observation = {"vignette": next_vignette, "chosen_option": choice}
            updated_posterior = posterior_manager.update(likelihood_fn, observation)

        console.print("[green]✓[/] Posterior updated using Laplace approximation\n")

        # Log posterior state (after update)
        turn_log["posterior_state"] = {
            "mean": updated_posterior.mean.tolist() if hasattr(updated_posterior.mean, 'tolist') else list(updated_posterior.mean),
            "covariance": updated_posterior.covariance.tolist() if hasattr(updated_posterior.covariance, 'tolist') else [list(row) for row in updated_posterior.covariance],
            "variances": {dim: float(updated_posterior.get_variance(dim)) for dim in updated_posterior.dimensions}
        }

        # Display updated posterior
        display_posterior_stats(posterior_manager, f"Posterior After Vignette {turn}")

        # Update FIM
        print_section("Updating Fisher Information Matrix")

        vignette_fim = fisher_calculator.compute_fim(next_vignette, np.array(updated_posterior.mean))
        current_fim += vignette_fim

        # Log FIM update
        eigenvalues = np.linalg.eigvalsh(current_fim)
        det = np.linalg.det(current_fim)
        d_efficiency = det ** (1 / 7) if det > 0 else 0

        turn_log["fim_update"] = {
            "vignette_fim": vignette_fim.tolist(),
            "cumulative_fim": current_fim.tolist(),
            "determinant": float(det),
            "d_efficiency": float(d_efficiency),
            "eigenvalues": eigenvalues.tolist(),
            "condition_number": float(eigenvalues.max() / eigenvalues.min()) if eigenvalues.min() > 1e-10 else float('inf')
        }

        display_fim_stats(current_fim, f"Cumulative FIM (After {turn} Vignettes)")

        # Update state
        state.completed_vignettes.append(next_vignette.vignette_id)
        # posterior mean and covariance are already lists (from Pydantic model)
        state.posterior_mean = updated_posterior.mean if isinstance(updated_posterior.mean, list) else updated_posterior.mean.tolist()
        state.posterior_covariance = updated_posterior.covariance if isinstance(updated_posterior.covariance, list) else updated_posterior.covariance.tolist()
        state.fisher_information_matrix = current_fim.tolist()
        vignettes_shown.append(next_vignette)

        # Track adaptive phase
        if len(state.completed_vignettes) > 4 and not state.adaptive_phase_complete:
            state.adaptive_vignettes_shown_count += 1

        # Check stopping criterion
        print_section("Stopping Criterion Check")
        display_stopping_criterion_status(
            stopping_criterion,
            posterior_manager,
            current_fim,
            len(state.completed_vignettes)
        )

        should_continue, reason = stopping_criterion.should_continue(
            posterior=posterior_manager.posterior,
            fim=current_fim,
            n_vignettes_shown=len(state.completed_vignettes)
        )

        # Log stopping criterion
        max_variance = max([posterior_manager.posterior.get_variance(dim) for dim in posterior_manager.posterior.dimensions])
        fim_det_with_reg = np.linalg.det(current_fim + np.eye(current_fim.shape[0]) * 1e-8)

        turn_log["stopping_criterion"] = {
            "should_continue": should_continue,
            "reason": reason,
            "n_vignettes_shown": len(state.completed_vignettes),
            "min_vignettes": stopping_criterion.min_vignettes,
            "max_vignettes": stopping_criterion.max_vignettes,
            "fim_determinant": float(fim_det_with_reg),
            "det_threshold": stopping_criterion.det_threshold,
            "max_variance": float(max_variance),
            "variance_threshold": stopping_criterion.max_variance_threshold
        }

        # Add turn log to session
        session_log["turns"].append(turn_log)

        if not should_continue and len(state.completed_vignettes) >= 4:
            console.print(f"\n[yellow]Stopping criterion met: {reason}[/]")
            console.print("[yellow]Moving to end phase (2 static vignettes)...[/]")
            state.adaptive_phase_complete = True

        console.input("\n[dim]Press Enter to continue...[/]")
        turn += 1

    # Final summary
    print_header("Session Complete!")

    final_det = np.linalg.det(current_fim)
    final_d_eff = final_det ** (1/7) if final_det > 0 else 0

    # Log final summary
    session_log["final_summary"] = {
        "total_vignettes_shown": len(vignettes_shown),
        "static_beginning": len([v for v in vignettes_shown if v.vignette_id.startswith("static_begin")]),
        "adaptive_vignettes": state.adaptive_vignettes_shown_count,
        "static_end": len([v for v in vignettes_shown if v.vignette_id.startswith("static_end")]),
        "final_posterior": {
            "mean": posterior_manager.posterior.mean.tolist() if hasattr(posterior_manager.posterior.mean, 'tolist') else list(posterior_manager.posterior.mean),
            "covariance": posterior_manager.posterior.covariance.tolist() if hasattr(posterior_manager.posterior.covariance, 'tolist') else [list(row) for row in posterior_manager.posterior.covariance],
            "variances": {dim: float(posterior_manager.posterior.get_variance(dim)) for dim in posterior_manager.posterior.dimensions}
        },
        "final_fim": {
            "matrix": current_fim.tolist(),
            "determinant": float(final_det),
            "d_efficiency": float(final_d_eff),
            "eigenvalues": np.linalg.eigvalsh(current_fim).tolist()
        }
    }

    # Write session log to file
    log_dir = Path(__file__).parent.parent / "session_logs"
    log_dir.mkdir(exist_ok=True)

    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file = log_dir / f"adaptive_session_{timestamp_str}.json"

    with open(log_file, 'w') as f:
        json.dump(session_log, f, indent=2)

    console.print(f"\n[green]✓[/] Session log saved to: [cyan]{log_file}[/]\n")

    summary_table = Table(title="Final Session Summary", box=box.ROUNDED)
    summary_table.add_column("Metric", style="cyan")
    summary_table.add_column("Value", style="yellow")

    summary_table.add_row("Total Vignettes Shown", str(len(vignettes_shown)))
    summary_table.add_row("Static Beginning", str(session_log["final_summary"]["static_beginning"]))
    summary_table.add_row("Adaptive (D-Optimal)", str(state.adaptive_vignettes_shown_count))
    summary_table.add_row("Static End", str(session_log["final_summary"]["static_end"]))
    summary_table.add_row("Final FIM Determinant", f"{final_det:.2e}")
    summary_table.add_row("Final D-Efficiency", f"{final_d_eff:.4f}")
    summary_table.add_row("Log File", str(log_file.name))

    console.print(summary_table)

    print_section("Final Posterior Distribution")
    display_posterior_stats(posterior_manager, "Final Posterior (Learned Preferences)")


async def main():
    """Main entry point."""
    try:
        await run_adaptive_session()
    except KeyboardInterrupt:
        console.print("\n[yellow]Session interrupted by user.[/]")
    except Exception as e:
        console.print(f"\n[red]Error: {e}[/]")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
