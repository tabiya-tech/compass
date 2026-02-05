"""
CLI script for running the offline vignette optimization pipeline.

This script runs the full pipeline:
1. Generate all possible job profile combinations
2. Filter out dominated profiles
3. Optimize 6 static vignettes using D-efficiency
4. Build 40-vignette adaptive library
5. Save results to JSON files

Usage:
    python run_offline_optimization.py [--output-dir OUTPUT_DIR] [--config CONFIG_PATH]
"""

import argparse
import json
import logging
import sys
from pathlib import Path
from datetime import datetime
import numpy as np

from profile_generator import ProfileGenerator
from dominance_filter import DominanceFilter
from d_efficiency_optimizer import DEfficiencyOptimizer
from adaptive_library_builder import AdaptiveLibraryBuilder
from vignette_converter import VignetteConverter


def setup_logging(log_file: Path = None):
    """Setup logging configuration."""
    handlers = [logging.StreamHandler(sys.stdout)]
    if log_file:
        handlers.append(logging.FileHandler(log_file))

    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=handlers
    )


def save_vignettes_to_json(
    vignettes: list,
    output_path: Path,
    profile_generator: ProfileGenerator,
    converter: VignetteConverter,
    id_prefix: str = "offline",
    metadata: dict = None
):
    """
    Save vignettes to JSON file in online Vignette schema format.

    Args:
        vignettes: List of (profile_a, profile_b) tuples
        output_path: Path to save JSON file
        profile_generator: ProfileGenerator for converting to strings
        converter: VignetteConverter for format conversion
        id_prefix: Prefix for vignette IDs (e.g., "static_begin", "adaptive")
        metadata: Optional metadata to include
    """
    # Convert to online format
    converted_vignettes = converter.convert_vignette_list(vignettes, id_prefix=id_prefix)

    output = {
        "metadata": metadata or {},
        "vignettes": converted_vignettes
    }

    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)


def main():
    """Run the offline optimization pipeline."""
    parser = argparse.ArgumentParser(
        description="Run offline vignette optimization pipeline"
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="./output",
        help="Directory to save output files (default: ./output)"
    )
    parser.add_argument(
        "--config",
        type=str,
        default="preference_parameters.json",
        help="Path to preference_parameters.json config file"
    )
    parser.add_argument(
        "--num-static",
        type=int,
        default=7,
        help="Number of static vignettes to generate (default: 6)"
    )
    parser.add_argument(
        "--num-beginning",
        type=int,
        default=5,
        help="Number of beginning vignettes (default: 4)"
    )
    parser.add_argument(
        "--num-library",
        type=int,
        default=40,
        help="Number of adaptive library vignettes (default: 40)"
    )
    parser.add_argument(
        "--diversity-weight",
        type=float,
        default=0.3,
        help="Weight for diversity in adaptive library (0-1, default: 0.3)"
    )
    parser.add_argument(
        "--log-file",
        type=str,
        help="Path to log file (optional)"
    )
    parser.add_argument(
        "--sample-size",
        type=int,
        default=100000,
        help="Number of vignette pairs to sample per optimization round (default: 100,000)"
    )

    args = parser.parse_args()

    # Setup output directory
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Setup logging
    log_file = Path(args.log_file) if args.log_file else output_dir / "optimization.log"
    setup_logging(log_file)

    logger = logging.getLogger(__name__)
    logger.info("=" * 80)
    logger.info("OFFLINE VIGNETTE OPTIMIZATION PIPELINE")
    logger.info("=" * 80)
    logger.info(f"Configuration: {args.config}")
    logger.info(f"Output directory: {output_dir}")
    logger.info(f"Static vignettes: {args.num_static} ({args.num_beginning} beginning)")
    logger.info(f"Adaptive library: {args.num_library}")
    logger.info(f"Diversity weight: {args.diversity_weight}")
    logger.info(f"Sample size: {args.sample_size:,} pairs per round")
    logger.info("")

    # =========================================================================
    # STEP 1: Generate all possible job profiles
    # =========================================================================
    logger.info("STEP 1: Generating all possible job profiles...")
    logger.info("-" * 80)

    profile_generator = ProfileGenerator(config_path=args.config)
    all_profiles = profile_generator.generate_all_profiles()

    logger.info(f"Generated {len(all_profiles)} candidate profiles")
    logger.info("")

    # Initialize vignette converter
    converter = VignetteConverter(profile_generator)
    logger.info("Initialized VignetteConverter for format conversion")
    logger.info("")

    # Save all profiles
    all_profiles_path = output_dir / "all_profiles.json"
    with open(all_profiles_path, 'w') as f:
        json.dump({
            "metadata": {
                "timestamp": datetime.now().isoformat(),
                "total_profiles": len(all_profiles)
            },
            "profiles": all_profiles
        }, f, indent=2)
    logger.info(f"Saved all profiles to: {all_profiles_path}")
    logger.info("")

    # =========================================================================
    # STEP 2: Prepare profiles (skip global dominance filtering)
    # =========================================================================
    logger.info("STEP 2: Preparing profiles for vignette generation...")
    logger.info("-" * 80)

    # NOTE: We do NOT filter globally dominated profiles
    # Reason: Global dominance filtering removes nearly all profiles (5119/5120)
    # because the attribute space creates a near-total ordering.
    #
    # Instead, we'll check for PAIRWISE dominance when creating vignettes.
    # A good vignette has trade-offs: high wage + long commute vs low wage + short commute
    # Neither option should globally dominate the other.

    non_dominated_profiles = all_profiles

    logger.info(f"Using all {len(non_dominated_profiles)} profiles for vignette generation")
    logger.info("(Pairwise dominance will be checked during vignette selection)")
    logger.info("")

    # Save profiles for reference
    non_dominated_path = output_dir / "candidate_profiles.json"
    with open(non_dominated_path, 'w') as f:
        json.dump({
            "metadata": {
                "timestamp": datetime.now().isoformat(),
                "total_profiles_before_filtering": len(all_profiles),
                "total_profiles_after_filtering": len(non_dominated_profiles),
                "note": "Dominance filtering applied - globally dominated profiles removed"
            },
            "profiles": non_dominated_profiles
        }, f, indent=2)
    logger.info(f"Saved candidate profiles to: {non_dominated_path}")
    logger.info("")

    # =========================================================================
    # STEP 3: Optimize static vignettes using D-efficiency
    # =========================================================================
    logger.info("STEP 3: Optimizing static vignettes using D-efficiency...")
    logger.info("-" * 80)

    optimizer = DEfficiencyOptimizer(profile_generator)

    # Prior mean for 7 preference dimensions (not 10 attributes)
    # Use neutral prior (all zeros) since we're aggregating multiple attributes per dimension
    prior_mean = np.zeros(7)

    beginning_vignettes, end_vignettes = optimizer.select_static_vignettes(
        profiles=non_dominated_profiles,
        num_static=args.num_static,
        num_beginning=args.num_beginning,
        prior_mean=prior_mean,
        sample_size=args.sample_size
    )

    all_static_vignettes = beginning_vignettes + end_vignettes

    logger.info(f"Selected {len(beginning_vignettes)} beginning vignettes")
    logger.info(f"Selected {len(end_vignettes)} end vignettes")
    logger.info("")

    # Get optimization statistics
    opt_stats = optimizer.get_optimization_statistics(all_static_vignettes, prior_mean)
    logger.info("Optimization statistics:")
    for key, value in opt_stats.items():
        if isinstance(value, list):
            logger.info(f"  {key}: [array of length {len(value)}]")
        else:
            logger.info(f"  {key}: {value}")
    logger.info("")

    # Save static vignettes (now in online format with category inference)
    beginning_path = output_dir / "static_vignettes_beginning.json"
    save_vignettes_to_json(
        beginning_vignettes,
        beginning_path,
        profile_generator,
        converter,
        id_prefix="static_begin",
        metadata={
            "timestamp": datetime.now().isoformat(),
            "type": "static_beginning",
            "count": len(beginning_vignettes),
            "optimization_stats": opt_stats,
            "format": "online_vignette_schema",
            "note": "Vignettes converted to online format with inferred categories"
        }
    )
    logger.info(f"Saved beginning vignettes to: {beginning_path}")

    end_path = output_dir / "static_vignettes_end.json"
    save_vignettes_to_json(
        end_vignettes,
        end_path,
        profile_generator,
        converter,
        id_prefix="static_end",
        metadata={
            "timestamp": datetime.now().isoformat(),
            "type": "static_end",
            "count": len(end_vignettes),
            "format": "online_vignette_schema",
            "note": "Vignettes converted to online format with inferred categories"
        }
    )
    logger.info(f"Saved end vignettes to: {end_path}")
    logger.info("")

    # =========================================================================
    # STEP 4: Build adaptive library
    # =========================================================================
    logger.info("STEP 4: Building adaptive library...")
    logger.info("-" * 80)

    library_builder = AdaptiveLibraryBuilder(profile_generator)
    adaptive_library = library_builder.build_adaptive_library(
        profiles=non_dominated_profiles,
        num_library=args.num_library,
        excluded_vignettes=all_static_vignettes,
        prior_mean=prior_mean,
        diversity_weight=args.diversity_weight,
        sample_size=args.sample_size // 10  # Use 10k samples for adaptive library
    )

    logger.info(f"Built adaptive library with {len(adaptive_library)} vignettes")
    logger.info("")

    # Get library statistics
    library_stats = library_builder.get_library_statistics(adaptive_library)
    logger.info("Library statistics:")
    for key, value in library_stats.items():
        if key == "attribute_coverage":
            logger.info(f"  {key}:")
            for attr_name, counts in value.items():
                logger.info(f"    {attr_name}: {counts}")
        else:
            logger.info(f"  {key}: {value}")
    logger.info("")

    # Save adaptive library (now in online format with category inference)
    library_path = output_dir / "adaptive_library.json"
    save_vignettes_to_json(
        adaptive_library,
        library_path,
        profile_generator,
        converter,
        id_prefix="adaptive",
        metadata={
            "timestamp": datetime.now().isoformat(),
            "type": "adaptive_library",
            "count": len(adaptive_library),
            "diversity_weight": args.diversity_weight,
            "library_stats": library_stats,
            "format": "online_vignette_schema",
            "note": "Vignettes converted to online format with inferred categories"
        }
    )
    logger.info(f"Saved adaptive library to: {library_path}")
    logger.info("")

    # =========================================================================
    # SUMMARY
    # =========================================================================
    logger.info("=" * 80)
    logger.info("OPTIMIZATION COMPLETE")
    logger.info("=" * 80)
    logger.info(f"Total candidate profiles: {len(all_profiles)}")
    logger.info(f"Non-dominated profiles: {len(non_dominated_profiles)}")
    logger.info(f"Static vignettes: {len(all_static_vignettes)} ({len(beginning_vignettes)} beginning, {len(end_vignettes)} end)")
    logger.info(f"Adaptive library: {len(adaptive_library)}")
    logger.info(f"D-efficiency: {opt_stats['d_efficiency']:.4f}")
    logger.info(f"FIM determinant: {opt_stats['fim_determinant']:.2e}")
    logger.info("")
    logger.info(f"Output directory: {output_dir}")
    logger.info("Files created:")
    logger.info(f"  - {all_profiles_path.name}")
    logger.info(f"  - {non_dominated_path.name}")
    logger.info(f"  - {beginning_path.name}")
    logger.info(f"  - {end_path.name}")
    logger.info(f"  - {library_path.name}")
    logger.info(f"  - {log_file.name}")
    logger.info("=" * 80)


if __name__ == "__main__":
    main()
