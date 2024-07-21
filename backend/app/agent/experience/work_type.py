from enum import Enum
from textwrap import dedent


class WorkType(Enum):
    """
    Represents the work-type of a user experience.

    See https://docs.tabiya.org/overview/projects/inclusive-livelihoods-taxonomy/methodology for more information.

    1. Formal sector/Wage employment (link to vanilla esco)
    2. Formal sector/Unpaid trainee work (link to vanilla esco)
    3. Self-employment (link to vanilla esco + micro entrepreneurship)
    4. Unseen (link to esco + unseen)
        a. Unpaid domestic services for household and family members (Div 3)
        b. Unpaid caregiving services for household and family members (Div 4)
        c. Unpaid direct volunteering for other households  (Div 51)
        d. Unpaid community- and organization-based volunteering (Div 52)
    """
    FORMAL_SECTOR_WAGED_EMPLOYMENT = "Formal sector/Wage employment"
    FORMAL_SECTOR_UNPAID_TRAINEE_WORK = "Formal sector/Unpaid trainee work"
    SELF_EMPLOYMENT = "Self-employment"
    UNSEEN_UNPAID = "Unpaid other"  # All unseen work is grouped under this category


WORK_TYPE_DEFINITIONS_FOR_PROMPT = dedent(f"""\
None: When there isn't adequate information to classify the work type in any of the categories below.    
{WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name}: Waged work or paid work except {WorkType.SELF_EMPLOYMENT.name}
{WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK.name}: Unpaid trainee work
{WorkType.SELF_EMPLOYMENT.name}: Self-employment, micro entrepreneurship, contract based work, freelancing, running own business, 
                paid but not {WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name}.
{WorkType.UNSEEN_UNPAID.name}: Represents all unseen economy, 
    including:
    - Unpaid domestic services for household and family members
    - Unpaid caregiving services for household and family members
    - Unpaid direct volunteering for other households
    - Unpaid community- and organization-based volunteering
    excluding:
    - Unpaid trainee work, which is classified as {WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK.name}
""")
