import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockLocalStorage, installMockLocalStorage } from '../test/mockLocalStorage';

const { mockPost, mockPut, mockDelete, mockSetLastSync } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockDelete: vi.fn(),
  mockSetLastSync: vi.fn(),
}));

const mockLocalStorage = createMockLocalStorage();
installMockLocalStorage(mockLocalStorage);

vi.mock('../api/axios', () => ({
  post: mockPost,
  put: mockPut,
  delete: mockDelete,
}));

vi.mock('../context/AuthContext', () => ({
  setOfflineMode: vi.fn(),
}));

vi.mock('./connectionCheck', () => ({
  checkServerConnection: vi.fn(),
}));

vi.mock('../lib/queryClient', () => ({
  queryClient: {
    invalidateQueries: vi.fn(),
  },
}));

vi.mock('./offlineStorage', () => ({
  default: {
    setLastSync: mockSetLastSync,
    markCustomerSynced: vi.fn(),
    markOrderSyncedByTimestamp: vi.fn(),
    getPendingPointsAdjustments: vi.fn(() => []),
    clearPendingPointsAdjustments: vi.fn(),
    getCustomers: vi.fn(() => []),
  },
}));

import { createSyncQueueItem, enqueueSyncItem, getSyncQueue, saveSyncQueue } from './syncQueue';
import { syncOrders } from './syncManager';

describe('syncOrders', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    saveSyncQueue([]);
    vi.clearAllMocks();
  });

  it('syncs queued transfer creates through the transfer API', async () => {
    mockPost.mockResolvedValueOnce({
      status: 201,
      data: { transfer: { id: 42 } },
    });

    enqueueSyncItem(createSyncQueueItem({
      entityType: 'transfer',
      entityLocalId: 'local-transfer-1',
      operation: 'create',
      payload: {
        source_branch_id: 2,
        destination_branch_id: 1,
        notes: 'Need stock',
        items: [{ product_id: 5, quantity: 3 }],
      },
    }));

    const result = await syncOrders();

    expect(result).toEqual({ success: true });
    expect(mockPost).toHaveBeenCalledWith('/api/transfers', {
      source_branch_id: 2,
      destination_branch_id: 1,
      notes: 'Need stock',
      items: [{ product_id: 5, quantity: 3 }],
    });
    expect(getSyncQueue()[0]).toMatchObject({
      status: 'synced',
      serverEntityId: '42',
    });
    expect(mockSetLastSync).toHaveBeenCalled();
  });

  it('syncs queued purchase order creates through the purchase order API', async () => {
    mockPost.mockResolvedValueOnce({
      status: 201,
      data: { purchase_order: { id: 77 } },
    });

    enqueueSyncItem(createSyncQueueItem({
      entityType: 'purchase_order',
      entityLocalId: 'local-po-1',
      operation: 'create',
      payload: {
        supplier_id: 9,
        order_date: '2026-04-15',
        notes: 'Offline PO',
        items: [{ product_id: 10, quantity: 4, unit_cost: 99.5 }],
      },
    }));

    const result = await syncOrders();

    expect(result).toEqual({ success: true });
    expect(mockPost).toHaveBeenCalledWith('/api/purchase-orders', {
      supplier_id: 9,
      order_date: '2026-04-15',
      notes: 'Offline PO',
      items: [{ product_id: 10, quantity: 4, unit_cost: 99.5 }],
    });
    expect(getSyncQueue()[0]).toMatchObject({
      status: 'synced',
      serverEntityId: '77',
    });
    expect(mockSetLastSync).toHaveBeenCalled();
  });

  it('syncs queued expense creates through the expense API', async () => {
    mockPost.mockResolvedValueOnce({
      status: 201,
      data: { id: 101 },
    });

    enqueueSyncItem(createSyncQueueItem({
      entityType: 'expense',
      entityLocalId: 'local-expense-1',
      operation: 'create',
      payload: {
        description: 'Fuel',
        amount: 500,
        category: 'Utilities',
        expense_date: '2026-04-15T00:00:00.000Z',
        product_id: null,
        quantity: 0,
      },
    }));

    const result = await syncOrders();

    expect(result).toEqual({ success: true });
    expect(mockPost).toHaveBeenCalledWith('/api/expenses', {
      description: 'Fuel',
      amount: 500,
      category: 'Utilities',
      expense_date: '2026-04-15T00:00:00.000Z',
      product_id: null,
      quantity: 0,
    });
    expect(getSyncQueue()[0]).toMatchObject({
      status: 'synced',
      serverEntityId: '101',
    });
    expect(mockSetLastSync).toHaveBeenCalled();
  });
});
