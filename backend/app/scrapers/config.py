"""
Scraper configuration for all job platforms.
Each platform config includes URL, CSS selectors, and wait conditions.
"""

PLATFORMS = {
    'brightermonday': {
        'name': 'BrighterMonday',
        'url': 'https://www.brightermonday.co.ke/jobs',
        'wait_selector': 'div[data-cy="listing-cards-components"]',
        'wait_time': 10,
        'selectors': {
            'job_cards': 'div[data-cy="listing-cards-components"]',
            'title': 'p.text-lg.font-medium.break-words',
            'company': 'p.text-sm.text-blue-700.inline-block',
            'location': 'div.flex.flex-wrap.mt-3 span:first-child',
            'employment_type': 'div.flex.flex-wrap.mt-3 span:nth-child(2)',
            'salary': 'div.flex.flex-wrap.mt-3 span:nth-child(3)',
            'category': 'p.text-sm.text-gray-500.inline-block',
            'description': 'p.text-sm.font-normal.text-gray-700',
            'posted_date': 'p.text-sm.font-normal.text-gray-700.text-loading-animate',
            'link': 'a[data-cy="listing-title-link"]',
        },
    },
    
    'careerjet': {
        'name': 'Careerjet',
        'url': 'https://www.careerjet.co.ke/jobs',
        'wait_selector': 'article.job',
        'wait_time': 10,
        'selectors': {
            'job_cards': 'article.job',
            'title': 'header h2 a',
            'company': 'p.company',
            'location': 'ul.location li',
            'salary': 'ul.salary li',
            'description': 'div.desc',
            'posted_date': 'ul.tags li span.badge-r',
            'link_attr': 'data-url',  # Special: get from article data-url attribute
        },
    },
    
    'fuzu': {
        'name': 'Fuzu',
        'url': 'https://www.fuzu.com/kenya/job',
        'wait_selector': 'section.job-content',
        'wait_time': 15,  # Fuzu is slower
        'selectors': {
            'job_cards': 'section.job-content',
            'title': 'h1',
            'company': 'a[data-cy="company-name"]',
            'location': 'a[href*="/job/nairobi"]',
            'description': 'div.view-summary-content',
            'posted_date': 'p.published',
            'closing_date': 'p.published',
            'link': 'a[href*="/jobs/"]',
        },
    },
    
    'jobwebkenya': {
        'name': 'JobWebKenya',
        'url': 'https://jobwebkenya.com/jobs/',
        'wait_selector': 'li.job',
        'wait_time': 10,
        'selectors': {
            'job_cards': 'li.job',
            'title': 'div#titlo strong a',
            'location': 'div#location',
            'employment_type': 'div#type-tag span.jtype',
            'description': 'div.lista',
            'posted_date': 'div#date span.year',
            'link': 'div#titlo strong a',
        },
    },
    
    'myjobmag': {
        'name': 'MyJobMag',
        'url': 'https://www.myjobmag.co.ke/jobs',
        'wait_selector': 'li.job-list-li',
        'wait_time': 10,
        'selectors': {
            'job_cards': 'li.job-list-li',
            'title': 'li.job-info h2 a',
            'company_img': 'li.job-logo a img',  # Special: use alt attribute
            'description': 'li.job-desc',
            'posted_date': 'li#job-date',
            'link': 'li.job-info h2 a',
        },
    },
}

# Selenium configuration
SELENIUM_CONFIG = {
    'headless': True,
    'disable_gpu': True,
    'no_sandbox': True,
    'disable_dev_shm': True,
    'page_load_timeout': 30,
    'implicit_wait': 5,
}