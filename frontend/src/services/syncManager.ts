// frontend/src/services/syncManager.ts
import { post as apiPost } from '../api/axios';
import offlineStorage from './offlineStorage';
import { checkServerConnection } from './connectionCheck';
import { setOfflineMode } from '../context/AuthContext';

const SYNC_INTERVAL = 30000; // 30 seconds

// Simple state (not React ref - works in services)
export const isOnline = { value: true };
export const isSyncing = { value: false };
export const lastSyncTime = { value: null as string | null };

// Store callbacks for online/offline events
const onlineCallbacks: Set<() => void> = new Set();

export function subscribeToOnlineStatus(callback: () => void): () => void {
  onlineCallbacks.add(callback);
  return () => onlineCallbacks.delete(callback);
}

function notifyOnlineStatusChange() {
  onlineCallbacks.forEach(cb => cb());
}

export async function syncOrders(): Promise<{ success: boolean; error?: string }> {
  try {
    const unsyncedOrders = offlineStorage.getUnsyncedOrders();
    
    if (unsyncedOrders.length === 0) {
      return { success: true };
    }
    
    let syncedCount = 0;
    for (const order of unsyncedOrders) {
      try {
        // Parse the stored items to get product_id + quantity for the API
        const parsedItems = JSON.parse(order.items) as Array<{ product_id: number; quantity: number }>;
        
        // Build the correct checkoutInput payload the backend expects
        const payload: Record<string, unknown> = {
          customer_id: order.customerId || null,
          guest_name: order.guestName || '',
          guest_phone: order.guestPhone || '',
          service_advisor_name: order.serviceAdvisorName || '',
          payment_method: order.paymentMethod,
          discount_amount: order.discountAmount || 0,
          receipt_type: order.receiptType || 'SI',
          tin: order.tin || '',
          business_address: order.businessAddress || '',
          withholding_tax_rate: order.withholdingTaxRate || 0,
          items: parsedItems.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
          })),
        };

        // Only include reward fields if a reward was redeemed
        if (order.rewardId) {
          payload.reward_id = order.rewardId;
          payload.reward_points = order.rewardPoints || 0;
        }
        
        const response = await apiPost('/api/orders', payload);
        
        // Ensure the API call actually succeeded (200 or 201) before marking as synced
        if (response && response.status >= 400) {
          console.error(`[SyncOrders] Server rejected order ${order.createdAt}:`, response.data);
          // Don't mark as synced so we can retry or investigate
          continue;
        }

        // Mark by createdAt since offline orders have no real id
        offlineStorage.markOrderSyncedByTimestamp(order.createdAt);
        syncedCount++;
        console.log(`[SyncOrders] Synced offline order from ${order.createdAt}`);
      } catch (err) {
        console.error('[SyncOrders] Failed to sync order:', order.createdAt, err);
      }
    }
    
    if (syncedCount > 0) {
      lastSyncTime.value = new Date().toISOString();
      offlineStorage.setLastSync(lastSyncTime.value);
      console.log(`[SyncOrders] Successfully synced ${syncedCount}/${unsyncedOrders.length} orders`);
    }
    return { success: true };
  } catch (err: unknown) {
    const error = err as { message?: string };
    return { success: false, error: error.message };
  }
}

export async function syncCustomers(): Promise<{ success: boolean; error?: string }> {
  try {
    const localCustomers = offlineStorage.getCustomers();
    // Only sync customers created offline (synced: false)
    const unsyncedCustomers = localCustomers.filter(c => !c.synced);
    
    if (unsyncedCustomers.length === 0) {
      return { success: true };
    }

    let syncedCount = 0;
    for (const customer of unsyncedCustomers) {
      try {
        // Build the payload matching backend's customerInput struct
        const payload = {
          name: customer.name,
          phone: customer.phone || '',
          email: customer.email || '',
          address: customer.address || '',
          rfid_card_id: customer.rfidCardId || '',
          loyalty_points: customer.loyaltyPoints || (customer as any).loyalty_points || 0,
        };

        const response = await apiPost('/api/customers', payload);
        
        if (response && response.status >= 400) {
          console.error(`[SyncCustomers] Server rejected customer ${customer.name}:`, response.data);
          continue;
        }
        
        // Mark this customer as synced in local storage
        const allCustomers = offlineStorage.getCustomers();
        const idx = allCustomers.findIndex(c => 
          c.name === customer.name && c.phone === customer.phone && !c.synced
        );
        if (idx >= 0) {
          allCustomers[idx].synced = true;
          offlineStorage.saveCustomers(allCustomers);
        }
        syncedCount++;
        console.log(`[SyncCustomers] Synced offline customer: ${customer.name}`);
      } catch (err) {
        console.error('[SyncCustomers] Failed to sync customer:', customer.name, err);
      }
    }
    
    if (syncedCount > 0) {
      console.log(`[SyncCustomers] Successfully synced ${syncedCount}/${unsyncedCustomers.length} customers`);
    }
    return { success: true };
  } catch (err: unknown) {
    const error = err as { message?: string };
    return { success: false, error: error.message };
  }
}

export async function performFullSync(): Promise<{ success: boolean; error?: string }> {
  if (isSyncing.value) return { success: false, error: 'Already syncing' };
  
  isSyncing.value = true;
  
  try {
    console.log('[FullSync] Starting full sync...');
    
    // 1. Sync orders first (backend handles points earn/redeem within order creation)
    const orderResult = await syncOrders();
    console.log('[FullSync] Orders sync:', orderResult.success ? 'OK' : orderResult.error);
    
    // 2. Sync offline-created customers
    const customerResult = await syncCustomers();
    console.log('[FullSync] Customers sync:', customerResult.success ? 'OK' : customerResult.error);
    
    // 3. Clear pending points adjustments — the backend already handled these
    //    when the orders were synced (reward_id/reward_points in the order payload
    //    triggers point deduction, and completed orders auto-earn points)
    const pendingPoints = offlineStorage.getPendingPointsAdjustments();
    if (pendingPoints.length > 0) {
      console.log(`[FullSync] Clearing ${pendingPoints.length} pending points adjustments (handled by order sync)`);
      offlineStorage.clearPendingPointsAdjustments();
    }
    
    isOnline.value = true;
    console.log('[FullSync] Full sync complete!');
    return { success: true };
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error('[FullSync] Full sync failed:', error.message);
    return { success: false, error: error.message };
  } finally {
    isSyncing.value = false;
  }
}

let syncInterval: ReturnType<typeof setInterval> | null = null;
let reconnectInterval: ReturnType<typeof setInterval> | null = null;

// Flag to track if user explicitly chose offline mode
let userChoseOffline = false;

export function setUserOfflineMode(chosen: boolean) {
  userChoseOffline = chosen;
}

// Start just the reconnection checker (for when user chose offline)
export function startReconnectChecker(): void {
  if (reconnectInterval) return;
  
  reconnectInterval = setInterval(async () => {
    const connected = await checkServerConnection();
    
    if (connected) {
      console.log('[ReconnectChecker] Connection restored!');
      isOnline.value = true;
      notifyOnlineStatusChange();
      
      // Stop checking and reload
      if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
      }
      
      // Clear offline token/user so it doesn't get stuck in offline mode
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Clear user choice and reload to online
      userChoseOffline = false;
      localStorage.setItem('restored_from_offline', 'true');
      window.location.reload();
    }
  }, 5000); // Check every 5 seconds
}

export function startSyncManager(): void {
  if (syncInterval) return;
  
  // Do an immediate check on startup - but don't override user's choice
  checkServerConnection().then(async (connected) => {
    isOnline.value = connected;
    // Only auto-set offline mode if user hasn't explicitly chosen
    if (!userChoseOffline) {
      setOfflineMode(!connected);
    }
    notifyOnlineStatusChange();

    // If we're online, check for leftover unsynced offline data
    // This handles the case where page reloaded after reconnect
    // (isOnline resets to true so the wasOffline→online transition never fires)
    if (connected) {
      const hasUnsyncedOrders = offlineStorage.getUnsyncedOrders().length > 0;
      const hasUnsyncedCustomers = offlineStorage.getCustomers().some(c => !c.synced);
      const hasPendingPoints = offlineStorage.getPendingPointsAdjustments().length > 0;

      if (hasUnsyncedOrders || hasUnsyncedCustomers || hasPendingPoints) {
        console.log('[SyncManager] Found leftover offline data on startup, triggering full sync...');
        await performFullSync();
      }
    }
  });
  
  syncInterval = setInterval(async () => {
    const wasOffline = !isOnline.value;
    const connected = await checkServerConnection();
    
    // Update online status
    isOnline.value = connected;
    notifyOnlineStatusChange();
    
    // If we just came back online, trigger sync and update offline mode
    // BUT only if user didn't explicitly choose offline
    if (connected && wasOffline && !userChoseOffline) {
      console.log('[SyncManager] Connection restored! Syncing...');
      setOfflineMode(false);
      await performFullSync();
    }
    
    // Also sync if connected (even if already online - handles pending orders)
    if (connected) {
      await syncOrders();
    }
  }, SYNC_INTERVAL);
}

export function stopSyncManager(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

export default {
  isOnline,
  isSyncing,
  lastSyncTime,
  subscribeToOnlineStatus,
  performFullSync,
  startSyncManager,
  stopSyncManager,
};
