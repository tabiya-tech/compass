import enum
from textwrap import dedent
    
class TopLevelDivision(enum.Enum):
    VOLUNTEERING = "volunteering"
    NON_VOLUNTEERING = "non_volunteering"

    def is_volunteering(self):
        return self == TopLevelDivision.VOLUNTEERING
        


class IcatusFirstLevelNode(enum.Enum):
    I3 = ("I3", "unpaid domestic services for household and family members", """Refers to activities to provide services for own final use (excluding unpaid caregiving services for household and family members classified under major division 4).
Provision of 'services' is beyond the 2008 SNA production boundary but inside the General production boundary and covers:
(i) household accounting and management, purchasing and/or transporting goods;
(ii) preparing and/or serving meals, household waste disposal and recycling;
(iii) cleaning, decorating and maintaining one's own dwelling or premises, durables and other goods, and gardening;
(iv) caring for domestic animals or pets;
(v) childcare and instruction, transporting and caring for elderly, dependent or other household and family members, etc. (major division 4)

'Households and family members' refers to 'household members and related family members living in other households' who are related, to a specified degree, through blood, adoption or marriage.

Note: In these divisions of activities it is assumed that working time arrangements are generally more informal or flexible compared to those under 1. Thus, this division does not include specific groups for short breaks and for lunch breaks. Activities associated with such breaks from work are classified in the corresponding class; for example, eating snack/meals is classified under 921 Eating meals/snack.""")
    I4 = ("I4", "unpaid caregiving services for household and family members", """Refers to activities to provide caregiving services for own final use (excludes unpaid domestic services for household and family members classified under major division 3).
Provision of 'services' is beyond the 2008 SNA production boundary but inside the General production boundary and covers:
(i) household accounting and management, purchasing and/or transporting goods (major division 3);
(ii) preparing and/or serving meals, household waste disposal and recycling (major division 3);
(iii) cleaning, decorating and maintaining one's own dwelling or premises, durables and other goods, and gardening (classified under major division 3);
(iv) caring for domestic animals or pets (classified under major division 3);
(v) childcare and instruction, transporting and caring for elderly, dependent or other household and family members, etc.

Care work refers to all those activities which are undertaken for family members including those belonging to another household either to comply with the law or out of love/moral obligations (obligation or in some countries by law).

'Households and family members' refers to 'household members and related family members living in other households' who are related, to a specified degree, through blood, adoption or marriage.

Note: In these divisions of activities it is assumed that working time arrangements are generally more informal or flexible compared to those under 11. Thus, this division does not include specific groups for short breaks and for lunch breaks. Activities associated with such breaks from work are classified in the corresponding class; for example, eating snack/meals is classified under 921 Eating meals/snack.""")
    I5 = ("I5", "unpaid volunteer, trainee and other unpaid work", """Unpaid volunteer: Refers to any unpaid, non-compulsory activity to produce goods or provide services for others
- 'Unpaid' is interpreted as the absence of remuneration in cash or in kind for work done or hours worked; nevertheless, volunteer workers may receive some small form of support or stipend in cash, when below one third of local market wages (e.g. for out–of–pocket expenses or to cover living expenses incurred for the activity), or in kind (e.g. meals, transportation, symbolic gifts).
- 'Non-compulsory' is interpreted as work carried out without civil, legal or administrative requirement, that are different from the fulfilment of social responsibilities of a communal, cultural or religious nature;
- Production 'for others' refers to work performed:
(i) through, or for organizations comprising market and non-market units (i.e. organization-based volunteering) including through or for self-help, mutual aid or community-based groups of which the volunteer is a member (Division 52)
(ii) for households other than the household of the volunteer worker or of related family members (i.e. direct volunteering) (Division 51)
(Source: 19th ICLS para. 37)

Unpaid trainee: Refers to any unpaid activity to produce goods or provide services for others, in order to acquire workplace experience or skills in a trade or profession.
- 'Unpaid' is interpreted as the absence of remuneration in cash or in kind for work done or hours worked; nevertheless, these workers may receive some form of support, such as transfers of education stipends or grants, or occasional in cash or in kind support (e.g. a meal, drinks).
- 'For others' refers to work performed in market and non-market units that are owned by non-household or non-family members.
- Acquiring 'workplace experience or skills' may occur through traditional, formal or informal arrangements whether or not a specific qualification or certification is issued.
(Source: 19th ICLS para. 33)

Other unpaid work refers to activities such as unpaid community service and unpaid work by prisoners, when ordered by a court or similar authority, and unpaid military or alternative civilian service, and any other compulsory work performed without pay for others.
(Source: 19th ICLS para. 8)""")

    def __new__(cls, code, definition, description):
        obj = object.__new__(cls)
        obj._value_ = code
        obj.code = code
        obj.definition = definition
        obj.description = description
        return obj
    
    def get_second_level_nodes(self):
        return [node for node in IcatusSecondLevelNode if node.value.startswith(self.code)]
    
    def get_terminal_nodes(self):
        return [node for node in IcatusTerminalNode if node.value.startswith(self.code)]
    
    def is_volunteering(self):
        if self.code.startswith("I5"):
            return True
        return False
    
    def get_prompt(self):
        return f"{self.code}. {self.definition}: {self.description}"

    

class IcatusSecondLevelNode(enum.Enum):
    I31 = ("I31", "food and meals management and preparation", "Refers to all activities in connection with food and meals management and preparation for household and family members")
    I32 = ("I32", "cleaning and maintaining of own dwelling and surroundings", "Refers to the cleaning and maintenance of the dwelling and surroundings.")
    I33 = ("I33", "do-it-yourself decoration, maintenance and repair","Refers to decorating, maintaining and repairing of own dwelling, personal and household goods.")
    I34 = ("I34", "care and maintenance of textiles and footwear", "Refers to caring and maintaining of textiles and footwear for household and family members.")
    I35 = ("I35", "household management for own final use", "Refers to the management of the household. Activities can be undertaken outside or from home.")
    I36 = ("I36", "pet care", "Refers to the care of own household or family member's pets.")
    I37 = ("I37", "shopping for own household and family members", "Refers to the purchase of consumer and capital goods, and services for own household and family members.")
    I41 = ("I41", "childcare and instruction", """Refers to the provision of care (physical and medical) and instruction to children.

According to the Convention on the Rights of the Child, a child is defined as a person below the age of 18, unless the laws of a particular country set the legal age for adulthood younger. The Committee on the Rights of the Child, the monitoring body for the Convention, has encouraged States to review the age of majority if it is set below 18 and to increase the level of protection for all children under 18.

According to the Principles and Recommendations for Population and Housing Censuses revision 3 (paragraph 3.441), for statistical purposes, “children” are defined as persons under 15 years of age, and “youths” are defined as those aged 15-24.""")
    I42 = ("I42", "care for dependent adults", """Refers to the assistance and care provided to dependent adults.
Dependent adults refers to persons suffering any physical or mental illness or any disability or impairment who require assistance or help from other person to undertake daily activities including older persons.
This does not include adults who require temporary assistance.""")
    I43 = ("I43", "help to non-dependent adult household and family members", """Refers to the provision of help to non-dependent adult household and family members.

- 'Household and family members' refers to 'household members and related family members living in other households' who are related, to a specified degree, through blood, adoption or marriage.
- Non-dependent adult refers to persons NOT suffering any physical or mental illness or any disability or impairment. Non-dependent adults might requiere temporary care and supervision due to temporary illness.""")
    I44 = ("I44", "Refers to the travelling and/or accompanying goods or persons related to unpaid caregiving services for household and family members", "Refers to the travelling and/or accompanying goods or persons related to unpaid caregiving services for household and family members")
    I51 = ("I51", "unpaid direct volunteering for other households", "Refers to unpaid, non-compulsory activities to produce goods or provide services as help to other households, not arranged by an organization.")
    I52 = ("I52", "unpaid community- and organization-based volunteering", "Refers to unpaid, non-compulsory activities to produce goods or provide services as help, arranged by the community or an organization.")

    def __new__(cls, code, definition, description):
        obj = object.__new__(cls)
        obj._value_ = code
        obj.code = code
        obj.definition = definition
        obj.description = description
        return obj
    
    def get_first_level_nodes(self):
        return IcatusFirstLevelNode(self.code[:2])
    
    def get_terminal_nodes(self):
        return [node for node in IcatusTerminalNode if node.value.startswith(self.code)]
    
    def is_volunteering(self):
        if self.code.startswith("I5"):
            return True
        return False

    def get_prompt(self):
        parent_node = self.get_first_level_nodes()
        return f"""{self.code}. {parent_node.definition} - {self.definition}.
{parent_node.description}. {self.description}"""
    
class IcatusTerminalNode(enum.Enum):
    I31_0 = ("I31_0", "food and meals management and preparation")
    I32_0 = ("I32_0", "cleaning and maintaining of own dwelling and surroundings")
    I33_0 = ("I33_0", "do-it-yourself decoration, maintenance and repair")
    I34_0 = ("I34_0", "care and maintenance of textiles and footwear")
    I35_0 = ("I35_0", "household management for own final use")
    I36_0 = ("I36_0", "pet care")
    I37_0 = ("I37_0", "shopping for own household and family members")
    I41_0 = ("I41_0", "childcare and instruction")
    I42_0 = ("I42_0", "care for dependent adults")
    I43_0 = ("I43_0", "help to non-dependent adult household and family members")
    I44_0 = ("I44_0", "travelling and accompanying goods or persons related to unpaid caregiving services for household and family members")
    I51_1 = ("I51_1", "fixing and building things in other people's homes without getting paid")
    I51_2 = ("I51_2", "shopping for others without getting paid")
    I51_3 = ("I51_3", "caring for and teaching for children outside of your home without getting paid")
    I51_4 = ("I51_4", "helping adults outside of your home who need care without getting paid")
    I51_5 = ("I51_5", "helping in other people's businesses without getting paid")
    I52_1 = ("I52_1", "cleaning or fixing roads or buildings without getting paid")
    I52_2 = ("I52_2", "cooking or cleaning for other people's homes without getting paid")
    I52_3 = ("I52_3", "helping with sports, music or other cultural activities without getting paid")
    I52_4 = ("I52_4", "helping with office work without getting paid")

    def __new__(cls, code, description):
        obj = object.__new__(cls)
        obj._value_ = code
        obj.code = code
        obj.description = description
        return obj

    def get_parent_node(self):
        return IcatusSecondLevelNode(self.value[:3])
    
    def is_volunteering(self):
        if self.code.startswith("I5"):
            return True
        return False

LEVEL_TO_PROMPT = [
    dedent("""\
        <System Instructions>
        You are an expert in classifying experiences in the unseen economy as either volunteering or non_volunteering.
        You should classify an experience as 'volunteering' or 'non_volunteering'. Volunteering work is described as unpaid work for other household, communities or organizations. On the other hand, work for one's own household or family members is not considered volunteering.
        In identifying dependent, keep in mind that household and family members are dependent and they pertain to non-volunteering work, while everyone else including neighbors, communities and so on are non-dependent, which pertain volunteering work.
        You are given an experience title, together with responsibilities that the user had with respect to that experience.
        Your task is to return a json output as described below.
        
        #Input Structure
            The input structure is composed of: 
            'Experience Title': The title of the experience.
            'Responsibilities': A list of responsibilities/activities/skills/behaviour that we know about the job.
            You should use the above information only to infer the context and you shouldn't return it as output. 
        
        #JSON Output instructions
            Your response must always be a JSON object with the following schema:
            {
                "dependent": boolean identifying if the experience is for a dependent adult or not,
                "reasoning": Why you chose to return the specific title and how it aligns with the input,
                "code": a string between either `volunteering` or `non_volunteering`.
            }
        </System Instructions>
        """),
        dedent("""\
        <System Instructions>
        You are an expert in classifying experiences in the unseen economy as one of the top level classes of the ICATUS database.
        You should classify an experience as one of the following:
        """) +'\n'.join([node.get_prompt() for node in IcatusFirstLevelNode])+dedent("""
        You are given an experience title, together with responsibilities that the user had with respect to that experience.
        In identifying dependent, keep in mind that household and family members are dependent and they pertain to the codes I3 and I4, while everyone else including neighbors, communities and so on are non-dependent, which pertain to the code I5.
        Your task is to return a json output as described below.
        
        #Input Structure
            The input structure is composed of: 
            'Experience Title': The title of the experience.
            'Responsibilities': A list of responsibilities/activities/skills/behaviour that we know about the job.
            You should use the above information only to infer the context and you shouldn't return it as output. 
        
        #JSON Output instructions
            Your response must always be a JSON object with the following schema:
            {
                "dependent": boolean identifying if the experience is for a dependent adult or not,
                "reasoning": Why you chose to return the specific title and how it aligns with the input,
                "code": One of I3, I4 and I5, depending on how much the experience matches the description and whether dependent is true.                                                                                       
            }
        </System Instructions>
        """),
        dedent("""\
        <System Instructions>
        You are an expert in classifying experiences in the unseen economy as one of the top level classes of the ICATUS database.
        You should classify an experience as one of the following:
        """) +'\n'.join([node.get_prompt() for node in IcatusSecondLevelNode])+dedent("""
        You are given an experience title, together with responsibilities that the user had with respect to that experience.
        In identifying dependent, keep in mind that household and family members are dependent and they pertain to the codes starting with I3 and I4, while everyone else including neighbors, communities and so on are non-dependent, which pertain to codes starting with I5.
        Your task is to return a json output as described below.
        
        #Input Structure
            The input structure is composed of: 
            'Experience Title': The title of the experience.
            'Responsibilities': A list of responsibilities/activities/skills/behaviour that we know about the job.
            You should use the above information only to infer the context and you shouldn't return it as output. 
        
        #JSON Output instructions
            Your response must always be a JSON object with the following schema:
            {
                "dependent": boolean identifying if the experience is for a dependent adult or not,
                "reasoning": Why you chose to return the specific dependent and title and how it aligns with the input,
                "code": One of the provided ICATUS codes with structure `Ixx`, depending on how much the experience matches the description.                                                                                        
            }
        </System Instructions>
        """)

]

class IcatusClassificationLevel(enum.Enum):
    TOP_LEVEL = (TopLevelDivision, 0)
    FIRST_LEVEL = (IcatusFirstLevelNode, 1)
    SECOND_LEVEL = (IcatusSecondLevelNode, 2)

    def __new__(cls, level_enum, index):
        obj = object.__new__(cls)
        obj._value_ = index
        obj.level_enum = level_enum
        obj.index = index
        return obj
    
    def get_prompt(self):
        return LEVEL_TO_PROMPT[self.value]
    
    def get_node_from_code(self, code: str):
        return self.level_enum(code)
