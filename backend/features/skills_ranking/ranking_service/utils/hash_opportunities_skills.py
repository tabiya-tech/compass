import json
import hashlib


def hash_opportunities_skills(skills_sets: list[set[str]]) -> str:
    """
    Compute a deterministic version hash from a list of sets of skill UUIDs.
    """
    # convert the sets to lists, because JSON does not support sets
    # sort the skills within each set to ensure consistent ordering
    normalized = [sorted(skills_set) for skills_set in skills_sets]

    # sort the lists by each string, because the result we can not guarantee order of sets
    #   unless we specify a sort order, and we want the version to be deterministic
    normalized.sort(key=lambda s: json.dumps(s))

    # serialize to JSON with no spaces to ensure consistent hashing
    serialized = json.dumps(normalized)

    # compute the MD5 hash of the serialized string
    return hashlib.md5(serialized.encode("utf-8")).hexdigest() # nosec B324 - versioning only
