import enum
from textwrap import dedent

class TopLevelDivision(enum.Enum):
    VOLUNTEERING = "volunteering"
    NON_VOLUNTEERING = "non_volunteering"

    def is_volunteering(self):
        return self == TopLevelDivision.VOLUNTEERING
        


class IcatusFirstLevelNode(enum.Enum):
    I3 = ("I3", "unpaid domestic services for household and family members")
    I4 = ("I4", "unpaid caregiving services for household and family members")
    I5 = ("I5", "unpaid volunteer, trainee and other unpaid work")

    def __new__(cls, code, description):
        obj = object.__new__(cls)
        obj._value_ = code
        obj.code = code
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
    

class IcatusSecondLevelNode(enum.Enum):
    I31 = ("I31", "food and meals management and preparation")
    I32 = ("I32", "cleaning and maintaining of own dwelling and surroundings")
    I33 = ("I33", "do-it-yourself decoration, maintenance and repair")
    I34 = ("I34", "care and maintenance of textiles and footwear")
    I35 = ("I35", "household management for own final use")
    I36 = ("I36", "pet care")
    I37 = ("I37", "shopping for own household and family members")
    I41 = ("I41", "childcare and instruction")
    I42 = ("I42", "care for dependent adults")
    I43 = ("I43", "help to non-dependent adult household and family members")
    I44 = ("I44", "travelling and accompanying goods or persons related to unpaid caregiving services for household and family members")
    I51 = ("I51", "unpaid direct volunteering for other households")
    I52 = ("I52", "unpaid community- and organization-based volunteering")

    def __new__(cls, code, description):
        obj = object.__new__(cls)
        obj._value_ = code
        obj.code = code
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
        You should classify an experience as 'volunteering' if it requires work done for free for an organization, and 'non_volunteering' otherwise.
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
                "reasoning": Why you chose to return the specific title and how it aligns with the input,
                "code": a string between either `volunteering` or `non_volunteering`.
            }
        </System Instructions>
        """),
        dedent("""\
        <System Instructions>
        You are an expert in classifying experiences in the unseen economy as one of the top level classes of the ICATUS database.
        You should classify an experience as one of the following:
        """) +'\n'.join([f'{node.code}. {node.description}' for node in IcatusFirstLevelNode])+dedent("""
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
                "reasoning": Why you chose to return the specific title and how it aligns with the input,
                "code": One of I3, I4 and I5, depending on how much the experience matches the description.                                                                                        
            }
        </System Instructions>
        """),
        dedent("""\
        <System Instructions>
        You are an expert in classifying experiences in the unseen economy as one of the top level classes of the ICATUS database.
        You should classify an experience as one of the following:
        """) +'\n'.join([f'{node.code}. {node.description}' for node in IcatusSecondLevelNode])+dedent("""
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
                "reasoning": Why you chose to return the specific title and how it aligns with the input,
                "code": One of the provided ICATUS code, depending on how much the experience matches the description.                                                                                        
            }
        </System Instructions>
        """)

]