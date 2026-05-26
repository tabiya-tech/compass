#!/usr/bin/env python3
"""
Script to verify that all i18n locale files have consistent translation keys.

This script checks that all locales have the same set of keys for each domain,
using the default fallback locale as the reference.
"""
import argparse
import logging
import sys
from pathlib import Path

# Add the backend directory to the path so we can import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

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

    manager = I18nManager()

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

