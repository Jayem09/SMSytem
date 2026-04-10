import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, put, del } from '../api/axios';
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
