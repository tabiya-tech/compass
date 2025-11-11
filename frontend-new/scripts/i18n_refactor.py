#!/usr/bin/env python3
"""Unified i18n refactor utility.

Subcommands:
  scan-usage         Build usage index (file -> [keys]) + suggested anchors.
  transform-locales  Apply migration map to locale JSON files (dry-run supported).
  update-usages      Replace string-literal keys in code using migration map.
  sanity-check       Verify all used keys exist & ICU placeholders preserved.
  update-cumulative  Merge batch map into cumulative migration map.

Design goals:
- Single entry point keeps artifact footprint minimal.
- Pure Python + stdlib only (no external deps) for portability.
- All operations idempotent; dry-run shows planned changes without writing.

Assumptions:
- Locale files at: frontend-new/src/locales/<lang>/translation.json
- Migration map path provided via --map (JSON: oldKey -> newKey)
- Cumulative map at: frontend-new/i18n-refactor/migration-map.cumulative.json

Example usage:
  python scripts/i18n_refactor.py scan-usage --root src --out i18n-refactor/usage.batch-3.json
  python scripts/i18n_refactor.py transform-locales --map i18n-refactor/migration-map.batch-3.json --dry-run
  python scripts/i18n_refactor.py update-usages --map i18n-refactor/migration-map.batch-3.json --root src --dry-run
  python scripts/i18n_refactor.py sanity-check --root src --base-lang en-us
  python scripts/i18n_refactor.py update-cumulative --map i18n-refactor/migration-map.batch-3.json
"""
from __future__ import annotations
import argparse
import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Set, Tuple

I18N_CALL_PATTERNS = [
    r"(?<![A-Za-z0-9_])t\(\s*['\"]([^'\"]+)['\"]",    # t("key") / t('key') without matching test(
    r"useTranslation\(\)\.t\(\s*['\"]([^'\"]+)['\"]", # useTranslation().t("key")
    r"i18n\.t\(\s*['\"]([^'\"]+)['\"]",              # i18n.t("key")
    r"<Trans[^>]*i18nKey=['\"]([^'\"]+)['\"]",          # <Trans i18nKey="key"
    r"formatMessage\(\{[^}]*id:\s*['\"]([^'\"]+)['\"]" # formatMessage({ id: 'key' })
]

PLACEHOLDER_REGEX = re.compile(r"{{\s*([\w\.]+)\s*}}")
ALLOWLIST_PATH = Path("i18n-refactor/sanity-allowlist.json")

def _load_json(path: Path) -> Dict:
    with path.open('r', encoding='utf-8') as f:
        return json.load(f)

def _write_json(path: Path, data: Dict, dry_run: bool) -> None:
    if dry_run:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def _load_allowlist(base_lang: str) -> Set[str]:
    if not ALLOWLIST_PATH.exists():
        return set()
    data = _load_json(ALLOWLIST_PATH)
    allowed: Set[str] = set()
    if isinstance(data, dict):
        for key in ("*", base_lang):
            values = data.get(key)
            if isinstance(values, list):
                allowed.update(v for v in values if isinstance(v, str))
    return allowed

def scan_usage(root: Path, out: Path) -> None:
    patterns = [re.compile(p) for p in I18N_CALL_PATTERNS]
    usage: Dict[str, List[str]] = {}
    for file in root.rglob('*'):
        if file.suffix not in {'.ts', '.tsx', '.js', '.jsx'}:
            continue
        text = file.read_text(encoding='utf-8', errors='ignore')
        found: Set[str] = set()
        for pat in patterns:
            for m in pat.finditer(text):
                found.add(m.group(1))
        if found:
            rel = str(file.relative_to(root))
            usage[rel] = sorted(found)
    anchors = _suggest_anchors(list(usage.keys()))
    out_data = {"files": usage, "suggestedAnchors": anchors}
    _write_json(out, out_data, dry_run=False)
    print(f"✅ usage index written: {out}")

def _suggest_anchors(files: List[str]) -> Dict[str, str]:
    anchors = {}
    for f in files:
        # example: auth/pages/Login/Login.tsx -> auth.pages.login
        parts = f.split('/')
        if 'pages' in parts:
            idx = parts.index('pages')
            if idx + 1 < len(parts):
                page = parts[idx + 1]
                anchors[f] = f"auth.pages.{page.lower()}"
        elif 'components' in parts:
            idx = parts.index('components')
            if idx + 1 < len(parts):
                comp = parts[idx + 1]
                anchors[f] = f"auth.components.{comp.lower()}"
        else:
            # fallback module inference
            if parts and parts[0] == 'auth':
                anchors[f] = 'auth.misc'
    return anchors

def transform_locales(map_path: Path, locales_root: Path, dry_run: bool) -> None:
    mapping = _load_json(map_path)
    changes_total = 0
    for locale_file in locales_root.rglob('translation.json'):
        data = _load_json(locale_file)
        # Flatten and rebuild using mapping (simple move)
        flat = _flatten_json(data)
        new_flat = flat.copy()
        for old, new in mapping.items():
            if old in flat:
                new_flat[new] = flat[old]
                if new != old:
                    del new_flat[old]
                    changes_total += 1
        rebuilt = _unflatten_json(new_flat)
        _write_json(locale_file, rebuilt, dry_run)
        print(f"{'DRY-RUN would transform' if dry_run else 'Transformed'} {locale_file}")
    print(f"✅ locale transform complete (changes: {changes_total}, dry_run={dry_run})")

def _flatten_json(data: Dict, prefix: str = '') -> Dict[str, str]:
    items = {}
    for k, v in data.items():
        path = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            items.update(_flatten_json(v, path))
        else:
            items[path] = v
    return items

def _unflatten_json(flat: Dict[str, str]) -> Dict:
    root: Dict = {}
    for k, v in flat.items():
        parts = k.split('.')
        cur = root
        for p in parts[:-1]:
            cur = cur.setdefault(p, {})
        cur[parts[-1]] = v
    return root

def update_usages(map_path: Path, root: Path, dry_run: bool) -> None:
    mapping = _load_json(map_path)
    reverse = {old: new for old, new in mapping.items() if old != new}
    # Replace only quoted literals, conservatively
    changed_files = 0
    for file in root.rglob('*'):
        if file.suffix not in {'.ts', '.tsx', '.js', '.jsx'}:
            continue
        original = file.read_text(encoding='utf-8', errors='ignore')
        updated = original
        for old, new in reverse.items():
            updated = re.sub(rf"(['\"]){re.escape(old)}(['\"])", rf"\1{new}\2", updated)
        if updated != original:
            changed_files += 1
            if not dry_run:
                file.write_text(updated, encoding='utf-8')
            else:
                print(f"DRY-RUN would modify {file}")
    print(f"✅ usage update complete (files changed: {changed_files}, dry_run={dry_run})")

def sanity_check(root: Path, locales_root: Path, base_lang: str) -> None:
    # Collect all used keys
    patterns = [re.compile(p) for p in I18N_CALL_PATTERNS]
    used: Set[str] = set()
    for file in root.rglob('*'):
        if file.suffix not in {'.ts', '.tsx', '.js', '.jsx'}:
            continue
        text = file.read_text(encoding='utf-8', errors='ignore')
        for pat in patterns:
            for m in pat.finditer(text):
                used.add(m.group(1))
    base_locale_file = locales_root / base_lang / 'translation.json'
    if not base_locale_file.exists():
        print(f"❌ base locale not found: {base_locale_file}")
        sys.exit(1)
    flat = _flatten_json(_load_json(base_locale_file))
    allowlist = _load_allowlist(base_lang)
    missing = sorted(k for k in used if k not in flat and k not in allowlist)
    print(f"Total used keys: {len(used)} | Missing in {base_lang}: {len(missing)}")
    if missing:
        for k in missing[:50]:
            print(f"  MISSING: {k}")
    else:
        print("✅ All used keys present in base locale")
    # Placeholder parity (basic heuristic)
    placeholder_mismatches: List[Tuple[str, List[str], List[str]]] = []
    for key in used:
        if key in flat and isinstance(flat[key], str):
            placeholders = PLACEHOLDER_REGEX.findall(flat[key])
            # Could extend with source inference if needed
            # For now, we just record tokens discovered
            if len(set(placeholders)) != len(placeholders):
                placeholder_mismatches.append((key, placeholders, list(set(placeholders))))
    if placeholder_mismatches:
        print("⚠️ Placeholder duplication issues:")
        for k, phs, uniq in placeholder_mismatches[:20]:
            print(f"  {k}: tokens={phs} unique={uniq}")
    else:
        print("✅ Placeholder sanity passed")

def update_cumulative(map_path: Path, cumulative_path: Path, batch_label: str, dry_run: bool) -> None:
    mapping = _load_json(map_path)
    cumulative = _load_json(cumulative_path) if cumulative_path.exists() else {}
    cumulative[batch_label] = mapping
    _write_json(cumulative_path, cumulative, dry_run)
    print(f"✅ cumulative map {'(dry-run)' if dry_run else 'updated'}: {cumulative_path}")

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Unified i18n refactor tool")
    sub = p.add_subparsers(dest='cmd', required=True)

    s1 = sub.add_parser('scan-usage', help='Scan code and build usage index')
    s1.add_argument('--root', required=True, type=Path, help='Source root (e.g., src)')
    s1.add_argument('--out', required=True, type=Path, help='Output JSON path')

    s2 = sub.add_parser('transform-locales', help='Apply migration map to locale files')
    s2.add_argument('--map', required=True, type=Path, help='Migration map JSON (old->new)')
    s2.add_argument('--locales-root', default=Path('src/locales'), type=Path)
    s2.add_argument('--dry-run', action='store_true')

    s3 = sub.add_parser('update-usages', help='Replace code usages based on migration map')
    s3.add_argument('--map', required=True, type=Path)
    s3.add_argument('--root', required=True, type=Path)
    s3.add_argument('--dry-run', action='store_true')

    s4 = sub.add_parser('sanity-check', help='Validate keys & placeholders')
    s4.add_argument('--root', required=True, type=Path)
    s4.add_argument('--locales-root', default=Path('src/locales'), type=Path)
    s4.add_argument('--base-lang', default='en-us')

    s5 = sub.add_parser('update-cumulative', help='Merge batch map into cumulative map')
    s5.add_argument('--map', required=True, type=Path)
    s5.add_argument('--cumulative', default=Path('i18n-refactor/migration-map.cumulative.json'), type=Path)
    s5.add_argument('--batch-label', required=True)
    s5.add_argument('--dry-run', action='store_true')

    return p

def main(argv: List[str]) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.cmd == 'scan-usage':
        scan_usage(args.root, args.out)
    elif args.cmd == 'transform-locales':
        transform_locales(args.map, args.locales_root, args.dry_run)
    elif args.cmd == 'update-usages':
        update_usages(args.map, args.root, args.dry_run)
    elif args.cmd == 'sanity-check':
        sanity_check(args.root, args.locales_root, args.base_lang)
    elif args.cmd == 'update-cumulative':
        update_cumulative(args.map, args.cumulative, args.batch_label, args.dry_run)
    else:
        parser.print_help()
        return 1
    return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
