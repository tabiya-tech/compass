import asyncio
from enum import Enum
from typing import List, Optional, Tuple, Any

import vertexai
from datasets import load_dataset, Features, Value, VerificationMode
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from tqdm import tqdm

from app.vector_search.embeddings_model import GoogleGeckoEmbeddingService
from app.vector_search.esco_search_service import VectorSearchConfig, OccupationSearchService, SkillSearchService
from app.vector_search.similarity_search_service import SimilaritySearchService
from common_libs.environment_settings.mongo_db_settings import MongoDbSettings
from scripts.base_data_settings import ScriptSettings

OCCUPATION_REPO_ID = "tabiya/hahu_test"
OCCUPATION_FILENAME = "redacted_hahu_test_with_id.csv"
SKILL_REPO_ID = "tabiya/esco_skills_test"
SKILL_FILENAME = "data/processed_skill_test_set_with_id.parquet"

load_dotenv()
MONGO_SETTINGS = MongoDbSettings()
SCRIPT_SETTINGS = ScriptSettings()


class Type(Enum):
    """
    An enumeration class to define the type of the entity.
    """
    OCCUPATION = "occupation"
    SKILL = "skill"


def _precision_at_k(prediction: List[List[str]], true: List[List[str]], k: Optional[int] = None):
    """
    Calculates the average precision at k considering for each prediction the number of correct retrieved nodes
    divided by the number of total retrieved nodes.
    """
    total_precision = 0
    for pred_list, true_vals in zip(prediction, true):
        if k:
            pred_list = pred_list[:k]
            tot_samples = k
        else:
            tot_samples = len(pred_list)
        total_precision += len(set(true_vals).intersection(set(pred_list))) / tot_samples
    return total_precision / len(true)


def _recall_at_k(prediction: List[List[str]], true: List[List[str]], k: Optional[int] = None):
    """
    Calculates the average recall at k considering for each prediction the number of correct retrieved nodes
    divided by the number of total correct nodes.
    """
    total_recall = 0
    for pred_list, true_vals in zip(prediction, true):
        if k:
            pred_list = pred_list[:k]
        total_recall += len(set(true_vals).intersection(set(pred_list))) / len(true_vals)
    return total_recall / len(true)


def _get_f_score(prec: float, rec: float) -> float:
    """Returns the f-score corresponding to a given precision and recall. """
    return 2 * prec * rec / (prec + rec)


def _get_all_metrics(predictions: List[List[str]], true_values: List[List[str]], k: Optional[int] = None) \
        -> Tuple[float, float, float]:
    """Get recall, precision and F-score for given results and true values. """
    rec_at_k = _recall_at_k(predictions, true_values, k)
    prec_at_k = _precision_at_k(predictions, true_values, k)
    f_score_at_k = _get_f_score(prec_at_k, rec_at_k)
    return rec_at_k, prec_at_k, f_score_at_k


def _get_evaluated_field(entity: Any, evaluated_type: Type) -> str:
    """Get the field to evaluate based on the entity type."""
    if evaluated_type == Type.OCCUPATION:
        return entity.code
    elif evaluated_type == Type.SKILL:
        return entity.preferredLabel
    else:
        raise ValueError(f"Invalid entity type: {evaluated_type}")


async def _get_predictions(search_service: SimilaritySearchService, queries: List[str],
                           evaluated_type: Type, k: int = 10):
    # We could run predictions in batches to make it quicker, however there is a quota limit on the gecko embeddings
    # API. We are running it sequentially to avoid hitting the limit.
    predictions = []
    for query in tqdm(queries):
        result = await search_service.search(query, k=k)
        predictions.append([_get_evaluated_field(e, evaluated_type) for e in result])
    return predictions


async def get_metrics(search_service: SimilaritySearchService, ground_truth: List[str],
                      synthetic_queries: List[str], evaluated_type: Type):
    """ Evaluate the embeddings using ground truth data and synthetic queries."""
    predictions = await _get_predictions(search_service, synthetic_queries, evaluated_type, k=10)
    ground_truth = [[elem] for elem in ground_truth]
    print(f"Metrics for the {evaluated_type.name} embeddings:")
    for k in [1, 3, 5, 10]:
        recall, precision, f_score = _get_all_metrics(predictions, ground_truth, k)
        print(f"K = {k}, recall: {recall}, precision: {precision}, f_score: {f_score}")


if __name__ == "__main__":
    vertexai.init()
    compass_db = AsyncIOMotorClient(MONGO_SETTINGS.mongodb_uri).get_database(MONGO_SETTINGS.database_name)
    gecko_embedding_service = GoogleGeckoEmbeddingService()
    occupation_vector_search_config = VectorSearchConfig(
        collection_name=MONGO_SETTINGS.embedding_settings.occupation_collection_name,
        index_name=MONGO_SETTINGS.embedding_settings.embedding_index,
        embedding_key=MONGO_SETTINGS.embedding_settings.embedding_key,
    )
    _occupation_search_service = OccupationSearchService(compass_db, gecko_embedding_service,
                                                         occupation_vector_search_config)
    skill_vector_search_config = VectorSearchConfig(
        collection_name=MONGO_SETTINGS.embedding_settings.skill_collection_name,
        index_name=MONGO_SETTINGS.embedding_settings.embedding_index,
        embedding_key=MONGO_SETTINGS.embedding_settings.embedding_key,
    )
    _skill_search_service = SkillSearchService(compass_db, gecko_embedding_service,
                                               skill_vector_search_config)
    occupation_dataset = load_dataset(OCCUPATION_REPO_ID, data_files=[OCCUPATION_FILENAME],
                                      token=SCRIPT_SETTINGS.hf_access_token).get("train")
    # Load the skill dataset. The columns are not consistent with the definition in the dataset so we need to override
    # it and disable verification.
    skill_dataset = load_dataset(SKILL_REPO_ID, data_files=[SKILL_FILENAME], token=SCRIPT_SETTINGS.hf_access_token,
                                 features=Features(
                                     {
                                         "label": Value(dtype="string"),
                                         "sentence": Value(dtype="string"),
                                         "span": Value(dtype="string"),
                                         "sub_span": Value(dtype="string"),
                                         "ID": Value(dtype="string"),
                                         "UUID": Value(dtype="string"),
                                         "synthetic_query": Value(dtype="string"),
                                         "__index_level_0__": Value(dtype="int64"),
                                     }
                                 ),
                                 split="train",
                                 verification_mode=VerificationMode.NO_CHECKS)
    asyncio.get_event_loop().run_until_complete(
        asyncio.gather(
            *[get_metrics(_occupation_search_service,
                          occupation_dataset["esco_code"],
                          occupation_dataset["synthetic_query"], Type.OCCUPATION),
              get_metrics(_skill_search_service,
                          skill_dataset["label"],
                          skill_dataset["synthetic_query"], Type.SKILL)
              ])
    )
