/**
 * Global API Configuration & URL Resolver
 * 
 * Configures the standard /eoft API prefix across all application endpoints.
 * Environment variable: NEXT_PUBLIC_API_PREFIX (default: '/eoft').
 */
export const API_PREFIX = process.env.NEXT_PUBLIC_API_PREFIX !== undefined
  ? process.env.NEXT_PUBLIC_API_PREFIX
  : '/eoft';

/**
 * Returns a normalized API URL with the /eoft prefix prepended.
 *
 * Examples:
 *   apiUrl('/api/auth/login')            => '/eoft/api/auth/login'
 *   apiUrl('/api/purchase-orders')       => '/eoft/api/purchase-orders'
 *   apiUrl('/eoft/api/suppliers')        => '/eoft/api/suppliers' (avoids double prefix)
 */
export function apiUrl(endpoint: string): string {
  if (!endpoint) return '';
  const clean = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // If already prefixed with /eoft, return as is
  if (clean.startsWith('/eoft/') || clean === '/eoft') {
    return clean;
  }

  // Prepend API_PREFIX (default '/eoft')
  return `${API_PREFIX}${clean}`;
}

/**
 * Convenience fetch wrapper that automatically prefixes API paths with /eoft
 */
export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(input), init);
}
