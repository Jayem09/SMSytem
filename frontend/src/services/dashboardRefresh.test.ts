import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { invalidateDashboardQueries } from './dashboardRefresh';

describe('invalidateDashboardQueries', () => {
  it('invalidates dashboard stats queries without touching unrelated queries', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const dashboardKey = ['dashboard', 'stats', 30, 'ALL'] as const;
    const productsKey = ['products'] as const;

    queryClient.setQueryData(dashboardKey, { total_sales: 1000 });
    queryClient.setQueryData(productsKey, [{ id: 1, name: 'Tire' }]);

    await invalidateDashboardQueries(queryClient);

    expect(queryClient.getQueryState(dashboardKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(productsKey)?.isInvalidated).toBe(false);
  });
});
