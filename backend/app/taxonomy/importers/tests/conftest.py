"""Shared test fixtures following Tabiya BDD conventions"""

import pytest
from unittest.mock import Mock
from bson import ObjectId
import pandas as pd

@pytest.fixture
def mock_db():
    """Mocked database for unit tests"""
    givenMockDb = Mock()
    return givenMockDb

@pytest.fixture  
def sample_esco_occupation():
    """Sample ESCO occupation data"""
    return {
        "_id": ObjectId(),
        "preferred_label": "Software Developer",
        "code": "2512.1",
        "isco_group_code": "2512",
        "alt_labels": ["Developer", "Programmer"],
        "source": "ESCO"
    }

@pytest.fixture
def sample_kesco_row():
    """Sample KeSCO Excel row"""
    return pd.Series({
        "S/No": 1,
        "Occupational Title": "Software Engineer",
        "KeSCO Code": "2512-15"
    })