from enum import Enum
from textwrap import dedent


class Country(Enum):
    SOUTH_AFRICA = "South Africa"
    KENYA = "Kenya"
    FRANCE = "France"
    ITALY = "Italy"
    UNSPECIFIED = "Unspecified"


def get_country_from_string(country: str) -> Country:
    """
    Get the country enum from a string.
    Matches on the value or the name of the enum.
    :param country:
    :return:
    """
    for c in Country:
        if c.value.lower() == country.lower() or c.name.lower() == country.lower():
            return c
    return Country.UNSPECIFIED


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
        Hustler - Hard working person who does odd jobs to make ends meet (small and micro businesses).
        GDE Brigade - Gauteng Department of Education (GDE) Brigade was a short-term programme for contract workers in the education sector.
        Kotas - A South African street food. 
        Bunny chow - Indian South African fast food dish.
        Crew Member - A member of a team but not necessarily in the aviation industry.
        Ambassador - A person who works ta public relation of a company.
        Braider - A person who specializes in creating beautiful African hairstyles.
        """),
    Country.KENYA:
        dedent("""\
        Askari - A security guard.
        Boda Boda - A motorcycle taxi.
        Nduthi - A motorcycle taxi.
        Tuk tuk - A 3-wheeler taxi.
        Choma - Roasted.
        Nyama - Meat.
        Nyama choma - Roasted meat.
        mpishi - Cook
        Fundi - Technician / Skilled Worker / artisan.
        Fundi wa Gari / Mech - A mechanic.
        Makanika - Mechanic.
        Hustler - Hard working person who does odd jobs to make ends meet (small and micro businesses).
        Casual - Works for a day/task and is paid on completion of the task or at the end of the day.
        Mama mboga - Vegetable seller.
        Kiosk - A small shop that sells household essentials in small quantities e.g. soap, bread etc.
        Housegirl - A housekeeper/ nanny.
        Auntie - Domestic Worker / Housekeeper/ nanny.
        Jua Kali - Informal sector of traders and businesses (it is the general term used for Kenya’s informal sector ranging from furniture making, pots, pans, autoparts, handicrafts etc.
        Fundi - An artisan, a person who works with their hands.
        Kinyozi / Barber.
        Saloonist / Stylist / Braider - hairdresser.
        Msanii - Artist (musician, actor etc).
        Mziki - Music.
        Makanga - A conductor of a matatu.
        Matatu - The main public transport it is private sector owned.
        Mathree / Ma3 - Matatu.
        Dereva - Driver.
        Mchuuzi / Hawker - A street vendor, informal trader.
        Mjengo - A construction site often used to refer to a place where manual labour is needed/performed.
        Mtu wa mkono - Used in construction sites, it is the assistants who are usually employed to help the skilled workers (masons, painters etc).
        Mkulima - Farmer.
        Mwalimu - Teacher.
        Mpesa - A mobile money transfer service.
        Mpesa agent - Assist customers with the use of m-pesa services, receive deposits and give cash.
        Shamba Boy / Shamba Girl - A farm worker.
        Ugali / Sembe - A staple food in Kenya made from maize flour.
        Cyber - An internet café where people go to access computers with internet, printing services and technical assistance in accessing digital government services for a fee.
        Kanairo - Nairobi.
        Ocha - Village.
        Mtaa - Neighbourhood, refers to a specific area in the city.
        Mtumba - Second hand clothes.
        Wathii - Market.
        """),
}
