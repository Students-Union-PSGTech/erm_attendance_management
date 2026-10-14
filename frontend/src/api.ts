// Base URL configuration for backend API
const envBackendUrl = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim();
const normalizedBackendUrl = envBackendUrl ? envBackendUrl.replace(/\/+$/, '') : '';

export const API_BASE_URL = normalizedBackendUrl ? `${normalizedBackendUrl}/api` : '/api';

/**
 * Resolves an endpoint path to the full API URL based on VITE_BACKEND_URL.
 * Supports paths with or without '/api' prefix, leading slash, etc.
 * Example:
 *   apiUrl('/auth/login') -> 'http://localhost:4000/api/auth/login' (or '/api/auth/login')
 *   apiUrl('/api/auth/login') -> 'http://localhost:4000/api/auth/login' (or '/api/auth/login')
 */
export function apiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  // Strip duplicate '/api' prefix if already present in path
  const stripped = path.startsWith('/api/')
    ? path.slice(4)
    : path === '/api'
      ? ''
      : path.startsWith('/')
        ? path
        : `/${path}`;

  return `${API_BASE_URL}${stripped}`;
}

/**
 * Fetch wrapper that automatically targets the configured API base URL.
 */
export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? apiUrl(input) : input;
  return fetch(url, init);
}

/**
 * Axios-compatible API client object configured with:
 * baseURL: `${import.meta.env.VITE_BACKEND_URL}/api`
 */
export const api = {
  baseURL: API_BASE_URL,
  url: apiUrl,

  async get(endpoint: string, options?: RequestInit) {
    return apiFetch(endpoint, {
      ...options,
      method: 'GET',
    });
  },

  async post(endpoint: string, data?: unknown, options?: RequestInit) {
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    const headers = new Headers(options?.headers || {});
    if (data !== undefined && !isFormData && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    return apiFetch(endpoint, {
      ...options,
      method: 'POST',
      headers,
      body: isFormData
        ? (data as FormData)
        : data !== undefined
          ? (typeof data === 'string' ? data : JSON.stringify(data))
          : undefined,
    });
  },

  async put(endpoint: string, data?: unknown, options?: RequestInit) {
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    const headers = new Headers(options?.headers || {});
    if (data !== undefined && !isFormData && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    return apiFetch(endpoint, {
      ...options,
      method: 'PUT',
      headers,
      body: isFormData
        ? (data as FormData)
        : data !== undefined
          ? (typeof data === 'string' ? data : JSON.stringify(data))
          : undefined,
    });
  },

  async patch(endpoint: string, data?: unknown, options?: RequestInit) {
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    const headers = new Headers(options?.headers || {});
    if (data !== undefined && !isFormData && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    return apiFetch(endpoint, {
      ...options,
      method: 'PATCH',
      headers,
      body: isFormData
        ? (data as FormData)
        : data !== undefined
          ? (typeof data === 'string' ? data : JSON.stringify(data))
          : undefined,
    });
  },

  async delete(endpoint: string, options?: RequestInit) {
    return apiFetch(endpoint, {
      ...options,
      method: 'DELETE',
    });
  },
};

export default api;
