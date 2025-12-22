import textwrap

from app.agent.prompt_template.agent_prompt_template import STD_LANGUAGE_STYLE
from app.i18n.translation_service import get_i18n_manager

def _get_locale_section():
    language = get_i18n_manager().get_locale()
    language_label = language.label()

    return textwrap.dedent(f"""
    #Language 
    - Stick to the {language_label} language.
    - Any questions I tell you to ask me should also be in the {language_label} language.
    - Any information or data you are asked to extract and provide should also be in the same language as the conversation.
    """)

def get_language_style(*, with_locale: bool = True) -> str:
    prompt = ""
    if with_locale:
        prompt += _get_locale_section()

    prompt += STD_LANGUAGE_STYLE

    return prompt
