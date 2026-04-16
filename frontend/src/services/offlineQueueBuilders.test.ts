import { describe, expect, it } from 'vitest';
import {
  buildExpenseCreateQueueItem,
  buildPurchaseOrderCreateQueueItem,
  buildTransferCreateQueueItem,
} from './offlineQueueBuilders';

describe('buildTransferCreateQueueItem', () => {
  it('creates a transfer queue item with normalized transfer payload', () => {
    const item = buildTransferCreateQueueItem({
      localId: 'transfer-local-1',
      sourceBranchId: 2,
      destinationBranchId: 1,
      notes: 'Need stock',
      items: [{ product_id: 5, quantity: 3 }],
    });

    expect(item).toMatchObject({
      entityType: 'transfer',
      entityLocalId: 'transfer-local-1',
      operation: 'create',
      payload: {
        source_branch_id: 2,
        destination_branch_id: 1,
        notes: 'Need stock',
        items: [{ product_id: 5, quantity: 3 }],
      },
    });
  });
});

describe('buildPurchaseOrderCreateQueueItem', () => {
  it('creates a purchase order queue item with normalized purchase order payload', () => {
    const item = buildPurchaseOrderCreateQueueItem({
      localId: 'purchase-order-local-1',
      supplierId: 9,
      orderDate: '2026-04-15',
      notes: 'Offline stock-in',
      items: [{ product_id: 10, quantity: 4, unit_cost: 99.5 }],
    });

    expect(item).toMatchObject({
      entityType: 'purchase_order',
      entityLocalId: 'purchase-order-local-1',
      operation: 'create',
      payload: {
        supplier_id: 9,
        order_date: '2026-04-15',
        notes: 'Offline stock-in',
        items: [{ product_id: 10, quantity: 4, unit_cost: 99.5 }],
      },
    });
  });
});

describe('buildExpenseCreateQueueItem', () => {
  it('creates an expense queue item with normalized expense payload', () => {
    const item = buildExpenseCreateQueueItem({
      localId: 'expense-local-1',
      description: 'Fuel',
      amount: 500,
      category: 'Utilities',
      expenseDate: '2026-04-15T00:00:00.000Z',
      productId: null,
      quantity: 0,
    });

    expect(item).toMatchObject({
      entityType: 'expense',
      entityLocalId: 'expense-local-1',
      operation: 'create',
      payload: {
        description: 'Fuel',
        amount: 500,
        category: 'Utilities',
        expense_date: '2026-04-15T00:00:00.000Z',
        product_id: null,
        quantity: 0,
      },
    });
  });
});
