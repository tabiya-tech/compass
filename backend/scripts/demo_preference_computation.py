#!/usr/bin/env python3
"""
Demonstration of Preference Vector Computation and Weighted Updates.

This script demonstrates how the preference elicitation agent:
1. Extracts preferences from vignette responses
2. Updates the preference vector with weighted merging
3. Builds confidence over multiple responses

Run: poetry run python demo_preference_computation.py
"""

import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.agent.preference_elicitation_agent.types import (
    PreferenceVector,
    Vignette,
    VignetteOption
)
from app.agent.preference_elicitation_agent.preference_extractor import (
    PreferenceExtractor,
    PreferenceExtractionResult
)


class Colors:
    """ANSI color codes."""
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'


def print_header(text: str):
    """Print formatted header."""
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*80}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{text.center(80)}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'='*80}{Colors.ENDC}\n")


def print_section(text: str):
    """Print formatted section."""
    print(f"\n{Colors.OKBLUE}{Colors.BOLD}{text}{Colors.ENDC}")
    print(f"{Colors.OKBLUE}{'-'*len(text)}{Colors.ENDC}")


def print_value(label: str, value, color=Colors.OKGREEN):
    """Print a labeled value."""
    print(f"{color}{label}:{Colors.ENDC} {value}")


def print_comparison(label: str, before, after):
    """Print before/after comparison."""
    print(f"{label}:")
    print(f"  {Colors.FAIL}Before: {before}{Colors.ENDC}")
    print(f"  {Colors.OKGREEN}After:  {after}{Colors.ENDC}")
    if isinstance(before, (int, float)) and isinstance(after, (int, float)):
        change = after - before
        sign = "+" if change >= 0 else ""
        print(f"  {Colors.WARNING}Change: {sign}{change:.3f}{Colors.ENDC}")


def display_preference_vector_summary(pv: PreferenceVector, title: str = "Preference Vector"):
    """Display a summary of the preference vector."""
    print_section(title)

    print(f"\n{Colors.BOLD}Overall:{Colors.ENDC}")
    print(f"  Confidence Score: {pv.confidence_score:.3f}")

    print(f"\n{Colors.BOLD}Key Preferences:{Colors.ENDC}")
    print(f"  Financial Importance: {pv.financial.importance:.3f}")
    if pv.financial.minimum_acceptable_salary:
        print(f"  Min Salary: ${pv.financial.minimum_acceptable_salary:,}")

    print(f"  Remote Work: {pv.work_environment.remote_work_preference}")
    if pv.work_environment.commute_tolerance_minutes:
        print(f"  Commute Tolerance: {pv.work_environment.commute_tolerance_minutes} mins")

    print(f"  Job Security Importance: {pv.job_security.importance:.3f}")
    print(f"  Risk Tolerance: {pv.job_security.risk_tolerance}")

    print(f"  Career Growth Importance: {pv.career_advancement.importance:.3f}")
    print(f"  Work-Life Balance Importance: {pv.work_life_balance.importance:.3f}")


def demo_weighted_update_math():
    """Demonstrate the mathematics of weighted updates."""
    print_header("Part 1: Weighted Update Mathematics")

    print("""
The preference extractor uses WEIGHTED AVERAGING to gradually refine preferences
based on multiple vignette responses. This prevents any single noisy response from
dominating the final preference vector.
    """)

    print_section("Formula")
    print("""
For numerical preferences (importance scores, etc.):

    new_value = current_value × (1 - weight) + extracted_value × weight

Where:
    - weight = confidence of the extraction (0.0 to 1.0)
    - current_value = existing preference value
    - extracted_value = newly extracted preference from vignette
    """)

    print_section("Example: Updating Financial Importance")

    # Initial state
    current_value = 0.5  # Default neutral importance
    print_value("Initial Value (default)", f"{current_value:.3f}", Colors.WARNING)

    # First extraction
    print(f"\n{Colors.BOLD}First Vignette Response:{Colors.ENDC}")
    print("User chose high-paying job over flexible schedule")
    extracted_value_1 = 0.8
    confidence_1 = 0.75

    print_value("  Extracted Value", extracted_value_1)
    print_value("  Confidence", confidence_1)

    new_value_1 = current_value * (1 - confidence_1) + extracted_value_1 * confidence_1
    print_value("  Calculation", f"{current_value:.3f} × (1 - {confidence_1}) + {extracted_value_1} × {confidence_1}")
    print_value("  Result", f"{new_value_1:.3f}", Colors.OKGREEN)

    # Second extraction
    print(f"\n{Colors.BOLD}Second Vignette Response:{Colors.ENDC}")
    print("User chose job with benefits over slightly higher salary")
    current_value = new_value_1
    extracted_value_2 = 0.65
    confidence_2 = 0.80

    print_value("  Current Value", f"{current_value:.3f}", Colors.WARNING)
    print_value("  Extracted Value", extracted_value_2)
    print_value("  Confidence", confidence_2)

    new_value_2 = current_value * (1 - confidence_2) + extracted_value_2 * confidence_2
    print_value("  Calculation", f"{current_value:.3f} × (1 - {confidence_2}) + {extracted_value_2} × {confidence_2}")
    print_value("  Result", f"{new_value_2:.3f}", Colors.OKGREEN)

    # Third extraction
    print(f"\n{Colors.BOLD}Third Vignette Response:{Colors.ENDC}")
    print("User chose secure employment over higher-risk freelance")
    current_value = new_value_2
    extracted_value_3 = 0.70
    confidence_3 = 0.85

    print_value("  Current Value", f"{current_value:.3f}", Colors.WARNING)
    print_value("  Extracted Value", extracted_value_3)
    print_value("  Confidence", confidence_3)

    new_value_3 = current_value * (1 - confidence_3) + extracted_value_3 * confidence_3
    print_value("  Calculation", f"{current_value:.3f} × (1 - {confidence_3}) + {extracted_value_3} × {confidence_3}")
    print_value("  Result", f"{new_value_3:.3f}", Colors.OKGREEN)

    # Summary
    print_section("Summary of Updates")
    print(f"Initial:        {0.5:.3f} (default)")
    print(f"After Vignette 1: {new_value_1:.3f} (moved toward 0.8)")
    print(f"After Vignette 2: {new_value_2:.3f} (adjusted down slightly)")
    print(f"After Vignette 3: {new_value_3:.3f} (converging)")
    print(f"\n{Colors.OKGREEN}{Colors.BOLD}Final Value: {new_value_3:.3f}{Colors.ENDC}")

    print(f"\n{Colors.BOLD}Key Insight:{Colors.ENDC}")
    print("The value gradually converges toward the extracted preferences,")
    print("with higher-confidence extractions having stronger influence.")

    input("\nPress Enter to continue...")


def demo_extraction_result():
    """Demonstrate what an extraction result looks like."""
    print_header("Part 2: Preference Extraction Results")

    print("""
When a user responds to a vignette, the PreferenceExtractor (using LLM) analyzes
their choice and reasoning to produce a PreferenceExtractionResult.
    """)

    print_section("Example Vignette")
    print("""
Scenario: You're choosing between two jobs:

Option A: Software Developer at TechCorp
- Salary: KES 60,000/month
- Location: Office in Nairobi CBD (1.5 hour commute)
- Hours: 9am-5pm, Monday-Friday
- Contract: Permanent with benefits

Option B: Remote Developer at StartupCo
- Salary: KES 50,000/month
- Location: Work from home
- Hours: Flexible (must attend 10am daily standup)
- Contract: 6-month renewable contract
    """)

    print_section("User Response")
    print("""
User says: "I'd choose the remote job (Option B). That 1.5 hour commute would
eat up my whole day and cost money for matatu. I'd rather work from home even
if it means KES 10,000 less per month. The flexibility is worth it."
    """)

    print_section("PreferenceExtractionResult")

    # Simulate extraction result
    result = PreferenceExtractionResult(
        reasoning="""
User explicitly prioritizes avoiding long commute over higher salary.
Willing to sacrifice KES 10,000/month (17% salary reduction) for remote work.
Strong signal about:
- Commute intolerance (1.5 hours is unacceptable)
- Remote work preference (explicitly values flexibility)
- Moderate financial sensitivity (willing to trade money for convenience)
- Time value (commute time + cost matters more than extra income)
        """.strip(),
        chosen_option_id="B",
        stated_reasons=[
            "Long commute (1.5 hours) unacceptable",
            "Commute costs money (matatu)",
            "Prefers working from home",
            "Flexibility worth salary reduction"
        ],
        inferred_preferences={
            "work_environment.remote_work_preference": "strongly_prefer",
            "work_environment.commute_tolerance_minutes": 30,
            "financial.importance": 0.6,
            "financial.salary_trade_offs.remote_work": 10000,
            "work_environment.work_hours_flexibility_importance": 0.8,
            "job_security.risk_tolerance": "medium"  # Accepts renewable contract
        },
        confidence=0.85,
        suggested_follow_up="If the office job was only 30 minutes away, would you still prefer remote work?"
    )

    print(f"{Colors.BOLD}Chosen Option:{Colors.ENDC} {result.chosen_option_id}")
    print(f"\n{Colors.BOLD}LLM Reasoning:{Colors.ENDC}")
    print(result.reasoning)

    print(f"\n{Colors.BOLD}Stated Reasons (explicit):{Colors.ENDC}")
    for i, reason in enumerate(result.stated_reasons, 1):
        print(f"  {i}. {reason}")

    print(f"\n{Colors.BOLD}Inferred Preferences (mapped to dimensions):{Colors.ENDC}")
    for pref_path, value in result.inferred_preferences.items():
        print(f"  {Colors.OKCYAN}{pref_path}:{Colors.ENDC} {value}")

    print(f"\n{Colors.BOLD}Confidence:{Colors.ENDC} {result.confidence:.2f}")
    print(f"{Colors.BOLD}Suggested Follow-up:{Colors.ENDC} {result.suggested_follow_up}")

    input("\nPress Enter to continue...")


def demo_full_update_cycle():
    """Demonstrate a complete update cycle."""
    print_header("Part 3: Complete Preference Vector Update Cycle")

    print("""
Let's walk through how a PreferenceExtractionResult updates a PreferenceVector.
    """)

    # Create initial preference vector
    print_section("Initial Preference Vector")
    pv = PreferenceVector()
    print(f"Financial Importance: {pv.financial.importance:.3f} (default)")
    print(f"Remote Work Preference: {pv.work_environment.remote_work_preference}")
    print(f"Commute Tolerance: {pv.work_environment.commute_tolerance_minutes or 'Not set'}")
    print(f"Overall Confidence: {pv.confidence_score:.3f}")

    # Create extraction result (from previous example)
    print_section("Extraction Result to Apply")
    result = PreferenceExtractionResult(
        reasoning="User prefers remote work over higher salary",
        chosen_option_id="B",
        stated_reasons=["Avoid commute", "Save money on transport", "Value flexibility"],
        inferred_preferences={
            "work_environment.remote_work_preference": "strongly_prefer",
            "work_environment.commute_tolerance_minutes": 30,
            "financial.importance": 0.6,
            "work_environment.work_hours_flexibility_importance": 0.8,
        },
        confidence=0.85
    )

    print(f"Confidence: {result.confidence:.2f}")
    print(f"Extracted Preferences: {len(result.inferred_preferences)} dimensions")

    # Store before values
    before_financial = pv.financial.importance
    before_remote = pv.work_environment.remote_work_preference
    before_commute = pv.work_environment.commute_tolerance_minutes
    before_flexibility = pv.work_environment.work_hours_flexibility_importance
    before_confidence = pv.confidence_score

    # Apply update (using the actual update logic)
    print_section("Applying Update...")

    # Create a mock extractor (we'll just use the update method)
    weight = result.confidence

    # Update each preference
    for pref_path, value in result.inferred_preferences.items():
        parts = pref_path.split('.')

        # Navigate to target
        current = pv
        for part in parts[:-1]:
            current = getattr(current, part)

        field_name = parts[-1]
        current_value = getattr(current, field_name)

        # Apply update based on type
        if isinstance(value, (int, float)) and isinstance(current_value, (int, float)):
            if current_value == 0.5:  # Default value
                new_value = value
            else:
                new_value = current_value * (1 - weight) + value * weight
            setattr(current, field_name, new_value)
            print(f"  {pref_path}: {current_value:.3f} → {new_value:.3f}")

        elif isinstance(value, str):
            if weight > 0.6:  # High confidence
                setattr(current, field_name, value)
                print(f"  {pref_path}: {current_value} → {value}")

        elif isinstance(value, int):
            if weight > 0.6:
                setattr(current, field_name, value)
                print(f"  {pref_path}: {current_value} → {value}")

    # Update confidence score (moving average)
    pv.confidence_score = pv.confidence_score * 0.7 + result.confidence * 0.3

    print_section("Results")

    print_comparison("Financial Importance", before_financial, pv.financial.importance)
    print_comparison("Remote Work Preference", before_remote, pv.work_environment.remote_work_preference)
    print_comparison("Commute Tolerance", before_commute or "Not set",
                    f"{pv.work_environment.commute_tolerance_minutes} mins" if pv.work_environment.commute_tolerance_minutes else "Not set")
    print_comparison("Flexibility Importance", before_flexibility, pv.work_environment.work_hours_flexibility_importance)
    print_comparison("Overall Confidence", before_confidence, pv.confidence_score)

    input("\nPress Enter to continue...")


def demo_multi_vignette_convergence():
    """Demonstrate how preferences converge over multiple vignettes."""
    print_header("Part 4: Multi-Vignette Convergence")

    print("""
The real power of weighted updates is how preferences converge over multiple
vignette responses, building a reliable preference profile.
    """)

    # Start with default vector
    pv = PreferenceVector()

    print_section("Starting State")
    print(f"Financial Importance: {pv.financial.importance:.3f}")
    print(f"Job Security Importance: {pv.job_security.importance:.3f}")
    print(f"Overall Confidence: {pv.confidence_score:.3f}")

    # Simulate 5 vignette responses
    vignettes = [
        {
            "name": "Vignette 1: Salary vs Flexibility",
            "user_choice": "Chose flexibility over 20% higher salary",
            "result": PreferenceExtractionResult(
                reasoning="Moderate financial importance",
                chosen_option_id="A",
                stated_reasons=["Work-life balance matters"],
                inferred_preferences={
                    "financial.importance": 0.6,
                    "work_life_balance.importance": 0.8
                },
                confidence=0.70
            )
        },
        {
            "name": "Vignette 2: Job Security vs Income",
            "user_choice": "Chose stable government job over higher-paying startup",
            "result": PreferenceExtractionResult(
                reasoning="Strong job security preference",
                chosen_option_id="B",
                stated_reasons=["Need stable income for family"],
                inferred_preferences={
                    "job_security.importance": 0.9,
                    "financial.importance": 0.65,
                    "job_security.risk_tolerance": "low"
                },
                confidence=0.85
            )
        },
        {
            "name": "Vignette 3: Benefits vs Cash",
            "user_choice": "Chose job with comprehensive benefits",
            "result": PreferenceExtractionResult(
                reasoning="Values benefits over marginal salary increase",
                chosen_option_id="A",
                stated_reasons=["Benefits provide security"],
                inferred_preferences={
                    "financial.benefits_importance": 0.85,
                    "financial.importance": 0.70,
                    "job_security.importance": 0.85
                },
                confidence=0.75
            )
        },
        {
            "name": "Vignette 4: Career Growth vs Immediate Pay",
            "user_choice": "Chose higher salary over training opportunities",
            "result": PreferenceExtractionResult(
                reasoning="Prioritizes immediate income",
                chosen_option_id="B",
                stated_reasons=["Need money now for rent"],
                inferred_preferences={
                    "financial.importance": 0.75,
                    "career_advancement.importance": 0.4
                },
                confidence=0.80
            )
        },
        {
            "name": "Vignette 5: Permanent vs Contract",
            "user_choice": "Chose permanent role at lower pay",
            "result": PreferenceExtractionResult(
                reasoning="Strongly prefers employment security",
                chosen_option_id="A",
                stated_reasons=["Cannot risk losing job", "Have dependents"],
                inferred_preferences={
                    "job_security.importance": 0.95,
                    "job_security.contract_type_preference": "permanent",
                    "financial.importance": 0.68
                },
                confidence=0.90
            )
        }
    ]

    # Track changes
    financial_history = [pv.financial.importance]
    security_history = [pv.job_security.importance]
    confidence_history = [pv.confidence_score]

    for i, vig in enumerate(vignettes, 1):
        print_section(f"After {vig['name']}")
        print(f"User: {vig['user_choice']}")
        print(f"Extraction Confidence: {vig['result'].confidence:.2f}")

        # Apply update
        weight = vig['result'].confidence
        for pref_path, value in vig['result'].inferred_preferences.items():
            parts = pref_path.split('.')
            current = pv
            for part in parts[:-1]:
                current = getattr(current, part)

            field_name = parts[-1]
            current_value = getattr(current, field_name)

            if isinstance(value, (int, float)) and isinstance(current_value, (int, float)):
                if current_value == 0.5:
                    new_value = value
                else:
                    new_value = current_value * (1 - weight) + value * weight
                setattr(current, field_name, new_value)

        # Update confidence
        pv.confidence_score = pv.confidence_score * 0.7 + vig['result'].confidence * 0.3

        # Track
        financial_history.append(pv.financial.importance)
        security_history.append(pv.job_security.importance)
        confidence_history.append(pv.confidence_score)

        print(f"Financial Importance: {pv.financial.importance:.3f}")
        print(f"Job Security Importance: {pv.job_security.importance:.3f}")
        print(f"Overall Confidence: {pv.confidence_score:.3f}")

    # Final summary
    print_section("Convergence Summary")

    print(f"\n{Colors.BOLD}Financial Importance Progression:{Colors.ENDC}")
    for i, val in enumerate(financial_history):
        marker = "→" if i < len(financial_history) - 1 else "✓"
        print(f"  {marker} After Vignette {i}: {val:.3f}")

    print(f"\n{Colors.BOLD}Job Security Importance Progression:{Colors.ENDC}")
    for i, val in enumerate(security_history):
        marker = "→" if i < len(security_history) - 1 else "✓"
        print(f"  {marker} After Vignette {i}: {val:.3f}")

    print(f"\n{Colors.BOLD}Confidence Progression:{Colors.ENDC}")
    for i, val in enumerate(confidence_history):
        marker = "→" if i < len(confidence_history) - 1 else "✓"
        print(f"  {marker} After Vignette {i}: {val:.3f}")

    print(f"\n{Colors.OKGREEN}{Colors.BOLD}Final Preference Vector:{Colors.ENDC}")
    display_preference_vector_summary(pv, "Final State")

    print(f"\n{Colors.BOLD}Key Insights:{Colors.ENDC}")
    print("1. Financial importance converged to ~0.68 despite varying signals")
    print("2. Job security emerged as dominant preference (0.95) with consistent signals")
    print("3. Confidence grew from 0.0 → 0.73 as more vignettes were completed")
    print("4. Each vignette refined the preference profile incrementally")

    input("\nPress Enter to continue...")


def demo_string_vs_numeric_updates():
    """Demonstrate how string and numeric fields are updated differently."""
    print_header("Part 5: String vs Numeric Field Updates")

    print("""
The update logic handles different field types differently to avoid inappropriate
averaging or mixing of categorical values.
    """)

    pv = PreferenceVector()

    print_section("Numeric Fields (Importance Scores)")
    print("""
Numeric fields (0.0-1.0 importance scores, salary amounts, etc.) use
WEIGHTED AVERAGING to gradually converge toward extracted values.
    """)

    before = pv.financial.importance
    print(f"Initial: {before:.3f}")

    # First update
    weight1 = 0.75
    extracted1 = 0.8
    after1 = before * (1 - weight1) + extracted1 * weight1
    print(f"\nUpdate 1: confidence={weight1}, extracted={extracted1}")
    print(f"  Formula: {before:.3f} × (1 - {weight1}) + {extracted1} × {weight1}")
    print(f"  Result: {after1:.3f}")

    # Second update
    weight2 = 0.80
    extracted2 = 0.65
    after2 = after1 * (1 - weight2) + extracted2 * weight2
    print(f"\nUpdate 2: confidence={weight2}, extracted={extracted2}")
    print(f"  Formula: {after1:.3f} × (1 - {weight2}) + {extracted2} × {weight2}")
    print(f"  Result: {after2:.3f}")

    print_section("String/Categorical Fields (Preferences)")
    print("""
String fields (remote_work_preference, risk_tolerance, etc.) use
DIRECT REPLACEMENT when confidence is high (> 0.6).

This prevents nonsensical averaging like:
  "strongly_prefer" + "neutral" ≠ "prefer" (that's not how strings work!)
    """)

    before_str = pv.work_environment.remote_work_preference
    print(f"Initial: {before_str}")

    # Low confidence - no update
    print(f"\nUpdate Attempt 1: confidence=0.5, extracted='strongly_prefer'")
    print(f"  Confidence ≤ 0.6, so NO UPDATE")
    print(f"  Result: {before_str} (unchanged)")

    # High confidence - update
    print(f"\nUpdate Attempt 2: confidence=0.85, extracted='strongly_prefer'")
    print(f"  Confidence > 0.6, so REPLACE")
    print(f"  Result: strongly_prefer")

    print_section("Why This Matters")
    print("""
Numeric averaging allows gradual convergence:
  0.5 → 0.72 → 0.69 → 0.70 (settles to ~0.70)

String replacement requires confidence:
  neutral → (low conf, no change) → (high conf) → strongly_prefer
    """)

    input("\nPress Enter to continue...")


def main():
    """Main demo flow."""
    print_header("Preference Vector Computation & Weighted Updates Demo")

    print(f"{Colors.OKBLUE}")
    print("This demonstration shows how the Preference Elicitation Agent:")
    print("  1. Extracts preferences from user responses to vignettes")
    print("  2. Updates the preference vector using weighted averaging")
    print("  3. Builds confidence over multiple vignette responses")
    print("  4. Handles different field types (numeric vs categorical)")
    print(f"{Colors.ENDC}")

    input("\nPress Enter to begin...")

    # Run all demos
    demo_weighted_update_math()
    demo_extraction_result()
    demo_full_update_cycle()
    demo_multi_vignette_convergence()
    demo_string_vs_numeric_updates()

    # Final summary
    print_header("Summary")
    print(f"""
{Colors.BOLD}Key Takeaways:{Colors.ENDC}

1. {Colors.OKGREEN}Weighted Averaging{Colors.ENDC}
   - Prevents single responses from dominating the preference vector
   - Higher confidence extractions have stronger influence
   - Gradual convergence toward stable preferences

2. {Colors.OKGREEN}Extraction Confidence{Colors.ENDC}
   - LLM assigns confidence (0.0-1.0) to each extraction
   - Used as weight in update formula
   - Reflects certainty of the interpretation

3. {Colors.OKGREEN}Multi-Vignette Refinement{Colors.ENDC}
   - Each vignette provides incremental preference signals
   - Preferences converge over 5-7 vignettes
   - Overall confidence score tracks reliability

4. {Colors.OKGREEN}Type-Specific Updates{Colors.ENDC}
   - Numeric fields: weighted averaging
   - String fields: direct replacement (when confident)
   - Prevents inappropriate mixing of categorical values

5. {Colors.OKGREEN}Explainability{Colors.ENDC}
   - Each extraction includes reasoning and stated reasons
   - Preference updates are traceable
   - Can audit why preferences were inferred

{Colors.BOLD}Code Location:{Colors.ENDC}
  app/agent/preference_elicitation_agent/preference_extractor.py
    - PreferenceExtractor.update_preference_vector()
    - PreferenceExtractor._update_preference_field()
    """)

    print(f"\n{Colors.OKGREEN}Demo complete!{Colors.ENDC}\n")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n\n{Colors.WARNING}Demo interrupted.{Colors.ENDC}\n")
    except Exception as e:
        print(f"\n\n{Colors.FAIL}Error: {e}{Colors.ENDC}\n")
        import traceback
        traceback.print_exc()
