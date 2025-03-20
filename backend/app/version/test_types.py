import pytest
from pydantic import ValidationError
from app.version.types import Version


class TestVersion:
    def test_version_to_version_string_default_parts(self):
        # GIVEN a Version instance
        given_version = Version(date="2023-01-01", branch="main", buildNumber="123", sha="abc123")
        # WHEN calling to_version_string, THEN the default parts are used
        assert given_version.to_version_string() == given_version.branch + "-" + given_version.sha

    def test_version_to_version_string_custom_parts(self):
        # GIVEN a Version instance
        given_version = Version(date="2023-01-01", branch="main", buildNumber="123", sha="abc123")

        # WHEN calling to_version_string with custom parts, THEN the custom parts are used
        assert given_version.to_version_string(parts=["date", "buildNumber"]) == given_version.date + "-" + given_version.buildNumber

    def test_version_to_version_string_one_part(self):
        # GIVEN a Version instance
        given_version = Version(date="2023-01-01", branch="main", buildNumber="123", sha="abc123")

        # WHEN calling to_version_string with one custom part, THEN the custom part is used
        assert given_version.to_version_string(parts=["sha"]) == given_version.sha

    def test_version_to_version_string_all_parts(self):
        # GIVEN a Version instance
        given_version = Version(date="2023-01-01", branch="main", buildNumber="123", sha="abc123")

        # WHEN calling to_version_string with all parts, THEN all parts are used
        assert given_version.to_version_string(parts=["date", "branch", "buildNumber", "sha"]) == "-".join(
            [given_version.date, given_version.branch, given_version.buildNumber, given_version.sha])

    def test_version_invalid_extra_field(self):
        # GIVEN a Version instance with an extra field
        # THEN a ValidationError is raised
        with pytest.raises(ValidationError):
            # noinspection PyArgumentList
            Version(date="2023-01-01", branch="main", buildNumber="123", sha="abc123", extra_field="invalid")

    def test_version_missing_required_field(self):
        # GIVEN a Version instance with a missing required field
        # THEN a ValidationError is raised
        with pytest.raises(ValidationError):
            # noinspection PyArgumentList
            Version(date="2023-01-01", branch="main", buildNumber="123")
