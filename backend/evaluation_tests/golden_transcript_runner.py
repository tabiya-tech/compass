#!/usr/bin/env python3
"""
Golden Transcript Runner

Runs persona-focused golden transcripts and writes baseline metrics per transcript.
"""
import argparse
import asyncio
import json
import logging
from pathlib import Path

from app.app_config import set_application_config, ApplicationConfig
from app.countries import Country, get_country_from_string
from app.i18n.language_config import LanguageConfig, LocaleDateFormatEntry
from app.i18n.locale_date_format import reset_date_format_cache
from app.i18n.types import Locale
from app.i18n.translation_service import get_i18n_manager
from app.version.types import Version
from app.agent.linking_and_ranking_pipeline import ExperiencePipelineConfig
from evaluation_tests.baseline_metrics_collector import BaselineMetricsCollector
from evaluation_tests.conversation_libs import conversation_generator
from evaluation_tests.conversation_libs.conversation_test_function import LLMSimulatedUser
from evaluation_tests.conversation_libs.fake_conversation_context import save_conversation
from evaluation_tests.conversation_libs.search_service_fixtures import get_search_services
from evaluation_tests.e2e_chat_executor import E2EChatExecutor

logger = logging.getLogger(__name__)


def _ensure_test_app_config():
    language_config = LanguageConfig(
        default_locale=Locale.EN_US,
        available_locales=[
            LocaleDateFormatEntry(locale=Locale.EN_US, date_format="MM/DD/YYYY"),
            LocaleDateFormatEntry(locale=Locale.EN_GB, date_format="DD/MM/YYYY"),
            LocaleDateFormatEntry(locale=Locale.ES_AR, date_format="DD/MM/YYYY"),
            LocaleDateFormatEntry(locale=Locale.ES_ES, date_format="DD/MM/YYYY"),
        ],
    )
    config = ApplicationConfig(
        environment_name="test",
        version_info=Version(date="test", branch="test", buildNumber="test", sha="test"),
        enable_metrics=False,
        default_country_of_user=Country.UNSPECIFIED,
        taxonomy_model_id="test",
        embeddings_service_name="test",
        embeddings_model_name="test",
        cv_storage_bucket="test",
        features={},
        language_config=language_config,
    )
    set_application_config(config)
    reset_date_format_cache()


def _load_transcripts(transcripts_dir: Path) -> list[dict]:
    transcripts = []
    for path in transcripts_dir.rglob("*.json"):
        if "output" in path.parts:
            continue
        with open(path, "r") as f:
            data = json.load(f)
        if "name" in data:
            data["_path"] = path
            transcripts.append(data)
    return transcripts


async def _run_transcript(transcript: dict, output_dir: Path):
    _ensure_test_app_config()
    locale = Locale.from_locale_str(transcript.get("locale", "en-US"))
    get_i18n_manager().set_locale(locale)

    search_services = await get_search_services()
    experience_pipeline_config = ExperiencePipelineConfig.model_validate({
        "number_of_clusters": transcript.get("number_of_clusters", 5),
        "number_of_top_skills_to_pick_per_cluster": transcript.get("number_of_top_skills_to_pick_per_cluster", 2),
    })
    session_id = transcript.get("session_id", None)
    if session_id is None:
        session_id = int(Path(transcript["_path"]).stat().st_mtime)

    metrics_collector = BaselineMetricsCollector(
        test_case_name=transcript["name"],
        session_id=str(session_id),
    )
    chat_executor = E2EChatExecutor(
        session_id=session_id,
        default_country_of_user=get_country_from_string(transcript.get("country_of_user", "Unspecified")),
        search_services=search_services,
        experience_pipeline_config=experience_pipeline_config,
        metrics_collector=metrics_collector,
    )

    await conversation_generator.generate(
        max_iterations=transcript.get("conversation_rounds", 50),
        execute_simulated_user=LLMSimulatedUser(
            system_instructions=transcript["simulated_user_prompt"]
        ),
        execute_evaluated_agent=lambda agent_input: chat_executor.send_message(agent_input=agent_input),
        is_finished=lambda agent_output: chat_executor.conversation_is_complete(agent_output=agent_output),
    )

    output_path = output_dir / transcript["name"]
    output_path.mkdir(parents=True, exist_ok=True)
    metrics_path = metrics_collector.save_metrics(output_path)
    context = await chat_executor.get_conversation_memory_manager().get_conversation_context()
    save_conversation(context, title=transcript["name"], folder_path=str(output_path))
    logger.info("Saved metrics to %s", metrics_path)


async def _run_all(transcripts: list[dict], output_dir: Path, name_filter: str | None):
    for transcript in transcripts:
        if name_filter and transcript["name"] != name_filter:
            continue
        logger.info("Running transcript: %s", transcript["name"])
        await _run_transcript(transcript, output_dir)


def main():
    parser = argparse.ArgumentParser(description="Run golden transcripts and collect metrics.")
    parser.add_argument("--transcripts-dir", default="evaluation_tests/golden_transcripts", help="Path to transcripts.")
    parser.add_argument("--output-dir", default="evaluation_tests/golden_transcripts/output", help="Metrics output dir.")
    parser.add_argument("--name", default=None, help="Run a single transcript by name.")
    args = parser.parse_args()

    transcripts_dir = Path(args.transcripts_dir)
    output_dir = Path(args.output_dir)
    transcripts = _load_transcripts(transcripts_dir)

    if not transcripts:
        raise SystemExit(f"No transcripts found in {transcripts_dir}")

    asyncio.run(_run_all(transcripts, output_dir, args.name))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
