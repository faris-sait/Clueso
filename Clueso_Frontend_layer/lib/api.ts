import { auth } from '@clerk/nextjs/server';

/**
 * Make an authenticated API call to the backend
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const { getToken } = await auth();
  const token = await getToken();

  const headers = {
    ...options.headers,
    'Authorization': token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json',
  };

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Client-side authenticated fetch hook
 */
export function useAuthenticatedFetch() {
  return async (url: string, options: RequestInit = {}) => {
    // Token will be automatically included by Clerk's fetch wrapper
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
      },
    });

    return response;
  };
}
