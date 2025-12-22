#!/usr/bin/env python3
"""
Script to verify that all i18n locale files have consistent translation keys.

This script checks that all locales have the same set of keys for each domain,
using the default fallback locale as the reference.
"""
import argparse
import logging
import os
import sys
from pathlib import Path

# Add the backend directory to the path so we can import app modules
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.i18n.i18n_manager import I18nManager

# Setup basic logging for the script
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def main():
    """Main function to run verification."""
    parser = argparse.ArgumentParser(description="I18n Manager Verification Tool")
    parser.add_argument(
        "--locales-dir",
        type=str,
        default=None,
        help="Path to the locales directory. Defaults to app/i18n/locales relative to backend directory.",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Check that all locales have matching keys against the default fallback locale.",
    )
    args = parser.parse_args()

    # Determine locales directory
    if args.locales_dir:
        locales_dir = args.locales_dir
    else:
        locales_dir = os.path.join(backend_dir, "app", "i18n", "locales")

    manager = I18nManager(locales_dir=locales_dir)

    if args.verify:
        if not manager.translations:
            logger.error("No translations found. Please create locale files first.")
            sys.exit(1)
        
        success = manager.verify_keys()
        sys.exit(0 if success else 1)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

