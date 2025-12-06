"""
Master script to run all job scrapers.
Scrapes jobs from all platforms, matches to taxonomy, and saves to database.
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict
from motor.motor_asyncio import AsyncIOMotorClient
import os

from .platforms.brightermonday import BrighterMondayScraper
from .platforms.careerjet import CareerjetScraper
from .platforms.fuzu import FuzuScraper
from .platforms.jobwebkenya import JobWebKenyaScraper
from .platforms.myjobmag import MyJobMagScraper
from .taxonomy_matcher import TaxonomyMatcher
from .storage import JobStorage

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("MasterScraper")


class MasterScraper:
    """Orchestrates all job scrapers."""
    
    def __init__(self):
        self.scrapers = {
            'brightermonday': BrighterMondayScraper(),
            'careerjet': CareerjetScraper(),
            'fuzu': FuzuScraper(),
            'jobwebkenya': JobWebKenyaScraper(),
            'myjobmag': MyJobMagScraper(),
        }
        self.storage = JobStorage()
        self.matcher = None
    
    async def _load_taxonomy(self):
        """Load taxonomy data for matching."""
        logger.info("Loading taxonomy data...")
        
        # Use same MongoDB URI as the application
        mongo_uri = os.getenv("APPLICATION_MONGODB_URI") or os.getenv("MONGODB_URI", "mongodb://localhost:27017")
        db_name = os.getenv("APPLICATION_DATABASE_NAME", "compass-kenya-application-local")
        
        client = AsyncIOMotorClient(mongo_uri)
        db = client[db_name]
        
        # Load occupations
        occupations_cursor = db["occupations"].find({}, {'_id': 1, 'preferred_label': 1})
        occupations = []
        async for occ in occupations_cursor:
            if 'preferred_label' in occ:
                occupations.append({
                    'id': str(occ['_id']),
                    'preferred_label': occ['preferred_label']
                })
        
        # Load skills
        skills_cursor = db["skills"].find({}, {'_id': 1, 'preferred_label': 1})
        skills = []
        async for skill in skills_cursor:
            if 'preferred_label' in skill:
                skills.append({
                    'id': str(skill['_id']),
                    'preferred_label': skill['preferred_label']
                })
        
        client.close()
        
        logger.info(f"Loaded {len(occupations)} occupations and {len(skills)} skills")
        self.matcher = TaxonomyMatcher(occupations, skills)
    
    async def run_single_platform(
        self, 
        platform_key: str, 
        max_jobs: int = 20
    ) -> Dict:
        """
        Run scraper for a single platform.
        
        Args:
            platform_key: Platform identifier
            max_jobs: Maximum jobs to scrape
        
        Returns:
            Dictionary with platform statistics
        """
        logger.info(f"\n{'='*60}")
        logger.info(f"Starting scrape: {platform_key.upper()}")
        logger.info(f"{'='*60}\n")
        
        try:
            # Scrape jobs
            scraper = self.scrapers[platform_key]
            jobs = scraper.scrape(max_jobs=max_jobs)
            
            if not jobs:
                logger.warning(f"No jobs scraped from {platform_key}")
                await self.storage.log_scrape(
                    platform_key,
                    {'total_jobs': 0, 'inserted': 0, 'failed': 0},
                    success=False,
                    error_message="No jobs found"
                )
                return {'platform': platform_key, 'jobs': 0, 'success': False}
            
            # Match to taxonomy
            logger.info(f"Matching {len(jobs)} jobs to taxonomy...")
            for job in jobs:
                match_result = self.matcher.match_job(job)
                job.update(match_result)
            
            # Save to database
            save_stats = await self.storage.save_jobs(jobs, platform_key)
            
            # Log activity
            await self.storage.log_scrape(
                platform_key,
                {'total_jobs': len(jobs), **save_stats},
                success=True
            )
            
            logger.info(f"\n✓ {platform_key.upper()} COMPLETE")
            logger.info(f"  Jobs scraped: {len(jobs)}")
            logger.info(f"  Jobs saved: {save_stats['inserted']}")
            logger.info(f"  Jobs matched: {sum(1 for j in jobs if j.get('mapped_occupation_id'))}")
            
            return {
                'platform': platform_key,
                'jobs': len(jobs),
                'saved': save_stats['inserted'],
                'success': True
            }
            
        except Exception as e:
            logger.error(f"✗ {platform_key.upper()} FAILED: {str(e)}", exc_info=True)
            await self.storage.log_scrape(
                platform_key,
                {'total_jobs': 0, 'inserted': 0, 'failed': 0},
                success=False,
                error_message=str(e)
            )
            return {
                'platform': platform_key,
                'jobs': 0,
                'success': False,
                'error': str(e)
            }
    
    async def run_all(self, max_jobs_per_platform: int = 20):
        """
        Run all scrapers.
        
        Args:
            max_jobs_per_platform: Maximum jobs per platform
        """
        start_time = datetime.now()
        logger.info(f"\n{'#'*60}")
        logger.info(f"# STARTING MASTER SCRAPER")
        logger.info(f"# Time: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info(f"# Platforms: {len(self.scrapers)}")
        logger.info(f"# Max jobs per platform: {max_jobs_per_platform}")
        logger.info(f"{'#'*60}\n")
        
        # Load taxonomy
        await self._load_taxonomy()
        
        # Run each scraper
        results = []
        for platform_key in self.scrapers.keys():
            result = await self.run_single_platform(platform_key, max_jobs_per_platform)
            results.append(result)
        
        # Summary
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        total_jobs = sum(r['jobs'] for r in results)
        successful_platforms = sum(1 for r in results if r['success'])
        
        logger.info(f"\n{'#'*60}")
        logger.info(f"# SCRAPING COMPLETE")
        logger.info(f"# Duration: {duration:.1f} seconds")
        logger.info(f"# Total jobs: {total_jobs}")
        logger.info(f"# Successful platforms: {successful_platforms}/{len(results)}")
        logger.info(f"{'#'*60}\n")
        
        # Platform breakdown
        logger.info("Platform Breakdown:")
        for result in results:
            status = "✓" if result['success'] else "✗"
            logger.info(f"  {status} {result['platform']}: {result['jobs']} jobs")
        
        await self.storage.close()
        
        return results


async def main():
    """Entry point for running all scrapers."""
    scraper = MasterScraper()
    await scraper.run_all(max_jobs_per_platform=20)


if __name__ == "__main__":
    asyncio.run(main())