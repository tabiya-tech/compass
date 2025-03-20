from typing import Literal

from pydantic import BaseModel


class Version(BaseModel):
    date: str
    branch: str
    buildNumber: str
    sha: str

    def to_version_string(self, parts: list[Literal["branch", "sha", "date", "buildNumber"]] | None = None) -> str:
        """
        Convert the version to a string.
        :param parts: The parts of the version to include in the string. Default is ["branch", "sha"]
        :return:  The version string where the parts are joined by a hyphen."
        """
        if parts is None:
            parts = ["branch", "sha"]
        return "-".join([getattr(self, part) for part in parts])

    class Config:
        """
        Disallow extra fields in the model
        """
        extra = "forbid"
