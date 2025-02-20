from dataclasses import dataclass
from typing import Optional


@dataclass
class Version:
    git_sha: Optional[str]
    git_branch_name: Optional[str]

    def __str__(self):
        return f"{self.git_branch_name}.{self.git_sha}"
