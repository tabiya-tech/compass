from typing import Dict, Optional
from ..base import BaseScraper

class MyJobMagScraper(BaseScraper):
    """Scraper for MyJobMag job listings."""
    
    def __init__(self):
        super().__init__('myjobmag')
    
    def parse_job_card(self, card_element) -> Optional[Dict]:
        """
        Parse a MyJobMag job card.
        
        Example structure:
        - Title: li.job-info h2 a
        - Company: li.job-logo img alt attribute
        - Description: li.job-desc
        - Posted date: li#job-date
        - Link: li.job-info h2 a
        
        Note: Skip ads (cards with adsbygoogle class)
        """
        try:
            # Skip ad blocks
            if 'adsbygoogle' in card_element.get_attribute('class'):
                return None
            
            # Title
            title = self._safe_find(card_element, self.selectors['title'])
            if not title:
                return None
            
            # Company - from img alt attribute
            company = self._safe_find(card_element, self.selectors['company_img'], 'alt')
            
            # Description
            description = self._safe_find(card_element, self.selectors['description'])
            description = self._clean_text(description)
            
            # Posted date
            posted_date = self._safe_find(card_element, self.selectors['posted_date'])
            
            # Link
            link = self._safe_find(card_element, self.selectors['link'], 'href')
            if link and not link.startswith('http'):
                link = f"https://www.myjobmag.co.ke{link}"
            
            return {
                'title': title,
                'company': company,
                'description': description,
                'posted_date': posted_date,
                'application_url': link,
            }
            
        except Exception as e:
            self.logger.error(f"Error parsing MyJobMag job card: {str(e)}")
            return None