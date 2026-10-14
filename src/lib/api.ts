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
 * and intercepts concurrent login termination (SESSION_SUPERSEDED).
 */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(apiUrl(input), init);

  if (res.status === 401 && typeof window !== 'undefined') {
    try {
      const clone = res.clone();
      const data = await clone.json();
      if (data?.code === 'SESSION_SUPERSEDED') {
        if ('BroadcastChannel' in window) {
          try {
            const bc = new BroadcastChannel('eot_auth_inactivity_channel');
            bc.postMessage({ type: 'LOGOUT', reason: 'concurrent_session' });
            bc.close();
          } catch {}
        }
        try {
          localStorage.setItem(
            'eot_logout_event',
            JSON.stringify({ timestamp: Date.now(), reason: 'concurrent_session' })
          );
          localStorage.removeItem('eot_last_activity');
          sessionStorage.clear();
        } catch {}
        window.location.href = '/login?reason=concurrent_session';
      }
    } catch {}
  }

  return res;
}
