export async function fetchWithRetry(url: string, options: RequestInit, retries = 2, delay = 1000): Promise<Response> {
  try {
    const res = await fetch(url, options);
    // Retry on 5xx server errors or 429 Too Many Requests
    if (!res.ok && (res.status >= 500 || res.status === 429) && retries > 0) {
      throw new Error(`HTTP ${res.status}`);
    }
    return res;
  } catch (err) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 1.5);
    }
    throw err;
  }
}
