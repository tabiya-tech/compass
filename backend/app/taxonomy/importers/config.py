import os
from pathlib import Path
from bson import ObjectId #type:ignore
from dotenv import load_dotenv #type:ignore

# Load environment variables from .env file
load_dotenv()

# Base directory for data files
DATA_DIR = os.getenv(
    "TAXONOMY_DATA_DIR",
    str(Path.home() / "tabiya" / "resources")
)

# ESCO CSV files
ESCO_DIR = os.path.join(DATA_DIR, "taxonomy_Tabiya")
ESCO_OCCUPATIONS_CSV = os.path.join(ESCO_DIR, "occupations.csv")
ESCO_SKILLS_CSV = os.path.join(ESCO_DIR, "skills.csv")
ESCO_RELATIONS_CSV = os.path.join(ESCO_DIR, "occupation_to_skill_relations.csv")
ESCO_OCCUPATION_GROUPS_CSV = os.path.join(ESCO_DIR, "occupation_groups.csv")
ESCO_SKILL_GROUPS_CSV = os.path.join(ESCO_DIR, "skill_groups.csv")

# KeSCO Excel file
KESCO_OCCUPATIONS_XLSX = os.path.join(DATA_DIR, "kesco_occupations.xlsx")

# MongoDB connection - Use TAXONOMY_MONGODB_URI from .env
MONGODB_URI = os.getenv("TAXONOMY_MONGODB_URI", "mongodb://localhost:27017")
TAXONOMY_DB_NAME = os.getenv("TAXONOMY_DATABASE_NAME", "taxonomy_db")

# Taxonomy Model ID from .env (or generate new one)
TAXONOMY_MODEL_ID_STR = os.getenv("TAXONOMY_MODEL_ID")
if TAXONOMY_MODEL_ID_STR:
    TAXONOMY_MODEL_ID = ObjectId(TAXONOMY_MODEL_ID_STR)
else:
    TAXONOMY_MODEL_ID = ObjectId()  # Generate new one if not in .env


def validate_files():
    """Validate that all required files exist"""
    required_files = [
        ("ESCO Occupations", ESCO_OCCUPATIONS_CSV),
        ("ESCO Skills", ESCO_SKILLS_CSV),
        ("ESCO Relations", ESCO_RELATIONS_CSV),
        ("KeSCO Occupations", KESCO_OCCUPATIONS_XLSX),
    ]
    
    missing = []
    for name, path in required_files:
        if not os.path.exists(path):
            missing.append(f"{name}: {path}")
    
    if missing:
        raise FileNotFoundError(
            f"Missing required files:\n" + "\n".join(f"  - {m}" for m in missing)
        )
    
    return True


if __name__ == "__main__":
    print("Taxonomy Importer Configuration")
    print("=" * 60)
    print(f"Data Directory: {DATA_DIR}")
    print(f"ESCO Directory: {ESCO_DIR}")
    print(f"MongoDB URI: {MONGODB_URI[:50]}..." if len(MONGODB_URI) > 50 else f"MongoDB URI: {MONGODB_URI}")
    print(f"Database Name: {TAXONOMY_DB_NAME}")
    print(f"Taxonomy Model ID: {TAXONOMY_MODEL_ID}")
    print()
    
    try:
        validate_files()
        print("✅ All required files found!")
        print("\nFiles:")
        print(f"  - {ESCO_OCCUPATIONS_CSV}")
        print(f"  - {ESCO_SKILLS_CSV}")
        print(f"  - {ESCO_RELATIONS_CSV}")
        print(f"  - {KESCO_OCCUPATIONS_XLSX}")
    except FileNotFoundError as e:
        print(f"❌ {e}")