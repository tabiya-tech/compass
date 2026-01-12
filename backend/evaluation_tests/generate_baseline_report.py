#!/usr/bin/env python3
"""
Baseline Metrics Report Generator

Generates a CSV report from baseline metrics collected during E2E tests.
Supports timestamped daily reports and optional run labels for tracking
optimization experiments.

Usage:
    # Default: auto-generates run_label like "run_20260112_143022"
    python generate_baseline_report.py
    
    # Custom label for tracking specific optimization
    python generate_baseline_report.py --run-label "baseline"
    python generate_baseline_report.py --run-label "v1_achievement_prompts"
    
    # Specify custom test_output directory
    python generate_baseline_report.py --input-dir ./custom_test_output
"""

import argparse
import csv
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional


def find_baseline_metrics(input_dir: Path) -> List[Path]:
    """Find all baseline_metrics.json files in the test output directory."""
    metrics_files = list(input_dir.glob("*/baseline_metrics.json"))
    return sorted(metrics_files, key=lambda p: p.stat().st_mtime)


def extract_metrics(metrics_path: Path) -> Optional[Dict[str, Any]]:
    """Extract relevant metrics from a baseline_metrics.json file."""
    try:
        with open(metrics_path, 'r') as f:
            data = json.load(f)
        
        # Extract folder timestamp from parent directory name
        folder_name = metrics_path.parent.name
        # Format: 2026-01-12T16:02:15.483622+00:00_e2e_test_golden_simple_formal_employment
        folder_timestamp = folder_name.split('_e2e_test_')[0] if '_e2e_test_' in folder_name else None
        
        return {
            'test_case_name': data.get('test_case_name', 'unknown'),
            'timestamp': folder_timestamp or data.get('started_at', ''),
            'session_id': data.get('session_id', ''),
            'total_turns': data.get('total_turn_count', 0),
            'total_time_sec': round(data.get('total_conversation_time_sec', 0), 2),
            'total_llm_calls': data.get('total_llm_calls', 0),
            'experiences_discovered': data.get('experience_metrics', {}).get('experiences_discovered', 0),
            'experiences_explored': data.get('experience_metrics', {}).get('experiences_explored', 0),
            'avg_skills_per_experience': round(
                data.get('experience_metrics', {}).get('avg_skills_per_experience', 0), 2
            ),
            'repetition_rate': round(
                data.get('repetition_metrics', {}).get('repetition_rate', 0), 4
            ),
            'starter_diversity_score': round(
                data.get('phrase_repetition_metrics', {}).get('starter_diversity_score', 0), 4
            ),
            'top_starter_repetition_rate': round(
                data.get('phrase_repetition_metrics', {}).get('top_starter_repetition_rate', 0), 4
            ),
            'most_common_starter': data.get('phrase_repetition_metrics', {}).get('most_common_starter', ''),
            'achievement_question_rate': round(
                data.get('question_quality_metrics', {}).get('achievement_question_rate', 0), 2
            ),
            'routine_task_rate': round(
                data.get('question_quality_metrics', {}).get('routine_task_rate', 0), 2
            ),
        }
    except Exception as e:
        print(f"  Warning: Failed to parse {metrics_path}: {e}")
        return None


def generate_run_label() -> str:
    """Generate a default run label with current timestamp."""
    return datetime.now().strftime("run_%Y%m%d_%H%M%S")


def get_report_path(output_dir: Path) -> Path:
    """Get the report file path for today's date."""
    today = datetime.now().strftime("%Y-%m-%d")
    return output_dir / f"baseline_report_{today}.csv"


def write_csv_report(
    report_path: Path,
    metrics_list: List[Dict[str, Any]],
    run_label: str
) -> None:
    """Write or append metrics to CSV report."""
    
    # Define column order
    fieldnames = [
        'run_label',
        'test_case_name',
        'timestamp',
        'total_turns',
        'total_time_sec',
        'total_llm_calls',
        'experiences_discovered',
        'experiences_explored',
        'avg_skills_per_experience',
        'repetition_rate',
        'starter_diversity_score',
        'top_starter_repetition_rate',
        'most_common_starter',
        'achievement_question_rate',
        'routine_task_rate',
    ]
    
    # Check if file exists to determine if we need headers
    file_exists = report_path.exists()
    
    # Ensure reports directory exists
    report_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(report_path, 'a', newline='') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        
        if not file_exists:
            writer.writeheader()
        
        for metrics in metrics_list:
            row = {'run_label': run_label, **metrics}
            # Remove session_id from output (not in fieldnames)
            row.pop('session_id', None)
            writer.writerow(row)


def print_summary(metrics_list: List[Dict[str, Any]], run_label: str) -> None:
    """Print a summary of the metrics to console."""
    if not metrics_list:
        print("\nNo metrics found to summarize.")
        return
    
    print("\n" + "=" * 70)
    print(f"BASELINE METRICS REPORT - Run: {run_label}")
    print("=" * 70)
    
    print(f"\nTest cases analyzed: {len(metrics_list)}")
    
    # Calculate averages
    avg_turns = sum(m['total_turns'] for m in metrics_list) / len(metrics_list)
    avg_time = sum(m['total_time_sec'] for m in metrics_list) / len(metrics_list)
    avg_llm_calls = sum(m['total_llm_calls'] for m in metrics_list) / len(metrics_list)
    avg_skills = sum(m['avg_skills_per_experience'] for m in metrics_list) / len(metrics_list)
    avg_repetition = sum(m['repetition_rate'] for m in metrics_list) / len(metrics_list)
    avg_starter_diversity = sum(m['starter_diversity_score'] for m in metrics_list) / len(metrics_list)
    avg_starter_repetition = sum(m['top_starter_repetition_rate'] for m in metrics_list) / len(metrics_list)
    avg_achievement = sum(m['achievement_question_rate'] for m in metrics_list) / len(metrics_list)
    avg_routine = sum(m['routine_task_rate'] for m in metrics_list) / len(metrics_list)
    
    print("\n--- Performance Metrics ---")
    print(f"  Avg turns per conversation:     {avg_turns:.1f}")
    print(f"  Avg LLM processing time:        {avg_time:.1f}s")
    print(f"  Avg LLM calls:                  {avg_llm_calls:.1f}")
    print(f"  Avg skills per experience:      {avg_skills:.1f}")
    
    print("\n--- Repetition Metrics ---")
    print(f"  Semantic repetition rate:       {avg_repetition:.2%}")
    print(f"  Starter phrase diversity:       {avg_starter_diversity:.2%} (higher = better)")
    print(f"  Top starter repetition rate:    {avg_starter_repetition:.2%} (lower = better)")
    
    # Most common starters across all tests
    starter_counts: Dict[str, int] = {}
    for m in metrics_list:
        starter = m.get('most_common_starter', '')
        if starter:
            starter_counts[starter] = starter_counts.get(starter, 0) + 1
    if starter_counts:
        most_common = max(starter_counts.items(), key=lambda x: x[1])
        print(f"  Most overused starter overall:  \"{most_common[0]}\" ({most_common[1]} test cases)")
    
    print("\n--- Question Quality Metrics ---")
    print(f"  Achievement question rate:      {avg_achievement:.1f}%")
    print(f"  Routine task question rate:     {avg_routine:.1f}%")
    
    # Optimization flags
    print("\n--- Optimization Opportunities ---")
    flags = []
    
    if avg_achievement < 10:
        flags.append(f"  [!] Low achievement question rate ({avg_achievement:.1f}%) - Consider prompting for accomplishments, challenges overcome")
    
    if avg_starter_repetition > 0.4:
        flags.append(f"  [!] High starter phrase repetition ({avg_starter_repetition:.1%}) - Agent may sound robotic")
    
    if avg_routine > 25:
        flags.append(f"  [!] High routine task question rate ({avg_routine:.1f}%) - Consider more differentiation-focused questions")
    
    if avg_repetition > 0.1:
        flags.append(f"  [!] Semantic question repetition detected ({avg_repetition:.1%})")
    
    if flags:
        for flag in flags:
            print(flag)
    else:
        print("  No major optimization flags detected.")
    
    print("\n" + "=" * 70)
    
    # Per test case summary table
    print("\n--- Per Test Case Summary ---")
    print(f"{'Test Case':<45} {'Turns':>6} {'Time':>8} {'Achieve%':>9} {'Routine%':>9}")
    print("-" * 80)
    for m in metrics_list:
        name = m['test_case_name'][:44]
        print(f"{name:<45} {m['total_turns']:>6} {m['total_time_sec']:>7.1f}s {m['achievement_question_rate']:>8.1f}% {m['routine_task_rate']:>8.1f}%")
    
    print()


def main():
    parser = argparse.ArgumentParser(
        description='Generate CSV report from baseline metrics',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python generate_baseline_report.py
  python generate_baseline_report.py --run-label "baseline"
  python generate_baseline_report.py --run-label "v1_achievement_prompts"
        """
    )
    
    parser.add_argument(
        '--run-label',
        type=str,
        default=None,
        help='Label for this run (default: auto-generated timestamp)'
    )
    
    parser.add_argument(
        '--input-dir',
        type=str,
        default=None,
        help='Path to test_output directory (default: ./test_output)'
    )
    
    parser.add_argument(
        '--output-dir',
        type=str,
        default=None,
        help='Path to output reports directory (default: ./test_output/reports)'
    )
    
    args = parser.parse_args()
    
    # Determine paths
    script_dir = Path(__file__).parent
    input_dir = Path(args.input_dir) if args.input_dir else script_dir / 'test_output'
    output_dir = Path(args.output_dir) if args.output_dir else input_dir / 'reports'
    
    # Generate run label if not provided
    run_label = args.run_label if args.run_label else generate_run_label()
    
    print(f"Scanning for baseline metrics in: {input_dir}")
    print(f"Run label: {run_label}")
    
    # Find all baseline metrics files
    metrics_files = find_baseline_metrics(input_dir)
    
    if not metrics_files:
        print(f"\nNo baseline_metrics.json files found in {input_dir}")
        print("Make sure you've run the golden tests first.")
        return 1
    
    print(f"Found {len(metrics_files)} baseline metrics file(s)")
    
    # Extract metrics from each file
    metrics_list = []
    for metrics_path in metrics_files:
        print(f"  Processing: {metrics_path.parent.name}")
        metrics = extract_metrics(metrics_path)
        if metrics:
            metrics_list.append(metrics)
    
    if not metrics_list:
        print("\nFailed to extract any metrics.")
        return 1
    
    # Write CSV report
    report_path = get_report_path(output_dir)
    write_csv_report(report_path, metrics_list, run_label)
    print(f"\nCSV report written to: {report_path}")
    
    # Print summary
    print_summary(metrics_list, run_label)
    
    return 0


if __name__ == '__main__':
    exit(main())
