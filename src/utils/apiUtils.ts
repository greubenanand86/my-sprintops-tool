export interface SafeApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
    stage?: string;
  };
  rawText?: string;
  contentType?: string;
}

export const getApiUrl = (endpoint: string) => {
  return `/.netlify/functions/${endpoint}`;
};

/**
 * CRITICAL: Safely logs diagnostic information while strictly scrubbing 
 * sensitive credentials, tokens, and authorization headers.
 */
export const debugLog = (step: string, data: any) => {
  if (import.meta.env.DEV) {
    try {
      // Deep clone to avoid mutating original objects
      const safeData = JSON.parse(JSON.stringify(data));
      
      const scrub = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        
        const sensitiveKeys = ['authorization', 'bearer', 'token', 'accessToken', 'pat', 'apiKey', 'password', 'secret'];
        
        Object.keys(obj).forEach(key => {
          if (sensitiveKeys.some(s => key.toLowerCase().includes(s.toLowerCase()))) {
            obj[key] = '[REDACTED]';
          } else if (typeof obj[key] === 'object') {
            scrub(obj[key]);
          }
        });
      };

      scrub(safeData);
      console.log(`[SprintOps Trace] ${step}:`, safeData);
    } catch (e) {
      console.log(`[SprintOps Trace] ${step}: [Unserializable Data Scrubbed]`);
    }
  }
};

export async function safeParseApiResponse<T = any>(response: Response): Promise<SafeApiResponse<T>> {
  const contentType = response.headers.get('content-type') || '';
  const rawText = await response.text();
  
  let parsedData: any;
  let isJson = contentType.includes('application/json');

  if (isJson || rawText.trim().startsWith('{')) {
    try {
      parsedData = JSON.parse(rawText);
      isJson = true;
    } catch (e) {
      isJson = false;
    }
  }

  // Handle local dev server proxy crashes
  if (response.ok && !isJson && rawText.includes('<!DOCTYPE html>')) {
    return {
      ok: false,
      status: 502,
      error: {
        code: 'BAD_GATEWAY',
        message: 'Received HTML instead of JSON. The backend function might have crashed.',
        details: { source: 'proxy' }
      }
    };
  }

  if (!response.ok) {
    let code = isJson && parsedData?.error?.code ? parsedData.error.code : `HTTP_${response.status}`;
    let message = isJson && parsedData?.error?.message ? parsedData.error.message : 'An unexpected error occurred.';
    
    // Map ADO specific status codes to structured app errors
    if (response.status === 401) {
      code = 'ADO_UNAUTHORIZED';
      message = 'Your Azure DevOps session has expired. Please sign in again.';
    } else if (response.status === 403) {
      code = 'ADO_FORBIDDEN';
      message = 'Access Denied: You do not have permission to perform this action in Azure DevOps.';
    }

    return {
      ok: false,
      status: response.status,
      data: parsedData,
      error: {
        code,
        message,
        stage: isJson ? parsedData?.error?.stage : 'network',
        details: { rawStatus: response.status }
      }
    };
  }

  return {
    ok: true,
    status: response.status,
    data: parsedData
  };
}
