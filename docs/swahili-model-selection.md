# Swahili Model Selection: Gemini 2.5 Flash

## Executive Summary

**Selected Model**: Gemini 2.5 Flash  
**Decision Date**: January 2026  
**Use Case**: Swahili language support for skills elicitation conversations

Gemini 2.5 Flash was selected as the best model for Swahili language support based on native multilingual capabilities, cost-effectiveness, and seamless integration with the existing Google Cloud infrastructure.

---

## Models Evaluated

| Model | Provider | Swahili Support | Notes |
|-------|----------|-----------------|-------|
| **Gemini 2.5 Flash** | Google | ✅ Native | Selected |
| GPT-4o | OpenAI | ✅ Good | Higher cost |
| GPT-4 Turbo | OpenAI | ✅ Good | Higher cost, slower |
| Claude 3.5 Sonnet | Anthropic | ⚠️ Limited | Less tested for Swahili |

---

## Evaluation Criteria

### 1. Swahili Language Performance (Weight: 40%)

| Model | Score | Notes |
|-------|-------|-------|
| **Gemini 2.5 Flash** | ⭐⭐⭐⭐⭐ | Native Swahili in training data, excellent grammar and tone |
| GPT-4o | ⭐⭐⭐⭐ | Good performance, occasional awkward phrasing |
| Claude 3.5 Sonnet | ⭐⭐⭐ | Functional but less natural, limited testing data |

**Key Swahili Capabilities Tested**:
- Conversational fluency in skills elicitation context
- Code-switching handling (Swahili + English mix common in Kenya)
- Correct use of formal/informal registers
- Job terminology translation (see taxonomy in kenya-epic4-plan.md)

### 2. Cost (Weight: 25%)

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Est. Cost/Conversation |
|-------|----------------------|------------------------|------------------------|
| **Gemini 2.5 Flash** | $0.075 | $0.30 | ~$0.02-0.05 |
| GPT-4o | $2.50 | $10.00 | ~$0.50-1.00 |
| GPT-4 Turbo | $10.00 | $30.00 | ~$2.00-4.00 |
| Claude 3.5 Sonnet | $3.00 | $15.00 | ~$0.60-1.20 |

**Winner**: Gemini 2.5 Flash is **20-50x cheaper** than alternatives for high-volume conversations.

### 3. Latency (Weight: 15%)

| Model | Avg Response Time | Notes |
|-------|-------------------|-------|
| **Gemini 2.5 Flash** | ~1-2s | Optimized for speed |
| GPT-4o | ~2-3s | Good |
| GPT-4 Turbo | ~3-5s | Slower |
| Claude 3.5 Sonnet | ~2-3s | Good |

**Winner**: Gemini 2.5 Flash - Critical for conversational UX where responsiveness matters.

### 4. Integration Complexity (Weight: 10%)

| Model | Integration | Notes |
|-------|-------------|-------|
| **Gemini 2.5 Flash** | ✅ Easy | Already using Google Cloud, Vertex AI available |
| GPT-4o | ⚠️ Medium | Requires OpenAI API setup, separate billing |
| Claude 3.5 Sonnet | ⚠️ Medium | Requires Anthropic API setup, separate billing |

**Winner**: Gemini 2.5 Flash - No additional vendor setup needed.

### 5. Localization Features (Weight: 10%)

| Model | Features | Notes |
|-------|----------|-------|
| **Gemini 2.5 Flash** | ✅ Excellent | Language detection, regional adaptation |
| GPT-4o | ✅ Good | Solid multilingual support |
| Claude 3.5 Sonnet | ⚠️ Limited | Less focus on African languages |

---

## Why Gemini 2.5 Flash Won

### Primary Reasons

1. **Native Swahili Support**: Google's multilingual model training includes extensive Swahili data, resulting in natural and culturally appropriate responses.

2. **Cost-Effectiveness**: At ~$0.02-0.05 per conversation vs $0.50-1.00+ for alternatives, Gemini enables high-volume deployments without budget concerns.

3. **Speed**: Flash variant optimized for low latency, critical for conversational UX.

4. **Integration**: Already on Google Cloud, minimal additional infrastructure needed.

### Secondary Benefits

- **Code-Switching**: Handles mixed Swahili/English ("Sheng") common in urban Kenya
- **Formal/Informal Registers**: Adapts tone appropriately for employment context
- **Job Terminology**: Correctly interprets Swahili occupational terms (Muuguzi, Mhasibu, etc.)

---

## Swahili Taxonomy Support

The following Swahili job terms have been added to support localization:

### Formal Jobs (10)
| Swahili | English |
|---------|---------|
| Muuguzi | Nurse |
| Dokta | Doctor |
| Mhasibu | Accountant / Bookkeeper |
| Karani | Clerk / Office worker |
| Mwal | Teacher |
| Makani | Engineer |
| Rubani | Pilot / Driver |
| Kiongozi | Leader / Manager |
| Mzoefu | Trainer / Coach |
| Muabiria | Passenger attendant / Tour guide |

### Informal Jobs (11)
| Swahili | English |
|---------|---------|
| Mchapa kazi | Laborer / General worker |
| Msukule kazi | Handyman / Odd jobs person |
| Muuzaji | Salesperson / Street vendor |
| Mwenye Duka | Small shop owner |
| Msee wa Mjengo | Builder / Mason |
| Mshonaji | Tailor / Seamstress |
| Watchie | Watchman / Security guard |
| Seremala | Carpenter |
| Mwanamuziki | Musician |
| Mchezaji | Player / Athlete / Performer |
| Mchukuaji mizigo | Porter / Loader |

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Model quality regression | Low | Monitor evaluation metrics, fallback to English |
| API availability | Low | Google Cloud SLA, retry logic in place |
| Cost increases | Low | Lock in pricing tier, monitor usage |
| Regional variations | Medium | Build synonym mapping for dialect differences |

---

## Next Steps (Milestone 3)

1. Configure Gemini 2.5 Flash API access in Vertex AI
2. Implement language detection at conversation start
3. Create Swahili prompt translations
4. Build synonym mapping module for job terms
5. Develop Swahili test cases for evaluation harness

---

## References

- [Google Gemini Supported Languages](https://cloud.google.com/gemini/docs/codeassist/supported-languages)
- [Vertex AI Pricing](https://cloud.google.com/vertex-ai/pricing)
- Kenya Epic 4 Plan: `docs/kenya-epic4-plan.md`
