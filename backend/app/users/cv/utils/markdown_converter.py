from __future__ import annotations

from io import BytesIO
from typing import Union

from markitdown import MarkItDown

def convert_cv_bytes_to_markdown(file_bytes: Union[bytes, BytesIO], filename: str) -> str:
    """Convert CV bytes to Markdown using MarkItDown.

    The function accepts raw bytes or a BytesIO stream. The filename is used to
    help the converter infer the file type.
    """
    stream = file_bytes if isinstance(file_bytes, BytesIO) else BytesIO(file_bytes)
    converter = MarkItDown()
    result = converter.convert_stream(stream, filename=filename)

    # MarkItDown returns an object; prefer markdown if present, otherwise text_content
    markdown_text = getattr(result, "markdown", None) or getattr(result, "text_content", "")
    return markdown_text or ""

# TODO: consider content size
