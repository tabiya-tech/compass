from typing import Dict, Optional
from ..base import BaseScraper

class FuzuScraper(BaseScraper):
    """Scraper for Fuzu job listings."""
    
    def __init__(self):
        super().__init__('fuzu')
    
    def parse_job_card(self, card_element) -> Optional[Dict]:
        """
        Parse a Fuzu job card.
        
        Example structure:
        - Title: h1
        - Company: a[data-cy="company-name"]
        - Location: a containing "/job/nairobi"
        - Description: div.view-summary-content
        - Published date: p.published
        - Link: extract from current URL or links
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
            
            # Description (may have multiple divs, get first one)
            description = self._safe_find(card_element, self.selectors['description'])
            description = self._clean_text(description)
            
            # Posted and closing dates (Fuzu shows both)
            date_elements = self._safe_find_all(card_element, self.selectors['posted_date'])
            posted_date = None
            closing_date = None
            
            for elem in date_elements:
                text = elem.text
                if 'Published:' in text:
                    posted_date = text.replace('Published:', '').strip()
                elif 'Closing:' in text:
                    closing_date = text.replace('Closing:', '').strip()
            
            # Link
            link = self._safe_find(card_element, self.selectors['link'], 'href')
            
            return {
                'title': title,
                'company': company,
                'location': location,
                'description': description,
                'posted_date': posted_date,
                'closing_date': closing_date,
                'application_url': link,
            }
            
        except Exception as e:
            self.logger.error(f"Error parsing Fuzu job card: {str(e)}")
            return None