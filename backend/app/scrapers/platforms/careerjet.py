"""
Careerjet scraper - International job search engine.
URL: https://www.careerjet.co.ke/jobs
"""

from typing import Dict, Optional
from ..base import BaseScraper


class CareerjetScraper(BaseScraper):
    """Scraper for Careerjet job listings."""
    
    def __init__(self):
        super().__init__('careerjet')
    
    def parse_job_card(self, card_element) -> Optional[Dict]:
        """
        Parse a Careerjet job card.
        
        Example structure:
        - Title: header h2 a
        - Company: p.company
        - Location: ul.location li
        - Salary: ul.salary li
        - Description: div.desc
        - Posted date: span.badge-r (e.g., "3 days ago")
        - Link: article data-url attribute
        """
        try:
            # Title
            title = self._safe_find(card_element, self.selectors['title'])
            if not title:
                return None
            
            # Company
            company = self._safe_find(card_element, self.selectors['company'])
            
            # Location
            location = self._safe_find(card_element, self.selectors['location'])
            location = self._clean_text(location)
            
            # Salary
            salary = self._safe_find(card_element, self.selectors['salary'])
            salary = self._clean_text(salary)
            
            # Description
            description = self._safe_find(card_element, self.selectors['description'])
            description = self._clean_text(description)
            
            # Posted date
            posted_date = self._safe_find(card_element, self.selectors['posted_date'])
            
            # Link - special handling for data-url attribute
            link_path = card_element.get_attribute('data-url')
            link = f"https://www.careerjet.co.ke{link_path}" if link_path else None
            
            return {
                'title': title,
                'company': company,
                'location': location,
                'salary': salary,
                'description': description,
                'posted_date': posted_date,
                'application_url': link,
            }
            
        except Exception as e:
            self.logger.error(f"Error parsing Careerjet job card: {str(e)}")
            return None