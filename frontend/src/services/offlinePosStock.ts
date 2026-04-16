import offlineStorage, { type LocalProduct } from './offlineStorage';

export interface OfflineStockCartItem {
  productId: number;
  quantity: number;
}

interface PosCategoryLike {
  id: number;
}

interface PosDataLike<TCategory extends PosCategoryLike = PosCategoryLike, TCustomer = unknown> {
  products: Array<LocalProduct & { category?: TCategory | null }>;
  categories: TCategory[];
  customers: TCustomer[];
}

export function applyOfflineStockDeduction(
  products: LocalProduct[],
  cartItems: OfflineStockCartItem[],
): LocalProduct[] {
  const quantityByProductId = new Map<number, number>();

  for (const item of cartItems) {
    quantityByProductId.set(item.productId, (quantityByProductId.get(item.productId) ?? 0) + item.quantity);
  }

  return products.map((product) => {
    if (product.is_service) {
      return product;
    }

    const quantityToDeduct = quantityByProductId.get(product.id);
    if (!quantityToDeduct) {
      return product;
    }

    return {
      ...product,
      branch_stock: Math.max(0, Number(product.branch_stock ?? 0) - quantityToDeduct),
    };
  });
}

export function persistOfflineBranchStockDeduction(
  branchKey: string,
  cartItems: OfflineStockCartItem[],
): LocalProduct[] {
  const updatedBranchProducts = applyOfflineStockDeduction(
    offlineStorage.getProductsByBranch(branchKey),
    cartItems,
  );

  offlineStorage.saveProductsByBranch(branchKey, updatedBranchProducts);

  const genericProducts = offlineStorage.getProducts();
  if (genericProducts.length > 0) {
    offlineStorage.saveProducts(applyOfflineStockDeduction(genericProducts, cartItems));
  }

  return updatedBranchProducts;
}

export function mergeOfflineBranchProductsIntoPosData<
  TCategory extends PosCategoryLike,
  TCustomer,
>(
  current: PosDataLike<TCategory, TCustomer> | undefined,
  updatedProducts: LocalProduct[],
): PosDataLike<TCategory, TCustomer> | undefined {
  if (!current) {
    return undefined;
  }

  return {
    ...current,
    products: updatedProducts.map((product) => ({
      ...product,
      category: current.categories.find((category) => category.id === product.category_id) ?? null,
    })),
  };
}
