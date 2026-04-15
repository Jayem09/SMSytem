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
  branchId?: number;
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

function parseStoredValue<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function getStoredArray<T>(key: string): T[] {
  const parsed = parseStoredValue<unknown>(localStorage.getItem(key), []);
  return Array.isArray(parsed) ? (parsed as T[]) : [];
}

function getStoredValue<T>(key: string, fallback: T): T {
  return parseStoredValue(localStorage.getItem(key), fallback);
}

// Storage keys for cached entities and sync timestamps.
// Dedicated queue state for the Sync Center lives in syncQueue.ts.
const STORAGE_KEYS = {
  USER: 'offline_user',
  ORDERS: 'offline_orders',
  CUSTOMERS: 'offline_customers',
  PRODUCTS: 'offline_products',
  CATEGORIES: 'offline_categories',
  LAST_SYNC: 'last_sync',
  PENDING_POINTS_ADJUSTMENTS: 'pending_points_adjustments',
};

const BRANCH_PRODUCT_KEY_PREFIX = 'offline_products_branch_';

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

function getOrders(): LocalOrder[] {
  return getStoredArray<LocalOrder>(STORAGE_KEYS.ORDERS);
}

function saveOrders(orders: LocalOrder[]): void {
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
}

function getCustomers(): LocalCustomer[] {
  return getStoredArray<LocalCustomer>(STORAGE_KEYS.CUSTOMERS);
}

function saveCustomers(customers: LocalCustomer[]): void {
  localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
}

function getProducts(): LocalProduct[] {
  return getStoredArray<LocalProduct>(STORAGE_KEYS.PRODUCTS);
}

function getProductsByBranch(branchKey: string): LocalProduct[] {
  return getStoredArray<LocalProduct>(`${BRANCH_PRODUCT_KEY_PREFIX}${branchKey}`);
}

function getCategories(): unknown[] {
  return getStoredArray<unknown>(STORAGE_KEYS.CATEGORIES);
}

function getPendingPointsAdjustments(): PendingPointsAdjustment[] {
  return getStoredArray<PendingPointsAdjustment>(STORAGE_KEYS.PENDING_POINTS_ADJUSTMENTS);
}

export const offlineStorage = {
  saveUser(user: LocalUser): void {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  },
  
  getUser(): LocalUser | null {
    return getStoredValue<LocalUser | null>(STORAGE_KEYS.USER, null);
  },
  
  clearUser(): void {
    localStorage.removeItem(STORAGE_KEYS.USER);
  },

  saveOrder(order: LocalOrder): void {
    const orders = getOrders();
    orders.push(order);
    saveOrders(orders);
  },
  
  getOrders(): LocalOrder[] {
    return getOrders();
  },
  
  saveOrders(orders: LocalOrder[]): void {
    saveOrders(orders);
  },
  
  getUnsyncedOrders(): LocalOrder[] {
    return getOrders().filter(o => !o.synced);
  },
  
  markOrderSynced(orderId: number): void {
    const orders = getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx >= 0) {
      orders[idx].synced = true;
      saveOrders(orders);
    }
  },

  markOrderSyncedByTimestamp(createdAt: string): void {
    const orders = getOrders();
    const matchingIndexes = orders
      .map((order, index) => ({ order, index }))
      .filter(({ order }) => order.createdAt === createdAt && !order.synced)
      .map(({ index }) => index);

    if (matchingIndexes.length === 1) {
      orders[matchingIndexes[0]].synced = true;
      saveOrders(orders);
    }
  },

  saveCustomers(customers: LocalCustomer[]): void {
    saveCustomers(customers);
  },

  getCustomers(): LocalCustomer[] {
    return getCustomers();
  },

  markCustomerSynced(customerId: number): void {
    const customers = getCustomers();
    const idx = customers.findIndex((customer) => customer.id === customerId);

    if (idx >= 0) {
      customers[idx].synced = true;
      saveCustomers(customers);
    }
  },

  // Save a single customer (for creating new offline customers)
  saveCustomer(customer: LocalCustomer): void {
    const customers = getCustomers();
    // Check if customer already exists
    const existingIdx = customers.findIndex(c => c.id === customer.id);
    if (existingIdx >= 0) {
      customers[existingIdx] = customer;
    } else {
      customers.push(customer);
    }
    saveCustomers(customers);
  },

  saveProducts(products: LocalProduct[]): void {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  },

  saveProductsByBranch(branchKey: string, products: LocalProduct[]): void {
    localStorage.setItem(`${BRANCH_PRODUCT_KEY_PREFIX}${branchKey}`, JSON.stringify(products));
  },
  
  getProducts(): LocalProduct[] {
    return getProducts();
  },

  getProductsByBranch(branchKey: string): LocalProduct[] {
    return getProductsByBranch(branchKey);
  },

  saveCategories(categories: unknown[]): void {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  },
  
  getCategories(): unknown[] {
    return getCategories();
  },

  setLastSync(timestamp: string): void {
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, timestamp);
  },
  
  getLastSync(): string | null {
    return localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
  },

  // Pending points adjustments for offline loyalty
  savePendingPointsAdjustment(adjustment: PendingPointsAdjustment): void {
    const pending = getPendingPointsAdjustments();
    pending.push(adjustment);
    localStorage.setItem(STORAGE_KEYS.PENDING_POINTS_ADJUSTMENTS, JSON.stringify(pending));
  },
  
  getPendingPointsAdjustments(): PendingPointsAdjustment[] {
    return getPendingPointsAdjustments();
  },
  
  clearPendingPointsAdjustments(): void {
    localStorage.removeItem(STORAGE_KEYS.PENDING_POINTS_ADJUSTMENTS);
  },
};

export default offlineStorage;
