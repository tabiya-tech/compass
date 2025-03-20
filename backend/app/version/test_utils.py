import pytest
from unittest.mock import patch, mock_open
from app.version.utils import load_version_info
from app.version.types import Version


class TestLoadVersionInfo:
    def test_valid_version_file(self):
        with patch("builtins.open", new_callable=mock_open,
                   read_data='{"date": "foo-date", "branch": "foo-branch", "buildNumber": "foo-build-number", "sha": "foo-sha"}'):
            version: Version = load_version_info()
            assert version.branch == "foo-branch"
            assert version.buildNumber == "foo-build-number"
            assert version.date == "foo-date"
            assert version.sha == "foo-sha"

    def test_version_file_not_found(self):
        with patch("builtins.open", side_effect=FileNotFoundError):
            with pytest.raises(RuntimeError, match="Version file not found"):
                load_version_info()

    def test_incomplete_version_json_format(self):
        with patch("builtins.open", new_callable=mock_open, read_data='{"date": "foo-date"}'):
            with pytest.raises(RuntimeError, match="Failed to load version data"):
                load_version_info()

    def test_invalid_json_format(self):
        with patch("builtins.open", new_callable=mock_open, read_data='invalid json'):
            with pytest.raises(RuntimeError, match="Failed to load version data"):
                load_version_info()
