# Milestone 1: Baseline Metrics Analysis - Overview

We need to establish baseline metrics for the Compass system before we start optimizing. This document outlines what we should measure and how to measure it.

Key goals:
- 20% reduction in median turn count
- 30% reduction in repetition rate
- 20% reduction in average conversation time
- Maintain or improve mapping quality (85-90% skill overlap threshold)

## 1. Test Infrastructure Overview

### 1.1 E2E Test Suite
- **Location**: `backend/evaluation_tests/app_conversation_e2e_test.py`
- **Test Cases**: 14 personas in `core_e2e_tests_cases.py`
- **Repetitions Required**: 3x per test case for statistical significance
- **Total Test Runs**: 42 conversations

### 1.2 Test Personas Coverage

| Persona Type | Count | Work Types Covered | Complexity |
|--------------|-------|-------------------|------------|
| Single Experience (Concise) | 4 | Formal employment | Low |
| Single Experience (Specific) | 2 | Formal + Informal | Low-Medium |
| Informal/Unpaid Work | 2 | Unseen unpaid, volunteer | Medium |
| Multi-Experience | 2 | Mixed (2-8 experiences) | High |
| International | 4 | Kenya, South Africa, France | Medium-High |
| Edge Cases | 2 | CV upload style, process questions | Medium |

### 1.3 Current Metrics Tracked

**Automatically Captured**:
- Turn count to completion
- Experience count (discovered vs explored)
- Skills count per experience
- Occupation match accuracy
- LLM call statistics (duration, tokens)
- Summary quality scores

**Manually Evaluated**:
- Conversation conciseness score
- Experience data accuracy (title, location, dates)
- Work type classification accuracy

## 2. Baseline Metrics Framework

### 2.1 Conversation Efficiency Metrics

#### 2.1.1 Turn Count Analysis

**Definition**: Number of back-and-forth exchanges from conversation start to completion

**Measurement Approach**:
```
Turn Count = len(conversation_history.turns)
```

**Expected Baseline** (to be populated after test runs):
- **Median turn count (all personas)**: [TBD]
- **Median by persona complexity**:
  - Low complexity (1 experience): [TBD]
  - Medium complexity (2-3 experiences): [TBD]
  - High complexity (4+ experiences): [TBD]
- **Standard deviation**: [TBD]

**Target for Future Milestones**: ≥20% reduction

#### 2.1.2 Repetition Rate

**Definition**: Frequency of duplicate or semantically similar questions asked by the agent

**Measurement Approach** (to be implemented):
```python
# Pseudo-code for future implementation
repetition_count = 0
agent_questions = extract_agent_questions(conversation)
for i, q1 in enumerate(agent_questions):
    for q2 in agent_questions[i+1:]:
        if semantic_similarity(q1, q2) > 0.85:
            repetition_count += 1
            
repetition_rate = repetition_count / len(agent_questions)
```

**Expected Baseline** (to be measured):
- **Average repetition rate**: [TBD]%
- **Common repetition patterns**: [TBD]
- **Repetition by agent type**: [TBD]

**Target for Future Milestones**: ≥30% reduction

#### 2.1.3 Average Conversation Time

**Definition**: Total time spent in LLM calls and pipeline processing per conversation

**Measurement Approach**:
```python
total_time = sum([
    turn.llm_call_duration 
    for turn in conversation_history.turns
])
```

**Expected Baseline** (to be measured):
- **Mean conversation time**: [TBD] seconds
- **Breakdown by phase**:
  - INTRO phase: [TBD]s
  - COUNSELING phase: [TBD]s
  - CHECKOUT phase: [TBD]s
- **Breakdown by agent**:
  - Welcome Agent: [TBD]s
  - Collect Experiences Agent: [TBD]s
  - Skill Explorer Agent: [TBD]s
  - Experience Pipeline: [TBD]s

**Target for Future Milestones**: ≥20% reduction

---

### 2.2 Time-to-Insight Metrics

#### 2.2.1 Turns Until First Experience Extracted

**Definition**: Number of turns before the first complete experience is captured

**Measurement Approach**:
```python
first_experience_turn = None
for i, turn in enumerate(conversation_history.turns):
    if len(collect_agent.get_experiences()) > 0:
        first_experience_turn = i
        break
```

**Expected Baseline**: [TBD] turns

#### 2.2.2 Skills Count Per Experience

**Definition**: Average number of skills discovered per experience

**Measurement Approach**:
```python
skills_per_experience = [
    len(exp.top_skills) 
    for exp in explored_experiences
]
mean_skills = mean(skills_per_experience)
```

**Expected Baseline**:
- **Mean skills per experience**: [TBD]
- **Min/Max range**: [TBD] - [TBD]
- **Distribution by work type**: [TBD]

**Target**: Maintain or increase while reducing conversation time

#### 2.2.3 Skill Confidence Scores

**Definition**: Average confidence/relevance score for discovered skills

**Measurement Approach**: Analyze similarity scores from vector search

**Expected Baseline**: [TBD]

---

### 2.3 Mapping Quality Metrics

#### 2.3.1 Top-K Skill Overlap

**Definition**: Percentage of expected skills that appear in top-K discovered skills

**Measurement Approach**:
```python
expected_skills = test_case.expected_skills
discovered_skills = experience.top_skills[:K]
overlap = len(set(expected_skills) & set(discovered_skills))
overlap_percentage = overlap / len(expected_skills) * 100
```

**Expected Baseline** (K=10): [TBD]%

**Target**: ≥85-90% overlap maintained

#### 2.3.2 Occupation Match Accuracy

**Definition**: Percentage of experiences where inferred occupation matches expected

**Measurement Approach**: Manual validation against test case expectations

**Expected Baseline**: [TBD]%

**Target**: Maintain or improve

#### 2.3.3 Essential vs Non-Essential Skill Ratio

**Definition**: Ratio of essential skills to total skills discovered

**Measurement Approach**:
```python
essential_skills = [
    skill for skill in experience.top_skills 
    if skill.is_essential
]
ratio = len(essential_skills) / len(experience.top_skills)
```

**Expected Baseline**: [TBD]

## 3. Statistical Analysis Requirements

### 3.1 Confidence Intervals

For each metric, calculate:
- **Mean (μ)**: Average value across all test runs
- **Standard Deviation (σ)**: Measure of variance
- **95% Confidence Interval**: μ ± 1.96 * (σ / √n)

### 3.2 Distribution Analysis

- **Median**: Middle value (more robust to outliers than mean)
- **Quartiles**: Q1 (25th percentile), Q3 (75th percentile)
- **Outliers**: Values beyond 1.5 * IQR from quartiles

### 3.3 Comparison Groups

Analyze metrics by:
- **Persona complexity** (low/medium/high)
- **Work type** (formal/informal/self-employment/unpaid)
- **Language/Locale** (EN_US, ES_AR, etc.)
- **Conversation style** (concise vs verbose users)

## 4. Data Collection Procedure

### 4.1 Test Execution Command

```bash
cd backend
pytest -m "evaluation_test('baseline-v1')" --repeat 3 evaluation_tests/app_conversation_e2e_test.py -s
```

### 4.2 Output Locations

- **Raw results**: `backend/test_output/baseline-run-[timestamp]/`
- **Aggregated CSV**: `backend/test_output/test_results.csv`
- **Summary CSV**: `backend/test_output/test_summary.csv`
- **Conversation transcripts**: `backend/test_output/e2e_test_*/evaluation_record.md`

### 4.3 Post-Processing Steps

1. Run aggregation script:
   ```bash
   python evaluation_tests/evalution_metrics.py
   ```

2. Extract metrics from JSON results:
   ```bash
   python scripts/analyze_baseline_metrics.py
   ```

3. Generate statistical summary:
   ```bash
   python scripts/generate_baseline_report.py
   ```

## 5. Baseline Results

### 5.1 Overall Statistics

**[TO BE POPULATED AFTER TEST EXECUTION]**

| Metric | Mean | Median | Std Dev | Min | Max | 95% CI |
|--------|------|--------|---------|-----|-----|--------|
| Turn Count | - | - | - | - | - | - |
| Conversation Time (s) | - | - | - | - | - | - |
| Skills per Experience | - | - | - | - | - | - |
| Skill Overlap % | - | - | - | - | - | - |

### 5.2 By Persona Complexity

**[TO BE POPULATED]**

### 5.3 By Work Type

**[TO BE POPULATED]**

### 5.4 By Agent

**[TO BE POPULATED]**

## 6. Key Findings

### 6.1 Performance Bottlenecks

**[TO BE ANALYZED FROM TEST RESULTS]**

Areas where conversation takes longest:
1. [TBD]
2. [TBD]
3. [TBD]

### 6.2 Quality Issues

**[TO BE ANALYZED FROM TEST RESULTS]**

Areas where mapping quality is suboptimal:
1. [TBD]
2. [TBD]
3. [TBD]

### 6.3 Efficiency Issues

**[TO BE ANALYZED FROM TEST RESULTS]**

Areas with unnecessary turns or repetition:
1. [TBD]
2. [TBD]
3. [TBD]

## 7. Comparison to Target Metrics

| Goal | Baseline | Target | Gap | Priority |
|------|----------|--------|-----|----------|
| Median turn count reduction | [TBD] | -20% | [TBD] | High |
| Repetition rate reduction | [TBD]% | -30% | [TBD] | High |
| Conversation time reduction | [TBD]s | -20% | [TBD] | High |
| Skill overlap maintained | [TBD]% | ≥85% | [TBD] | Critical |

## 8. Next Steps

1. **Execute E2E test suite** with 3 repetitions per test case
2. **Populate all [TBD] sections** with actual measurements
3. **Analyze conversation transcripts** for qualitative insights
4. **Identify top 5 bottlenecks** for immediate attention
5. **Create improvement roadmap** based on findings

## 9. Appendices

### 9.1 Test Case Details

See: `backend/evaluation_tests/core_e2e_tests_cases.py`

### 9.2 Metrics Calculation Scripts

See: `backend/evaluation_tests/evalution_metrics.py`

### 9.3 Raw Data

Location: `backend/test_output/baseline-run-[date]/`


