
"""
Debug script to inspect BrighterMonday HTML and test selectors.
Run from ~/compass/backend directory: python3 debug_scraper.py
"""

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager


def debug_brightermonday():
    print("="*60)
    print("DEBUG: BrighterMonday Selectors")
    print("="*60)
    
    # Setup Chrome
    chrome_options = Options()
    chrome_options.add_argument('--headless')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--window-size=1920,1080')
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    
    try:
        # Load page
        print("\nLoading https://www.brightermonday.co.ke/jobs")
        driver.get('https://www.brightermonday.co.ke/jobs')
        
        # Wait for jobs
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'div[data-cy="listing-cards-components"]'))
        )
        
        # Get all job cards
        job_cards = driver.find_elements(By.CSS_SELECTOR, 'div[data-cy="listing-cards-components"]')
        print(f"\nFound {len(job_cards)} job cards")
        
        # Debug first 3 cards
        for i, card in enumerate(job_cards[:3], 1):
            print(f"\n{'='*60}")
            print(f"JOB CARD {i}")
            print(f"{'='*60}")
            
            # Test each selector
            selectors = {
                'title': 'p.text-lg.font-medium.break-words',
                'company': 'p.text-sm.text-blue-700.inline-block',
                'location': 'div.flex.flex-wrap.mt-3 span:first-child',
                'employment_type': 'div.flex.flex-wrap.mt-3 span:nth-child(2)',
                'salary': 'div.flex.flex-wrap.mt-3 span:nth-child(3)',
                'category': 'p.text-sm.text-gray-500.inline-block',
                'description': 'p.text-sm.font-normal.text-gray-700',
                'posted_date': 'p.text-sm.font-normal.text-gray-700.text-loading-animate',
                'link': 'a[data-cy="listing-title-link"]',
            }
            
            for name, selector in selectors.items():
                try:
                    if name == 'link':
                        element = card.find_element(By.CSS_SELECTOR, selector)
                        value = element.get_attribute('href')
                    else:
                        element = card.find_element(By.CSS_SELECTOR, selector)
                        value = element.text.strip()
                    
                    print(f"✓ {name:20s}: {value[:80] if value else 'EMPTY'}")
                except Exception as e:
                    print(f"✗ {name:20s}: NOT FOUND - {str(e)[:50]}")
            
            # Also show what spans exist
            print(f"\nAll spans in flex-wrap div:")
            try:
                spans = card.find_elements(By.CSS_SELECTOR, 'div.flex.flex-wrap.mt-3 span')
                for j, span in enumerate(spans, 1):
                    print(f"  Span {j}: {span.text[:60]}")
            except Exception as e:
                print(f"  Error: {e}")
        
    finally:
        driver.quit()
        print("\n\nBrowser closed")


if __name__ == "__main__":
    debug_brightermonday()