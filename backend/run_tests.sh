#!/bin/bash
# run_tests.sh - Run all taxonomy tests

echo "Running Taxonomy Import & Contextualization Tests"
echo "=================================================="

# Run with coverage
pytest tests/taxonomy/ -v --cov=app.taxonomy --cov-report=html --cov-report=term

echo ""
echo "Test report generated in htmlcov/index.html"