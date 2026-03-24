# AGENTS.md - SMSytem Development Guide

This file provides context for agentic coding agents operating in this repository.

## Project Overview

SMSytem is a Tauri-based desktop application with:
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Backend**: External REST API (defaults to `http://168.144.46.137:8080`)
- **Desktop**: Tauri 2.x with Rust backend

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

# Development mode with Tauri
npm run tauri dev

# Build production executable
npm run tauri build

# Rust linting
cd src-tauri && cargo clippy
```

## Code Style Guidelines

### TypeScript

- TypeScript 5.9 (strict mode via `tsconfig.app.json`)
- Use explicit types for parameters and returns
- Use `type` for unions, `interface` for objects
- Avoid `any` - use `unknown` when needed

### ESLint

ESLint 9 with `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`. Run `npm run lint`. Ignores `dist`, `src-tauri/target`, `.vite`, `node_modules`.

### React Patterns

```tsx
// Imports: React → third-party → local → types
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../api/axios';
import type { ReactNode } from 'react';

// Component: hooks → callbacks → render
export default function MyComponent() {
  const [state, setState] = useState('');
  const handleClick = () => {};
  return <div>...</div>;
}
```

### Naming

- Files: PascalCase components (`Login.tsx`), camelCase utils (`axios.ts`)
- Components/Functions: PascalCase/camelCase
- Interfaces: PascalCase
- Constants: SCREAMING_SNAKE_CASE

### Tauri/Rust Guidelines

The desktop app uses Rust-side HTTP requests to bypass webview network restrictions:

```rust
// Rust command for GET requests
#[tauri::command]
async fn api_get(url: String) -> Result<ApiResponse, String> {
    let client = reqwest::Client::new();
    let response = client.get(&url).send().await?;
    let data = response.json().await?;
    Ok(ApiResponse { data, status: response.status().as_u16(), status_text: response.status().canonical_reason().unwrap_or("").to_string() })
}
```

- Always use `reqwest` in Rust commands for API calls, not JavaScript fetch
- Frontend uses `invoke` from `@tauri-apps/api/core` to call Rust commands
- See `frontend/src/api/axios.ts` for the TauriApi wrapper pattern

### Error Handling

```tsx
try {
  await login(email, password);
} catch (err: unknown) {
  const axiosError = err as { response?: { data?: { error?: string } } };
  showToast(axiosError.response?.data?.error || 'Login failed', 'error');
}
```

### API Integration

Use `api` from `src/api/axios.ts`. Bearer token via interceptor. Handle 401 (redirect to login). Backend URL via `VITE_API_BASE_URL`.

### State Management

- React Context for global state
- TanStack Query for server state
- `useState` for local, `useMemo` for derived

## File Organization

```
frontend/
├── src/
│   ├── api/          # Axios and API calls
│   ├── components/  # Reusable UI
│   ├── context/     # React Context
│   ├── hooks/       # Custom hooks
│   ├── pages/       # Page components
├── src-tauri/       # Rust backend
└── package.json
```

## Key Dependencies

- **UI**: React 19, Lucide React, Recharts
- **Data**: Axios, TanStack Query, XLSX
- **Routing**: React Router DOM 7
- **Tauri**: log, shell, http, updater plugins

## Common Tasks

### Adding a Page
1. Create `frontend/src/pages/PageName.tsx`
2. Add route in `App.tsx`
3. Add link in `Layout.tsx`

## Notes for Agents

- Backend defaults to `http://168.144.46.137:8080` - check if online
- Run `npm run lint` and `npx tsc --noEmit` before committing
- The webview blocks JavaScript fetch/XHR - always use Rust commands via `invoke` for HTTP
