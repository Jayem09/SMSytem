import { createSyncQueueItem, type SyncQueueItem } from './syncQueue';

interface TransferQueueItemInput {
  localId?: string;
  sourceBranchId: number;
  destinationBranchId: number;
  notes: string;
  items: Array<{ product_id: number; quantity: number }>;
}

interface PurchaseOrderQueueItemInput {
  localId?: string;
  supplierId: number | null;
  orderDate: string;
  notes: string;
  items: Array<{ product_id: number; quantity: number; unit_cost: number }>;
}

interface ExpenseQueueItemInput {
  localId?: string;
  description: string;
  amount: number;
  category: string;
  expenseDate: string;
  productId: number | null;
  quantity: number;
}

function createLocalId(prefix: string, providedLocalId?: string): string {
  return providedLocalId ?? `${prefix}-${Date.now()}`;
}

export function buildTransferCreateQueueItem(input: TransferQueueItemInput): SyncQueueItem {
  return createSyncQueueItem({
    entityType: 'transfer',
    entityLocalId: createLocalId('offline-transfer', input.localId),
    operation: 'create',
    payload: {
      source_branch_id: input.sourceBranchId,
      destination_branch_id: input.destinationBranchId,
      notes: input.notes,
      items: input.items,
    },
  });
}

export function buildPurchaseOrderCreateQueueItem(input: PurchaseOrderQueueItemInput): SyncQueueItem {
  return createSyncQueueItem({
    entityType: 'purchase_order',
    entityLocalId: createLocalId('offline-purchase-order', input.localId),
    operation: 'create',
    payload: {
      supplier_id: input.supplierId,
      order_date: input.orderDate,
      notes: input.notes,
      items: input.items,
    },
  });
}

export function buildExpenseCreateQueueItem(input: ExpenseQueueItemInput): SyncQueueItem {
  return createSyncQueueItem({
    entityType: 'expense',
    entityLocalId: createLocalId('offline-expense', input.localId),
    operation: 'create',
    payload: {
      description: input.description,
      amount: input.amount,
      category: input.category,
      expense_date: input.expenseDate,
      product_id: input.productId,
      quantity: input.quantity,
    },
  });
}
