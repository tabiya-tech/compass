from typing import Dict, Optional
from ..base import BaseScraper

class BrighterMondayScraper(BaseScraper):
    """Scraper for BrighterMonday job listings."""
    
    def __init__(self):
        super().__init__('brightermonday')
    
    def parse_job_card(self, card_element) -> Optional[Dict]:
        """
        Parse a BrighterMonday job card.
        
        Example structure:
        - Title: p.text-lg.font-medium.break-words
        - Company: p.text-sm.text-blue-700.inline-block
        - Location: First span in flex-wrap div
        - Employment Type: Second span
        - Salary: Third span (contains "KSh")
        - Description: p.text-sm.font-normal
        - Posted: "X days ago"
        """
        try:
            # Title
            title = self._safe_find(card_element, self.selectors['title'])
            if not title:
                return None
            
            # Company
            company = self._safe_find(card_element, self.selectors['company'])
            
            # Location (first span)
            location = self._safe_find(card_element, self.selectors['location'])
            location = self._clean_text(location)
            
            # Employment type (second span)
            employment_type = self._safe_find(card_element, self.selectors['employment_type'])
            employment_type = self._clean_text(employment_type)
            
            # Salary (third span - contains KSh)
            salary_text = self._safe_find(card_element, self.selectors['salary'])
            salary = self._extract_salary(salary_text)
            
            # Category
            category = self._safe_find(card_element, self.selectors['category'])
            
            # Description
            description = self._safe_find(card_element, self.selectors['description'])
            description = self._clean_text(description)
            
            # Posted date
            posted_date = self._safe_find(card_element, self.selectors['posted_date'])
            
            # Link
            link = self._safe_find(card_element, self.selectors['link'], 'href')
            
            return {
                'title': title,
                'company': company,
                'location': location,
                'employment_type': employment_type,
                'salary': salary,
                'category': category,
                'description': description,
                'posted_date': posted_date,
                'application_url': link,
            }
            
        except Exception as e:
            self.logger.error(f"Error parsing BrighterMonday job card: {str(e)}")
            return None