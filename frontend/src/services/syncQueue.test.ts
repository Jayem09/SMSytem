import { describe, expect, it } from 'vitest';
import { createSyncQueueItem } from './syncQueue';

describe('createSyncQueueItem', () => {
  it('creates a pending queue item with default metadata', () => {
    const item = createSyncQueueItem({
      entityType: 'order',
      entityLocalId: 'local-order-1',
      operation: 'create',
      payload: { totalAmount: 100 },
    });

    expect(item.entityType).toBe('order');
    expect(item.entityLocalId).toBe('local-order-1');
    expect(item.operation).toBe('create');
    expect(item.status).toBe('pending');
    expect(item.attemptCount).toBe(0);
    expect(item.lastAttemptAt).toBeNull();
    expect(item.lastError).toBeNull();
    expect(item.serverEntityId).toBeNull();
    expect(item.dependsOn).toEqual([]);
    expect(item.conflictSnapshot).toBeNull();
    expect(item.payload).toEqual({ totalAmount: 100 });
    expect(item.id).toBeTruthy();
    expect(item.createdAt).toBeTruthy();
    expect(item.updatedAt).toBeTruthy();
    expect(item.createdAt).toBe(item.updatedAt);
  });

  it('keeps provided dependencies on the queue item', () => {
    const dependsOn = ['parent-order-1', 'parent-order-2'];

    const item = createSyncQueueItem({
      entityType: 'order',
      entityLocalId: 'local-order-2',
      operation: 'update',
      payload: { totalAmount: 125 },
      dependsOn,
    });

    expect(item.dependsOn).toEqual(dependsOn);
    expect(item.createdAt).toBe(item.updatedAt);
  });
});
