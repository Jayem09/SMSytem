// frontend/src/services/offlineStorage.ts
// Types
export interface LocalUser {
  id: number;
  email: string;
  name: string;
  role: string;
  branchId: number;
  token: string;
}

export interface LocalOrder {
  id?: number;
  customerId?: number;
  customerName?: string;
  customerPhone?: string;
  guestName?: string;
  guestPhone?: string;
  totalAmount: number;
  discountAmount: number;
  status: string;
  paymentMethod: string;
  receiptType: string;
  tin?: string;
  businessAddress?: string;
  withholdingTaxRate?: number;
  serviceAdvisorName?: string;
  rewardId?: number | null;
  rewardPoints?: number;
  items: string;
  createdAt: string;
  synced: boolean;
}

export interface LocalCustomer {
  id?: number;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  rfidCardId?: string;
  loyaltyPoints?: number;
  synced: boolean;
}

interface PendingPointsAdjustment {
  customerId: number;
  points: number; // negative for deduction
  orderId: number;
  timestamp: string;
}

// Storage keys
const STORAGE_KEYS = {
  USER: 'offline_user',
  ORDERS: 'offline_orders',
  CUSTOMERS: 'offline_customers',
  PRODUCTS: 'offline_products',
  CATEGORIES: 'offline_categories',
  LAST_SYNC: 'last_sync',
};

export interface LocalProduct {
  id: number;
  name: string;
  description?: string;
  price: number;
  cost_price?: number;
  branch_stock: number;
  stock?: number;
  category_id: number;
  brand_id: number;
  image_url?: string;
  size?: string;
  is_service?: boolean;
  is_reward?: boolean;
  points_required?: number;
  category_name?: string;
  brand_name?: string;
}

export const offlineStorage = {
  saveUser(user: LocalUser): void {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  },
  
  getUser(): LocalUser | null {
    const data = localStorage.getItem(STORAGE_KEYS.USER);
    return data ? JSON.parse(data) : null;
  },
  
  clearUser(): void {
    localStorage.removeItem(STORAGE_KEYS.USER);
  },

  saveOrder(order: LocalOrder): void {
    const orders = this.getOrders();
    orders.push(order);
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  },
  
  getOrders(): LocalOrder[] {
    const data = localStorage.getItem(STORAGE_KEYS.ORDERS);
    return data ? JSON.parse(data) : [];
  },
  
  getUnsyncedOrders(): LocalOrder[] {
    return this.getOrders().filter(o => !o.synced);
  },
  
  markOrderSynced(orderId: number): void {
    const orders = this.getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx >= 0) {
      orders[idx].synced = true;
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    }
  },

  markOrderSyncedByTimestamp(createdAt: string): void {
    const orders = this.getOrders();
    const idx = orders.findIndex(o => o.createdAt === createdAt && !o.synced);
    if (idx >= 0) {
      orders[idx].synced = true;
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    }
  },

  saveCustomers(customers: LocalCustomer[]): void {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
  },

  getCustomers(): LocalCustomer[] {
    const data = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    return data ? JSON.parse(data) : [];
  },

  // Save a single customer (for creating new offline customers)
  saveCustomer(customer: LocalCustomer): void {
    const customers = this.getCustomers();
    // Check if customer already exists
    const existingIdx = customers.findIndex(c => c.id === customer.id);
    if (existingIdx >= 0) {
      customers[existingIdx] = customer;
    } else {
      customers.push(customer);
    }
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
  },

  saveProducts(products: LocalProduct[]): void {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  },
  
  getProducts(): LocalProduct[] {
    const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    return data ? JSON.parse(data) : [];
  },

  saveCategories(categories: unknown[]): void {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  },
  
  getCategories(): unknown[] {
    const data = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    return data ? JSON.parse(data) : [];
  },

  setLastSync(timestamp: string): void {
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, timestamp);
  },
  
  getLastSync(): string | null {
    return localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
  },

  // Pending points adjustments for offline loyalty
  savePendingPointsAdjustment(adjustment: PendingPointsAdjustment): void {
    const pending = this.getPendingPointsAdjustments();
    pending.push(adjustment);
    localStorage.setItem('pending_points_adjustments', JSON.stringify(pending));
  },
  
  getPendingPointsAdjustments(): PendingPointsAdjustment[] {
    const data = localStorage.getItem('pending_points_adjustments');
    return data ? JSON.parse(data) : [];
  },
  
  clearPendingPointsAdjustments(): void {
    localStorage.removeItem('pending_points_adjustments');
  },
};

export default offlineStorage;
