import type { QueryClient } from '@tanstack/react-query';

export function invalidateDashboardQueries(queryClient: Pick<QueryClient, 'invalidateQueries'>) {
  return queryClient.invalidateQueries({ queryKey: ['dashboard'] });
}
