# UI Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform SMSytem UI from 7.5/10 to 10/10 with visual polish, UX enhancements, and modern patterns

**Architecture:** Update existing React/Tailwind components with consistent styling, animations, and modern UI patterns

**Tech Stack:** React 19, Tailwind CSS, Lucide React icons

---

### Task 1: Enhance Layout.tsx Sidebar & Header

**Files:**
- Modify: `frontend/src/components/Layout.tsx`

- [ ] **Step 1: Add sidebar polish**
  - Add hover transitions to nav items
  - Add active state with left border accent
  - Improve user profile section styling

```tsx
// Add to nav item className
className={({ isActive }) =>
  `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-200 hover:bg-gray-100 ${isActive
    ? 'bg-indigo-50 text-indigo-700 font-medium border-l-4 border-indigo-600'
    : 'text-gray-600'
  }`
}
```

- [ ] **Step 2: Enhance header**
  - Add subtle shadow
  - Improve GlobalSearch styling
  - Add user avatar placeholder

- [ ] **Step 3: Run build check**
Run: `cd frontend && npm run build 2>&1 | tail -10`
Expected: Build succeeds

---

### Task 2: Enhance DataTable.tsx

**Files:**
- Modify: `frontend/src/components/DataTable.tsx`

- [ ] **Step 1: Add hover transitions**
  - Row hover: bg-gray-50 transition-colors
  - Button hover: scale-105 with shadow

- [ ] **Step 2: Improve pagination**
  - Add hover states to page buttons
  - Improve page info text styling

- [ ] **Step 3: Improve empty state container**
  - Better padding and styling

---

### Task 3: Enhance Modal.tsx with Animation

**Files:**
- Modify: `frontend/src/components/Modal.tsx`

- [ ] **Step 1: Add backdrop blur**
```tsx
// Change backdrop to:
className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm"

// Add fade-in animation to modal content:
className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 animate-fade-in"
```

- [ ] **Step 2: Add animation keyframes to index.css**
```css
@keyframes fade-in {
  from { opacity: 0; transform: scale-0.95); }
  to { opacity: 1; transform: scale(1); }
}
.animate-fade-in {
  animation: fade-in 0.2s ease-out;
}
```

- [ ] **Step 3: Run build**

---

### Task 4: Enhance FormInputs.tsx

**Files:**
- Modify: `frontend/src/components/FormInputs.tsx`

- [ ] **Step 1: Improve label styling**
  - Add font-medium, text-gray-700
  - Better spacing

- [ ] **Step 2: Improve input focus states**
  - Add ring on focus
  - Better border colors

- [ ] **Step 3: Add floating label effect for select**
  - Visual polish

---

### Task 5: Enhance Toast.tsx

**Files:**
- Modify: `frontend/src/components/Toast.tsx`

- [ ] **Step 1: Improve toast positioning**
  - Bottom-right position with proper spacing
  - Add shadow-lg

- [ ] **Step 2: Add slide-in animation**
```css
@keyframes slide-in {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
```

- [ ] **Step 3: Add type-specific styling**
  - Success: emerald bg
  - Error: rose bg
  - Info: blue bg

---

### Task 6: Enhance Dashboard.tsx Stats Cards

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Add gradient backgrounds to stat cards**
```tsx
// Add gradient to card header div:
className={`p-3 rounded-2xl bg-gradient-to-br from-${card.color}-50 to-${card.color}-100 text-${card.color}-600`
```

- [ ] **Step 2: Add animated counter for values**
  - Use useEffect with setInterval for counting animation

- [ ] **Step 3: Improve chart styling**
  - Better gradient fill
  - Improved tooltip

---

### Task 7: Add Global CSS Enhancements

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Add animation utilities**
```css
@layer utilities {
  .transition-base { transition: all 0.2s ease-in-out; }
  .transition-slow { transition: all 0.3s ease-in-out; }
}
```

- [ ] **Step 2: Add scrollbar styling**
```css
/* Custom scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #f1f5f9; }
::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
```

---

### Task 8: Enhance Orders.tsx

**Files:**
- Modify: `frontend/src/pages/Orders.tsx`

- [ ] **Step 1: Add status badge styling**
  - Use StatusBadge component
  - Add transitions

- [ ] **Step 2: Improve action buttons**
  - Add hover scale effect
  - Better icon styling

---

### Task 9: Enhance POS.tsx

**Files:**
- Modify: `frontend/src/pages/POS.tsx`

- [ ] **Step 1: Improve product cards**
  - Add hover shadow-lg
  - Better border styling

- [ ] **Step 2: Enhance cart section**
  - Better dividers
  - Smooth transitions for adding items

---

### Task 10: Verify & Test

**Files:**
- All modified files

- [ ] **Step 1: Run lint**
Run: `cd frontend && npm run lint 2>&1 | head -20`
Expected: No new errors (pre-existing OK)

- [ ] **Step 2: Run typecheck**
Run: `cd frontend && npx tsc --noEmit 2>&1`
Expected: No errors

- [ ] **Step 3: Run build**
Run: `cd frontend && npm run build 2>&1 | tail -5`
Expected: Build succeeds

---

## Execution Options

**Plan complete and saved to `docs/superpowers/plans/2026-03-25-ui-overhaul.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
