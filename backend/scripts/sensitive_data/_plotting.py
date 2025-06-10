import logging
import os

import matplotlib.pyplot as plt
from collections import Counter
from decrypt_sensitive_personal_data import DecryptedPersonalDataModel

logger = logging.getLogger(__name__)


def _create_pie_chart(counter: Counter, title: str, output_path: str):
    """
    Create a pie chart from a Counter object and save it to the specified path.
    """

    _, ax = plt.subplots(figsize=(10, 8))
    # Sort items (optional, if your counter is already sorted, this is harmless)
    sorted_items = list(counter.items())

    # First, compute percentages manually
    values = [count for _, count in sorted_items]
    labels = [label for label, _ in sorted_items]
    total = sum(values)

    # labels are split at the - and replaced with \n for binned numeric data
    if '-' in labels[0]:  # Check if labels are binned numeric data
        labels = [label.replace('-', '-\n') for label in labels]

    labels_with_counts_and_pct = [
        f"{label} ({count}, {count/total:.1%})"
        for label, count in sorted_items
    ]
    wedges, texts = ax.pie(
        values,
        labels=labels,
        # autopct='%1.1f%%',
        startangle=90,
        labeldistance=1,
    )

    # Add a legend
    ax.legend(
        wedges,
        labels_with_counts_and_pct,
        title="Slices",
        loc="center left",
        bbox_to_anchor=(1, 0.5)
    )

    ax.set_title(title, fontweight='bold', fontsize=16, pad=20)
    plt.savefig(output_path, dpi=300, bbox_inches='tight', facecolor='white')
    plt.close()  # Close the figure to free memory

    logger.info(f"Saving pie chart: '{title}' to path:{output_path}")


def _create_numeric_bins(values: list[float], bin_size: int) -> Counter:
    bins = []
    for value in values:
        bin_start = int((value // bin_size) * bin_size)
        bin_end = bin_start + bin_size - 1
        bins.append(f"{bin_start}-{bin_end}")

    # Build counter
    counter = Counter(bins)

    # Sort the counter items by bin start
    def extract_bin_start(label):
        start_str = label.split('-')[0]
        return int(start_str)

    sorted_items = sorted(counter.items(), key=lambda x: extract_bin_start(x[0]), reverse=True)

    # Rebuild a Counter to preserve compatibility
    sorted_counter = Counter(dict(sorted_items))

    return sorted_counter


def _plot_string_fields(*,
                        json_data: list[dict],
                        output_dir: str,
                        fields: list[str]):
    for i, string_field in enumerate(fields):
        values = [item[string_field] for item in json_data
                  if string_field in item and item[string_field] is not None]

        counter = Counter(values)

        title = f'{string_field.replace("_", " ").title()} Distribution'

        filename = f"{string_field}_distribution.png"
        output_path = os.path.join(output_dir, filename)

        _create_pie_chart(counter, title, output_path)


def _plot_numeric_fields(*,
                         json_data: list[dict],
                         output_dir: str,
                         bin_size: int,
                         fields: list[str]):
    # Handle numeric fields (numeric data that needs binning)
    for i, numeric_field in enumerate(fields):
        # Extract numeric values
        raw_values = [item[numeric_field] for item in json_data
                      if numeric_field in item and item[numeric_field] is not None]

        # Convert to numeric values (handle both string and numeric types)
        try:
            numeric_values = [float(v) for v in raw_values]
        except (ValueError, TypeError):
            print(f"Could not convert {numeric_field} to numeric values")
            continue

        # Create bins for numeric data
        counter = _create_numeric_bins(numeric_values, bin_size)

        _output_file_name = os.path.join(output_dir, f"{numeric_field}_distribution_binned.png")
        title = f'{numeric_field.replace("_", " ").title()} Distribution (Binned)'

        _create_pie_chart(counter, title, _output_file_name)


def plot(*,
         data: list[DecryptedPersonalDataModel],
         output_dir: str,
         bin_size: int,
         string_fields: list[str],
         numeric_fields: list[str]):
    """
    Plot the distribution of PII data using pie charts.
    """

    json_data = [item.model_dump(mode="json") for item in data]

    # Handle string fields (categorical data like education, gender, etc.)
    _plot_string_fields(json_data=json_data, output_dir=output_dir, fields=string_fields)

    # Handle numeric fields (numeric data that needs binning)
    _plot_numeric_fields(json_data=json_data, output_dir=output_dir, fields=numeric_fields, bin_size=bin_size)
