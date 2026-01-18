# Kenya Epic 4: Conversation Flow Optimization & Swahili Enablement

## Quick Summary

**Goal**: Make skills elicitation faster (20% time reduction), less repetitive (30% reduction), and more natural while maintaining quality (85%+ skill overlap). Enable Swahili language support.

**Key Personas**: 
- Persona 1: Informal worker (no CV, speaks to tasks/years)
- Persona 2: Formal/mixed worker (has CV, responsibilities documented or explained)

---

# MILESTONE 1: Baseline, Harness & Design Locks

**Objective**: Establish measurable baselines and unblock parallel workstreams.

---

## A1: Technical Work Plan & Dependency Map ✓

**Status**: COMPLETE (this document)

---

## A2: Evaluation Harness + Baseline Runs

### Task: Implement & Integrate Metrics Collector ✓

**What**: Automated metrics collection in E2E tests.

**Files to Create**:
- `backend/evaluation_tests/baseline_metrics_collector.py`

**Files to Modify**:
- `backend/evaluation_tests/e2e_chat_executor.py` - Add metrics_collector parameter, call hooks
- `backend/evaluation_tests/app_conversation_e2e_test.py` - Initialize collector, export metrics
- `backend/evaluation_tests/evalution_metrics.py` - Add baseline columns to CSV

**Metrics Captured**:
- Turn count, conversation time (total + by phase + by agent)
- LLM calls count and duration
- Experiences discovered/explored, skills per experience
- Repetition rate (semantic similarity > 0.75)
- Skill overlap percentage

**Baseline Test Runs**:
```bash
cd backend
pytest -m "evaluation_test" --repeat 3 \
  -k "single_experience_specific_and_concise_user_e2e or golden_simple_formal_employment" \
  evaluation_tests/app_conversation_e2e_test.py -s
```

**Post-Processing**:
- Calculate mean, median, std dev, 95% CI
- Document metrics output as benchmarks

**Acceptance Criteria**:
- [x] Metrics collector implemented and integrated
- [x] 6 baseline runs completed (2 personas × 3 repititions)
- [x] Metrics exported to JSON/CSV per test
- [x] Statistics calculated and documented

---

## A3: Observability Plan

### Task: Add Correlation IDs & Logging Fields

**Files to Create**:
- `backend/app/middleware/correlation_id_middleware.py`
- `docs/observability-sensitive-data-checklist.md`

**Files to Modify**:
- `backend/app/context_vars.py` - Add `correlation_id: ContextVar[str]`
- `backend/app/server.py` - Register middleware
- `backend/app/conversations/service.py` - Add session_id, turn_index to logs
- `backend/app/agent/agent_director/llm_agent_director.py` - Add agent_type, phase to logs
- `backend/common_libs/llm/llm_caller.py` - Add llm_call_duration_ms to logs

**Logging Fields**:
- `correlation_id`, `session_id`, `turn_index`, `agent_type`, `llm_call_duration_ms`, `phase`

**Sensitive Data Checklist**:
- ❌ NEVER: User PII, full conversation text, raw input before PII filter, API keys
- ✅ SAFE: Session ID (numeric), UUIDs, timing metrics, agent types, aggregated stats

**Acceptance Criteria**:
- [x] Correlation ID middleware implemented
- [x] All 6 logging fields added to relevant code
- [x] Code review confirms no PII logged


## C1: Swahili Model Assessment - FINAL VERDICT IS GEMINI 2.5 (https://docs.cloud.google.com/gemini/docs/codeassist/supported-languages)

**What**: Evaluation framework for Swahili language support.

**Content**:
- Evaluation criteria: Performance, Quality, Cost, Integration, Localization
- Candidate models for language support: Gemini 2.5 Flas
- Shortlist 2-3 models with pros/cons
- Collect 20+ Swahili job terms

**Acceptance Criteria**:
- [x] 2-3 models shortlisted - Chosen the best to be Gemini 2.5

<!-- **New Taxonomy Introoduced For Swahili**:

10 Formal Jobs Added:
- Muuguzi - Nurse
- Dokta - Doctor
- Mhasibu - Accountant / Bookkeeper
- Karani - Clerk / Office worker
- Mwal - Teacher
- Makani - Engineer
- Rubani - Pilot / Driver (can also mean captain)
- Kiongozi - Leader / Manager
- Mzoefu - Trainer / Coach
- Muabiria - Passenger attendant / Tour guide

10 Informal Jobs Added:
- Mchapa kazi - Laborer / General worker
- Msukule kazi - Handyman / Odd jobs person
- Muuzaji - Salesperson / Street vendor
- Mwenye Duka - Small shop owner
- Msee wa Mjengo - Builder / Mason (informal construction)
- Mshonaji - Tailor / Seamstress
- Watchie - Watchman / Security guard
- Seremala - Carpenter
- Mwanamuziki - Musician
- Mchezaji - Player / Athlete / Performer
- Mchukuaji mizigo - Porter / Loader  -->

## Success Criteria

**Quantitative Baselines**:
- [x] Median turn count with confidence interval
- [x] Average conversation time by phase and agent
- [x] Repetition rate calculated
- [x] Skill overlap percentage
- [x] LLM call count and duration

**Infrastructure**:
- [x] Evaluation harness runs automatically
- [x] Metrics exported in JSON/CSV
- [x] Correlation IDs in logs
- [x] Sensitive data checklist reviewed

**Documentation**:
- [x] `baseline_metrics_collector.py` committed
- [x] Baseline metrics documented
- [x] Milestone 2 implementation plan documented (see M2 section below)

---

# MILESTONE 2: Refactor Skills Flow + Persona-Aware Probing

**Objective**: Deliver measurable improvements in flow quality for both personas.

**Baseline Metrics** (from M1):
- Avg turns: 32.4 | LLM calls: 251 | Repetition rate: 11% | Starter diversity: 15.4%
- Test case variance: 16 turns (best) to 70 turns (worst - formal verbose style)
- Critical issue: FAREWELL_AGENT consuming 83% of processing time (64 LLM calls post-conversation)

---

## B1: Refactored Skills Elicitation Flow

**Task 1.1: Debug FAREWELL_AGENT Performance Issue (P0)**
- Investigate why FAREWELL_AGENT makes 64 LLM calls after conversation ends
- Determine if user-facing or backend processing (job matching, skill extraction)
- Fix or separate metrics for accurate timing data
- Files: `llm_agent_director.py`, `farewell_agent.py`, `conversations/service.py`

**Task 1.2: Reduce Starter Phrase Repetition (P0)**
- Problem: "Okay" used in 27% of questions; diversity only 15.4%
- Target: Top starter <15%, diversity >35%
- Add varied acknowledgment phrases to prompts
- Files: `collect_experiences_prompt.py`, `explore_skills_prompt.py`

**Task 1.3: Increase Achievement Question Rate (P1)**
- Problem: Only 1.9% achievement questions (target: >8%)
- Add prompts for accomplishments, challenges overcome, improvements
- Files: `explore_skills_prompt.py`

**Task 1.4: Optimize Skills Exploration (P0)**
- Reduce from 6 turns to 4 turns per experience
- Consolidate questions, add exit criteria (8-12 skills OR 4 turns)
- Files: `explore_skills_agent.py`, `explore_skills_prompt.py`

**Task 1.5: Early Exit for Concise Users (P2)**
- Detect rich, detailed responses and skip redundant follow-ups
- Target: Concise users complete in <18 turns
- Files: `llm_agent_director.py`

---

## B2: Persona-Aware Flow Implementation

**Important**: CV upload integration deferred to Milestone 4. Persona detection is verbal-only for M2.

**Task 2.1: Implement Persona Detection (P0)**
- Detect Persona 2 (Formal) via verbal cues: "title", "position", "department", "responsibilities"
- Detect Persona 1 (Informal) via: "tasks", "daily work", "what I did"
- Default to Persona 1 (safer for informal workers)
- Create: `backend/app/agent/persona_detector.py`
- Modify: `conversations/service.py`, `llm_agent_director.py`

**Task 2.2: Persona 1 (Informal) Optimization (P1)**
- Target: 18-22 turns (simple), ≤35 turns (multi-experience)
- Use simpler language, more examples/scaffolding
- Focus on "what did you do daily" → skills mapping
- Files: `collect_experiences_prompt.py`, `explore_skills_prompt.py`

**Task 2.3: Persona 2 (Formal) Optimization (P0 - Highest Impact)**
- Problem: Formal verbose descriptions take 70 turns (!)
- Target: ≤35 turns (down from 70)
- Acknowledge formal info upfront, avoid redundant questions
- Track information completeness per experience
- Files: `collect_experiences_agent.py`, prompt files

**Task 2.4: Multi-Experience Optimization (P1)**
- Problem: 49 turns for 3+ experiences
- Target: ≤35 turns for 3+ experiences
- First experience: Full exploration (4-5 turns)
- Subsequent: Focused exploration (3 turns)
- Files: `llm_agent_director.py`, `conversations/service.py`

---

## Golden Transcripts (English) + CI Gating

**Task 3.1: Create Golden Transcripts (Based on Refactored Flow)**
- Timing: Create AFTER B1 + B2 refactoring complete
- 6 transcripts total (3 per persona):
  - Persona 1: Simple single exp (18-20 turns), Multi-exp (30-35), Process questioner (20-25)
  - Persona 2: Simple formal (20-25), Formal verbose (30-35), Career progression (35-40)
- Create: `backend/evaluation_tests/golden_transcripts/persona_1/*.json`
- Create: `backend/evaluation_tests/golden_transcripts/persona_2/*.json`

**Task 3.2: Implement CI Test Integration (P0)**
- Metrics to Gate (Block PR): Turn count ±2, Repetition ≤8%, Skill overlap ≥85%
- Metrics to Warn: Achievement Q rate ≥5%, Starter diversity ≥35%
- Create: `golden_transcript_runner.py`, `check_metrics_thresholds.py`
- Create: `.github/workflows/golden_transcript_tests.yml`

---

## C1: Swahili Model Documentation

**Task 4.1: Document Gemini 2.5 Flash Selection**
- Model comparison: Gemini 2.5 Flash vs GPT-4o vs Claude 3.5
- Criteria: Swahili performance, cost, latency, integration
- Selection rationale and cost analysis
- Create: `docs/swahili-model-selection.md`

**Task 4.2: Gemini Integration Preparation**
- API setup checklist for M3
- Environment variables, rate limits, pricing
- Create: `docs/gemini-integration-checklist.md`

---

## Success Criteria

**Performance Improvements** (vs Baseline: 32.4 turns, 11% repetition, 251 LLM calls):
- [ ] Turn count reduced to ≤27 (17%+ reduction)
- [ ] Repetition rate reduced to ≤8% (27%+ reduction)
- [ ] Starter diversity increased to ≥35% (from 15.4%)
- [ ] Achievement question rate ≥8% (from 1.9%)
- [ ] LLM calls reduced to ≤200 (20%+ reduction)

**Quality Maintained**:
- [ ] Skill overlap maintained at 85%+
- [ ] Experience completeness maintained at 95%+
- [ ] No regression in occupation accuracy

**Persona-Aware Flows**:
- [ ] Persona detection implemented (verbal-only, >90% accuracy)
- [ ] Persona 1 (Informal): 18-22 turns simple, ≤35 multi-experience
- [ ] Persona 2 (Formal): 20-25 turns simple, ≤35 turns verbose (down from 70!)
- [ ] Flow adapts based on detected persona type

**CI/CD Integration**:
- [ ] 6 golden transcripts created (3 per persona)
- [ ] Automated tests run on every PR with metric thresholds
- [ ] Clear failure messages when quality gates violated

**Swahili Preparation**:
- [ ] Gemini 2.5 Flash selection documented with rationale
- [ ] Integration checklist ready for M3 (no blockers)

---

# MILESTONE 3: Swahili Enablement + Localization

**Objective**: Deliver Swahili flows with mapping parity and regression protection.

## C2: Localization/Synonym Mapping Module

**Tasks**: TBD

## C3: Swahili-Enabled Flows End-to-End

**Tasks**: TBD

---

## Success Criteria

**Swahili Language Support**:
- [ ] Skills elicitation flow works end-to-end in Swahili
- [ ] Preference flow functional in Swahili
- [ ] Language switching implemented
- [ ] Swahili responses maintain correct tone and grammar

**Localization/Mapping**:
- [ ] Synonym mapping module created and tested
- [ ] 50+ Swahili job terms mapped to taxonomy
- [ ] Code-switched terms handled
- [ ] Regional variations documented

**Quality Parity**:
- [ ] Swahili skill discovery accuracy at 80%+ of English baseline
- [ ] Occupation matching works for Swahili inputs
- [ ] Same structured output as English flows

**Testing & Regression**:
- [ ] Swahili test cases created for both personas
- [ ] Automated tests integrated into CI
- [ ] Regression protection for English flows

---

# MILESTONE 4: CV Integration + Qualifications Extraction

**Objective**: Make Persona 2 experience coherent and add qualifications affecting eligibility. This should support basic CV file uploads in the data extraction layer.

## B3: CV Integration → Merged Profile

**Tasks**: TBD

## B4: Qualifications Extraction + Persistence

**Tasks**: TBD

## C4: Swahili Tests + Evaluation Scripts

**Tasks**: TBD

## Deployment Readiness

**Tasks**: TBD

---

## Success Criteria

**CV Integration (Persona 2)**:
- [ ] CV upload feature functional
- [ ] Conversational flow merges with CV data
- [ ] Duplicate detection prevents redundant questions
- [ ] User can edit/confirm CV-extracted information

**Qualifications Extraction**:
- [ ] Certifications extracted
- [ ] Artisan qualifications recognized
- [ ] Qualifications stored in youth profile database
- [ ] Qualifications affect job matching eligibility

**Persistence & Data Quality**:
- [ ] All experiences saved to database
- [ ] All skills persisted with provenance
- [ ] All qualifications linked to profile
- [ ] Data validation ensures completeness

**Swahili Testing**:
- [ ] Swahili golden transcripts created
- [ ] Evaluation scripts automated
- [ ] Regression tests cover both languages
- [ ] Performance benchmarks documented

**Deployment Readiness**:
- [ ] IaC/config updated for chosen model provider
- [ ] Secrets management configured
- [ ] Environment variables documented
- [ ] Deployment runbook created

---

# MILESTONE 5: Hardening + Handover

**Objective**: Finalize robustness, operational readiness, and transition to support.

## B5: Safety/Edge Case Simulation Suite

**Tasks**: TBD

## Hardening Across Persona 2 + Swahili Flows

**Tasks**: TBD

## A5: Handover/Support Plan

**Tasks**: TBD

---

## Success Criteria

**Safety & Edge Cases**:
- [ ] Safety simulation suite integrated into CI
- [ ] Off-topic detection prevents harmful/sensitive conversations
- [ ] Edge case tests cover empty inputs, very long inputs, code-switching, profanity
- [ ] Graceful degradation for model failures

**Robustness & Hardening**:
- [ ] Persona 2 flow hardened with error handling
- [ ] Swahili flow hardened with fallback mechanisms
- [ ] Performance under load tested
- [ ] Memory leaks and resource issues resolved

**Operational Readiness**:
- [ ] Logging reviewed for completeness and compliance
- [ ] Backup and recovery procedures documented

**Documentation**:
- [ ] Handover plan completed (architecture docs, code walkthrough, knowledge transfer, support escalation)
