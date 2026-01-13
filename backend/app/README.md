# Agent-based design

The Brújula conversational agent under the hood is designed as a set of agents interacting together. Agents may have 
"sub-agents" if they are complex enough. 

Agents are coordinated by the **AgentDirector**.

Each agent is implementing the `Agent` base class, which has the following interface:
```
def execute(user_input: AgentInput, [...]) -> AgentOutput
```

Typically, an agent is governed by an **LLM prompt**: one agent == one prompt (with
parameters). If the prompt is becoming too complex, we split the agent into "sub-agents".


Some agents are stateless and some of them are stateful. If the agent is stateful, then the state is centrally 
managed.

## AgentDirector

The `AgentDirector` is responsible for taking the user input and handling it by **routing** to the appropriate agent.
It knows the available agents and keeps track of the state of the conversation. Routing is done based on two main 
factors: 
a) the current state of the conversation and b) the user input in this conversation turn.

There are two alternative implementations for the agent director: LLMAgentDirector and (old school)AgentDirector.
We are using LLMAgentDirector in the main chat application.

> [!NOTE]
> From here below, the documentation is specific for the LLMAgentDirector.

## Registration and invitation flows

- **Secure links (registration_code + report_token)**: Secure registration links carry `reg_code` and `report_token`. The backend requires a valid token, checks for existing claims or users with the same `registration_code`, and blocks duplicates. On successful signup, the `registration_code` is written to the user preferences and a claim entry is stored in the existing `USER_INVITATIONS` collection (document type `SECURE_LINK_CLAIM`); no capacity decrement applies.
- **Manual/shared invitations (invitation_code)**: When no secure link is present, users enter the shared `invitation_code`. This path stays unlimited-use and continues to rely on the legacy invitation documents without token requirements.
- **Status checks**: `/user-invitations/check-status` reports VALID, USED, or INVALID for both secure links (via `reg_code` + token) and manual `invitation_code` lookups.
- **Report lookup identifiers**: Reporting endpoints should prefer `registration_code` when available and fall back to `user_id` for legacy or manual-invitation users.

Conversation phases currently implemented: `INTRO`, `CONSULTING`, `CHECKOUT`.

List of agents known by the AgentDirector:

 * WelcomeAgent
 * FarewellAgent
 * ExperiencesExplorerAgent *(integrated soon)*
 * SkillExplorerAgent *(will be moved under the ExperiencesExplorerAgent)*

The `AgentDirector` has a similar interface to an Agent:

```
async def execute(user_input: AgentInput) -> AgentOutput
```

... but it does not do any logic itself, other than routing to the appropriate agent.

#### How the LLM in the AgentDirector works
For each conversation phase there is a configured list of suitable agents, which is a subset of all agents.
Each agent has an LLM-targeted task description and example user inputs.
Based on this, we ask the LLM to choose the most appropriate agent for a given user input.
If the LLM fails to give something useful, we have a fallback choice of an agent.

## Skill exploration-related agents

This is the most complex part of the application, with several agents working together.

At the moment, it consists only of the **ExperiencesExplorerAgent**, which is responsible for the overall skill 
exploration, starting from exploring the past work experiences. As we add more logic, we will delegate
some responsibilities to other agents and tools.

When we say work experiences, we think broadly, covering:  formal job experiences e.g. *"Baker"* or *"Ski instructor"*,
as well as informal and unseen economy experiences, e.g. *"Cooking for the family"*, *"Caring for a sick family member"*.
