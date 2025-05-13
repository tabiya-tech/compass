#!/usr/bin/env python3
from textwrap import dedent

import pytest
import json
import csv
import os
import re
import argparse
import pandas as pd
from datetime import datetime
from typing import List, Dict, Optional

# Directory setup for logs
module_path = os.path.dirname(__file__)
DEFAULT_LOG_DIR = "test_output"
DEFAULT_JSON_LOG_FILE = os.path.join(module_path, DEFAULT_LOG_DIR, "test_results.json")
DEFAULT_CSV_LOG_FILE = os.path.join(module_path, DEFAULT_LOG_DIR, "test_results.csv")
DEFAULT_CSV_SUMMARY_FILE = os.path.join(module_path, DEFAULT_LOG_DIR, "test_summary.csv")
os.makedirs(DEFAULT_LOG_DIR, exist_ok=True)


def log_test_results(results: List[Dict]):
    # Append to JSON log
    os.makedirs(os.path.dirname(DEFAULT_JSON_LOG_FILE), exist_ok=True)
    with open(DEFAULT_JSON_LOG_FILE, "a") as json_file:
        for result in results:
            json_file.write(json.dumps(result) + "\n")

    # Append to CSV log for easier data analysis (e.g., Pandas)
    os.makedirs(os.path.dirname(DEFAULT_JSON_LOG_FILE), exist_ok=True)
    with open(DEFAULT_CSV_LOG_FILE, "a", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=results[0].keys())
        if os.stat(DEFAULT_CSV_LOG_FILE).st_size == 0:
            writer.writeheader()  # Write header if the file is empty
        writer.writerows(results)


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item):
    # Run the test and get the report
    outcome = yield  # This is required for hookwrappers
    report = outcome.get_result()

    if report.when != "call":
        return

    # Check if the test is evaluation_test
    marker = item.get_closest_marker("evaluation_test")
    if marker is None:
        return

    # Determine if the test is repeated using the pytest-repeat plugin
    is_repeated = "__pytest_repeat_step_number" in getattr(item, "callspec", {}).params
    test_name = item.name

    # Trim repeat suffix if the test is repeated
    if is_repeated:
        test_name = re.sub(r"-\d+-\d+\]$", "]", item.name)

    label = "untagged"

    if marker and marker.args:
        label: str = marker.args[0]  # Use the first argument as the version label

    # Log result details
    results = [{
        "test_name": test_name,
        "label": label,
        "outcome": report.outcome,  # 'passed', 'failed', or 'skipped'
        "duration": round(report.duration, 4),
        "timestamp": datetime.now().isoformat(),
        "error_message": str(report.longrepr) if report.failed else None
    }]

    log_test_results(results)


def aggregate_metrics(*, log_file: str, label_filter: Optional[str] = None,
                      summary_file: str
                      ) -> pd.DataFrame:
    # Load the log data
    df = pd.read_csv(log_file)

    # Determine which labels to update
    if label_filter is not None:
        labels_to_update = [label_filter]
        df = df[df["label"] == label_filter]
    else:
        labels_to_update = df["label"].unique()

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
    new_summary = pd.concat([detailed_summary, base_summary], axis=0, ignore_index=True)

    # Load existing summary if it exists and is not empty
    if os.path.exists(summary_file) and os.path.getsize(summary_file) > 0:
        try:
            existing_summary = pd.read_csv(summary_file)
            # Remove old data for all matching labels
            existing_summary = existing_summary[~existing_summary["label"].isin(labels_to_update)]
            # Append the new data
            full_summary = pd.concat([existing_summary, new_summary], axis=0, ignore_index=True)
        except pd.errors.EmptyDataError:
            # Handle completely empty files (no headers)
            full_summary = new_summary
    else:
        # If the summary file doesn't exist or is empty, use the new summary as the base
        full_summary = new_summary

    # Sort for consistency
    full_summary = full_summary.sort_values(by=["test_name", "label"], ascending=[True, True])

    # Save the updated summary
    full_summary.to_csv(summary_file, index=False)
    print(f"Aggregated test results for labels {labels_to_update} saved to {summary_file}")
    return full_summary


def main(*, label: Optional[str] = None, log_file: str, summary_file: str, do_plot: bool):
    # Generate the summary
    summary = aggregate_metrics(log_file=log_file, label_filter=label, summary_file=summary_file)
    print(summary.head())

    if do_plot:
        import matplotlib.pyplot as plt
        import numpy as np
        # Get unique test names and labels
        test_names = summary["test_name"].unique()
        labels = summary["label"].unique()

        # Set figure size dynamically based on number of tests
        plt.figure(figsize=(14, max(10, len(test_names) * 0.4)))

        # Set bar width and calculate positions
        bar_height = 0.8 / len(labels)  # Adjust based on the number of labels
        index = np.arange(len(test_names))

        # Plot each label as a separate bar group
        for i, label in enumerate(labels):
            # Filter the data for the current label
            group = summary[summary["label"] == label].set_index("test_name").reindex(test_names).reset_index()

            # Calculate the y-positions for this label's bars
            y_positions = index + (i - (len(labels) - 1) / 2) * bar_height

            # Plot the bars
            plt.barh(y_positions, group["pass_percentage"], height=bar_height, label=label)

        # Set the y-ticks to the middle of each group
        plt.yticks(index, test_names)
        plt.xlabel("Outcome (%)")
        plt.ylabel("Test Name")
        plt.title("Test Outcomes by Label")
        plt.legend(title="Label", bbox_to_anchor=(1.05, 1), loc="upper left")
        plt.tight_layout()
        plt.show()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=dedent("""
                                                        Aggregate and visualize evaluation test results.
                                                        
                                                        This script reads test results from a CSV log file, aggregates the data, 
                                                        and generates a summary CSV file.
                                                        
                                                        It can also generate a plot of the test outcomes.
                                                        
                                                        When using the --label option, only tests with the specified label will be included in the summary.
                                                        If no label is specified, all tests will be included.
                                                        
                                                        If the target summary file already exists, the script will append the new results to it, 
                                                        removing any old data for the specified label.
                                                        """),
                                     formatter_class=argparse.RawTextHelpFormatter)
    options_group = parser.add_argument_group("Options")
    options_group.add_argument(
        "--label",
        type=str,
        help="Filter results by label (e.g., 'gemini_2.0'). If not provided, all labels will be included."
    )
    options_group.add_argument(
        "--log_file",
        type=str,
        default=DEFAULT_CSV_LOG_FILE,
        help="Path to the log file, either absolute or relative to the current directory."
             f"If not provided, the default file will be used: {DEFAULT_CSV_LOG_FILE}"
    )
    options_group.add_argument(
        "--summary_file",
        type=str,
        default=DEFAULT_CSV_SUMMARY_FILE,
        help="Path to the summary file, either absolute or relative to the current directory."
             f"If not provided, the default file will be used: {DEFAULT_CSV_SUMMARY_FILE}"
    )

    options_group.add_argument(
        "--plot",
        type=bool,
        default=True,
        help="Generate a plot of the test results. If not specified, a plot will be generated."
    )
    main_args = parser.parse_args()
    main(
        label=main_args.label,
        log_file=main_args.log_file,
        summary_file=main_args.summary_file,
        do_plot=main_args.plot
    )
