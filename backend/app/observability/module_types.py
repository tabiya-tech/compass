"""
The "module" and "sub module" dimensions that LLM traces are grouped by.

A `TraceModule` is a *suite area* of Compass (Build Your Profile, CV Upload).
A `TraceSubModule` is the named area *within* it that produced the work: the conversation phase
for Build Your Profile.

Both dimensions are human readable, exactly as they read in the Langfuse UI: title case, spaces
rather than underscores, no slugs.

Modules are tagged at their own service entry points.
"""

from enum import Enum

# Words that read as acronyms rather than as title-cased words when a slug is humanised.
_ACRONYMS = frozenset({"cv", "id", "ai"})


class TraceModule(Enum):
    """
    The Compass suite area a trace belongs to.
    """

    BUILD_YOUR_PROFILE = "Build your Profile"
    """
    The Compass core conversation: Welcome, Collect Experiences, Skill Explorer, the experience
    linking/ranking pipeline and the conversation summariser.
    """

    CV_UPLOAD = "CV Upload"
    """
    Experience extraction from an uploaded CV.
    """


class TraceSubModule(Enum):
    """
    The named area within a `TraceModule` a trace belongs to.

    Only the sub modules that are fixed in code live here. Conversation phases that are not mapped
    to one are humanised from their name with `sub_module_label`.
    """

    EXPLORE_EXPERIENCES = "Explore Experiences"
    """
    The Build Your Profile counseling phase: Collect Experiences and Skill Explorer.
    """


def sub_module_label(identifier: str) -> str:
    """
    Turn an identifier into the human readable sub module label the Langfuse UI shows.

    Both slugs (`cv-development`) and enum names (`EXPLORE_EXPERIENCES`) come out the same way, so
    the values in Langfuse are consistent no matter where they were derived from.

    :param identifier: A slug or enum name, e.g. "cv-development" or "EXPLORE_EXPERIENCES".
    :return: The label, e.g. "CV Development" or "Explore Experiences".
    """
    words = identifier.replace("-", " ").replace("_", " ").split()
    return " ".join(word.upper() if word.lower() in _ACRONYMS else word.capitalize() for word in words)
