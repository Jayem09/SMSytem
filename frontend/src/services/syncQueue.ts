export type SyncEntityType = 'order' | 'customer' | 'loyalty_adjustment';

export type SyncOperation = 'create' | 'update' | 'delete';

export type SyncStatus =
  | 'pending'
  | 'syncing'
  | 'failed'
  | 'conflicted'
  | 'manual_review'
  | 'synced';

export interface SyncConflictSnapshot {
  local?: Record<string, unknown>;
  server?: Record<string, unknown>;
  reason: string;
}

export interface SyncQueueItem {
  id: string;
  entityType: SyncEntityType;
  entityLocalId: string;
  operation: SyncOperation;
  status: SyncStatus;
  createdAt: string;
  updatedAt: string;
  attemptCount: number;
  lastAttemptAt: string | null;
  lastError: string | null;
  serverEntityId: string | null;
  dependsOn: string[];
  conflictSnapshot: SyncConflictSnapshot | null;
  payload: Record<string, unknown>;
}

export interface SyncQueueSummary {
  pending: number;
  syncing: number;
  failed: number;
  conflicted: number;
  manualReview: number;
  synced: number;
  lastSuccessfulSync: string | null;
}

export interface CreateSyncQueueItemInput {
  entityType: SyncEntityType;
  entityLocalId: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  dependsOn?: string[];
}

export const SYNC_QUEUE_KEY = 'sync_queue_items';
export const SYNC_HISTORY_LIMIT = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSyncStatus(value: unknown): value is SyncStatus {
  return typeof value === 'string' && [
    'pending',
    'syncing',
    'failed',
    'conflicted',
    'manual_review',
    'synced',
  ].includes(value);
}

function isSyncOperation(value: unknown): value is SyncOperation {
  return typeof value === 'string' && ['create', 'update', 'delete'].includes(value);
}

function isSyncEntityType(value: unknown): value is SyncEntityType {
  return typeof value === 'string' && ['order', 'customer', 'loyalty_adjustment'].includes(value);
}

function isConflictSnapshot(value: unknown): value is SyncConflictSnapshot | null {
  if (value === null) {
    return true;
  }

  if (!isRecord(value)) {
    return false;
  }

  return typeof value.reason === 'string';
}

function isSyncQueueItem(value: unknown): value is SyncQueueItem {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    isSyncEntityType(value.entityType) &&
    typeof value.entityLocalId === 'string' &&
    isSyncOperation(value.operation) &&
    isSyncStatus(value.status) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    typeof value.attemptCount === 'number' &&
    (typeof value.lastAttemptAt === 'string' || value.lastAttemptAt === null) &&
    (typeof value.lastError === 'string' || value.lastError === null) &&
    (typeof value.serverEntityId === 'string' || value.serverEntityId === null) &&
    Array.isArray(value.dependsOn) &&
    value.dependsOn.every((dependency) => typeof dependency === 'string') &&
    isConflictSnapshot(value.conflictSnapshot) &&
    isRecord(value.payload)
  );
}

function parseQueue(raw: string | null): SyncQueueItem[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isSyncQueueItem) : [];
  } catch {
    return [];
  }
}

function readQueue(): SyncQueueItem[] {
  return parseQueue(localStorage.getItem(SYNC_QUEUE_KEY));
}

function writeQueue(items: SyncQueueItem[]): void {
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(items));
}

function countByStatus(items: SyncQueueItem[], status: SyncStatus): number {
  return items.filter((item) => item.status === status).length;
}

function getLastSuccessfulSync(items: SyncQueueItem[]): string | null {
  const syncedItems = items.filter((item) => item.status === 'synced');
  return syncedItems.at(-1)?.updatedAt ?? null;
}

export function getSyncQueue(): SyncQueueItem[] {
  return readQueue();
}

export function saveSyncQueue(items: SyncQueueItem[]): void {
  writeQueue(items);
}

export function enqueueSyncItem(item: SyncQueueItem): void {
  writeQueue([...readQueue(), item]);
}

export function createSyncQueueItem(input: CreateSyncQueueItemInput): SyncQueueItem {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    entityType: input.entityType,
    entityLocalId: input.entityLocalId,
    operation: input.operation,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    attemptCount: 0,
    lastAttemptAt: null,
    lastError: null,
    serverEntityId: null,
    dependsOn: input.dependsOn ?? [],
    conflictSnapshot: null,
    payload: input.payload,
  };
}

export function updateSyncQueueItem(
  itemId: string,
  updater: (item: SyncQueueItem) => SyncQueueItem,
): void {
  const items = readQueue();
  writeQueue(items.map((item) => (item.id === itemId ? updater(item) : item)));
}

export function removeSyncQueueItem(itemId: string): void {
  writeQueue(readQueue().filter((item) => item.id !== itemId));
}

export function markQueueItemSyncing(itemId: string): void {
  updateSyncQueueItem(itemId, (item) => ({
    ...item,
    status: 'syncing',
    attemptCount: item.attemptCount + 1,
    lastAttemptAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastError: null,
  }));
}

export function markQueueItemFailed(itemId: string, error: string): void {
  updateSyncQueueItem(itemId, (item) => ({
    ...item,
    status: 'failed',
    updatedAt: new Date().toISOString(),
    lastError: error,
  }));
}

export function markQueueItemConflicted(
  itemId: string,
  error: string,
  conflictSnapshot?: SyncConflictSnapshot,
): void {
  updateSyncQueueItem(itemId, (item) => ({
    ...item,
    status: 'conflicted',
    updatedAt: new Date().toISOString(),
    lastError: error,
    conflictSnapshot: conflictSnapshot ?? item.conflictSnapshot,
  }));
}

export function markQueueItemSynced(itemId: string, serverEntityId?: string): void {
  updateSyncQueueItem(itemId, (item) => ({
    ...item,
    status: 'synced',
    updatedAt: new Date().toISOString(),
    serverEntityId: serverEntityId ?? item.serverEntityId,
    lastError: null,
  }));
}

export function getSyncQueueItemsByStatus(status: SyncStatus): SyncQueueItem[] {
  return readQueue().filter((item) => item.status === status);
}

export function findLatestEntitySyncItem(
  entityType: SyncEntityType,
  entityLocalId: string,
  statuses: SyncStatus[] = ['pending', 'syncing', 'failed', 'conflicted', 'manual_review'],
): SyncQueueItem | null {
  const matches = readQueue().filter(
    (item) =>
      item.entityType === entityType &&
      item.entityLocalId === entityLocalId &&
      statuses.includes(item.status),
  );

  return matches.at(-1) ?? null;
}

export function getRunnableQueueItems(): SyncQueueItem[] {
  const items = readQueue();

  return items.filter((item) => {
    const isActionable = ['pending', 'failed'].includes(item.status);
    const dependenciesSatisfied = item.dependsOn.every((dependencyId) => {
      const dependency = items.find((candidate) => candidate.id === dependencyId);
      return dependency?.status === 'synced';
    });

    return isActionable && dependenciesSatisfied;
  });
}

export function upsertPendingEntityMutation(item: SyncQueueItem): void {
  const items = readQueue();
  const existing = items.find(
    (queueItem) =>
      queueItem.entityType === item.entityType &&
      queueItem.entityLocalId === item.entityLocalId &&
      ['pending', 'failed', 'conflicted'].includes(queueItem.status),
  );

  if (!existing) {
    writeQueue([...items, item]);
    return;
  }

  writeQueue(
    items.map((queueItem) =>
      queueItem.id === existing.id
        ? {
            ...queueItem,
            operation: item.operation,
            payload: item.payload,
            dependsOn: item.dependsOn,
            updatedAt: item.updatedAt,
            lastError: null,
          }
        : queueItem,
    ),
  );
}

export function retryQueueItem(itemId: string): void {
  updateSyncQueueItem(itemId, (item) => ({
    ...item,
    status: 'pending',
    updatedAt: new Date().toISOString(),
    lastError: null,
  }));
}

export function markQueueItemManualReview(itemId: string, reason: string): void {
  updateSyncQueueItem(itemId, (item) => ({
    ...item,
    status: 'manual_review',
    updatedAt: new Date().toISOString(),
    lastError: reason,
  }));
}

export function resolveCustomerConflictKeepServer(itemId: string): void {
  updateSyncQueueItem(itemId, (item) => ({
    ...item,
    status: 'synced',
    updatedAt: new Date().toISOString(),
    conflictSnapshot: null,
    lastError: null,
  }));
}

export function resolveCustomerConflictKeepLocal(itemId: string): void {
  updateSyncQueueItem(itemId, (item) => ({
    ...item,
    status: 'pending',
    updatedAt: new Date().toISOString(),
    conflictSnapshot: null,
    lastError: null,
  }));
}

export function getRecentSyncHistory(limit = SYNC_HISTORY_LIMIT): SyncQueueItem[] {
  return readQueue()
    .filter((item) => item.status === 'synced')
    .slice(-Math.max(limit, 0));
}

export function getSyncQueueSummary(): SyncQueueSummary {
  const items = readQueue();

  return {
    pending: countByStatus(items, 'pending'),
    syncing: countByStatus(items, 'syncing'),
    failed: countByStatus(items, 'failed'),
    conflicted: countByStatus(items, 'conflicted'),
    manualReview: countByStatus(items, 'manual_review'),
    synced: countByStatus(items, 'synced'),
    lastSuccessfulSync: getLastSuccessfulSync(items),
  };
}
