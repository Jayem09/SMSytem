import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, put, del } from '../api/axios';
import type { QueryParams } from '../types/api';
import { getIsOfflineMode } from '../context/AuthContext';
import offlineStorage from '../services/offlineStorage';

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

export function useBrandsQuery(params?: QueryParams) {
  return useQuery({
    queryKey: ['brands', params],
    queryFn: () => get('/api/brands', { params }).then(res => res.data),
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

export function useSuppliersQuery(params?: QueryParams) {
  return useQuery({
    queryKey: ['suppliers', params],
    queryFn: () => get('/api/suppliers', { params }).then(res => res.data),
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
    staleTime: 0, // Always refetch on branch change
    refetchOnWindowFocus: false,
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

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => post('/api/customers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => put(`/api/customers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => post('/api/categories', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => put(`/api/categories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useCreateBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => post('/api/brands', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
    },
  });
}

export function useUpdateBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => put(`/api/brands/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
    },
  });
}

export function usePOSData(branchId?: string) {
  // React Query handles caching - try online first, fallback to cache on error
  // POS is always branch-scoped. If no concrete branch is selected, do not fetch products.
  return useQuery({
    queryKey: ['pos', 'data', branchId],
    queryFn: async () => {
      const categories = offlineStorage.getCategories() as { id: number; name: string }[];
      const customers = offlineStorage.getCustomers();

      if (!branchId) {
        return {
          products: [],
          categories,
          customers,
        };
      }
      
      // Try online first
      if (!getIsOfflineMode()) {
        try {
          const [pRes, cRes, custRes] = await Promise.all([
            get(`/api/products?all=1&branch_id=${branchId}`),
            get('/api/categories'),
            get('/api/customers'),
          ]);
          
          const rawProducts = (pRes.data as { products?: unknown[] }).products 
            || (pRes.data as { data?: unknown[] }).data 
            || [];
          const categories = (cRes.data as { categories?: unknown[] }).categories || [];
          const rawCustomers = (custRes.data as { customers?: unknown[] }).customers || [];
          
          // Transform products to match POS format
          const products = (rawProducts as object[]).map((p) => {
            const prod = p as Record<string, unknown>;
            return {
              ...prod,
              branch_stock: Number(prod.branch_stock ?? 0),
              category: (categories as { id: number }[]).find((c) => c.id === prod.category_id) || null,
            };
          });
          
          // Deduplicate and save customers
          const uniqueCustomersMap = new Map<string, object>();
          (rawCustomers as object[]).forEach((c) => {
            const cust = c as Record<string, unknown>;
            const phone = String(cust.phone || '');
            if (phone && !uniqueCustomersMap.has(phone)) {
              uniqueCustomersMap.set(phone, {
                ...cust,
                rfidCardId: cust.rfid_card_id,
                loyaltyPoints: (cust.loyalty_points as number) ?? 0,
                synced: true,
              });
            }
          });
          const uniqueCustomers = Array.from(uniqueCustomersMap.values());
          
          // Cache for offline
          offlineStorage.saveProductsByBranch(branchId, products);
          offlineStorage.saveCategories(categories);
          offlineStorage.saveCustomers(uniqueCustomers);
          
          return {
            products,
            categories: categories as { id: number; name: string }[],
            customers: uniqueCustomers,
          };
        } catch (err) {
          console.warn('[usePOSData] API fetch failed, falling back to cache:', err);
          // Fall through to cache below
        }
      }
      
      // OFFLINE or API failed - load from cached storage
      const products = offlineStorage.getProductsByBranch(branchId);
      
      const productsWithCategory = products.map((p) => {
        const prod = p as Record<string, unknown>;
        return {
          ...prod,
          category: (categories as { id: number }[]).find((c) => c.id === prod.category_id) || null,
        };
      });
      
      return {
        products: productsWithCategory,
        categories,
        customers,
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// Function to find customer by RFID card (works offline!)
export function findCustomerByRfid(rfidCode: string) {
  const customers = offlineStorage.getCustomers();
  // Look for RFID match in cached customers
  return customers.find((c) => {
    const cust = c as Record<string, unknown>;
    return cust.rfid_card_id === rfidCode || cust.rfidCardId === rfidCode;
  });
}
