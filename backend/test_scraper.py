"""
Test script for BrighterMonday scraper.
Run from ~/compass/backend directory: python3 test_scraper.py

Run all scrapers:
python3 -m app.scrapers.run_all_scrapers
"""

import os
from app.scrapers.platforms.brightermonday import BrighterMondayScraper
import json


def main():
    print("="*60)
    print("TESTING BRIGHTERMONDAY SCRAPER")
    print("="*60)
    print()
    
    # Initialize scraper
    scraper = BrighterMondayScraper()
    
    # Scrape 5 jobs
    jobs = scraper.scrape(max_jobs=5)
    
    # Display results
    print(f"\nScraped {len(jobs)} jobs:\n")
    
    for i, job in enumerate(jobs, 1):
        print(f"{i}. {job.get('title', 'N/A')}")
        print(f"   Company: {job.get('company', 'N/A')}")
        print(f"   Location: {job.get('location', 'N/A')}")
        print(f"   Salary: {job.get('salary', 'N/A')}")
        print(f"   Posted: {job.get('posted_date', 'N/A')}")
        print(f"   URL: {job.get('application_url', 'N/A')}")
        print()
    
    # Save to file for inspection
    output_path = os.path.expanduser('~/scraped_jobs_test.json')
    with open(output_path, 'w') as f:
        json.dump(jobs, f, indent=2, default=str)
    
    print(f"✓ Full data saved to {output_path}")
    print(f"✓ Test complete!")


if __name__ == "__main__":
    main()