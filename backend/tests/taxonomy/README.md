# Taxonomy Import & Contextualization Tests

## Overview

Comprehensive test suite for Milestone 1 deliverables:
- ESCO/KeSCO taxonomy import
- Inline contextualization (fuzzy matching)
- Skill inheritance
- Data quality validation

## Test Structure
```
tests/taxonomy/
├── test_models.py              # Pydantic model validation
├── test_esco_importer.py       # ESCO CSV parsing
├── test_kesco_importer.py      # KeSCO import + fuzzy matching
├── test_contextualization.py   # Match quality & distribution
└── test_integration.py         # End-to-end pipeline
```

## Running Tests

### All tests:
```bash
pytest tests/taxonomy/ -v
```

### With coverage:
```bash
pytest tests/taxonomy/ -v --cov=app.taxonomy --cov-report=html
```

### Specific test file:
```bash
pytest tests/taxonomy/test_kesco_importer.py -v
```

### Single test:
```bash
pytest tests/taxonomy/test_kesco_importer.py::TestKeSCOImporter::test_fuzzy_match_exact -v
```

## Test Database

Tests use a separate database: `compass-kenya-test`
- Automatically cleaned before/after each test
- No impact on development or production data

## Key Test Coverage

### 1. Data Models (test_models.py)
- ✅ ESCO occupation creation
- ✅ KeSCO occupation creation
- ✅ Contextualization fields
- ✅ Skill models
- ✅ Relation models

### 2. ESCO Import (test_esco_importer.py)
- ✅ CSV parsing
- ✅ Alternative labels handling
- ✅ URI extraction
- ✅ Lookup dictionary building

### 3. KeSCO Import (test_kesco_importer.py)
- ✅ Exact match (100% confidence)
- ✅ Fuzzy match (>85% confidence)
- ✅ Manual review flagging (70-84%)
- ✅ No match handling (<70%)

### 4. Contextualization Quality (test_contextualization.py)
- ✅ Match rate validation
- ✅ Confidence score distribution
- ✅ Manual review flags

### 5. Integration (test_integration.py)
- ✅ Skill inheritance workflow
- ✅ End-to-end pipeline simulation

## Expected Results

From production run:
- **KeSCO occupations**: 5,917
- **Auto-matched**: 5,460 (92.3%)
- **Manual review**: 455 (7.7%)
- **No match**: 2 (0.0%)

## Continuous Integration

Tests are designed to run in CI/CD:
```yaml
# .github/workflows/test.yml
pytest tests/taxonomy/ --cov --cov-report=xml
```