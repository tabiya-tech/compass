# Gemini 2.5 Flash Integration Checklist for Milestone 3

## Overview

This checklist outlines the requirements for integrating Gemini 2.5 Flash for Swahili language support in Milestone 3.

---

## Pre-Integration Requirements

### Google Cloud Setup

- [ ] **Vertex AI API Enabled**
  - Project: [Your GCP Project ID]
  - Region: us-central1 (or closest to Kenya)
  - Console: https://console.cloud.google.com/vertex-ai

- [ ] **Gemini 2.5 Flash Model Access**
  - Model ID: `gemini-2.5-flash`
  - Verify access in Vertex AI Model Garden
  - Reference: https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/gemini

- [ ] **Service Account Configured**
  - Service account with `Vertex AI User` role
  - Key file generated and secured
  - Path stored in environment variable

- [ ] **Quotas Verified**
  - Check requests per minute limits
  - Check tokens per minute limits
  - Request quota increase if needed for production

### Authentication

- [ ] **Application Default Credentials (ADC)**
  ```bash
  gcloud auth application-default login
  ```

- [ ] **Service Account Key (Production)**
  ```bash
  export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"
  ```

---

## Environment Configuration

### Required Environment Variables

Add to `.env` file:

```bash
# Gemini Configuration for Swahili Support
GEMINI_MODEL=gemini-2.5-flash
GEMINI_REGION=us-central1
GEMINI_PROJECT_ID=your-project-id

# Optional: Override for testing
GEMINI_TEMPERATURE=0.3
GEMINI_MAX_OUTPUT_TOKENS=2048

# Language Settings
DEFAULT_LANGUAGE=en
SUPPORTED_LANGUAGES=en,sw
```

### Configuration Validation Script

```python
# scripts/validate_gemini_config.py
import os
from google.cloud import aiplatform

def validate_gemini_setup():
    required_vars = [
        "GEMINI_MODEL",
        "GEMINI_REGION", 
        "GEMINI_PROJECT_ID"
    ]
    
    missing = [v for v in required_vars if not os.getenv(v)]
    if missing:
        raise ValueError(f"Missing env vars: {missing}")
    
    # Test connection
    aiplatform.init(
        project=os.getenv("GEMINI_PROJECT_ID"),
        location=os.getenv("GEMINI_REGION")
    )
    print("✅ Gemini configuration validated")

if __name__ == "__main__":
    validate_gemini_setup()
```

---

## Code Integration Points

### Files to Modify

1. **LLM Caller Configuration**
   - `backend/common_libs/llm/generative_models.py`
   - Add Gemini 2.5 Flash model variant
   - Implement language-based model selection

2. **Language Detection**
   - `backend/app/i18n/language_detector.py` (create)
   - Detect language at conversation start
   - Support explicit language selection

3. **Prompt Translation**
   - `backend/app/agent/prompt_template/` files
   - Add Swahili variants for all prompts
   - Use i18n system for prompt selection

4. **Conversation Service**
   - `backend/app/conversations/service.py`
   - Add language parameter to session
   - Route to appropriate model based on language

### New Files to Create

```
backend/
├── app/
│   ├── i18n/
│   │   ├── language_detector.py      # Language detection logic
│   │   └── swahili_prompts.py        # Swahili prompt translations
│   └── agent/
│       └── prompt_template/
│           └── sw/                    # Swahili prompt variants
│               ├── collect_experiences.py
│               └── explore_skills.py
```

---

## API Rate Limits & Quotas

### Gemini 2.5 Flash Limits (Default)

| Metric | Limit | Notes |
|--------|-------|-------|
| Requests per minute | 60 | Per project |
| Tokens per minute | 60,000 | Input + Output |
| Max context length | 1M tokens | Very generous |
| Max output tokens | 8,192 | Per request |

### Recommended Settings for Production

```python
GEMINI_CONFIG = {
    "max_retries": 3,
    "retry_delay_seconds": 1,
    "timeout_seconds": 30,
    "rate_limit_buffer": 0.8,  # Use 80% of quota
}
```

---

## Cost Monitoring

### Pricing (as of Jan 2026)

| Tier | Input (per 1M tokens) | Output (per 1M tokens) |
|------|----------------------|------------------------|
| Standard | $0.075 | $0.30 |
| Batch | $0.0375 | $0.15 |

### Budget Alerts

Set up in Google Cloud Console:
- [ ] Alert at 50% of monthly budget
- [ ] Alert at 80% of monthly budget
- [ ] Hard cap at 100% (optional)

### Estimated Monthly Costs

| Scenario | Conversations/Month | Est. Cost |
|----------|---------------------|-----------|
| Development | 1,000 | ~$30-50 |
| Pilot | 10,000 | ~$300-500 |
| Production | 100,000 | ~$3,000-5,000 |

---

## Testing Requirements

### Unit Tests

- [ ] Test Gemini API connection
- [ ] Test language detection accuracy
- [ ] Test Swahili prompt rendering
- [ ] Test error handling for API failures

### Integration Tests

- [ ] End-to-end Swahili conversation flow
- [ ] Language switching mid-conversation
- [ ] Code-switching (mixed Swahili/English) handling
- [ ] Fallback to English on errors

### Evaluation Tests

- [ ] Swahili golden transcripts (create in M3)
- [ ] Skill extraction accuracy in Swahili
- [ ] Response quality assessment

---

## Rollout Plan

### Phase 1: Development (Week 1)
- [ ] Configure Gemini API access
- [ ] Implement language detection
- [ ] Create basic Swahili prompts

### Phase 2: Testing (Week 2)
- [ ] Run Swahili evaluation tests
- [ ] Compare quality to English baseline
- [ ] Fix identified issues

### Phase 3: Pilot (Week 3)
- [ ] Deploy to staging environment
- [ ] Limited user testing
- [ ] Gather feedback

### Phase 4: Production (Week 4)
- [ ] Full deployment
- [ ] Monitor metrics
- [ ] Iterate based on feedback

---

## Blockers Check

Before starting M3, verify:

- [ ] GCP project has Vertex AI enabled
- [ ] Budget approved for API costs
- [ ] Swahili taxonomy finalized (21 terms added in M1)
- [ ] English baseline metrics documented (M2)
- [ ] Team familiar with Gemini API

---

## References

- [Vertex AI Gemini API](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/gemini)
- [Gemini Pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing)
- [Supported Languages](https://cloud.google.com/gemini/docs/codeassist/supported-languages)
- Model Selection Rationale: `docs/swahili-model-selection.md`
- Kenya Epic 4 Plan: `docs/kenya-epic4-plan.md`
