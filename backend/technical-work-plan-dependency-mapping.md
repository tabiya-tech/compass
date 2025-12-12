# Technical Work Plan: Component Dependencies

**Project:** Compass - Kenya Job Market Taxonomy System  
**Milestone 1:** Database & Contextualization Pipeline

---

## System Architecture

```
                    Application Layer
                    (FastAPI + React)
                           │
                ┌──────────┼──────────┐
                │          │          │
                ▼          ▼          ▼
         Taxonomy DB  Labor Demand  ML Engine
```

---

## Database Relationships

```
occupations
    ├─ isco_group_code ────────┐
    ├─ mapped_to_esco_id ──────┼─→ Links KeSCO to ESCO
    │                          │
skills                         │
    ├─ skill_id                │
    │                          │
occupation_skill_relations     │
    ├─ occupation_id ──────────┘
    ├─ skill_id ───────────────→ FK to skills
    └─ inherited_from ─────────→ FK to ESCO occupation
         │
job_postings
    └─ matched_occupation_ids ─→ FK array to occupations
```

---

## Pipeline Dependency Chain

```
START
  │
  ├─→ [ESCO Occupations Import]
  │   └─→ Extract ISCO codes from OCCUPATIONGROUPCODE
  │       Populate: isco_group_code field
  │
  ├─→ [ESCO Skills Import] ──┐
  │                          │
  ├─→ [ESCO Relations Import]│
  │                          │
  └─→ [Build Lookups] ←──────┘
      ├─ Flat dict: {title: occupation}
      └─ Group dict: {isco_code: [occupations]}
           │
           ▼
  ┌─→ [Hierarchical Semantic Matcher]
  │   ├─ Group indices
  │   └─ Full catalog index
  │        │
  │        ▼
  └─→ [KeSCO Import]
      │
      For each KeSCO:
      ├─ Extract ISCO from code ("7314-11" → "7314")
      │
      ├─ Stage 0: Exact match in flat dict
      ├─ Stage 1: Semantic search within ISCO group
      └─ Stage 2: Semantic search full catalog
           │
           ├─→ [Auto-matched] → mapped_to_esco_id populated
           └─→ [No match] → Manual review queue
                │
                ▼
           [Skill Inheritance]
           Copy skills from ESCO to KeSCO via mapped_to_esco_id
                │
                ▼
           [Job Scrapers] ────────┐ (Parallel)
                │                 │
                ▼                 │
           [Job-Occupation Match] ├─→ Uses same hierarchical matcher
                │                 │
                └─────────────────┘
                │
                ▼
           [API Layer]
```

---

## Key Integration Points

**ISCO Extraction:**
```python
# ESCO: "ISCO08-2411" → "2411"
# KeSCO: "2411-12" → "2411"
isco_group_code = code.split("-")[0]
```

**Group-Based Lookup:**
```python
esco_group_lookup = {
    "2411": [accountant_occupations],
    "7311": [jewellery_occupations],
    ...
}
```

**Hierarchical Matching:**
```python
# Stage 1: Search within ISCO group only
group_occupations = esco_group_lookup[kesco_isco_group]
match = semantic_search(kesco_title, group_occupations)

# Stage 2: Fallback to full catalog
if not match:
    match = semantic_search(kesco_title, all_esco_occupations)
```

**Skill Inheritance:**
```python
# Copy skills from matched ESCO to KeSCO
kesco_occ = find_by_code("2411-12")
esco_skills = find_skills(kesco_occ.mapped_to_esco_id)
for skill in esco_skills:
    create_relation(kesco_occ.id, skill.id, source="inherited")
```

---
