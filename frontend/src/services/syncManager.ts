// frontend/src/services/syncManager.ts
import { delete as apiDelete, post as apiPost, put as apiPut } from '../api/axios';
import { setOfflineMode } from '../context/AuthContext';
import offlineStorage from './offlineStorage';
import { checkServerConnection } from './connectionCheck';
import {
  getRunnableQueueItems,
  type SyncQueueItem,
  markQueueItemConflicted,
  markQueueItemFailed,
  markQueueItemManualReview,
  markQueueItemSynced,
  markQueueItemSyncing,
} from './syncQueue';

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
  onlineCallbacks.forEach((cb) => cb());
}

function getSyncErrorMessage(err: unknown): string {
  const error = err as { response?: { data?: { error?: string; details?: string } }; message?: string };
  return error.response?.data?.details || error.response?.data?.error || error.message || 'Unknown sync error';
}

function getSyncErrorCode(err: unknown): string | null {
  const error = err as { response?: { data?: { code?: string } } };
  return error.response?.data?.code ?? null;
}

function isConflictError(err: unknown): boolean {
  return ['SYNC_CONFLICT', 'CUSTOMER_CONFLICT', 'ORDER_CONFLICT'].includes(getSyncErrorCode(err) ?? '');
}

function getConflictServerSnapshot(err: unknown): Record<string, unknown> | undefined {
  const error = err as { response?: { data?: { server?: Record<string, unknown> } } };
  return error.response?.data?.server;
}

function updateLastSyncTime(): void {
  lastSyncTime.value = new Date().toISOString();
  offlineStorage.setLastSync(lastSyncTime.value);
}

function markCustomerQueueItemSynced(item: SyncQueueItem, serverEntityId?: string): void {
  const localId = Number(item.entityLocalId);

  if (!Number.isNaN(localId)) {
    offlineStorage.markCustomerSynced(localId);
  }

  markQueueItemSynced(item.id, serverEntityId);
}

function markOrderQueueItemSynced(item: SyncQueueItem, serverEntityId?: string): void {
  offlineStorage.markOrderSyncedByTimestamp(item.entityLocalId);
  markQueueItemSynced(item.id, serverEntityId);
}

async function syncOrderItem(item: SyncQueueItem): Promise<void> {
  const response = await apiPost('/api/orders', item.payload);
  const responseData = response.data as { order?: { id?: number }; id?: number };
  const serverOrderId = responseData.order?.id ?? responseData.id;

  markOrderQueueItemSynced(item, serverOrderId ? String(serverOrderId) : undefined);
}

async function syncCustomerItem(item: SyncQueueItem): Promise<void> {
  if (item.operation === 'delete') {
    await apiDelete(`/api/customers/${item.entityLocalId}`);
    markQueueItemSynced(item.id);
    return;
  }

  const payload = {
    name: item.payload.name,
    email: item.payload.email,
    phone: item.payload.phone,
    address: item.payload.address,
    rfid_card_id: item.payload.rfidCardId,
  };

  const response = item.operation === 'create'
    ? await apiPost('/api/customers', payload)
    : await apiPut(`/api/customers/${item.entityLocalId}`, payload);

  const responseData = response.data as { customer?: { id?: number }; id?: number };
  const serverCustomerId = responseData.customer?.id ?? responseData.id;

  markCustomerQueueItemSynced(item, serverCustomerId ? String(serverCustomerId) : undefined);
}

function syncLoyaltyAdjustmentItem(item: SyncQueueItem): void {
  markQueueItemSynced(item.id);
}

async function processQueueItem(item: SyncQueueItem): Promise<void> {
  markQueueItemSyncing(item.id);

  try {
    if (item.entityType === 'order') {
      await syncOrderItem(item);
      return;
    }

    if (item.entityType === 'customer') {
      await syncCustomerItem(item);
      return;
    }

    syncLoyaltyAdjustmentItem(item);
  } catch (err: unknown) {
    const message = getSyncErrorMessage(err);

    if (isConflictError(err)) {
      if (item.entityType === 'order') {
        markQueueItemManualReview(item.id, message);
        return;
      }

      if (item.entityType === 'customer') {
        markQueueItemConflicted(item.id, message, {
          reason: message,
          local: item.payload,
          server: getConflictServerSnapshot(err),
        });
        return;
      }

      markQueueItemFailed(item.id, message);
      return;
    }

    markQueueItemFailed(item.id, message);
  }
}

async function processRunnableQueueItems(): Promise<number> {
  const runnableItems = getRunnableQueueItems();

  if (runnableItems.length === 0) {
    return 0;
  }

  let processedCount = 0;

  for (const item of runnableItems) {
    await processQueueItem(item);
    processedCount += 1;
  }

  return processedCount;
}

export async function syncOrders(): Promise<{ success: boolean; error?: string }> {
  try {
    const processed = await processRunnableQueueItems();

    if (processed > 0) {
      updateLastSyncTime();
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getSyncErrorMessage(err) };
  }
}

export async function syncCustomers(): Promise<{ success: boolean; error?: string }> {
  return syncOrders();
}

export async function performFullSync(): Promise<{ success: boolean; error?: string }> {
  if (isSyncing.value) return { success: false, error: 'Already syncing' };

  isSyncing.value = true;

  try {
    console.log('[FullSync] Starting full sync...');

    const syncResult = await syncOrders();
    console.log('[FullSync] Queue-driven sync:', syncResult.success ? 'OK' : syncResult.error);

    const pendingPoints = offlineStorage.getPendingPointsAdjustments();
    if (pendingPoints.length > 0) {
      console.log(`[FullSync] Clearing ${pendingPoints.length} pending points adjustments after queue sync`);
      offlineStorage.clearPendingPointsAdjustments();
    }

    isOnline.value = true;
    console.log('[FullSync] Full sync complete!');
    return syncResult;
  } catch (err: unknown) {
    const error = getSyncErrorMessage(err);
    console.error('[FullSync] Full sync failed:', error);
    return { success: false, error };
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

      if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
      }

      localStorage.removeItem('token');
      localStorage.removeItem('user');

      userChoseOffline = false;
      localStorage.setItem('restored_from_offline', 'true');
      window.location.reload();
    }
  }, 5000);
}

export function startSyncManager(): void {
  if (syncInterval) return;

  checkServerConnection().then(async (connected) => {
    isOnline.value = connected;

    if (!userChoseOffline) {
      setOfflineMode(!connected);
    }

    notifyOnlineStatusChange();

    if (connected) {
      const hasUnsyncedOrders = offlineStorage.getUnsyncedOrders().length > 0;
      const hasUnsyncedCustomers = offlineStorage.getCustomers().some((customer) => !customer.synced);
      const hasPendingPoints = offlineStorage.getPendingPointsAdjustments().length > 0;

      if (hasUnsyncedOrders || hasUnsyncedCustomers || hasPendingPoints || getRunnableQueueItems().length > 0) {
        console.log('[SyncManager] Found leftover offline data on startup, triggering full sync...');
        await performFullSync();
      }
    }
  });

  syncInterval = setInterval(async () => {
    const wasOffline = !isOnline.value;
    const connected = await checkServerConnection();

    isOnline.value = connected;
    notifyOnlineStatusChange();

    if (connected && wasOffline && !userChoseOffline) {
      console.log('[SyncManager] Connection restored! Syncing...');
      setOfflineMode(false);
      await performFullSync();
    }

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
