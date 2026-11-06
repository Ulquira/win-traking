const isLocalHost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const PROD_API_URL = 'https://webwin-api-service-eus.azurewebsites.net';

export const API_BASE_URL = isLocalHost
    ? 'http://localhost:3001'
    : (import.meta.env.VITE_API_URL || PROD_API_URL).replace(/\/+$/, '');

export async function apiFetch<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options?.headers || {}),
        },
    });
    return response.json();
}