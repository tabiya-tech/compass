from typing import List, Dict
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import logging
import os

from app.taxonomy.models import JobListingModel, JobScrapingLogModel, JobPlatform

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("JobStorage")


class JobStorage:
    """Handles storage of scraped jobs to MongoDB."""
    
    def __init__(self, mongo_uri: str = None):
        """Initialize MongoDB connection."""
        if mongo_uri is None:
            # Try APPLICATION_MONGODB_URI first (matching server config), then MONGODB_URI, then default
            mongo_uri = os.getenv("APPLICATION_MONGODB_URI") or os.getenv("MONGODB_URI", "mongodb://localhost:27017")
        
        db_name = os.getenv("APPLICATION_DATABASE_NAME", "compass-kenya-application-local")
        
        self.client = AsyncIOMotorClient(mongo_uri)
        self.db = self.client[db_name]
        self.jobs_collection = self.db["job_listings"]
        self.logs_collection = self.db["job_scraping_logs"]
    
    async def save_jobs(self, jobs: List[Dict], platform: str) -> Dict:
        """
        Save scraped jobs to database.
        
        Args:
            jobs: List of job dictionaries
            platform: Platform key (e.g., 'brightermonday')
        
        Returns:
            Dictionary with save statistics
        """
        if not jobs:
            logger.warning(f"No jobs to save for {platform}")
            return {'inserted': 0, 'failed': 0}
        
        inserted_count = 0
        failed_count = 0
        
        for job in jobs:
            try:
                # Convert to JobListingModel
                job_model = self._job_dict_to_model(job, platform)
                
                # Insert to database
                await self.jobs_collection.insert_one(
                    job_model.model_dump(by_alias=True, exclude_none=True, mode='python')
                )
                inserted_count += 1
                
            except Exception as e:
                logger.error(f"Failed to save job '{job.get('title', 'Unknown')}': {str(e)}")
                failed_count += 1
        
        logger.info(f"Saved {inserted_count} jobs from {platform} ({failed_count} failed)")
        
        return {
            'inserted': inserted_count,
            'failed': failed_count,
            'total': len(jobs)
        }
    
    async def log_scrape(
        self, 
        platform: str, 
        stats: Dict,
        success: bool = True,
        error_message: str = None
    ):
        """
        Log scraping activity.
        
        Args:
            platform: Platform key
            stats: Statistics dictionary
            success: Whether scrape was successful
            error_message: Error message if failed
        """
        try:
            import uuid
            
            log = JobScrapingLogModel(
                run_id=str(uuid.uuid4()),
                platform=JobPlatform(platform),
                scraper_version="1.0.0",
                jobs_found=stats.get('total_jobs', 0),
                jobs_added=stats.get('inserted', 0),
                jobs_updated=0,
                jobs_marked_expired=0,
                errors_count=stats.get('failed', 0),
                started_at=datetime.now(timezone.utc),
                completed_at=datetime.now(timezone.utc),
                status='completed' if success else 'failed',
                error_message=error_message
            )
            
            await self.logs_collection.insert_one(
                log.model_dump(by_alias=True, exclude_none=True, mode='python')
            )
            
            logger.info(f"Logged scrape for {platform}")
            
        except Exception as e:
            logger.error(f"Failed to log scrape: {str(e)}")
    
    def _job_dict_to_model(self, job: Dict, platform: str) -> JobListingModel:
        """Convert job dictionary to JobListingModel."""
        
        # Convert mapped IDs to ObjectId if present
        mapped_occupation_id = None
        if job.get('mapped_occupation_id'):
            mapped_occupation_id = job['mapped_occupation_id']
            if not isinstance(mapped_occupation_id, ObjectId):
                mapped_occupation_id = ObjectId(mapped_occupation_id)
        
        mapped_skills = []
        if job.get('mapped_skills'):
            mapped_skills = [
                ObjectId(skill_id) if not isinstance(skill_id, ObjectId) else skill_id
                for skill_id in job['mapped_skills']
            ]
        
        # Convert mapping_confidence from 0-100 to 0-1
        mapping_confidence = job.get('occupation_match_score')
        if mapping_confidence and mapping_confidence > 1:
            mapping_confidence = mapping_confidence / 100.0
        
        # Map scraper fields to model fields
        # Scrapers use: title, company, location, application_url, description
        # Model expects: job_title, employer, location, url, description
        
        return JobListingModel(
            source_platform=JobPlatform(platform),
            url=job.get('application_url', ''),  # Map application_url -> url
            job_title=job.get('title', ''),  # Map title -> job_title
            description=job.get('description') or '',  # Ensure not None
            employer=job.get('company'),
            location=job.get('location') or 'Kenya',  # Default if None
            employment_type=job.get('employment_type'),
            salary_text=job.get('salary'),
            # Don't set posting_date - let it remain None since formats vary
            # posting_date=None,  
            closing_date=job.get('closing_date'),
            application_url=job.get('application_url'),
            mapped_occupation_id=mapped_occupation_id,
            mapped_skills=mapped_skills,
            mapping_confidence=mapping_confidence,
            scraped_at=job.get('scraped_at', datetime.now(timezone.utc)),
            last_checked_at=datetime.now(timezone.utc),
            scraper_version="1.0.0"
        )
    
    async def get_jobs_count(self, platform: str = None) -> int:
        """Get count of jobs in database, optionally filtered by platform."""
        query = {}
        if platform:
            query['sourcePlatform'] = platform
        
        return await self.jobs_collection.count_documents(query)
    
    async def close(self):
        """Close database connection."""
        self.client.close()