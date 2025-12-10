# tests/conftest.py
"""
Pytest configuration and shared fixtures
"""
import pytest
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

# Use a separate test database
TEST_DB_NAME = "compass-kenya-test"


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def mongodb_client():
    """MongoDB client for tests"""
    client = AsyncIOMotorClient(os.getenv('TAXONOMY_MONGODB_URI'))
    yield client
    client.close()


@pytest.fixture(scope="function")
async def test_db(mongodb_client):
    """Clean test database for each test"""
    db = mongodb_client[TEST_DB_NAME]
    
    # Clean up before test
    await db.occupations.delete_many({})
    await db.skills.delete_many({})
    await db.occupation_skill_relations.delete_many({})
    
    yield db
    
    # Clean up after test
    await db.occupations.delete_many({})
    await db.skills.delete_many({})
    await db.occupation_skill_relations.delete_many({})


@pytest.fixture
def sample_esco_occupation_row():
    """Sample ESCO occupation CSV row"""
    import pandas as pd
    return pd.Series({
        'ID': '507f1f77bcf86cd799439011',
        'ORIGINURI': 'http://data.europa.eu/esco/occupation/123',
        'PREFERREDLABEL': 'Software Developer',
        'ALTLABELS': 'Programmer\nCoder\nSoftware Engineer',
        'OCCUPATIONTYPE': 'ESCO occupation',
        'DESCRIPTION': 'Develops software applications',
        'DEFINITION': 'A person who writes code',
        'SCOPENOTE': 'Includes mobile and web developers',
        'REGULATEDPROFESSIONNOTE': None,
        'OCCUPATIONGROUPCODE': '2512',
        'UUIDHISTORY': 'uuid-123',
        'ISLOCALIZED': True
    })


@pytest.fixture
def sample_kesco_occupation_row():
    """Sample KeSCO occupation Excel row"""
    import pandas as pd
    return pd.Series({
        'S/No': 1,
        'KeSCO Code': '2512-01',
        'Occupational Title': 'Software Developer'
    })


@pytest.fixture
def sample_esco_skill_row():
    """Sample ESCO skill CSV row"""
    import pandas as pd
    return pd.Series({
        'ID': '507f1f77bcf86cd799439022',
        'ORIGINURI': 'http://data.europa.eu/esco/skill/456',
        'PREFERREDLABEL': 'Python programming',
        'ALTLABELS': 'Python coding\nPython development',
        'SKILLTYPE': 'skill/competence',
        'REUSELEVEL': 'cross-sectoral',
        'DESCRIPTION': 'Programming in Python language',
        'DEFINITION': 'Ability to write Python code',
        'SCOPENOTE': 'Includes frameworks like Django',
        'UUIDHISTORY': 'uuid-456',
        'ISLOCALIZED': False
    })