import hashlib
import json
from typing import Iterable, Any


def compute_opportunities_dataset_version_from_docs(opportunities_docs: Iterable[dict[str, Any]]) -> str:
    """
    Compute a deterministic MD5 hash from the subset of fields that influence ranking.
    Uses canonical JSON serialization for stability.
    """

    # we need to normalize the documents to ensure that the fields are in a consistent format
    # and order, especially for skills which are lists of UUIDs. otherwise the md5 hash
    # would change if the order of skills changes, even if the content is the same.
    def normalize(doc: dict[str, Any]) -> dict[str, Any]:
        return {
            "active": doc.get("active"),
            "occupation": doc.get("occupation"),
            "opportunityText": doc.get("opportunityText"),
            "opportunityTitle": doc.get("opportunityTitle"),
            "opportunityUrl": doc.get("opportunityUrl"),
            "postedAt": doc.get("postedAt"),
            # Normalize skills as sorted list of UUIDs
            "skills": sorted(
                s["UUID"] for s in doc.get("skills", []) if isinstance(s, dict) and "UUID" in s
            ),
            #TODO: SkillGroups aren't there yet but should be included when we merge (with ordering)
            "skillGroups": doc.get("skillGroups"),
        }
    normalized = [normalize(d) for d in opportunities_docs]
    normalized.sort(key=lambda d: json.dumps(d, sort_keys=True, separators=(",", ":"), default=str))

    # we do a json dump with sorted keys and separators to ensure that the
    # serialization is deterministic and consistent across different runs.
    serialized = json.dumps(
        normalized,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )

    return hashlib.md5(serialized.encode("utf-8")).hexdigest() # nosec B324 - MD5 is used for versioning, not security
