# AGENTS.md - SMSytem Development Guide

This file provides context for agentic coding agents operating in this repository.

## Project Overview

SMSytem is a Tauri-based desktop application with:
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Backend**: External REST API (defaults to `http://168.144.46.137:8080`)
- **Desktop**: Tauri 2.x with Rust backend
- **Testing**: Playwright (e2e), no unit tests currently

## Build Commands

### Frontend (React)

```bash
cd frontend

# Development server (port 5173)
npm run dev

# Type checking
npx tsc --noEmit

# Production build
npm run build

# Lint code
npm run lint
```

### Tauri Desktop App

```bash
cd frontend
npm run tauri dev     # Development mode (opens desktop window)
npm run tauri build   # Production executable
```

### Running Tests

```bash
# Playwright e2e tests (from root)
npx playwright test

# Run specific test file
npx playwright test tests/login.spec.ts

# Run with UI (headed mode)
npx playwright test --headed
```

## Code Style Guidelines

### TypeScript

- TypeScript ~5.9 with Vite configuration
- Relaxed strict mode (not fully strict - see `tsconfig.app.json`)
- Use `type` for unions, `interface` for objects
- Avoid `any` - use `unknown` for untyped catch blocks
- Use `erasableSyntaxOnly: true` (no private keyword, use `#` fields)

### Imports Order

```tsx
// 1. React → 2. Third-party → 3. Local → 4. Types
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../api/axios';
import type { User } from '../types';
```

### Component Structure

```tsx
// Hooks → state → callbacks → render
export default function MyComponent() {
  const [state, setState] = useState('');
  const navigate = useNavigate();

  const handleClick = () => navigate('/dashboard');

  return <button onClick={handleClick}>Click</button>;
}
```

### Tailwind CSS

- Use utility classes: `flex`, `gap-4`, `p-4`, `rounded-lg`, `bg-white`
- Dark mode: use `dark:` prefix

### Naming Conventions

- Files: PascalCase components, camelCase utils
- Interfaces: PascalCase
- Constants: SCREAMING_SNAKE_CASE

### Error Handling

```tsx
try {
  await login(email, password);
} catch (err: unknown) {
  const axiosError = err as { response?: { data?: { error?: string } } };
  showToast(axiosError.response?.data?.error || 'Login failed', 'error');
}
```

### Tauri/Rust

Webview blocks JS fetch/XHR - always use Rust commands via `invoke`. Use `reqwest` in Rust. Commands go in `src-tauri/src/lib.rs`. See `frontend/src/api/axios.ts` for wrapper pattern.

### API Integration

Use `api` from `src/api/axios.ts` (pre-configured with interceptors). Bearer token via auth interceptor. Handle 401 (redirect to login). Backend URL via `VITE_API_BASE_URL`.

### State Management

- React Context: global state (AuthContext, ToastContext)
- TanStack Query: server state, caching
- `useState`: local state, `useMemo`: derived values

## File Organization

```
frontend/src/
├── api/         # Axios, API calls
├── components/ # Reusable UI
├── context/    # React Context
├── hooks/      # Custom hooks
├── pages/      # Page components
├── types/      # TypeScript interfaces
└── App.tsx     # Routes
```

## Key Dependencies

- **UI**: React 19, Lucide React (icons), Recharts
- **Data**: Axios, TanStack Query, XLSX
- **Routing**: React Router DOM 7
- **Tauri**: log, shell, http, updater plugins

## Common Tasks

### Adding a Page
1. Create `frontend/src/pages/PageName.tsx`
2. Add route in `App.tsx`
3. Add link in `Layout.tsx`

### Adding API Endpoint
1. Add function in `api/*.ts`
2. Use `api.post()` or `api.get()` with typing
3. Handle errors with try/catch

## Notes for Agents

- Backend defaults to `http://168.144.46.137:8080` - check if online
- Run `npm run lint` and `npx tsc --noEmit` before committing
- Use `showToast()` from ToastContext for user feedback

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **SMSytem** (1816 symbols, 4272 relationships, 150 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/SMSytem/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/SMSytem/context` | Codebase overview, check index freshness |
| `gitnexus://repo/SMSytem/clusters` | All functional areas |
| `gitnexus://repo/SMSytem/processes` | All execution flows |
| `gitnexus://repo/SMSytem/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
