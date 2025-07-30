import asyncio
import re
import time

import dotenv
from app.vector_search.esco_search_service import OccupationSkillSearchService, _skills_of_occupation_cache
from evaluation_tests.conversation_libs.search_service_fixtures import get_search_services


async def mem_usage():
    env = dotenv.find_dotenv()
    dotenv.load_dotenv(env)
    # Load all the occupations from the model
    search_services = await get_search_services()
    occupation_skill_search_service: OccupationSkillSearchService = search_services.occupation_skill_search_service
    start_time = time.time()
    await occupation_skill_search_service.get_by_esco_code(code=re.compile(".*"))  # Get all occupations
    end_time = time.time()
    print(f"Time taken to load all occupations with empty cache: {end_time - start_time:.2f} seconds")
    # output the memory usage of the cache
    stats = await _skills_of_occupation_cache.stats()
    print(f"Stats of ESCO skills of occupation cache: {stats}")
    await _skills_of_occupation_cache.clear_stats()
    # rerun the same query to check if the cache is used
    start_time = time.time()
    await occupation_skill_search_service.get_by_esco_code(code=re.compile(".*"))  # Get all occupations
    end_time = time.time()
    print(f"Time taken to load all occupations after caching: {end_time - start_time:.2f} seconds")
    stats = await _skills_of_occupation_cache.stats()
    print(f"Stats of ESCO skills of occupation cache: {stats}")
    # reset the cache
    await _skills_of_occupation_cache.clear()
    stats = await _skills_of_occupation_cache.stats()
    print(f"Stats of ESCO skills of occupation cache after clearing the cache: {stats}")

if __name__ == "__main__":
    asyncio.run(mem_usage())
