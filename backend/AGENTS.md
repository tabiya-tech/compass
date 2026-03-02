# Compass Backend — AI Agent Instructions

## Entry Point & Server

- **`backend/app/server.py`** — FastAPI application with async lifespan management. Initializes 4 MongoDB connections in parallel, validates environment, sets up CORS and Brotli middleware, and exposes the conversation API.
- Runs on port 8080 via Uvicorn.
- Configuration is loaded from environment variables (see `backend/.env.example`).

## Multi-Agent Architecture

> **Terminology note**: "Agent" in this codebase refers to a **Compass conversation agent** — a backend Python class that handles one phase of the user's skills exploration conversation. These are *not* AI coding agents. Each agent wraps LLM calls with domain-specific prompts, manages conversation state, and produces structured responses. They live in `backend/app/agent/`.

### What is a Compass Agent?

Every agent extends the abstract base class `Agent` (`backend/app/agent/agent.py`) and implements a single method:

```python
async def execute(self, user_input: AgentInput, context: ConversationContext) -> AgentOutput
```

- **`AgentInput`** — The user's message text, a message ID, and a timestamp.
- **`ConversationContext`** — Full conversation history plus a summary of older turns.
- **`AgentOutput`** — The agent's response message, a `finished` flag (signals phase transition), and LLM usage stats.

There are two implementation patterns:
- **`SimpleLLMAgent`** — For stateless agents that make a single LLM call per turn (e.g., `FarewellAgent`, `QnaAgent`). Just provide system instructions.
- **`Agent` (direct)** — For complex agents with internal state, multiple LLM calls, or sub-agent orchestration (e.g., `WelcomeAgent`, `ExploreExperiencesAgentDirector`).

Stateful agents persist their state to MongoDB via a state object (e.g., `WelcomeAgentState`).

### Agent Hierarchy

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

### Conversation Phases & Routing

**Phases**: `INTRO → COUNSELING → CHECKOUT → ENDED`

The **Agent Director** (`agent_director/llm_agent_director.py`) selects the appropriate agent for each user message via an LLM router. The router produces structured output (`RouterModelResponse` with `reasoning` and `agent_type` fields) and falls back to a default agent per phase if the LLM fails.

When an agent returns `finished=True`, the Director transitions to the next phase. It can auto-advance through multiple phases in one turn by sending an artificial `"(silence)"` message to the next agent.

## LLM Strategy

The system uses LLMs for four distinct purposes — understand which one applies before modifying agent code:

1. **Conversational direction** — Generates guided questions to steer users through the skills exploration process. The LLM asks questions, it does *not* answer them.
2. **NLP tasks** — Clustering, entity extraction, and classification without model fine-tuning. Used in the skills identification pipeline.
3. **Explainability** — Chain-of-Thought reasoning traces outputs back to user inputs, making the system's decisions transparent.
4. **Taxonomy filtering** — Hybrid approach combining semantic vector search with LLM-based filtering to match user input against ESCO skills/occupations.

### Model Versions

Configured in `backend/app/agent/config.py`:

| Purpose              | Model                   |
| -------------------- | ----------------------- |
| LLM (default/fast)   | `gemini-2.5-flash-lite` |
| LLM (deep reasoning) | `gemini-2.5-flash`      |
| LLM (ultra reasoning) | `gemini-2.5-pro`       |
| Embeddings           | `text-embedding-005`    |

### Hallucination Prevention

When modifying agent prompts or LLM interactions, preserve these guardrails:

- **Task decomposition** — Each agent has a narrow, specific objective. Don't merge responsibilities.
- **State guardrails** — Favor rule-based logic over LLM decisions for control flow (e.g., phase transitions).
- **Guided outputs** — Use few-shot examples, JSON schemas with Pydantic validation, and semantic ordering to constrain LLM responses.
- **Taxonomy grounding** — All skill/occupation outputs must be linked to taxonomy entries. Never let the LLM invent skills or occupations.

## Skills Identification Pipeline

After gathering user experiences, the system processes data through a multi-stage pipeline in `backend/app/agent/`:

```
User experiences (raw text)
  → ClusterResponsibilitiesTool  — Groups related responsibilities via LLM clustering
  → InferOccupationTool          — Maps clusters to ESCO occupations via vector search + LLM filtering
  → SkillLinkingTool             — Links occupations to specific ESCO skills
  → PickTopSkillsTool            — Ranks and selects the user's top skills
```

The pipeline ensures outputs are **grounded in the taxonomy** — skills are never hallucinated, they are always linked to real ESCO entries via entity linking.

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

## Authentication & Rate Limiting

- JWT-based (Firebase tokens) via `HTTPBearer`
- API key auth for search endpoints (header: `x-api-key`)
- Supported providers: anonymous, password, Google OAuth
- **Rate limit**: 2 requests per minute per API key by default (HTTP 429 when exceeded)

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
