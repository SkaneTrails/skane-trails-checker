export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public reason: string,
  ) {
    super(`API Error ${status}: ${reason}`);
    this.name = 'ApiClientError';
  }
}

type TokenGetter = () => Promise<string | null>;
type UnauthorizedCallback = (hadToken: boolean) => void;

let authTokenGetter: TokenGetter | null = null;
let onUnauthorized: UnauthorizedCallback | null = null;

export function setAuthTokenGetter(getter: TokenGetter | null): void {
  authTokenGetter = getter;
}

export function setOnUnauthorized(callback: UnauthorizedCallback | null): void {
  onUnauthorized = callback;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }

  let hadToken = false;
  if (authTokenGetter) {
    try {
      const token = await authTokenGetter();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
        hadToken = true;
      }
    } catch {
      // Token fetch failed (e.g. Firebase transient error) — proceed without auth
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  // If the caller provided a signal, compose it with our timeout controller
  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiClientError(0, 'Request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 401) {
    onUnauthorized?.(hadToken);
    const text = await response.text().catch(() => 'Unauthorized');
    throw new ApiClientError(401, text);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error');
    throw new ApiClientError(response.status, text);
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
