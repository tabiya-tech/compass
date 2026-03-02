# Compass Project — AI Agent Instructions

## Project Overview

Compass is an AI-powered chatbot that helps job-seekers discover and articulate their skills using the ESCO (European Skills, Competences, Qualifications and Occupations) taxonomy. Users describe their work experiences in a conversational interface, and the system maps those experiences to standardized occupations and skills.

> **Terminology note**: "Agent" in this codebase refers to a **Compass conversation agent** — a backend Python class that handles one phase of the user's chat conversation (e.g., welcome, experience collection, skills exploration, farewell). These are *not* AI coding agents. See the [backend instructions](copilot-instructions-backend.md) for the full agent architecture.

## Repository Structure

This is a monorepo with three main packages:

```
compass/
├── backend/          # Python/FastAPI REST API + multi-agent LLM system
├── frontend-new/     # React/TypeScript SPA (chat UI)
├── iac/              # Pulumi infrastructure-as-code (GCP)
└── .github/workflows # CI/CD pipelines
```

Path-specific instructions are automatically applied by Copilot when working in the relevant directories:
- [Backend instructions](backend/AGENTS.md) — applies to `backend/**`
- [Frontend instructions](frontend-new/AGENTS.md) — applies to `frontend-new/**`

## Domain Context

### What is ESCO?

ESCO (European Skills, Competences, Qualifications and Occupations) is a taxonomy developed by the European Commission that standardizes how occupations and skills are classified. It was chosen over alternatives like O*NET and ISCO because it offers:

- **Global breadth** with local adaptability (multi-language, region-specific skills)
- **Simpler skill descriptions** and "alternative labels" for occupations (e.g., "data engineer" as an alternative for "data scientist")
- **Soft skills coverage** ("attitudes and values") absent from other frameworks
- **Green and digital economy** skill frameworks built in
- **Frequent updates** and growing adoption, especially in Latin America

### Inclusive Livelihoods Taxonomy

Compass uses Tabiya's **Inclusive Livelihoods Taxonomy**, which extends ESCO to cover the full spectrum of economic activities — including informal and unpaid work that traditional frameworks exclude. It classifies work into **four categories**:

1. **Wage employment** — traditional salaried/hourly work
2. **Self-employment** — independent/freelance work
3. **Unpaid training** — internships, apprenticeships, volunteering
4. **Unseen/unpaid work** — caregiving, household management, community work

This equity focus is core to the product — Compass must recognize and validate skills from *all* types of work, not just formal employment.

### Target Users

- **Primary audience**: Job-seekers in emerging markets, particularly those with informal economy experience
- **Device context**: Mobile-first, optimized for mid-range smartphones (Samsung Galaxy A23 as reference device)
- **Language**: Moderate English proficiency expected; multi-language support is expanding
- **Accessibility**: 88.9% of testers found Compass easy to use — maintain this standard

### Product Mission

Compass helps users discover skills they already have but may not know how to articulate. It does *not* answer career questions directly — instead, it **guides users through structured conversation** to extract, classify, and present their skills in a standardized format useful for CVs, job matching, and career development.

---

## Tech Stack

| Layer          | Technology                                                       |
| -------------- | ---------------------------------------------------------------- |
| Backend        | Python 3.11+, FastAPI, Uvicorn, Poetry                          |
| LLM            | Google Vertex AI (Gemini), structured output with Pydantic       |
| Database       | MongoDB (4 instances via Motor async driver)                     |
| Vector Search  | MongoDB Atlas Search with Vertex AI embeddings                   |
| Frontend       | React 18, TypeScript 5.4+, MUI 7, Webpack 5                     |
| Auth           | Firebase Authentication (email, Google OAuth, anonymous)         |
| i18n           | i18next (backend + frontend), locales: en-GB, en-US, es-ES, etc |
| Infra          | GCP (Cloud Run, Cloud Storage, API Gateway), Pulumi, Docker      |
| CI/CD          | GitHub Actions                                                   |
| Error Tracking | Sentry (both backend and frontend)                               |
| Testing        | pytest + in-memory MongoDB (backend), Jest + RTL (frontend)      |

---

## Infrastructure (`iac/`)

### Pulumi Stacks

```
iac/
├── realm/        # GCP org root, projects, user groups
├── environment/  # Per-env GCP project creation, API enablement
├── auth/         # Identity Platform, Firebase, OAuth providers
├── backend/      # Cloud Run service + API Gateway
├── frontend/     # Cloud Storage bucket for static assets
├── common/       # Load balancer, SSL certificates, DNS records
├── dns/          # DNS zone management
├── aws-ns/       # AWS Route 53 name server delegation
├── lib/          # Shared utilities and types
└── scripts/      # Deployment orchestration (prepare.py, up.py)
```

### Deployment

- **Backend**: Docker image → GCP Artifact Registry → Cloud Run (port 8080, linux/amd64)
- **Frontend**: Build artifact (tar.gz) → GCP Artifact Registry → Cloud Storage bucket
- **DNS**: GCP Cloud DNS + AWS Route 53 for delegation

### Environment Hierarchy

- **Realm**: Top-level container (`compass-realm`) with org access
- **Environment naming**: `{realm}.{env}` (e.g., `compass.dev`, `compass.prod`)
- **Types**: `dev`, `test`, `prod` — separate GCP service accounts for lower vs production envs

---

## CI/CD (`.github/workflows/`)

### Pipeline Flow

1. **Every push**: Frontend CI (format, lint, compile, test, a11y) + Backend CI (bandit, pylint, pytest) run in parallel
2. **Main branch** with `[pulumi up]` in commit message: Build artifacts + deploy to dev
3. **Release creation**: Build artifacts + deploy to test, then production

### Key Workflows

| File              | Purpose                                |
| ----------------- | -------------------------------------- |
| `main.yml`        | Orchestrates all CI/CD jobs            |
| `frontend-ci.yml` | Frontend checks, build, artifact upload |
| `backend-ci.yml`  | Backend checks, Docker build & push    |
| `config-ci.yml`   | Template/config uploads                |
| `deploy.yml`      | Pulumi deployment to target env        |

---

## Development Guidelines

### File Organization

- Tests alongside source files (`*_test.py`, `*.test.tsx`)
- No separate `tests/` directories
- Feature modules are self-contained with routes, services, models, and tests

### Code Style

- **Backend**: Python type hints, Pydantic models, async/await, pylint + bandit
- **Frontend**: TypeScript strict mode, ESLint + Prettier, MUI styled components

### Environment Variables

- Backend: see `backend/.env.example`
- Frontend: see env vars loaded in `frontend-new/src/envService.ts`
- Infrastructure: see `iac/templates/env.template` for full reference
