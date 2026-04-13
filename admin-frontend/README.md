# Compass Admin Frontend

The Compass Admin Portal is a web application for managing and configuring the Compass platform. It provides administrators with tools to manage users, view analytics, and configure system settings.

## Prerequisites

To develop the admin frontend locally, you must install the following:

* [Node.js ^20.0](https://nodejs.org/)
* [Yarn ^1.22](https://classic.yarnpkg.com/en/)
* A recent version of [git](https://git-scm.com/) (e.g. ^2.37)

## Technologies

- [React 18](https://react.dev/) - UI library
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [MUI v7](https://mui.com/) - Material UI component library
- [React Router v6](https://reactrouter.com/) - Client-side routing
- [i18next](https://www.i18next.com/) - Internationalization
- [Storybook](https://storybook.js.org/) - Component documentation and testing
- [Jest](https://jestjs.io/) - Testing framework
- [Sentry](https://sentry.io/) - Error tracking and monitoring

## Project Structure

```
admin-frontend/
├── public/
│   ├── data/
│   │   ├── env.js              # Environment configuration (create from env.example.js)
│   │   ├── env.example.js      # Example environment configuration
│   │   └── version.json        # Build version metadata
│   ├── styles/
│   │   └── sentry.css          # Sentry feedback widget styles
│   ├── index.html              # HTML template
│   └── manifest.json           # PWA manifest
├── src/
│   ├── app/
│   │   └── routerPaths.ts      # Route path constants
│   ├── branding/
│   │   ├── branding.ts         # Dynamic branding configuration
│   │   └── seoConfig.ts        # SEO configuration
│   ├── i18n/
│   │   ├── locales/            # Translation files (en-US, en-GB, es-ES, etc.)
│   │   ├── i18n.ts             # i18n initialization
│   │   └── languageContextMenu/ # Language switcher component
│   ├── pages/
│   │   ├── Dashboard/          # Dashboard page
│   │   ├── Login/              # Login page
│   │   ├── Users/              # User management page
│   │   ├── Settings/           # Settings page
│   │   └── NotFound/           # 404 page
│   ├── theme/
│   │   ├── applicationTheme/   # MUI theme configuration
│   │   ├── SnackbarProvider/   # Toast notifications
│   │   └── ...                 # Other theme components
│   ├── App.tsx                 # Main app component with router
│   ├── index.tsx               # Application entry point
│   ├── envService.ts           # Environment variable service
│   └── sentryInit.ts           # Sentry initialization
├── .storybook/                 # Storybook configuration
├── package.json
└── tsconfig.json
```

## Installation

1. Ensure you have the [prerequisites](#prerequisites) installed.

2. Clone the repository and navigate to the admin-frontend directory:
   ```shell
   cd ./admin-frontend
   ```

3. Install dependencies:
   ```shell
   yarn install
   ```

4. Set up environment variables:
   - Copy `public/data/env.example.js` to `public/data/env.js`
   - Update the values as needed (see [Environment Variables](#environment-variables))

## Environment Variables

Create a `env.js` file in `public/data/` based on `env.example.js`. All values should be base64 encoded using `btoa()`.

| Variable | Required | Description |
|----------|----------|-------------|
| `FIREBASE_API_KEY` | Yes | Firebase API key for authentication |
| `FIREBASE_AUTH_DOMAIN` | Yes | Firebase authentication domain |
| `BACKEND_URL` | Yes | Backend API URL |
| `TARGET_ENVIRONMENT_NAME` | Yes | Environment name (e.g., "dev", "prod") |
| `FRONTEND_ENABLE_SENTRY` | No | Enable Sentry error tracking (`"true"` / `"false"`) |
| `FRONTEND_SENTRY_DSN` | No | Sentry Data Source Name |
| `FRONTEND_SENTRY_CONFIG` | No | Sentry configuration JSON |
| `FRONTEND_SUPPORTED_LOCALES` | Yes | JSON array of locale codes (e.g., `["en-US", "es-ES"]`) |
| `FRONTEND_DEFAULT_LOCALE` | Yes | Default locale code |
| `GLOBAL_PRODUCT_NAME` | No | Product name for branding |
| `FRONTEND_BROWSER_TAB_TITLE` | No | Browser tab title |
| `FRONTEND_LOGO_URL` | No | Logo URL |
| `FRONTEND_FAVICON_URL` | No | Favicon URL |
| `FRONTEND_THEME_CSS_VARIABLES` | No | Theme color overrides JSON |
| `LEGAL_SITE_BASE_URL` | No | Public origin of the learner (frontend-new) app, no trailing slash. Footer privacy/terms links open `LEGAL_SITE_BASE_URL/#/privacy-policy` and `.../#/terms-of-use`. When unset, links fall back to `window.location.origin` (set explicitly if admin and learner are on different hosts). |

Example encoding:
```javascript
// In env.js
BACKEND_URL: btoa("https://api.example.com"),
FRONTEND_SUPPORTED_LOCALES: btoa(JSON.stringify(["en-US", "es-ES"])),
```

## Available Scripts

### Development

```shell
# Start development server (http://localhost:3000)
yarn start

# Start Storybook (http://localhost:6006)
yarn storybook
```

### Code Quality

```shell
# Check code formatting
yarn format:check

# Fix code formatting
yarn format

# Run ESLint
yarn lint

# Type check (no emit)
yarn compile
```

### Testing

```shell
# Run all tests with coverage
yarn test

# Run Storybook accessibility tests
yarn build-storybook && yarn test-storybook
```

### Building

```shell
# Build for production
yarn build

# Serve production build locally
yarn serve

# Analyze bundle size
yarn analyze
```

## Routes

| Path | Page | Description |
|------|------|-------------|
| `/` | Dashboard | Overview with stats and activity |
| `/login` | Login | Admin authentication |
| `*` | NotFound | 404 error page |

## Theming

The application supports dynamic theming through CSS variables. Colors can be customized via the `FRONTEND_THEME_CSS_VARIABLES` environment variable:

```javascript
FRONTEND_THEME_CSS_VARIABLES: btoa(JSON.stringify({
  "brand-primary": "0 255 145",        // RGB values
  "brand-primary-light": "51 255 167",
  "brand-primary-dark": "0 178 101",
  "brand-secondary": "30 113 102",
  "text-primary": "0 33 71",
  "text-secondary": "65 64 61",
}))
```

## Internationalization (i18n)

The application supports multiple locales. Translation files are located in `src/i18n/locales/`.

Supported locales:
- `en-US` - English (US)
- `en-GB` - English (UK)
- `es-ES` - Spanish (Spain)
- `es-AR` - Spanish (Argentina)
- `sw-KE` - Swahili (Kenya)
- `ny-ZM` - Chichewa (Zambia)

To add translations, update the `translation.json` file in each locale directory.

## Component Development

We use Storybook for component development and documentation:

```shell
yarn storybook
```

### Component Guidelines

- Use functional components with `React.FC<Props>`
- Define `DATA_TEST_ID` objects for test selectors
- Use MUI components with theme values (`theme.palette`, `theme.tabiyaSpacing`, etc.)
- Support i18n with `useTranslation()` hook
- Include JSDoc comments for documentation

Example:
```tsx
const uniqueId = "my-component-uuid";
export const DATA_TEST_ID = {
  CONTAINER: `${uniqueId}-container`,
  BUTTON: `${uniqueId}-button`,
};

export interface MyComponentProps {
  title: string;
}

const MyComponent: React.FC<MyComponentProps> = ({ title }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  
  return (
    <Box data-testid={DATA_TEST_ID.CONTAINER}>
      {t("myComponent.title", title)}
    </Box>
  );
};
```

## Testing Guidelines

Tests follow BDD (Behavior-Driven Development) with Gherkin-style comments:

```typescript
test("should display user name after login", async () => {
  // GIVEN a logged in user
  const givenUser = { name: "John Doe" };
  
  // WHEN the dashboard loads
  render(<Dashboard user={givenUser} />);
  
  // THEN the user name should be visible
  expect(screen.getByText(givenUser.name)).toBeInTheDocument();
});
```

## CI/CD

The GitHub Actions workflow (`.github/workflows/admin-frontend-ci.yml`) runs:

1. **Format Check** - Prettier formatting validation
2. **Lint** - ESLint with zero warnings policy
3. **Compile** - TypeScript type checking
4. **Test** - Jest tests with coverage

## Pre-merge Checklist

Before merging, ensure all checks pass:

```shell
yarn format:check && yarn lint && yarn compile && yarn test
```

## Contributing

1. Follow the [component guidelines](#component-guidelines)
2. Write tests for new features
3. Update translations in all locale files
4. Run the [pre-merge checklist](#pre-merge-checklist) before submitting PR

## Related Documentation

- [Main Project README](../README.md)
- [Frontend Documentation](../frontend-new/README.md)
- [Backend Documentation](../backend/README.md)
