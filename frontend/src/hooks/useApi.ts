import { get, post, put, del as remove, patch } from '../api/axios';
import type { QueryParams } from '../types/api';

export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  categoryId?: string;
  brandId?: string;
  supplierId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductInput {
  name: string;
  sku: string;
  price: number;
  quantity?: number;
  categoryId?: string;
  brandId?: string;
  supplierId?: string;
}

export interface Order {
  id: string;
  customerId?: string;
  total: number;
  status: 'pending' | 'completed' | 'cancelled';
  items: OrderItem[];
  createdAt?: string;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  createdAt?: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
}

export interface Brand {
  id: string;
  name: string;
  description?: string;
}

export interface Supplier {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

export const useApi = () => {
  return {
    auth: {
      login: (email: string, password: string) => post('/api/auth/login', { email, password }),
      register: (name: string, email: string, password: string) => post('/api/auth/register', { name, email, password }),
      me: () => get('/api/auth/me'),
    },
    products: {
      list: (params?: QueryParams) => get('/api/products', { params }),
      get: (id: string) => get(`/api/products/${id}`),
      create: (data: ProductInput) => post('/api/products', data),
      update: (id: string, data: Partial<ProductInput>) => put(`/api/products/${id}`, data),
      delete: (id: string) => remove(`/api/products/${id}`),
    },
    categories: {
      list: (params?: QueryParams) => get('/api/categories', { params }),
      get: (id: string) => get(`/api/categories/${id}`),
      create: (data: { name: string; description?: string }) => post('/api/categories', data),
      update: (id: string, data: Partial<{ name: string; description?: string }>) => put(`/api/categories/${id}`, data),
      delete: (id: string) => remove(`/api/categories/${id}`),
    },
    brands: {
      list: (params?: QueryParams) => get('/api/brands', { params }),
      get: (id: string) => get(`/api/brands/${id}`),
      create: (data: { name: string; description?: string }) => post('/api/brands', data),
      update: (id: string, data: Partial<{ name: string; description?: string }>) => put(`/api/brands/${id}`, data),
      delete: (id: string) => remove(`/api/brands/${id}`),
    },
    orders: {
      list: (params?: QueryParams) => get('/api/orders', { params }),
      get: (id: string) => get(`/api/orders/${id}`),
      create: (data: { customerId?: string; items: OrderItem[] }) => post('/api/orders', data),
      update: (id: string, data: Partial<Order>) => patch(`/api/orders/${id}`, data),
      delete: (id: string) => remove(`/api/orders/${id}`),
    },
    customers: {
      list: (params?: QueryParams) => get('/api/customers', { params }),
      get: (id: string) => get(`/api/customers/${id}`),
      create: (data: { name: string; email?: string; phone?: string }) => post('/api/customers', data),
      update: (id: string, data: Partial<{ name: string; email?: string; phone?: string }>) => put(`/api/customers/${id}`, data),
      delete: (id: string) => remove(`/api/customers/${id}`),
    },
    suppliers: {
      list: (params?: QueryParams) => get('/api/suppliers', { params }),
      get: (id: string) => get(`/api/suppliers/${id}`),
      create: (data: { name: string; email?: string; phone?: string }) => post('/api/suppliers', data),
      update: (id: string, data: Partial<{ name: string; email?: string; phone?: string }>) => put(`/api/suppliers/${id}`, data),
      delete: (id: string) => remove(`/api/suppliers/${id}`),
    },
    expenses: {
      list: (params?: QueryParams) => get('/api/expenses', { params }),
      get: (id: string) => get(`/api/expenses/${id}`),
      create: (data: { description: string; amount: number; category?: string }) => post('/api/expenses', data),
      update: (id: string, data: Partial<{ description: string; amount: number; category?: string }>) => put(`/api/expenses/${id}`, data),
      delete: (id: string) => remove(`/api/expenses/${id}`),
    },
    inventory: {
      get: () => get('/api/inventory'),
      adjust: (data: { productId: string; quantity: number; reason?: string }) => post('/api/inventory/adjust', data),
    },
    dashboard: {
      stats: () => get('/api/dashboard/stats'),
      recentOrders: () => get('/api/dashboard/recent-orders'),
    },
  };
};

export type ApiHooks = ReturnType<typeof useApi>;