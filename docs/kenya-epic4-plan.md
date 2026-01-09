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

### Task: Implement & Integrate Metrics Collector

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
- [ ] Metrics collector implemented and integrated
- [ ] 6 baseline runs completed (2 personas × 3 reps)
- [ ] Metrics exported to JSON/CSV per test
- [ ] Statistics calculated and documented

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
- [ ] Correlation ID middleware implemented
- [ ] All 6 logging fields added to relevant code
- [ ] Sensitive data checklist documented
- [ ] Code review confirms no PII logged


## C1: Swahili Model Assessment

**What**: Evaluation framework for Swahili language support.

**Files to Create**:
- `docs/swahili-model-assessment-outline.md`
- `docs/swahili-sample-job-terms.md`

**Content**:
- Evaluation criteria: Performance, Quality, Cost, Integration, Localization
- Candidate models for language support: Gemini 2.5 Flash, Gemini Pro, Jacaranda, mT5/BLOOM
- Shortlist 2-3 models with pros/cons
- Collect 20+ Swahili job terms

**Acceptance Criteria**:
- [ ] Assessment outline created
- [ ] 4+ models researched
- [ ] 2-3 models shortlisted
- [ ] 20+ Swahili job terms collected

## Success Criteria

**Quantitative Baselines**:
- [ ] Median turn count with confidence interval
- [ ] Average conversation time by phase and agent
- [ ] Repetition rate calculated
- [ ] Skill overlap percentage
- [ ] LLM call count and duration

**Infrastructure**:
- [ ] Evaluation harness runs automatically
- [ ] Metrics exported in JSON/CSV
- [ ] Correlation IDs in logs
- [ ] Sensitive data checklist reviewed

**Documentation**:
- [x] `baseline_metrics_collector.py` committed
- [ ] Baseline metrics documented
- [ ] `observability-sensitive-data-checklist.md` - not created yet
- [ ] `milestone-2-approach-plan.md` - not created yet
- [ ] `swahili-model-assessment-outline.md` - not created yet

---

# MILESTONE 2: Refactor Skills Flow + Persona-Aware Probing

**Objective**: Deliver measurable improvements in flow quality for both personas.

## B1: Refactored Skills Elicitation Flow (Rewrite Prompts With Clearer Rules)

**Tasks**: TBD

## B2: Persona-Aware Flow Implementation

**Tasks**: TBD

## Golden Transcripts (English) + CI Gating

**Tasks**: TBD

## C1: Swahili Model Assessment Finalized

**Tasks**: TBD

---

## Success Criteria

**Performance Improvements**:
- [ ] Turn count reduced by 15%+ vs baseline
- [ ] Conversation time reduced by 20%+ vs baseline
- [ ] Repetition rate reduced by 25%+ vs baseline
- [ ] LLM calls reduced by 30%+ vs baseline

**Quality Maintained**:
- [ ] Skill overlap maintained at 85%+
- [ ] Experience completeness maintained at 95%+
- [ ] No regression in occupation accuracy

**Persona-Aware Flows**:
- [ ] Persona detection/selection implemented
- [ ] Tailored question sets for both personas
- [ ] Flow adapts based on persona type

**CI/CD Integration**:
- [ ] Golden transcripts created for both personas
- [ ] Automated tests run on every PR

**Swahili Assessment**:
- [ ] Model comparison completed (3+ models evaluated)
- [ ] Recommendation document with pros/cons/costs
- [ ] Selected model ready for integration

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
