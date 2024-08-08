from enum import Enum
from textwrap import dedent


class Country(Enum):
    SOUTH_AFRICA = "South Africa"
    KENYA = "Kenya"
    FRANCE = "France"
    UNSPECIFIED = "Unspecified"


def get_country_glossary(country: Country) -> str | None:
    """
    Get the glossary for a specific country
    :param country:
    :return:
    """
    return _GLOSSARY.get(country, None)


# A glossary of terms that may be used to contextualize tasks
# eventually this could move to a file or database
_GLOSSARY = {
    Country.SOUTH_AFRICA:
        dedent("""\
        GDE Brigade - Gauteng Department of Education (GDE) Brigade was a short-term programme for contract workers in the education sector.
        Kotas - A South African street food. 
        Bunny chow - Indian South African fast food dish.
        Crew Member - A member of a team but not necessarily in the aviation industry.
        Ambassador - A person who works ta public relation of a company.
        Braider - A person who specializes in creating beautiful African hairstyles.
        """),
}
