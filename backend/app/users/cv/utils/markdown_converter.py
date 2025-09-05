from io import BytesIO
import logging
from typing import Union

from markitdown import MarkItDown

_converter: MarkItDown | None = None
_converter_factory_ref: object | None = None


def _get_markitdown() -> MarkItDown:
    global _converter, _converter_factory_ref
    # We dont add locks and stuff because it would be overkill
    if _converter is None or _converter_factory_ref is not MarkItDown:
        _converter = MarkItDown()
        _converter_factory_ref = MarkItDown
    return _converter


def convert_cv_bytes_to_markdown(
        file_bytes: Union[bytes, BytesIO],
        filename: str,
        logger: logging.Logger,
) -> str:
    """Convert CV bytes to Markdown using MarkItDown.

    The function accepts raw bytes or a BytesIO stream. The filename is used to
    help the converter infer the file type.
    """
    logger.info("Converting file to markdown {filename='%s'}", filename)
    stream = file_bytes if isinstance(file_bytes, BytesIO) else BytesIO(file_bytes)
    converter = _get_markitdown()
    logger.debug("Using converter: %s", type(converter).__name__)
    result = converter.convert_stream(stream, filename=filename)

    # MarkItDown returns an object; prefer markdown if present, otherwise text_content
    markdown_text = getattr(result, "markdown", None) or getattr(result, "text_content", "")
    markdown_text = markdown_text or ""
    logger.info("Markdown conversion done {length_chars=%s}", len(markdown_text))
    logger.debug("Markdown conversion success {filename='%s', length_chars=%s}", filename, len(markdown_text))
    return markdown_text
