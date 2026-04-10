# Data Flow Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add TanStack Query for caching/optimistic updates, create standardized fetch hooks, add loading skeletons, and refactor POS state management

**Architecture:** TanStack Query provides caching/deduplication layer, useDataFetch provides consistent loading/error handling, usePOS reducer consolidates POS state

**Tech Stack:** React 19, TypeScript ~5.9, TanStack Query v5

---

## File Map

| File | Action |
|------|--------|
| `frontend/package.json` | Modify — re-add @tanstack/react-query |
| `frontend/src/lib/queryClient.ts` | Create — TanStack Query config |
| `frontend/src/App.tsx` | Modify — add QueryClientProvider |
| `frontend/src/hooks/useDataFetch.ts` | Create — consistent fetch hook |
| `frontend/src/components/Skeleton.tsx` | Create — loading skeleton |
| `frontend/src/hooks/useApi.ts` | Modify — add TanStack Query integration |
| `frontend/src/hooks/usePOS.ts` | Create — POS state reducer |
| `frontend/src/pages/Dashboard.tsx` | Modify — migrate to useDataFetch |
| `frontend/src/pages/Products.tsx` | Modify — migrate to useDataFetch |
| `frontend/src/pages/POS.tsx` | Modify — migrate to usePOS reducer |

---

## Tasks

### Task 1: Re-add TanStack Query

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Add @tanstack/react-query to dependencies**

Read `frontend/package.json`, then edit to add after existing dependencies:
```json
"@tanstack/react-query": "^5.94.5",
```

- [ ] **Step 2: Run npm install**

Run: `cd frontend && npm install`

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: re-add @tanstack/react-query for data fetching"
```

---

### Task 2: Create QueryClient Config

**Files:**
- Create: `frontend/src/lib/queryClient.ts`

- [ ] **Step 1: Create lib folder and queryClient.ts**

Create directory: `frontend/src/lib/`

Write to `frontend/src/lib/queryClient.ts`:
```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/
git commit -m "feat: add TanStack Query client config"
```

---

### Task 3: Add QueryClientProvider to App

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Update App.tsx imports**

Add after existing imports:
```typescript
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
```

- [ ] **Step 2: Wrap app with QueryClientProvider**

Wrap the `<AuthProvider>` content with `<QueryClientProvider>`:

```tsx
<QueryClientProvider client={queryClient}>
  <AuthProvider>
    <ToastProvider>
      {/* existing code */}
    </ToastProvider>
  </AuthProvider>
</QueryClientProvider>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: add QueryClientProvider to App"
```

---

### Task 4: Create useDataFetch Hook

**Files:**
- Create: `frontend/src/hooks/useDataFetch.ts`

- [ ] **Step 1: Create useDataFetch hook**

Write to `frontend/src/hooks/useDataFetch.ts`:
```typescript
import { useState, useEffect, useCallback } from 'react';
import type { ApiResponse } from '../types/api';

interface UseDataFetchOptions<T> {
  queryKey: string[];
  queryFn: () => Promise<ApiResponse<T>>;
  enabled?: boolean;
}

interface UseDataFetchResult<T> {
  data: T | null;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

export function useDataFetch<T>({
  queryKey,
  queryFn,
  enabled = true,
}: UseDataFetchOptions<T>): UseDataFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await queryFn();
      setData(response.data as T);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [queryFn, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useDataFetch.ts
git commit -m "feat: add useDataFetch hook for consistent data fetching"
```

---

### Task 5: Create Skeleton Component

**Files:**
- Create: `frontend/src/components/Skeleton.tsx`

- [ ] **Step 1: Create Skeleton component**

Write to `frontend/src/components/Skeleton.tsx`:
```typescript
interface SkeletonProps {
  variant?: 'text' | 'card' | 'table' | 'product';
  count?: number;
  className?: string;
}

const skeletonBase = 'animate-pulse bg-gray-200 rounded';

export function Skeleton({ variant = 'text', count = 1, className = '' }: SkeletonProps) {
  const variants = {
    text: 'h-4 w-full',
    card: 'h-32 w-full rounded-lg',
    table: 'h-12 w-full',
    product: 'h-24 w-full rounded-lg',
  };

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`${skeletonBase} ${variants[variant]} ${className}`}
        />
      ))}
    </>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      <Skeleton variant="text" className="w-3/4 mb-2" />
      <Skeleton variant="text" className="w-1/2 mb-4" />
      <Skeleton variant="text" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <Skeleton variant="table" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="table" />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Skeleton.tsx
git commit -m "feat: add Skeleton component for loading states"
```

---

### Task 6: Update useApi with TanStack Query

**Files:**
- Modify: `frontend/src/hooks/useApi.ts`

- [ ] **Step 1: Read current useApi.ts**

Read `frontend/src/hooks/useApi.ts`

- [ ] **Step 2: Add TanStack Query integration**

The current useApi.ts returns raw promises. Update it to return TanStack Query patterns. Add a separate file for query-based API:

Write to `frontend/src/hooks/useQueries.ts`:
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, put, del, patch } from '../api/axios';
import type { QueryParams } from '../types/api';

export function useProductsQuery(params?: QueryParams) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => get('/api/products', { params }).then(res => res.data),
  });
}

export function useCategoriesQuery(params?: QueryParams) {
  return useQuery({
    queryKey: ['categories', params],
    queryFn: () => get('/api/categories', { params }).then(res => res.data),
  });
}

export function useOrdersQuery(params?: QueryParams) {
  return useQuery({
    queryKey: ['orders', params],
    queryFn: () => get('/api/orders', { params }).then(res => res.data),
  });
}

export function useCustomersQuery(params?: QueryParams) {
  return useQuery({
    queryKey: ['customers', params],
    queryFn: () => get('/api/customers', { params }).then(res => res.data),
  });
}

export function useDashboardStats(days: number = 30, branchId?: string) {
  return useQuery({
    queryKey: ['dashboard', 'stats', days, branchId],
    queryFn: () => {
      const params: Record<string, string> = { days: days.toString() };
      if (branchId && branchId !== 'ALL') {
        params.branch_id = branchId;
      }
      return get('/api/dashboard', { params }).then(res => res.data);
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => post('/api/products', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => put(`/api/products/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del(`/api/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => post('/api/orders', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useQueries.ts
git commit -m "feat: add TanStack Query hooks for data fetching"
```

---

### Task 7: Create usePOS Reducer

**Files:**
- Create: `frontend/src/hooks/usePOS.ts`

- [ ] **Step 1: Create usePOS reducer**

Write to `frontend/src/hooks/usePOS.ts`:
```typescript
import { useReducer, useCallback } from 'react';

export interface Product {
  id: number;
  name: string;
  price: number;
  branch_stock: number;
  is_service?: boolean;
  category_id: number;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface POSState {
  products: Product[];
  categories: { id: number; name: string }[];
  customers: { id: number; name: string }[];
  cart: CartItem[];
  search: string;
  selectedCategory: number | null;
  loading: boolean;
  error: string | null;
}

type POSAction =
  | { type: 'SET_PRODUCTS'; payload: Product[] }
  | { type: 'SET_CATEGORIES'; payload: { id: number; name: string }[] }
  | { type: 'SET_CUSTOMERS'; payload: { id: number; name: string }[] }
  | { type: 'ADD_TO_CART'; payload: Product }
  | { type: 'REMOVE_FROM_CART'; payload: number }
  | { type: 'UPDATE_QUANTITY'; payload: { id: number; delta: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_CATEGORY'; payload: number | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET' };

const initialState: POSState = {
  products: [],
  categories: [],
  customers: [],
  cart: [],
  search: '',
  selectedCategory: null,
  loading: true,
  error: null,
};

function posReducer(state: POSState, action: POSAction): POSState {
  switch (action.type) {
    case 'SET_PRODUCTS':
      return { ...state, products: action.payload };
    case 'SET_CATEGORIES':
      return { ...state, categories: action.payload };
    case 'SET_CUSTOMERS':
      return { ...state, customers: action.payload };
    case 'ADD_TO_CART': {
      const existing = state.cart.find(item => item.id === action.payload.id);
      if (existing) {
        return {
          ...state,
          cart: state.cart.map(item =>
            item.id === action.payload.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          ),
        };
      }
      return { ...state, cart: [...state.cart, { ...action.payload, quantity: 1 }] };
    }
    case 'REMOVE_FROM_CART':
      return { ...state, cart: state.cart.filter(item => item.id !== action.payload) };
    case 'UPDATE_QUANTITY': {
      const { id, delta } = action.payload;
      return {
        ...state,
        cart: state.cart.map(item => {
          if (item.id === id) {
            const maxQty = item.is_service ? 999 : item.branch_stock;
            const newQty = Math.max(1, Math.min(item.quantity + delta, maxQty));
            return { ...item, quantity: newQty };
          }
          return item;
        }),
      };
    }
    case 'CLEAR_CART':
      return { ...state, cart: [] };
    case 'SET_SEARCH':
      return { ...state, search: action.payload };
    case 'SET_CATEGORY':
      return { ...state, selectedCategory: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

export function usePOS() {
  const [state, dispatch] = useReducer(posReducer, initialState);

  const addToCart = useCallback((product: Product) => {
    dispatch({ type: 'ADD_TO_CART', payload: product });
  }, []);

  const removeFromCart = useCallback((productId: number) => {
    dispatch({ type: 'REMOVE_FROM_CART', payload: productId });
  }, []);

  const updateQuantity = useCallback((productId: number, delta: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id: productId, delta } });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR_CART' });
  }, []);

  const subtotal = state.cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  return {
    state,
    dispatch,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    subtotal,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/usePOS.ts
git commit -m "feat: add usePOS reducer for POS state management"
```

---

### Task 8: Migrate Dashboard to useDataFetch

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Read current Dashboard.tsx**

Read `frontend/src/pages/Dashboard.tsx` to understand the current implementation.

- [ ] **Step 2: Update Dashboard imports**

Add:
```typescript
import { useDataFetch } from '../hooks/useDataFetch';
import { Skeleton, SkeletonCard } from '../components/Skeleton';
```

- [ ] **Step 3: Replace manual fetch with useDataFetch**

Replace the useEffect fetch with:
```typescript
const { data: statsData, isLoading } = useDataFetch({
  queryKey: ['dashboard', 'stats', timeRange, branchFilter],
  queryFn: () => api.get(`/api/dashboard?days=${timeRange}${isSuperAdmin && branchFilter !== 'ALL' ? `&branch_id=${branchFilter}` : ''}`),
});

useEffect(() => {
  if (statsData) {
    setStats(prev => ({
      ...prev,
      ...(statsData as Record<string, unknown>),
    }));
  }
}, [statsData]);
```

- [ ] **Step 4: Add skeleton loading state**

Replace loading spinner with:
```typescript
{isLoading ? (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    <SkeletonCard />
    <SkeletonCard />
    <SkeletonCard />
    <SkeletonCard />
  </div>
) : (
  // existing dashboard content
)}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx
git commit -m "refactor: migrate Dashboard to useDataFetch hook"
```

---

### Task 9: Migrate Products to useDataFetch

**Files:**
- Modify: `frontend/src/pages/Products.tsx`

- [ ] **Step 1: Read current Products.tsx**

- [ ] **Step 2: Update imports**

Add:
```typescript
import { useDataFetch } from '../hooks/useDataFetch';
import { SkeletonTable } from '../components/Skeleton';
```

- [ ] **Step 3: Replace manual fetches**

Replace the three useEffect calls with:
```typescript
const { data: productsData, isLoading: productsLoading, refetch: refetchProducts } = useDataFetch({
  queryKey: ['products', search, filterCategory, filterBrand],
  queryFn: () => api.get('/api/products', { params: { all: '1', search, category_id: filterCategory, brand_id: filterBrand } }),
});

const { data: categoriesData, refetch: refetchCategories } = useDataFetch({
  queryKey: ['categories'],
  queryFn: () => api.get('/api/categories'),
});

const { data: brandsData, refetch: refetchBrands } = useDataFetch({
  queryKey: ['brands'],
  queryFn: () => api.get('/api/brands'),
});

useEffect(() => {
  if (productsData) {
    const data = productsData as { products?: Product[] };
    setProducts(data.products || []);
  }
}, [productsData]);

useEffect(() => {
  if (categoriesData) {
    const data = categoriesData as { categories?: Category[] };
    setCategories(data.categories || []);
  }
}, [categoriesData]);

useEffect(() => {
  if (brandsData) {
    const data = brandsData as { brands?: Brand[] };
    setBrands(data.brands || []);
  }
}, [brandsData]);
```

- [ ] **Step 4: Add skeleton loading**

Replace loading spinner with `<SkeletonTable rows={10} />`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Products.tsx
git commit -m "refactor: migrate Products to useDataFetch hook"
```

---

### Task 10: Migrate POS to usePOS Reducer

**Files:**
- Modify: `frontend/src/pages/POS.tsx`

- [ ] **Step 1: Read current POS.tsx**

This is a large file (~935 lines). Focus on:
- State declarations (lines 67-103)
- fetchData function (lines 106-125)
- addToCart, removeFromCart, updateQuantity functions (lines 196-218)

- [ ] **Step 2: Update imports**

Add:
```typescript
import { usePOS } from '../hooks/usePOS';
```

- [ ] **Step 3: Replace state with usePOS**

Remove all the individual useState calls for:
- products, categories, customers, cart, search, selectedCategory, loading, error

Replace with:
```typescript
const { state, dispatch, addToCart, removeFromCart, updateQuantity, clearCart, subtotal } = usePOS();
const { products, categories, customers, cart, search, selectedCategory, loading, error } = state;
```

- [ ] **Step 4: Update fetchData function**

Replace with:
```typescript
useEffect(() => {
  const fetchData = async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      const [pRes, cRes, custRes] = await Promise.all([
        api.get('/api/products?all=1'),
        api.get('/api/categories'),
        api.get('/api/customers'),
      ]);
      dispatch({ type: 'SET_PRODUCTS', payload: (pRes.data as { products?: Product[] }).products || [] });
      dispatch({ type: 'SET_CATEGORIES', payload: (cRes.data as { categories?: { id: number; name: string }[] }).categories || [] });
      dispatch({ type: 'SET_CUSTOMERS', payload: (custRes.data as { customers?: { id: number; name: string }[] }).customers || [] });
    } catch {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to sync with inventory system.' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };
  fetchData();
}, []);
```

- [ ] **Step 5: Update addToCart**

Replace with:
```typescript
const handleAddToCart = (product: Product) => {
  addToCart(product);
};
```

- [ ] **Step 6: Update checkout to clear cart**

Replace `setCart([])` with `clearCart()`

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/POS.tsx
git commit -m "refactor: migrate POS to usePOS reducer"
```

---

### Task 11: Final Verification

- [ ] **Step 1: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run lint**

Run: `cd frontend && npm run lint`
Expected: No new errors (pre-existing ones OK)

- [ ] **Step 3: Run build**

Run: `cd frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Update GitNexus**

Run: `npx gitnexus analyze`
Expected: Index updated

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Re-add @tanstack/react-query |
| 2 | Create queryClient.ts |
| 3 | Add QueryClientProvider to App |
| 4 | Create useDataFetch hook |
| 5 | Create Skeleton component |
| 6 | Create useQueries with TanStack Query |
| 7 | Create usePOS reducer |
| 8 | Migrate Dashboard |
| 9 | Migrate Products |
| 10 | Migrate POS |
| 11 | Final verification |
