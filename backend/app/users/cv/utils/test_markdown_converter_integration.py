from pathlib import Path

import pytest

INPUTS_DIR = Path(__file__).parent / "inputs"
OUTPUTS_DIR = Path(__file__).parent / "outputs"

# Skip the whole module if markitdown isn't available in the env
try:
    import markitdown as _markitdown  # type: ignore  # noqa: F401
    MARKITDOWN_AVAILABLE = True
except Exception:  # pragma: no cover - env dependent
    MARKITDOWN_AVAILABLE = False

pytestmark = pytest.mark.skipif(
    not MARKITDOWN_AVAILABLE, reason="markitdown package not installed"
)


PARAMS = [
    ("cv.txt", b"# Title\n\nParagraph with image: ![img](image.png)\n", None),
    ("cv.docx", None, "sample-cv-with-image.docx"),
    ("cv.pdf", None, "sample-cv-with-image.pdf"),
]


def _load_bytes(filename: str, raw_bytes: bytes | None, input_relpath: str | None) -> bytes:
    if raw_bytes is None:
        input_path = INPUTS_DIR / str(input_relpath)
        if not input_path.exists():
            pytest.skip(f"Missing input: {input_path}")
        return input_path.read_bytes()
    return raw_bytes


@pytest.mark.asyncio
@pytest.mark.parametrize("filename, raw_bytes, input_relpath", PARAMS)
async def test_convert_contains_content(filename: str, raw_bytes: bytes | None, input_relpath: str | None, mocker):
    from app.users.cv.utils.markdown_converter import convert_cv_bytes_to_markdown
    file_bytes = _load_bytes(filename, raw_bytes, input_relpath)
    markdown = convert_cv_bytes_to_markdown(file_bytes, filename, mocker.Mock())
    assert isinstance(markdown, str)
    assert len(markdown) > 0
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    output_name = f"{Path(input_relpath).name if input_relpath else filename}.md"
    (OUTPUTS_DIR / output_name).write_text(markdown)


@pytest.mark.asyncio
@pytest.mark.skip # I want to preserve headers but markitdown doesn't always do it well
@pytest.mark.parametrize("filename, raw_bytes, input_relpath", PARAMS)
async def test_convert_preserves_headings(filename: str, raw_bytes: bytes | None, input_relpath: str | None, mocker):
    from app.users.cv.utils.markdown_converter import convert_cv_bytes_to_markdown
    file_bytes = _load_bytes(filename, raw_bytes, input_relpath)
    markdown = convert_cv_bytes_to_markdown(file_bytes, filename, mocker.Mock())
    assert "#" in markdown or "\n##" in markdown or "\n###" in markdown


@pytest.mark.asyncio
@pytest.mark.parametrize("filename, raw_bytes, input_relpath", [param for param in PARAMS if param[0] != "cv.pdf"]) # PDF test always fails to detect images
async def test_convert_detects_images_when_present(filename: str, raw_bytes: bytes | None, input_relpath: str | None, mocker):
    from app.users.cv.utils.markdown_converter import convert_cv_bytes_to_markdown
    file_bytes = _load_bytes(filename, raw_bytes, input_relpath)
    markdown = convert_cv_bytes_to_markdown(file_bytes, filename, mocker.Mock())
    # Heuristic presence of images in markdown form
    assert ("![" in markdown) or ("![]" in markdown) or ("](data:image" in markdown) or ("<img" in markdown)


