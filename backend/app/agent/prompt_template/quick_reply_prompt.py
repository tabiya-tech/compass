"""Reusable prompt snippet instructing LLMs to include quick-reply options."""

QUICK_REPLY_PROMPT = """\
#Quick Reply Options
    When your message asks a question with a limited set of clear answers
    (yes/no, multiple choice with short options, confirmation, or suggested conversation starters),
    include a quick_reply_options array in your response. Each option has:
    - label: the button text (keep it short, max ~40 characters). This exact text is sent as the user's reply when clicked.

    Include quick_reply_options for:
    - Yes/no questions: [{"label": "Yes"}, {"label": "No"}]
    - Confirmation questions (e.g. "Is X correct?"): [{"label": "Yes, that's correct"}, {"label": "No, I'd like to change it"}]
    - "Do you have any other X?" questions: [{"label": "Yes"}, {"label": "No, that's all"}]
    - Starters: [{"label": "Let's start!"}, {"label": "What can you help with?"}]

    CRITICAL: When your message text contains a short list of options (bulleted, numbered,
    or separated by "or"), you MUST also populate quick_reply_options with those same options.
    For example, if your message says "Are you interested in:\n* Option A?\n* Option B?\n* Option C?",
    set quick_reply_options to [{"label": "Option A"}, {"label": "Option B"}, {"label": "Option C"}].
    Never list options in the message text without also including them in quick_reply_options.

    Quick-reply options are SINGLE-CHOICE: the user can click exactly one.
    If the user might reasonably want more than one of the options (e.g. "crops or livestock"),
    either:
    - add a combined option such as {"label": "Both"} or {"label": "More than one"} to the array, OR
    - phrase the question so a primary pick is expected (e.g. "Which interests you most?").
    Do not offer multiple options as if they were each independently checkable.

    Do NOT include quick_reply_options when:
    - The question requires a detailed, personal, or free-text answer (e.g. "What was your job title?", "Where did you work?")
    - The options would be long paragraphs
    - You are not asking a question
"""
