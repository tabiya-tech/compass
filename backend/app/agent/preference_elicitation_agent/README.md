# Preference Elicitation Agent

**Epic 2 - Deliverable D1, D2, D3**

This package contains the implementation of the Preference Elicitation Agent for the Compass career guidance system.

## Overview

The Preference Elicitation Agent conducts a conversational preference elicitation process to understand user job/career preferences through:

1. **Experience-based questions** - Asking about past work experiences
2. **Vignette scenarios** - Presenting realistic job choice scenarios
3. **Follow-up probes** - Clarifying responses and exploring trade-offs
4. **Preference vector building** - Converting responses into structured preference data

## Architecture

### Core Components

```
preference_elicitation_agent/
├── agent.py                          # Main agent class
├── state.py                          # Agent state management
├── types.py                          # Data models (PreferenceVector, Vignette, etc.)
├── vignette_engine.py                # Vignette loading and selection logic (static + dynamic)
├── vignette_personalizer.py          # LLM-based vignette personalization
├── user_context_extractor.py         # Extract user context from experiences
├── preference_extractor.py           # LLM-based preference extraction
├── test_preference_elicitation_agent.py  # Unit tests
└── __init__.py                       # Package exports
```

### Data Models (types.py)

#### PreferenceVector
Complete preference profile with dimensions:
- **FinancialPreferences**: Salary, benefits, trade-offs
- **WorkEnvironmentPreferences**: Remote work, commute, autonomy
- **JobSecurityPreferences**: Stability, risk tolerance
- **CareerAdvancementPreferences**: Learning, growth opportunities
- **WorkLifeBalancePreferences**: Hours, family time
- **TaskPreferences**: Task type preferences (cognitive, manual, social)
- **SocialImpactPreferences**: Purpose, helping others

#### Vignette
Scenario-based preference elicitation tool:
- `vignette_id`: Unique identifier
- `category`: Preference dimension tested
- `scenario_text`: Introduction/setup
- `options`: List of VignetteOption choices
- `follow_up_questions`: Optional probes
- `targeted_dimensions`: Specific preferences targeted
- `difficulty_level`: Easy/medium/hard trade-off

#### VignetteResponse
User's response to a vignette:
- `chosen_option_id`: Which option they selected
- `user_reasoning`: Their explanation
- `extracted_preferences`: Inferred preference signals
- `confidence`: Extraction confidence score

### Agent State (state.py)

**PreferenceElicitationAgentState** tracks:
- Conversation phase (INTRO → EXPERIENCE_QUESTIONS → VIGNETTES → FOLLOW_UP → WRAPUP → COMPLETE)
- Completed vignettes and responses
- Current vignette being presented
- Evolving preference vector
- Categories explored/remaining
- Session metadata

### Vignette Engine (vignette_engine.py)

**VignetteEngine** supports two vignette systems:

#### Static Vignette System (Backward Compatible)
- Loads pre-written vignettes from `vignettes.json`
- Predictable, testable scenarios
- No LLM generation costs
- Works offline

#### Dynamic Vignette Personalization
- Uses LLM to generate personalized scenarios from templates (`vignette_templates.json`)
- **UserContextExtractor** analyzes `initial_experiences_snapshot` to extract:
  - Current/recent role
  - Industry
  - Experience level
- **VignettePersonalizer** generates scenarios matching user background
- Prevents UX gap: software dev gets tech scenarios, not banking questions
- Maintains template trade-offs while personalizing job titles, companies, salaries

**Selection Strategy:**
1. Get next unexplored category from `state.categories_to_explore`
2. For static: filter by difficulty (easy → medium → hard)
3. For dynamic: select template, generate personalized scenario using user context
4. Avoid recently shown vignettes/templates
5. Mark category covered when confidence > 0.6

**Easy Rollback:**
```python
agent = PreferenceElicitationAgent(
    use_personalized_vignettes=False  # Switch to static system
)
# Or via environment variable: USE_PERSONALIZED_VIGNETTES=false
```

### Preference Extractor (preference_extractor.py)

**PreferenceExtractor** uses LLM to:
1. Identify chosen option
2. Extract stated reasons
3. Infer underlying preferences
4. Map to preference dimensions
5. Update preference vector with weighted merge

**Extraction Process:**
```
User Response → LLM Analysis → PreferenceExtractionResult → Update PreferenceVector
```

### Main Agent (agent.py)

**PreferenceElicitationAgent** implements:
- Multi-phase conversation flow
- Dual-LLM pattern (conversation + extraction)
- Natural vignette presentation
- Preference vector building
- Graceful error handling

**Conversation Flow:**
```
INTRO (explain process)
  ↓
EXPERIENCE_QUESTIONS (gather initial signals)
  ↓
VIGNETTES (present scenarios, extract preferences)
  ↓ (optional)
FOLLOW_UP (clarify responses)
  ↓
WRAPUP (summarize preferences)
  ↓
COMPLETE
```

## Configuration

### Vignettes Configuration

Vignettes are stored in `/compass/backend/app/config/vignettes.json`:

```json
[
  {
    "vignette_id": "financial_001",
    "category": "financial",
    "scenario_text": "Let me paint a picture...",
    "options": [
      {
        "option_id": "A",
        "title": "Job Title",
        "description": "Detailed description...",
        "attributes": {
          "salary": 60000,
          "contract_type": "permanent",
          ...
        }
      },
      ...
    ],
    "follow_up_questions": ["What was most important?"],
    "targeted_dimensions": ["financial.importance", ...],
    "difficulty_level": "medium"
  }
]
```

### Vignette Templates Configuration

Vignette templates are stored in `/compass/backend/app/config/vignette_templates.json`:

```json
[
  {
    "template_id": "financial_vs_security",
    "category": "financial",
    "trade_off": {
      "dimension_a": "high_salary",
      "dimension_b": "job_security"
    },
    "option_a": {
      "high_dimensions": ["salary", "variable_income"],
      "low_dimensions": ["job_security", "benefits"],
      "salary_range": [80000, 120000]
    },
    "option_b": {
      "high_dimensions": ["job_security", "benefits", "stable_income"],
      "low_dimensions": ["salary"],
      "salary_range": [50000, 70000]
    },
    "targeted_dimensions": ["financial.importance", "job_security.importance"],
    "difficulty_level": "medium"
  }
]
```

**Current Templates:** 12+ templates covering all 6 preference categories

**Static Vignettes:** 18+ pre-written vignettes in `vignettes.json` for backward compatibility

## Integration

### ApplicationState

PreferenceElicitationAgentState is integrated into ApplicationState:

```python
class ApplicationState(BaseModel):
    ...
    preference_elicitation_agent_state: PreferenceElicitationAgentState
```

### AgentType Enum

Added to agent types:

```python
class AgentType(Enum):
    ...
    PREFERENCE_ELICITATION_AGENT = "PreferenceElicitationAgent"
```

## Usage

### Creating the Agent

```python
from app.agent.preference_elicitation_agent import PreferenceElicitationAgent

# With personalized vignettes (default)
agent = PreferenceElicitationAgent(use_personalized_vignettes=True)

# With static vignettes (backward compatible)
agent = PreferenceElicitationAgent(
    use_personalized_vignettes=False,
    vignettes_config_path="/path/to/vignettes.json"
)

# With DB6 integration (when Epic 1 ready)
from app.epic1.db6_youth_database import DB6ClientImpl
db6 = DB6ClientImpl()
agent = PreferenceElicitationAgent(
    db6_client=db6,
    use_personalized_vignettes=True
)
```

### Setting State

```python
from app.agent.preference_elicitation_agent import PreferenceElicitationAgentState

state = PreferenceElicitationAgentState(session_id=123)
agent.set_state(state)
```

### Executing Conversation

```python
from app.agent.agent_types import AgentInput
from app.conversation_memory.conversation_memory_manager import ConversationContext

user_input = AgentInput(message="I prefer remote work")
context = ConversationContext(...)

output = await agent.execute(user_input, context)
print(output.message_for_user)
```

## Testing

Run tests:

```bash
cd compass/backend
poetry run pytest app/agent/preference_elicitation_agent/test_preference_elicitation_agent.py -v
```

## DB6 Integration (Epic 1 Dependency)

The agent integrates with Epic 1's DB6 Youth Database using a **hybrid approach** that works both with and without Epic 1.

### Interface Contract

**Epic 1 provides** (`app/epic1/db6_youth_database/`):
- `DB6Client` - Abstract interface for database operations
- `YouthProfile` - Data model with experiences, skills, preferences, qualifications
- Implementation TBD by Epic 1 contractor

**Epic 2 provides** (this agent):
- `StubDB6Client` - In-memory implementation for development
- Integration logic with graceful fallback

### How It Works

#### 1. Reading Experiences (Experience-Based Questions Phase)

```python
experiences = await agent._get_experiences_for_questions()
# Priority:
# 1. Try DB6 if enabled and available (fresh data)
# 2. Fall back to snapshot (immutable copy)
# 3. Return None (no data - use generic questions)
```

#### 2. Writing Preferences (Wrapup Phase)

```python
await agent._save_preference_vector_to_db6()
# Saves completed preference vector to youth profile
# Adds interaction history entry
# Gracefully skips if DB6 unavailable
```

### State Fields

```python
class PreferenceElicitationAgentState(BaseModel):
    initial_experiences_snapshot: Optional[list[ExperienceEntity]] = None
    """Immutable snapshot from CV upload, prior session, or DB6"""

    use_db6_for_fresh_data: bool = False
    """Enable DB6 queries (default: False for Epic 2 development)"""
```

### Usage Scenarios

**Without Epic 1** (Development):
```python
agent = PreferenceElicitationAgent()  # No DB6 client
state = PreferenceElicitationAgentState(
    session_id=123,
    initial_experiences_snapshot=cv_experiences,
    use_db6_for_fresh_data=False  # Works without Epic 1
)
```

**With Epic 1** (Production):
```python
from app.epic1.db6_youth_database import DB6ClientImpl

db6 = DB6ClientImpl()
agent = PreferenceElicitationAgent(db6_client=db6)
state = PreferenceElicitationAgentState(
    session_id=123,
    use_db6_for_fresh_data=True  # Enable fresh data & save
)
```

**Full Compass Flow**:
```python
# Copy from prior agent for consistency
explored = app_state.explore_experiences_director_state.explored_experiences
state = PreferenceElicitationAgentState(
    session_id=123,
    initial_experiences_snapshot=explored,
    use_db6_for_fresh_data=False  # Use snapshot
)
```

### Benefits

- ✅ Works now without Epic 1 dependency
- ✅ Smooth migration when DB6 ready (just flip flag)
- ✅ Graceful degradation if DB6 fails
- ✅ Clear interface contract for coordination

## Integration Status

### Completed ✅
1. ✅ **Agent type registration** - Added to AgentType enum
2. ✅ **Application state integration** - PreferenceElicitationAgentState in ApplicationState
3. ✅ **State persistence** - DatabaseApplicationStateStore save/load implemented
4. ✅ **DB6 integration stubs** - Graceful Epic 1 dependency handling
5. ✅ **Configuration files** - vignettes.json and vignette_templates.json

### Pending ⏳
1. ⏳ **Register with AgentDirector** - Add to LLMAgentDirector initialization
2. ⏳ **Add routing logic** - Update _LLMRouter to route to this agent
3. ⏳ **End-to-end testing** - Full conversation flow testing
4. ⏳ **Epic 1 coordination** - Replace DB6 stubs when ready

### Enhancement Opportunities
1. **Smarter vignette selection** - Use preference vector to guide selection
2. **Follow-up logic** - Implement adaptive follow-up questions
3. **Experience extraction** - Better extraction from experience questions
4. **Confidence tracking** - More sophisticated confidence scoring
5. **More vignettes** - Expand to 10-15 vignettes across all categories

### Epic 1 Dependencies
- **DB5 (Preference Elements)** - Canonical preference dimensions (optional)
- **DB6 (Youth Database)** - Store preference vectors (✅ interface ready)

## Deliverables Status

- ✅ **D1**: Conversational flow for preference elicitation (vignettes + experience questions)
- ✅ **D2**: Preference vector computation module (converts conversation → structured data)
- ✅ **D3**: Configurable vignettes system (JSON-based)
- ⏳ **D4**: Evaluation test suite (basic tests created, needs expansion)

## File Summary

| File | Lines | Purpose |
|------|-------|---------|
| types.py | ~800 | Data models for preferences, vignettes, templates |
| state.py | ~200 | Agent state management with DB6 hybrid approach |
| vignette_engine.py | ~430 | Vignette loading, selection (static + dynamic) |
| vignette_personalizer.py | ~380 | LLM-based vignette personalization |
| user_context_extractor.py | ~120 | Extract user context from experiences |
| preference_extractor.py | ~420 | LLM-based preference extraction |
| agent.py | ~810 | Main agent orchestration with DB6 integration |
| test_preference_elicitation_agent.py | ~230 | Unit tests |
| vignettes.json | ~400 | Static vignette configuration (18 vignettes) |
| vignette_templates.json | ~250 | Dynamic vignette templates (12 templates) |

**Total: ~4,040 lines of code**

## Architecture Decisions

### 1. Experience Snapshot Integration

**Decision:** Leverage existing experiences collection for personalized context

**Implementation:**
```python
class PreferenceElicitationAgentState:
    initial_experiences_snapshot: Optional[list[ExperienceEntity]] = None
    """
    Immutable snapshot of experiences at agent start.
    Sources: CV upload, prior Compass session, or DB6
    """
```

**Rationale:**
- **Consistency:** Data doesn't change during conversation even if user edits in UI
- **Personalization:** Ask about THEIR work ("You worked as X, what did you enjoy?") vs. generic questions
- **UX:** More engaging conversation
- **Privacy:** No new data collection, uses existing flows

**Data Flow:**
1. Agent Director initializes PreferenceElicitationAgent
2. At start, snapshot taken from CV/explored_experiences/DB6
3. Used for: experience questions + user context extraction + vignette personalization
4. Remains immutable throughout conversation

### 2. Dual Vignette Systems (Static + Dynamic)

**Decision:** Implement both static and dynamic vignette approaches with easy rollback

**Problem:** Static vignettes ("Compare bank teller vs. retail cashier") may not match user background (e.g., software developer), creating UX gap and unreliable preference data.

**Solution:**

#### Static System (Backward Compatible)
- File: `vignettes.json`
- Pre-written scenarios, predictable, testable
- No LLM costs
- Flag: `use_personalized_vignettes=False`

#### Dynamic System (Personalized)
- File: `vignette_templates.json`
- Templates define trade-offs (not specific jobs)
- LLM generates scenarios matching user background
- Prevents UX gap: software dev gets tech scenarios, teacher gets education scenarios
- Flag: `use_personalized_vignettes=True` (default)

**Rollback Mechanism:**
```python
# Environment variable or agent initialization
USE_PERSONALIZED_VIGNETTES = os.getenv("USE_PERSONALIZED_VIGNETTES", "true")
agent = PreferenceElicitationAgent(use_personalized_vignettes=USE_PERSONALIZED_VIGNETTES == "true")
```

**Personalization Algorithm:**
1. UserContextExtractor analyzes `initial_experiences_snapshot` → extract role, industry, level
2. VignetteEngine selects next category to explore
3. VignettePersonalizer:
   - Get template for category
   - Call LLM with user context + template trade-offs + previous vignettes
   - Generate personalized scenario (Kenyan context, KES salaries, relevant companies)
4. Cache generated vignette
5. Present to user

**Example:**
- Template: "Salary vs. Work-Life Balance"
- For Software Developer: "Senior Engineer at startup (KES 150K, 60hr weeks)" vs. "Developer at NGO (KES 80K, 40hr weeks)"
- For Teacher: "Private school (KES 70K, weekend tutoring)" vs. "Public school (KES 50K, strict 8-4)"

Same trade-off, different scenarios matching background.

### 3. Preference Vector Computation

**Decision:** Confidence-weighted incremental updates

**Algorithm:**
```python
def update_preference_vector(preference_vector, extraction_result):
    weight = extraction_result.confidence

    for pref_path, value in extraction_result.inferred_preferences.items():
        current_value = get_field(preference_vector, pref_path)

        if isinstance(value, float):
            if current_value == 0.5:  # Default
                new_value = value
            else:
                # Weighted average
                new_value = current_value * (1 - weight) + value * weight

        elif isinstance(value, str):
            # Replace if confident
            if weight > 0.6:
                new_value = value

        set_field(preference_vector, pref_path, new_value)

    # Overall confidence (moving average)
    preference_vector.confidence_score = (
        preference_vector.confidence_score * 0.7 +
        extraction_result.confidence * 0.3
    )
```

**Benefits:**
- Robust to noisy responses
- High-confidence signals weigh more
- Gradual convergence across multiple vignettes
- Prevents single response from dominating

### 4. Next Vignette Selection Logic

**Decision:** Adaptive selection prioritizing unexplored categories

**Algorithm:**
1. Get next unexplored category from `state.categories_to_explore`
2. Apply difficulty progression (easy → medium → hard based on completed count)
3. For personalized: generate from template using user context
4. For static: select from config by difficulty
5. Avoid recently shown vignettes/templates
6. Mark category covered when confidence > 0.6

**Completion Criteria:**
- Minimum 5 vignettes completed
- At least 3 categories covered
- Overall confidence > 0.3
- All priority categories explored OR user indicates completion

### 5. DB6 Integration Strategy

**Decision:** Graceful degradation with optional Epic 1 dependency

**Current State (Epic 2 Development):**
```python
try:
    from app.epic1.db6_youth_database.db6_client import DB6Client, YouthProfile
except ImportError:
    DB6Client = None  # Agent works without Epic 1
    YouthProfile = None
```

**Integration Points:**

#### Input: Get Experiences
```python
async def _get_experiences_for_questions(self):
    """
    Priority:
    1. DB6 fresh data (if enabled and available)
    2. initial_experiences_snapshot (consistent)
    3. None (no prior experiences)
    """
    if self._state.use_db6_for_fresh_data and self._db6_client:
        try:
            profile = await self._db6_client.get_youth_profile(youth_id)
            return profile.past_experiences
        except:
            pass  # Graceful fallback

    return self._state.initial_experiences_snapshot
```

#### Output: Save Preference Vector
```python
async def _save_preference_vector_to_db6(self):
    """Called at WRAPUP phase to persist final preference vector."""
    if not self._db6_client:
        return  # Skip if DB6 unavailable

    profile = await self._db6_client.get_youth_profile(youth_id) or YouthProfile(youth_id)
    profile.preference_vector = self._state.preference_vector
    profile.interaction_history.append({...})
    await self._db6_client.save_youth_profile(profile)
```

**Migration Path:**
1. Phase 1 (Now): Stub implementation, agent works standalone
2. Phase 2 (Epic 1 Ready): Replace stub with real client
3. Phase 3 (Testing): Test with `use_db6_for_fresh_data=True`
4. Phase 4 (Production): Enable flag in production

### 6. Other Architectural Decisions

**Dual-LLM Pattern:**
- Conversation LLM: Natural dialogue
- Extraction LLM: Structured preference extraction
- Follows existing CollectExperiencesAgent pattern

**JSON Configuration:**
- Vignettes/templates editable without code changes
- Non-technical stakeholders can contribute
- Supports A/B testing and localization

**Phase-Based Flow:**
- Clear progress tracking
- Phase-specific logic
- Natural transition points

**Pydantic Models:**
- Strong typing throughout
- Validation at boundaries
- MongoDB serialization

---

**Created**: 2025-12-05
**Updated**: 2025-12-06
**Epic**: 2 (Preference Elicitation Agent)
**Status**: ✅ Implementation complete, ⏳ Pending AgentDirector integration and routing
