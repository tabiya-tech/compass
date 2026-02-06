#!/usr/bin/env python3
"""
Interactive test script for the Preference Elicitation Agent.

This script allows you to test all components of the preference agent
in an interactive mode without needing full backend integration.

Usage:
    poetry run python test_preference_agent_interactive.py
"""

import asyncio
import sys
import logging
import time
from pathlib import Path
from datetime import timedelta
from typing import List, Optional
import pytest

# Rich imports
from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown
from rich.table import Table
from rich.logging import RichHandler
from rich.traceback import install
from rich import box
from rich.text import Text

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.agent.preference_elicitation_agent.agent import PreferenceElicitationAgent
from app.agent.preference_elicitation_agent.state import PreferenceElicitationAgentState
from app.agent.preference_elicitation_agent.vignette_engine import VignetteEngine
from app.agent.preference_elicitation_agent.types import PreferenceVector
from app.agent.agent_types import AgentInput, AgentOutput
from app.conversation_memory.conversation_memory_types import (
    ConversationContext,
    ConversationHistory,
    ConversationTurn
)
from app.agent.experience.experience_entity import ExperienceEntity
from app.agent.experience import WorkType, Timeline

# Install rich traceback handler
install(show_locals=True)

# Initialize console
console = Console()

class SessionStats:
    """Track session statistics."""
    def __init__(self):
        self.start_time = time.time()
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.total_latency = 0.0
        self.turns = 0
        
        # Estimated costs (standard generic pricing, adjust as needed)
        # Assuming ~ $0.10 / 1M input, $0.40 / 1M output for flash-tier models
        self.input_cost_per_1m = 0.10
        self.output_cost_per_1m = 0.40

    def add_turn(self, input_tokens: int, output_tokens: int, latency: float):
        self.total_input_tokens += input_tokens
        self.total_output_tokens += output_tokens
        self.total_latency += latency
        self.turns += 1

    @property
    def duration(self) -> float:
        return time.time() - self.start_time
    
    @property
    def estimated_cost(self) -> float:
        input_cost = (self.total_input_tokens / 1_000_000) * self.input_cost_per_1m
        output_cost = (self.total_output_tokens / 1_000_000) * self.output_cost_per_1m
        return input_cost + output_cost

    def get_summary_table(self) -> Table:
        table = Table(title="Session Summary", box=box.ROUNDED)
        table.add_column("Metric", style="cyan")
        table.add_column("Value", style="yellow")

        table.add_row("Total Duration", f"{timedelta(seconds=int(self.duration))}")
        table.add_row("Total Turns", str(self.turns))
        table.add_row("Total Latency (LLM)", f"{self.total_latency:.2f}s")
        table.add_row("Avg Latency/Turn", f"{self.total_latency/self.turns:.2f}s" if self.turns > 0 else "0s")
        table.add_row("Total Input Tokens", f"{self.total_input_tokens:,}")
        table.add_row("Total Output Tokens", f"{self.total_output_tokens:,}")
        table.add_row("Total Tokens", f"{self.total_input_tokens + self.total_output_tokens:,}")
        table.add_row("Estimated Cost", f"${self.estimated_cost:.6f}")

        # Add note about what's included
        note = Text("\nNote: Includes conversation LLM + preference extraction LLM + summary LLM.", style="dim italic")
        note2 = Text("Pre-warming LLM calls (background tasks) are not included.", style="dim italic")

        return table

# Configure logging
def setup_logging(level=logging.INFO):
    """Configure logging with RichHandler."""
    logging.basicConfig(
        level=level,
        format="%(message)s",
        datefmt="[%X]",
        handlers=[RichHandler(console=console, rich_tracebacks=True, show_path=False)]
    )
    
    # Suppress noisy loggers
    logging.getLogger('httpx').setLevel(logging.WARNING)
    logging.getLogger('httpcore').setLevel(logging.WARNING)
    logging.getLogger('google').setLevel(logging.WARNING)
    logging.getLogger('urllib3').setLevel(logging.WARNING)


def print_header(text: str):
    """Print a formatted header."""
    console.print(Panel(Text(text, justify="center", style="bold magenta"), box=box.DOUBLE))


def print_section(text: str):
    """Print a formatted section header."""
    console.print(f"\n[bold blue]{text}[/]")
    console.print(f"[blue]{'-'*len(text)}[/]")


def print_agent(text: str):
    """Print agent message."""
    console.print(Panel(Markdown(text), title="[bold green]Agent[/]", border_style="green", box=box.ROUNDED))


def print_user(text: str):
    """Print user message."""
    console.print(Panel(Text(text), title="[bold cyan]You[/]", border_style="cyan", box=box.ROUNDED))


def print_info(text: str):
    """Print info message."""
    console.print(f"[bold yellow]ℹ {text}[/]")


def print_error(text: str):
    """Print error message."""
    console.print(f"[bold red]✗ {text}[/]")


def print_success(text: str):
    """Print success message."""
    console.print(f"[bold green]✓ {text}[/]")


def get_user_input(prompt: str = "") -> str:
    """Get input from user."""
    return console.input(f"[bold cyan]{prompt}[/]")


def display_menu(options: List[str]) -> int:
    """Display a menu and get user selection."""
    table = Table(show_header=False, box=box.SIMPLE)
    for i, option in enumerate(options, 1):
        table.add_row(f"[bold blue]{i}.[/]", option)
    
    console.print(table)

    while True:
        try:
            choice = int(console.input("\n[bold]Select option (number): [/]"))
            if 1 <= choice <= len(options):
                return choice
            print_error(f"Please enter a number between 1 and {len(options)}")
        except ValueError:
            print_error("Please enter a valid number")


def create_sample_experiences() -> List[ExperienceEntity]:
    """Create sample experiences for testing."""
    return [
        ExperienceEntity(
            uuid="exp-1",
            experience_title="High School Teacher (Mathematics & Physics)",
            company="Alliance High School",
            location="Kikuyu",
            timeline=Timeline(start="2018", end="2023"),
            work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT
        ),
        ExperienceEntity(
            uuid="exp-2",
            experience_title="Private Tutor",
            company="Self-employed",
            location="Nairobi",
            timeline=Timeline(start="2023", end="Present"),
            work_type=WorkType.SELF_EMPLOYMENT
        ),
        ExperienceEntity(
            uuid="exp-3",
            experience_title="Student Teacher",
            company="Mang'u High School",
            location="Thika",
            timeline=Timeline(start="2017", end="2017"),
            work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT
        )
    ]


def display_preference_vector(pv: PreferenceVector):
    """Display preference vector within a rich table (simplified 7-dimensional structure)."""
    table = Table(title="Preference Vector (Simplified - 7 Dimensions)", box=box.ROUNDED, show_lines=True)
    table.add_column("Dimension", style="cyan", no_wrap=True)
    table.add_column("Importance", style="yellow", justify="center")
    table.add_column("Interpretation", style="white")

    # Map importance to interpretation
    def interpret(value: float) -> str:
        if value >= 0.7:
            return "HIGH"
        elif value >= 0.5:
            return "MODERATE"
        elif value >= 0.3:
            return "LOW"
        else:
            return "VERY LOW"

    table.add_row(
        "1. Financial Compensation",
        f"{pv.financial_importance:.2f}",
        f"{interpret(pv.financial_importance)} - Salary, benefits, compensation"
    )
    table.add_row(
        "2. Work Environment",
        f"{pv.work_environment_importance:.2f}",
        f"{interpret(pv.work_environment_importance)} - Remote, commute, autonomy, pace"
    )
    table.add_row(
        "3. Career Advancement",
        f"{pv.career_advancement_importance:.2f}",
        f"{interpret(pv.career_advancement_importance)} - Growth, learning, promotion"
    )
    table.add_row(
        "4. Work-Life Balance",
        f"{pv.work_life_balance_importance:.2f}",
        f"{interpret(pv.work_life_balance_importance)} - Hours, flexibility, family time"
    )
    table.add_row(
        "5. Job Security",
        f"{pv.job_security_importance:.2f}",
        f"{interpret(pv.job_security_importance)} - Stability, contract type, risk"
    )
    table.add_row(
        "6. Task Preferences",
        f"{pv.task_preference_importance:.2f}",
        f"{interpret(pv.task_preference_importance)} - Routine, cognitive, manual, social"
    )
    table.add_row(
        "7. Social Impact",
        f"{pv.social_impact_importance:.2f}",
        f"{interpret(pv.social_impact_importance)} - Purpose, helping others, community"
    )

    # Overall Stats
    table.add_row("", "", "")  # Separator
    table.add_row("Overall Confidence", f"[bold]{pv.confidence_score:.2f}[/]", f"{pv.n_vignettes_completed} vignettes completed")

    console.print(table)


def display_bws_task(metadata: dict) -> str:
    """
    Display a BWS task with occupations and get user selections.

    Returns JSON response string: {"type": "bws_response", "best": "...", "worst": "..."}
    """
    import json

    task_num = metadata.get("task_number", 0)
    total = metadata.get("total_tasks", 12)
    occupations = metadata.get("occupations", [])

    # Create table for occupations
    table = Table(
        title=f"[bold]BWS Task {task_num} of {total}[/]",
        box=box.ROUNDED,
        show_header=True,
        header_style="bold cyan"
    )
    table.add_column("Option", style="bold yellow", width=8)
    table.add_column("Job Type", style="bold white", width=40)
    table.add_column("Examples", style="dim", width=50)

    # Map letters to occupations
    occupation_map = {}
    for i, occ in enumerate(occupations):
        letter = chr(65 + i)  # A, B, C, D, E
        occupation_map[letter] = occ["code"]

        # Format label (title case if all uppercase)
        label = occ["label"]
        if label.isupper():
            label = label.title()

        table.add_row(
            letter,
            label,
            occ.get("description", "")
        )

    console.print(table)
    console.print("\n[bold]Select your preferences:[/]")

    # Get MOST preferred
    while True:
        most = console.input("[bold green]Which would you MOST like to do? (A-E): [/]").strip().upper()
        if most in occupation_map:
            break
        print_error(f"Please enter a letter between A and E")

    # Get LEAST preferred
    while True:
        least = console.input("[bold red]Which would you LEAST like to do? (A-E): [/]").strip().upper()
        if least in occupation_map:
            if least != most:
                break
            print_error("You cannot select the same option for both MOST and LEAST")
        else:
            print_error(f"Please enter a letter between A and E")

    # Show selection
    most_label = next(o["label"] for o in occupations if o["code"] == occupation_map[most])
    least_label = next(o["label"] for o in occupations if o["code"] == occupation_map[least])

    if most_label.isupper():
        most_label = most_label.title()
    if least_label.isupper():
        least_label = least_label.title()

    print_success(f"Most preferred: {most} - {most_label}")
    print_success(f"Least preferred: {least} - {least_label}")

    # Return JSON response
    response = {
        "type": "bws_response",
        "best": occupation_map[most],
        "worst": occupation_map[least]
    }

    return json.dumps(response)


def display_state_info(state: PreferenceElicitationAgentState):
    """Display current agent state information."""
    table = Table(title="Agent State", box=box.ROUNDED)
    table.add_column("Property", style="cyan")
    table.add_column("Value", style="white")

    table.add_row("Session ID", str(state.session_id))
    table.add_row("Phase", f"[bold]{state.conversation_phase}[/]")
    table.add_row("Turn Count", str(state.conversation_turn_count))

    # BWS progress if in BWS phase
    if hasattr(state, 'bws_tasks_completed'):
        table.add_row("BWS Progress", f"{state.bws_tasks_completed}/12")
        if state.bws_phase_complete:
            table.add_row("BWS Status", "[green]✓ Complete[/]")
            if state.top_10_occupations:
                table.add_row("Top Occupations", f"{len(state.top_10_occupations)} ranked")

    completed = len(state.completed_vignettes)
    total = completed + len(state.categories_to_explore)
    table.add_row("Vignettes Progress", f"{completed}/{total}")
    table.add_row("Categories Covered", ", ".join(state.categories_covered) if state.categories_covered else "None")
    table.add_row("Categories Remaining", ", ".join(state.categories_to_explore))

    console.print(table)

    if state.vignette_responses:
        history_table = Table(title="Vignette Responses", box=box.SIMPLE)
        history_table.add_column("#", style="dim")
        history_table.add_column("ID", style="cyan")
        history_table.add_column("Option", style="yellow")
        history_table.add_column("Confidence", style="green")
        
        for i, response in enumerate(state.vignette_responses, 1):
            history_table.add_row(
                str(i),
                response.vignette_id,
                response.chosen_option_id,
                f"{response.confidence:.2f}"
            )
        console.print(history_table)


@pytest.mark.asyncio
async def test_vignette_engine():
    """Test the vignette engine component."""
    print_header("Testing Vignette Engine")

    try:
        engine = VignetteEngine()
        print_success(f"Loaded {engine.get_total_vignettes_count()} vignettes")

        # Show categories
        print_section("Vignette Categories")
        counts = engine.get_category_counts()
        
        cat_table = Table(box=box.SIMPLE)
        cat_table.add_column("Category", style="bold cyan")
        cat_table.add_column("Count", style="green")
        
        for category, count in counts.items():
            cat_table.add_row(category, f"{count} vignette(s)")
        console.print(cat_table)

        # Browse vignettes
        print_section("Browse Vignettes")
        for category, vignettes in engine._vignettes_by_category.items():
            console.print(f"\n[bold underline]{category.upper()}[/]")
            vp_table = Table(box=box.SIMPLE, show_header=False)
            vp_table.add_column("Details")
            
            for v in vignettes:
                details = (
                    f"[bold]{v.vignette_id}[/] (Diff: {v.difficulty_level})\n"
                    f"{v.scenario_text[:100]}...\n"
                    f"[dim]{len(v.options)} options[/]"
                )
                vp_table.add_row(details)
            console.print(vp_table)

        console.input("\n[dim]Press Enter to continue...[/]")

    except Exception as e:
        print_error(f"Error testing vignette engine: {e}")
        import traceback
        traceback.print_exc()


@pytest.mark.asyncio
async def test_preference_vector():
    """Test preference vector creation and manipulation."""
    print_header("Testing Preference Vector")

    try:
        # Create default vector
        pv = PreferenceVector()
        print_success("Created default preference vector")
        display_preference_vector(pv)

        # Modify some preferences
        print_section("Modifying Preferences")
        pv.financial_importance = 0.8
        pv.work_environment_importance = 0.6
        pv.job_security_importance = 0.7
        pv.social_impact_importance = 0.9
        pv.confidence_score = 0.65
        pv.n_vignettes_completed = 5

        print_info("Updated financial, work environment, job security, and social impact importance")
        display_preference_vector(pv)

        console.input("\n[dim]Press Enter to continue...[/]")

    except Exception as e:
        print_error(f"Error testing preference vector: {e}")
        import traceback
        traceback.print_exc()


@pytest.mark.asyncio
async def test_full_conversation(use_hybrid_mode: bool = False):
    """Test a full conversation with the agent."""
    if use_hybrid_mode:
        print_header("Interactive Conversation Test - HYBRID MODE (Offline + Personalization)")
    else:
        print_header("Interactive Conversation Test")

    print_info("This will start a conversation with the preference elicitation agent.")
    if use_hybrid_mode:
        print_info("Type 'quit' to exit, 'state' to see state, 'preferences' to see vector, 'logs' to see personalization logs.\n")
    else:
        print_info("Type 'quit' to exit, 'state' to see current state, 'preferences' to see preference vector.\n")

    session_stats = SessionStats()

    try:
        # Create agent with optional hybrid mode
        if use_hybrid_mode:
            offline_output_dir = str(Path(__file__).parent.parent / "offline_output")
            agent = PreferenceElicitationAgent(
                use_offline_with_personalization=True,
                offline_output_dir=offline_output_dir
            )
            print_success("Created preference elicitation agent in HYBRID mode")
            print_info(f"Using offline vignettes from: {offline_output_dir}")
        else:
            agent = PreferenceElicitationAgent()
            print_success("Created preference elicitation agent")

        # Create initial state
        sample_experiences = create_sample_experiences()
        
        exp_table = Table(title="Sample Experiences", box=box.SIMPLE)
        exp_table.add_column("Title", style="bold")
        exp_table.add_column("Company")
        exp_table.add_column("Timeline")
        
        for exp in sample_experiences:
            exp_table.add_row(
                exp.experience_title, 
                exp.company, 
                f"{exp.timeline.start if exp.timeline else 'N/A'} - {exp.timeline.end if exp.timeline else 'N/A'}"
            )
        console.print(exp_table)

        # Initialize state
        # NOTE: For hybrid mode, do NOT set use_adaptive_selection=True in state
        # The hybrid mode is controlled by VignetteEngine's use_offline_with_personalization flag
        # The engine internally handles Bayesian updates, so we still initialize posterior fields
        if use_hybrid_mode:
            # Initialize with Bayesian posterior for hybrid mode tracking
            import numpy as np
            prior_mean = np.zeros(7)
            prior_cov = np.eye(7)

            state = PreferenceElicitationAgentState(
                session_id=12345,
                initial_experiences_snapshot=sample_experiences,
                use_db6_for_fresh_data=False,
                use_adaptive_selection=False,  # DO NOT set True - hybrid mode uses different routing
                posterior_mean=prior_mean.tolist(),
                posterior_covariance=prior_cov.tolist(),
                fisher_information_matrix=np.zeros((7, 7)).tolist()
            )
            print_info("Initialized Bayesian posterior (prior: μ=0, Σ=I)")
        else:
            state = PreferenceElicitationAgentState(
                session_id=12345,
                initial_experiences_snapshot=sample_experiences,
                use_db6_for_fresh_data=False
            )

        agent.set_state(state)
        print_success("Initialized agent state with sample experiences")
        if use_hybrid_mode:
            print_info("Hybrid mode: offline D-optimal vignettes + LLM personalization")

        # Create conversation context
        conversation_history = ConversationHistory()

        # Start conversation loop
        turn_index = 0
        while True:
            # Get user input
            if turn_index == 0:
                user_message = ""  # First turn is automatic
                print_info("Starting conversation (first turn is automatic)...")
            else:
                user_input = get_user_input("You: ")

                # Handle commands
                if user_input.lower() == 'quit':
                    print_info("Ending conversation...")
                    break
                elif user_input.lower() == 'state':
                    display_state_info(state)
                    continue
                elif user_input.lower() == 'preferences':
                    display_preference_vector(state.preference_vector)
                    continue
                elif user_input.lower() == 'logs' and use_hybrid_mode:
                    # Display personalization logs in hybrid mode
                    if agent._personalization_logs:
                        log_table = Table(title="Personalization Logs", box=box.ROUNDED, show_lines=True)
                        log_table.add_column("#", style="dim")
                        log_table.add_column("Vignette ID", style="cyan")
                        log_table.add_column("Success", style="green")
                        log_table.add_column("Attributes Preserved", style="yellow")

                        for i, log in enumerate(agent._personalization_logs, 1):
                            log_table.add_row(
                                str(i),
                                log.vignette_id,
                                "✓" if log.personalization_successful else "✗",
                                "✓" if log.attributes_preserved else "✗"
                            )
                        console.print(log_table)
                        print_info(f"Total personalizations: {len(agent._personalization_logs)}")
                    else:
                        print_info("No personalization logs yet")
                    continue

                user_message = user_input
                print_user(user_message) # Ensure user message is printed nicely

            # Create agent input
            agent_input = AgentInput(
                message=user_message,
                is_artificial=(turn_index == 0)
            )

            # Create context
            context = ConversationContext(
                all_history=conversation_history,
                history=conversation_history,
                summary=""
            )

            # Execute agent
            try:
                # Show spinner while thinking
                with console.status("[bold green]Agent is thinking...", spinner="dots"):
                    output = await agent.execute(agent_input, context)

                # Check if we're in BWS phase and have metadata
                # For BWS tasks, we need to get the ConversationResponse that has metadata
                # Since AgentOutput doesn't include metadata, we'll check the state instead
                is_bws_task = False
                if hasattr(state, 'conversation_phase') and state.conversation_phase == "BWS":
                    # Check if we just got a BWS task (not the transition message)
                    if hasattr(state, 'bws_phase_complete') and not state.bws_phase_complete:
                        # Also check we have tasks remaining
                        if hasattr(state, 'bws_tasks_completed') and state.bws_tasks_completed < 12:
                            is_bws_task = True

                if is_bws_task:
                    # Display the agent message first (intro/question text)
                    print_agent(output.message_for_user)

                    # Now we need to get the BWS metadata from the agent's last response
                    # Since metadata isn't in AgentOutput, we'll access it directly
                    # We need to call the BWS handler to get metadata
                    from app.agent.preference_elicitation_agent import bws_utils

                    # Get current task
                    tasks = bws_utils.load_bws_tasks()
                    current_task_idx = state.bws_tasks_completed - 1  # Already incremented

                    if 0 <= current_task_idx < len(tasks):
                        current_task = tasks[current_task_idx]
                        occupation_groups = bws_utils.load_occupation_groups()
                        occupation_map = {occ["code"]: occ for occ in occupation_groups}

                        occupations_metadata = []
                        for occ_code in current_task["occupations"]:
                            occ_data = occupation_map.get(occ_code, {})
                            occupations_metadata.append({
                                "code": occ_code,
                                "label": occ_data.get("label", f"Occupation {occ_code}"),
                                "description": occ_data.get("description", "")
                            })

                        metadata = {
                            "interaction_type": "bws_task",
                            "task_number": current_task_idx + 1,
                            "total_tasks": len(tasks),
                            "occupations": occupations_metadata
                        }

                        # Display BWS UI and get response
                        user_message = display_bws_task(metadata)

                        # Create new agent input with the BWS response
                        agent_input = AgentInput(message=user_message, is_artificial=False)

                        # Execute agent again to process the response
                        with console.status("[bold green]Agent is thinking...", spinner="dots"):
                            output = await agent.execute(agent_input, context)

                        # Display agent's acknowledgment/next task
                        print_agent(output.message_for_user)
                else:
                    # Normal conversation - display agent response
                    print_agent(output.message_for_user)

                # Collect stats
                input_tokens = sum(stat.prompt_token_count for stat in output.llm_stats)
                output_tokens = sum(stat.response_token_count for stat in output.llm_stats)
                latency = output.agent_response_time_in_sec

                session_stats.add_turn(input_tokens, output_tokens, latency)

                # Show turn stats
                stats_text = (
                    f"Phase: [bold]{state.conversation_phase}[/] | "
                    f"Turn: [bold]{state.conversation_turn_count}[/] | "
                    f"Latency: [bold]{latency:.2f}s[/] | "
                    f"Tokens: [green]{input_tokens}[/] in / [yellow]{output_tokens}[/] out"
                )
                console.print(Panel(stats_text, style="dim", box=box.ROUNDED))

                # Update conversation history
                conversation_turn = ConversationTurn(
                    index=turn_index,
                    input=agent_input,
                    output=output
                )
                conversation_history.turns.append(conversation_turn)

                turn_index += 1

                # Check if finished
                if output.finished:
                    print_success("Conversation complete!")
                    print_section("Final Results")
                    display_state_info(state)
                    display_preference_vector(state.preference_vector)
                    break

            except Exception as e:
                print_error(f"Error during conversation: {e}")
                import traceback
                traceback.print_exc()
                break
        
        # End of session summary
        print_header("Session Completed")
        console.print(session_stats.get_summary_table())
        console.print(
            "\n[dim italic]Note: Includes conversation LLM + preference extraction LLM + summary LLM.[/]"
        )
        console.print(
            "[dim italic]Pre-warming LLM calls (background tasks) are not included.[/]"
        )

    except Exception as e:
        print_error(f"Error setting up conversation test: {e}")
        import traceback
        traceback.print_exc()


@pytest.mark.asyncio
async def test_vignette_selection():
    """Test vignette selection logic."""
    print_header("Testing Vignette Selection Logic")

    try:
        engine = VignetteEngine()
        state = PreferenceElicitationAgentState(session_id=123)

        print_info("Simulating vignette selection across multiple turns...")

        table = Table(box=box.ROUNDED)
        table.add_column("Turn", style="dim")
        table.add_column("Selected Vignette", style="green")
        table.add_column("Category")
        table.add_column("Progress")

        for turn in range(1, 8):
            # Select next vignette
            vignette = engine.select_next_vignette(state)

            if vignette is None:
                print_info("No more vignettes available")
                break

            # Simulate completion
            state.completed_vignettes.append(vignette.vignette_id)
            if turn % 2 == 0:  # Mark category covered every 2 vignettes
                state.mark_category_covered(vignette.category)

            progress = f"{len(state.completed_vignettes)} completed"
            if state.categories_covered:
                 progress += f"\nCovered: {', '.join(state.categories_covered)}"

            table.add_row(
                str(turn),
                f"{vignette.vignette_id}\n[dim]{vignette.scenario_text[:50]}...[/]",
                vignette.category,
                progress
            )
            
        console.print(table)
        console.input("\n[dim]Press Enter to continue...[/]")

    except Exception as e:
        print_error(f"Error testing vignette selection: {e}")
        import traceback
        traceback.print_exc()


@pytest.mark.asyncio
async def test_state_management():
    """Test state management and persistence."""
    print_header("Testing State Management")

    try:
        # Create state
        print_section("Creating State")
        state = PreferenceElicitationAgentState(
            session_id=999,
            conversation_phase="VIGNETTES",
            conversation_turn_count=5,
            completed_vignettes=["financial_001", "remote_commute_001"],
            categories_covered=["financial"],
            categories_to_explore=["work_environment", "job_security"]
        )

        print_success("Created state")
        display_state_info(state)

        # Test state methods
        print_section("Testing State Methods")
        
        log_table = Table(show_header=False, box=box.SIMPLE)

        initial_count = state.conversation_turn_count
        state.increment_turn_count()
        log_table.add_row("Increment Turn", f"{initial_count} -> {state.conversation_turn_count}")

        state.mark_category_covered("work_environment")
        log_table.add_row("Mark Covered", f"Added 'work_environment'")

        next_cat = state.get_next_category_to_explore()
        log_table.add_row("Next Category", next_cat)

        can_complete = state.can_complete()
        log_table.add_row("Can Complete", str(can_complete))
        
        console.print(log_table)

        # Test serialization
        print_section("Testing Serialization")

        # Convert to dict (simulating MongoDB storage)
        state_dict = state.model_dump()
        print_success("Converted state to dictionary")

        # Recreate from dict
        restored_state = PreferenceElicitationAgentState(**state_dict)
        print_success("Restored state from dictionary")

        if state.session_id == restored_state.session_id:
            print_success(f"Session ID MATCH: {state.session_id}")
        else:
            print_error(f"Session ID MISMATCH: {state.session_id} != {restored_state.session_id}")

        console.input("\n[dim]Press Enter to continue...[/]")

    except Exception as e:
        print_error(f"Error testing state management: {e}")
        import traceback
        traceback.print_exc()


async def main_menu():
    """Main menu for interactive testing."""
    print_header("Preference Elicitation Agent - Interactive Test")

    console.print(
        Panel(
            "This interactive test allows you to explore all components of the "
            "preference elicitation agent without needing full backend integration.",
            style="blue", box=box.ROUNDED
        )
    )
    
    # Ask user to set logging level
    print_section("Logging Configuration")
    log_choice = display_menu([
        "INFO - Standard output (recommended for normal testing)",
        "DEBUG - Detailed debug output (for investigating issues)",
        "WARNING - Only warnings and errors"
    ])
    
    log_levels = {
        1: logging.INFO,
        2: logging.DEBUG,
        3: logging.WARNING
    }
    setup_logging(log_levels[log_choice])
    print_success(f"Logging configured to {logging.getLevelName(log_levels[log_choice])} level")

    while True:
        print_section("Main Menu")

        choice = display_menu([
            "Test Vignette Engine (browse vignettes, categories)",
            "Test Preference Vector (create, modify, view)",
            "Test State Management (state methods, persistence)",
            "Test Vignette Selection Logic (adaptive selection)",
            "Full Interactive Conversation (chat with agent)",
            "Full Interactive Conversation - HYBRID MODE (offline + personalization)",
            "Run All Tests",
            "Change Logging Level",
            "Exit"
        ])

        if choice == 1:
            await test_vignette_engine()
        elif choice == 2:
            await test_preference_vector()
        elif choice == 3:
            await test_state_management()
        elif choice == 4:
            await test_vignette_selection()
        elif choice == 5:
            await test_full_conversation(use_hybrid_mode=False)
        elif choice == 6:
            await test_full_conversation(use_hybrid_mode=True)
        elif choice == 7:
            print_info("Running all tests...")
            await test_vignette_engine()
            await test_preference_vector()
            await test_state_management()
            await test_vignette_selection()
            print_success("All component tests complete!")
            print_info("Skipping full conversation test (run manually from menu)")
            console.input("\n[dim]Press Enter to return to menu...[/]")
        elif choice == 8:
            # Change logging level
            print_section("Change Logging Level")
            new_log_choice = display_menu([
                "INFO - Standard output",
                "DEBUG - Detailed debug output",
                "WARNING - Only warnings and errors"
            ])
            setup_logging(log_levels[new_log_choice])
            print_success(f"Logging changed to {logging.getLevelName(log_levels[new_log_choice])} level")
        elif choice == 9:
            print_info("Exiting...")
            break


async def main():
    """Main entry point."""
    try:
        await main_menu()
    except KeyboardInterrupt:
        print_info("\nInterrupted by user. Exiting...")
    except Exception as e:
        print_error(f"\nUnexpected error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
