// frontend/src/api/offlineApi.ts
import { checkServerConnection } from '../services/connectionCheck';
import offlineStorage from '../services/offlineStorage';

export interface ApiResponse<T> {
  data: T | null;
  offline: boolean;
  error?: string;
}

// Generic offline-aware API call wrapper
export async function offlineApiCall<T>(
  apiFn: () => Promise<{ data: T }>
): Promise<ApiResponse<T>> {
  // Check connection first
  const connected = await checkServerConnection();
  
  if (!connected) {
    return { 
      data: null, 
      offline: true, 
      error: 'Server unavailable' 
    };
  }
  
  try {
    const response = await apiFn();
    return { data: response.data, offline: false };
  } catch (err: unknown) {
    const error = err as { response?: { data?: { error?: string } } };
    return { 
      data: null, 
      offline: false, 
      error: error.response?.data?.error || 'Request failed' 
    };
  }
}

// Store order for later sync
export async function saveOrderOffline(orderData: {
  customerId?: number;
  guestName?: string;
  guestPhone?: string;
  totalAmount: number;
  discountAmount: number;
  status: string;
  paymentMethod: string;
  receiptType: string;
  items: { product_id: number; quantity: number }[];
}): Promise<{ success: boolean; orderId?: number }> {
  // Try online first
  const connected = await checkServerConnection();
  
  if (connected) {
    try {
      // Import dynamically to avoid circular deps
      const api = (await import('./axios')).default;
      const res = await api.post('/api/orders', orderData);
      return { success: true, orderId: res.data.order?.id };
    } catch {
      // Fall through to offline save
    }
  }
  
  // Save locally for later sync
  const localOrder = {
    id: Date.now(), // Temporary ID
    customerId: orderData.customerId,
    guestName: orderData.guestName,
    guestPhone: orderData.guestPhone,
    totalAmount: orderData.totalAmount,
    discountAmount: orderData.discountAmount,
    status: orderData.status,
    paymentMethod: orderData.paymentMethod,
    receiptType: orderData.receiptType,
    items: JSON.stringify(orderData.items),
    createdAt: new Date().toISOString(),
    synced: false,
  };
  
  offlineStorage.saveOrder(localOrder);
  return { success: true, orderId: localOrder.id };
}

export default {
  offlineApiCall,
  saveOrderOffline,
};