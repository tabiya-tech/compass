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
