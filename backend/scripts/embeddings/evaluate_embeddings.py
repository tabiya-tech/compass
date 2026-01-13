#!/usr/bin/env python3
import argparse
import asyncio
import json
import logging
import os
import sys
from typing import List, Optional, Tuple, Any

import vertexai
from datasets import load_dataset, Features, Value, VerificationMode
from dotenv import load_dotenv
from tqdm import tqdm

from _base_data_settings import Type
from app.i18n.types import Locale
from app.vector_search.esco_search_service import VectorSearchConfig
from app.vector_search.similarity_search_service import SimilaritySearchService
from common_libs.agent.translation_tool import TranslationTool
from common_libs.environment_settings.constants import EmbeddingConfig
from common_libs.logging.log_utilities import setup_logging_config
from evaluation_tests.conversation_libs.search_service_fixtures import get_search_services

OCCUPATION_REPO_ID = "tabiya/hahu_test"
OCCUPATION_FILENAME = "redacted_hahu_test_with_id.csv"
SKILL_REPO_ID = "tabiya/esco_skills_test"
SKILL_FILENAME = "data/processed_skill_test_set_with_id.parquet"

load_dotenv()
EMBEDDING_SETTINGS = EmbeddingConfig()

setup_logging_config("logging.cfg.yaml")
logger = logging.getLogger()

# TODO: Change according to the model you are evaluating
_TARGET_LOCALE = Locale.ES_ES


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


async def _get_predictions(*, search_service: SimilaritySearchService, queries: List[str],
                           evaluated_type: Type, k: int = 10):
    # We could run predictions in batches to make it quicker, however there is a quota limit on embedding service.
    # API. We are running it sequentially to avoid hitting the limit.
    predictions = []
    progress = tqdm(total=len(queries), desc=f"Evaluating predictions for {evaluated_type.name}", file=sys.stdout)
    translation_tool = TranslationTool(_TARGET_LOCALE)
    for query in queries:
        translated_text = query
        # Since the tests are in English, do not translate them
        if _TARGET_LOCALE not in [Locale.EN_GB, Locale.EN_US]:
            translated_text = await translation_tool.translate(query)
        result = await search_service.search(query=translated_text, k=k)
        predictions.append([_get_evaluated_field(e, evaluated_type) for e in result])
        progress.update()
    progress.close()
    return predictions


def _get_metrics(*, predictions: list[list[str]], ground_truth: List[str], evaluated_type: Type):
    """ Evaluate the embeddings using ground truth data and synthetic queries."""
    ground_truth = [[elem] for elem in ground_truth]
    logger.info(f"Metrics for the {evaluated_type.name} embeddings:")
    for k in [1, 3, 5, 10]:
        recall, precision, f_score = _get_all_metrics(predictions, ground_truth, k)
        logger.info(f"K = {k}, recall: {recall}, precision: {precision}, f_score: {f_score}")


def _get_vector_search_config(evaluated_type: Type) -> VectorSearchConfig:
    if evaluated_type == Type.OCCUPATION:
        collection_name = EMBEDDING_SETTINGS.occupation_collection_name
    elif evaluated_type == Type.SKILL:
        collection_name = EMBEDDING_SETTINGS.skill_collection_name
    else:
        raise ValueError(f"Invalid entity type: {evaluated_type}")
    return VectorSearchConfig(
        collection_name=collection_name,
        index_name=EMBEDDING_SETTINGS.embedding_index,
        embedding_key=EMBEDDING_SETTINGS.embedding_key,
    )


def store_data_as_json(*,
                       data: Any,
                       output_file: str
                       ):
    output_folder = os.path.join(os.getcwd(), 'test_output/')
    # ensure folder exists
    os.makedirs(output_folder, exist_ok=True)
    # Structure the data

    # Save as JSON
    _output_file = os.path.join(output_folder, output_file)
    with open(_output_file, "w", encoding="utf-8") as f:  # f is IO[str]
        json_string = json.dumps(data, indent=4, ensure_ascii=False)
        f.write(json_string)
    logger.info(f"Data saved to {output_file}")


def evaluate_top_k_hits(
        occupation_queries: list[str],
        occupation_ground_truth: list[str],
        occupations_predictions: list[list[str]]
) -> list[dict[str, object]]:
    results = []

    for idx, (query, ground_truth, predictions) in enumerate(zip(occupation_queries, occupation_ground_truth, occupations_predictions)):
        try:
            gt_index = predictions.index(ground_truth)
        except ValueError:
            gt_index = -1  # Not found

        result = {
            "query": query,
            "ground_truth": ground_truth,
            "predictions": predictions,
            "in_top_1": gt_index == 0,
            "in_top_3": 0 <= gt_index < 3,
            "in_top_10": 0 <= gt_index < 10
        }
        results.append(result)

    return results


async def main(*, do_skills: bool = False, do_occupations: bool = False):
    region = os.getenv("VERTEX_API_REGION")
    if not region:
        raise ValueError("VERTEX_API_REGION environment variable is not set.")
    vertexai.init(location=region)

    search_services = await get_search_services()

    hf_access_token = os.getenv("HF_TOKEN")
    if not hf_access_token:
        raise ValueError("HF_TOKEN environment variable is not set.")

    tasks = []
    if do_occupations:
        async def evaluate_occupations_task():
            occupation_dataset = load_dataset(OCCUPATION_REPO_ID, data_files=[OCCUPATION_FILENAME],
                                              token=hf_access_token).get("train")
            occupation_queries: list[str] = occupation_dataset["synthetic_query"]
            occupation_ground_truth: list[str] = occupation_dataset["esco_code"]
            occupations_predictions: list[list[str]] = await _get_predictions(
                search_service=search_services.occupation_search_service,
                queries=occupation_queries,
                evaluated_type=Type.OCCUPATION,
                k=10)
            occupation_top_hits = evaluate_top_k_hits(
                occupation_queries,
                occupation_ground_truth,
                occupations_predictions
            )
            store_data_as_json(
                data=occupation_top_hits,
                output_file="occupation_evaluation_output.json"
            )
            _get_metrics(
                predictions=occupations_predictions,
                ground_truth=occupation_ground_truth,
                evaluated_type=Type.OCCUPATION)

        tasks.append(evaluate_occupations_task)

    if do_skills:
        # Load the skill dataset. The columns are not consistent with the definition in the dataset so we need to override
        # it and disable verification.
        async def evaluate_skills_task():
            skill_dataset = load_dataset(SKILL_REPO_ID, data_files=[SKILL_FILENAME], token=hf_access_token,
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
            skills_queries: list[str] = skill_dataset["synthetic_query"]
            skill_ground_truth: list[str] = skill_dataset["label"]
            skills_predictions: list[list[str]] = await _get_predictions(
                search_service=search_services.skill_search_service,
                queries=skills_queries,
                evaluated_type=Type.SKILL,
                k=10)
            # Evaluate the top k hits
            skills_top_hits = evaluate_top_k_hits(
                skills_queries,
                skill_ground_truth,
                skills_predictions
            )
            store_data_as_json(
                data=skills_top_hits,
                output_file="skills_evaluation_output.json"
            )
            _get_metrics(predictions=skills_predictions,
                         ground_truth=skill_ground_truth,
                         evaluated_type=Type.SKILL)

        tasks.append(evaluate_skills_task)

    await asyncio.gather(*[task() for task in tasks])


if __name__ == "__main__":
    # add arguments for --skills and --occupations
    parser = argparse.ArgumentParser(description="Evaluate Taxonomy Embeddings",
                                     formatter_class=argparse.RawTextHelpFormatter)
    options_group = parser.add_argument_group("Options")
    options_group.add_argument(
        "--skills",
        required=False,
        action="store_true",
        help="Evaluate skills embeddings")

    options_group.add_argument(
        "--occupations",
        required=False,
        action="store_true",
        help="Evaluate occupations embeddings")

    args = parser.parse_args()
    if not args.skills and not args.occupations:
        parser.error("At least one of --skills or --occupations must be specified.")

    load_dotenv()
    asyncio.run(main(
        do_skills=args.skills,
        do_occupations=args.occupations
    ))
