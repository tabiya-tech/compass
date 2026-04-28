#!/usr/bin/env python3
"""
Ingest Knowledge Hub documents into the Career Explorer vector store.

Supports markdown files directly. For other formats (PDF, DOCX, etc.) uses markitdown
to convert to markdown before processing.

Usage (single sector):
  poetry run python -m scripts.ingest_sector_document \
    --markdown-path ../frontend-new/src/knowledgeHub/documents/agriculture.md \
    --sector Agriculture \
    --hot-run

Usage (all sectors):
  poetry run python -m scripts.ingest_sector_document \
    --ingest-all \
    --hot-run

Environment:
  CAREER_EXPLORER_MONGODB_URI, CAREER_EXPLORER_DATABASE_NAME - for the database
  CAREER_EXPLORER_CONFIG - JSON with sectors, country (sectors list used for --ingest-all)
  VERTEX_API_EMBEDDINGS_REGION - for embeddings
  EMBEDDINGS_MODEL_NAME - same as app config for consistency
"""
import argparse
import asyncio
import json
import logging
import os
import re
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.operations import SearchIndexModel

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
INDEX_NAME = "sector_chunks_embedding_index"
EMBEDDING_KEY = "embedding"
MARKDOWN_EXTENSIONS = {".md"}

DEFAULT_SECTORS_CONFIG = [
    {"name": "Agriculture", "description": "Commercial farming, agriprocessing", "file": "agriculture.md"},
    {"name": "Energy", "description": "Power generation, solar, renewables", "file": "energy.md"},
    {"name": "Mining", "description": "Copper, gold, gemstones", "file": "mining.md"},
    {"name": "Hospitality", "description": "Hotels, tourism, safari lodges", "file": "hospitality.md"},
    {"name": "Water", "description": "Treatment, supply, sanitation", "file": "water.md"},
]


def load_document_text(file_path: Path) -> str:
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")
    suffix = file_path.suffix.lower()
    if suffix in MARKDOWN_EXTENSIONS:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    logger.info("Converting %s to markdown via markitdown", file_path.name)
    from markitdown import MarkItDown
    converter = MarkItDown()
    result = converter.convert(str(file_path))
    return getattr(result, "markdown", None) or getattr(result, "text_content", "") or ""


def strip_yaml_frontmatter(content: str) -> str:
    frontmatter_regex = re.compile(r"^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$", re.MULTILINE)
    match = frontmatter_regex.match(content)
    if match:
        return match.group(2)
    return content


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk_words = words[i : i + chunk_size]
        if chunk_words:
            chunks.append(" ".join(chunk_words))
    return chunks


async def ensure_vector_index(collection, num_dimensions: int, hot_run: bool) -> None:
    existing = False
    async for idx in collection.list_search_indexes():
        if idx.get("name") == INDEX_NAME:
            existing = True
            break

    definition = {
        "fields": [
            {"numDimensions": num_dimensions, "path": EMBEDDING_KEY, "similarity": "cosine", "type": "vector"},
            {"path": "sector", "type": "filter"},
        ]
    }

    if existing:
        if hot_run:
            await collection.update_search_index(INDEX_NAME, definition)
            logger.info("Updated vector index")
        else:
            logger.info("Would update vector index")
    else:
        if hot_run:
            await collection.create_search_index(
                model=SearchIndexModel(definition=definition, name=INDEX_NAME, type="vectorSearch")
            )
            logger.info("Created vector index")
        else:
            logger.info("Would create vector index")


async def ingest_sector(file_path: Path, sector: str, collection, embedding_service, num_dimensions: int, hot_run: bool, clear_first: bool):
    logger.info("Loading document: %s", file_path)
    content = load_document_text(file_path)

    text = strip_yaml_frontmatter(content)
    if not text or len(text.strip()) < 100:
        raise ValueError(f"Document produced insufficient text: {len(text)} chars")

    chunks = chunk_text(text)
    logger.info("Created %d chunks from %d chars for sector %s", len(chunks), len(text), sector)

    if clear_first and hot_run:
        deleted = await collection.delete_many({"sector": sector})
        logger.info("Cleared %d existing chunks for sector %s", deleted.deleted_count, sector)

    if not hot_run:
        logger.info("Dry run - would ingest %d chunks for sector %s", len(chunks), sector)
        return

    batch_size = 50
    
    if len(chunks) > 0:
        first_batch = chunks[0:min(batch_size, len(chunks))]
        first_embeddings = await embedding_service.embed_batch(first_batch)
        first_docs = []
        for j, (chunk_content, embedding) in enumerate(zip(first_batch, first_embeddings)):
            chunk_id = f"{sector.lower()}_{j:05d}"
            first_docs.append({
                "chunk_id": chunk_id,
                "sector": sector,
                "text": chunk_content,
                "metadata": {"source": file_path.name, "chunk_index": j},
                "embedding": embedding,
            })
        await collection.insert_many(first_docs)
        logger.info("Inserted first batch (%d chunks) to create collection", len(first_docs))

    if len(chunks) > batch_size:
        for i in range(batch_size, len(chunks), batch_size):
            batch = chunks[i : i + batch_size]
            embeddings = await embedding_service.embed_batch(batch)
            docs = []
            for j, (chunk_content, embedding) in enumerate(zip(batch, embeddings)):
                chunk_id = f"{sector.lower()}_{i + j:05d}"
                docs.append({
                    "chunk_id": chunk_id,
                    "sector": sector,
                    "text": chunk_content,
                    "metadata": {"source": file_path.name, "chunk_index": i + j},
                    "embedding": embedding,
                })
            await collection.insert_many(docs)
            logger.info("Inserted chunks %d-%d", i, i + len(batch) - 1)

    logger.info("Done. Ingested %d chunks for sector %s", len(chunks), sector)


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--markdown-path", help="Path to a document file (markdown, PDF, Word, etc.) - required if --ingest-all not set")
    parser.add_argument("--sector", help="Sector name (e.g. Agriculture) - required if --markdown-path is set")
    parser.add_argument("--ingest-all", action="store_true", help="Ingest all Knowledge Hub markdown files")
    parser.add_argument("--hot-run", action="store_true", help="Actually write to DB")
    parser.add_argument("--clear-first", action="store_true", help="Delete existing chunks for sector(s) before ingesting")
    args = parser.parse_args()

    if not args.ingest_all and (not args.markdown_path or not args.sector):
        parser.error("Either --ingest-all or both --markdown-path and --sector must be provided")

    mongodb_uri = os.getenv("CAREER_EXPLORER_MONGODB_URI")
    db_name = os.getenv("CAREER_EXPLORER_DATABASE_NAME")
    if not mongodb_uri or not db_name:
        raise ValueError("Set CAREER_EXPLORER_MONGODB_URI and CAREER_EXPLORER_DATABASE_NAME")

    client = AsyncIOMotorClient(mongodb_uri, tlsAllowInvalidCertificates=True)
    db = client.get_database(db_name)
    collection = db["career_explorer_sector_chunks"]

    embedding_model = os.getenv("EMBEDDINGS_MODEL_NAME", "text-embedding-005")

    from app.vector_search.embeddings_model import GoogleEmbeddingService

    embedding_service = GoogleEmbeddingService(model_name=embedding_model)
    num_dimensions = 768

    if args.ingest_all:
        base_path = Path(__file__).parent.parent.parent / "frontend-new" / "src" / "knowledgeHub" / "documents"
        config_json = os.getenv("CAREER_EXPLORER_CONFIG")
        if config_json:
            try:
                config_data = json.loads(config_json)
                sectors_config = config_data.get("sectors", DEFAULT_SECTORS_CONFIG)
            except json.JSONDecodeError:
                logger.warning("Invalid CAREER_EXPLORER_CONFIG JSON, falling back to default sectors")
                sectors_config = DEFAULT_SECTORS_CONFIG
        else:
            sectors_config = DEFAULT_SECTORS_CONFIG
        
        sector_files = {}
        for sector in sectors_config:
            sector_name = sector.get("name")
            sector_file = sector.get("file")
            if sector_name and sector_file:
                sector_files[sector_name] = base_path / sector_file
            else:
                logger.warning("Skipping invalid sector config entry: %s", sector)
        
        if args.clear_first and args.hot_run:
            deleted = await collection.delete_many({})
            logger.info("Cleared all existing chunks")

        first_sector_processed = False
        for sector, md_path in sector_files.items():
            if args.hot_run and not first_sector_processed:
                await ingest_sector(md_path, sector, collection, embedding_service, num_dimensions, args.hot_run, False)
                await ensure_vector_index(collection, num_dimensions, args.hot_run)
                first_sector_processed = True
            else:
                await ingest_sector(md_path, sector, collection, embedding_service, num_dimensions, args.hot_run, False)
    else:
        markdown_path = Path(args.markdown_path)
        if args.clear_first and args.hot_run:
            deleted = await collection.delete_many({"sector": args.sector})
            logger.info("Cleared %d existing chunks for sector %s", deleted.deleted_count, args.sector)

        if args.hot_run:
            await ingest_sector(markdown_path, args.sector, collection, embedding_service, num_dimensions, args.hot_run, False)
            await ensure_vector_index(collection, num_dimensions, args.hot_run)
        else:
            await ingest_sector(markdown_path, args.sector, collection, embedding_service, num_dimensions, args.hot_run, False)

    client.close()
    await asyncio.sleep(0.1)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
