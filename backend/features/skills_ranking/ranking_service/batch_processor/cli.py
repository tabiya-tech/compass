#!/usr/bin/env python3

import argparse
import asyncio
from textwrap import dedent

from dotenv import load_dotenv

from common_libs.logging.log_utilities import setup_logging_config
from features.skills_ranking.ranking_service.batch_processor.main import re_rank_job_seekers

# Set up Logging configurations
setup_logging_config("logging.cfg.yaml")


def _parse_args():
    parser = argparse.ArgumentParser(
        description="Batch process job seekers by re-ranking them based on the updated opportunities",
        formatter_class=argparse.RawTextHelpFormatter,
        epilog=dedent("""
        This script is used to re-rank all the job seekers in the database based on the current opportunities dataset.
        
        Required Environment variables:
        
        SKILLS_RANKING_BATCH_PROCESSOR_JOB_SEEKERS_MONGODB_URI=<your_mongodb_uri>
        SKILLS_RANKING_BATCH_PROCESSOR_JOB_SEEKERS_DATABASE_NAME=<your_database_name>
        SKILLS_RANKING_BATCH_PROCESSOR_JOB_SEEKERS_COLLECTION_NAME=<your_collection_name>
        
        SKILLS_RANKING_BATCH_PROCESSOR_OPPORTUNITY_DATA_MONGODB_URI=<your_mongodb_uri>
        SKILLS_RANKING_BATCH_PROCESSOR_OPPORTUNITY_DATA_DATABASE_NAME=<your_database_name>
        SKILLS_RANKING_BATCH_PROCESSOR_OPPORTUNITY_DATA_COLLECTION_NAME=<your_collection_name>
        SKILLS_RANKING_BATCH_PROCESSOR_RANKING_SERVICE_CONFIG='{
            "matching_threshold": <float between 0 and 1>, # the percentage of skills that need to match an opportunity.
        }'
        """)
    )

    parser.add_argument(
        "--rerank-all",
        action="store_true",
        default=False,
        help="Re-rank all job seekers in the database, otherwise only rank those where the dataset has changed since last ranking"
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="Run the script without making any changes to the database"
    )

    return parser.parse_args()


if __name__ == '__main__':
    args = _parse_args()

    # Read the environment variables from the .env file since we are in the CLI mode.
    load_dotenv()

    # Run the re-ranking process
    asyncio.run(re_rank_job_seekers(
        rerank_all=args.rerank_all,
        dry_run=args.dry_run))
