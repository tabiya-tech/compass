"""
Helper module called by import_translations_from_sheets.py to auto-register
new languages in the backend and frontend configurations.
"""

import json
import re
from pathlib import Path
from typing import Union, Callable

# Converts locale codes like 'en-GB' into 'enGb' for TypeScript var names.
def get_camel_case(locale: str) -> str:
    lang, *region = locale.split("-")
    return lang + "".join(r.capitalize() for r in region)

# Converts locale codes like 'en-GB' into 'EN_GB' for Enum keys.
def get_enum_key(locale: str) -> str:
    return locale.replace("-", "_").upper()

# Finds and replaces/injects code within a file using regex.
def _patch(path: Path, pattern: str, repl: Union[str, Callable], count: int = 1):
    if not path.exists():
        return
    content = path.read_text("utf-8")

    if not re.search(pattern, content, flags=re.DOTALL):
        raise RuntimeError(
            f"Locale registration patch failed: pattern did not match in {path}.\n"
            f"Pattern: {pattern!r}"
        )

    new_content = re.sub(pattern, repl, content, flags=re.DOTALL, count=count)
    if content == new_content:
        raise RuntimeError(
            f"Locale registration patch made no changes in {path}.\n"
            f"Pattern: {pattern!r}"
        )

    path.write_text(new_content, "utf-8")

# Injects a token into a bracketed list (e.g. [A, B]) if not present.
def _inject_in_list(path: Path, pattern: str, token: str):
    if not path.exists():
        return
    content = path.read_text("utf-8")

    match = re.search(pattern, content, flags=re.DOTALL)
    if not match:
        raise RuntimeError(
            f"Locale registration list injection failed: pattern did not match in {path}.\n"
            f"Pattern: {pattern!r}"
        )

    if token in match.group(2):
        return

    _patch(
        path,
        pattern,
        lambda m: f"{m.group(1)}{m.group(2).rstrip()}{', ' if m.group(2).strip() else ''}{token}{m.group(3)}",
    )

def update_backend_types(path: Path, locale: str):
    key = get_enum_key(locale)
    # Add to Locale Enum members
    _patch(path, r'([A-Z_]+\s*=\s*"[^"]+")\n+\s+(@staticmethod)', rf'\1\n    {key} = "{locale}"\n\n    \2')
    # Add to labels
    case = f'            case Locale.{key}:\n                return "{locale}"'
    _patch(
        path,
        r'(    def label\(self\)[^\n]*\n[\s\S]*return "[^"]+"\n)(\n\s*SUPPORTED_LOCALES:)',
        rf'\1{case}\n\2',
    )
    # Add to a supported list
    _inject_in_list(path, r"(SUPPORTED_LOCALES:\s*list\[Locale\]\s*=\s*\[)([^\]]*)(\])", f"Locale.{key}")

def update_frontend_constants(path: Path, locale: str):
    key = get_enum_key(locale)
    # Add to Locale enum
    _patch(path, r"(export enum Locale \{[^}]*)(\n})", rf'\1\n  {key} = "{locale}",\2')
    # Add to labels
    _patch(path, r"(export const LocalesLabels = \{[\s\S]*?)(} as const;)", rf'\1  [Locale.{key}]: "{locale}",\n\2')
    # Add to a supported list
    _inject_in_list(path, r"(export const SupportedLocales: Locale\[\] = \[)([^\]]*)(\];)", f"Locale.{key}")

def update_frontend_i18n(path: Path, locale: str):
    camel, key = get_camel_case(locale), get_enum_key(locale)
    q_var = f"questions{camel[0].upper()}{camel[1:]}"
    # Imports
    _patch(path, r'(import [a-zA-Z]+ from "\./locales/[^/]+/translation\.json";)', rf'\1\nimport {camel} from "./locales/{locale}/translation.json";')
    _patch(path, r'(import questions[a-zA-Z]+ from "src/feedback/[^"]+";)', rf'\1\nimport {q_var} from "src/feedback/overallFeedback/feedbackForm/questions-{locale}.json";')
    # Resources mapping: append to end of block
    entry = f"  ...constructLocaleResources(Locale.{key}, {{ ...{camel}, questions: {q_var} }}),"
    _patch(path, r"(\n};)", rf"\n{entry}\1")

def _update_field_translations(field: dict, locale: str, fallback: str) -> bool:
    """Updates translations for a single field in default.json. Returns True if changed."""
    changed = False
    for attr in ["label", "questionText", "values", "validation"]:
        target = field.get(attr) if attr != "validation" else field.get("validation", {}).get("errorMessage")
        if isinstance(target, dict) and locale not in target:
            target[locale] = target.get(fallback) or (next(iter(target.values()), "" if attr != "values" else []))
            changed = True
    return changed

def update_default_json(path: Path, locale: str, fallback: str = "en-GB"):
    if not path.exists(): return
    data = json.loads(path.read_text("utf-8"))
    changed = False
    
    # Supported list
    ui = data.get("i18n", {}).get("ui", {})
    if "supportedLocales" in ui and locale not in ui["supportedLocales"]:
        ui["supportedLocales"].append(locale); changed = True
        
    # Sensitive data fields
    for field in data.get("sensitiveData", {}).get("fields", {}).values():
        if _update_field_translations(field, locale, fallback):
            changed = True
                
    if changed:
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", "utf-8")

def register_locales(root: Path, locales: list[str]):
    locs = [str(l).strip() for l in locales if str(l).strip()]
    constants_path = root / "frontend-new" / "src" / "i18n" / "constants.ts"
    if not constants_path.exists(): return []

    content = constants_path.read_text("utf-8")
    new_locs = [l for l in locs if f'= "{l}"' not in content]
    if not new_locs: return []

    print(f"Registering: {new_locs}")
    files = {
        "backend_types": root / "backend" / "app" / "i18n" / "types.py",
        "frontend_constants": constants_path,
        "frontend_i18n":  root / "frontend-new" / "src" / "i18n" / "i18n.ts",
        "default_json": root / "config" / "default.json"
    }

    for locale in new_locs:
        update_backend_types(files["backend_types"], locale)
        update_frontend_constants(files["frontend_constants"], locale)
        update_frontend_i18n(files["frontend_i18n"], locale)
        update_default_json(files["default_json"], locale)

    return new_locs
