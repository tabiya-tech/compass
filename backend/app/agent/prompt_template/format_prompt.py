import re


def replace_placeholders_with_indent(template_string: str, **replacements: str):
    """
    Replace multiple placeholders in the template string with their corresponding replacements,
    maintaining the indentation of each placeholder if it starts a line with spaces.

    Lines starting with "///" after trimming are omitted from the final output.
    Use them to comment out lines in the prompt template string.

    :param template_string: The original template string containing placeholders
    :param replacements: Keyword arguments where keys are placeholders (without curly braces) and values are the replacement strings
    :return: The modified string with the placeholders replaced
    """

    # Split the template string into lines
    lines = template_string.splitlines()
    new_lines = []

    # Pattern to find markers
    pattern = re.compile(r'{(.*?)}')
    while len(lines):
        current_line = lines.pop(0)

        # Skip commented-out lines before processing
        if current_line.strip().startswith("///"):
            continue

        start_pos = 0
        match = pattern.search(current_line, pos=start_pos)
        if not match:
            # No more markers in the line
            new_lines.append(current_line)
            continue

        start, end = match.span()  # Found a marker
        marker = match.group(1)

        if marker in replacements:
            replacement = replacements[marker]
            if replacement is None or replacement == "":
                # If the replacement is None or empty, replace the marker with an empty string
                replacement_lines = [""]
            else:
                replacement_lines = replacement.splitlines()
            # Add the part before the marker and the first line of the replacement
            modified_line = current_line[:start] + replacement_lines[0]

            # Add remaining lines of the replacement with indentation
            indent = " " * start
            for repl_line in replacement_lines[1:]:
                modified_line += "\n" + indent + repl_line

            # Continue processing the rest of the current line after the placeholder
            rest_of_line = modified_line + current_line[end:]
            lines = rest_of_line.splitlines() + lines
        else:
            # unknown marker, keep the line as is
            new_lines.append(current_line)

    return "\n".join(new_lines)
