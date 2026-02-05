#!/usr/bin/env python3
"""
Check Golden Transcript Metrics Against Thresholds
"""
import argparse
import json
from pathlib import Path


def _load_json(path: Path) -> dict:
    with open(path, "r") as f:
        return json.load(f)


def _evaluate_thresholds(metrics: dict, thresholds: dict) -> list[str]:
    failures = []
    total_turns = metrics.get("total_turn_count", 0)
    repetition_rate = metrics.get("repetition_metrics", {}).get("repetition_rate", 0.0)
    starter_diversity = metrics.get("phrase_repetition_metrics", {}).get("starter_diversity_score", 0.0)
    achievement_rate = metrics.get("question_quality_metrics", {}).get("achievement_question_rate", 0.0)
    total_llm_calls = metrics.get("total_llm_calls", 0)

    if "max_turn_count" in thresholds and total_turns > thresholds["max_turn_count"]:
        failures.append(f"turns {total_turns} > max {thresholds['max_turn_count']}")
    if "max_repetition_rate" in thresholds and repetition_rate > thresholds["max_repetition_rate"]:
        failures.append(f"repetition_rate {repetition_rate:.3f} > max {thresholds['max_repetition_rate']}")
    if "min_starter_diversity" in thresholds and starter_diversity < thresholds["min_starter_diversity"]:
        failures.append(f"starter_diversity {starter_diversity:.3f} < min {thresholds['min_starter_diversity']}")
    if "min_achievement_rate" in thresholds and achievement_rate < thresholds["min_achievement_rate"]:
        failures.append(f"achievement_rate {achievement_rate:.3f} < min {thresholds['min_achievement_rate']}")
    if "max_llm_calls" in thresholds and total_llm_calls > thresholds["max_llm_calls"]:
        failures.append(f"llm_calls {total_llm_calls} > max {thresholds['max_llm_calls']}")
    return failures


def main():
    parser = argparse.ArgumentParser(description="Check transcript metrics thresholds.")
    parser.add_argument("--transcripts-dir", default="evaluation_tests/golden_transcripts", help="Path to transcripts.")
    parser.add_argument("--metrics-dir", default="evaluation_tests/golden_transcripts/output", help="Metrics output dir.")
    args = parser.parse_args()

    transcripts_dir = Path(args.transcripts_dir)
    metrics_dir = Path(args.metrics_dir)

    failures = []
    for transcript_path in transcripts_dir.rglob("*.json"):
        if "output" in transcript_path.parts:
            continue
        transcript = _load_json(transcript_path)
        name = transcript.get("name")
        thresholds = transcript.get("metrics_thresholds", {})
        if not name:
            continue
        metrics_path = metrics_dir / name / "baseline_metrics.json"
        if not metrics_path.exists():
            failures.append(f"{name}: missing metrics at {metrics_path}")
            continue
        metrics = _load_json(metrics_path)
        metric_failures = _evaluate_thresholds(metrics, thresholds)
        if metric_failures:
            failures.append(f"{name}: " + "; ".join(metric_failures))

    if failures:
        print("Metrics threshold failures:")
        for failure in failures:
            print(f"- {failure}")
        raise SystemExit(1)

    print("All transcripts passed threshold checks.")


if __name__ == "__main__":
    main()
