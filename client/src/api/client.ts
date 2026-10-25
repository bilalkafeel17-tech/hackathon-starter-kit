import { ApiResponse } from '../types';

const BASE_URL = '/api';

// Generic fetch wrapper adapted to standard { success, data, error } backend responses
async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}${endpoint}`;

  const token = localStorage.getItem('hcm_token');

  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    ...options,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      json.error?.message ||
      json.message ||
      `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  return json;
}

export async function fetchHealth(): Promise<{ status: string; time: string }> {
  const res = await fetch('/api/health');
  if (!res.ok) {
    throw new Error('Server unreachable');
  }

  const json = await res.json();
  if (json.data) {
    return json.data;
  }
  return json;
}

export { apiFetch };
