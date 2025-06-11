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
    labels_with_counts = [f"{label} ({count})" for label, count in counter.items()]
    ax.pie(
        counter.values(),
        labels=labels_with_counts,
        autopct='%1.1f%%',
        startangle=90
    )

    ax.set_title(title, fontweight='bold', fontsize=16, pad=20)
    plt.savefig(output_path, dpi=300, bbox_inches='tight', facecolor='white')
    plt.close()  # Close the figure to free memory

    logger.info(f"Saving pie chart: '{title}' to path:{output_path}")


def _create_numeric_bins(values: list[float], bin_size: int) -> list[str]:
    """
    Create bins for numeric data
    based on the specified bin size.

    :return: A list of strings representing the bins. each string is in the format "start-end".
    """

    bins = []
    for value in values:
        bin_start = int((value // bin_size) * bin_size)
        bin_end = bin_start + bin_size - 1
        bins.append(f"{bin_start}-{bin_end}")

    return bins


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
        binned_values = _create_numeric_bins(numeric_values, bin_size)
        counter = Counter(binned_values)

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
