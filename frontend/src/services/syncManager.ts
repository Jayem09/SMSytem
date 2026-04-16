// frontend/src/services/syncManager.ts
import { delete as apiDelete, post as apiPost, put as apiPut } from '../api/axios';
import { setOfflineMode } from '../context/AuthContext';
import offlineStorage from './offlineStorage';
import { checkServerConnection } from './connectionCheck';
import {
  getSyncQueue,
  getRunnableQueueItems,
  type SyncQueueItem,
  markQueueItemConflicted,
  markQueueItemFailed,
  markQueueItemManualReview,
  markQueueItemSynced,
  markQueueItemSyncing,
} from './syncQueue';
import { queryClient } from '../lib/queryClient';

const SYNC_INTERVAL = 3000; // 3 seconds - fast enough for small sync queue

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

function toStringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toNumberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toOptionalIntValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toOptionalUintValue(value: unknown): number | null {
  const numberValue = toOptionalIntValue(value);
  return numberValue && numberValue > 0 ? numberValue : null;
}

function buildOrderSyncPayload(payload: Record<string, unknown>) {
  const items = Array.isArray(payload.items) ? payload.items : [];

  return {
    customer_id: toOptionalUintValue(payload.customerId ?? payload.customer_id),
    branch_id: toOptionalUintValue(payload.branchId ?? payload.branch_id),
    guest_name: toStringValue(payload.guestName ?? payload.guest_name),
    guest_phone: toStringValue(payload.guestPhone ?? payload.guest_phone),
    service_advisor_name: toStringValue(payload.serviceAdvisorName ?? payload.service_advisor_name),
    payment_method: toStringValue(payload.paymentMethod ?? payload.payment_method),
    discount_amount: toNumberValue(payload.discountAmount ?? payload.discount_amount),
    status: toStringValue(payload.status) || 'completed',
    receipt_type: toStringValue(payload.receiptType ?? payload.receipt_type) || 'SI',
    tin: toStringValue(payload.tin),
    business_address: toStringValue(payload.businessAddress ?? payload.business_address),
    withholding_tax_rate: toNumberValue(payload.withholdingTaxRate ?? payload.withholding_tax_rate),
    reward_id: toOptionalUintValue(payload.rewardId ?? payload.reward_id),
    reward_points: toNumberValue(payload.rewardPoints ?? payload.reward_points),
    items: items
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => ({
        product_id: toNumberValue(item.product_id),
        quantity: toNumberValue(item.quantity, 1),
      })),
  };
}

function buildTransferSyncPayload(payload: Record<string, unknown>) {
  const items = Array.isArray(payload.items) ? payload.items : [];

  return {
    source_branch_id: toNumberValue(payload.source_branch_id ?? payload.sourceBranchId),
    destination_branch_id: toNumberValue(payload.destination_branch_id ?? payload.destinationBranchId),
    notes: toStringValue(payload.notes),
    items: items
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => ({
        product_id: toNumberValue(item.product_id),
        quantity: toNumberValue(item.quantity, 1),
      })),
  };
}

function buildPurchaseOrderSyncPayload(payload: Record<string, unknown>) {
  const items = Array.isArray(payload.items) ? payload.items : [];

  return {
    supplier_id: toOptionalUintValue(payload.supplier_id ?? payload.supplierId),
    order_date: toStringValue(payload.order_date ?? payload.orderDate),
    notes: toStringValue(payload.notes),
    items: items
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => ({
        product_id: toNumberValue(item.product_id),
        quantity: toNumberValue(item.quantity, 1),
        unit_cost: toNumberValue(item.unit_cost ?? item.unitCost),
      })),
  };
}

function buildExpenseSyncPayload(payload: Record<string, unknown>) {
  return {
    description: toStringValue(payload.description),
    amount: toNumberValue(payload.amount),
    category: toStringValue(payload.category),
    expense_date: toStringValue(payload.expense_date ?? payload.expenseDate),
    product_id: toOptionalUintValue(payload.product_id ?? payload.productId),
    quantity: toNumberValue(payload.quantity),
  };
}

async function syncOrderItem(item: SyncQueueItem): Promise<void> {
  const payload = buildOrderSyncPayload(item.payload);
  
  const response = await apiPost('/api/orders', payload);
  
  const responseData = response.data as { order?: { id?: number }; id?: number; error?: string; details?: string };
  
  if (response.status >= 400 || responseData.error) {
    const errorMessage = responseData.details || responseData.error || `Order sync failed with status ${response.status}`;
    console.error('[syncOrderItem] Server error:', errorMessage);
    throw new Error(errorMessage);
  }
  
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

  const responseData = response.data as { customer?: { id?: number }; id?: number; error?: string; details?: string };

  if (response.status >= 400 || responseData.error) {
    throw new Error(responseData.details || responseData.error || `Customer sync failed with status ${response.status}`);
  }

  const serverCustomerId = responseData.customer?.id ?? responseData.id;

  markCustomerQueueItemSynced(item, serverCustomerId ? String(serverCustomerId) : undefined);
}

async function syncTransferItem(item: SyncQueueItem): Promise<void> {
  if (item.operation !== 'create') {
    throw new Error(`Transfer sync does not support ${item.operation} operations`);
  }

  const payload = buildTransferSyncPayload(item.payload);
  const response = await apiPost('/api/transfers', payload);
  const responseData = response.data as { transfer?: { id?: number }; error?: string; details?: string };

  if (response.status >= 400 || responseData.error) {
    throw new Error(responseData.details || responseData.error || `Transfer sync failed with status ${response.status}`);
  }

  const serverTransferId = responseData.transfer?.id;
  markQueueItemSynced(item.id, serverTransferId ? String(serverTransferId) : undefined);
}

async function syncPurchaseOrderItem(item: SyncQueueItem): Promise<void> {
  if (item.operation !== 'create') {
    throw new Error(`Purchase order sync does not support ${item.operation} operations`);
  }

  const payload = buildPurchaseOrderSyncPayload(item.payload);
  const response = await apiPost('/api/purchase-orders', payload);
  const responseData = response.data as { purchase_order?: { id?: number }; error?: string; details?: string };

  if (response.status >= 400 || responseData.error) {
    throw new Error(responseData.details || responseData.error || `Purchase order sync failed with status ${response.status}`);
  }

  const serverPurchaseOrderId = responseData.purchase_order?.id;
  markQueueItemSynced(item.id, serverPurchaseOrderId ? String(serverPurchaseOrderId) : undefined);
}

async function syncExpenseItem(item: SyncQueueItem): Promise<void> {
  if (item.operation !== 'create') {
    throw new Error(`Expense sync does not support ${item.operation} operations`);
  }

  const payload = buildExpenseSyncPayload(item.payload);
  const response = await apiPost('/api/expenses', payload);
  const responseData = response.data as { id?: number; error?: string; details?: string };

  if (response.status >= 400 || responseData.error) {
    throw new Error(responseData.details || responseData.error || `Expense sync failed with status ${response.status}`);
  }

  const serverExpenseId = responseData.id;
  markQueueItemSynced(item.id, serverExpenseId ? String(serverExpenseId) : undefined);
}

function syncLoyaltyAdjustmentItem(item: SyncQueueItem): void {
  // Loyalty points are now handled by the ORDER sync on the backend
  // (backend adds/deducts points when creating the order)
  // So we just mark this as synced without any API call
  console.log('[SyncManager] Loyalty adjustment handled by order sync:', item.payload);
  markQueueItemSynced(item.id);
}

async function processQueueItem(item: SyncQueueItem): Promise<boolean> {
  markQueueItemSyncing(item.id);

  try {
    if (item.entityType === 'order') {
      await syncOrderItem(item);
      return true;
    }

    if (item.entityType === 'customer') {
      await syncCustomerItem(item);
      return true;
    }

    if (item.entityType === 'transfer') {
      await syncTransferItem(item);
      return true;
    }

    if (item.entityType === 'purchase_order') {
      await syncPurchaseOrderItem(item);
      return true;
    }

    if (item.entityType === 'expense') {
      await syncExpenseItem(item);
      return true;
    }

    syncLoyaltyAdjustmentItem(item);
    return true;
  } catch (err: unknown) {
    const message = getSyncErrorMessage(err);

    if (isConflictError(err)) {
      if (item.entityType === 'order') {
        markQueueItemManualReview(item.id, message);
        return false;
      }

      if (item.entityType === 'customer') {
        markQueueItemConflicted(item.id, message, {
          reason: message,
          local: item.payload,
          server: getConflictServerSnapshot(err),
        });
        return false;
      }

      markQueueItemFailed(item.id, message);
      return false;
    }

    markQueueItemFailed(item.id, message);
    return false;
  }
}

async function processRunnableQueueItems(): Promise<{ processedCount: number; failedCount: number }> {
  const runnableItems = getRunnableQueueItems();

  const priority: Record<string, number> = {
    customer: 0,
    order: 1,
    transfer: 2,
    purchase_order: 3,
    expense: 4,
    loyalty_adjustment: 5,
  };

  const sortedRunnableItems = [...runnableItems].sort(
    (a, b) => (priority[a.entityType] ?? 99) - (priority[b.entityType] ?? 99),
  );

  if (sortedRunnableItems.length === 0) {
    return { processedCount: 0, failedCount: 0 };
  }

  let processedCount = 0;
  let failedCount = 0;

  for (const item of sortedRunnableItems) {
    const currentQueue = getSyncQueue();
    const freshItem = currentQueue.find((candidate) => candidate.id === item.id);

    if (!freshItem) {
      continue;
    }

    const dependenciesSatisfied = freshItem.dependsOn.every((dependencyId) => {
      const dependency = currentQueue.find((candidate) => candidate.id === dependencyId);
      return dependency?.status === 'synced';
    });

    if (!dependenciesSatisfied) {
      continue;
    }

    const succeeded = await processQueueItem(freshItem);
    processedCount += 1;

    if (!succeeded) {
      failedCount += 1;
    }
  }

  return { processedCount, failedCount };
}

export async function syncOrders(): Promise<{ success: boolean; error?: string }> {
  try {
    const { processedCount, failedCount } = await processRunnableQueueItems();

    if (processedCount > 0 && failedCount === 0) {
      updateLastSyncTime();
    }

    if (failedCount > 0) {
      return { success: false, error: `${failedCount} sync item(s) failed` };
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
    if (syncResult.success && pendingPoints.length > 0) {
      console.log(`[FullSync] Clearing ${pendingPoints.length} pending points adjustments after queue sync`);
      offlineStorage.clearPendingPointsAdjustments();
    }

    // AFTER successful sync: clear stale offline cache and refetch fresh data from server
    if (syncResult.success) {
      console.log('[FullSync] Sync successful - clearing offline cache and refetching...');
      
      // Clear offline customers cache to force refetch from server
      const cachedCustomers = offlineStorage.getCustomers();
      if (cachedCustomers.some(c => !c.synced)) {
        console.log('[FullSync] Clearing customers cache - will refetch from server');
        localStorage.removeItem('offline_customers');
      }

      // Invalidate React Query cache 
      queryClient.invalidateQueries({ queryKey: ['pos', 'data'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      
      // Dispatch custom event for pages that don't use React Query
      window.dispatchEvent(new CustomEvent('sync_completed', { detail: { success: true } }));
      
      console.log('[FullSync] Cache invalidated + event dispatched - UI should update');
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
  console.log('[SyncManager] STARTING sync manager...');
  if (syncInterval) return;

  checkServerConnection().then(async (connected) => {
    console.log('[SyncManager] Initial connection check:', connected);
    isOnline.value = connected;

    if (!userChoseOffline) {
      setOfflineMode(!connected);
    }

    notifyOnlineStatusChange();

    if (connected) {
      // Check for ANY pending data - queue items or offline storage
      const queueItems = getSyncQueue();
      const hasPendingQueue = queueItems.some(item => item.status === 'pending' || item.status === 'failed');
      
      console.log('[SyncManager] Startup - queue items:', queueItems.map(i => ({ id: i.id.slice(0,8), status: i.status, type: i.entityType })));

      if (hasPendingQueue) {
        console.log('[SyncManager] Found pending queue items - triggering full sync...');
        await performFullSync();
      }
    }
  });

  syncInterval = setInterval(async () => {
    const connected = await checkServerConnection();

    isOnline.value = connected;
    notifyOnlineStatusChange();

    // ALWAYS check for pending items when connected - don't wait for "wasOffline"
    if (connected) {
      const queueItems = getSyncQueue();
      console.log('[SyncManager] Interval check - queue:', queueItems.map(i => ({ id: i.id.slice(0,8), status: i.status, type: i.entityType })));
      const pendingItems = queueItems.filter(item => 
        item.status === 'pending' || item.status === 'failed'
      );
      
      if (pendingItems.length > 0) {
        console.log('[SyncManager] Found pending items - running FULL sync...');
        await performFullSync();
      }
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
