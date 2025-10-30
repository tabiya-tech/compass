---
name: i18-back-agent
description: Internationalizing backend module/component
---

# My Agent

## Prompt: Add i18n + language style to a module (concise, step-by-step)

You are editing the {name_of_component} module . Apply project i18n to all user-facing messages and ensure prompts include the conversation’s language style.

Scope and constraints:
- Only modify the {name_of_component} module . Do not touch tests or docs.
- Use the existing i18n function t(domain, key, …). Do not create new modules. Small internal helper functions inside the files are OK if needed.
- Keep system prompts intact unless instructed—only add the language style hook.
- Preserve current behavior and return types. Don’t change public APIs.

Do this step by step:
1) Identify all user-facing strings
- Find any string that is returned to the user or rendered in summaries/messages (including empty-response fallbacks, end-of-step messages, final wrap-ups).
- Don’t translate system-only instructions unless the string is shown to the user. We will only inject {language_style} into those prompts.

2) Replace strings with translation keys
- Replace hardcoded strings with t("messages", "[MODULE_PREFIX].[key]") calls.
- Use a clear, module-specific namespace, e.g. messages.[feature_or_module].[purpose], such as:
  - messages.[module].did_not_understand
  - messages.[module].move_to_next
  - messages.[module].final_message
- Wrap calls with safe fallbacks so missing keys never break behavior:
  - Python example pattern:
    try:
        text = t("messages", "[MODULE_PREFIX].did_not_understand")
    except Exception:
        text = "Sorry, I didn't understand that. Can you please rephrase?"

3) Localize field labels if lists are shown
- If the module shows lists of field identifiers (e.g., "start_date, end_date"), map them to localized labels:
  - Use keys like messages.[module].fields.[field_key] (experience_title, start_date, end_date, company, location, etc.).
  - Factor a tiny helper inside the same file if needed:
    def _tr_field(key: str) -> str:
        try: return t("messages", f"[MODULE_PREFIX].fields.{key}")
        except Exception: return key

4) Inject the conversation’s language style into prompts
- For any system instruction / template where style matters, add a {language_style} placeholder to the template and pass STD_LANGUAGE_STYLE when formatting.
- Example:
  template = \"\"\"... {language_style} ...\"\"\"
  rendered = replace_placeholders_with_indent(template, language_style=STD_LANGUAGE_STYLE, ...)
- Lesson learned: adding {language_style} to the very first-turn prompt may slightly shift behavior. Prefer adding it; if it degrades first-turn performance, revert only that insertion.

5) Add locale keys (en, es, es-ar)
- Create keys under:
  - messages.json
  - messages.json
  - messages.json
- Add natural translations for:
  - All replaced user messages (did_not_understand, move_to_next, final_message, etc.)
  - Any field labels you localized (fields.*)
- Keep punctuation and tone consistent. Ensure JSON validity (commas!).

6) Guard common pitfalls
- Keep safe fallbacks for every t(...) you add (don’t crash on missing keys).
- If you join lists built from optional values, guard None and keep existing formatting.
- Don’t change retry logic, types, or public signatures. Avoid indentation/typing regressions.

7) Minimal validation
- Ensure the Python file has no syntax/type errors.
- Ensure each messages.json parses.
- Return a one-line summary of what changed and list of keys added.

Deliverables:
- Updated [TARGET_FILE] with:
  - All user-facing strings i18n-ized via t(...), with safe fallbacks.
  - {language_style} injected into relevant prompts and passed as STD_LANGUAGE_STYLE.
  - Field label localization applied where lists/labels are shown (with a tiny internal helper if needed).
- Updated locale keys in en/es/es-ar with translations for all added keys.

Key patterns to follow (examples):
- Fallback on empty LLM response:
  try:
      msg = t(\"messages\", \"[MODULE_PREFIX].did_not_understand\")
  except Exception:
      msg = \"Sorry, I didn't understand that. Can you please rephrase?\"
- Final message handoff:
  try:
      final_msg = t(\"messages\", \"[MODULE_PREFIX].final_message\")
  except Exception:
      final_msg = \"Thank you...\"  # existing string
- Localize field labels:
  labels = \", \".join(_tr_field(k) for k in field_keys)

Replace placeholders:
- [TARGET_FILE]: the exact file you’re editing
- [MODULE_PREFIX]: a short, consistent namespace for keys (e.g., collect_experiences, intent_analyzer, temporal_classifier)

At the end, list:
- The i18n keys you added
- Any spots where {language_style} was injected
- Any helpers introduced inside [TARGET_FILE]