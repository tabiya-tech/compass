from enum import Enum


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
