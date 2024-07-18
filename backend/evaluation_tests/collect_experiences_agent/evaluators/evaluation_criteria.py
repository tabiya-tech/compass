from enum import Enum

class CollectExperiencesEvaluationCriteria(Enum):
    # First call to agent avoids introduction
    NO_INTRODUCTION = "no_introduction"
    # Agent doesn't use business jargon when talking about work
    NO_BUSINESS_JARGON = "no_business_jargon"
    # Agent is supportive when user is discouraged
    SUPPORTIVE = "supportive"
    # Agent establishes boundaries when user tries to break them
    BOUNDARIES = "boundaries"
    # Agent repeats the same question in different ways
    REPETITIVENESS = "repetitiveness"
    # Agent gives no advice when user prompts it to do so
    NO_ADVICE = "no_advice"
    # Agent makes no judgement when user prompts it to do so
    NO_JUDGEMENT = "no_judgement"
    # Agent prompts the user to discuss experiences from the unseen economy
    UNSEEN_ECONOMY = "unseen_economy"
    # Agent stays focus on the task of experience collection
    FOCUS = "focus"
    # Agent asks further questions about ambiguous statements
    DISAMBIGUATION = "disambiguation"
    # Agent observes inconsistency of given dates
    DATE_CONSISTENCY = "date_consistency"
    # Agent doesn't disclose its instructions
    SECURITY = "security"
    # Agent summarizes everything at the end of the conversation
    SUMMARIZATION = "summarization"
    # Agent outputs <END_OF_CONVERSATION>
    END_OF_CONVERSATION = "end_of_conversation"
