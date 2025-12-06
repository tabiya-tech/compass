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
from pathlib import Path

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


class Colors:
    """ANSI color codes for terminal output."""
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'


def print_header(text: str):
    """Print a formatted header."""
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*70}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{text.center(70)}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'='*70}{Colors.ENDC}\n")


def print_section(text: str):
    """Print a formatted section header."""
    print(f"\n{Colors.OKBLUE}{Colors.BOLD}{text}{Colors.ENDC}")
    print(f"{Colors.OKBLUE}{'-'*len(text)}{Colors.ENDC}")


def print_agent(text: str):
    """Print agent message."""
    print(f"{Colors.OKGREEN}Agent: {text}{Colors.ENDC}")


def print_user(text: str):
    """Print user message."""
    print(f"{Colors.OKCYAN}You: {text}{Colors.ENDC}")


def print_info(text: str):
    """Print info message."""
    print(f"{Colors.WARNING}ℹ {text}{Colors.ENDC}")


def print_error(text: str):
    """Print error message."""
    print(f"{Colors.FAIL}✗ {text}{Colors.ENDC}")


def print_success(text: str):
    """Print success message."""
    print(f"{Colors.OKGREEN}✓ {text}{Colors.ENDC}")


def get_user_input(prompt: str = "") -> str:
    """Get input from user."""
    if prompt:
        print(f"{Colors.OKCYAN}{prompt}{Colors.ENDC}", end="")
    return input()


def display_menu(options: list[str]) -> int:
    """Display a menu and get user selection."""
    for i, option in enumerate(options, 1):
        print(f"{Colors.OKBLUE}{i}.{Colors.ENDC} {option}")

    while True:
        try:
            choice = int(get_user_input("\nSelect option (number): "))
            if 1 <= choice <= len(options):
                return choice
            print_error(f"Please enter a number between 1 and {len(options)}")
        except ValueError:
            print_error("Please enter a valid number")


def create_sample_experiences() -> list[ExperienceEntity]:
    """Create sample experiences for testing."""
    return [
        ExperienceEntity(
            uuid="exp-1",
            experience_title="Software Developer",
            company="TechCorp Kenya",
            location="Nairobi",
            timeline=Timeline(start="2020", end="2022"),
            work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT
        ),
        ExperienceEntity(
            uuid="exp-2",
            experience_title="Freelance Web Designer",
            company="Self-employed",
            location="Mombasa",
            timeline=Timeline(start="2022", end="2023"),
            work_type=WorkType.SELF_EMPLOYMENT
        ),
        ExperienceEntity(
            uuid="exp-3",
            experience_title="Shop Assistant",
            company="Local Retail Store",
            location="Kisumu",
            timeline=Timeline(start="2019", end="2020"),
            work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT
        )
    ]


def display_preference_vector(pv: PreferenceVector):
    """Display preference vector in a readable format."""
    print_section("Current Preference Vector")

    print(f"\n{Colors.BOLD}Overall Confidence:{Colors.ENDC} {pv.confidence_score:.2f}")

    print(f"\n{Colors.BOLD}Financial Preferences:{Colors.ENDC}")
    print(f"  Importance: {pv.financial.importance:.2f}")
    min_salary = pv.financial.minimum_acceptable_salary
    print(f"  Min Acceptable Salary: ${min_salary:,}" if min_salary is not None else "  Min Acceptable Salary: Not set")
    print(f"  Benefits Importance: {pv.financial.benefits_importance:.2f}")

    print(f"\n{Colors.BOLD}Work Environment:{Colors.ENDC}")
    print(f"  Remote Work: {pv.work_environment.remote_work_preference or 'not_set'}")
    commute = pv.work_environment.commute_tolerance_minutes
    print(f"  Commute Tolerance: {commute} mins" if commute is not None else "  Commute Tolerance: Not set")
    print(f"  Autonomy Importance: {pv.work_environment.autonomy_importance:.2f}")
    print(f"  Flexibility Importance: {pv.work_environment.work_hours_flexibility_importance:.2f}")

    print(f"\n{Colors.BOLD}Job Security:{Colors.ENDC}")
    print(f"  Importance: {pv.job_security.importance:.2f}")
    print(f"  Stability Required: {pv.job_security.income_stability_required}")
    print(f"  Risk Tolerance: {pv.job_security.risk_tolerance}")
    print(f"  Contract Preference: {pv.job_security.contract_type_preference}")

    print(f"\n{Colors.BOLD}Career Advancement:{Colors.ENDC}")
    print(f"  Importance: {pv.career_advancement.importance:.2f}")
    print(f"  Learning Value: {pv.career_advancement.learning_opportunities_value}")
    print(f"  Skill Development: {pv.career_advancement.skill_development_importance:.2f}")

    print(f"\n{Colors.BOLD}Work-Life Balance:{Colors.ENDC}")
    print(f"  Importance: {pv.work_life_balance.importance:.2f}")
    max_hours = pv.work_life_balance.max_acceptable_hours_per_week
    print(f"  Max Hours/Week: {max_hours}" if max_hours is not None else "  Max Hours/Week: Not set")
    print(f"  Weekend Work Tolerance: {pv.work_life_balance.weekend_work_tolerance}")

    print(f"\n{Colors.BOLD}Task Preferences:{Colors.ENDC}")
    print(f"  Social Tasks: {pv.task_preferences.social_tasks_preference:.2f}")
    print(f"  Routine Tasks: {pv.task_preferences.routine_tasks_tolerance:.2f}")
    print(f"  Cognitive Tasks: {pv.task_preferences.cognitive_tasks_preference:.2f}")
    print(f"  Manual Tasks: {pv.task_preferences.manual_tasks_preference:.2f}")


def display_state_info(state: PreferenceElicitationAgentState):
    """Display current agent state information."""
    print_section("Agent State")
    print(f"Session ID: {state.session_id}")
    print(f"Phase: {Colors.BOLD}{state.conversation_phase}{Colors.ENDC}")
    print(f"Turn Count: {state.conversation_turn_count}")
    print(f"Completed Vignettes: {len(state.completed_vignettes)}/{len(state.completed_vignettes) + len(state.categories_to_explore)}")
    print(f"Categories Covered: {', '.join(state.categories_covered) if state.categories_covered else 'None'}")
    print(f"Categories Remaining: {', '.join(state.categories_to_explore)}")

    if state.vignette_responses:
        print(f"\n{Colors.BOLD}Vignette Responses:{Colors.ENDC}")
        for i, response in enumerate(state.vignette_responses, 1):
            print(f"  {i}. {response.vignette_id} - Option {response.chosen_option_id} (confidence: {response.confidence:.2f})")


async def test_vignette_engine():
    """Test the vignette engine component."""
    print_header("Testing Vignette Engine")

    try:
        engine = VignetteEngine()
        print_success(f"Loaded {engine.get_total_vignettes_count()} vignettes")

        # Show categories
        print_section("Vignette Categories")
        counts = engine.get_category_counts()
        for category, count in counts.items():
            print(f"  • {category}: {count} vignette(s)")

        # Browse vignettes
        print_section("Browse Vignettes")
        for category, vignettes in engine._vignettes_by_category.items():
            print(f"\n{Colors.BOLD}{category.upper()}{Colors.ENDC}")
            for v in vignettes:
                print(f"  [{v.vignette_id}] Difficulty: {v.difficulty_level}")
                print(f"  Scenario: {v.scenario_text[:100]}...")
                print(f"  Options: {len(v.options)}")
                print()

        input("\nPress Enter to continue...")

    except Exception as e:
        print_error(f"Error testing vignette engine: {e}")
        import traceback
        traceback.print_exc()


async def test_preference_vector():
    """Test preference vector creation and manipulation."""
    print_header("Testing Preference Vector")

    try:
        # Create default vector
        pv = PreferenceVector()
        print_success("Created default preference vector")
        display_preference_vector(pv)

        # Modify some preferences
        print_section("\nModifying Preferences")
        pv.financial.importance = 0.8
        pv.financial.minimum_acceptable_salary = 60000
        pv.work_environment.remote_work_preference = "strongly_prefer"
        pv.work_environment.commute_tolerance_minutes = 30
        pv.job_security.importance = 0.7
        pv.confidence_score = 0.65

        print_info("Updated financial, work environment, and job security preferences")
        display_preference_vector(pv)

        input("\nPress Enter to continue...")

    except Exception as e:
        print_error(f"Error testing preference vector: {e}")
        import traceback
        traceback.print_exc()


async def test_full_conversation():
    """Test a full conversation with the agent."""
    print_header("Interactive Conversation Test")

    print_info("This will start a conversation with the preference elicitation agent.")
    print_info("You can respond naturally to the agent's questions.")
    print_info("Type 'quit' to exit, 'state' to see current state, 'preferences' to see preference vector.\n")

    try:
        # Create agent
        agent = PreferenceElicitationAgent()
        print_success("Created preference elicitation agent")

        # Create initial state
        sample_experiences = create_sample_experiences()
        print_info(f"Created {len(sample_experiences)} sample experiences:")
        for exp in sample_experiences:
            print(f"  - {exp.experience_title} at {exp.company} ({exp.timeline.start if exp.timeline else 'N/A'} - {exp.timeline.end if exp.timeline else 'N/A'})")

        state = PreferenceElicitationAgentState(
            session_id=12345,
            initial_experiences_snapshot=sample_experiences,
            use_db6_for_fresh_data=False
        )
        agent.set_state(state)
        print_success("Initialized agent state with sample experiences")

        # Debug: Check if user context will be extracted
        print_info("Agent will extract user context from these experiences in INTRO phase...")

        # Create conversation context
        conversation_history = ConversationHistory()

        # Start conversation loop
        turn_index = 0
        while True:
            # Get user input
            if turn_index == 0:
                user_message = ""  # First turn is automatic
                print_info("Starting conversation (first turn is automatic)...\n")
            else:
                user_input = get_user_input("\nYou: ")

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

                user_message = user_input

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
                output = await agent.execute(agent_input, context)

                # Display agent response
                print_agent(output.message_for_user)

                # Show metadata
                print_info(f"Phase: {state.conversation_phase} | Turn: {state.conversation_turn_count} | Response time: {output.agent_response_time_in_sec}s")

                # Debug: Show user context after INTRO phase
                if state.conversation_phase in ["EXPERIENCE_QUESTIONS", "VIGNETTES"] and turn_index == 1:
                    if hasattr(agent, '_user_context') and agent._user_context:
                        ctx = agent._user_context
                        print_section("DEBUG: Extracted User Context")
                        print(f"  Role: {ctx.current_role}")
                        print(f"  Industry: {ctx.industry}")
                        print(f"  Level: {ctx.experience_level}")
                        print(f"  Key Experiences: {ctx.key_experiences}")
                        print(f"  Summary: {ctx.background_summary}")
                    else:
                        print_error("No user context extracted!")

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
                    print_success("\nConversation complete!")
                    print_section("Final Results")
                    display_state_info(state)
                    display_preference_vector(state.preference_vector)
                    break

            except Exception as e:
                print_error(f"Error during conversation: {e}")
                import traceback
                traceback.print_exc()
                break

    except Exception as e:
        print_error(f"Error setting up conversation test: {e}")
        import traceback
        traceback.print_exc()


async def test_vignette_selection():
    """Test vignette selection logic."""
    print_header("Testing Vignette Selection Logic")

    try:
        engine = VignetteEngine()
        state = PreferenceElicitationAgentState(session_id=123)

        print_info("Simulating vignette selection across multiple turns...\n")

        for turn in range(1, 8):
            print(f"\n{Colors.BOLD}Turn {turn}:{Colors.ENDC}")

            # Select next vignette
            vignette = engine.select_next_vignette(state)

            if vignette is None:
                print_info("No more vignettes available")
                break

            print(f"Selected: {Colors.OKGREEN}{vignette.vignette_id}{Colors.ENDC}")
            print(f"Category: {vignette.category}")
            print(f"Difficulty: {vignette.difficulty_level}")
            print(f"Scenario: {vignette.scenario_text[:80]}...")

            # Simulate completion
            state.completed_vignettes.append(vignette.vignette_id)
            if turn % 2 == 0:  # Mark category covered every 2 vignettes
                state.mark_category_covered(vignette.category)

            print(f"Categories covered: {', '.join(state.categories_covered) if state.categories_covered else 'None'}")
            print(f"Completed: {len(state.completed_vignettes)}")

        input("\nPress Enter to continue...")

    except Exception as e:
        print_error(f"Error testing vignette selection: {e}")
        import traceback
        traceback.print_exc()


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
        print_section("\nTesting State Methods")

        print("Testing increment_turn_count()...")
        initial_count = state.conversation_turn_count
        state.increment_turn_count()
        print_success(f"Turn count: {initial_count} → {state.conversation_turn_count}")

        print("\nTesting mark_category_covered()...")
        state.mark_category_covered("work_environment")
        print_success(f"Covered: {', '.join(state.categories_covered)}")
        print_success(f"Remaining: {', '.join(state.categories_to_explore)}")

        print("\nTesting get_next_category_to_explore()...")
        next_cat = state.get_next_category_to_explore()
        print_success(f"Next category: {next_cat}")

        print("\nTesting can_complete()...")
        can_complete = state.can_complete()
        print_info(f"Can complete: {can_complete}")
        print_info(f"  - Min vignettes (3): {len(state.completed_vignettes) >= 3}")
        print_info(f"  - Min categories (2): {len(state.categories_covered) >= 2}")
        print_info(f"  - Min confidence (0.4): {state.preference_vector.confidence_score >= 0.4}")

        # Test serialization
        print_section("\nTesting Serialization")

        # Convert to dict (simulating MongoDB storage)
        state_dict = state.model_dump()
        print_success("Converted state to dictionary")

        # Recreate from dict
        restored_state = PreferenceElicitationAgentState(**state_dict)
        print_success("Restored state from dictionary")

        print(f"\nOriginal session_id: {state.session_id}")
        print(f"Restored session_id: {restored_state.session_id}")
        print(f"Match: {state.session_id == restored_state.session_id}")

        input("\nPress Enter to continue...")

    except Exception as e:
        print_error(f"Error testing state management: {e}")
        import traceback
        traceback.print_exc()


async def main_menu():
    """Main menu for interactive testing."""
    print_header("Preference Elicitation Agent - Interactive Test")

    print(f"{Colors.OKBLUE}This interactive test allows you to explore all components of the")
    print(f"preference elicitation agent without needing full backend integration.{Colors.ENDC}\n")

    while True:
        print_section("Main Menu")

        choice = display_menu([
            "Test Vignette Engine (browse vignettes, categories)",
            "Test Preference Vector (create, modify, view)",
            "Test State Management (state methods, persistence)",
            "Test Vignette Selection Logic (adaptive selection)",
            "Full Interactive Conversation (chat with agent)",
            "Run All Tests",
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
            await test_full_conversation()
        elif choice == 6:
            print_info("\nRunning all tests...\n")
            await test_vignette_engine()
            await test_preference_vector()
            await test_state_management()
            await test_vignette_selection()
            print_success("\nAll component tests complete!")
            print_info("Skipping full conversation test (run manually from menu)")
            input("\nPress Enter to return to menu...")
        elif choice == 7:
            print_info("\nExiting...")
            break


async def main():
    """Main entry point."""
    try:
        await main_menu()
    except KeyboardInterrupt:
        print_info("\n\nInterrupted by user. Exiting...")
    except Exception as e:
        print_error(f"\nUnexpected error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
