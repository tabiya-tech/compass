import hashlib


def hash_metric_value(value: str):
    """
    Hashes a string value using MD5 and returns its hexadecimal representation.
    usedForSecurity is = False to avoid a warning about using MD5 for security by our linters.
    """
    return hashlib.md5(value.encode(), usedforsecurity=False).hexdigest()
