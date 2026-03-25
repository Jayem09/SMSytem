# Plan: Fix .gitignore

## Task
Add missing entries to .gitignore to stop tracking unnecessary files.

## Steps

1. **Add to end of `.gitignore`** (create new section):
```gitignore

# Node/npm (root level - should not be committed)
node_modules/
package-lock.json
package.json

# Sisyphus (planning artifacts)
.sisyphus/
```

2. **Verify fix**:
```bash
git status
```
Should show 0 (clean) or only the files you actually want to commit.

## Expected Result
- Source control shows 0 changes (clean)
- node_modules/, package.json, package-lock.json, .sisyphus/ are ignored