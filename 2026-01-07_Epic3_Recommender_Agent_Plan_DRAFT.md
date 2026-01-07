# Epic 3: Recommender/Advisor Agent - Implementation Plan (DRAFT)

**Author:** Wilfred
**Reviewer:** Jasmin
**Date:** January 7, 2026
**Status:** Jasmin has reviewed
**Context:** This is based on our discussion about merging Mode 1 and Mode 2, prioritizing action over exploration

---

## What We Agreed On

After our conversation, here's what I understand we're building:

1. **You (Jasmin) build**: Node2Vec algorithm (possibly with reasoning layer) that takes the preference vector and outputs occupation recommendations
2. **I build**: Conversational agent that takes your Node2Vec output and motivates users to actually DO something (apply, train, explore), in the direction of the recommendations
3. **Success metric**: User takes action in the direction of the recommendations (not just says "I like it")

The user journey is:
```
Skills Elicitation (Epic 4)
  → Preference Elicitation (Epic 2)
    → BWS Occupation Ranking (40 occupation groups)
      → **Your Node2Vec Algorithm**
        → **My Recommender Agent** ← This is what I'm planning
```

---

## Data Contracts We Need to Define

### What I'll Give You (Preference Vector Schema)

From the preference elicitation agent I built (Epic 2), here's the structure you'll receive:


NOTE --> Since the preference .json input can change, I think it's better if I (Jasmin) programmatically pick up the field from the input .json
How can we make a class flexible to looking different? (e.g. having remote_options all of the sudden, or job_security removed)

```python
class PreferenceVector(BaseModel):
    """Simplified 7-dimensional preference vector from Epic 2"""

    # Core 7 dimensions (0.0 = low importance, 1.0 = high importance)
    financial_importance: float = 0.5
    work_environment_importance: float = 0.5
    career_advancement_importance: float = 0.5
    work_life_balance_importance: float = 0.5
    job_security_importance: float = 0.5
    task_preference_importance: float = 0.5
    social_impact_importance: float = 0.5

    # Metadata
    confidence_score: float = 0.0
    n_vignettes_completed: int = 0

    # Bayesian posterior (optional - if you want to use uncertainty)
    posterior_mean: Optional[list[float]] = None  # 7 dimensions
    posterior_covariance_diagonal: Optional[list[float]] = None

    # Qualitative metadata (optional)
    decision_patterns: dict[str, Any] = {}
    tradeoff_willingness: dict[str, Any] = {}
    values_signals: dict[str, Any] = {}
    extracted_constraints: dict[str, Any] = {}
```

**Also available:**
- **BWS occupation scores** - the top 10 occupation groups the user ranked during Best-Worst Scaling
- **Skills vector** - from Epic 4 (skill IDs + proficiency levels)

### What I Need From You (Node2Vec Output Schema)

Based on your brainstorming document, I understood you were planning to give **three types of recommendations**:
1. **Occupation recommendations** - Career paths (e.g., "Data Analyst")
2. **Opportunity recommendations** - Actual job postings/internships (e.g., "Internship at XYZ Foundation")
[3. **Skills training recommendations** - Training courses (e.g., "Advanced Econometrics on Coursera")] --> This would be there in an ideal case, but I cannot promise that we will have this in our first iteration. Can we build the agent to be flexible on whether this is there or not.
NOTE --> Basically, let's make this agent flow work even if only 1 or 2 of the above are available. (e.g. start with occupations, move to opportunities only if user is 'ready' and opportunity recommendations aren't NA, similarly with skill trainings)


Here's what I'm proposing for the schema so please let me know if this works:
(Jasmin adapted some fields)

```python
class OccupationRecommendation(BaseModel):
    """Career path recommendation"""

    uuid: str  # using taxonomy uuid
    originUuid: str  # using taxonomy origin uuid
    rank: int  # 1-N (1 = best match)

    occupation_id: str  # e.g., "ESCO_occupation_12345"
    occupation_code: str  # e.g., "2512" (ESCO/KeSCO code)
    occupation: str  # e.g., "Data Analyst"

    confidence_score: float  # 0.0-1.0
    justification: str  # Why this matches the user
    essential_skills: list[str]  # Skills needed for this occupation

    # Optional - from DB1/DB2
    description: Optional[str] = None
    typical_tasks: Optional[list[str]] = None
    career_path_next_steps: Optional[list[str]] = None
    labor_demand_category: Optional[str] = None  # "high" / "medium" / "low"


class OpportunityRecommendation(BaseModel):
    """Actual job posting / internship recommendation"""

    id: str  # e.g., "opp_001"
    rank: int  # 1-N (1 = best match)

    opportunity_title: str  # e.g., "Internship at XYZ Foundation"
    location: str  # e.g., "Nairobi" or "Remote"

    justification: str  # Why this matches the user
    essential_skills: list[str]  # Skills needed

    # Optional - from DB3 (jobs database)
    employer: Optional[str] = None
    salary_range: Optional[str] = None
    contract_type: Optional[str] = None  # "full-time" / "internship" / "contract"
    posting_url: Optional[str] = None
    posted_date: Optional[str] = None


class SkillsTrainingRecommendation(BaseModel):
    """Training course recommendation"""

    uuid: str  # # using taxonomy uuid
    originUuid: str  # # using taxonomy origin uuid
    rank: int  # 1-N (1 = best match)

    skill: str  # e.g., "Advanced Econometrics"

    justification: str  # Why this training is relevant

    # Optional - from DB4 (training database)
    provider: Optional[str] = None  # e.g., "Coursera" (Jasmin moved this to optional)
    cost: Optional[str] = None
    location: Optional[str] = None  # "Online" / "Nairobi" / etc.
    delivery_mode: Optional[str] = None  # "online" / "in-person" / "hybrid"
    target_occupations: Optional[list[str]] = None  # Which occupations this unlocks


class Node2VecRecommendations(BaseModel):
    """Complete output from your Node2Vec algorithm"""

    youth_id: str
    generated_at: datetime
    recommended_by: list[str]  # ["Algorithm"] or ["Human", "Algorithm"]

    # Three types of recommendations
    occupation_recommendations: list[OccupationRecommendation]
    opportunity_recommendations: list[OpportunityRecommendation]
    skillstraining_recommendations: list[SkillsTrainingRecommendation]

    # Algorithm metadata
    algorithm_version: str = "node2vec_v1"
    confidence: float  # Overall confidence in recommendations
```

**Questions for you:**
1. Does this three-part structure match what you're planning?
2. How many of each type will you return? (e.g., 5 occupations, 10 opportunities, 5 trainings?)
<!-- 3. Will you provide the `justification` field or should I generate it with my LLM? -->
4. For opportunities - are these coming from DB3 (Epic 1's jobs database) or will you query that yourself?
5. For trainings - same question, are you using DB4 or should I handle that separately?
6. The `recommended_by` field - when would this be `["Human", "Algorithm"]` vs just `["Algorithm"]`?

---

## How the Agent Will Work (Conversation Flow)

I'm structuring this as a phase-based conversation, similar to how the preference agent works. Here's the flow:

### Phase Structure

```python
class ConversationPhase(str, Enum):
    INTRO = "INTRO"                          # Explain what's coming
    PRESENT_RECOMMENDATIONS = "PRESENT"       # Show top 3-5 occupations
    CAREER_EXPLORATION = "EXPLORATION"        # Deep-dive on specific occupation
    ADDRESS_CONCERNS = "CONCERNS"             # Handle resistance/objections
    DISCUSS_TRADEOFFS = "TRADEOFFS"          # Preference vs demand balance
    FOLLOW_UP = "FOLLOW_UP"                  # Clarify user responses
    SKILLS_UPGRADE_PIVOT = "SKILLS_UPGRADE"  # User rejected all → training path
    ACTION_PLANNING = "ACTION"               # Concrete next steps
    WRAPUP = "WRAPUP"                        # Summarize, confirm plan
    COMPLETE = "COMPLETE"                    # Session done
```

### Note for all phases
The overall idea is that all agents together optimize for user *effort* in the *direction of the recommendations*. This is common to all, and should be in the prompts as overarching goal (although we can still work on the exact phrasing). The instruction should be that although we provide guidance to the agents on how to behave/react, the LLM should primarily always be guided by this overarching goal and make decisions accordingly.

The agent should internally treat success as applications submitted, steps taken, or persistence after first rejection; not stated agreement, or liking the recommendation

Also common to all prompts: Clearly railguard the LLM to stay truthful, but also to be as persuasive as possible.

### Detailed Phases

#### Phase 1: INTRO
Set expectations about what we're doing.

**Example:**
```
"Great! Based on what you've shared about your skills and preferences,
I've identified some career paths that could be a really good fit for you.

I'll show you a few options, and we can discuss what appeals to you
and what concerns you might have. There's no pressure - I just want
to help you understand what's out there and find something worth pursuing.

Ready to see what I found?"
```

**Next:** User confirms → PRESENT_RECOMMENDATIONS

---

#### Phase 2: PRESENT_RECOMMENDATIONS
Show recommendations from your Node2Vec output. Since you're providing **three types** (occupations, opportunities, trainings), I'll present them strategically based on the user's situation.

**Presentation strategy:**
- **Start with occupations** (career paths) to give big-picture direction
- **Then show opportunities** (actual jobs) if they express interest in an occupation
- **Show trainings** when there's a skill gap OR when they reject occupations

**Example (Occupation-first approach):**
```
Based on your skills and preferences, here are career paths that match what you're looking for:

**Career Paths:**
1. **Data Analyst** (High demand, KES 60,000-120,000/month)
   - Matches your analytical skills and preference for structured work
   - Growing field in Kenya with many opportunities

2. **M&E Specialist** (Steady demand, KES 50,000-100,000/month)
   - Uses your fieldwork experience and evaluation skills
   - Common in NGO sector (aligns with your values)

Which of these interests you? I can also show you actual job openings or training options.
```

**If user shows interest in an occupation:**
```
Great! For Data Analyst roles, here are some actual opportunities available now:

**Current Openings:**
1. **Internship at XYZ Foundation** (Nairobi)
   - Entry-level, builds foundation in impact evaluation
   - 6-month program with potential for full-time hire

2. **Research Assistantship at ABC Lab** (Remote)
   - Flexible work arrangement (you ranked this high!)
   - Focus on quantitative analysis

Want to explore these or see the other career path first?
```

**What I'm tracking:**
```python
user_interest_signals: dict[str, str] = {}
# {"occ_001": "interested", "occ_002": "rejected", "opp_001": "exploring"}

rejected_occupations: int = 0
rejected_opportunities: int = 0
explored_items: list[str] = []  # IDs of occupations/opportunities explored
current_recommendation_type: str = "occupation"  # "occupation" / "opportunity" / "training"
```

**User responses → routing:**
- "Tell me more about X occupation" → CAREER_EXPLORATION (deep-dive on X)
- "Show me jobs for X" → Present opportunities for that occupation
- "I don't think X is right because..." → ADDRESS_CONCERNS
- "None of these careers work for me" → Show trainings OR SKILLS_UPGRADE_PIVOT

---

#### Phase 3: CAREER_EXPLORATION
Deep-dive on a specific occupation the user is interested in.

**What I'll do:**
- Fetch additional data from DB1 (typical tasks, day-to-day, career progression)
- Explain concretely what the work involves
- Connect to their preferences ("You said autonomy matters - this role offers...")
- Show career path progression

**Example:**
```
Let's dive into Software Development:

**What you'd actually do day-to-day:**
- Write code to solve problems (you mentioned enjoying analytical work)
- Collaborate with teams on projects (2-3 meetings/week, mostly async)
- Learn new tools and technologies (constant growth)

**Career path:**
Junior Developer (1-2 years) → Mid-level Developer → Senior Developer → Tech Lead
Typical timeline: 5-7 years to senior level with KES 200K+ monthly

**Why this matches your preferences:**
- High autonomy (you ranked this 0.85)
- Remote work common (your work_environment_importance: 0.78)
- Strong job security in growing field
- Financial: KES 80K-150K aligns with your expectations

**What concerns do you have about this path?**
```

**Transitions:**
- User expresses concern → ADDRESS_CONCERNS
- User asks about tradeoffs → DISCUSS_TRADEOFFS
- User says "this sounds good" → ACTION_PLANNING
- User wants other options → back to PRESENT_RECOMMENDATIONS

---

#### Phase 4: ADDRESS_CONCERNS
Handle resistance using the framework from your brainstorming document.

I'm classifying resistance into three types:

```python
class ResistanceType(str, Enum):
    BELIEF_BASED = "belief"      # "I don't think I could succeed"
    SALIENCE_BASED = "salience"  # "It doesn't feel like real work"
    EFFORT_BASED = "effort"      # "Applications are exhausting"
```

Some things that might come up here that the agent might want to address:
--Explain why higher effort now can pay off in the long-run, and that it's normal that (a) many applications lead to rejections and (b) a first job is never perfect but just a stepping stone for learning and career growth
--Why retention and persisting in a job even when it's first hard is important
--How/why the user might enjoy the recommended occupations more than they think (i.e. discuss tradeoffs; like "You may not love manufacturing, but the stability matters right now”)

**Response strategies:**

| Resistance Type | User Says | My Agent's Response |
|-----------------|-----------|---------------------|
| **Belief-based** | "I don't have the skills" | "Many people start here with similar backgrounds. The essential skills are X, Y, Z - you already have Y and Z. We can help you build X through training." |
| **Belief-based** | "There are no jobs" | "Actually, this field has **high demand** in Kenya - [show DB2 data]. Companies are actively hiring." |
| **Salience-based** | "My family won't respect this" | "Many families initially question non-traditional careers. What changes minds is stable income. In 2 years, you might earn KES X, supporting your family well." |
| **Effort-based** | "I'll get rejected anyway" | "Rejections are normal - most people apply to 10-15 jobs before an offer. It's part of the process, not your worth. Persistence matters." |

**Hard railguards** (so that it stays persuasion, not manipulation):

For example
```
For instance we dont want the model to say stuff like:

"You will enjoy this"
"This fits who you are"
"You're perfect for this"

Better alternatives:

"Many people discover they enjoy X after trying it"
"This path keeps future options open"
"Your skills align well - you'd have a strong foundation"
```

---

#### Phase 5: DISCUSS_TRADEOFFS
When user prefers low-demand option but we have high-demand option recommended.
Highlights upsides of the recommendations conditional on existing preferences

**Example:**
```
I hear that [Option A] appeals more because of [their preference].
That's valid - it matches your values.

Here's the tradeoff:
- Option A: Lower demand (harder to find openings), but perfect preference match
- Option B: High demand (easier to get hired), but requires accepting [tradeoff]

**Option B as a stepping stone:**
Many people start with B (stable income, build experience)
then transition to A after 2-3 years with more leverage.

Would you be open to that path? Or is A important enough to pursue directly?
```

---

#### Phase 6: SKILLS_UPGRADE_PIVOT
**Trigger:** User rejects ALL occupation recommendations (rejected_occupations >= 3)

Since you're already providing training recommendations in your Node2Vec output, I'll present those here as an alternative path.

**Example:**
```
I understand none of those career paths felt right. That's completely okay - let's approach this differently.

Looking at the fields you're interested in, here are skill-building opportunities that could open up new options:

**Training Recommendations:**

1. **Advanced Econometrics** (Coursera, 40 hours)
   - Would strengthen your analysis skills for research roles
   - Opens doors to: Data Analyst, Research Assistant, M&E roles
   - You already have the foundation - this builds on it

2. **Data Visualization with ggplot2** (DataCamp, 12 hours)
   - Quick skill boost that's highly valued
   - Helps you stand out in applications
   - Practical, hands-on approach

Would building these skills make you feel more confident about career options? Or is there something else holding you back?
```

**What I'm doing here:**
- Present the `skillstraining_recommendations` from your Node2Vec output
- Frame training as a path to opportunities (not just skill-building for its own sake)
- Connect each training to specific occupations it unlocks
- Keep the door open for deeper conversation about barriers

**Transitions:**
- User interested in training → ACTION_PLANNING (enrollment as action)
- User still resistant → FOLLOW_UP (explore deeper blockers - maybe not about skills at all)

---

#### Phase 7: ACTION_PLANNING
Convert interest into concrete next steps. The action varies by what they're interested in:
Help people build agency and get into action (e.g. if user says that all of their peers prefer to stay idle); The primary goal is motivate people to get going and choose a career or an occupation that makes sense --> the recommendations are well-informed so the agent should really motivate them to take those seriously and take action in direction of those (e.g. "This is hard, but worth pushing through")

--> In addition to potentially showing real opportunities, this agent should be motivational and nudge the user to OFFLINE action. E.g. motivate user to talk to mentor about recommendations, to apply to a job related to recommendations, to look up more online related to recommendations etc.

**For occupation interest:**
```
Great! So Data Analyst sounds like a good fit. Let's talk next steps.

I have actual job openings for this role - would you like to see them?
Or would you prefer to build [missing skill] first through training?
```

**For opportunity interest (actual job posting):**
```
Perfect! The "Internship at XYZ Foundation" looks promising.

Here's the application link: [URL]

What feels realistic for you?
A) Apply this week (I can help with your CV if needed)
B) Learn more about the role first (research the organization)
C) Something is holding you back - let's talk about it
```

**For training interest:**
```
Great choice! "Advanced Econometrics" will definitely strengthen your profile.

Here's how to enroll: [provider link]

When will you start?
A) This week (get the momentum going)
B) Next month (after [current commitment])
C) I'm not sure yet - what's stopping you?
```

**What I'm logging:**
```python
class ActionCommitment(BaseModel):
    recommendation_id: str  # Could be occupation, opportunity, or training ID
    recommendation_type: str  # "occupation" / "opportunity" / "training"
    action_type: str  # "apply_to_job" / "enroll_in_training" / "explore_occupation"
    commitment_level: str  # "will_do_this_week" / "will_do_this_month" / "interested" / "maybe_later"
    barriers_mentioned: list[str] = []
    specific_opportunity: Optional[str] = None  # Job posting ID if they picked one
    timestamp: datetime
```

**Success metric:**
- `commitment_level == "will_do_this_week"` AND `action_type in ["apply_to_job", "enroll_in_training"]`
- This measures actual intent to act, not just interest

---

#### Phase 8: WRAPUP
Summarize, save to DB6, confirm plan.

**Example:**
```
Perfect! Here's what we've discussed:

**Your top career match:** [Occupation X]
- Aligns with: [preferences that matched]
- Next step: [action they committed to]
- Timeline: [when they'll do it]

I've saved this to your profile so we can follow up.

Before we wrap - what's the ONE thing that might stop you from this step?
Let's talk through it now so you're prepared.
```

**Save to DB6:**
- Recommendations shown
- User reactions (interested/rejected per occupation)
- Concerns raised and addressed
- Final action commitment

---

## State Management

Here's what I'm tracking throughout the conversation:

```python
class RecommenderAdvisorAgentState(BaseModel):
    """State for my agent"""

    session_id: int
    conversation_phase: ConversationPhase = ConversationPhase.INTRO
    conversation_turn_count: int = 0

    # Input data
    youth_id: str
    skills_vector: Optional[dict] = None  # From Epic 4
    preference_vector: Optional[PreferenceVector] = None  # From Epic 2
    bws_occupation_scores: Optional[dict[str, float]] = None  # From Epic 2

    # Your Node2Vec recommendations (all three types)
    recommendations: Optional[Node2VecRecommendations] = None

    # What we've presented to user
    presented_occupations: list[str] = []  # Occupation IDs shown
    presented_opportunities: list[str] = []  # Job posting IDs shown
    presented_trainings: list[str] = []  # Training IDs shown

    # User engagement tracking (tracks ALL three types)
    user_interest_signals: dict[str, str] = {}
    # {"occ_001": "interested", "opp_002": "rejected", "skill_001": "committed"}
    # Values: "interested" / "exploring" / "neutral" / "rejected" / "committed"

    # Rejection tracking
    rejected_occupations: int = 0
    rejected_opportunities: int = 0
    rejected_trainings: int = 0

    # Current focus
    current_recommendation_type: str = "occupation"  # "occupation" / "opportunity" / "training"
    current_focus_id: Optional[str] = None  # ID of current item being discussed
    explored_items: list[str] = []  # All IDs explored (any type)

    # Resistance & concerns
    concerns_raised: list[dict] = []
    # [{"item_id": "occ_001", "concern": "...", "resistance_type": "belief"}]

    addressed_concerns: list[str] = []

    # Skills upgrade pivot
    pivoted_to_training: bool = False

    # Action commitment
    action_commitment: Optional[ActionCommitment] = None

    # Labor demand context (I'll load this from config file)
    labor_demand_data: dict[str, dict] = {}

    # Conversation log (for DB6)
    conversation_log: list[dict] = []
```

---

## Architecture Overview

Here's how I'm organizing the code:

```
backend/app/agent/recommender_advisor_agent/
├── agent.py                    # Main conversational agent
├── state.py                    # RecommenderAdvisorAgentState
├── types.py                    # Data models (OccupationRecommendation, etc.)
├── recommendation_interface.py # Interface to your Node2Vec
├── motivation_strategies.py    # Resistance handling patterns
└── config/
    └── labor_demand_context.json  # Labor demand data for 40 occupations
```

**Dependencies on Epic 1** (VERY IMPORTANT):
- DB1: Occupation taxonomy (descriptions, required skills, career paths)
- DB2: Labor demand data per occupation
- DB4: Training opportunities
- DB6: Youth profiles (to fetch skills + preferences, save commitments)

---

## Success Metrics (What Gets Logged)

In DB6, I'll save this to the youth profile (not final btw):

```python
{
    "recommender_session": {
        "session_id": 123,
        "completed_at": "2026-01-04T...",

        # All recommendations shown (three types)
        "recommendations_presented": {
            "occupations": ["occ_001", "occ_002"],
            "opportunities": ["opp_001", "opp_002", "opp_003"],
            "trainings": ["skill_001", "skill_002"]
        },

        # User reactions per type
        "user_engagement": {
            "occupations_explored": ["occ_001"],  # Deep-dived on Data Analyst
            "occupations_rejected": ["occ_002"],  # Rejected M&E Specialist
            "opportunities_explored": ["opp_001"],  # Clicked on XYZ Foundation internship
            "opportunities_rejected": [],
            "trainings_presented": ["skill_001", "skill_002"],
            "trainings_interested": []
        },

        # Concerns & resistance
        "concerns_raised": [
            {"item_id": "occ_001", "concern": "worried about technical difficulty", "type": "belief"},
            {"item_id": "opp_001", "concern": "internship pay too low", "type": "financial"}
        ],
        "concerns_addressed": 2,

        # Final outcome
        "action_commitment": {
            "recommendation_id": "opp_001",
            "recommendation_type": "opportunity",  # Applied to actual job posting
            "action_type": "apply_to_job",
            "commitment_level": "will_do_this_week",
            "specific_opportunity": "Internship at XYZ Foundation",
            "committed_at": "2026-01-04T..."
        },

        # Engagement quality
        "turns_count": 15,
        "pivoted_to_training": False,
        "recommendation_flow": ["occupation", "opportunity", "action"]  # Path taken
    }
}
```

**Key success metric:**
- `commitment_level == "will_do_this_week"` OR `"will_do_this_month"`
- AND `action_type in ["apply_to_job", "enroll_in_training"]`

This measures actual intent to act (job application or training enrollment), not just interest or exploration.

---

## What I Need From You

1. **Review the Node2Vec output schema** - does `OccupationRecommendation` and `Node2VecRecommendations` work for you? Any changes needed?

2. **Confirm the input** - is the `PreferenceVector` structure what you need? Do you need anything additional?

3. **How many recommendations** will your algorithm return (top-K)? I'm planning for 5-10 but can adjust. --> this sounds right!

4. **Score components** - can you provide the breakdown (`skills_match`, `preference_match`, `labor_demand`, `graph_proximity`) or should I just work with a single `total_score`? --> I (Jasmin) can provide a breakdown! How would that change the output I need to create and your classes?

5. **Labor demand data** - will this come from your algorithm or should I pull it separately from DB2 (Epic 1 contractor)? --> I (Jasmin) can put it into the recommendations!

6. **Timeline coordination** - when do you expect to have the Node2Vec algorithm ready? I can build the agent with mock data initially and plug yours in when ready. --> I (Jasmin) will work on it this weekend, but it will surely still need tweaking along the way.

7. **Any other thoughts** on the conversation flow or phases? Does this align with what you were envisioning? --> See comments above. Broadly really really good and aligned! I just added some nuances, and I think the career path and skills_upgrade_pivot are still less clear. But let's backlog this for now, build out the rest and then tackle it.

---

## My Next Steps

Once we align on the data contracts, I'll:

1. Define the types (`types.py` with recommendation models)
2. Build the state management (`state.py`)
3. Create a stub interface to your Node2Vec (so I can develop in parallel)
4. Start implementing the conversation phases
5. Coordinate for DB1, DB2, DB4, DB6 access --> DB1 does already exist, so please coordinate with Anselme how we would connect to it

I know we're behind schedule (it's Jan 4 already), so I want to move quickly once we agree on the structure.

**Let me know your thoughts!**

---

**Wilfred**
January 4, 2026
