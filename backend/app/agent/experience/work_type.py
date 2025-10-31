from __future__ import annotations
from enum import Enum
from textwrap import dedent
from typing import Optional


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

    @staticmethod
    def from_string_key(key: Optional[str]) -> Optional[WorkType]:
        if key in WorkType.__members__:
            return WorkType[key]
        return None

    @staticmethod
    def work_type_short(work_type: WorkType) -> str:
        if work_type == WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT:
            return "Wage Employment"
        elif work_type == WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK:
            return "Trainee"
        elif work_type == WorkType.SELF_EMPLOYMENT:
            return "Self-Employed"
        elif work_type == WorkType.UNSEEN_UNPAID:
            return "Volunteer/Unpaid"
        else:
            return ""

    @staticmethod
    def work_type_long(work_type: WorkType | None) -> str:
        if work_type == WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT:
            return "Waged work or paid work as an employee. Working for someone else, for a company or an organization, in exchange for a salary or wage."
        elif work_type == WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK:
            return "Unpaid Trainee Work."
        elif work_type == WorkType.SELF_EMPLOYMENT:
            return "Self-employment, micro entrepreneurship, contract based work, freelancing, running own business, paid work but not work as an employee."
        elif work_type == WorkType.UNSEEN_UNPAID:
            return dedent("""\
            Represents all unpaid work, including:
                - Unpaid domestic services for own household or family members.
                - Unpaid caregiving for own household or family members.
                - Unpaid direct volunteering for other households.
                - Unpaid community- and organization-based volunteering.
            excluding:
                - Unpaid trainee work.
            """)
        elif work_type is None:
            return "When there isn't adequate information to classify the work type in any of the categories below."
        else:
            return ""


WORK_TYPE_DEFINITIONS_FOR_PROMPT = dedent(f"""\
- None: {WorkType.work_type_long(None)}   
- {WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name}:{WorkType.work_type_long(WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT)}
- {WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK.name}: {WorkType.work_type_long(WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK)}
- {WorkType.SELF_EMPLOYMENT.name}: {WorkType.work_type_long(WorkType.SELF_EMPLOYMENT)}
- {WorkType.UNSEEN_UNPAID.name}: {WorkType.work_type_long(WorkType.UNSEEN_UNPAID)}
""")
