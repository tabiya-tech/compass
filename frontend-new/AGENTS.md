# Compass Frontend — AI Agent Instructions

## Entry Point & Providers

- **`frontend-new/src/index.tsx`** — Initializes Sentry, validates env vars, applies branding, loads i18n, wraps app in providers (Theme, Snackbar, IsOnline, ViewPort).
- **`frontend-new/src/app/index.tsx`** — Hash-based React Router with auth initialization. Lazy-loads main components.

## Routes

| Path              | Component         | Description                  |
| ----------------- | ----------------- | ---------------------------- |
| `/`               | Chat              | Main chat interface          |
| `/landing`        | Landing           | Landing page                 |
| `/login`          | Login             | Authentication               |
| `/register`       | Register          | User registration (optional) |
| `/verify-email`   | VerifyEmail       | Email verification           |
| `/consent`        | Consent           | Terms & conditions           |
| `/sensitive-data` | SensitiveDataForm | PII collection               |

All routes except NotFound are protected via `ProtectedRoute`, which enforces auth flow (T&C acceptance, sensitive data completion).

## Chat Architecture

**`frontend-new/src/chat/Chat.tsx`** (main component, ~1000 lines) manages:

- Session creation and history loading
- Optimistic message insertion + API calls via `ChatService`
- AI typing indicators
- CV upload with polling (60s max)
- User inactivity detection (3-minute timeout)
- Page refresh interception (F5, Ctrl+R)
- Experiences drawer and skills ranking integration
- Conversation phase progress bar

## State Management

No Redux — uses React patterns:

- **Context API**: `ChatContext` for cross-component chat state
- **Service singletons**: `AuthenticationStateService`, `UserPreferencesStateService`, `ChatService`, `ExperienceService`, `CVService`, etc.
- **Persistent storage**: localStorage wrapper for tokens and personal info
- **Cross-tab sync**: `BroadcastChannel` API for auth state

## Authentication

- Firebase Auth with multiple providers (email, Google OAuth, anonymous)
- JWT token validation with clock tolerance
- Auto-refresh on token expiry if provider session is valid
- Cross-tab logout/login via BroadcastChannel

## Internationalization

- i18next with browser language detection
- Locales: `en-GB` (default), `en-US`, `es-ES`, `es-AR`, `fr-FR`, and more
- Translation files in `frontend-new/src/i18n/locales/`
- Configured via `FRONTEND_SUPPORTED_LOCALES` and `FRONTEND_DEFAULT_LOCALE` env vars

## UX & Conversational Design Principles

When working on the chat UI or anything user-facing, follow these design principles established through user testing:

- **Natural dialogue** — The conversation should feel human. Users should be able to respond naturally without rigid formatting.
- **Predictability** — Establish recognizable patterns in question flow so users can anticipate what comes next and batch their responses.
- **Persistence** — Repeat headline questions across experience categories to ensure comprehensive skills capture, especially for informal economy work.
- **Agility** — Handle gracefully when users go off-topic; redirect back without friction. Navigate through input errors without breaking flow.

### Target Device & Audience

- **Mobile-first**: Optimized for mid-range smartphones (Samsung Galaxy A23 as reference device)
- **Target users**: Job-seekers in emerging markets, often with informal economy backgrounds
- **Language**: Moderate English proficiency — keep UI text simple and clear
- **Key metric**: 88.9% of testers found Compass easy to use — maintain this bar

### Conversational Pitfalls to Avoid

- Ambiguous phrasing (e.g., "what was a typical day like" confuses users)
- Assuming formal employment structures for all work types (wage, self-employment, unpaid training, unseen work all need different framing)
- Asking users to repeat information already captured in earlier conversation phases

## Customization System

Compass supports per-deployment customization without code changes. When working on configurable features, be aware of what's customizable:

- **Branding**: App name, logos, icons, favicon, color scheme (must maintain WCAG AA contrast)
- **Authentication**: Login codes and registration codes can be independently enabled/disabled
- **CV features**: Entire CV functionality can be toggled off (removes all related UI)
- **Skills report**: Configurable logo, export format (PDF/DOCX), and section visibility
- **Language**: Default locale and available language options
- **Sensitive data fields**: Which PII fields are collected (name, email, gender, age, education, main activity) — each supports multi-language translations

Settings are applied at deployment via environment configuration. Missing/incorrect settings fall back to defaults rather than erroring.

## Theming

- MUI theme with light/dark modes (`frontend-new/src/theme/`)
- Brand colors from CSS variables (`--brand-primary`, etc.)
- Custom spacing system: `theme.tabiyaSpacing`
- WCAG AA contrast ratio (4.5:1)
- Runtime branding overrides via environment config

## Environment Configuration

- Loaded from `window.tabiyaConfig` (set in `public/data/env.js`)
- All values are **base64-encoded** and decoded at runtime
- Key vars: `FIREBASE_API_KEY`, `BACKEND_URL`, `SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY`, locale config

## Testing

```bash
yarn test                    # Jest + React Testing Library
yarn lint                    # ESLint
yarn compile                 # TypeScript type checking
yarn format:check            # Prettier
yarn test:accessibility      # axe-playwright WCAG testing via Storybook
```

- Tests live alongside source: `*.test.tsx` / `*.test.ts`
- Test utilities in `src/_test_utilities/`
- Storybook for component development: `yarn storybook` (port 6006)

## Adding Frontend Features

1. Create component in appropriate directory under `frontend-new/src/`
2. Add translations to all locale files in `frontend-new/src/i18n/locales/`
3. Use MUI components and the application theme
4. Write tests with React Testing Library
5. Create Storybook stories for visual components
6. Ensure WCAG accessibility (test with `yarn test:accessibility`)
