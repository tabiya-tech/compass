from typing import Dict, Optional
from ..base import BaseScraper

class JobWebKenyaScraper(BaseScraper):
    """Scraper for JobWebKenya listings."""
    
    def __init__(self):
        super().__init__('jobwebkenya')
    
    def parse_job_card(self, card_element) -> Optional[Dict]:
        """
        Parse a JobWebKenya job card.
        
        Example structure:
        - Title: div#titlo strong a
        - Location: div#location (contains "Location: Kenya")
        - Employment type: div#type-tag span.jtype
        - Description: div.lista
        - Posted date: div#date span.year
        - Link: div#titlo strong a
        """
        try:
            # Title
            title = self._safe_find(card_element, self.selectors['title'])
            if not title:
                return None
            
            # Location (remove "Location: " prefix)
            location_raw = self._safe_find(card_element, self.selectors['location'])
            location = location_raw.replace('Location:', '').strip() if location_raw else None
            
            # Employment type
            employment_type = self._safe_find(card_element, self.selectors['employment_type'])
            
            # Description
            description = self._safe_find(card_element, self.selectors['description'])
            description = self._clean_text(description)
            
            # Posted date
            posted_date = self._safe_find(card_element, self.selectors['posted_date'])
            
            # Link
            link = self._safe_find(card_element, self.selectors['link'], 'href')
            
            return {
                'title': title,
                'location': location,
                'employment_type': employment_type,
                'description': description,
                'posted_date': posted_date,
                'application_url': link,
            }
            
        except Exception as e:
            self.logger.error(f"Error parsing JobWebKenya job card: {str(e)}")
            return None