from abc import ABC, abstractmethod
from typing import List, Dict, Optional
from datetime import datetime, timezone
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from webdriver_manager.chrome import ChromeDriverManager
import logging

from .config import PLATFORMS, SELENIUM_CONFIG


class BaseScraper(ABC):
    """Base class for job scrapers with Selenium support."""
    
    def __init__(self, platform_key: str):
        """
        Initialize scraper for a specific platform.
        
        Args:
            platform_key: Key from PLATFORMS config (e.g., 'brightermonday')
        """
        self.platform_key = platform_key
        self.config = PLATFORMS[platform_key]
        self.platform_name = self.config['name']
        self.url = self.config['url']
        self.selectors = self.config['selectors']
        self.wait_time = self.config.get('wait_time', 10)
        self.wait_selector = self.config.get('wait_selector')
        
        self.driver = None
        self.jobs = []
        
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(f"Scraper.{self.platform_name}")
    
    def _init_driver(self):
        """Initialize Selenium WebDriver with Chrome."""
        chrome_options = Options()
        
        if SELENIUM_CONFIG['headless']:
            chrome_options.add_argument('--headless')
        if SELENIUM_CONFIG['disable_gpu']:
            chrome_options.add_argument('--disable-gpu')
        if SELENIUM_CONFIG['no_sandbox']:
            chrome_options.add_argument('--no-sandbox')
        if SELENIUM_CONFIG['disable_dev_shm']:
            chrome_options.add_argument('--disable-dev-shm-usage')
        
        chrome_options.add_argument('--window-size=1920,1080')
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        service = Service(ChromeDriverManager().install())
        self.driver = webdriver.Chrome(service=service, options=chrome_options)
        self.driver.set_page_load_timeout(SELENIUM_CONFIG['page_load_timeout'])
        self.driver.implicitly_wait(SELENIUM_CONFIG['implicit_wait'])
    
    def _wait_for_jobs(self):
        """Wait for job listings to load on the page."""
        if not self.wait_selector:
            return
        
        try:
            WebDriverWait(self.driver, self.wait_time).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, self.wait_selector))
            )
            self.logger.info(f"Job listings loaded for {self.platform_name}")
            
            # Scroll to trigger lazy loading
            self._trigger_lazy_loading()
            
        except TimeoutException:
            self.logger.warning(f"Timeout waiting for jobs on {self.platform_name}")
    
    def _trigger_lazy_loading(self):
        """Scroll through page to trigger lazy-loaded content."""
        import time
        
        try:
            # Get page height
            last_height = self.driver.execute_script("return document.body.scrollHeight")
            
            # Scroll in increments
            scroll_pause = 1.0
            for i in range(3):  # Scroll 3 times
                # Scroll down
                self.driver.execute_script(f"window.scrollTo(0, {(i+1) * 500});")
                time.sleep(scroll_pause)
            
            # Scroll back to top
            self.driver.execute_script("window.scrollTo(0, 0);")
            time.sleep(1)
            
            self.logger.info("Triggered lazy loading by scrolling")
            
        except Exception as e:
            self.logger.warning(f"Error triggering lazy loading: {str(e)}")
    
    def _safe_find(self, element, selector: str, attribute: str = 'text') -> Optional[str]:
        """
        Safely find an element and extract text or attribute.
        
        Args:
            element: Parent element to search within
            selector: CSS selector
            attribute: 'text' or specific attribute name (e.g., 'href', 'alt')
        
        Returns:
            Extracted string or None
        """
        try:
            found = element.find_element(By.CSS_SELECTOR, selector)
            if attribute == 'text':
                return found.text.strip() if found.text else None
            else:
                return found.get_attribute(attribute)
        except NoSuchElementException:
            return None
    
    def _safe_find_all(self, element, selector: str) -> List:
        """
        Safely find all elements matching selector.
        
        Args:
            element: Parent element to search within
            selector: CSS selector
        
        Returns:
            List of elements (empty list if none found)
        """
        try:
            return element.find_elements(By.CSS_SELECTOR, selector)
        except NoSuchElementException:
            return []
    
    def _clean_text(self, text: Optional[str]) -> Optional[str]:
        """Clean extracted text by removing extra whitespace."""
        if not text:
            return None
        return ' '.join(text.split())
    
    def _extract_salary(self, text: Optional[str]) -> Optional[str]:
        """Extract salary information from text containing 'KSh' or currency."""
        if not text:
            return None
        
        # Remove "Location:" prefix if present
        text = text.replace('Location:', '').strip()
        
        # Look for KSh pattern
        if 'KSh' in text or 'Ksh' in text:
            # Extract just the salary portion
            parts = text.split()
            salary_parts = []
            capture = False
            for part in parts:
                if 'KSh' in part or 'Ksh' in part:
                    capture = True
                if capture:
                    salary_parts.append(part)
                    # Stop after we get the range or single amount
                    if len(salary_parts) >= 3:  # e.g., "KSh 90,000 - 105,000"
                        break
            return ' '.join(salary_parts) if salary_parts else None
        
        return None
    
    @abstractmethod
    def parse_job_card(self, card_element) -> Optional[Dict]:
        """
        Parse a single job card element into structured data.
        Must be implemented by each platform scraper.
        
        Args:
            card_element: Selenium WebElement representing a job card
        
        Returns:
            Dictionary with job data or None if parsing fails
        """
        pass
    
    def scrape(self, max_jobs: int = 20) -> List[Dict]:
        """
        Main scraping method - fetches and parses jobs.
        
        Args:
            max_jobs: Maximum number of jobs to scrape
        
        Returns:
            List of job dictionaries
        """
        self.logger.info(f"Starting scrape of {self.platform_name}...")
        
        try:
            # Initialize driver
            self._init_driver()
            
            # Load page
            self.logger.info(f"Loading {self.url}")
            self.driver.get(self.url)
            
            # Wait for jobs to load
            self._wait_for_jobs()
            
            # Find all job cards
            job_cards = self.driver.find_elements(
                By.CSS_SELECTOR, 
                self.selectors['job_cards']
            )
            
            self.logger.info(f"Found {len(job_cards)} job cards")
            
            # Parse each job card
            for i, card in enumerate(job_cards[:max_jobs]):
                try:
                    # Sometimes content loads with delay - try twice with a small wait
                    job_data = None
                    for attempt in range(2):
                        job_data = self.parse_job_card(card)
                        if job_data and job_data.get('title'):
                            break
                        elif attempt == 0:
                            # Wait a moment and scroll to the card
                            import time
                            self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", card)
                            time.sleep(0.5)
                    
                    if job_data and job_data.get('title'):
                        job_data['source_platform'] = self.platform_key
                        job_data['scraped_at'] = datetime.now(timezone.utc)
                        self.jobs.append(job_data)
                        self.logger.info(f"✓ Scraped job {i+1}: {job_data.get('title', 'Unknown')}")
                    else:
                        self.logger.warning(f"✗ Failed to parse job card {i+1} - no title found")
                except Exception as e:
                    self.logger.error(f"Error parsing job card {i+1}: {str(e)}")
                    continue
            
            self.logger.info(f"Successfully scraped {len(self.jobs)} jobs from {self.platform_name}")
            return self.jobs
            
        except Exception as e:
            self.logger.error(f"Error scraping {self.platform_name}: {str(e)}")
            return []
        
        finally:
            if self.driver:
                self.driver.quit()
                self.logger.info("Browser closed")
    
    def get_stats(self) -> Dict:
        """Get scraping statistics."""
        return {
            'platform': self.platform_name,
            'total_jobs': len(self.jobs),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }