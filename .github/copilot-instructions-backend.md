# Compass Backend — AI Agent Instructions

## Entry Point & Server

- **`backend/app/server.py`** — FastAPI application with async lifespan management. Initializes 4 MongoDB connections in parallel, validates environment, sets up CORS and Brotli middleware, and exposes the conversation API.
- Runs on port 8080 via Uvicorn.
- Configuration is loaded from environment variables (see `backend/.env.example`).

## Multi-Agent Architecture

The core of the backend is a **multi-agent LLM orchestration system** in `backend/app/agent/`:

```
Agent Director (LLM-based router)
├── WelcomeAgent           — Greets user, explains process, handles country selection
├── ExploreExperiencesAgentDirector (sub-director)
│   ├── CollectExperiencesAgent  — Gathers work experience details
│   ├── SkillsExplorerAgent      — Explores and validates identified skills
│   └── Experience Pipeline      — LLM-driven skill linking & ranking
│       ├── ClusterResponsibilitiesTool
│       ├── InferOccupationTool
│       ├── SkillLinkingTool
│       └── PickTopSkillsTool
└── FarewellAgent          — Concludes conversation, returns summary
```

**Conversation Phases**: `INTRO → COUNSELING → CHECKOUT → ENDED`

The **Agent Director** (`agent_director/llm_agent_director.py`) uses an LLM router to select the appropriate agent for each user message. The router produces structured output (`RouterModelResponse` with `reasoning` and `agent_type` fields) and has fallback agents per phase.

## Conversation API

- **`backend/app/conversations/routes.py`** — Two endpoints:
  - `POST /conversations/{session_id}/messages` — Send user message, get agent response
  - `GET /conversations/{session_id}/messages` — Retrieve conversation history
- Max message length: 1000 characters
- Session ownership is verified per request

## Database Architecture

Four separate MongoDB instances (connected via Motor async driver):

| Database    | Purpose                                          |
| ----------- | ------------------------------------------------ |
| Taxonomy    | ESCO occupations, skills, embeddings for search  |
| Application | Conversation state, session data, user reactions |
| Userdata    | Encrypted PII, CV uploads                        |
| Metrics     | Application state snapshots, analytics           |

Connection management uses a singleton provider pattern (`CompassDBProvider`) with async locks.

## Vector Search & Embeddings

- **`backend/app/vector_search/`** — Template method pattern for occupation and skill search
- Embeds user input via Vertex AI (`textembedding-gecko` models)
- Searches MongoDB Atlas vector indexes
- Async LRU cache for occupation-skill associations (up to ~223MB)

## LLM Integration

- **`backend/common_libs/llm/`** — Gemini generative model wrapper
- Structured output: LLM responses are parsed into Pydantic models
- Retry logic: 3 attempts with increasing temperature (0.1 → 1.0) and top-P variation
- JSON extraction from LLM text with validation
- Token usage tracking via `LLMStats`

## Authentication

- JWT-based (Firebase tokens) via `HTTPBearer`
- API key auth for search endpoints
- Supported providers: anonymous, password, Google OAuth

## Key Patterns

- **Dependency injection** via FastAPI's `Depends()`
- **Async-first**: all I/O is async (Motor, LLM calls, HTTP)
- **Repository pattern** for data access
- **Pydantic v2** for all data models and validation
- **Feature flags** via `BACKEND_FEATURES` environment variable (JSON)

## Testing

```bash
poetry run pytest -m "not (evaluation_test or smoke_test)"  # Unit/integration tests
poetry run pylint --recursive=y .                            # Linting
poetry run bandit -c bandit.yaml -r .                        # Security scanning
```

- Tests live alongside source: `*_test.py`
- In-memory MongoDB via `pymongo_inmemory`
- Async test support via `pytest-asyncio`

## Adding a New Agent

1. Create agent class in `backend/app/agent/` implementing the agent interface
2. Register it in the Agent Director's phase configuration
3. Define LLM prompt and response schema (Pydantic model)
4. Add routing rules in `_llm_router.py`
5. Write tests with mocked LLM responses

## Adding a New API Endpoint

1. Create route in appropriate module under `backend/app/`
2. Use FastAPI `Depends()` for auth and service injection
3. Define Pydantic request/response models
4. Add tests using in-memory MongoDB fixtures
