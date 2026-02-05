import json
import argparse
import sys
import re
from pathlib import Path
from typing import Dict, Any, Optional, Iterable, Tuple


DEFAULT_BACKEND_ENV_PATH = '../backend/.env'
DEFAULT_FRONTEND_ENV_PATH = '../frontend-new/public/data/env.js'

BACKEND_ENV_MAP: Dict[str, str] = {
    'GLOBAL_PRODUCT_NAME': 'branding.appName',
    # Add more backend env vars here
}

FRONTEND_ENV_MAP: Dict[str, str] = {
    'GLOBAL_PRODUCT_NAME': 'branding.appName',
    'FRONTEND_BROWSER_TAB_TITLE': 'branding.browserTabTitle',
    'FRONTEND_META_DESCRIPTION': 'branding.metaDescription',
    'FRONTEND_LOGO_URL': 'branding.assets.logo',
    'FRONTEND_FAVICON_URL': 'branding.assets.favicon',
    'FRONTEND_APP_ICON_URL': 'branding.assets.appIcon',
    'FRONTEND_THEME_CSS_VARIABLES': 'branding.theme',
    'FRONTEND_SEO': 'branding.seo',
    # Add more frontend env.js keys here
}

FRONTEND_JSON_FIELDS = {
    'FRONTEND_THEME_CSS_VARIABLES',
    'FRONTEND_SEO',
    # Add more JSON.stringify fields here
}


def read_json(path: Path) -> Dict[str, Any]:
    try:
        return json.loads(path.read_text())
    except FileNotFoundError:
        print(f"Error: Config file not found at '{path}'")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in config file: {e}")
        sys.exit(1)


def get_by_dotted_path(obj: Any, dotted_path: str) -> Any:
    """Resolve a dotted path like 'branding.assets.logo' in a dict-like object."""
    current = obj
    for part in dotted_path.split('.'):
        if current is None:
            return None
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            return None
    return current


def coerce_env_value(value: Any) -> Optional[str]:
    """Coerce values for .env writing."""
    if value is None:
        return None
    if isinstance(value, bool):
        # Backend env conventions vary; keep simple true/false
        return 'true' if value else 'false'
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, str):
        v = value.strip()
        return v if v != '' else None

    # For dict/list: store JSON
    if isinstance(value, (dict, list)):
        return json.dumps(value)

    return str(value)


def build_env_updates(config: Dict[str, Any], mapping: Dict[str, str], namespaces: Optional[Iterable[str]] = None) -> Dict[str, Any]:
    """Build env var updates based on selected namespaces.

    If namespaces is provided, only mapping entries whose dotted-path starts with one of them are applied.
    """
    selected = set(namespaces) if namespaces else None

    updates: Dict[str, Any] = {}
    for env_key, dotted_path in mapping.items():
        top = dotted_path.split('.', 1)[0]
        if selected is not None and top not in selected:
            continue
        value = get_by_dotted_path(config, dotted_path)
        if value is None:
            continue
        updates[env_key] = value
    return updates


def upsert_env_lines(lines: list[str], key: str, value: str) -> list[str]:
    """Upsert a KEY=VALUE line into .env content preserving other lines."""
    new_line = f"{key}={value}\n"
    out: list[str] = []
    found = False

    for line in lines:
        if not found and line.lstrip().startswith(f"{key}="):
            out.append(new_line)
            found = True
        else:
            out.append(line)

    if not found:
        if out and not out[-1].endswith('\n'):
            out[-1] += '\n'
        out.append(new_line)

    return out


def update_backend_env(config: Dict[str, Any], env_path: Path, namespaces: Optional[Iterable[str]] = None):
    if not env_path.exists():
        print(f"Error: Backend .env file not found at '{env_path}'")
        sys.exit(1)

    updates_raw = build_env_updates(config, BACKEND_ENV_MAP, namespaces)

    if not updates_raw:
        return

    lines = env_path.read_text().splitlines(keepends=True)

    for key, raw_value in updates_raw.items():
        value = coerce_env_value(raw_value)
        if value is None:
            continue
        lines = upsert_env_lines(lines, key, value)

    env_path.write_text(''.join(lines))


def extract_existing_frontend_json_value(content: str, key: str) -> Dict[str, Any]:
    """Extract the existing JSON.stringify payload for a key in env.js"""
    pattern = rf'(?:"{re.escape(key)}"|{re.escape(key)}):\s*btoa\(\s*JSON\.stringify\((.*?)\)\s*\),'
    match = re.search(pattern, content, re.DOTALL)
    if not match:
        return {}
    try:
        return json.loads(match.group(1).strip())
    except Exception:
        return {}


def insert_before_closing_brace(content: str, new_line: str) -> str:
    content = content.rstrip()
    if content.endswith('};'):
        return content[:-2] + new_line + '};\n'
    return content + new_line


def format_frontend_replacement(key: str, raw_value: Any, existing_content: str) -> Tuple[str, int]:
    """Return (replacement_string, regex_flags)."""
    if key in FRONTEND_JSON_FIELDS:
        # Merge dicts if possible so config can override but keep existing keys
        existing = extract_existing_frontend_json_value(existing_content, key)
        if isinstance(raw_value, dict) and isinstance(existing, dict):
            merged = {**existing, **raw_value}
        else:
            merged = raw_value

        formatted_json = json.dumps(merged, indent=2).replace('\n', '\n    ')
        return f'{key}: btoa(\n    JSON.stringify({formatted_json})\n  ),', re.DOTALL

    if isinstance(raw_value, bool):
        rendered = 'true' if raw_value else 'false'
    elif raw_value is None:
        rendered = ''
    else:
        rendered = str(raw_value)

    rendered = rendered.replace('\\', '\\\\').replace('"', '\\"')
    return f'{key}: btoa("{rendered}"),', 0


def update_frontend_env(config: Dict[str, Any], env_js_path: Path, namespaces: Optional[Iterable[str]] = None):
    if not env_js_path.exists():
        print(f"Error: Frontend env.js file not found at '{env_js_path}'")
        sys.exit(1)

    content = env_js_path.read_text()

    updates = build_env_updates(config, FRONTEND_ENV_MAP, namespaces)
    if not updates:
        return

    # Clean up multiple consecutive empty lines
    content = re.sub(r'\n\n+', '\n', content)

    for key, raw_value in updates.items():
        replacement, flags = format_frontend_replacement(key, raw_value, content)

        if key in FRONTEND_JSON_FIELDS:
            pattern = rf'(?:"{re.escape(key)}"|{re.escape(key)}):\s*btoa\(\s*JSON\.stringify\(.*?\)\s*\),'
        else:
            pattern = rf'(?:"{re.escape(key)}"|{re.escape(key)}):\s*btoa\([^)]+\),'

        if re.search(pattern, content, flags):
            content = re.sub(pattern, replacement, content, count=1, flags=flags)
        else:
            content = insert_before_closing_brace(content, f'  {replacement}\n')

    env_js_path.write_text(content)


def parse_args(argv: Optional[list[str]] = None):
    parser = argparse.ArgumentParser(
        description='Inject namespaced config into backend .env and frontend env.js',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 inject-config.py --config default.json
  python3 inject-config.py --config default.json --namespaces branding auth
  python3 inject-config.py --config default.json --backend-env backend/.env --frontend-env frontend-new/public/data/env.js
        """
    )

    parser.add_argument('--config', required=True, metavar='CONFIG_FILE', help='Path to config JSON (e.g., default.json)')
    parser.add_argument('--backend-env', default=DEFAULT_BACKEND_ENV_PATH, help='Path to backend .env')
    parser.add_argument('--frontend-env', default=DEFAULT_FRONTEND_ENV_PATH, help='Path to frontend env.js')
    parser.add_argument('--namespaces', nargs='*', default=None,
                        help='Only apply these top-level namespaces (e.g., branding, cvUpload). Omit to apply all mapped keys.')

    return parser.parse_args(argv)


def main():
    args = parse_args()

    config_path = Path(args.config)
    config = read_json(config_path)

    update_backend_env(config, Path(args.backend_env), args.namespaces)
    update_frontend_env(config, Path(args.frontend_env), args.namespaces)

    print('Configuration injected successfully')


if __name__ == '__main__':
    main()
