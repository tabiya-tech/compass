import pytest
import json
import csv
import os
import re
import pandas as pd
from datetime import datetime
from typing import List, Dict, Optional

# Directory setup for logs
module_path = os.path.dirname(__file__)
LOG_DIR = "test_output"
JSON_LOG_FILE = os.path.join(module_path, LOG_DIR, "test_results.json")
CSV_LOG_FILE = os.path.join(module_path, LOG_DIR, "test_results.csv")
CSV_SUMMARY_FILE = os.path.join(module_path, LOG_DIR, "test_summary.csv")
os.makedirs(LOG_DIR, exist_ok=True)


def log_test_results(results: List[Dict]):
    # Append to JSON log
    os.makedirs(os.path.dirname(JSON_LOG_FILE), exist_ok=True)
    with open(JSON_LOG_FILE, "a") as json_file:
        for result in results:
            json_file.write(json.dumps(result) + "\n")

    # Append to CSV log for easier data analysis (e.g., Pandas)
    os.makedirs(os.path.dirname(JSON_LOG_FILE), exist_ok=True)
    with open(CSV_LOG_FILE, "a", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=results[0].keys())
        if os.stat(CSV_LOG_FILE).st_size == 0:
            writer.writeheader()  # Write header if the file is empty
        writer.writerows(results)


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    # Run the test and get the report
    outcome = yield  # This is required for hookwrappers
    report = outcome.get_result()

    if report.when != "call":
        return

    # Check if the test is evaluation_test
    marker = item.get_closest_marker("evaluation_test")
    if marker is None:
        return

    label = "untagged"

    if marker and marker.args:
        label: str = marker.args[0]  # Use the first argument as the version label

    # Log result details
    results = [{
        "test_name": item.name,
        "label": label,
        "outcome": report.outcome,  # 'passed', 'failed', or 'skipped'
        "duration": round(report.duration, 4),
        "timestamp": datetime.now().isoformat(),
        "error_message": str(report.longrepr) if report.failed else None
    }]

    log_test_results(results)


def aggregate_metrics(log_file: str = CSV_LOG_FILE) -> pd.DataFrame:
    # Load the log data
    df = pd.read_csv(log_file)
    # Extract base test name if parameterized, otherwise use test_name as is
    def extract_base_name(test_name: str) -> Optional[str]:
        if "[" in test_name and test_name.endswith("]"):
            # Extract base name from parameterized test
            return re.split(r"\[.*\]", test_name)[0]
        return None  # Only return base name if parameterized

    df["base_test_name"] = df["test_name"].apply(extract_base_name)

    # Aggregate by test_name, label (full name including parameters)
    detailed_summary = df.groupby(["test_name", "label"]).agg(
        duration_mean=("duration", "mean"),
        duration_std=("duration", "std"),
        duration_count=("duration", "count"),
        outcome_distribution=("outcome", lambda x: dict(x.value_counts())),
        pass_percentage=("outcome", lambda x: (x == "passed").sum() / len(x) * 100)
    ).reset_index()

    # Aggregate by base_test_name, excluding non-parameterized tests
    base_summary = df.dropna(subset=["base_test_name"]).groupby(["base_test_name", "label"]).agg(
        duration_mean=("duration", "mean"),
        duration_std=("duration", "std"),
        duration_count=("duration", "count"),
        outcome_distribution=("outcome", lambda x: dict(x.value_counts())),
        pass_percentage=("outcome", lambda x: (x.value_counts().get("passed", 0) / len(x)) * 100)
    ).reset_index()
    # Rename base_test_name to test_name for consistent merging
    base_summary.rename(columns={"base_test_name": "test_name"}, inplace=True)

    # Merge both summaries for a complete view
    summary = pd.concat([detailed_summary, base_summary], axis=0, ignore_index=True)

    # Sort by test name and code label for easier reading
    summary = summary.sort_values(by=["test_name", "label"], ascending=[True, True])

    # Save the summary
    summary.to_csv(CSV_SUMMARY_FILE, index=False)
    print(f"Aggregated test results saved to {CSV_SUMMARY_FILE}")
    return summary


def main():
    summary = aggregate_metrics()
    print(summary.head())


if __name__ == "__main__":
    main()
