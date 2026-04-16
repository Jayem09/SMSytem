import { beforeEach, describe, expect, it, vi } from 'vitest';
import offlineStorage, { type LocalProduct } from './offlineStorage';
import {
  applyOfflineStockDeduction,
  mergeOfflineBranchProductsIntoPosData,
  persistOfflineBranchStockDeduction,
} from './offlinePosStock';
import { createMockLocalStorage, installMockLocalStorage } from '../test/mockLocalStorage';

const mockLocalStorage = createMockLocalStorage();
installMockLocalStorage(mockLocalStorage);

describe('applyOfflineStockDeduction', () => {
  it('deducts quantity from matching non-service products and clamps at zero', () => {
    const products: LocalProduct[] = [
      { id: 1, name: 'Tire A', price: 100, branch_stock: 990, category_id: 7, brand_id: 14 },
      { id: 2, name: 'Service A', price: 50, branch_stock: 999, category_id: 8, brand_id: 15, is_service: true },
    ];

    const updated = applyOfflineStockDeduction(products, [
      { productId: 1, quantity: 10 },
      { productId: 2, quantity: 10 },
      { productId: 999, quantity: 5 },
    ]);

    expect(updated[0].branch_stock).toBe(980);
    expect(updated[1].branch_stock).toBe(999);
    expect(products[0].branch_stock).toBe(990);
  });
});

describe('persistOfflineBranchStockDeduction', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  it('persists deducted stock to both branch and generic product caches', () => {
    const products: LocalProduct[] = [
      { id: 1, name: 'Tire A', price: 100, branch_stock: 990, category_id: 7, brand_id: 14 },
      { id: 2, name: 'Tire B', price: 200, branch_stock: 50, category_id: 7, brand_id: 14 },
    ];

    offlineStorage.saveProducts(products);
    offlineStorage.saveProductsByBranch('4', products);

    const updatedProducts = persistOfflineBranchStockDeduction('4', [{ productId: 1, quantity: 10 }]);

    expect(updatedProducts[0].branch_stock).toBe(980);
    expect(offlineStorage.getProductsByBranch('4')[0].branch_stock).toBe(980);
    expect(offlineStorage.getProducts()[0].branch_stock).toBe(980);
  });
});

describe('mergeOfflineBranchProductsIntoPosData', () => {
  it('replaces products while preserving category objects from the cached POS data', () => {
    const merged = mergeOfflineBranchProductsIntoPosData(
      {
        products: [],
        categories: [{ id: 7, name: 'TIRES' }],
        customers: [{ id: 1, name: 'John' }],
      },
      [
        { id: 1, name: 'Tire A', price: 100, branch_stock: 980, category_id: 7, brand_id: 14 },
      ],
    );

    expect(merged).toEqual({
      products: [
        {
          id: 1,
          name: 'Tire A',
          price: 100,
          branch_stock: 980,
          category_id: 7,
          brand_id: 14,
          category: { id: 7, name: 'TIRES' },
        },
      ],
      categories: [{ id: 7, name: 'TIRES' }],
      customers: [{ id: 1, name: 'John' }],
    });
  });
});
