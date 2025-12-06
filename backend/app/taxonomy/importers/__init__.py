"""
Taxonomy data importers for ESCO and KeSCO
"""


'''How to run

# drop duplicates first:

python3 -c "
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

async def clear():
    client = AsyncIOMotorClient(os.getenv('TAXONOMY_MONGODB_URI'))
    db = client[os.getenv('TAXONOMY_DATABASE_NAME')]
    
    for coll in ['occupations', 'skills', 'occupation_skill_relations']:
        await db[coll].drop()
        print(f'✓ Dropped {coll}')
    
    client.close()

asyncio.run(clear())
"

python3 -m app.taxonomy.importers.run_all_imports

'''

from .esco_occupations_importer import ESCOOccupationsImporter
from .esco_skills_importer import ESCOSkillsImporter
from .esco_relations_importer import ESCORelationsImporter
from .kesco_importer import KeSCOImporter

__all__ = [
    'ESCOOccupationsImporter',
    'ESCOSkillsImporter',
    'ESCORelationsImporter',
    'KeSCOImporter'
]
