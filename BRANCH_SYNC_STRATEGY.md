# Branch Sync & PR Feedback Strategy

## Current Situation

**Branch Structure:**
```
main
  └── feat/epic2-adaptive-preference-elicitation (Epic 2 - PR under review)
       └── feat/epic3-recommender-agent (Epic 3 - current branch)
```

**Key Point:** Epic 3 branched from Epic 2 at commit `16efc527`, so Epic 3 contains all Epic 2 changes plus additional Epic 3 work.

---

## Strategy Overview

**Two-Phase Approach:**

1. **Phase 1:** Fix Epic 2 PR feedback on `feat/epic2-adaptive-preference-elicitation` branch
2. **Phase 2:** Rebase Epic 3 onto the cleaned Epic 2 branch

This keeps commit history clean and ensures Epic 3 gets all Epic 2 improvements.

---

## Detailed Implementation Plan

### **Phase 1: Address Epic 2 PR Feedback**

**Step 1.1 - Switch to Epic 2 branch:**
```bash
git checkout feat/epic2-adaptive-preference-elicitation
```

**Step 1.2 - Create fixup commits for each concern:**

The PR feedback involves:
1. Clarify/remove `offline_output/` folder
2. Condense README
3. Remove `agent.py.backup` file
4. Rename folders (like `epic1/`)
5. Replace epic references in comments with clear logic explanations
6. Reorganize test files

**Approach:** Create focused commits for each category:
```bash
# Commit 1: Remove unnecessary artifacts
git commit -m "chore(epic2): remove backup files and clarify offline_output usage"

# Commit 2: Improve documentation
git commit -m "docs(epic2): condense README for clarity"

# Commit 3: Improve folder structure
git commit -m "refactor(epic2): rename folders for better clarity"

# Commit 4: Improve code comments
git commit -m "docs(epic2): replace epic references with descriptive comments"

# Commit 5: Reorganize tests
git commit -m "refactor(epic2): reorganize test files per project standards"
```

**Step 1.3 - Push Epic 2 changes:**
```bash
git push fork feat/epic2-adaptive-preference-elicitation
```

---

### **Phase 2: Sync Epic 3 with Updated Epic 2**

**Step 2.1 - Switch to Epic 3 branch:**
```bash
git checkout feat/epic3-recommender-agent
```

**Step 2.2 - Rebase onto updated Epic 2:**
```bash
# Rebase Epic 3 onto the updated Epic 2 branch
git rebase feat/epic2-adaptive-preference-elicitation
```

**Step 2.3 - Resolve any conflicts:**
- If conflicts arise (unlikely since Epic 2 changes are refactoring), resolve them
- Continue rebase: `git rebase --continue`

**Step 2.4 - Force push Epic 3 (rewrites history):**
```bash
# Force push since rebase rewrites history
git push fork feat/epic3-recommender-agent --force-with-lease
```

---

## Benefits of This Strategy

1. **Clean Commit History:** Each PR feedback item gets its own commit
2. **No Merge Commits:** Rebase keeps history linear
3. **Epic 3 Automatically Gets Fixes:** Rebase propagates all Epic 2 improvements to Epic 3
4. **Easy to Review:** Focused commits make code review straightforward
5. **Safe Force Push:** `--force-with-lease` prevents overwriting others' work

---

## Alternative: Interactive Rebase (If Preferred)

If you want to squash the fixup commits into the original Epic 2 commits for a cleaner history:

```bash
# On Epic 2 branch
git rebase -i <commit-before-epic2-work>

# Mark fixup commits as 'fixup' or 'squash'
# This rewrites history more cleanly but is more complex
```

**Note:** This approach requires force-pushing both branches and careful coordination.

---

## Risk Mitigation

**Before Starting:**
```bash
# Create backup branches
git branch backup-epic2 feat/epic2-adaptive-preference-elicitation
git branch backup-epic3 feat/epic3-recommender-agent
```

**If Something Goes Wrong:**
```bash
# Restore from backup
git reset --hard backup-epic3
```

---

## Recommended Workflow

**Recommendation: Use Phase 1 & 2 approach (focused commits + rebase)** because:

- ✅ Preserves clear audit trail of PR feedback responses
- ✅ Simpler than interactive rebase
- ✅ Easy to understand what changed and why
- ✅ Automatically syncs Epic 3

---

## Next Steps

1. Create backup branches for safety
2. Switch to Epic 2 branch
3. Address each PR feedback item with focused commits
4. Push Epic 2 updates
5. Rebase Epic 3 onto updated Epic 2
6. Force push Epic 3 with `--force-with-lease`

---

## PR Feedback Items to Address

### 1. offline_output/ folder
- **Issue:** Contains large files that may be generated artifacts
- **Action:** Clarify purpose or add to .gitignore if they're build artifacts

### 2. README condensation
- **Issue:** Too long and detailed, may contain technical frustration
- **Action:** Condense to core usage and setup, move detailed docs elsewhere

### 3. agent.py.backup file
- **Issue:** Backup files unnecessary with Git version control
- **Action:** Remove backup file

### 4. Folder naming (epic1/, etc.)
- **Issue:** Names like "epic1" don't communicate purpose
- **Action:** Rename to descriptive names (e.g., "mock_dependencies", "test_data")

### 5. Epic references in comments
- **Issue:** Comments reference "epic(1,2)" instead of explaining logic
- **Action:** Replace with clear explanations of actual functionality

### 6. Test organization
- **Issue:** Tests need proper isolation
- **Action:**
  - Unit tests: Keep with code they test
  - Evaluation tests: Move to `/backend/evaluation_tests`

---

**Last Updated:** 2026-01-26
**Created By:** Claude Code
**Purpose:** Guide for syncing Epic 2 and Epic 3 branches while addressing PR feedback
