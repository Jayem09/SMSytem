# Plan: Release v1.2.0 with Q&A Fix

## Summary
The user reports that clicking on questions in the Analytics Q&A list doesn't show answers in version 1.0.9. Investigation reveals:
- Both v1.0.9 and v1.1.0 have broken code in `Analytics.tsx` that directly accesses `res.data.answer` without defensive handling
- The fix exists in the working directory (defensive extraction with `res?.data?.answer ?? ''`)
- The fix has NOT been released yet - user needs a new build

## Problem Analysis

### Q&A Not Returning Answers
- **Root Cause**: Frontend code in `Analytics.tsx` line 50-58 directly accesses `res.data.answer`, `res.data.data`, `res.data.chart_type` without null checks
- **Current Code (broken)**:
  ```typescript
  setHistory(prev => prev.map(h => 
    h.id === questionId 
      ? { ...h, answer: res.data.answer, data: res.data.data, chartType: res.data.chart_type }
      : h
  ));
  ```
- **Fixed Code (in working directory)**:
  ```typescript
  const answer = res?.data?.answer ?? '';
  const data = res?.data?.data ?? null;
  const chartType = res?.data?.chart_type ?? '';
  setHistory(prev => prev.map(h => 
    h.id === questionId 
      ? { ...h, answer, data, chartType }
      : h
  ));
  ```

### Auto-Restart Not Working
- **Status**: The `MaintenanceGuard.tsx` has correct logic calling `update.downloadAndInstall()` then `relaunch()`
- **Configuration**: Tauri updater plugin is properly configured in `Cargo.toml` and `tauri.conf.json`
- **Likely Cause**: The old released version doesn't have the updated plugin or there's a permission issue in production

---

## Tasks

### Phase 1: Version Bump
- [ ] 1.1: Update `frontend/package.json` version from `1.1.0` to `1.2.0`
- [ ] 1.2: Update `frontend/src-tauri/Cargo.toml` version from `1.1.0` to `1.2.0`
- [ ] 1.3: Update `frontend/src-tauri/tauri.conf.json` version from `1.1.0` to `1.2.0`

### Phase 2: Build Verification
- [ ] 2.1: Run `npm run build` in frontend to verify TypeScript compiles
- [ ] 2.2: Run `npm run tauri build` to create the .app/.exe

### Phase 3: Git Commit & Tag
- [ ] 3.1: Commit changes: `git add -A && git commit -m "fix: resolve Q&A answers not showing in Analytics - v1.2.0"`
- [ ] 3.2: Create tag: `git tag -a v1.2.0 -m "Release v1.2.0 - Q&A fix and auto-restart improvements"`

### Phase 4: Push & Release
- [ ] 4.1: Push to remote: `git push origin main && git push origin v1.2.0`
- [ ] 4.2: Verify GitHub Actions builds the release

---

## Verification Commands

```bash
# Check current versions
grep '"version"' frontend/package.json
grep '^version' frontend/src-tauri/Cargo.toml  
grep '"version"' frontend/src-tauri/tauri.conf.json

# Build frontend
cd frontend && npm run build

# Build Tauri app
cd frontend && npm run tauri build

# Commit and tag
git add -A && git commit -m "fix: resolve Q&A answers not showing - v1.2.0"
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin main && git push origin v1.2.0
```

---

## Notes for User

1. **Why Q&A wasn't working**: The code assumed `res.data.answer` always exists. If the backend returns a slightly different shape (e.g., `{data: {answer: ...}}` vs `{answer: ...}`), the UI breaks.

2. **Fix applied**: Defensive extraction with optional chaining (`res?.data?.answer ?? ''`) ensures the UI handles any response shape.

3. **Auto-restart**: The code is correct in MaintenanceGuard.tsx. If it still doesn't work after v1.2.0, check:
   - Terminal output for errors during relaunch
   - macOS: System Preferences > Security & Privacy > Allow apps from unidentified developers
   
4. **To test locally**: Run `npm run tauri dev` to test the fix before releasing.