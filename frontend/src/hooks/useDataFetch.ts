import { useState, useEffect, useCallback } from 'react';
import type { ApiResponse } from '../types/api';
import { getIsOfflineMode } from '../context/AuthContext';

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
    
    // Don't make API calls in offline mode - use cached data if available
    if (getIsOfflineMode()) {
      console.debug('[useDataFetch] Skipping API call - offline mode active');
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await queryFn();
      setData(response.data as T);
    } catch (err) {
      // Check if we're now offline after the error
      if (getIsOfflineMode()) {
        console.debug('[useDataFetch] Offline after error, cancelling fetch');
        setIsLoading(false);
        return;
      }
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
