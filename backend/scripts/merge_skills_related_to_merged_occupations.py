"""Script to merge skills related to ICATUS occupations that are merged into their parent nodes"""
from typing import Dict, List, Tuple

import pandas as pd

IS_SOUTH_AFRICA=False

CODES_TO_MERGE = [
    "I34",
    "I42",
    "I41",
    "I32",
    "I33",
    "I31",
    "I43",
    "I35",
    "I36",
    "I37",
    "I44"
]
ICATUS_CODE_TO_PARTICIPANTS_NUMBER = {
    "I42_0_4": 6,
    "I42_0_3": 6,
    "I42_0_2": 5,
    "I42_0_1": 6,
    "I42_0_6": 6,
    "I42_0_5": 6,
    "I41_0_1": 6,
    "I41_0_3": 6,
    "I41_0_7": 6,
    "I41_0_6": 6,
    "I41_0_5": 6,
    "I41_0_2": 6,
    "I41_0_4": 6,
    "I43_0_2": 6,
    "I43_0_1": 6,
    "I34_0_2": 7,
    "I34_0_1": 7,
    "I34_0_3": 7,
    "I34_0_4": 7,
    "I32_0_1": 7,
    "I32_0_2": 7,
    "I32_0_3": 7,
    "I32_0_4": 7,
    "I33_0_1": 7,
    "I33_0_2": 7,
    "I33_0_3": 7,
    "I31_0_3": 7,
    "I31_0_1": 7,
    "I31_0_2": 7,
    "I31_0_4": 7,
    "I35_0_2": 7,
    "I35_0_1": 7,
    "I36_0_1": 7,
    "I36_0_2": 7,
    "I37_0_2": 6,
    "I37_0_1": 7,
    "I32_0_5": 7,
    "I44_0_2": 6,
    "I44_0_3": 6
}
ICATUS_CODE_TO_KEY = {
    "I34": "key_i34_0",
    "I42": "key_i42_0",
    "I41": "key_i41_0",
    "I32": "key_i32_0",
    "I33": "key_i33_0",
    "I31": "key_i31_0",
    "I43": "key_i43_0",
    "I35": "key_i35_0",
    "I36": "key_i36_0",
    "I37": "key_i37_0",
    "I44": "key_i44_0",
}
OCCUPATION_DATA_PATH = "https://raw.githubusercontent.com/tabiya-tech/taxonomy-model-application/refs/heads/amend-tabiya-v1/data-sets/csv/tabiya-esco-1.1.1%20v1.0.0/occupations.csv"
OCCUPATION_TO_SKILLS_DATA_PATH = "https://raw.githubusercontent.com/tabiya-tech/taxonomy-model-application/refs/heads/amend-tabiya-v1/data-sets/csv/tabiya-esco-1.1.1%20v1.0.0/occupation_to_skill_relations.csv"
OUTPUT_PATH = "/Users/francescopreta/coding/brujula/tabiya1.1.1/merged_skills_12_11v3.csv" #modify to proper output path

def find_occupation_keys(df: pd.DataFrame, code: str, is_south_africa: bool = IS_SOUTH_AFRICA) -> List[str]:
    filtered_df = df[df["OCCUPATIONGROUPCODE"]==code]
    result = filtered_df["ID"].to_list()
    # Removes row for parent occupation
    if f"key_{code.lower()}_0" in result:
        result.remove(f"key_{code.lower()}_0")
    # Removes I32_0_5 in case of South Africa
    if is_south_africa and "key_i32_0_5" in result:
        result.remove("key_i32_0_5")
    return result

def find_merged_skills_keys(df: pd.DataFrame, list_of_ids: List[str], key_to_group_participants: Dict[str,int]) -> List[Tuple[str,int]]:
    filtered_df = df[df['OCCUPATIONID'].isin(list_of_ids)]
    filtered_df["SIGNALLINGVALUE"] = filtered_df["SIGNALLINGVALUE"].apply(float)
    filtered_df["NORMSIGNALLINGVALUE"] = filtered_df.apply(lambda x: x["SIGNALLINGVALUE"]/key_to_group_participants[x["OCCUPATIONID"]], axis=1)
    result = (
        filtered_df.groupby("SKILLID")["NORMSIGNALLINGVALUE"]
        .sum()
        .reset_index()
    )
    max_norm_value = result["NORMSIGNALLINGVALUE"].max()
    
    # Define function to assign labels based on normalized value
    def get_label(norm_value):
        relative_score = (norm_value / max_norm_value) * 10
        if relative_score <= 4:
            return "low"
        elif 4 < relative_score <= 6:
            return "medium"
        else:
            return "high"
    
    # Apply the label function
    result["SIGNALLINGLABEL"] = result["NORMSIGNALLINGVALUE"].apply(get_label)
    
    # Convert the result to a list of tuples (skillid, norms_signallingvalue, signallinglabel)
    result_tuples = list(result.itertuples(index=False, name=None))
    
    return result_tuples

def main():
    # Load the data into a pandas DataFrame
    occupation_df = pd.read_csv(OCCUPATION_DATA_PATH)
    occupation_to_skills_id = pd.read_csv(OCCUPATION_TO_SKILLS_DATA_PATH)

    # Utility mappings for the process
    code_to_key = {row["CODE"]:row["ID"] for _, row in occupation_df.iterrows()}
    key_to_group_participants = {code_to_key[code]: value for code, value in ICATUS_CODE_TO_PARTICIPANTS_NUMBER.items()}

    # Generate a dataframe with a row for each occupation to skill relation
    # obtained from the children
    list_of_dicts = []
    for merged_id in CODES_TO_MERGE:
        # Find all the children
        occupation_keys = find_occupation_keys(occupation_df, merged_id)

        # Find all the skill_id, signalling value and signalling label
        # coming from skills of the children
        result_tuples = find_merged_skills_keys(occupation_to_skills_id, occupation_keys, key_to_group_participants)
        list_of_dicts.extend([
            {
                "OCCUPATIONTYPE": "localoccupation",
                "OCCUPATIONID": ICATUS_CODE_TO_KEY[merged_id],
                "RELATIONTYPE": "",
                "SKILLID": skill_id,
                "SIGNALLINGVALUELABEL": label,
                "SIGNALLINGVALUE": round(value,1)

            }
            for skill_id, value, label in result_tuples
        ])
    final_df = pd.DataFrame(list_of_dicts)
    final_df.to_csv(OUTPUT_PATH, index=False)
        
    

if __name__=="__main__":
    main()
