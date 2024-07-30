import re


def sanitize_input(input_str: str, tags_to_filter: list[str]) -> str:
    """
    Remove the tags from the input string. Removes both the opening and closing tags e.g. <tag> and </tag>
    :param input_str: The input string to sanitize
    :param tags_to_filter: A list of tags to filter out of the input string
    :return:
    """
    # The tags are part of the prompt template and should not be used as input data
    for tag in tags_to_filter:
        input_str = re.sub(re.escape(f"<{tag}>"), "", input_str, flags=re.IGNORECASE)
        input_str = re.sub(re.escape(f"</{tag}>"), "", input_str, flags=re.IGNORECASE)
    return input_str
