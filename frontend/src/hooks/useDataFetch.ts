import { useState, useEffect, useCallback } from 'react';
import type { ApiResponse } from '../types/api';

interface UseDataFetchOptions<T> {
  queryFn: () => Promise<ApiResponse<T>>;
  enabled?: boolean;
}

interface UseDataFetchResult<T> {
  data: T | null;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

export function useDataFetch<T>({
  queryFn,
  enabled = true,
}: UseDataFetchOptions<T>): UseDataFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await queryFn();
      setData(response.data as T);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [queryFn, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}
