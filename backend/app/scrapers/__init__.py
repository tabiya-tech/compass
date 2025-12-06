"""
Job scrapers package for Compass Kenya.
"""

from .platforms.brightermonday import BrighterMondayScraper
from .platforms.careerjet import CareerjetScraper
from .platforms.fuzu import FuzuScraper
from .platforms.jobwebkenya import JobWebKenyaScraper
from .platforms.myjobmag import MyJobMagScraper

__all__ = [
    'BrighterMondayScraper',
    'CareerjetScraper',
    'FuzuScraper',
    'JobWebKenyaScraper',
    'MyJobMagScraper',
]