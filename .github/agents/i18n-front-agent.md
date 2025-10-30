---
name: i18-front-agent
description: Internationalizing frontend module/component
---

# My Agent

## Internationalization refactor prompt (React + i18next)

Task
- Internationalize the {name_of_component} component, moving all user-facing strings into locale files, preserving behavior.

Scope
- Include JSX text, aria/title/alt, toasts/errors, constants, and helpers used by the component.
- For non-React files (utils/constants), use your app’s initialized i18n instance (not the i18next library singleton).

Steps
1) Inventory
- Collect all user-visible text (including aria-label/title/alt).
- Note dynamic parts (variables, counts) and any inline links/markup that need <Trans>.

2) Classify
- Plain text → t("key").
- Text with markup/links → <Trans i18nKey="key" components={[<YourLink/>]} />.
- Interpolations → t("key", { count, var }).

3) Key naming
- Prefix: <feature>_<context>_<description>.
- Split long blocks into numbered parts (_part1, _part2).
- Only break out “highlight” keys if they need distinct styling.

4) Locales
- Add identical keys to all locales (en, en-us, es, es-ar, fr-fr).
- For <Trans>, use numbered placeholders: "Read the <0>policy</0>."
- Mirror interpolation names across locales.

5) Refactor code
- React components: useTranslation()/Trans from react-i18next; replace literals in JSX and attributes.
- Non-React modules (constants/helpers): import the app’s initialized i18n instance (e.g., src/i18n/i18n), not the i18next singleton.
- Do NOT resolve translations at module load time. Call i18n.t()/t() inside functions/hooks so language changes reflect correctly.
- For code→message maps (e.g., error codes), map to translation keys, then translate at call site with i18n.t(key).

6) Hooks dependencies
- If t is used in useCallback/useMemo/effects, include t in the dependency array to satisfy exhaustive-deps.

7) Tests
- Update expectations to match translated output (English default still OK).
- If tests previously asserted constants of pre-translated strings, switch to building expectations via i18n.t("key") or mock-resolved values.
- Ensure global Jest setup stubs:
  - react-i18next: useTranslation returns a stable t; Trans renders children as-is.
  - the initialized i18n instance module: provide a deterministic t (e.g., returns English).
  - Avoid real i18n initialization in tests.

8) Lint/build checks
- Run lint; fix missing-deps/unusued imports.
- Quick grep to ensure no hard-coded phrases remain and no imports from 'i18next' in app code:
  - " import i18next " or " import { t } from 'i18next' "
  - legacy phrases you replaced.

9) Manual QA
- Verify in at least two locales.
- Check <Trans> links are clickable and interpolations render correctly.

10) Deliverables
- PR including: extracted strings, locale updates, refactored files, green tests/snapshots, lint passing, no behavior change.
- Commit: chore(i18n): extract <ComponentOrModule> strings to locale files

Acceptance criteria
- No hard-coded user-facing strings in target area.
- No imports from 'i18next' singleton in application code (except in the i18n init module).
- No translations resolved at module load time; translations resolved at render/call time.
- All locales contain keys with matching placeholders/interpolation names.
- No exhaustive-deps warnings related to t.
- All tests updated and passing; snapshots match.

Tips/pitfalls
- Prefer i18n.t in non-React files; use t from useTranslation in React components.
- For error/code maps, store keys, not messages; translate when needed.
- Keep placeholders consistent across locales; avoid accidental extra spaces/punctuation that break assertions.
- If Storybook is used, ensure preview wraps with I18nextProvider or a decorator that provides a working t/Trans.

think step by step

