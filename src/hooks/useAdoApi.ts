import { useCallback } from 'react';
import { fetchWithRetry } from '../utils/api';
import { getApiUrl, safeParseApiResponse, SafeApiResponse } from '../utils/apiUtils';

export function useAdoApi() {
  const callAdoApi = useCallback(async <T = any>(
    endpoint: string, 
    body: any = {}, 
    method: 'POST' | 'GET' | 'PATCH' | 'PUT' = 'POST'
  ): Promise<SafeApiResponse<T>> => {
    
    try {
      const url = getApiUrl(endpoint);
      const options: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };

      if (method !== 'GET') {
        options.body = JSON.stringify(body);
      }

      const response = await fetchWithRetry(url, options);
      return await safeParseApiResponse<T>(response);
    } catch (err: any) {
      return {
        ok: false,
        status: 500,
        error: { code: 'NETWORK_ERROR', message: err.message || 'Failed to contact the serverless function.' }
      };
    }
  }, []);

  return { callAdoApi };
}
